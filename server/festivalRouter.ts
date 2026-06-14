/**
 * Live Commerce Festival 申込管理ルーター
 * - 公開: 企業/ライバー/一般の申込受付
 * - 管理: 申込一覧・ステータス管理・CSVエクスポート
 */
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  festivalCompanyApplications,
  festivalLiverApplications,
  festivalGeneralApplications,
} from "../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";

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

      await db.insert(festivalCompanyApplications).values({
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
        eventYear: "2026",
      });

      return { success: true, message: "企業申込みを受け付けました" };
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

      await db.insert(festivalLiverApplications).values({
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
        eventYear: "2026",
      });

      return { success: true, message: "ライバー申込みを受け付けました" };
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

      await db.insert(festivalGeneralApplications).values({
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
        eventYear: "2026",
      });

      return { success: true, message: "一般来場申込みを受け付けました" };
    }),

  // ===== 管理API: 一覧・ステータス管理 =====

  // 企業申込み一覧
  listCompany: protectedProcedure
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
  listLiver: protectedProcedure
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
  listGeneral: protectedProcedure
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
  updateStatus: protectedProcedure
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

  // 統計情報
  stats: protectedProcedure
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
});
