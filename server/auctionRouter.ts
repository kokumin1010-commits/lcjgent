import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import mysql from "mysql2/promise";
let pool: mysql.Pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL || "",
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return pool;
}
let tableCreated = false;
async function ensureTable() {
  if (tableCreated) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId VARCHAR(255) DEFAULT NULL,
      productName VARCHAR(500) DEFAULT NULL,
      chineseName VARCHAR(255) DEFAULT NULL,
      startPrice DECIMAL(10,2) DEFAULT NULL,
      finalPrice DECIMAL(10,2) DEFAULT NULL,
      totalGmv DECIMAL(12,2) DEFAULT NULL,
      totalOrders INT DEFAULT NULL,
      auctionCount INT DEFAULT NULL,
      liverName VARCHAR(255) DEFAULT NULL,
      auctionDate DATE DEFAULT NULL,
      note TEXT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      createdBy INT DEFAULT NULL
    )
  `);
  // Add columns if they don't exist (safe for existing tables)
  await pool.query("ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS chineseName VARCHAR(255) DEFAULT NULL").catch(() => {});
  await pool.query("ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS totalGmv DECIMAL(12,2) DEFAULT NULL").catch(() => {});
  await pool.query("ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS totalOrders INT DEFAULT NULL").catch(() => {});
  await pool.query("ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS auctionCount INT DEFAULT NULL").catch(() => {});
  tableCreated = true;
}
export const auctionRouter = router({
  list: protectedProcedure.input(z.object({
    productId: z.string().optional(),
  }).optional()).query(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    let sql = "SELECT * FROM auction_records ORDER BY auctionDate DESC, createdAt DESC";
    let params: any[] = [];
    if (input?.productId) {
      sql = "SELECT * FROM auction_records WHERE productId = ? ORDER BY auctionDate DESC, createdAt DESC";
      params = [input.productId];
    }
    const [rows] = await pool.query(sql, params);
    return rows as any[];
  }),
  create: protectedProcedure.input(z.object({
    productId: z.string().optional(),
    productName: z.string().optional(),
    chineseName: z.string().optional(),
    startPrice: z.number().optional(),
    finalPrice: z.number().optional(),
    totalGmv: z.number().optional(),
    totalOrders: z.number().optional(),
    auctionCount: z.number().optional(),
    liverName: z.string().optional(),
    auctionDate: z.string().optional(),
    note: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    await ensureTable();
    const pool = getPool();
    await pool.query(
      `INSERT INTO auction_records (productId, productName, chineseName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productId || null, input.productName || null, input.chineseName || null, input.startPrice || null, input.finalPrice || null, input.totalGmv || null, input.totalOrders || null, input.auctionCount || null, input.liverName || null, input.auctionDate || null, input.note || null, (ctx.user as any)?.id || null]
    );
    return { success: true };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    productId: z.string().optional(),
    productName: z.string().optional(),
    chineseName: z.string().optional(),
    startPrice: z.number().optional(),
    finalPrice: z.number().optional(),
    totalGmv: z.number().optional(),
    totalOrders: z.number().optional(),
    auctionCount: z.number().optional(),
    liverName: z.string().optional(),
    auctionDate: z.string().optional(),
    note: z.string().optional(),
  })).mutation(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    const { id, ...data } = input;
    const sets: string[] = [];
    const params: any[] = [];
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        params.push(val);
      }
    });
    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE auction_records SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await ensureTable();
    const pool = getPool();
    await pool.query("DELETE FROM auction_records WHERE id = ?", [input.id]);
    return { success: true };
  }),
  // AI画像認識: TikTok拍卖スクリーンショットから情報を抽出
  recognizeImage: protectedProcedure.input(z.object({
    base64: z.string(),
    mimeType: z.string(),
  })).mutation(async ({ input }) => {
    const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an OCR assistant specialized in reading TikTok Shop auction screenshots (拍卖详情). These screenshots show a product at the top with its name, ID, inventory count (库存量), transaction count (成交件数), and GMV. Below is a table with columns: 发品编号(#1,#2...), 起拍价, 销售价, 竞拍人数, 获胜者. Extract the data accurately and return JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
            {
              type: "text",
              text: `This is a TikTok Shop auction screenshot. Extract the following fields:
- productName: full product name (Japanese)
- startPrice: starting bid price (number only, no currency symbol)
- finalPrice: final sale price or highest bid (number only)
- totalGmv: total GMV amount (number only)
- totalOrders: total number of orders/bids (number only)
- auctionCount: number of auction rounds shown (count the #1, #2, etc rows)

Return ONLY valid JSON like: {"productName":"...","startPrice":6000,"finalPrice":10070,"totalGmv":99771,"totalOrders":9,"auctionCount":9}
If a field cannot be determined, omit it.`,
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "auction_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              productName: { type: "string", description: "Product name" },
              startPrice: { type: "number", description: "Starting price" },
              finalPrice: { type: "number", description: "Final/sale price" },
              totalGmv: { type: "number", description: "Total GMV" },
              totalOrders: { type: "number", description: "Total orders" },
              auctionCount: { type: "number", description: "Number of auction rounds" },
            },
            required: ["productName"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = response.choices?.[0]?.message?.content || "{}";
    try {
      return JSON.parse(text);
    } catch {
      return { productName: "" };
    }
  }),
});
