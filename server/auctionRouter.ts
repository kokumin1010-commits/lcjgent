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
    // Backfill liverName from brand_livestreams if empty and livestreamId exists
    const results = rows as any[];
    if (results.length) {
      const needBackfill = results.filter((r: any) => !r.liverName && r.livestreamId);
      if (needBackfill.length) {
        const ids = needBackfill.map((r: any) => r.livestreamId);
        const [lsRows] = await pool.query(`SELECT id, streamerName FROM brand_livestreams WHERE id IN (${ids.map(() => '?').join(',')})`, ids).catch(() => [[]]);
        const lsMap = new Map((lsRows as any[]).map((ls: any) => [String(ls.id), ls.streamerName]));
        results.forEach((r: any) => { if (!r.liverName && r.livestreamId && lsMap.has(String(r.livestreamId))) r.liverName = lsMap.get(String(r.livestreamId)); });
      }
    }
    return results;
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
    roundsJson: z.string().optional(),
    livestreamId: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    await ensureTable();
    const pool = getPool();
    // Ensure columns exist
    await pool.query(`ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS roundsJson TEXT DEFAULT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE auction_records ADD COLUMN IF NOT EXISTS livestreamId VARCHAR(50) DEFAULT NULL`).catch(() => {});
    await pool.query(
      `INSERT INTO auction_records (productId, productName, chineseName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, roundsJson, createdBy, livestreamId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productId || null, input.productName || null, input.chineseName || null, input.startPrice || null, input.finalPrice || null, input.totalGmv || null, input.totalOrders || null, input.auctionCount || null, input.liverName || null, input.auctionDate || null, input.note || null, input.roundsJson || null, (ctx.user as any)?.id || null, input.livestreamId || null]
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
          content: "You are an OCR assistant specialized in reading TikTok Shop auction detail pages. Extract ALL data including per-round details. Return JSON only.",
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
              text: `This is a TikTok Shop auction detail screenshot. It shows:
- Top: Product name, ID, 库存量(inventory), 成交件数(transactions), GMV
- Table with columns: 发品编号(#1,#2...), 起拍价(start price), 销售价(sale price), 竞拍人数(bidders), 获胜者(winner)

Extract ALL data into this JSON format:
{
  "productName": "full product name in Japanese",
  "productId": "the TikTok product ID number",
  "inventory": number of inventory,
  "totalOrders": number of 成交件数,
  "totalGmv": GMV number (no currency symbol),
  "startPrice": the 起拍价 (same for all rounds, number only),
  "rounds": [
    {"roundNumber": 1, "startPrice": 6000, "salePrice": 10070, "bidderCount": 7, "winner": "ヒロン❤️"},
    {"roundNumber": 2, "startPrice": 6000, "salePrice": 12200, "bidderCount": 7, "winner": "ナナ❤️"}
  ]
}
Extract EVERY row from the table. Return ONLY valid JSON.`,
            },
          ],
        },
      ],
    });
    const text = response.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch {
      return { productName: "", rounds: [] };
    }
  }),

});
