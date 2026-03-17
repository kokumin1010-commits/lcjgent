import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { setApplications, setApplicationItems, productMaster, mallProducts, livers } from "../drizzle/schema";
import { eq, desc, and, inArray, sql, like } from "drizzle-orm";
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

// Helper: get liver token from request
function getLiverToken(ctx: { req: { headers: { authorization?: string }; cookies?: { liver_session?: string } } }): string | null {
  const authHeader = ctx.req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return ctx.req.cookies?.liver_session || null;
}

// Helper: authenticate liver from context
async function authenticateLiver(ctx: any): Promise<{ liverId: number }> {
  const token = getLiverToken(ctx);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
  const payload = await verifyLiverToken(token);
  if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "セッションが無効です" });
  return { liverId: payload.liverId };
}

export const setApplicationRouter = router({
  // ============================================================
  // ライバー向けAPI
  // ============================================================

  // 商品検索（mall_productsテーブルから検索。ライバーがセットに含める商品を選択するため）
  searchProducts: publicProcedure
    .input(z.object({
      keyword: z.string().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: any[] = [
        inArray(mallProducts.status, ["active", "sold_out"]),
      ];
      
      if (input.keyword && input.keyword.trim()) {
        conditions.push(
          like(sql`LOWER(${mallProducts.name})`, `%${input.keyword.toLowerCase()}%`)
        );
      }
      if (input.brandId) {
        conditions.push(eq(mallProducts.brandId, input.brandId));
      }
      
      const products = await db
        .select({
          id: mallProducts.id,
          name: mallProducts.name,
          brandId: mallProducts.brandId,
          category: mallProducts.category,
          regularPrice: mallProducts.price,
          imageUrl: mallProducts.imageUrl,
        })
        .from(mallProducts)
        .where(and(...conditions))
        .orderBy(mallProducts.name)
        .limit(input.limit);
      
      return products;
    }),

  // セット申請を作成（ライバー認証必須）
  create: publicProcedure
    .input(z.object({
      setName: z.string().min(1, "セット名を入力してください"),
      setPrice: z.number().min(0, "セット価格は0以上で入力してください"),
      scheduledDate: z.string().optional(), // ISO date string
      memo: z.string().optional(),
      items: z.array(z.object({
        productMasterId: z.number().optional(),
        productName: z.string().min(1),
        originalPrice: z.number().min(0),
        quantity: z.number().min(1).default(1),
      })).min(1, "商品を1つ以上追加してください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const { liverId } = await authenticateLiver(ctx);
      const db = await getDb();
      
      // Get liver info
      const [liver] = await db.select({ name: livers.name }).from(livers).where(eq(livers.id, liverId));
      if (!liver) throw new TRPCError({ code: "NOT_FOUND", message: "ライバー情報が見つかりません" });
      
      // Calculate totals
      const totalOriginalPrice = input.items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
      const discountRate = totalOriginalPrice > 0
        ? Math.round(((totalOriginalPrice - input.setPrice) / totalOriginalPrice) * 100)
        : 0;
      
      // Create application
      const [result] = await db.insert(setApplications).values({
        liverId,
        liverName: liver.name,
        setName: input.setName,
        setPrice: input.setPrice,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
        totalOriginalPrice,
        discountRate,
        memo: input.memo || null,
        status: "pending",
      });
      
      const applicationId = (result as any).insertId;
      
      // Create items
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        await db.insert(setApplicationItems).values({
          applicationId,
          productMasterId: item.productMasterId || null,
          productName: item.productName,
          originalPrice: item.originalPrice,
          quantity: item.quantity,
          sortOrder: i,
        });
      }
      
      return { success: true, applicationId };
    }),

  // 自分の申請一覧を取得（ライバー認証必須）
  myList: publicProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "revision_requested", "all"]).default("all"),
    }))
    .query(async ({ input, ctx }) => {
      const { liverId } = await authenticateLiver(ctx);
      const db = await getDb();
      
      const conditions: any[] = [eq(setApplications.liverId, liverId)];
      if (input.status !== "all") {
        conditions.push(eq(setApplications.status, input.status));
      }
      
      const applications = await db
        .select()
        .from(setApplications)
        .where(and(...conditions))
        .orderBy(desc(setApplications.createdAt));
      
      // Get items for each application
      const result = [];
      for (const app of applications) {
        const items = await db
          .select()
          .from(setApplicationItems)
          .where(eq(setApplicationItems.applicationId, app.id))
          .orderBy(setApplicationItems.sortOrder);
        result.push({ ...app, items });
      }
      
      return result;
    }),

  // 申請を更新（ライバー認証必須、pending/revision_requestedのみ）
  update: publicProcedure
    .input(z.object({
      applicationId: z.number(),
      setName: z.string().min(1),
      setPrice: z.number().min(0),
      scheduledDate: z.string().optional(),
      memo: z.string().optional(),
      items: z.array(z.object({
        productMasterId: z.number().optional(),
        productName: z.string().min(1),
        originalPrice: z.number().min(0),
        quantity: z.number().min(1).default(1),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { liverId } = await authenticateLiver(ctx);
      const db = await getDb();
      
      // Check ownership and status
      const [app] = await db.select().from(setApplications).where(
        and(eq(setApplications.id, input.applicationId), eq(setApplications.liverId, liverId))
      );
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
      if (app.status !== "pending" && app.status !== "revision_requested") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この申請は編集できません" });
      }
      
      const totalOriginalPrice = input.items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
      const discountRate = totalOriginalPrice > 0
        ? Math.round(((totalOriginalPrice - input.setPrice) / totalOriginalPrice) * 100)
        : 0;
      
      // Update application
      await db.update(setApplications).set({
        setName: input.setName,
        setPrice: input.setPrice,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
        totalOriginalPrice,
        discountRate,
        memo: input.memo || null,
        status: "pending", // Re-submit after revision
      }).where(eq(setApplications.id, input.applicationId));
      
      // Delete old items and create new ones
      await db.delete(setApplicationItems).where(eq(setApplicationItems.applicationId, input.applicationId));
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        await db.insert(setApplicationItems).values({
          applicationId: input.applicationId,
          productMasterId: item.productMasterId || null,
          productName: item.productName,
          originalPrice: item.originalPrice,
          quantity: item.quantity,
          sortOrder: i,
        });
      }
      
      return { success: true };
    }),

  // 申請を削除（ライバー認証必須、pending/revision_requestedのみ）
  delete: publicProcedure
    .input(z.object({ applicationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { liverId } = await authenticateLiver(ctx);
      const db = await getDb();
      
      const [app] = await db.select().from(setApplications).where(
        and(eq(setApplications.id, input.applicationId), eq(setApplications.liverId, liverId))
      );
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
      if (app.status !== "pending" && app.status !== "revision_requested") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "この申請は削除できません" });
      }
      
      await db.delete(setApplicationItems).where(eq(setApplicationItems.applicationId, input.applicationId));
      await db.delete(setApplications).where(eq(setApplications.id, input.applicationId));
      
      return { success: true };
    }),

  // ============================================================
  // 運営向けAPI（管理者認証必須）
  // ============================================================

  // 全申請一覧を取得
  adminList: protectedProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "revision_requested", "all"]).default("all"),
      liverId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      
      const conditions: any[] = [];
      if (input.status !== "all") {
        conditions.push(eq(setApplications.status, input.status));
      }
      if (input.liverId) {
        conditions.push(eq(setApplications.liverId, input.liverId));
      }
      
      const applications = await db
        .select()
        .from(setApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(setApplications.createdAt));
      
      // Get items for each application
      const result = [];
      for (const app of applications) {
        const items = await db
          .select()
          .from(setApplicationItems)
          .where(eq(setApplicationItems.applicationId, app.id))
          .orderBy(setApplicationItems.sortOrder);
        result.push({ ...app, items });
      }
      
      return result;
    }),

  // 申請を承認
  approve: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      adminComment: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      
      const [app] = await db.select().from(setApplications).where(eq(setApplications.id, input.applicationId));
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
      if (app.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });
      
      await db.update(setApplications).set({
        status: "approved",
        adminComment: input.adminComment || null,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      }).where(eq(setApplications.id, input.applicationId));
      
      return { success: true };
    }),

  // 申請を却下
  reject: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      adminComment: z.string().min(1, "却下理由を入力してください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      
      const [app] = await db.select().from(setApplications).where(eq(setApplications.id, input.applicationId));
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
      
      await db.update(setApplications).set({
        status: "rejected",
        adminComment: input.adminComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      }).where(eq(setApplications.id, input.applicationId));
      
      return { success: true };
    }),

  // 修正依頼
  requestRevision: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      adminComment: z.string().min(1, "修正内容を入力してください"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      
      const [app] = await db.select().from(setApplications).where(eq(setApplications.id, input.applicationId));
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
      
      await db.update(setApplications).set({
        status: "revision_requested",
        adminComment: input.adminComment,
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      }).where(eq(setApplications.id, input.applicationId));
      
      return { success: true };
    }),

  // 一括承認
  bulkApprove: protectedProcedure
    .input(z.object({
      applicationIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      
      await db.update(setApplications).set({
        status: "approved",
        reviewedBy: ctx.user.id,
        reviewedAt: new Date(),
      }).where(
        and(
          inArray(setApplications.id, input.applicationIds),
          eq(setApplications.status, "pending")
        )
      );
      
      return { success: true, count: input.applicationIds.length };
    }),

  // 統計情報
  stats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      
      const [stats] = await db.select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
        approved: sql<number>`SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)`,
        rejected: sql<number>`SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END)`,
        revisionRequested: sql<number>`SUM(CASE WHEN status = 'revision_requested' THEN 1 ELSE 0 END)`,
      }).from(setApplications);
      
      return stats;
    }),
});
