import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { sampleRequests, sampleRequestItems, liverCredits, mallProducts, livers } from "../drizzle/schema";
import { eq, desc, and, sql, like, or } from "drizzle-orm";
import { jwtVerify } from "jose";
import { ENV } from "./_core/env";

// Helper: verify liver token
async function verifyLiverToken(token: string): Promise<{ liverId: number; type: string } | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    if (!payload || payload.type !== "liver") return null;
    return { liverId: payload.liverId as number, type: payload.type as string };
  } catch {
    return null;
  }
}

// ランク判定ロジック
function calculateRank(streamingHours: number, monthlySales: number): "none" | "silver" | "gold" | "black" {
  if (streamingHours >= 60 && monthlySales >= 3000000) return "black";
  if (streamingHours >= 30 && monthlySales >= 1000000) return "gold";
  if (streamingHours >= 10 && monthlySales >= 500000) return "silver";
  return "none";
}

// ランクボーナス
function getRankBonus(rank: string): number {
  switch (rank) {
    case "black": return 50000;
    case "gold": return 15000;
    case "silver": return 5000;
    default: return 0;
  }
}

export const sampleRequestRouter = router({
  // ========== ライバー向けAPI ==========

  // クレジット残高取得（ライバー用）
  getMyCredit: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const liverData = await verifyLiverToken(input.token);
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const credits = await db.select().from(liverCredits)
        .where(and(eq(liverCredits.liverId, liverData.liverId), eq(liverCredits.month, currentMonth)));

      if (credits.length === 0) {
        // 前月以前の繰り越しクレジットを確認
        const allCredits = await db.select().from(liverCredits)
          .where(eq(liverCredits.liverId, liverData.liverId))
          .orderBy(desc(liverCredits.month))
          .limit(1);
        
        const carryover = allCredits.length > 0 ? Math.max(0, Number(allCredits[0].remainingCredit)) : 0;

        return {
          month: currentMonth,
          rank: "none" as const,
          streamingHours: 0,
          monthlySales: 0,
          totalCredit: carryover,
          usedCredit: 0,
          remainingCredit: carryover,
          carryoverCredit: carryover,
          isFirstMonth: false,
          rankBonus: 0,
          streamingCredit: 0,
          salesCredit: 0,
        };
      }

      const c = credits[0];
      return {
        month: c.month,
        rank: c.rank as "none" | "silver" | "gold" | "black",
        streamingHours: Number(c.streamingHours),
        monthlySales: Number(c.monthlySales),
        totalCredit: Number(c.totalCredit),
        usedCredit: Number(c.usedCredit),
        remainingCredit: Number(c.remainingCredit),
        carryoverCredit: Number(c.carryoverCredit),
        isFirstMonth: c.isFirstMonth || false,
        rankBonus: Number(c.rankBonus),
        streamingCredit: Number(c.streamingCredit),
        salesCredit: Number(c.salesCredit),
      };
    }),

  // 商品検索（mall_productsから）
  searchProducts: publicProcedure
    .input(z.object({
      token: z.string(),
      query: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const liverData = await verifyLiverToken(input.token);
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      const results = await db.select({
        id: mallProducts.id,
        name: mallProducts.name,
        price: mallProducts.price,
        imageUrl: mallProducts.imageUrl,
        brand: mallProducts.brand,
        category: mallProducts.category,
      }).from(mallProducts)
        .where(and(
          eq(mallProducts.status, "active"),
          or(
            sql`LOWER(${mallProducts.name}) LIKE LOWER(${`%${input.query}%`})`,
            sql`LOWER(${mallProducts.brand}) LIKE LOWER(${`%${input.query}%`})`,
            sql`LOWER(${mallProducts.category}) LIKE LOWER(${`%${input.query}%`})`
          )
        ))
        .limit(30);

      return results.map(p => ({
        id: p.id,
        name: p.name || "不明",
        regularPrice: Number(p.price) || 0,
        imageUrl: p.imageUrl,
        brand: p.brand,
        category: p.category,
      }));
    }),

  // サンプル請求作成
  create: publicProcedure
    .input(z.object({
      token: z.string(),
      scheduledDate: z.string(),
      postalCode: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      memo: z.string().optional(),
      items: z.array(z.object({
        mallProductId: z.number().nullable(),
        productName: z.string(),
        price: z.number(),
        quantity: z.number().min(1),
      })).min(1),
    }))
    .mutation(async ({ input }) => {
      const liverData = await verifyLiverToken(input.token);
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();

      // ライバー情報取得
      const liverRows = await db.select().from(livers).where(eq(livers.id, liverData.liverId));
      if (liverRows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "ライバーが見つかりません" });
      const liver = liverRows[0];

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // クレジット残高取得
      const creditRows = await db.select().from(liverCredits)
        .where(and(eq(liverCredits.liverId, liverData.liverId), eq(liverCredits.month, currentMonth)));

      const credit = creditRows.length > 0 ? creditRows[0] : null;
      const remainingCredit = credit ? Number(credit.remainingCredit) : 0;
      const isFirstMonth = credit?.isFirstMonth || false;

      // 合計金額計算
      const totalAmount = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // 初月チェック（10万円以内）
      if (isFirstMonth && totalAmount > 100000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "初月は定価合計10万円以内でお願いします" });
      }

      // 同一商品月2個制限チェック
      const existingRequests = await db.select().from(sampleRequests)
        .where(and(
          eq(sampleRequests.liverId, liverData.liverId),
          eq(sampleRequests.month, currentMonth),
          sql`${sampleRequests.status} != 'cancelled'`
        ));

      if (existingRequests.length > 0) {
        const existingRequestIds = existingRequests.map(r => r.id);
        const existingItems = await db.select().from(sampleRequestItems)
          .where(sql`${sampleRequestItems.requestId} IN (${sql.join(existingRequestIds.map(id => sql`${id}`), sql`, `)})`);

        // 商品ごとの累計数量をチェック
        const productQuantityMap: Record<string, number> = {};
        for (const item of existingItems) {
          const key = item.productName;
          productQuantityMap[key] = (productQuantityMap[key] || 0) + item.quantity;
        }

        for (const newItem of input.items) {
          const existingQty = productQuantityMap[newItem.productName] || 0;
          if (existingQty + newItem.quantity > 2) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `「${newItem.productName}」は今月すでに${existingQty}個請求済みです。月2個までです。`,
            });
          }
        }
      }

      // クレジット使用額と実費の計算
      let creditUsed = Math.min(totalAmount, remainingCredit);
      let outOfPocketAmount = 0;
      if (totalAmount > remainingCredit && !isFirstMonth) {
        // 超過分は60%OFF（定価の40%）
        const excessAmount = totalAmount - remainingCredit;
        outOfPocketAmount = Math.round(excessAmount * 0.4);
      }

      // 住所をライバープロフィールに保存（次回自動入力用）
      if (input.address) {
        await db.execute(
          sql`UPDATE livers SET shipping_postal_code = ${input.postalCode || null}, shipping_address = ${input.address || null}, shipping_phone = ${input.phone || null} WHERE id = ${liverData.liverId}`
        );
      }

      // サンプル請求を作成
      const result = await db.insert(sampleRequests).values({
        liverId: liverData.liverId,
        liverName: liver.name,
        month: currentMonth,
        scheduledDate: new Date(input.scheduledDate),
        totalAmount: String(totalAmount),
        creditUsed: String(creditUsed),
        outOfPocketAmount: String(outOfPocketAmount),
        status: "pending",
        postalCode: input.postalCode || null,
        address: input.address || null,
        phone: input.phone || null,
        memo: input.memo || null,
      });

      const requestId = Number(result[0].insertId);

      // 商品アイテムを登録
      for (const item of input.items) {
        const subtotal = item.price * item.quantity;
        await db.insert(sampleRequestItems).values({
          requestId,
          mallProductId: item.mallProductId,
          productName: item.productName,
          price: String(item.price),
          quantity: item.quantity,
          subtotal: String(subtotal),
        });
      }

      return { id: requestId, message: "サンプル請求を送信しました" };
    }),

  // 自分の請求履歴取得
  getMyRequests: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const liverData = await verifyLiverToken(input.token);
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      const requests = await db.select().from(sampleRequests)
        .where(eq(sampleRequests.liverId, liverData.liverId))
        .orderBy(desc(sampleRequests.createdAt));

      // 各請求のアイテムを取得
      const result = [];
      for (const req of requests) {
        const items = await db.select().from(sampleRequestItems)
          .where(eq(sampleRequestItems.requestId, req.id));
        result.push({
          ...req,
          totalAmount: Number(req.totalAmount),
          creditUsed: Number(req.creditUsed),
          outOfPocketAmount: Number(req.outOfPocketAmount),
          cashAmount: Number(req.cashAmount),
          items: items.map(i => ({
            ...i,
            price: Number(i.price),
            subtotal: Number(i.subtotal),
          })),
        });
      }

      return result;
    }),

  // 保存済み配送先住所を取得
  getSavedAddress: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const liverData = await verifyLiverToken(input.token);
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      
      // livers テーブルから配送先住所を取得
      const rows = await db.execute(
        sql`SELECT shipping_postal_code, shipping_address, shipping_phone FROM livers WHERE id = ${liverData.liverId}`
      );
      
      const liverRow = (rows as any)[0]?.[0];
      if (!liverRow) return null;

      return {
        postalCode: liverRow.shipping_postal_code || "",
        address: liverRow.shipping_address || "",
        phone: liverRow.shipping_phone || "",
      };
    }),

  // ========== 運営向けAPI ==========

  // 全サンプル請求一覧（運営用）
  listAll: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      month: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      let conditions = [];
      if (input.status) conditions.push(eq(sampleRequests.status, input.status as any));
      if (input.month) conditions.push(eq(sampleRequests.month, input.month));

      const requests = conditions.length > 0
        ? await db.select().from(sampleRequests).where(and(...conditions)).orderBy(desc(sampleRequests.createdAt))
        : await db.select().from(sampleRequests).orderBy(desc(sampleRequests.createdAt));

      const result = [];
      for (const req of requests) {
        const items = await db.select().from(sampleRequestItems)
          .where(eq(sampleRequestItems.requestId, req.id));
        result.push({
          ...req,
          totalAmount: Number(req.totalAmount),
          creditUsed: Number(req.creditUsed),
          outOfPocketAmount: Number(req.outOfPocketAmount),
          cashAmount: Number(req.cashAmount),
          items: items.map(i => ({
            ...i,
            price: Number(i.price),
            subtotal: Number(i.subtotal),
          })),
        });
      }

      return result;
    }),

  // 請求承認
  approve: protectedProcedure
    .input(z.object({
      id: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const rows = await db.select().from(sampleRequests).where(eq(sampleRequests.id, input.id));
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      const request = rows[0];

      if (request.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この請求は審査待ちではありません" });
      }

      // クレジット消費を反映（アトミック更新）
      const creditUsed = Number(request.creditUsed);
      if (creditUsed > 0) {
        const creditRows = await db.select().from(liverCredits)
          .where(and(eq(liverCredits.liverId, request.liverId), eq(liverCredits.month, request.month)));

        if (creditRows.length > 0) {
          await db.update(liverCredits)
            .set({
              usedCredit: sql`${liverCredits.usedCredit} + ${creditUsed}`,
              remainingCredit: sql`${liverCredits.remainingCredit} - ${creditUsed}`,
            } as any)
            .where(eq(liverCredits.id, creditRows[0].id));
        }
      }

      await db.update(sampleRequests)
        .set({
          status: "approved",
          adminComment: input.comment || null,
          reviewedBy: String((ctx as any).user?.id || ""),
          reviewedAt: new Date(),
        })
        .where(eq(sampleRequests.id, input.id));

      return { success: true };
    }),

  // 請求却下
  reject: protectedProcedure
    .input(z.object({
      id: z.number(),
      comment: z.string().min(1, "却下理由を入力してください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      await db.update(sampleRequests)
        .set({
          status: "rejected",
          adminComment: input.comment,
          reviewedBy: String((ctx as any).user?.id || ""),
          reviewedAt: new Date(),
        })
        .where(eq(sampleRequests.id, input.id));

      return { success: true };
    }),

  // 発送済みにする
  markShipped: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      await db.update(sampleRequests)
        .set({ status: "shipped", shippedAt: new Date() })
        .where(eq(sampleRequests.id, input.id));

      return { success: true };
    }),

  // ========== クレジット管理API（運営用） ==========

  // ライバー一覧＋当月クレジット
  listCredits: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();

      const allLivers = await db.select().from(livers)
        .where(eq(livers.isActive, true))
        .orderBy(livers.name);

      const credits = await db.select().from(liverCredits)
        .where(eq(liverCredits.month, input.month));

      const creditMap = new Map(credits.map(c => [c.liverId, c]));

      return allLivers.map(liver => {
        const c = creditMap.get(liver.id);
        return {
          liverId: liver.id,
          liverName: liver.name,
          credit: c ? {
            ...c,
            streamingHours: Number(c.streamingHours),
            monthlySales: Number(c.monthlySales),
            streamingCredit: Number(c.streamingCredit),
            salesCredit: Number(c.salesCredit),
            rankBonus: Number(c.rankBonus),
            carryoverCredit: Number(c.carryoverCredit),
            totalCredit: Number(c.totalCredit),
            usedCredit: Number(c.usedCredit),
            remainingCredit: Number(c.remainingCredit),
          } : null,
        };
      });
    }),

  // クレジット設定（運営が配信時間・売上を入力 → 自動計算）
  setCredit: protectedProcedure
    .input(z.object({
      liverId: z.number(),
      month: z.string(),
      streamingHours: z.number().min(0),
      monthlySales: z.number().min(0),
      isFirstMonth: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();

      const rank = calculateRank(input.streamingHours, input.monthlySales);
      const rankBonus = getRankBonus(rank);
      const streamingCredit = Math.round(input.streamingHours * 500);
      const salesCredit = Math.round(input.monthlySales * 0.03);
      const baseCredit = streamingCredit + salesCredit + rankBonus;

      // 既存のクレジットレコードを確認
      const existing = await db.select().from(liverCredits)
        .where(and(eq(liverCredits.liverId, input.liverId), eq(liverCredits.month, input.month)));

      if (existing.length > 0) {
        const usedCredit = Number(existing[0].usedCredit);
        const carryover = Number(existing[0].carryoverCredit);
        const totalCredit = baseCredit + carryover;
        await db.update(liverCredits)
          .set({
            rank,
            streamingHours: String(input.streamingHours),
            monthlySales: String(input.monthlySales),
            streamingCredit: String(streamingCredit),
            salesCredit: String(salesCredit),
            rankBonus: String(rankBonus),
            totalCredit: String(totalCredit),
            remainingCredit: String(totalCredit - usedCredit),
            isFirstMonth: input.isFirstMonth ?? existing[0].isFirstMonth,
          })
          .where(eq(liverCredits.id, existing[0].id));
      } else {
        // 前月の繰り越しクレジットを取得
        const prevDate = new Date(input.month + "-01");
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
        const prevCredits = await db.select().from(liverCredits)
          .where(and(eq(liverCredits.liverId, input.liverId), eq(liverCredits.month, prevMonth)));
        const carryOver = prevCredits.length > 0 ? Math.max(0, Number(prevCredits[0].remainingCredit)) : 0;
        const totalCredit = baseCredit + carryOver;

        await db.insert(liverCredits).values({
          liverId: input.liverId,
          month: input.month,
          rank,
          streamingHours: String(input.streamingHours),
          monthlySales: String(input.monthlySales),
          streamingCredit: String(streamingCredit),
          salesCredit: String(salesCredit),
          rankBonus: String(rankBonus),
          carryoverCredit: String(carryOver),
          totalCredit: String(totalCredit),
          usedCredit: "0",
          remainingCredit: String(totalCredit),
          isFirstMonth: input.isFirstMonth ?? false,
        });
      }

      return { success: true, rank, totalCredit: baseCredit };
    }),

  // ライバーのクレジット履歴取得（運営用 - ライバー詳細ページ向け）
  getLiverCreditHistory: protectedProcedure
    .input(z.object({ liverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const credits = await db.select().from(liverCredits)
        .where(eq(liverCredits.liverId, input.liverId))
        .orderBy(desc(liverCredits.month));

      return credits.map(c => ({
        ...c,
        streamingHours: Number(c.streamingHours),
        monthlySales: Number(c.monthlySales),
        streamingCredit: Number(c.streamingCredit),
        salesCredit: Number(c.salesCredit),
        rankBonus: Number(c.rankBonus),
        carryoverCredit: Number(c.carryoverCredit),
        totalCredit: Number(c.totalCredit),
        usedCredit: Number(c.usedCredit),
        remainingCredit: Number(c.remainingCredit),
      }));
    }),

  // ライバーのサンプル請求履歴取得（運営用 - ライバー詳細ページ向け）
  getLiverRequests: protectedProcedure
    .input(z.object({ liverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const requests = await db.select().from(sampleRequests)
        .where(eq(sampleRequests.liverId, input.liverId))
        .orderBy(desc(sampleRequests.createdAt));

      const result = [];
      for (const req of requests) {
        const items = await db.select().from(sampleRequestItems)
          .where(eq(sampleRequestItems.requestId, req.id));
        result.push({
          ...req,
          totalAmount: Number(req.totalAmount),
          creditUsed: Number(req.creditUsed),
          outOfPocketAmount: Number(req.outOfPocketAmount),
          items: items.map(i => ({
            ...i,
            price: Number(i.price),
            subtotal: Number(i.subtotal),
          })),
        });
      }

      return result;
    }),
});
