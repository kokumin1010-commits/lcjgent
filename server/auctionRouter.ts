import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { ensureAuctionSchemaReady, getAuctionPool, getAuctionSchemaUpgradeHealth } from "./auctionSchemaUpgrade";
import { getAuctionImportFile, getAuctionImportHistory, importAuctionBatch, repairAuctionImportBatch } from "./auctionImportService";
import { createAuctionRecord, deleteAuctionRound, updateAuctionRecord, updateAuctionRound } from "./auctionRecordPersistence";

const optionalText = (maximum: number) => z.string().max(maximum).nullable().optional();
const optionalNumber = z.number().finite().min(0).nullable().optional();
const auctionRoundSchema = z.object({
  roundNumber: z.number().int().min(1).max(10000), startPrice: z.number().finite().min(0), salePrice: z.number().finite().min(0),
  bidderCount: z.number().int().min(0).max(1_000_000), winner: z.string().max(500), skuName: z.string().max(500),
  skuId: z.string().max(255), promotionType: z.string().max(50), startTime: z.string().max(255), duration: z.number().finite().min(0),
  auctionPurpose: z.enum(["unknown", "market_test", "traffic", "normal_sale"]),
  lotQuantity: z.number().int().min(1).max(1_000_000).nullable(),
  unitCost: z.number().finite().min(0).max(1_000_000_000).nullable(),
  maxLossBudget: z.number().finite().min(0).max(1_000_000_000_000).nullable(),
  winnerLimit: z.number().int().min(1).max(1_000).nullable(),
});

const manualAuctionRecordSchema = z.object({
  productId: optionalText(255),
  productName: optionalText(500),
  chineseName: optionalText(255),
  startPrice: optionalNumber,
  finalPrice: optionalNumber,
  totalGmv: optionalNumber,
  totalOrders: z.number().int().min(0).max(1_000_000).nullable().optional(),
  auctionCount: z.number().int().min(0).max(10000).nullable().optional(),
  liverName: optionalText(255),
  auctionDate: z.string().max(30).nullable().optional(),
  note: optionalText(10000),
  roundsJson: z.string().max(1_500_000).nullable().optional(),
  livestreamId: optionalText(50),
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
    .input(manualAuctionRecordSchema)
    .mutation(async ({ input, ctx }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      return createAuctionRecord(pool, input as Record<string, unknown>, ctx.user?.id || null);
    }),

  importBatch: protectedProcedure
    .input(z.object({
      sourceFileName: z.string().min(1).max(500),
      sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
      sourceFileBase64: z.string().min(1).max(40_000_000),
      sourceFileSize: z.number().int().min(1).max(30_000_000),
      sourceMimeType: z.string().max(255),
      fallbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      liverName: z.string().min(1).max(255),
    }))
    .mutation(({ input, ctx }) => importAuctionBatch({ ...input, createdBy: ctx.user?.id || null })),

  importHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ input }) => getAuctionImportHistory(input?.limit ?? 20)),

  getImportFile: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(({ input }) => getAuctionImportFile(input.batchId)),

  repairImportBatch: adminProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .mutation(({ input }) => repairAuctionImportBatch(input.batchId)),

  schemaHealth: adminProcedure.query(() => getAuctionSchemaUpgradeHealth()),

  update: protectedProcedure
    .input(manualAuctionRecordSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      const { id, ...data } = input;
      return updateAuctionRecord(pool, id, data as Record<string, unknown>);
    }),

  updateRound: protectedProcedure
    .input(z.object({ recordId: z.number().int().positive(), roundIndex: z.number().int().min(0), round: auctionRoundSchema }))
    .mutation(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      return updateAuctionRound(pool, input.recordId, input.roundIndex, input.round);
    }),

  deleteRound: protectedProcedure
    .input(z.object({ recordId: z.number().int().positive(), roundIndex: z.number().int().min(0) }))
    .mutation(async ({ input }) => {
      const pool = getAuctionPool();
      await ensureAuctionSchemaReady(pool);
      return deleteAuctionRound(pool, input.recordId, input.roundIndex);
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
      const content = response.choices?.[0]?.message?.content;
      const text = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part) => ("text" in part && typeof part.text === "string" ? part.text : "")).join("") || "{}"
          : "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { productName: "", rounds: [] };
      }
    }),
});
