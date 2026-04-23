/**
 * 短動画マトリックス管理ルーター (Short Video Matrix Router)
 * 独立ファイル: server/svmRouter.ts
 * 
 * 機能:
 * - TikTokアカウント管理（CRUD）
 * - 動画投稿記録管理（CRUD）
 * - 投稿スケジュール管理（CRUD）
 * - コンテンツ企画管理（CRUD）
 * - ダッシュボード統計
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { svmAccounts, svmVideoPosts, svmSchedules, svmContentPlans } from "../drizzle/schema";
import { eq, desc, and, sql, asc, like, or, gte, lte, inArray, count } from "drizzle-orm";

export const svmRouter = router({
  // ============================================================
  // アカウント管理 CRUD
  // ============================================================

  // アカウント一覧取得（フィルター付き）
  listAccounts: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "paused", "archived", "all"]).optional().default("all"),
      platform: z.string().optional(),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const filters: any[] = [];
      if (input?.status && input.status !== "all") {
        filters.push(eq(svmAccounts.status, input.status as any));
      }
      if (input?.platform) {
        filters.push(eq(svmAccounts.platform, input.platform));
      }
      if (input?.category) {
        filters.push(eq(svmAccounts.category, input.category));
      }
      if (input?.assignedTo) {
        filters.push(eq(svmAccounts.assignedTo, input.assignedTo));
      }
      if (input?.search) {
        filters.push(
          or(
            like(svmAccounts.accountName, `%${input.search}%`),
            like(svmAccounts.displayName, `%${input.search}%`),
            like(svmAccounts.description, `%${input.search}%`)
          )
        );
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      const accounts = await db.select().from(svmAccounts).where(where).orderBy(asc(svmAccounts.accountName));
      return accounts;
    }),

  // アカウント詳細取得
  getAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [account] = await db.select().from(svmAccounts).where(eq(svmAccounts.id, input.id));
      return account || null;
    }),

  // アカウント作成
  createAccount: protectedProcedure
    .input(z.object({
      accountName: z.string().min(1),
      displayName: z.string().optional(),
      platform: z.string().optional().default("tiktok"),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
      followerCount: z.number().optional().default(0),
      profileUrl: z.string().optional(),
      avatarUrl: z.string().optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
      status: z.enum(["active", "paused", "archived"]).optional().default("active"),
      targetPostsPerDay: z.number().optional().default(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(svmAccounts).values({
        accountName: input.accountName,
        displayName: input.displayName,
        platform: input.platform,
        category: input.category,
        assignedTo: input.assignedTo,
        followerCount: input.followerCount,
        profileUrl: input.profileUrl,
        avatarUrl: input.avatarUrl,
        description: input.description,
        tags: input.tags,
        status: input.status,
        targetPostsPerDay: input.targetPostsPerDay,
      });
      return { success: true, id: result[0].insertId };
    }),

  // アカウント更新
  updateAccount: protectedProcedure
    .input(z.object({
      id: z.number(),
      accountName: z.string().optional(),
      displayName: z.string().optional(),
      platform: z.string().optional(),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
      followerCount: z.number().optional(),
      profileUrl: z.string().optional(),
      avatarUrl: z.string().optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
      targetPostsPerDay: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) updateData[key] = value;
      });
      await db.update(svmAccounts).set(updateData).where(eq(svmAccounts.id, id));
      return { success: true };
    }),

  // アカウント削除
  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      // 関連する投稿・スケジュールも削除
      await db.delete(svmVideoPosts).where(eq(svmVideoPosts.accountId, input.id));
      await db.delete(svmSchedules).where(eq(svmSchedules.accountId, input.id));
      await db.delete(svmAccounts).where(eq(svmAccounts.id, input.id));
      return { success: true };
    }),

  // カテゴリ一覧取得
  getCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    const result = await db.selectDistinct({ category: svmAccounts.category }).from(svmAccounts).where(sql`${svmAccounts.category} IS NOT NULL AND ${svmAccounts.category} != ''`);
    return result.map(r => r.category).filter(Boolean) as string[];
  }),

  // 担当者一覧取得
  getAssignees: protectedProcedure.query(async () => {
    const db = await getDb();
    const result = await db.selectDistinct({ assignedTo: svmAccounts.assignedTo }).from(svmAccounts).where(sql`${svmAccounts.assignedTo} IS NOT NULL AND ${svmAccounts.assignedTo} != ''`);
    return result.map(r => r.assignedTo).filter(Boolean) as string[];
  }),

  // ============================================================
  // 動画投稿記録 CRUD
  // ============================================================

  // 投稿一覧取得（フィルター付き）
  listPosts: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      status: z.enum(["draft", "scheduled", "posted", "failed", "all"]).optional().default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().optional().default(100),
      offset: z.number().optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const filters: any[] = [];
      if (input?.accountId) {
        filters.push(eq(svmVideoPosts.accountId, input.accountId));
      }
      if (input?.status && input.status !== "all") {
        filters.push(eq(svmVideoPosts.status, input.status as any));
      }
      if (input?.dateFrom) {
        filters.push(gte(svmVideoPosts.postDate, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        filters.push(lte(svmVideoPosts.postDate, new Date(input.dateTo)));
      }
      if (input?.search) {
        filters.push(
          or(
            like(svmVideoPosts.title, `%${input.search}%`),
            like(svmVideoPosts.description, `%${input.search}%`),
            like(svmVideoPosts.productName, `%${input.search}%`)
          )
        );
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      const posts = await db.select().from(svmVideoPosts).where(where).orderBy(desc(svmVideoPosts.postDate)).limit(input?.limit || 100).offset(input?.offset || 0);
      
      // 合計件数も取得
      const [countResult] = await db.select({ total: count() }).from(svmVideoPosts).where(where);
      
      return { items: posts, total: countResult?.total || 0 };
    }),

  // 投稿作成
  createPost: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      postDate: z.string(),
      duration: z.number().optional(),
      hashtags: z.string().optional(),
      views: z.number().optional().default(0),
      likes: z.number().optional().default(0),
      comments: z.number().optional().default(0),
      shares: z.number().optional().default(0),
      saves: z.number().optional().default(0),
      contentType: z.string().optional(),
      productName: z.string().optional(),
      status: z.enum(["draft", "scheduled", "posted", "failed"]).optional().default("posted"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(svmVideoPosts).values({
        accountId: input.accountId,
        title: input.title,
        description: input.description,
        videoUrl: input.videoUrl,
        thumbnailUrl: input.thumbnailUrl,
        postDate: new Date(input.postDate),
        duration: input.duration,
        hashtags: input.hashtags,
        views: input.views,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        saves: input.saves,
        contentType: input.contentType,
        productName: input.productName,
        status: input.status,
        notes: input.notes,
      });
      // アカウントの最終投稿日を更新
      await db.update(svmAccounts).set({ lastPostDate: new Date(input.postDate) }).where(eq(svmAccounts.id, input.accountId));
      return { success: true, id: result[0].insertId };
    }),

  // 投稿更新
  updatePost: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      postDate: z.string().optional(),
      duration: z.number().optional(),
      hashtags: z.string().optional(),
      views: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      saves: z.number().optional(),
      contentType: z.string().optional(),
      productName: z.string().optional(),
      status: z.enum(["draft", "scheduled", "posted", "failed"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "postDate") {
            updateData[key] = new Date(value as string);
          } else {
            updateData[key] = value;
          }
        }
      });
      await db.update(svmVideoPosts).set(updateData).where(eq(svmVideoPosts.id, id));
      return { success: true };
    }),

  // 投稿削除
  deletePost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(svmVideoPosts).where(eq(svmVideoPosts.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // 投稿スケジュール CRUD
  // ============================================================

  listSchedules: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      status: z.enum(["planned", "in_progress", "ready", "posted", "cancelled", "all"]).optional().default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const filters: any[] = [];
      if (input?.accountId) {
        filters.push(eq(svmSchedules.accountId, input.accountId));
      }
      if (input?.status && input.status !== "all") {
        filters.push(eq(svmSchedules.status, input.status as any));
      }
      if (input?.dateFrom) {
        filters.push(gte(svmSchedules.scheduledDate, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        filters.push(lte(svmSchedules.scheduledDate, new Date(input.dateTo)));
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      return await db.select().from(svmSchedules).where(where).orderBy(asc(svmSchedules.scheduledDate));
    }),

  createSchedule: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      scheduledDate: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      contentPlan: z.string().optional(),
      hashtags: z.string().optional(),
      assignedTo: z.string().optional(),
      status: z.enum(["planned", "in_progress", "ready", "posted", "cancelled"]).optional().default("planned"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(svmSchedules).values({
        accountId: input.accountId,
        scheduledDate: new Date(input.scheduledDate),
        title: input.title,
        description: input.description,
        contentPlan: input.contentPlan,
        hashtags: input.hashtags,
        assignedTo: input.assignedTo,
        status: input.status,
        priority: input.priority,
        notes: input.notes,
      });
      return { success: true, id: result[0].insertId };
    }),

  updateSchedule: protectedProcedure
    .input(z.object({
      id: z.number(),
      accountId: z.number().optional(),
      scheduledDate: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      contentPlan: z.string().optional(),
      hashtags: z.string().optional(),
      assignedTo: z.string().optional(),
      status: z.enum(["planned", "in_progress", "ready", "posted", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      videoPostId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "scheduledDate") {
            updateData[key] = new Date(value as string);
          } else {
            updateData[key] = value;
          }
        }
      });
      await db.update(svmSchedules).set(updateData).where(eq(svmSchedules.id, id));
      return { success: true };
    }),

  deleteSchedule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(svmSchedules).where(eq(svmSchedules.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // コンテンツ企画 CRUD
  // ============================================================

  listContentPlans: protectedProcedure
    .input(z.object({
      status: z.enum(["idea", "planning", "scripted", "filming", "editing", "ready", "used", "archived", "all"]).optional().default("all"),
      category: z.string().optional(),
      assignedTo: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const filters: any[] = [];
      if (input?.status && input.status !== "all") {
        filters.push(eq(svmContentPlans.status, input.status as any));
      }
      if (input?.category) {
        filters.push(eq(svmContentPlans.category, input.category));
      }
      if (input?.assignedTo) {
        filters.push(eq(svmContentPlans.assignedTo, input.assignedTo));
      }
      if (input?.search) {
        filters.push(
          or(
            like(svmContentPlans.title, `%${input.search}%`),
            like(svmContentPlans.description, `%${input.search}%`)
          )
        );
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      return await db.select().from(svmContentPlans).where(where).orderBy(desc(svmContentPlans.createdAt));
    }),

  createContentPlan: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      targetAccounts: z.string().optional(),
      scriptContent: z.string().optional(),
      referenceUrls: z.string().optional(),
      hashtags: z.string().optional(),
      status: z.enum(["idea", "planning", "scripted", "filming", "editing", "ready", "used", "archived"]).optional().default("idea"),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(svmContentPlans).values({
        title: input.title,
        description: input.description,
        category: input.category,
        targetAccounts: input.targetAccounts,
        scriptContent: input.scriptContent,
        referenceUrls: input.referenceUrls,
        hashtags: input.hashtags,
        status: input.status,
        assignedTo: input.assignedTo,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        notes: input.notes,
      });
      return { success: true, id: result[0].insertId };
    }),

  updateContentPlan: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      targetAccounts: z.string().optional(),
      scriptContent: z.string().optional(),
      referenceUrls: z.string().optional(),
      hashtags: z.string().optional(),
      status: z.enum(["idea", "planning", "scripted", "filming", "editing", "ready", "used", "archived"]).optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      const updateData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "dueDate") {
            updateData[key] = new Date(value as string);
          } else {
            updateData[key] = value;
          }
        }
      });
      await db.update(svmContentPlans).set(updateData).where(eq(svmContentPlans.id, id));
      return { success: true };
    }),

  deleteContentPlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(svmContentPlans).where(eq(svmContentPlans.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // ダッシュボード統計
  // ============================================================

  getDashboardStats: protectedProcedure.query(async () => {
    const db = await getDb();
    
    // アカウント統計
    const [accountStats] = await db.select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
      paused: sql<number>`SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END)`,
    }).from(svmAccounts);

    // 今日の投稿数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [todayPosts] = await db.select({ count: count() }).from(svmVideoPosts)
      .where(and(
        gte(svmVideoPosts.postDate, today),
        lte(svmVideoPosts.postDate, tomorrow)
      ));

    // 今週の投稿数
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const [weekPosts] = await db.select({ count: count() }).from(svmVideoPosts)
      .where(gte(svmVideoPosts.postDate, weekStart));

    // 今月の投稿数
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [monthPosts] = await db.select({ count: count() }).from(svmVideoPosts)
      .where(gte(svmVideoPosts.postDate, monthStart));

    // パフォーマンス合計（今月）
    const [monthPerf] = await db.select({
      totalViews: sql<number>`COALESCE(SUM(views), 0)`,
      totalLikes: sql<number>`COALESCE(SUM(likes), 0)`,
      totalComments: sql<number>`COALESCE(SUM(comments), 0)`,
      totalShares: sql<number>`COALESCE(SUM(shares), 0)`,
    }).from(svmVideoPosts).where(gte(svmVideoPosts.postDate, monthStart));

    // 未完了スケジュール数
    const [pendingSchedules] = await db.select({ count: count() }).from(svmSchedules)
      .where(and(
        sql`${svmSchedules.status} NOT IN ('posted', 'cancelled')`,
        lte(svmSchedules.scheduledDate, tomorrow)
      ));

    // コンテンツ企画統計
    const [planStats] = await db.select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN status NOT IN ('used', 'archived') THEN 1 ELSE 0 END)`,
    }).from(svmContentPlans);

    return {
      accounts: {
        total: accountStats?.total || 0,
        active: Number(accountStats?.active) || 0,
        paused: Number(accountStats?.paused) || 0,
      },
      posts: {
        today: todayPosts?.count || 0,
        thisWeek: weekPosts?.count || 0,
        thisMonth: monthPosts?.count || 0,
      },
      performance: {
        totalViews: Number(monthPerf?.totalViews) || 0,
        totalLikes: Number(monthPerf?.totalLikes) || 0,
        totalComments: Number(monthPerf?.totalComments) || 0,
        totalShares: Number(monthPerf?.totalShares) || 0,
      },
      pendingSchedules: pendingSchedules?.count || 0,
      contentPlans: {
        total: planStats?.total || 0,
        active: Number(planStats?.active) || 0,
      },
    };
  }),

  // アカウント別投稿統計
  getAccountPostStats: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const filters: any[] = [];
      if (input?.dateFrom) {
        filters.push(gte(svmVideoPosts.postDate, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        filters.push(lte(svmVideoPosts.postDate, new Date(input.dateTo)));
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      
      const stats = await db.select({
        accountId: svmVideoPosts.accountId,
        postCount: count(),
        totalViews: sql<number>`COALESCE(SUM(views), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(likes), 0)`,
        totalComments: sql<number>`COALESCE(SUM(comments), 0)`,
        totalShares: sql<number>`COALESCE(SUM(shares), 0)`,
        avgViews: sql<number>`COALESCE(AVG(views), 0)`,
      }).from(svmVideoPosts).where(where).groupBy(svmVideoPosts.accountId);

      return stats;
    }),

  // 日別投稿数（カレンダー用）
  getDailyPostCounts: protectedProcedure
    .input(z.object({
      month: z.string(), // "2026-04"
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const startDate = new Date(`${input.month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const result = await db.select({
        date: sql<string>`DATE(postDate)`,
        count: count(),
        accountId: svmVideoPosts.accountId,
      }).from(svmVideoPosts)
        .where(and(
          gte(svmVideoPosts.postDate, startDate),
          lte(svmVideoPosts.postDate, endDate)
        ))
        .groupBy(sql`DATE(postDate)`, svmVideoPosts.accountId);

      return result;
    }),
});
