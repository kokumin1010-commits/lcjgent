/**
 * 第2回LCFの事前マッチングと自己申告GMV。
 * TikTok APIの自動取得とは表現せず、本人提出と運営確認を分離する。
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  festivalAccounts,
  festivalCompanyApplications,
  festivalGmvAdjustments,
  festivalGmvReports,
  festivalLiverApplications,
  festivalMatchMessages,
  festivalMatchRequests,
} from "../drizzle/festivalSchema";
import { lcmBrandMembers, lcmBrandProfiles, lcmProducts } from "../drizzle/lcmSchema";
import { t, router } from "./_core/trpc";
import { getDb } from "./db";
import { sendEmail } from "./emailService";
import { verifyFestivalAdminRequest, verifyFestivalUserRequest } from "./festivalAuthRouter";
import {
  ensureFestivalEngagementSchema,
  getFestivalEngagementPool,
  getFestivalGmvEvidenceUrl,
  SECOND_EDITION_EVENT_DATES,
  SECOND_EDITION_EVENT_YEAR,
  storeFestivalGmvEvidence,
  writeFestivalEngagementAudit,
} from "./festivalEngagementService";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalHttpsUrl = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "HTTPS URLを入力してください").optional().nullable();

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
  return db;
}

const festivalUserProcedure = t.procedure.use(async ({ ctx, next }) => {
  await ensureFestivalEngagementSchema();
  const account = await verifyFestivalUserRequest(ctx.req);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "LCF共通アカウントでログインしてください" });
  return next({ ctx: { ...ctx, festivalAccount: account } });
});

const festivalAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  await ensureFestivalEngagementSchema();
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "LCF管理者権限が必要です" });
  return next({ ctx: { ...ctx, festivalAdmin: admin } });
});

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function getSecondEditionLiverApplication(db: any, email: string) {
  const [application] = await db.select().from(festivalLiverApplications).where(and(
    sql`LOWER(${festivalLiverApplications.email}) = ${email.toLowerCase()}`,
    eq(festivalLiverApplications.eventYear, SECOND_EDITION_EVENT_YEAR),
    eq(festivalLiverApplications.status, "confirmed"),
  )).orderBy(desc(festivalLiverApplications.updatedAt), desc(festivalLiverApplications.id)).limit(1);
  return application || null;
}

async function getSecondEditionCompanyApplication(db: any, email: string) {
  const [application] = await db.select().from(festivalCompanyApplications).where(and(
    sql`LOWER(${festivalCompanyApplications.email}) = ${email.toLowerCase()}`,
    eq(festivalCompanyApplications.eventYear, SECOND_EDITION_EVENT_YEAR),
    eq(festivalCompanyApplications.status, "confirmed"),
  )).orderBy(desc(festivalCompanyApplications.updatedAt), desc(festivalCompanyApplications.id)).limit(1);
  return application || null;
}

async function requireSecondEditionLiver(db: any, account: { email: string }) {
  const application = await getSecondEditionLiverApplication(db, account.email);
  if (!application) {
    throw new TRPCError({ code: "FORBIDDEN", message: "第2回LCFライブコマーサー申込の承認後に利用できます" });
  }
  return application;
}

async function getEligibleProducts(db: any) {
  const rows = await db.select({
    productId: lcmProducts.id,
    productName: lcmProducts.name,
    productSlug: lcmProducts.slug,
    productImageUrl: lcmProducts.primaryImageUrl,
    listPrice: lcmProducts.listPrice,
    sampleAvailable: lcmProducts.sampleAvailable,
    brandId: lcmBrandProfiles.id,
    brandName: lcmBrandProfiles.displayName,
    companyName: lcmBrandProfiles.companyName,
    brandOwnerAccountId: lcmBrandMembers.festivalAccountId,
    companyApplicationId: festivalCompanyApplications.id,
    companyContact: festivalCompanyApplications.lineOrLark,
    companyEmail: festivalCompanyApplications.email,
  }).from(lcmProducts)
    .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
    .innerJoin(lcmBrandMembers, and(
      eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id),
      eq(lcmBrandMembers.status, "active"),
    ))
    .innerJoin(festivalAccounts, eq(festivalAccounts.id, lcmBrandMembers.festivalAccountId))
    .innerJoin(festivalCompanyApplications, and(
      sql`LOWER(${festivalCompanyApplications.email}) = LOWER(${festivalAccounts.email})`,
      eq(festivalCompanyApplications.eventYear, SECOND_EDITION_EVENT_YEAR),
      eq(festivalCompanyApplications.status, "confirmed"),
    ))
    .where(and(
      eq(lcmProducts.status, "published"),
      eq(lcmBrandProfiles.status, "published"),
    ))
    .orderBy(desc(lcmProducts.publishedAt), desc(lcmProducts.id));

  const byProduct = new Map<number, (typeof rows)[number]>();
  for (const row of rows) if (!byProduct.has(row.productId)) byProduct.set(row.productId, row);
  return Array.from(byProduct.values());
}

async function getEligibleProduct(db: any, productId: number) {
  const products = await getEligibleProducts(db);
  return products.find((product) => product.productId === productId) || null;
}

async function hasActiveBrandAccess(db: any, accountId: number, brandId: number): Promise<boolean> {
  const [member] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
    eq(lcmBrandMembers.brandProfileId, brandId),
    eq(lcmBrandMembers.festivalAccountId, accountId),
    eq(lcmBrandMembers.status, "active"),
  )).limit(1);
  return Boolean(member);
}

async function notify(to: string[], subject: string, content: string) {
  const recipients = Array.from(new Set(to.map((item) => item.trim().toLowerCase()).filter(Boolean)));
  if (!recipients.length) return { success: false, errorCode: "RECIPIENT_MISSING" };
  try {
    return await sendEmail({ to: recipients, subject, content });
  } catch (error) {
    console.error("[LCF Engagement] notification failed", error);
    return { success: false, errorCode: "SEND_FAILED" };
  }
}

function money(value: unknown): number {
  return Math.round(Number(value || 0));
}

function dedupeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const festivalEngagementRouter = router({
  getEligibility: festivalUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const liverApplication = await getSecondEditionLiverApplication(db, ctx.festivalAccount.email);
    const companyApplication = await getSecondEditionCompanyApplication(db, ctx.festivalAccount.email);
    const [brandAccess] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
      eq(lcmBrandMembers.festivalAccountId, ctx.festivalAccount.accountId),
      eq(lcmBrandMembers.status, "active"),
    )).limit(1);
    return {
      eventYear: SECOND_EDITION_EVENT_YEAR,
      eventDates: [...SECOND_EDITION_EVENT_DATES],
      canRequestMatching: Boolean(liverApplication),
      canReviewMatching: Boolean(companyApplication && brandAccess),
      liverApplicationId: liverApplication?.id || null,
      companyApplicationId: companyApplication?.id || null,
    };
  }),

  listEligibleProducts: festivalUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    await requireSecondEditionLiver(db, ctx.festivalAccount);
    const products = await getEligibleProducts(db);
    return products.map((product) => ({
      id: product.productId,
      name: product.productName,
      slug: product.productSlug,
      imageUrl: product.productImageUrl,
      listPrice: product.listPrice == null ? null : Number(product.listPrice),
      sampleAvailable: product.sampleAvailable,
      brandId: product.brandId,
      brandName: product.brandName,
      companyName: product.companyName,
    }));
  }),

  createMatchRequest: festivalUserProcedure.input(z.object({
    productId: z.number().int().positive(),
    message: requiredText(3000),
    plannedDate: z.coerce.date().optional().nullable(),
    contactShareConsent: z.literal(true),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const liverApplication = await requireSecondEditionLiver(db, ctx.festivalAccount);
    const product = await getEligibleProduct(db, input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "第2回LCF出展対象の公開商品が見つかりません" });
    const [existing] = await db.select({ id: festivalMatchRequests.id, status: festivalMatchRequests.status })
      .from(festivalMatchRequests).where(and(
        eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR),
        eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId),
        eq(festivalMatchRequests.productId, input.productId),
        inArray(festivalMatchRequests.status, ["requested", "needs_info", "approved"]),
      )).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "この商品には進行中のマッチング依頼があります" });

    const pool = getFestivalEngagementPool();
    const requestCode = `MT-${nanoid(10).toUpperCase()}`;
    const creatorContact = clean(liverApplication.lineOrLark) || ctx.festivalAccount.email;
    const brandContact = clean(product.companyContact) || product.companyEmail;
    const result = await db.transaction(async (tx: any) => {
      const inserted = await tx.insert(festivalMatchRequests).values({
        requestCode,
        eventYear: SECOND_EDITION_EVENT_YEAR,
        creatorAccountId: ctx.festivalAccount.accountId,
        creatorApplicationId: liverApplication.id,
        brandProfileId: product.brandId,
        productId: product.productId,
        brandOwnerAccountId: product.brandOwnerAccountId,
        activeKey: `${SECOND_EDITION_EVENT_YEAR}:${ctx.festivalAccount.accountId}:${product.productId}`,
        message: input.message,
        plannedDate: input.plannedDate || null,
        contactShareConsent: true,
        creatorContactSnapshot: creatorContact,
        brandContactSnapshot: brandContact,
        status: "requested",
      });
      const id = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
      await tx.insert(festivalMatchMessages).values({
        matchRequestId: id,
        senderAccountId: ctx.festivalAccount.accountId,
        senderRole: "creator",
        message: input.message,
      });
      return id;
    });
    await writeFestivalEngagementAudit(pool, {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: "creator",
      entityType: "matching",
      entityId: result,
      action: "requested",
      after: { requestCode, productId: input.productId, brandId: product.brandId },
      req: ctx.req,
    });
    const notification = await notify(
      [product.companyEmail],
      `【第2回LCF】事前マッチング依頼：${product.productName}`,
      `${ctx.festivalAccount.displayName}さんから、${product.brandName}「${product.productName}」への事前マッチング依頼が届きました。\n\nLCF/LCM共通アカウントで確認してください。\nhttps://www.livecommercefestival.com/lcf/mypage`,
    );
    return { success: true, id: result, requestCode, notification };
  }),

  listMyMatches: festivalUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db.select({
      match: festivalMatchRequests,
      productName: lcmProducts.name,
      productSlug: lcmProducts.slug,
      productImageUrl: lcmProducts.primaryImageUrl,
      brandName: lcmBrandProfiles.displayName,
    }).from(festivalMatchRequests)
      .innerJoin(lcmProducts, eq(lcmProducts.id, festivalMatchRequests.productId))
      .innerJoin(lcmBrandProfiles, eq(lcmBrandProfiles.id, festivalMatchRequests.brandProfileId))
      .where(and(
        eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR),
        eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId),
      )).orderBy(desc(festivalMatchRequests.updatedAt));
    return rows.map((row) => ({
      ...row,
      counterpartContact: row.match.status === "approved" && row.match.contactShareConsent
        ? row.match.brandContactSnapshot
        : null,
      match: { ...row.match, creatorContactSnapshot: null, brandContactSnapshot: null },
    }));
  }),

  listBrandMatches: festivalUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const companyApplication = await getSecondEditionCompanyApplication(db, ctx.festivalAccount.email);
    if (!companyApplication) return [];
    const rows = await db.select({
      match: festivalMatchRequests,
      productName: lcmProducts.name,
      productImageUrl: lcmProducts.primaryImageUrl,
      brandName: lcmBrandProfiles.displayName,
      creatorName: festivalLiverApplications.liverName,
      creatorEmail: festivalAccounts.email,
    }).from(festivalMatchRequests)
      .innerJoin(lcmProducts, eq(lcmProducts.id, festivalMatchRequests.productId))
      .innerJoin(lcmBrandProfiles, eq(lcmBrandProfiles.id, festivalMatchRequests.brandProfileId))
      .innerJoin(lcmBrandMembers, and(
        eq(lcmBrandMembers.brandProfileId, festivalMatchRequests.brandProfileId),
        eq(lcmBrandMembers.festivalAccountId, ctx.festivalAccount.accountId),
        eq(lcmBrandMembers.status, "active"),
      ))
      .innerJoin(festivalLiverApplications, eq(festivalLiverApplications.id, festivalMatchRequests.creatorApplicationId))
      .innerJoin(festivalAccounts, eq(festivalAccounts.id, festivalMatchRequests.creatorAccountId))
      .where(eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR))
      .orderBy(desc(festivalMatchRequests.updatedAt));
    return rows.map(({ creatorEmail, ...row }) => ({
      ...row,
      creatorContact: row.match.status === "approved" && row.match.contactShareConsent
        ? row.match.creatorContactSnapshot || creatorEmail
        : null,
      match: { ...row.match, creatorContactSnapshot: null, brandContactSnapshot: null },
    }));
  }),

  respondToMatch: festivalUserProcedure.input(z.object({
    id: z.number().int().positive(),
    action: z.enum(["approve", "needs_info", "decline"]),
    message: optionalText(3000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(festivalMatchRequests).where(and(
      eq(festivalMatchRequests.id, input.id),
      eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR),
    )).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "マッチング依頼が見つかりません" });
    if (!(await hasActiveBrandAccess(db, ctx.festivalAccount.accountId, before.brandProfileId))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "このブランドの対応権限がありません" });
    }
    if (!['requested', 'needs_info'].includes(before.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "この依頼はすでに処理済みです" });
    }
    if (input.action !== "approve" && !clean(input.message)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "追加確認または見送り理由を入力してください" });
    }
    const status = input.action === "approve" ? "approved" : input.action === "needs_info" ? "needs_info" : "declined";
    await db.transaction(async (tx: any) => {
      await tx.update(festivalMatchRequests).set({
        status,
        activeKey: status === "declined" ? null : before.activeKey,
        brandReply: clean(input.message),
        reviewedByAccountId: ctx.festivalAccount.accountId,
        reviewedAt: new Date(),
      }).where(eq(festivalMatchRequests.id, input.id));
      if (clean(input.message)) {
        await tx.insert(festivalMatchMessages).values({
          matchRequestId: input.id,
          senderAccountId: ctx.festivalAccount.accountId,
          senderRole: "brand",
          message: clean(input.message)!,
        });
      }
    });
    const pool = getFestivalEngagementPool();
    await writeFestivalEngagementAudit(pool, {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: "brand",
      entityType: "matching",
      entityId: input.id,
      action: status,
      before: { status: before.status },
      after: { status },
      reason: clean(input.message),
      req: ctx.req,
    });
    const [creator] = await db.select({ email: festivalAccounts.email }).from(festivalAccounts)
      .where(eq(festivalAccounts.id, before.creatorAccountId)).limit(1);
    const notification = creator?.email ? await notify(
      [creator.email],
      `【第2回LCF】事前マッチング結果：${status === "approved" ? "承認" : status === "needs_info" ? "追加確認" : "見送り"}`,
      `事前マッチング依頼が「${status === "approved" ? "承認" : status === "needs_info" ? "追加確認" : "見送り"}」になりました。${clean(input.message) ? `\n\nブランドからの連絡：${clean(input.message)}` : ""}\n\nhttps://www.livecommercefestival.com/lcf/mypage`,
    ) : { success: false, errorCode: "RECIPIENT_MISSING" };
    return { success: true, status, notification };
  }),

  cancelMatch: festivalUserProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(festivalMatchRequests).where(and(
      eq(festivalMatchRequests.id, input.id),
      eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId),
      eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR),
    )).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "マッチング依頼が見つかりません" });
    if (!['requested', 'needs_info'].includes(before.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "この依頼は取消できません" });
    await db.update(festivalMatchRequests).set({ status: "cancelled", activeKey: null }).where(eq(festivalMatchRequests.id, input.id));
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: "creator",
      entityType: "matching",
      entityId: input.id,
      action: "cancelled",
      before: { status: before.status },
      after: { status: "cancelled" },
      req: ctx.req,
    });
    return { success: true };
  }),

  listMyGmvReports: festivalUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db.select({
      report: festivalGmvReports,
      productName: lcmProducts.name,
      brandName: lcmBrandProfiles.displayName,
    }).from(festivalGmvReports)
      .innerJoin(lcmProducts, eq(lcmProducts.id, festivalGmvReports.productId))
      .innerJoin(lcmBrandProfiles, eq(lcmBrandProfiles.id, festivalGmvReports.brandProfileId))
      .where(and(
        eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
        eq(festivalGmvReports.creatorAccountId, ctx.festivalAccount.accountId),
      )).orderBy(desc(festivalGmvReports.submittedAt));
    return rows.map((row) => ({
      ...row,
      report: {
        ...row.report,
        submittedAmount: money(row.report.submittedAmount),
        verifiedAmount: row.report.verifiedAmount == null ? null : money(row.report.verifiedAmount),
        evidenceStorageKey: undefined,
        evidenceSha256: undefined,
        activeEvidenceSha256: undefined,
        activeLiveUrlHash: undefined,
      },
    }));
  }),

  submitGmvReport: festivalUserProcedure.input(z.object({
    matchRequestId: z.number().int().positive(),
    reportDate: z.enum(SECOND_EDITION_EVENT_DATES),
    submittedAmount: z.number().int().min(0).max(1_000_000_000),
    orderCount: z.number().int().min(0).max(10_000_000).optional().nullable(),
    liveUrl: optionalHttpsUrl,
    note: optionalText(3000),
    fileName: requiredText(500),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64Data: z.string().min(16).max(12_000_000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const liverApplication = await requireSecondEditionLiver(db, ctx.festivalAccount);
    const [match] = await db.select().from(festivalMatchRequests).where(and(
      eq(festivalMatchRequests.id, input.matchRequestId),
      eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR),
      eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId),
      eq(festivalMatchRequests.status, "approved"),
    )).limit(1);
    if (!match) throw new TRPCError({ code: "FORBIDDEN", message: "承認済み事前マッチングを選択してください" });
    const liveUrl = clean(input.liveUrl);
    const activeLiveUrlHash = liveUrl
      ? dedupeHash(`${SECOND_EDITION_EVENT_YEAR}:${ctx.festivalAccount.accountId}:${input.reportDate}:${liveUrl}`)
      : null;
    if (liveUrl) {
      const [duplicateUrl] = await db.select({ id: festivalGmvReports.id }).from(festivalGmvReports).where(and(
        eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
        eq(festivalGmvReports.creatorAccountId, ctx.festivalAccount.accountId),
        eq(festivalGmvReports.reportDate, input.reportDate),
        eq(festivalGmvReports.liveUrl, liveUrl),
        inArray(festivalGmvReports.status, ["submitted", "needs_revision", "verified"]),
      )).limit(1);
      if (duplicateUrl) throw new TRPCError({ code: "CONFLICT", message: "同じ日・配信URLのGMV報告がすでにあります" });
    }
    const evidence = await storeFestivalGmvEvidence({
      eventYear: SECOND_EDITION_EVENT_YEAR,
      accountId: ctx.festivalAccount.accountId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      base64Data: input.base64Data,
    });
    const [duplicateEvidence] = await db.select({ id: festivalGmvReports.id }).from(festivalGmvReports).where(and(
      eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
      eq(festivalGmvReports.evidenceSha256, evidence.sha256),
      inArray(festivalGmvReports.status, ["submitted", "needs_revision", "verified"]),
    )).limit(1);
    if (duplicateEvidence) throw new TRPCError({ code: "CONFLICT", message: "同じ証拠画像がすでに提出されています" });
    const reportCode = `GMV-${nanoid(10).toUpperCase()}`;
    const inserted = await db.insert(festivalGmvReports).values({
      reportCode,
      eventYear: SECOND_EDITION_EVENT_YEAR,
      reportDate: input.reportDate,
      creatorAccountId: ctx.festivalAccount.accountId,
      creatorApplicationId: liverApplication.id,
      matchRequestId: match.id,
      brandProfileId: match.brandProfileId,
      productId: match.productId,
      submittedAmount: String(input.submittedAmount),
      orderCount: input.orderCount ?? null,
      liveUrl,
      note: clean(input.note),
      evidenceStorageKey: evidence.key,
      evidenceFileName: evidence.fileName,
      evidenceMimeType: evidence.mimeType,
      evidenceByteSize: evidence.byteSize,
      evidenceSha256: evidence.sha256,
      activeEvidenceSha256: dedupeHash(`${SECOND_EDITION_EVENT_YEAR}:${evidence.sha256}`),
      activeLiveUrlHash,
      status: "submitted",
    });
    const id = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: "creator",
      entityType: "gmv_report",
      entityId: id,
      action: "submitted",
      after: { reportCode, reportDate: input.reportDate, submittedAmount: input.submittedAmount, matchRequestId: match.id },
      req: ctx.req,
    });
    return { success: true, id, reportCode, status: "submitted" as const };
  }),

  resubmitGmvReport: festivalUserProcedure.input(z.object({
    reportId: z.number().int().positive(),
    reportDate: z.enum(SECOND_EDITION_EVENT_DATES),
    submittedAmount: z.number().int().min(0).max(1_000_000_000),
    orderCount: z.number().int().min(0).max(10_000_000).optional().nullable(),
    liveUrl: optionalHttpsUrl,
    note: optionalText(3000),
    fileName: requiredText(500),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64Data: z.string().min(16).max(12_000_000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(festivalGmvReports).where(and(
      eq(festivalGmvReports.id, input.reportId),
      eq(festivalGmvReports.creatorAccountId, ctx.festivalAccount.accountId),
      eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
    )).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "差戻し対象のGMV報告が見つかりません" });
    if (before.status !== "needs_revision") throw new TRPCError({ code: "BAD_REQUEST", message: "差戻し中の報告だけ再提出できます" });
    const [match] = await db.select().from(festivalMatchRequests).where(and(
      eq(festivalMatchRequests.id, before.matchRequestId),
      eq(festivalMatchRequests.creatorAccountId, ctx.festivalAccount.accountId),
      eq(festivalMatchRequests.status, "approved"),
    )).limit(1);
    if (!match) throw new TRPCError({ code: "FORBIDDEN", message: "承認済み事前マッチングが確認できません" });
    const liveUrl = clean(input.liveUrl);
    const activeLiveUrlHash = liveUrl
      ? dedupeHash(`${SECOND_EDITION_EVENT_YEAR}:${ctx.festivalAccount.accountId}:${input.reportDate}:${liveUrl}`)
      : null;
    if (liveUrl) {
      const [duplicateUrl] = await db.select({ id: festivalGmvReports.id }).from(festivalGmvReports).where(and(
        eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
        eq(festivalGmvReports.creatorAccountId, ctx.festivalAccount.accountId),
        eq(festivalGmvReports.reportDate, input.reportDate),
        eq(festivalGmvReports.liveUrl, liveUrl),
        inArray(festivalGmvReports.status, ["submitted", "verified"]),
      )).limit(1);
      if (duplicateUrl) throw new TRPCError({ code: "CONFLICT", message: "同じ日・配信URLのGMV報告がすでにあります" });
    }
    const evidence = await storeFestivalGmvEvidence({
      eventYear: SECOND_EDITION_EVENT_YEAR,
      accountId: ctx.festivalAccount.accountId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      base64Data: input.base64Data,
    });
    const [duplicateEvidence] = await db.select({ id: festivalGmvReports.id }).from(festivalGmvReports).where(and(
      eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR),
      eq(festivalGmvReports.evidenceSha256, evidence.sha256),
      inArray(festivalGmvReports.status, ["submitted", "verified"]),
    )).limit(1);
    if (duplicateEvidence) throw new TRPCError({ code: "CONFLICT", message: "同じ証拠画像がすでに提出されています" });
    const reportCode = `GMV-${nanoid(10).toUpperCase()}`;
    const id = await db.transaction(async (tx: any) => {
      await tx.update(festivalGmvReports).set({
        status: "voided",
        activeEvidenceSha256: null,
        activeLiveUrlHash: null,
        reviewNote: "差戻し後の再提出により置換",
        reviewedAt: new Date(),
      }).where(eq(festivalGmvReports.id, before.id));
      const inserted = await tx.insert(festivalGmvReports).values({
        reportCode,
        eventYear: SECOND_EDITION_EVENT_YEAR,
        reportDate: input.reportDate,
        creatorAccountId: before.creatorAccountId,
        creatorApplicationId: before.creatorApplicationId,
        matchRequestId: before.matchRequestId,
        supersedesReportId: before.id,
        brandProfileId: before.brandProfileId,
        productId: before.productId,
        submittedAmount: String(input.submittedAmount),
        orderCount: input.orderCount ?? null,
        liveUrl,
        note: clean(input.note),
        evidenceStorageKey: evidence.key,
        evidenceFileName: evidence.fileName,
        evidenceMimeType: evidence.mimeType,
        evidenceByteSize: evidence.byteSize,
        evidenceSha256: evidence.sha256,
        activeEvidenceSha256: dedupeHash(`${SECOND_EDITION_EVENT_YEAR}:${evidence.sha256}`),
        activeLiveUrlHash,
        status: "submitted",
      });
      return Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
    });
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: "creator",
      entityType: "gmv_report",
      entityId: id,
      action: "resubmitted",
      before: { reportId: before.id, status: before.status },
      after: { reportCode, submittedAmount: input.submittedAmount, supersedesReportId: before.id },
      req: ctx.req,
    });
    return { success: true, id, reportCode, status: "submitted" as const };
  }),

  getEvidenceUrl: festivalUserProcedure.input(z.object({ reportId: z.number().int().positive() }).strict()).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const [report] = await db.select().from(festivalGmvReports).where(eq(festivalGmvReports.id, input.reportId)).limit(1);
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "GMV報告が見つかりません" });
    const isCreator = report.creatorAccountId === ctx.festivalAccount.accountId;
    const isBrand = await hasActiveBrandAccess(db, ctx.festivalAccount.accountId, report.brandProfileId);
    const isAdmin = ctx.festivalAccount.role === "admin";
    if (!isCreator && !isBrand && !isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "証拠画像の閲覧権限がありません" });
    const url = await getFestivalGmvEvidenceUrl(report.evidenceStorageKey);
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAccount.accountId,
      actorRole: isAdmin ? "admin" : isCreator ? "creator" : "brand",
      entityType: "evidence",
      entityId: report.id,
      action: "viewed",
      req: ctx.req,
    });
    return { url, expiresInSeconds: 3600 };
  }),

  adminOverview: festivalAdminProcedure.query(async () => {
    const db = await requireDb();
    const matches = await db.select({
      match: festivalMatchRequests,
      productName: lcmProducts.name,
      brandName: lcmBrandProfiles.displayName,
      creatorName: festivalLiverApplications.liverName,
      creatorEmail: festivalAccounts.email,
    }).from(festivalMatchRequests)
      .innerJoin(lcmProducts, eq(lcmProducts.id, festivalMatchRequests.productId))
      .innerJoin(lcmBrandProfiles, eq(lcmBrandProfiles.id, festivalMatchRequests.brandProfileId))
      .innerJoin(festivalLiverApplications, eq(festivalLiverApplications.id, festivalMatchRequests.creatorApplicationId))
      .innerJoin(festivalAccounts, eq(festivalAccounts.id, festivalMatchRequests.creatorAccountId))
      .where(eq(festivalMatchRequests.eventYear, SECOND_EDITION_EVENT_YEAR))
      .orderBy(desc(festivalMatchRequests.updatedAt));
    const reports = await db.select({
      report: festivalGmvReports,
      productName: lcmProducts.name,
      brandName: lcmBrandProfiles.displayName,
      creatorName: festivalLiverApplications.liverName,
      creatorEmail: festivalAccounts.email,
    }).from(festivalGmvReports)
      .innerJoin(lcmProducts, eq(lcmProducts.id, festivalGmvReports.productId))
      .innerJoin(lcmBrandProfiles, eq(lcmBrandProfiles.id, festivalGmvReports.brandProfileId))
      .innerJoin(festivalLiverApplications, eq(festivalLiverApplications.id, festivalGmvReports.creatorApplicationId))
      .innerJoin(festivalAccounts, eq(festivalAccounts.id, festivalGmvReports.creatorAccountId))
      .where(eq(festivalGmvReports.eventYear, SECOND_EDITION_EVENT_YEAR))
      .orderBy(desc(festivalGmvReports.submittedAt));
    const adjustments = await db.select().from(festivalGmvAdjustments)
      .where(inArray(festivalGmvAdjustments.reportId, reports.map((row) => row.report.id).length ? reports.map((row) => row.report.id) : [-1]))
      .orderBy(asc(festivalGmvAdjustments.createdAt));
    const adjustmentByReport = new Map<number, number>();
    for (const item of adjustments) {
      if (item.status !== "applied") continue;
      adjustmentByReport.set(item.reportId, (adjustmentByReport.get(item.reportId) || 0) + money(item.amount));
    }
    const normalizedReports = reports.map((row) => {
      const adjustmentTotal = adjustmentByReport.get(row.report.id) || 0;
      const verifiedAmount = row.report.verifiedAmount == null ? null : money(row.report.verifiedAmount);
      return {
        ...row,
        report: {
          ...row.report,
          submittedAmount: money(row.report.submittedAmount),
          verifiedAmount,
          finalAmount: row.report.status === "verified" && verifiedAmount != null ? verifiedAmount + adjustmentTotal : null,
          evidenceStorageKey: undefined,
        },
        adjustmentTotal,
      };
    });
    const verified = normalizedReports.filter((row) => row.report.status === "verified");
    const total = verified.reduce((sum, row) => sum + Number(row.report.finalAmount || 0), 0);
    const byDate = Object.fromEntries(SECOND_EDITION_EVENT_DATES.map((date) => [
      date,
      verified.filter((row) => row.report.reportDate === date).reduce((sum, row) => sum + Number(row.report.finalAmount || 0), 0),
    ]));
    const creatorTotals = new Map<number, { creatorAccountId: number; creatorName: string; amount: number }>();
    const brandTotals = new Map<number, { brandProfileId: number; brandName: string; amount: number }>();
    const productTotals = new Map<number, { productId: number; productName: string; brandName: string; amount: number }>();
    for (const row of verified) {
      const current = creatorTotals.get(row.report.creatorAccountId) || { creatorAccountId: row.report.creatorAccountId, creatorName: row.creatorName, amount: 0 };
      current.amount += Number(row.report.finalAmount || 0);
      creatorTotals.set(row.report.creatorAccountId, current);
      const currentBrand = brandTotals.get(row.report.brandProfileId) || { brandProfileId: row.report.brandProfileId, brandName: row.brandName, amount: 0 };
      currentBrand.amount += Number(row.report.finalAmount || 0);
      brandTotals.set(row.report.brandProfileId, currentBrand);
      const currentProduct = productTotals.get(row.report.productId) || { productId: row.report.productId, productName: row.productName, brandName: row.brandName, amount: 0 };
      currentProduct.amount += Number(row.report.finalAmount || 0);
      productTotals.set(row.report.productId, currentProduct);
    }
    return {
      eventYear: SECOND_EDITION_EVENT_YEAR,
      matches,
      reports: normalizedReports,
      adjustments,
      summary: {
        pendingCount: normalizedReports.filter((row) => row.report.status === "submitted").length,
        needsRevisionCount: normalizedReports.filter((row) => row.report.status === "needs_revision").length,
        verifiedCount: verified.length,
        verifiedTotal: total,
        byDate,
        creatorRanking: Array.from(creatorTotals.values()).sort((a, b) => b.amount - a.amount),
        brandTotals: Array.from(brandTotals.values()).sort((a, b) => b.amount - a.amount),
        productTotals: Array.from(productTotals.values()).sort((a, b) => b.amount - a.amount),
        label: "運営確認済みの自己申告GMV",
      },
    };
  }),

  reviewGmvReport: festivalAdminProcedure.input(z.object({
    reportId: z.number().int().positive(),
    action: z.enum(["verify", "needs_revision", "void"]),
    verifiedAmount: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
    reason: optionalText(3000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(festivalGmvReports).where(eq(festivalGmvReports.id, input.reportId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "GMV報告が見つかりません" });
    if (before.status === "voided") throw new TRPCError({ code: "BAD_REQUEST", message: "無効化済みの報告は変更できません" });
    if (input.action !== "verify" && !clean(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "差戻し・無効化理由を入力してください" });
    if (input.action === "verify" && input.verifiedAmount == null) throw new TRPCError({ code: "BAD_REQUEST", message: "確認済みGMVを入力してください" });
    if (input.action === "verify" && input.verifiedAmount !== money(before.submittedAmount) && !clean(input.reason)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "自己申告額を修正して承認する場合は理由を入力してください" });
    }
    if (input.action === "verify" && input.verifiedAmount != null) {
      const appliedAdjustments = await db.select({ amount: festivalGmvAdjustments.amount }).from(festivalGmvAdjustments).where(and(
        eq(festivalGmvAdjustments.reportId, before.id),
        eq(festivalGmvAdjustments.status, "applied"),
      ));
      const adjustmentTotal = appliedAdjustments.reduce((sum, item) => sum + money(item.amount), 0);
      if (input.verifiedAmount + adjustmentTotal < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "既存調整を含む最終GMVを0円未満にはできません" });
      }
    }
    const status = input.action === "verify" ? "verified" : input.action === "needs_revision" ? "needs_revision" : "voided";
    await db.update(festivalGmvReports).set({
      status,
      verifiedAmount: input.action === "verify" ? String(input.verifiedAmount) : before.verifiedAmount,
      reviewedByAccountId: ctx.festivalAdmin.id,
      reviewedAt: new Date(),
      reviewNote: clean(input.reason),
      activeEvidenceSha256: input.action === "void" ? null : before.activeEvidenceSha256,
      activeLiveUrlHash: input.action === "void" ? null : before.activeLiveUrlHash,
    }).where(eq(festivalGmvReports.id, input.reportId));
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAdmin.id,
      actorRole: "admin",
      entityType: "gmv_report",
      entityId: before.id,
      action: status,
      before: { status: before.status, verifiedAmount: before.verifiedAmount },
      after: { status, verifiedAmount: input.action === "verify" ? input.verifiedAmount : before.verifiedAmount },
      reason: clean(input.reason),
      req: ctx.req,
    });
    const [creator] = await db.select({ email: festivalAccounts.email }).from(festivalAccounts)
      .where(eq(festivalAccounts.id, before.creatorAccountId)).limit(1);
    const notification = creator?.email ? await notify(
      [creator.email],
      `【第2回LCF】GMV報告：${status === "verified" ? "確認済み" : status === "needs_revision" ? "差戻し" : "無効化"}`,
      `GMV報告 ${before.reportCode} は「${status === "verified" ? "運営確認済み" : status === "needs_revision" ? "差戻し" : "無効化"}」になりました。${clean(input.reason) ? `\n\n運営からの連絡：${clean(input.reason)}` : ""}\n\nhttps://www.livecommercefestival.com/lcf/mypage`,
    ) : { success: false, errorCode: "RECIPIENT_MISSING" };
    return { success: true, status, notification };
  }),

  addGmvAdjustment: festivalAdminProcedure.input(z.object({
    reportId: z.number().int().positive(),
    amount: z.number().int().min(-1_000_000_000).max(1_000_000_000).refine((value) => value !== 0, "調整額を入力してください"),
    reason: requiredText(3000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [report] = await db.select().from(festivalGmvReports).where(eq(festivalGmvReports.id, input.reportId)).limit(1);
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "GMV報告が見つかりません" });
    if (report.status !== "verified") throw new TRPCError({ code: "BAD_REQUEST", message: "運営確認済みの報告だけ調整できます" });
    const existingAdjustments = await db.select({ amount: festivalGmvAdjustments.amount }).from(festivalGmvAdjustments).where(and(
      eq(festivalGmvAdjustments.reportId, report.id),
      eq(festivalGmvAdjustments.status, "applied"),
    ));
    const currentFinalAmount = money(report.verifiedAmount) + existingAdjustments.reduce((sum, item) => sum + money(item.amount), 0);
    if (currentFinalAmount + input.amount < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "調整後GMVを0円未満にはできません" });
    }
    const inserted = await db.insert(festivalGmvAdjustments).values({
      reportId: report.id,
      amount: String(input.amount),
      reason: input.reason,
      actorAdminId: ctx.festivalAdmin.id,
      status: "applied",
    });
    const id = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
    await writeFestivalEngagementAudit(getFestivalEngagementPool(), {
      actorAccountId: ctx.festivalAdmin.id,
      actorRole: "admin",
      entityType: "gmv_adjustment",
      entityId: id,
      action: "applied",
      after: { reportId: report.id, amount: input.amount },
      reason: input.reason,
      req: ctx.req,
    });
    return { success: true, id };
  }),
});
