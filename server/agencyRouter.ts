import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import { agencies, livers, schedules, brandLivestreams } from "../drizzle/schema";
import type { Agency, InsertAgency } from "../drizzle/schema";

// ========== DB Helper Functions ==========

async function getDb() {
  const { getDb: getDbFn } = await import("./db");
  return getDbFn();
}

// Agency CRUD
async function getAgencyByLoginId(loginId: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(agencies).where(eq(agencies.loginId, loginId)).limit(1);
  return results[0] || null;
}

async function getAgencyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);
  return results[0] || null;
}

async function getAllAgencies() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(agencies).orderBy(desc(agencies.createdAt));
}

async function createAgency(data: InsertAgency) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agencies).values(data);
  return Number(result[0].insertId);
}

async function updateAgency(id: number, data: Partial<InsertAgency>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agencies).set(data).where(eq(agencies.id, id));
}

async function getLiversByAgencyId(agencyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(livers).where(
    and(eq(livers.agencyId, agencyId), eq(livers.isActive, true))
  ).orderBy(asc(livers.name));
}

async function getAgencyLiverIds(agencyId: number): Promise<number[]> {
  const agencyLivers = await getLiversByAgencyId(agencyId);
  return agencyLivers.map(l => l.id);
}

// ========== Auth Helpers ==========

function getAgencyToken(ctx: { req: { headers: { authorization?: string }; cookies?: { agency_session?: string } } }): string | null {
  const authHeader = ctx.req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return ctx.req.cookies?.agency_session || null;
}

async function verifyAgencyToken(token: string): Promise<{ agencyId: number; type: string } | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    if (!payload || payload.type !== "agency") return null;
    return { agencyId: payload.agencyId as number, type: payload.type as string };
  } catch {
    return null;
  }
}

// ========== Router ==========

export const agencyRouter = router({
  // ===== 事務所認証 =====
  
  login: publicProcedure
    .input(z.object({
      loginId: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const agency = await getAgencyByLoginId(input.loginId);
      if (!agency) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ログインIDまたはパスワードが間違っています",
        });
      }
      const isValid = await bcrypt.compare(input.password, agency.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ログインIDまたはパスワードが間違っています",
        });
      }
      if (!agency.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "このアカウントは無効化されています",
        });
      }
      // Generate JWT token
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT({ agencyId: agency.id, type: "agency" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("3650d")
        .sign(secret);

      return {
        success: true,
        token,
        agency: {
          id: agency.id,
          name: agency.name,
          loginId: agency.loginId,
          logoUrl: agency.logoUrl,
          contactEmail: agency.contactEmail,
        },
      };
    }),

  // ===== 事務所自身の情報 =====

  me: publicProcedure.query(async ({ ctx }) => {
    const token = getAgencyToken(ctx);
    if (!token) return null;
    const payload = await verifyAgencyToken(token);
    if (!payload) return null;
    const agency = await getAgencyById(payload.agencyId);
    if (!agency || !agency.isActive) return null;
    return {
      id: agency.id,
      name: agency.name,
      loginId: agency.loginId,
      logoUrl: agency.logoUrl,
      contactEmail: agency.contactEmail,
      contactPhone: agency.contactPhone,
      description: agency.description,
    };
  }),

  updateProfile: publicProcedure
    .input(z.object({
      name: z.string().min(1).optional(),
      logoUrl: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = getAgencyToken(ctx);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAgencyToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      await updateAgency(payload.agencyId, input);
      return { success: true };
    }),

  // ===== 所属ライバー管理 =====

  getMyLivers: publicProcedure.query(async ({ ctx }) => {
    const token = getAgencyToken(ctx);
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
    const payload = await verifyAgencyToken(token);
    if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

    const agencyLivers = await getLiversByAgencyId(payload.agencyId);
    return agencyLivers.map(l => ({
      id: l.id,
      name: l.name,
      email: l.email,
      avatarUrl: l.avatarUrl,
      color: l.color,
      tiktokAccount: l.tiktokAccount,
      instagramAccount: l.instagramAccount,
      isActive: l.isActive,
      lastLoginAt: l.lastLoginAt,
      createdAt: l.createdAt,
    }));
  }),

  // ===== 事務所からライバー新規登録 =====

  registerLiver: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      color: z.string().optional(),
      tiktokAccount: z.string().optional(),
      instagramAccount: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = getAgencyToken(ctx);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAgencyToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Check if email already exists
      const { checkLiverEmailExists, createLiver, getLiverById } = await import("./db");
      const exists = await checkLiverEmailExists(input.email);
      if (exists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create liver with agencyId
      const liverId = await createLiver({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        color: input.color || "#FF69B4",
        tiktokAccount: input.tiktokAccount || null,
        instagramAccount: input.instagramAccount || null,
        agencyId: payload.agencyId,
      });

      const liver = await getLiverById(liverId);
      if (!liver) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ライバーの作成に失敗しました",
        });
      }

      return {
        success: true,
        liver: {
          id: liver.id,
          name: liver.name,
          email: liver.email,
          color: liver.color,
        },
      };
    }),

  // ===== ダッシュボード =====

  dashboard: publicProcedure.query(async ({ ctx }) => {
    const token = getAgencyToken(ctx);
    if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
    const payload = await verifyAgencyToken(token);
    if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const liverIds = await getAgencyLiverIds(payload.agencyId);
    
    // 所属ライバー数
    const liverCount = liverIds.length;

    // 今月の配信数・売上
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let monthlyStats = { livestreamCount: 0, totalSales: 0 };
    if (liverIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const livestreams = await db.select({
        count: sql<number>`COUNT(*)`,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      }).from(brandLivestreams).where(
        and(
          inArray(brandLivestreams.liverId, liverIds),
          sql`${brandLivestreams.livestreamDate} >= ${startOfMonth}`
        )
      );
      if (livestreams[0]) {
        monthlyStats.livestreamCount = Number(livestreams[0].count);
        monthlyStats.totalSales = Number(livestreams[0].totalSales);
      }
    }

    // 今日のスケジュール
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let todaySchedules: any[] = [];
    if (liverIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      todaySchedules = await db.select().from(schedules).where(
        and(
          inArray(schedules.liverId, liverIds),
          sql`${schedules.startTime} >= ${todayStart}`,
          sql`${schedules.startTime} <= ${todayEnd}`
        )
      ).orderBy(asc(schedules.startTime));
    }

    return {
      liverCount,
      monthlyLivestreamCount: monthlyStats.livestreamCount,
      monthlyTotalSales: monthlyStats.totalSales,
      todaySchedules: todaySchedules.map(s => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        category: s.category,
        liverName: s.liverName,
      })),
    };
  }),

  // ===== 配信履歴 =====

  getLivestreamHistory: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const token = getAgencyToken(ctx);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAgencyToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const liverIds = await getAgencyLiverIds(payload.agencyId);
      if (liverIds.length === 0) return { items: [], total: 0 };

      const { inArray } = await import("drizzle-orm");
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [items, countResult] = await Promise.all([
        db.select().from(brandLivestreams)
          .where(inArray(brandLivestreams.liverId, liverIds))
          .orderBy(desc(brandLivestreams.livestreamDate))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(brandLivestreams)
          .where(inArray(brandLivestreams.liverId, liverIds)),
      ]);

      return {
        items: items.map(ls => ({
          id: ls.id,
          livestreamDate: ls.livestreamDate,
          streamerName: ls.streamerName,
          salesAmount: ls.salesAmount,
          duration: ls.duration,
          viewerCount: ls.viewerCount,
          orderCount: ls.orderCount,
          platform: ls.platform,
          result: ls.result,
        })),
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  // ===== スケジュール一覧 =====

  getSchedules: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const token = getAgencyToken(ctx);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAgencyToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const liverIds = await getAgencyLiverIds(payload.agencyId);
      if (liverIds.length === 0) return [];

      const { inArray } = await import("drizzle-orm");
      
      const conditions = [inArray(schedules.liverId, liverIds)];
      if (input?.startDate) {
        conditions.push(sql`${schedules.startTime} >= ${new Date(input.startDate)}`);
      }
      if (input?.endDate) {
        conditions.push(sql`${schedules.startTime} <= ${new Date(input.endDate)}`);
      }

      const results = await db.select().from(schedules)
        .where(and(...conditions))
        .orderBy(asc(schedules.startTime));

      return results.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        startTime: s.startTime,
        endTime: s.endTime,
        category: s.category,
        liverId: s.liverId,
        liverName: s.liverName,
        status: s.status,
      }));
    }),

  // ===== 管理者向け: 事務所CRUD =====

  list: protectedProcedure.query(async () => {
    const allAgencies = await getAllAgencies();
    // 各事務所の所属ライバー数を取得
    const result = await Promise.all(allAgencies.map(async (a) => {
      const agencyLivers = await getLiversByAgencyId(a.id);
      return {
        id: a.id,
        name: a.name,
        loginId: a.loginId,
        logoUrl: a.logoUrl,
        contactEmail: a.contactEmail,
        contactPhone: a.contactPhone,
        description: a.description,
        isActive: a.isActive,
        liverCount: agencyLivers.length,
        createdAt: a.createdAt,
      };
    }));
    return result;
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      loginId: z.string().min(1),
      password: z.string().min(1),
      logoUrl: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check if loginId already exists
      const existing = await getAgencyByLoginId(input.loginId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このログインIDは既に使用されています",
        });
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const id = await createAgency({
        name: input.name,
        loginId: input.loginId,
        password: hashedPassword,
        logoUrl: input.logoUrl,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        description: input.description,
      });
      return { success: true, id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      loginId: z.string().min(1).optional(),
      password: z.string().optional(),
      logoUrl: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, password, ...data } = input;
      const updateData: any = { ...data };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      await updateAgency(id, updateData);
      return { success: true };
    }),

  // 管理者: ライバーを事務所に割り当て
  assignLiver: protectedProcedure
    .input(z.object({
      liverId: z.number(),
      agencyId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(livers)
        .set({ agencyId: input.agencyId })
        .where(eq(livers.id, input.liverId));
      return { success: true };
    }),

  // 管理者: 事務所ごとのライバー一覧
  getLiversByAgency: protectedProcedure
    .input(z.object({ agencyId: z.number() }))
    .query(async ({ input }) => {
      const agencyLivers = await getLiversByAgencyId(input.agencyId);
      return agencyLivers.map(l => ({
        id: l.id,
        name: l.name,
        email: l.email,
        avatarUrl: l.avatarUrl,
        color: l.color,
        isActive: l.isActive,
      }));
    }),

  // 管理者: 未所属ライバー一覧
  getUnassignedLivers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.select().from(livers).where(
      and(eq(livers.isActive, true), isNull(livers.agencyId))
    ).orderBy(asc(livers.name));
    return result.map(l => ({
      id: l.id,
      name: l.name,
      email: l.email,
      avatarUrl: l.avatarUrl,
    }));
  }),
});
