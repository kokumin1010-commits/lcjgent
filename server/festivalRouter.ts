/**
 * Live Commerce Festival 申込管理ルーター
 * - 公開: 企業/ライバー/一般の申込受付 + 自動アカウント作成
 * - 管理: 申込一覧・ステータス管理・CSVエクスポート
 */
import { router, publicProcedure, protectedProcedure, t } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  festivalCompanyApplications,
  festivalLiverApplications,
  festivalGeneralApplications,
  festivalEventSettings,
  festivalSponsors,
  festivalLineRegistrations,
  festivalAccounts,
  festivalActivityLogs,
} from "../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { createFestivalAccount, verifyFestivalToken } from "./festivalAuthRouter";

// Helper: log activity
async function logActivity(opts: {
  accountId: number;
  accountEmail: string;
  accountType: "company" | "liver" | "general" | "admin";
  action: string;
  details?: string;
  req?: any;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    const ipAddress = opts.req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || opts.req?.socket?.remoteAddress || null;
    const userAgent = opts.req?.headers?.['user-agent']?.substring(0, 500) || null;
    await db.insert(festivalActivityLogs).values({
      accountId: opts.accountId,
      accountEmail: opts.accountEmail,
      accountType: opts.accountType,
      action: opts.action,
      details: opts.details || null,
      ipAddress,
      userAgent,
    });
  } catch (e) {
    console.error('[LCF ActivityLog] Failed to log:', e);
  }
}

// Helper: parse cookie from request header (no cookie-parser middleware)
function getCookieFromReq(req: any, name: string): string | undefined {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c: string) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split('=').slice(1).join('=').trim();
}

// Festival admin procedure: allows both lcjmall staff AND LCF admin (lcf_token with role=admin)
const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check 1: lcjmall staff auth
  if ((ctx as any).user) {
    return next({ ctx });
  }
  // Check 2: LCF admin token (manual cookie parse - no cookie-parser middleware)
  const lcfToken = getCookieFromReq(ctx.req, 'lcf_token');
  if (lcfToken) {
    const payload = await verifyFestivalToken(lcfToken);
    if (payload && payload.role === "admin") {
      return next({ ctx: { ...ctx, lcfAdmin: payload } as any });
    }
  }
  throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
});

export const festivalRouter = router({
  // ===== 公開API: 申込受付 =====

  // 企業申込み
  submitCompany: publicProcedure
    .input(z.object({
      companyName: z.string().min(1, "貴社名は必須です"),
      contactName: z.string().min(1, "ご担当者様名は必須です"),
      contactDepartment: z.string().min(1, "担当者部署は必須です"),
      contactNameKana: z.string().min(1, "フリガナは必須です"),
      postalCode: z.string().min(1, "郵便番号は必須です"),
      address: z.string().min(1, "所在地は必須です"),
      phone: z.string().min(1, "電話番号は必須です"),
      email: z.string().email("有効なメールアドレスを入力してください"),
      websiteUrl: z.string().min(1, "ホームページURLは必須です"),
      lineOrLark: z.string().optional(),
      tiktokShopSellerName: z.string().min(1, "TikTok Shopセラーアカウント名は必須です"),
      brandIntro: z.string().min(1, "ブランド紹介文は必須です"),
      tiktokShopUrl: z.string().optional(),
      matchingProducts: z.string().optional(),
      targetAudience: z.string().min(1, "商品対象ターゲットは必須です"),
      salesLicense: z.string().min(1, "販売資格は必須です"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // 重複チェック: 同じメールアドレスで既に申込みがある場合はエラー
      const existing = await db.select({ id: festivalCompanyApplications.id })
        .from(festivalCompanyApplications)
        .where(and(
          eq(festivalCompanyApplications.email, input.email),
          eq(festivalCompanyApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "このメールアドレスは既に申込み済みです。重複申込みはできません。" });
      }

      let insertId = 0;
      try {
        const result = await db.insert(festivalCompanyApplications).values({
          companyName: input.companyName,
          contactName: input.contactName,
          contactDepartment: input.contactDepartment,
          contactNameKana: input.contactNameKana,
          postalCode: input.postalCode,
          address: input.address,
          phone: input.phone,
          email: input.email,
          websiteUrl: input.websiteUrl,
          lineOrLark: input.lineOrLark || null,
          tiktokShopSellerName: input.tiktokShopSellerName,
          brandIntro: input.brandIntro,
          tiktokShopUrl: input.tiktokShopUrl || null,
          matchingProducts: input.matchingProducts || null,
          targetAudience: input.targetAudience,
          salesLicense: input.salesLicense,
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
      } catch (err: any) {
        const sqlMsg = err.sqlMessage || err.cause?.message || err.cause?.sqlMessage || '';
        const errCode = err.code || err.cause?.code || err.errno || 'UNKNOWN';
        console.error("[Festival] submitCompany DB error:", JSON.stringify({msg: err.message, code: errCode, sqlMsg, sqlState: err.sqlState, errno: err.errno}));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DBエラー[${errCode}]: ${sqlMsg || err.message?.substring(0, 200) || 'Unknown'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "company",
          applicationId: insertId,
          displayName: input.companyName,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
        // アカウント作成に失敗しても申込みは成功とする
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'company', action: 'submit_application', details: JSON.stringify({ companyName: input.companyName }), req: ctx.req });
      }
      return {
        success: true,
        message: "企業申込みを受け付けました",
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // ライバー＆インフルエンサー申込み
  submitLiver: publicProcedure
    .input(z.object({
      name: z.string().min(1, "お名前は必須です"),
      nameKana: z.string().min(1, "フリガナは必須です"),
      liverName: z.string().min(1, "ライバー名は必須です"),
      agency: z.string().optional(),
      accountInfo: z.string().optional(),
      genre: z.string().optional(),
      email: z.string().email("有効なメールアドレスを入力してください"),
      phone: z.string().min(1, "電話番号は必須です"),
      lineOrLark: z.string().optional(),
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
      matchingPreference: z.enum(["yes", "no"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // 重複チェック: 同じメールアドレスで既に申込みがある場合はエラー
      const existing = await db.select({ id: festivalLiverApplications.id })
        .from(festivalLiverApplications)
        .where(and(
          eq(festivalLiverApplications.email, input.email),
          eq(festivalLiverApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "このメールアドレスは既に申込み済みです。重複申込みはできません。" });
      }

      let insertId = 0;
      try {
        const result = await db.insert(festivalLiverApplications).values({
          name: input.name,
          nameKana: input.nameKana,
          liverName: input.liverName,
          agency: input.agency || null,
          accountInfo: input.accountInfo || null,
          genre: input.genre || null,
          email: input.email,
          phone: input.phone,
          lineOrLark: input.lineOrLark || null,
          attendanceSchedule: input.attendanceSchedule,
          matchingPreference: input.matchingPreference,
          portraitRightsConsent: "agreed",
          complianceConsent: "agreed",
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
      } catch (err: any) {
        console.error("[Festival] submitLiver DB error:", err.message, err.code, err.sqlState);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB書き込みエラー: ${err.code || 'UNKNOWN'} - ${err.message?.substring(0, 100) || 'Unknown error'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "liver",
          applicationId: insertId,
          displayName: input.liverName,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'liver', action: 'submit_application', details: JSON.stringify({ liverName: input.liverName }), req: ctx.req });
      }
      return {
        success: true,
        message: "ライバー申込みを受け付けました",
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // 一般来場申込み
  submitGeneral: publicProcedure
    .input(z.object({
      participationType: z.enum(["corporate", "individual"]),
      companyName: z.string().min(1, "貴社名は必須です"),
      department: z.string().optional(),
      name: z.string().min(1, "お名前は必須です"),
      nameKana: z.string().min(1, "フリガナは必須です"),
      email: z.string().email("有効なメールアドレスを入力してください"),
      phone: z.string().min(1, "電話番号は必須です"),
      attendanceSchedule: z.enum(["day1_only", "day2_only", "both_days"]),
      visitPurposes: z.array(z.string()).min(1, "来場目的を1つ以上選択してください"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      // 重複チェック: 同じメールアドレスで既に申込みがある場合はエラー
      const existing = await db.select({ id: festivalGeneralApplications.id })
        .from(festivalGeneralApplications)
        .where(and(
          eq(festivalGeneralApplications.email, input.email),
          eq(festivalGeneralApplications.eventYear, "2026")
        ))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "このメールアドレスは既に申込み済みです。重複申込みはできません。" });
      }

      let insertId = 0;
      try {
        const result = await db.insert(festivalGeneralApplications).values({
          participationType: input.participationType,
          companyName: input.companyName,
          department: input.department || null,
          name: input.name,
          nameKana: input.nameKana,
          email: input.email,
          phone: input.phone,
          attendanceSchedule: input.attendanceSchedule,
          visitPurposes: input.visitPurposes,
          portraitRightsConsent: "agreed",
          complianceConsent: "agreed",
          status: "confirmed",
          eventYear: "2026",
        });
        insertId = (result as any)[0]?.insertId || 0;
      } catch (err: any) {
        console.error("[Festival] submitGeneral DB error:", err.message, err.code, err.sqlState);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB書き込みエラー: ${err.code || 'UNKNOWN'} - ${err.message?.substring(0, 100) || 'Unknown error'}` });
      }

      // 自動アカウント作成
      let accountInfo: { password: string } | null = null;
      try {
        const result = await createFestivalAccount({
          email: input.email,
          accountType: "general",
          applicationId: insertId,
          displayName: input.name,
        });
        if (result) accountInfo = { password: result.password };
      } catch (err: any) {
        console.error("[Festival] Account creation error:", err.message);
      }

            // Log activity
      if (accountInfo) {
        logActivity({ accountId: insertId, accountEmail: input.email, accountType: 'general', action: 'submit_application', details: JSON.stringify({ name: input.name }), req: ctx.req });
      }
      return {
        success: true,
        message: "一般来場申込みを受け付けました",
        account: accountInfo ? {
          email: input.email,
          password: accountInfo.password,
          message: "アカウントが自動作成されました。このパスワードでログインできます。",
        } : null,
      };
    }),
  // ===== 管理API: 一覧・ステータス管理 =====

  // 企業申込み一覧
  listCompany: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalCompanyApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalCompanyApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalCompanyApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalCompanyApplications.createdAt));
      return result;
    }),

  // ライバー申込み一覧
  listLiver: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalLiverApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalLiverApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalLiverApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalLiverApplications.createdAt));
      return result;
    }),

  // 一般来場申込み一覧
  listGeneral: festivalAdminProcedure
    .input(z.object({
      status: z.string().optional(),
      eventYear: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.status) conditions.push(eq(festivalGeneralApplications.status, input.status as any));
      if (input?.eventYear) conditions.push(eq(festivalGeneralApplications.eventYear, input.eventYear));
      
      const result = await db.select().from(festivalGeneralApplications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(festivalGeneralApplications.createdAt));
      return result;
    }),

  // ステータス更新（全タイプ共通）
  updateStatus: festivalAdminProcedure
    .input(z.object({
      type: z.enum(["company", "liver", "general"]),
      id: z.number(),
      status: z.enum(["new", "confirmed", "rejected", "cancelled"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const table = input.type === "company" ? festivalCompanyApplications
        : input.type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;

      const updateData: any = { status: input.status };
      if (input.notes !== undefined) updateData.notes = input.notes;

      await db.update(table).set(updateData).where(eq(table.id, input.id));
      return { success: true };
    }),

  // ===== イベント設定管理 =====

  // イベント設定取得
  getEventSettings: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const year = input?.eventYear || "2026";
      const [settings] = await db.select().from(festivalEventSettings)
        .where(eq(festivalEventSettings.eventYear, year));
      return settings || null;
    }),

  // イベント設定更新
  updateEventSettings: festivalAdminProcedure
    .input(z.object({
      eventYear: z.string().optional(),
      eventName: z.string().optional(),
      venue: z.string().optional(),
      venueAddress: z.string().optional(),
      day1Date: z.string().optional(),
      day2Date: z.string().optional(),
      day1StartTime: z.string().optional(),
      day1EndTime: z.string().optional(),
      day2StartTime: z.string().optional(),
      day2EndTime: z.string().optional(),
      maxCapacity: z.number().optional(),
      description: z.string().optional(),
      programs: z.array(z.object({
        time: z.string(),
        title: z.string(),
        speaker: z.string().optional(),
        description: z.string().optional(),
      })).optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const year = input.eventYear || "2026";
      const [existing] = await db.select().from(festivalEventSettings)
        .where(eq(festivalEventSettings.eventYear, year));

      const data: any = { ...input };
      delete data.eventYear;
      // Remove undefined values
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

      if (existing) {
        await db.update(festivalEventSettings).set(data).where(eq(festivalEventSettings.id, existing.id));
      } else {
        await db.insert(festivalEventSettings).values({ eventYear: year, ...data });
      }
      return { success: true };
    }),

  // ===== スポンサー管理 =====

  // スポンサー一覧
  listSponsors: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const year = input?.eventYear || "2026";
      return await db.select().from(festivalSponsors)
        .where(eq(festivalSponsors.eventYear, year))
        .orderBy(desc(festivalSponsors.createdAt));
    }),

  // スポンサー追加
  addSponsor: festivalAdminProcedure
    .input(z.object({
      companyName: z.string().min(1),
      tier: z.enum(["platinum", "gold", "silver", "bronze", "partner"]),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      sponsorshipAmount: z.number().optional(),
      boothSize: z.string().optional(),
      notes: z.string().optional(),
      eventYear: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.insert(festivalSponsors).values({
        ...input,
        eventYear: input.eventYear || "2026",
      });
      return { success: true };
    }),

  // スポンサー更新
  updateSponsor: festivalAdminProcedure
    .input(z.object({
      id: z.number(),
      companyName: z.string().optional(),
      tier: z.enum(["platinum", "gold", "silver", "bronze", "partner"]).optional(),
      logoUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      sponsorshipAmount: z.number().optional(),
      boothSize: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      const { id, ...data } = input;
      Object.keys(data).forEach(k => (data as any)[k] === undefined && delete (data as any)[k]);
      await db.update(festivalSponsors).set(data).where(eq(festivalSponsors.id, id));
      return { success: true };
    }),

  // スポンサー削除
  deleteSponsor: festivalAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.delete(festivalSponsors).where(eq(festivalSponsors.id, input.id));
      return { success: true };
    }),

  // ===== LINE登録者管理 =====

  // LINE登録者一覧
  listLineRegistrations: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const year = input?.eventYear || "2026";
      return await db.select().from(festivalLineRegistrations)
        .where(eq(festivalLineRegistrations.eventYear, year))
        .orderBy(desc(festivalLineRegistrations.createdAt));
    }),

  // LINE登録者追加（Webhook等から呼ばれる）
  addLineRegistration: publicProcedure
    .input(z.object({
      lineUserId: z.string().optional(),
      displayName: z.string().optional(),
      registeredFrom: z.string().optional(),
      eventYear: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
      await db.insert(festivalLineRegistrations).values({
        ...input,
        eventYear: input.eventYear || "2026",
      });
      return { success: true };
    }),

  // LINE登録者数
  lineRegistrationCount: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const year = input?.eventYear || "2026";
      const [result] = await db.select({ count: count() }).from(festivalLineRegistrations)
        .where(eq(festivalLineRegistrations.eventYear, year));
      return { count: result?.count || 0 };
    }),

  // 統計情報
  stats: festivalAdminProcedure
    .input(z.object({ eventYear: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { company: 0, liver: 0, general: 0, total: 0 };

      const year = input?.eventYear || "2026";

      const [companyCount] = await db.select({ count: count() }).from(festivalCompanyApplications)
        .where(eq(festivalCompanyApplications.eventYear, year));
      const [liverCount] = await db.select({ count: count() }).from(festivalLiverApplications)
        .where(eq(festivalLiverApplications.eventYear, year));
      const [generalCount] = await db.select({ count: count() }).from(festivalGeneralApplications)
        .where(eq(festivalGeneralApplications.eventYear, year));

      return {
        company: companyCount?.count || 0,
        liver: liverCount?.count || 0,
        general: generalCount?.count || 0,
        total: (companyCount?.count || 0) + (liverCount?.count || 0) + (generalCount?.count || 0),
      };
    }),

  // ===== 申し込み者向けAPI =====
  // 自分の申し込み情報を取得
  getMyApplication: publicProcedure
    .query(async ({ ctx }) => {
      const token = getCookieFromReq(ctx.req, 'lcf_token');
      if (!token) return null;
      const payload = await verifyFestivalToken(token);
      if (!payload) return null;
      const db = await getDb();
      if (!db) return null;
      const [account] = await db.select().from(festivalAccounts)
        .where(eq(festivalAccounts.id, payload.accountId))
        .limit(1);
      if (!account) return null;
      // アカウントタイプに応じて申し込み情報を取得
      if (account.accountType === 'company') {
        const [app] = await db.select().from(festivalCompanyApplications)
          .where(eq(festivalCompanyApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'company', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      } else if (account.accountType === 'liver') {
        const [app] = await db.select().from(festivalLiverApplications)
          .where(eq(festivalLiverApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'liver', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      } else {
        const [app] = await db.select().from(festivalGeneralApplications)
          .where(eq(festivalGeneralApplications.id, account.applicationId))
          .limit(1);
        return { accountType: 'general', application: app || null, account: { id: account.id, email: account.email, displayName: account.displayName } };
      }
    }),

  // ===== アクティビティログAPI =====
  // アクティビティログ一覧取得（管理者専用）
  listActivityLogs: festivalAdminProcedure
    .input(z.object({
      accountId: z.number().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      const conditions: any[] = [];
      if (input?.accountId) {
        conditions.push(eq(festivalActivityLogs.accountId, input.accountId));
      }
      if (input?.action) {
        conditions.push(eq(festivalActivityLogs.action, input.action));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [totalResult] = await db.select({ count: count() }).from(festivalActivityLogs)
        .where(whereClause);
      const logs = await db.select().from(festivalActivityLogs)
        .where(whereClause)
        .orderBy(desc(festivalActivityLogs.createdAt))
        .limit(limit)
        .offset(offset);
      return { logs, total: totalResult?.count || 0 };
    }),

  // 重複データ削除（同一email+eventYearの古い方を削除）
  deduplicateApplications: festivalAdminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      let removedCompany = 0, removedLiver = 0, removedGeneral = 0;

      // 企業の重複削除
      const companies = await db.select().from(festivalCompanyApplications).where(eq(festivalCompanyApplications.eventYear, "2026"));
      const companyByEmail = new Map<string, typeof companies>();
      for (const c of companies) {
        const key = c.email;
        if (!companyByEmail.has(key)) companyByEmail.set(key, []);
        companyByEmail.get(key)!.push(c);
      }
      for (const [, group] of companyByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalCompanyApplications).where(eq(festivalCompanyApplications.id, group[i].id));
            removedCompany++;
          }
        }
      }

      // ライバーの重複削除
      const livers = await db.select().from(festivalLiverApplications).where(eq(festivalLiverApplications.eventYear, "2026"));
      const liverByEmail = new Map<string, typeof livers>();
      for (const l of livers) {
        const key = l.email;
        if (!liverByEmail.has(key)) liverByEmail.set(key, []);
        liverByEmail.get(key)!.push(l);
      }
      for (const [, group] of liverByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalLiverApplications).where(eq(festivalLiverApplications.id, group[i].id));
            removedLiver++;
          }
        }
      }

      // 一般の重複削除
      const generals = await db.select().from(festivalGeneralApplications).where(eq(festivalGeneralApplications.eventYear, "2026"));
      const generalByEmail = new Map<string, typeof generals>();
      for (const g of generals) {
        const key = g.email;
        if (!generalByEmail.has(key)) generalByEmail.set(key, []);
        generalByEmail.get(key)!.push(g);
      }
      for (const [, group] of generalByEmail) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          for (let i = 1; i < group.length; i++) {
            await db.delete(festivalGeneralApplications).where(eq(festivalGeneralApplications.id, group[i].id));
            removedGeneral++;
          }
        }
      }

      return { success: true, removed: { company: removedCompany, liver: removedLiver, general: removedGeneral } };
    }),

  // チェックインQRコード用トークン生成
  generateCheckinToken: festivalAdminProcedure
    .input(z.object({
      type: z.enum(["company", "liver", "general"]),
      applicationId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { nanoid } = await import("nanoid");
      const token = nanoid(16);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      await ensureCheckinColumns();
      // チェックイントークンをメタデータとして保存（既存テーブルのnotesフィールドを活用）
      const table = input.type === "company" ? festivalCompanyApplications
        : input.type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;
      
      await db.update(table)
        .set({ checkinToken: token } as any)
        .where(eq(table.id, input.applicationId));
      
      return { token, qrData: `LCF2026:${input.type}:${input.applicationId}:${token}` };
    }),

  // チェックイン実行（QRスキャン時）
  performCheckin: publicProcedure
    .input(z.object({
      qrData: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await ensureCheckinColumns();
      
      // QRデータ解析: "LCF2026:type:id:token"
      const parts = input.qrData.split(":");
      if (parts.length !== 4 || parts[0] !== "LCF2026") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なQRコードです" });
      }
      const [, type, idStr, token] = parts;
      const id = parseInt(idStr);
      if (!["company", "liver", "general"].includes(type) || isNaN(id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "無効なQRコードです" });
      }

      const table = type === "company" ? festivalCompanyApplications
        : type === "liver" ? festivalLiverApplications
        : festivalGeneralApplications;
      
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "申込みが見つかりません" });
      }
      if ((record as any).checkinToken !== token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "トークンが一致しません" });
      }
      if ((record as any).checkedInAt) {
        return { success: true, alreadyCheckedIn: true, name: (record as any).companyName || (record as any).name || (record as any).liverName, checkedInAt: (record as any).checkedInAt };
      }

      // チェックイン実行
      await db.update(table)
        .set({ checkedInAt: new Date() } as any)
        .where(eq(table.id, id));

      return { success: true, alreadyCheckedIn: false, name: (record as any).companyName || (record as any).name || (record as any).liverName, type };
    }),

  // チェックイン状況一覧
  getCheckinStatus: festivalAdminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { companies: [], livers: [], generals: [] };
      
      const companies = await db.select().from(festivalCompanyApplications).where(eq(festivalCompanyApplications.eventYear, "2026"));
      const livers = await db.select().from(festivalLiverApplications).where(eq(festivalLiverApplications.eventYear, "2026"));
      const generals = await db.select().from(festivalGeneralApplications).where(eq(festivalGeneralApplications.eventYear, "2026"));
      
      return {
        companies: companies.map(c => ({ id: c.id, name: c.companyName, email: c.email, checkedIn: !!(c as any).checkedInAt, checkedInAt: (c as any).checkedInAt })),
        livers: livers.map(l => ({ id: l.id, name: (l as any).liverName || l.name, email: l.email, checkedIn: !!(l as any).checkedInAt, checkedInAt: (l as any).checkedInAt })),
        generals: generals.map(g => ({ id: g.id, name: g.name, email: g.email, checkedIn: !!(g as any).checkedInAt, checkedInAt: (g as any).checkedInAt })),
      };
    }),
});
import mysql from "mysql2/promise";

// チェックイン用カラムのマイグレーション（1回だけ実行）
let _migrationDone = false;
export async function ensureCheckinColumns() {
  if (_migrationDone) return;
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL!);
    await pool.query("ALTER TABLE festival_company_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {});
    await pool.query("ALTER TABLE festival_liver_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {});
    await pool.query("ALTER TABLE festival_general_applications ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(32), ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL").catch(() => {});
    await pool.end();
    _migrationDone = true;
  } catch (e) { _migrationDone = true; }
}

// サーバー起動時に即実行
ensureCheckinColumns();
