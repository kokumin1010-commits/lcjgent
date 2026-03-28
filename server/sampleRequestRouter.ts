import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { sampleRequests, sampleRequestItems, liverCredits, mallProducts, livers, brandLivestreams } from "../drizzle/schema";
import { eq, desc, and, sql, like, or, gte, lte, isNull } from "drizzle-orm";
import { jwtVerify } from "jose";
import { ENV } from "./_core/env";

// Helper: verify liver token (JWT)
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

// Helper: get liver token from ctx (Authorization header or cookie)
function getLiverTokenFromCtx(ctx: any): string | null {
  // First try Authorization header (for localStorage-based auth)
  const authHeader = ctx.req?.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Fallback to liver_session cookie
  return ctx.req?.cookies?.liver_session || null;
}

// Helper: authenticate liver from ctx (supports both header and cookie)
async function authenticateLiver(ctx: any): Promise<{ liverId: number; type: string }> {
  const token = getLiverTokenFromCtx(ctx);
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー: トークンがありません" });
  }
  const liverData = await verifyLiverToken(token);
  if (!liverData) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー: 無効なトークンです" });
  }
  return liverData;
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

  // Helper: 指定月のbrandLivestreamsから実績を取得
  // month: "YYYY-MM" 形式
  // Returns: { monthlySales, streamingMinutes, streamingHours }
  // (This is a local helper, not an API endpoint)

  // クレジット残高取得（ライバー用） - ctx認証 + input.token フォールバック
  // ★ ランクは「先月の実績」で判定、クレジット計算は「今月の実績」で行う
  getMyCredit: publicProcedure
    .input(z.object({ token: z.string().optional(), forceRecalc: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      // Try ctx-based auth first, then fall back to input.token
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input?.token) {
        liverData = await verifyLiverToken(input.token);
      }
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      // JSTでの現在月を計算
      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const currentMonth = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, "0")}`;

      // 先月を計算（ランク判定用）
      const prevDate = new Date(nowJST);
      prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
      const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

      // Helper: 指定月のbrandLivestreamsから実績を取得
      async function getMonthStats(month: string) {
        const [yearNum, monthNum] = month.split("-").map(Number);
        const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        const monthEnd = new Date(Date.UTC(yearNum, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);

        const stats = await db.select({
          totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
          totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        }).from(brandLivestreams)
          .where(and(
            eq(brandLivestreams.liverId, liverData!.liverId),
            isNull(brandLivestreams.deletedAt),
            gte(brandLivestreams.livestreamDate, monthStart),
            lte(brandLivestreams.livestreamDate, monthEnd)
          ));

        const monthlySales = Number(stats[0]?.totalSales || 0);
        const streamingMinutes = Number(stats[0]?.totalDuration || 0);
        const streamingHours = Math.round((streamingMinutes / 60) * 10) / 10;
        return { monthlySales, streamingMinutes, streamingHours };
      }

      // 既存のliver_creditsレコードを確認
      const existingCredits = await db.select().from(liverCredits)
        .where(and(eq(liverCredits.liverId, liverData.liverId), eq(liverCredits.month, currentMonth)));

      // forceRecalcが指定されている場合、または既存レコードがない場合は再計算
      const shouldRecalc = existingCredits.length === 0 || input?.forceRecalc;

      if (shouldRecalc) {
        // 今月の実績を取得（クレジット計算用）
        const currentStats = await getMonthStats(currentMonth);
        // 先月の実績を取得（ランク判定用）
        const prevStats = await getMonthStats(prevMonth);

        // ★ ランクは先月の実績で判定
        const rank = calculateRank(prevStats.streamingHours, prevStats.monthlySales);
        const rankBonus = getRankBonus(rank);

        // ★ クレジットは今月の実績で計算
        const streamingCredit = Math.round(currentStats.streamingHours * 500);
        const salesCredit = Math.round(currentStats.monthlySales * 0.03);

        // 前月以前の繰り越しクレジットを確認
        const prevCreditRows = await db.select().from(liverCredits)
          .where(and(
            eq(liverCredits.liverId, liverData.liverId),
            sql`${liverCredits.month} < ${currentMonth}`
          ))
          .orderBy(desc(liverCredits.month))
          .limit(1);
        const carryover = prevCreditRows.length > 0 ? Math.max(0, Number(prevCreditRows[0].remainingCredit)) : 0;

        const totalCredit = streamingCredit + salesCredit + rankBonus + carryover;

        // 実績がある場合（今月 or 先月）のみ保存
        if (currentStats.monthlySales > 0 || currentStats.streamingMinutes > 0 || prevStats.monthlySales > 0 || prevStats.streamingMinutes > 0) {
          if (existingCredits.length > 0) {
            // 既存レコードを更新（usedCreditは維持）
            const usedCredit = Number(existingCredits[0].usedCredit);
            await db.update(liverCredits)
              .set({
                rank,
                streamingHours: String(currentStats.streamingHours),
                monthlySales: String(currentStats.monthlySales),
                streamingCredit: String(streamingCredit),
                salesCredit: String(salesCredit),
                rankBonus: String(rankBonus),
                carryoverCredit: String(carryover),
                totalCredit: String(totalCredit),
                remainingCredit: String(totalCredit - usedCredit),
              })
              .where(eq(liverCredits.id, existingCredits[0].id));

            return {
              month: currentMonth,
              rank,
              streamingHours: currentStats.streamingHours,
              monthlySales: currentStats.monthlySales,
              totalCredit,
              usedCredit,
              remainingCredit: totalCredit - usedCredit,
              carryoverCredit: carryover,
              isFirstMonth: existingCredits[0].isFirstMonth || false,
              rankBonus,
              streamingCredit,
              salesCredit,
              // ★ 先月の実績（ランク判定根拠）
              prevMonthStats: {
                month: prevMonth,
                streamingHours: prevStats.streamingHours,
                monthlySales: prevStats.monthlySales,
              },
            };
          } else {
            // 新規レコード作成
            await db.insert(liverCredits).values({
              liverId: liverData.liverId,
              month: currentMonth,
              rank,
              streamingHours: String(currentStats.streamingHours),
              monthlySales: String(currentStats.monthlySales),
              streamingCredit: String(streamingCredit),
              salesCredit: String(salesCredit),
              rankBonus: String(rankBonus),
              carryoverCredit: String(carryover),
              totalCredit: String(totalCredit),
              usedCredit: "0",
              remainingCredit: String(totalCredit),
              isFirstMonth: false,
            });

            return {
              month: currentMonth,
              rank,
              streamingHours: currentStats.streamingHours,
              monthlySales: currentStats.monthlySales,
              totalCredit,
              usedCredit: 0,
              remainingCredit: totalCredit,
              carryoverCredit: carryover,
              isFirstMonth: false,
              rankBonus,
              streamingCredit,
              salesCredit,
              prevMonthStats: {
                month: prevMonth,
                streamingHours: prevStats.streamingHours,
                monthlySales: prevStats.monthlySales,
              },
            };
          }
        }

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
          prevMonthStats: {
            month: prevMonth,
            streamingHours: prevStats.streamingHours,
            monthlySales: prevStats.monthlySales,
          },
        };
      }

      // 既存レコードがある場合はそのまま返す + 先月の実績も取得
      const prevStats = await getMonthStats(prevMonth);
      const c = existingCredits[0];
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
        prevMonthStats: {
          month: prevMonth,
          streamingHours: prevStats.streamingHours,
          monthlySales: prevStats.monthlySales,
        },
      };
    }),

  // 商品検索（mall_productsから） - ctx認証 + input.token フォールバック
  searchProducts: publicProcedure
    .input(z.object({
      token: z.string().optional(),
      query: z.string().min(1),
    }))
    .query(async ({ input, ctx }) => {
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input.token) {
        liverData = await verifyLiverToken(input.token);
      }
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

  // サンプル請求作成 - ctx認証 + input.token フォールバック
  create: publicProcedure
    .input(z.object({
      token: z.string().optional(),
      scheduledDate: z.string(),
      postalCode: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      recipientName: z.string().optional(),
      memo: z.string().optional(),
      items: z.array(z.object({
        mallProductId: z.number().nullable(),
        productName: z.string(),
        price: z.number(),
        quantity: z.number().min(1),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input.token) {
        liverData = await verifyLiverToken(input.token);
      }
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
          sql`UPDATE livers SET shipping_postal_code = ${input.postalCode || null}, shipping_address = ${input.address || null}, shipping_phone = ${input.phone || null}, shipping_recipient_name = ${input.recipientName || null} WHERE id = ${liverData.liverId}`
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
        recipientName: input.recipientName || null,
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

  // 自分の請求履歴取得 - ctx認証 + input.token フォールバック
  getMyRequests: publicProcedure
    .input(z.object({ token: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input?.token) {
        liverData = await verifyLiverToken(input.token);
      }
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

  // 保存済み配送先住所を取得 - ctx認証 + input.token フォールバック
  getSavedAddress: publicProcedure
    .input(z.object({ token: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input?.token) {
        liverData = await verifyLiverToken(input.token);
      }
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();
      
      // livers テーブルから配送先住所を取得
      const rows = await db.execute(
        sql`SELECT shipping_postal_code, shipping_address, shipping_phone, shipping_recipient_name FROM livers WHERE id = ${liverData.liverId}`
      );
      
      const liverRow = (rows as any)[0]?.[0];
      if (!liverRow) return null;

      return {
        postalCode: liverRow.shipping_postal_code || "",
        address: liverRow.shipping_address || "",
        phone: liverRow.shipping_phone || "",
        recipientName: liverRow.shipping_recipient_name || "",
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

      // ライバーごとのクレジット残高を一括取得
      const liverIds = [...new Set(requests.map(r => r.liverId))];
      const creditMap = new Map<number, { totalCredit: number; remainingCredit: number; rank: string }>();
      if (liverIds.length > 0) {
        // JSTでの現在月を計算
        const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const currentMonth = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, "0")}`;
        const allCredits = await db.select().from(liverCredits)
          .where(eq(liverCredits.month, currentMonth));
        for (const c of allCredits) {
          creditMap.set(c.liverId, {
            totalCredit: Number(c.totalCredit),
            remainingCredit: Number(c.remainingCredit),
            rank: c.rank,
          });
        }
      }

      const result = [];
      for (const req of requests) {
        const items = await db.select().from(sampleRequestItems)
          .where(eq(sampleRequestItems.requestId, req.id));
        const liverCredit = creditMap.get(req.liverId) || null;
        result.push({
          ...req,
          totalAmount: Number(req.totalAmount),
          creditUsed: Number(req.creditUsed),
          outOfPocketAmount: Number(req.outOfPocketAmount),
          cashAmount: Number(req.cashAmount),
          liverCredit,
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

  // ライバー自身のクレジット履歴取得（ライバー用）
  getMyCreditHistory: publicProcedure
    .input(z.object({ token: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      let liverData: { liverId: number; type: string } | null = null;
      const ctxToken = getLiverTokenFromCtx(ctx);
      if (ctxToken) {
        liverData = await verifyLiverToken(ctxToken);
      }
      if (!liverData && input?.token) {
        liverData = await verifyLiverToken(input.token);
      }
      if (!liverData) throw new TRPCError({ code: "UNAUTHORIZED", message: "認証エラー" });

      const db = await getDb();

      // liver_creditsから全履歴を取得
      const credits = await db.select().from(liverCredits)
        .where(eq(liverCredits.liverId, liverData.liverId))
        .orderBy(desc(liverCredits.month));

      // 履歴がない場合は過去6ヶ月分をbrandLivestreamsから自動生成
      if (credits.length === 0) {
        const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const history = [];
        for (let i = 1; i <= 6; i++) {
          const d = new Date(nowJST);
          d.setUTCMonth(d.getUTCMonth() - i);
          const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          const [yearNum, monthNum] = month.split("-").map(Number);
          const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
          const lastDay = new Date(yearNum, monthNum, 0).getDate();
          const monthEnd = new Date(Date.UTC(yearNum, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);

          const stats = await db.select({
            totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
            totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
          }).from(brandLivestreams)
            .where(and(
              eq(brandLivestreams.liverId, liverData.liverId),
              isNull(brandLivestreams.deletedAt),
              gte(brandLivestreams.livestreamDate, monthStart),
              lte(brandLivestreams.livestreamDate, monthEnd)
            ));

          const monthlySales = Number(stats[0]?.totalSales || 0);
          const streamingMinutes = Number(stats[0]?.totalDuration || 0);
          const streamingHours = Math.round((streamingMinutes / 60) * 10) / 10;

          if (monthlySales > 0 || streamingMinutes > 0) {
            // ランクはその月の実績で計算（履歴表示用）
            const rank = calculateRank(streamingHours, monthlySales);
            const rankBonus = getRankBonus(rank);
            const streamingCredit = Math.round(streamingHours * 500);
            const salesCredit = Math.round(monthlySales * 0.03);
            const totalCredit = streamingCredit + salesCredit + rankBonus;

            history.push({
              month,
              rank,
              streamingHours,
              monthlySales,
              streamingCredit,
              salesCredit,
              rankBonus,
              carryoverCredit: 0,
              totalCredit,
              usedCredit: 0,
              remainingCredit: totalCredit,
            });
          }
        }
        return history;
      }

      return credits.map(c => ({
        month: c.month,
        rank: c.rank,
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
