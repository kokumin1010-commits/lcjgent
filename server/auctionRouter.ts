import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { ensureAuctionSchemaReady, getAuctionPool, getAuctionSchemaUpgradeHealth } from "./auctionSchemaUpgrade";
import { getAuctionImportFile, getAuctionImportHistory, importAuctionBatch } from "./auctionImportService";

const batchRecordSchema = z.object({
  productId: z.string().min(1).max(255),
  productName: z.string().max(500),
  startPrice: z.number().finite().min(0).nullable(),
  finalPrice: z.number().finite().min(0).nullable(),
  totalGmv: z.number().finite().min(0).nullable(),
  totalOrders: z.number().int().min(0).nullable(),
  auctionCount: z.number().int().min(1).max(10000),
  auctionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roundsJson: z.string().min(2).max(1_500_000),
});

export const auctionRouter = router({
  list: protectedProcedure
    .input(z.object({ productId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      let sql = "SELECT * FROM auction_records ORDER BY auctionDate DESC, createdAt DESC";
      let params: unknown[] = [];
      if (input?.productId) {
        sql = "SELECT * FROM auction_records WHERE productId = ? ORDER BY auctionDate DESC, createdAt DESC";
        params = [input.productId];
      }
      const [rows] = await pool.query(sql, params);
      const results = rows as any[];
      if (results.length) {
        const needBackfill = results.filter((row) => !row.liverName && row.livestreamId);
        if (needBackfill.length) {
          const ids = [...new Set(needBackfill.map((row) => row.livestreamId))];
          const [livestreamRows] = await pool
            .query(`SELECT id, streamerName FROM brand_livestreams WHERE id IN (${ids.map(() => "?").join(",")})`, ids)
            .catch(() => [[]]);
          const livestreamMap = new Map((livestreamRows as any[]).map((row) => [String(row.id), row.streamerName]));
          results.forEach((row) => {
            if (!row.liverName && row.livestreamId && livestreamMap.has(String(row.livestreamId))) {
              row.liverName = livestreamMap.get(String(row.livestreamId));
            }
          });
        }
      }
      return results;
    }),

  create: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      await pool.query(
        `INSERT INTO auction_records
          (productId, productName, chineseName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, roundsJson, createdBy, livestreamId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.productId || null,
          input.productName || null,
          input.chineseName || null,
          input.startPrice ?? null,
          input.finalPrice ?? null,
          input.totalGmv ?? null,
          input.totalOrders ?? null,
          input.auctionCount ?? null,
          input.liverName || null,
          input.auctionDate || null,
          input.note || null,
          input.roundsJson || null,
          ctx.user?.id || null,
          input.livestreamId || null,
        ],
      );
      return { success: true };
    }),

  importBatch: protectedProcedure
    .input(z.object({
      sourceFileName: z.string().min(1).max(500),
      sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
      sourceFileBase64: z.string().min(1).max(40_000_000),
      sourceFileSize: z.number().int().min(1).max(30_000_000),
      sourceMimeType: z.string().max(255),
      sourceRowCount: z.number().int().min(1).max(100000),
      skippedRowCount: z.number().int().min(0).max(100000),
      liverName: z.string().min(1).max(255),
      records: z.array(batchRecordSchema).min(1).max(5000),
    }))
    .mutation(({ input, ctx }) => importAuctionBatch({ ...input, createdBy: ctx.user?.id || null })),

  importHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ input }) => getAuctionImportHistory(input?.limit ?? 20)),

  getImportFile: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(({ input }) => getAuctionImportFile(input.batchId)),

  schemaHealth: adminProcedure.query(() => getAuctionSchemaUpgradeHealth()),

  update: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      const { id, ...data } = input;
      const sets: string[] = [];
      const params: unknown[] = [];
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      });
      if (sets.length > 0) {
        params.push(id);
        await pool.query(`UPDATE auction_records SET ${sets.join(", ")} WHERE id = ?`, params);
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      await pool.query("DELETE FROM auction_records WHERE id = ?", [input.id]);
      return { success: true };
    }),

  recognizeImage: protectedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
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
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
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
        return JSON.parse(text);
      } catch {
        return { productName: "", rounds: [] };
      }
    }),
});
