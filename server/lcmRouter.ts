import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, notInArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  lcmAuditLogs,
  lcmBrandEventParticipations,
  lcmBrandMembers,
  lcmBrandProfiles,
  lcmCreatorProfiles,
  lcmMemberships,
  lcmProductInterests,
  lcmProductReviews,
  lcmProducts,
  lcmReviewReports,
  lcmSampleCartItems,
  lcmSampleRequests,
  lcmWholesaleInquiries,
} from "../drizzle/lcmSchema";
import { festivalAccounts, festivalCompanyApplications, festivalLiverApplications } from "../drizzle/festivalSchema";
import { lcf2026ExhibitorCatalogPages } from "../client/src/data/lcf2026ExhibitorCatalog";
import {
  getLcmCatalogBrandPages,
  getLcmCatalogCompanyBrands,
  getLcmCatalogIdentity,
  lcmCatalogIdentities,
  normalizeLcmCatalogName,
} from "../shared/lcmCatalogDirectory";
import { publicProcedure, router, t } from "./_core/trpc";
import { getDb } from "./db";
import { sendEmail } from "./emailService";
import { verifyFestivalAdminRequest, verifyFestivalUserRequest } from "./festivalAuthRouter";
import { storagePut } from "./storage";

const LCM_TERMS_VERSION = "2026-09-13-v1";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BRANDS_PER_ACCOUNT = 50;
const MAX_PRODUCTS_PER_BRAND = 500;
const LCM_BASE_URL = "https://www.livecommercefestival.com/lcm";
const uploadRateLimits = new Map<number, { count: number; resetAt: number }>();

const nullableText = (max: number) => z.string().trim().max(max).optional().nullable();
const nullableHttpsUrl = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "HTTPS URLを入力してください").optional().nullable();
const nullablePlatformUrl = (platform: string, allowedHosts: string[]) => z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}, `${platform}の公式HTTPS URLを入力してください`).optional().nullable();

function cleanNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string): string {
  const normalized = value.normalize("NFKC").toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return normalized || `brand-${nanoid(8).toLowerCase()}`;
}

function insertedId(result: unknown): number {
  const value = (result as any)?.[0]?.insertId ?? (result as any)?.insertId;
  const id = Number(value || 0);
  if (!Number.isInteger(id) || id <= 0) throw new Error("insert id was not returned");
  return id;
}

function catalogRecord(page: number) {
  return lcf2026ExhibitorCatalogPages.find((item) => item.page === page && item.pageType === "出展企業紹介");
}

async function ensureCatalogBrandClaim(
  db: any,
  accountId: number,
  primaryBrandPage: number,
  message?: string,
) {
  const identity = getLcmCatalogIdentity(primaryBrandPage);
  const record = catalogRecord(primaryBrandPage);
  if (!identity || !record || identity.page !== identity.primaryBrandPage) {
    throw new TRPCError({ code: "NOT_FOUND", message: "連携対象のカタログが見つかりません" });
  }

  const [existing] = await db.select().from(lcmBrandProfiles)
    .where(eq(lcmBrandProfiles.sourceCatalogPage, primaryBrandPage)).limit(1);
  let brandId: number;
  if (existing?.claimStatus === "claimed") {
    const [ownActive] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
      eq(lcmBrandMembers.brandProfileId, existing.id),
      eq(lcmBrandMembers.festivalAccountId, accountId),
      eq(lcmBrandMembers.status, "active"),
    )).limit(1);
    if (!ownActive) throw new TRPCError({ code: "CONFLICT", message: `${identity.brandName}は既に管理されています` });
    return { brandId: existing.id, memberId: ownActive.id, status: "active" as const, identity };
  }
  if (existing) {
    brandId = existing.id;
    await db.update(lcmBrandProfiles).set({
      displayName: identity.brandName,
      companyName: identity.companyName,
      category: cleanNullable(record.category),
      officialWebsiteUrl: cleanNullable(record.officialUrl),
    }).where(eq(lcmBrandProfiles.id, existing.id));
  } else {
    const result = await db.insert(lcmBrandProfiles).values({
      slug: `${slugify(identity.brandName)}-${nanoid(6).toLowerCase()}`,
      sourceCatalogPage: primaryBrandPage,
      displayName: identity.brandName,
      companyName: identity.companyName,
      category: cleanNullable(record.category),
      description: cleanNullable(record.message),
      coverUrl: cleanNullable(record.imageUrl),
      officialWebsiteUrl: cleanNullable(record.officialUrl),
      status: "draft",
      claimStatus: "pending",
      createdByAccountId: accountId,
    });
    brandId = insertedId(result);
  }

  const [current] = await db.select().from(lcmBrandMembers).where(and(
    eq(lcmBrandMembers.brandProfileId, brandId),
    eq(lcmBrandMembers.festivalAccountId, accountId),
  )).limit(1);
  const [otherPending] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
    eq(lcmBrandMembers.brandProfileId, brandId),
    inArray(lcmBrandMembers.status, ["pending", "active"]),
  )).limit(1);
  if (!current && otherPending) throw new TRPCError({ code: "CONFLICT", message: `${identity.brandName}は現在確認中です` });

  let memberId = current?.id;
  let memberStatus = current?.status;
  if (!current) {
    const result = await db.insert(lcmBrandMembers).values({
      brandProfileId: brandId,
      festivalAccountId: accountId,
      role: "owner",
      status: "pending",
    });
    memberId = insertedId(result);
    memberStatus = "pending";
  } else if (current.status === "rejected" || current.status === "revoked") {
    await db.update(lcmBrandMembers).set({ status: "pending", approvedBy: null, approvedAt: null })
      .where(eq(lcmBrandMembers.id, current.id));
    memberStatus = "pending";
  }

  const brandPages = getLcmCatalogBrandPages(primaryBrandPage);
  for (const page of brandPages) {
    const pageRecord = catalogRecord(page);
    if (!pageRecord?.productTitle) continue;
    const sourceReference = `lcf-2026-catalog-${page}`;
    const [existingProduct] = await db.select({ id: lcmProducts.id }).from(lcmProducts).where(and(
      eq(lcmProducts.sourceKind, "lcf_catalog"),
      eq(lcmProducts.sourceReference, sourceReference),
    )).limit(1);
    if (existingProduct) continue;
    await db.insert(lcmProducts).values({
      brandProfileId: brandId,
      slug: `${slugify(pageRecord.productTitle)}-${nanoid(6).toLowerCase()}`,
      name: pageRecord.productTitle,
      category: cleanNullable(pageRecord.category),
      summary: cleanNullable(pageRecord.pickupProduct),
      description: cleanNullable(pageRecord.message),
      relatedProductsText: cleanNullable(pageRecord.otherProducts),
      primaryImageUrl: cleanNullable(pageRecord.thumbnailUrl),
      imageUrls: pageRecord.imageUrl ? [pageRecord.imageUrl] : [],
      officialProductUrl: cleanNullable(pageRecord.officialUrl),
      status: "draft",
      sourceKind: "lcf_catalog",
      sourceReference,
      createdByAccountId: accountId,
    });
  }

  await db.insert(lcmBrandEventParticipations).values({
    brandProfileId: brandId,
    eventKey: "2026-01",
    eventLabel: "第1回LCF 出展実績",
    archivePath: "/livecommercefestival/2026/exhibitors",
    verificationSource: "lcf_catalog",
    sourceReference: `catalog-page-${primaryBrandPage}`,
    verifiedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      eventLabel: "第1回LCF 出展実績",
      archivePath: "/livecommercefestival/2026/exhibitors",
      verificationSource: "lcf_catalog",
      sourceReference: `catalog-page-${primaryBrandPage}`,
      verifiedAt: new Date(),
    },
  });

  await writeAudit({
    actorAccountId: accountId,
    actorRole: "member",
    entityType: "brand_claim",
    entityId: brandId,
    action: "provisional_access_granted",
    after: { sourceCatalogPage: primaryBrandPage, companyName: identity.companyName, brandName: identity.brandName, status: memberStatus || "pending", draftEditing: true, message: message || null },
  }, db);
  return { brandId, memberId: Number(memberId), status: memberStatus || "pending", identity };
}

function assertUploadRateLimit(accountId: number) {
  const now = Date.now();
  const current = uploadRateLimits.get(accountId);
  if (!current || current.resetAt <= now) {
    uploadRateLimits.set(accountId, { count: 1, resetAt: now + 60 * 60_000 });
    return;
  }
  if (current.count >= 20) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "画像アップロード回数が多すぎます。時間をおいて再度お試しください" });
  }
  current.count += 1;
}

function imageMatchesMime(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });
  return db;
}

async function getCompanyAccountDefaults(db: any, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [application] = await db.select({
    id: festivalCompanyApplications.id,
    companyName: festivalCompanyApplications.companyName,
    contactName: festivalCompanyApplications.contactName,
  }).from(festivalCompanyApplications)
    .where(and(
      sql`LOWER(TRIM(${festivalCompanyApplications.email})) = ${normalizedEmail}`,
      notInArray(festivalCompanyApplications.status, ["rejected", "cancelled"]),
    ))
    .orderBy(desc(festivalCompanyApplications.id))
    .limit(1);
  if (!application) return null;
  return {
    sourceFestivalApplicationId: application.id,
    displayName: cleanNullable(application.contactName) || normalizedEmail.split("@")[0] || "LCF企業会員",
    businessName: cleanNullable(application.companyName),
  };
}

async function getLiverAccountDefaults(db: any, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [application] = await db.select({
    id: festivalLiverApplications.id,
    liverName: festivalLiverApplications.liverName,
    agency: festivalLiverApplications.agency,
    genre: festivalLiverApplications.genre,
  }).from(festivalLiverApplications)
    .where(and(
      sql`LOWER(TRIM(${festivalLiverApplications.email})) = ${normalizedEmail}`,
      notInArray(festivalLiverApplications.status, ["rejected", "cancelled"]),
    ))
    .orderBy(desc(festivalLiverApplications.id))
    .limit(1);
  if (!application) return null;
  return {
    sourceFestivalApplicationId: application.id,
    displayName: cleanNullable(application.liverName) || normalizedEmail.split("@")[0] || "LCFライブコマーサー",
    agencyName: cleanNullable(application.agency),
    categories: cleanNullable(application.genre) ? [cleanNullable(application.genre)!] : [],
  };
}

async function requireCreatorEligibility(db: any, account: { accountId: number; accountType: string; email: string }, membership: { memberType: string }) {
  const defaults = await getLiverAccountDefaults(db, account.email);
  if (account.accountType !== "liver" && membership.memberType !== "liver" && !defaults) {
    throw new TRPCError({ code: "FORBIDDEN", message: "LCFライブコマーサーアカウントだけが公式プロフィールを管理できます" });
  }
  return defaults;
}

async function requireBrandEligibility(db: any, account: { accountId: number; accountType: string; email: string }, membership: { memberType: string }) {
  if (membership.memberType === "company" || membership.memberType === "agency") return;
  const defaults = await getCompanyAccountDefaults(db, account.email);
  if (!defaults) {
    throw new TRPCError({ code: "FORBIDDEN", message: "LCF企業アカウントまたはLCM企業・ブランド会員だけがブランドを管理できます" });
  }
}

const lcmUserProcedure = t.procedure.use(async ({ ctx, next }) => {
  const account = await verifyFestivalUserRequest(ctx.req);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "LCFログインが必要です" });
  return next({ ctx: { ...ctx, lcmAccount: account } as any });
});

const lcmMemberProcedure = t.procedure.use(async ({ ctx, next }) => {
  const account = await verifyFestivalUserRequest(ctx.req);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "LCFログインが必要です" });
  const db = await requireDb();
  const [membership] = await db.select().from(lcmMemberships)
    .where(eq(lcmMemberships.festivalAccountId, account.accountId)).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "LCMの無料利用登録が必要です" });
  if (membership.status !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "このLCMアカウントは現在利用できません。運営からの案内をご確認ください" });
  return next({ ctx: { ...ctx, lcmAccount: account, lcmMembership: membership } as any });
});

const lcmAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const admin = await verifyFestivalAdminRequest(ctx.req, (ctx as any).user);
  if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者権限が必要です" });
  return next({ ctx: { ...ctx, lcmAdmin: admin } as any });
});

async function writeAudit(params: {
  actorAccountId?: number | null;
  actorRole: string;
  entityType: string;
  entityId: string | number;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}, dbOverride?: any) {
  const db = dbOverride ?? await requireDb();
  await db.insert(lcmAuditLogs).values({
    actorAccountId: params.actorAccountId ?? null,
    actorRole: params.actorRole,
    entityType: params.entityType,
    entityId: String(params.entityId),
    action: params.action,
    beforeJson: params.before ?? null,
    afterJson: params.after ?? null,
  });
}

async function accountEmail(db: any, accountId: number): Promise<string | null> {
  const [account] = await db.select({ email: festivalAccounts.email }).from(festivalAccounts).where(eq(festivalAccounts.id, accountId)).limit(1);
  return cleanNullable(account?.email);
}

async function brandOwnerEmails(db: any, brandProfileId: number): Promise<string[]> {
  const rows = await db.select({ email: festivalAccounts.email })
    .from(lcmBrandMembers)
    .innerJoin(festivalAccounts, eq(lcmBrandMembers.festivalAccountId, festivalAccounts.id))
    .where(and(eq(lcmBrandMembers.brandProfileId, brandProfileId), eq(lcmBrandMembers.status, "active")));
  const emails: string[] = rows
    .map((row: { email?: unknown }) => typeof row.email === "string" ? row.email.trim().toLowerCase() : "")
    .filter((email: string) => email.length > 0);
  return [...new Set<string>(emails)];
}

async function notifyLcm(params: { to: string[]; subject: string; content: string; entityType: string; entityId: string | number }) {
  const recipients = [...new Set(params.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail({ to: recipients, subject: params.subject, content: params.content });
  } catch (error: any) {
    result = { success: false, errorCode: String(error?.code || error?.message || "send_exception").slice(0, 100) };
  }
  await writeAudit({ actorRole: "system", entityType: params.entityType, entityId: params.entityId, action: "email_notification", after: { recipientCount: recipients.length, success: result.success, provider: result.provider || null, errorCode: result.errorCode || null } });
  return { recipientCount: recipients.length, success: result.success, provider: result.provider || null, errorCode: result.errorCode || null };
}

async function getActiveBrandMember(festivalAccountId: number, brandProfileId: number) {
  const db = await requireDb();
  const [member] = await db.select().from(lcmBrandMembers).where(and(
    eq(lcmBrandMembers.festivalAccountId, festivalAccountId),
    eq(lcmBrandMembers.brandProfileId, brandProfileId),
    eq(lcmBrandMembers.status, "active"),
  )).limit(1);
  return member;
}

async function getDraftBrandMember(festivalAccountId: number, brandProfileId: number) {
  const db = await requireDb();
  const [member] = await db.select().from(lcmBrandMembers).where(and(
    eq(lcmBrandMembers.festivalAccountId, festivalAccountId),
    eq(lcmBrandMembers.brandProfileId, brandProfileId),
    inArray(lcmBrandMembers.status, ["pending", "active"]),
  )).limit(1);
  return member;
}

async function requireDraftBrandMember(festivalAccountId: number, brandProfileId: number) {
  const member = await getDraftBrandMember(festivalAccountId, brandProfileId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "このブランドの下書きを編集する権限がありません" });
  return member;
}

async function requireActiveBrandMember(festivalAccountId: number, brandProfileId: number) {
  const member = await getActiveBrandMember(festivalAccountId, brandProfileId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "この操作には有効なブランド管理権限が必要です" });
  return member;
}

export const LCM_SAMPLE_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["approved", "rejected"],
  approved: ["preparing"],
  preparing: ["shipped"],
  shipped: ["delivered"],
  delivered: ["live_scheduled", "completed"],
  live_scheduled: ["completed"],
  rejected: [], completed: [], cancelled: [],
};

export const LCM_WHOLESALE_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["reviewing", "accepted", "declined"],
  reviewing: ["accepted", "declined"],
  accepted: ["negotiating", "completed"],
  negotiating: ["completed", "declined"],
  declined: [], completed: [], cancelled: [],
};

function assertTransition(map: Record<string, readonly string[]>, from: string, to: string) {
  if (!map[from]?.includes(to)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${from} から ${to} へは変更できません` });
  }
}

const brandInput = z.object({
  displayName: z.string().trim().min(1).max(255),
  companyName: nullableText(255),
  category: nullableText(120),
  tagline: nullableText(500),
  description: nullableText(10_000),
  story: nullableText(20_000),
  logoUrl: nullableHttpsUrl,
  coverUrl: nullableHttpsUrl,
  officialWebsiteUrl: nullableHttpsUrl,
  tiktokShopUrl: nullableHttpsUrl,
  amazonUrl: nullableHttpsUrl,
  rakutenUrl: nullableHttpsUrl,
  otherSalesUrl: nullableHttpsUrl,
}).strict();

const productBaseInput = z.object({
  name: z.string().trim().min(1).max(500),
  sku: nullableText(120),
  category: nullableText(120),
  summary: nullableText(1000),
  description: nullableText(20_000),
  highlights: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
  thirtySecondPitch: nullableText(2000),
  demoInstructions: nullableText(5000),
  targetAudience: nullableText(2000),
  prohibitedClaims: nullableText(5000),
  relatedProductsText: nullableText(10_000),
  listPrice: z.number().min(0).max(999_999_999).optional().nullable(),
  taxMode: z.enum(["included", "excluded", "unknown"]).default("unknown"),
  wholesalePrice: z.number().min(0).max(999_999_999).optional().nullable(),
  wholesaleMinQuantity: z.number().int().min(1).max(1_000_000).optional().nullable(),
  wholesaleShippingTerms: nullableText(5000),
  wholesalePaymentTerms: nullableText(5000),
  wholesaleValidUntil: z.coerce.date().optional().nullable(),
  commissionRate: nullableText(50),
  sampleAvailable: z.boolean().default(false),
  sampleMonthlyLimit: z.number().int().min(1).max(100_000).optional().nullable(),
  sampleInstructions: nullableText(5000),
  stockDisclosure: z.enum(["hidden", "range", "exact"]).default("hidden"),
  stockQuantity: z.number().int().min(0).max(100_000_000).optional().nullable(),
  primaryImageUrl: nullableHttpsUrl,
  imageUrls: z.array(z.string().url().refine((value) => new URL(value).protocol === "https:", "HTTPS URLを入力してください")).max(10).optional(),
  officialProductUrl: nullableHttpsUrl,
  tiktokShopUrl: nullableHttpsUrl,
  amazonUrl: nullableHttpsUrl,
  rakutenUrl: nullableHttpsUrl,
}).strict();

const productInput = productBaseInput.superRefine((value, ctx) => {
  const wholesaleStarted = value.wholesalePrice != null || value.wholesaleMinQuantity != null
    || Boolean(cleanNullable(value.wholesaleShippingTerms)) || Boolean(cleanNullable(value.wholesalePaymentTerms));
  if (wholesaleStarted && value.wholesalePrice == null) ctx.addIssue({ code: "custom", path: ["wholesalePrice"], message: "卸価格を入力してください" });
  if (wholesaleStarted && value.wholesaleMinQuantity == null) ctx.addIssue({ code: "custom", path: ["wholesaleMinQuantity"], message: "最小発注数を入力してください" });
  if (wholesaleStarted && !cleanNullable(value.wholesaleShippingTerms)) ctx.addIssue({ code: "custom", path: ["wholesaleShippingTerms"], message: "送料条件を入力してください" });
  if (wholesaleStarted && !cleanNullable(value.wholesalePaymentTerms)) ctx.addIssue({ code: "custom", path: ["wholesalePaymentTerms"], message: "支払条件を入力してください" });
  if (value.sampleAvailable && value.sampleMonthlyLimit == null) ctx.addIssue({ code: "custom", path: ["sampleMonthlyLimit"], message: "月間サンプル上限を入力してください" });
});

function assertBrandPublishable(brand: {
  displayName?: string | null;
  description?: string | null;
  category?: string | null;
  coverUrl?: string | null;
}) {
  if (!brand.displayName || !brand.description || !brand.category || !brand.coverUrl) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ブランド名、カテゴリ、紹介文、カバー画像を入力してください" });
  }
}

function assertProductPublishable(product: {
  name?: string | null;
  category?: string | null;
  summary?: string | null;
  primaryImageUrl?: string | null;
  listPrice?: unknown;
  wholesalePrice?: unknown;
  wholesaleMinQuantity?: number | null;
  wholesaleShippingTerms?: string | null;
  wholesalePaymentTerms?: string | null;
  sampleAvailable?: boolean | null;
  sampleMonthlyLimit?: number | null;
}) {
  if (!product.name || !product.category || !product.summary || !product.primaryImageUrl || product.listPrice == null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "商品名、カテゴリ、要約、価格、メイン画像を入力してください" });
  }
  const wholesaleStarted = product.wholesalePrice != null || product.wholesaleMinQuantity != null
    || Boolean(product.wholesaleShippingTerms) || Boolean(product.wholesalePaymentTerms);
  if (wholesaleStarted && (product.wholesalePrice == null || product.wholesaleMinQuantity == null || !product.wholesaleShippingTerms || !product.wholesalePaymentTerms)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "卸価格、最小発注数、送料条件、支払条件をすべて入力してください" });
  }
  if (product.sampleAvailable && product.sampleMonthlyLimit == null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "月間サンプル上限を入力してください" });
  }
}

const followerRangeSchema = z.enum(["not_disclosed", "under_1k", "1k_10k", "10k_50k", "50k_100k", "100k_500k", "500k_plus"]);
const averageViewRangeSchema = z.enum(["not_disclosed", "under_50", "50_200", "200_500", "500_1000", "1000_plus"]);
const safeList = (maxItems: number, maxLength: number) => z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);
const creatorProfileInput = z.object({
  displayName: z.string().trim().min(1).max(255),
  profileImageUrl: nullableHttpsUrl,
  coverImageUrl: nullableHttpsUrl,
  bio: nullableText(10_000),
  categories: safeList(8, 80),
  supportsLive: z.boolean(),
  supportsShortVideo: z.boolean(),
  languages: safeList(8, 80),
  activityRegions: safeList(12, 80),
  agencyName: nullableText(255),
  tiktokUrl: nullablePlatformUrl("TikTok", ["tiktok.com"]),
  instagramUrl: nullablePlatformUrl("Instagram", ["instagram.com"]),
  youtubeUrl: nullablePlatformUrl("YouTube", ["youtube.com", "youtu.be"]),
  portfolioUrls: z.array(z.string().url().refine((value) => new URL(value).protocol === "https:", "HTTPS URLを入力してください")).max(8),
  followerRange: followerRangeSchema,
  averageViewRange: averageViewRangeSchema,
  performanceSummary: nullableText(5000),
  metricsAsOf: z.coerce.date().optional().nullable(),
  availabilityNote: nullableText(5000),
  acceptingOffers: z.boolean(),
}).strict();

const publicCreatorFields = {
  id: lcmCreatorProfiles.id,
  slug: lcmCreatorProfiles.slug,
  displayName: lcmCreatorProfiles.displayName,
  profileImageUrl: lcmCreatorProfiles.profileImageUrl,
  coverImageUrl: lcmCreatorProfiles.coverImageUrl,
  bio: lcmCreatorProfiles.bio,
  categories: lcmCreatorProfiles.categories,
  supportsLive: lcmCreatorProfiles.supportsLive,
  supportsShortVideo: lcmCreatorProfiles.supportsShortVideo,
  languages: lcmCreatorProfiles.languages,
  activityRegions: lcmCreatorProfiles.activityRegions,
  agencyName: lcmCreatorProfiles.agencyName,
  tiktokUrl: lcmCreatorProfiles.tiktokUrl,
  instagramUrl: lcmCreatorProfiles.instagramUrl,
  youtubeUrl: lcmCreatorProfiles.youtubeUrl,
  portfolioUrls: lcmCreatorProfiles.portfolioUrls,
  followerRange: lcmCreatorProfiles.followerRange,
  averageViewRange: lcmCreatorProfiles.averageViewRange,
  performanceSummary: lcmCreatorProfiles.performanceSummary,
  metricsVerification: lcmCreatorProfiles.metricsVerification,
  metricsAsOf: lcmCreatorProfiles.metricsAsOf,
  availabilityNote: lcmCreatorProfiles.availabilityNote,
  acceptingOffers: lcmCreatorProfiles.acceptingOffers,
  publishedAt: lcmCreatorProfiles.publishedAt,
} as const;

const publicProductFields = {
  id: lcmProducts.id,
  slug: lcmProducts.slug,
  name: lcmProducts.name,
  category: lcmProducts.category,
  summary: lcmProducts.summary,
  description: lcmProducts.description,
  highlights: lcmProducts.highlights,
  thirtySecondPitch: lcmProducts.thirtySecondPitch,
  demoInstructions: lcmProducts.demoInstructions,
  targetAudience: lcmProducts.targetAudience,
  prohibitedClaims: lcmProducts.prohibitedClaims,
  relatedProductsText: lcmProducts.relatedProductsText,
  listPrice: lcmProducts.listPrice,
  currency: lcmProducts.currency,
  taxMode: lcmProducts.taxMode,
  sampleAvailable: lcmProducts.sampleAvailable,
  primaryImageUrl: lcmProducts.primaryImageUrl,
  imageUrls: lcmProducts.imageUrls,
  officialProductUrl: lcmProducts.officialProductUrl,
  tiktokShopUrl: lcmProducts.tiktokShopUrl,
  amazonUrl: lcmProducts.amazonUrl,
  rakutenUrl: lcmProducts.rakutenUrl,
  publishedAt: lcmProducts.publishedAt,
  brandId: lcmBrandProfiles.id,
  brandSlug: lcmBrandProfiles.slug,
  brandName: lcmBrandProfiles.displayName,
  brandLogoUrl: lcmBrandProfiles.logoUrl,
} as const;

async function getEventBadgesByBrand(db: any, brandIds: number[]) {
  const result = new Map<number, Array<{ eventKey: string; eventLabel: string; archivePath: string }>>();
  if (!brandIds.length) return result;
  const rows = await db.select({
    brandProfileId: lcmBrandEventParticipations.brandProfileId,
    eventKey: lcmBrandEventParticipations.eventKey,
    eventLabel: lcmBrandEventParticipations.eventLabel,
    archivePath: lcmBrandEventParticipations.archivePath,
  }).from(lcmBrandEventParticipations)
    .where(inArray(lcmBrandEventParticipations.brandProfileId, brandIds))
    .orderBy(desc(lcmBrandEventParticipations.eventKey));
  for (const row of rows) {
    const badges = result.get(row.brandProfileId) || [];
    badges.push({ eventKey: row.eventKey, eventLabel: row.eventLabel, archivePath: row.archivePath });
    result.set(row.brandProfileId, badges);
  }
  return result;
}

type PublicProductEnrichment = {
  interestCount: number;
  reviewCount: number;
  averageRating: number | null;
  eventBadges: Array<{ eventKey: string; eventLabel: string; archivePath: string }>;
  brandOfficiallyLinked: boolean;
};

async function enrichPublicProducts<T extends { id: number; brandId: number }>(db: any, products: T[]): Promise<Array<T & PublicProductEnrichment>> {
  const productIds = [...new Set(products.map((item) => Number(item.id)).filter(Boolean))];
  const brandIds = [...new Set(products.map((item) => Number(item.brandId)).filter(Boolean))];
  const [interestRows, reviewRows, linkedBrandRows, eventBadges] = await Promise.all([
    productIds.length
      ? db.select({ productId: lcmProductInterests.productId, count: sql<number>`count(*)` }).from(lcmProductInterests)
        .where(inArray(lcmProductInterests.productId, productIds)).groupBy(lcmProductInterests.productId)
      : [],
    productIds.length
      ? db.select({ productId: lcmProductReviews.productId, count: sql<number>`count(*)`, averageRating: sql<string>`ROUND(AVG(${lcmProductReviews.rating}), 1)` }).from(lcmProductReviews)
        .where(and(inArray(lcmProductReviews.productId, productIds), eq(lcmProductReviews.status, "published"))).groupBy(lcmProductReviews.productId)
      : [],
    brandIds.length
      ? db.select({ brandProfileId: lcmBrandMembers.brandProfileId }).from(lcmBrandMembers)
        .where(and(inArray(lcmBrandMembers.brandProfileId, brandIds), eq(lcmBrandMembers.status, "active"))).groupBy(lcmBrandMembers.brandProfileId)
      : [],
    getEventBadgesByBrand(db, brandIds),
  ]);
  const interests = new Map<number, number>(interestRows.map((row: any) => [Number(row.productId), Number(row.count || 0)] as [number, number]));
  const reviews = new Map<number, { count: number; averageRating: number | null }>(reviewRows.map((row: any) => [
    Number(row.productId),
    { count: Number(row.count || 0), averageRating: row.averageRating == null ? null : Number(row.averageRating) },
  ] as [number, { count: number; averageRating: number | null }]));
  const linkedBrandIds = new Set(linkedBrandRows.map((row: any) => Number(row.brandProfileId)));
  return products.map((product): T & PublicProductEnrichment => ({
    ...product,
    interestCount: interests.get(Number(product.id)) || 0,
    reviewCount: reviews.get(Number(product.id))?.count || 0,
    averageRating: reviews.get(Number(product.id))?.averageRating ?? null,
    eventBadges: eventBadges.get(Number(product.brandId)) || [],
    brandOfficiallyLinked: linkedBrandIds.has(Number(product.brandId)),
  }));
}

async function getReviewEligibility(db: any, productId: number, accountId: number) {
  const [ownBrand] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers)
    .innerJoin(lcmProducts, eq(lcmBrandMembers.brandProfileId, lcmProducts.brandProfileId))
    .where(and(eq(lcmProducts.id, productId), eq(lcmBrandMembers.festivalAccountId, accountId)))
    .limit(1);
  if (ownBrand) return { canReview: false as const, reason: "自社商品にはレビューできません", verificationSource: null, verificationEntityId: null };

  const [sample] = await db.select({ id: lcmSampleRequests.id }).from(lcmSampleRequests)
    .where(and(eq(lcmSampleRequests.productId, productId), eq(lcmSampleRequests.requesterAccountId, accountId), inArray(lcmSampleRequests.status, ["delivered", "live_scheduled", "completed"])))
    .orderBy(desc(lcmSampleRequests.updatedAt)).limit(1);
  if (sample) return { canReview: true as const, reason: null, verificationSource: "sample_request" as const, verificationEntityId: Number(sample.id) };

  const [inquiry] = await db.select({ id: lcmWholesaleInquiries.id }).from(lcmWholesaleInquiries)
    .where(and(eq(lcmWholesaleInquiries.productId, productId), eq(lcmWholesaleInquiries.requesterAccountId, accountId), inArray(lcmWholesaleInquiries.status, ["accepted", "negotiating", "completed"])))
    .orderBy(desc(lcmWholesaleInquiries.updatedAt)).limit(1);
  if (inquiry) return { canReview: true as const, reason: null, verificationSource: "wholesale_inquiry" as const, verificationEntityId: Number(inquiry.id) };
  return { canReview: false as const, reason: "サンプル受取または取引確認後にレビューできます", verificationSource: null, verificationEntityId: null };
}

export const lcmRouter = router({
  publicStats: publicProcedure.query(async () => {
    const db = await requireDb();
    const [brands] = await db.select({ count: sql<number>`count(*)` }).from(lcmBrandProfiles)
      .where(eq(lcmBrandProfiles.status, "published"));
    const [products] = await db.select({ count: sql<number>`count(*)` }).from(lcmProducts)
      .where(eq(lcmProducts.status, "published"));
    return { brandCount: Number(brands?.count || 0), productCount: Number(products?.count || 0) };
  }),

  listPublicBrands: publicProcedure
    .input(z.object({ query: z.string().trim().max(200).optional(), category: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(100).default(60) }).optional())
    .query(async ({ input }) => {
      const db = await requireDb();
      const conditions: any[] = [eq(lcmBrandProfiles.status, "published")];
      if (input?.category) conditions.push(eq(lcmBrandProfiles.category, input.category));
      if (input?.query) {
        const q = `%${input.query}%`;
        conditions.push(or(like(lcmBrandProfiles.displayName, q), like(lcmBrandProfiles.companyName, q), like(lcmBrandProfiles.description, q))!);
      }
      return db.select({
        id: lcmBrandProfiles.id, slug: lcmBrandProfiles.slug, displayName: lcmBrandProfiles.displayName,
        companyName: lcmBrandProfiles.companyName, category: lcmBrandProfiles.category, tagline: lcmBrandProfiles.tagline,
        description: lcmBrandProfiles.description, logoUrl: lcmBrandProfiles.logoUrl, coverUrl: lcmBrandProfiles.coverUrl,
        claimStatus: lcmBrandProfiles.claimStatus, publishedAt: lcmBrandProfiles.publishedAt,
      }).from(lcmBrandProfiles).where(and(...conditions)).orderBy(desc(lcmBrandProfiles.publishedAt)).limit(input?.limit ?? 60);
    }),

  listPublicProducts: publicProcedure
    .input(z.object({ query: z.string().trim().max(200).optional(), category: z.string().trim().max(120).optional(), sampleAvailable: z.boolean().optional(), limit: z.number().int().min(1).max(100).default(60) }).optional())
    .query(async ({ input }) => {
      const db = await requireDb();
      const conditions: any[] = [eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published")];
      if (input?.category) conditions.push(eq(lcmProducts.category, input.category));
      if (input?.sampleAvailable != null) conditions.push(eq(lcmProducts.sampleAvailable, input.sampleAvailable));
      if (input?.query) {
        const q = `%${input.query}%`;
        conditions.push(or(like(lcmProducts.name, q), like(lcmProducts.summary, q), like(lcmProducts.description, q), like(lcmBrandProfiles.displayName, q))!);
      }
      const products = await db.select(publicProductFields).from(lcmProducts)
        .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
        .where(and(...conditions)).orderBy(desc(lcmProducts.publishedAt)).limit(input?.limit ?? 60);
      return enrichPublicProducts(db, products);
    }),

  getPublicBrand: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
    const db = await requireDb();
    const [brand] = await db.select({
      id: lcmBrandProfiles.id, slug: lcmBrandProfiles.slug, displayName: lcmBrandProfiles.displayName,
      companyName: lcmBrandProfiles.companyName, category: lcmBrandProfiles.category, tagline: lcmBrandProfiles.tagline,
      description: lcmBrandProfiles.description, story: lcmBrandProfiles.story, logoUrl: lcmBrandProfiles.logoUrl,
      coverUrl: lcmBrandProfiles.coverUrl, officialWebsiteUrl: lcmBrandProfiles.officialWebsiteUrl,
      tiktokShopUrl: lcmBrandProfiles.tiktokShopUrl, amazonUrl: lcmBrandProfiles.amazonUrl,
      rakutenUrl: lcmBrandProfiles.rakutenUrl, otherSalesUrl: lcmBrandProfiles.otherSalesUrl,
      claimStatus: lcmBrandProfiles.claimStatus, publishedAt: lcmBrandProfiles.publishedAt,
    }).from(lcmBrandProfiles).where(and(eq(lcmBrandProfiles.slug, input.slug), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    const products = await db.select(publicProductFields).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.brandProfileId, brand.id), eq(lcmProducts.status, "published")))
      .orderBy(asc(lcmProducts.name));
    const [enrichedProducts, eventBadges, [activeMember]] = await Promise.all([
      enrichPublicProducts(db, products),
      getEventBadgesByBrand(db, [brand.id]),
      db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(eq(lcmBrandMembers.brandProfileId, brand.id), eq(lcmBrandMembers.status, "active"))).limit(1),
    ]);
    return { ...brand, officiallyLinked: Boolean(activeMember), eventBadges: eventBadges.get(brand.id) || [], products: enrichedProducts };
  }),

  getPublicProduct: publicProcedure.input(z.object({ slug: z.string().min(1).max(220) })).query(async ({ input }) => {
    const db = await requireDb();
    const [product] = await db.select(publicProductFields).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.slug, input.slug), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    const [[enriched], reviews] = await Promise.all([
      enrichPublicProducts(db, [product]),
      db.select({
        id: lcmProductReviews.id,
        rating: lcmProductReviews.rating,
        title: lcmProductReviews.title,
        body: lcmProductReviews.body,
        verificationSource: lcmProductReviews.verificationSource,
        publishedAt: lcmProductReviews.publishedAt,
        reviewerType: lcmMemberships.memberType,
      }).from(lcmProductReviews)
        .innerJoin(lcmMemberships, eq(lcmProductReviews.reviewerAccountId, lcmMemberships.festivalAccountId))
        .where(and(eq(lcmProductReviews.productId, product.id), eq(lcmProductReviews.status, "published")))
        .orderBy(desc(lcmProductReviews.publishedAt))
        .limit(100),
    ]);
    return { ...enriched, reviews };
  }),

  listPublicCreators: publicProcedure.input(z.object({
    query: z.string().trim().max(200).optional(),
    category: z.string().trim().max(80).optional(),
    contentType: z.enum(["live", "short_video"]).optional(),
    language: z.string().trim().max(80).optional(),
    agencyType: z.enum(["agency", "independent"]).optional(),
    acceptingOffers: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(60),
  }).optional()).query(async ({ input }) => {
    const db = await requireDb();
    const conditions: any[] = [eq(lcmCreatorProfiles.status, "published"), isNotNull(lcmCreatorProfiles.publicConsentAt)];
    if (input?.query) {
      const q = `%${input.query}%`;
      conditions.push(or(like(lcmCreatorProfiles.displayName, q), like(lcmCreatorProfiles.bio, q), like(lcmCreatorProfiles.agencyName, q))!);
    }
    if (input?.category) conditions.push(sql`JSON_CONTAINS(${lcmCreatorProfiles.categories}, JSON_QUOTE(${input.category})) = 1`);
    if (input?.language) conditions.push(sql`JSON_CONTAINS(${lcmCreatorProfiles.languages}, JSON_QUOTE(${input.language})) = 1`);
    if (input?.contentType === "live") conditions.push(eq(lcmCreatorProfiles.supportsLive, true));
    if (input?.contentType === "short_video") conditions.push(eq(lcmCreatorProfiles.supportsShortVideo, true));
    if (input?.agencyType === "agency") conditions.push(sql`${lcmCreatorProfiles.agencyName} IS NOT NULL AND TRIM(${lcmCreatorProfiles.agencyName}) <> ''`);
    if (input?.agencyType === "independent") conditions.push(sql`${lcmCreatorProfiles.agencyName} IS NULL OR TRIM(${lcmCreatorProfiles.agencyName}) = ''`);
    if (input?.acceptingOffers != null) conditions.push(eq(lcmCreatorProfiles.acceptingOffers, input.acceptingOffers));
    return db.select(publicCreatorFields).from(lcmCreatorProfiles).where(and(...conditions)).orderBy(desc(lcmCreatorProfiles.publishedAt)).limit(input?.limit ?? 60);
  }),

  getPublicCreator: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
    const db = await requireDb();
    const [profile] = await db.select(publicCreatorFields).from(lcmCreatorProfiles).where(and(
      eq(lcmCreatorProfiles.slug, input.slug),
      eq(lcmCreatorProfiles.status, "published"),
      isNotNull(lcmCreatorProfiles.publicConsentAt),
    )).limit(1);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "ライブコマーサープロフィールが見つかりません" });
    return profile;
  }),

  getMyAccess: lcmUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [membership] = await db.select().from(lcmMemberships)
      .where(eq(lcmMemberships.festivalAccountId, ctx.lcmAccount.accountId)).limit(1);
    const brands = membership?.status === "approved"
      ? await db.select({ member: lcmBrandMembers, brand: lcmBrandProfiles }).from(lcmBrandMembers)
        .innerJoin(lcmBrandProfiles, eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id))
        .where(eq(lcmBrandMembers.festivalAccountId, ctx.lcmAccount.accountId))
      : [];
    const companyAccountDefaults = await getCompanyAccountDefaults(db, ctx.lcmAccount.email);
    const liverAccountDefaults = await getLiverAccountDefaults(db, ctx.lcmAccount.email);
    const [creatorProfile] = membership?.status === "approved"
      ? await db.select().from(lcmCreatorProfiles).where(eq(lcmCreatorProfiles.festivalAccountId, ctx.lcmAccount.accountId)).limit(1)
      : [];
    return {
      account: ctx.lcmAccount,
      membership: membership ?? null,
      brands,
      creatorProfile: creatorProfile ?? null,
      companyAccountLink: companyAccountDefaults
        ? { eligible: true as const, ...companyAccountDefaults }
        : ctx.lcmAccount.accountType === "company"
          ? { eligible: true as const, sourceFestivalApplicationId: null, displayName: ctx.lcmAccount.displayName, businessName: null }
          : null,
      liverAccountLink: liverAccountDefaults
        ? { eligible: true as const, ...liverAccountDefaults }
        : ctx.lcmAccount.accountType === "liver"
          ? { eligible: true as const, sourceFestivalApplicationId: null, displayName: ctx.lcmAccount.displayName, agencyName: null, categories: [] }
          : null,
      roles: {
        event: true as const,
        brand: Boolean(ctx.lcmAccount.accountType === "company" || companyAccountDefaults || membership?.memberType === "company" || membership?.memberType === "agency" || brands.length),
        creator: Boolean(ctx.lcmAccount.accountType === "liver" || liverAccountDefaults || membership?.memberType === "liver" || creatorProfile),
      },
    };
  }),

  applyMembership: lcmUserProcedure.input(z.object({
    memberType: z.enum(["company", "liver", "agency", "buyer"]),
    displayName: z.string().trim().min(1).max(255),
    businessName: nullableText(255),
    termsAccepted: z.literal(true),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [existing] = await db.select().from(lcmMemberships)
      .where(eq(lcmMemberships.festivalAccountId, ctx.lcmAccount.accountId)).limit(1);
    if (existing?.status === "approved" || existing?.status === "suspended" || existing?.status === "rejected") {
      return { success: true, status: existing.status, notification: null, existing: true };
    }
    const companyDefaults = await getCompanyAccountDefaults(db, ctx.lcmAccount.email);
    const liverDefaults = await getLiverAccountDefaults(db, ctx.lcmAccount.email);
    const linkedCompanyAccount = (Boolean(companyDefaults) || ctx.lcmAccount.accountType === "company") && (input.memberType === "company" || input.memberType === "agency");
    const linkedLiverAccount = (Boolean(liverDefaults) || ctx.lcmAccount.accountType === "liver") && input.memberType === "liver";
    const memberType = linkedLiverAccount ? "liver" as const : linkedCompanyAccount ? "company" as const : input.memberType;
    const displayName = linkedCompanyAccount ? companyDefaults?.displayName || input.displayName : linkedLiverAccount ? liverDefaults?.displayName || input.displayName : input.displayName;
    const businessName = linkedCompanyAccount ? companyDefaults?.businessName || cleanNullable(input.businessName) : cleanNullable(input.businessName);
    const linkedExistingAccount = linkedCompanyAccount || linkedLiverAccount;
    const status = "approved" as const;
    const activationNote = linkedExistingAccount
      ? memberType === "liver" ? "LCFライブコマーサーアカウント連携" : "LCF企業アカウント連携"
      : "本人登録・利用条件同意により即時利用開始";
    let membershipId: number;
    if (existing) {
      membershipId = existing.id;
      await db.update(lcmMemberships).set({ memberType, displayName, businessName, status, termsVersion: LCM_TERMS_VERSION, agreedAt: new Date(), reviewedBy: null, reviewedAt: new Date(), reviewNote: activationNote }).where(eq(lcmMemberships.id, existing.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "membership", entityId: existing.id, action: linkedExistingAccount ? (memberType === "liver" ? "liver_account_activated" : "company_account_activated") : "self_activated", before: { status: existing.status }, after: { status, memberType, termsVersion: LCM_TERMS_VERSION } });
    } else {
      const result = await db.insert(lcmMemberships).values({ festivalAccountId: ctx.lcmAccount.accountId, memberType, displayName, businessName, status, termsVersion: LCM_TERMS_VERSION, agreedAt: new Date(), reviewedAt: new Date(), reviewNote: activationNote });
      membershipId = insertedId(result);
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "membership", entityId: membershipId, action: linkedExistingAccount ? (memberType === "liver" ? "liver_account_activated" : "company_account_activated") : "self_activated", after: { status, memberType, termsVersion: LCM_TERMS_VERSION } });
    }
    const notification = await notifyLcm({
      to: [ctx.lcmAccount.email],
      subject: memberType === "liver"
        ? "【LCM】ライブコマーサー会員の利用を開始しました"
        : memberType === "buyer"
          ? "【LCM】会員利用を開始しました"
          : "【LCM】無料ブランド登録を開始しました",
      content: memberType === "liver"
        ? `LCMライブコマーサー会員として利用できるようになりました。\n\n公式プロフィールの作成を開始できます。プロフィール公開は、本人の公開同意と運営確認後に行われます。\n${LCM_BASE_URL}/manage?creator=profile`
        : memberType === "buyer"
          ? `LCM会員として利用できるようになりました。\n\n公開商品の検索、会員限定取引条件の確認、サンプル申請、卸商談をご利用いただけます。\n${LCM_BASE_URL}`
          : `LCMのブランド登録・商品登録を無料で開始できます。\n\nブランドページを作成し、必須項目を入力して公開した後、続けて商品ページを登録してください。公開後に問題が確認された場合は、運営が非公開または利用停止にすることがあります。\n${LCM_BASE_URL}/manage?workspace=brand`,
      entityType: "membership",
      entityId: membershipId,
    });
    return { success: true, status, notification, existing: false };
  }),

  saveCreatorProfile: lcmMemberProcedure.input(creatorProfileInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const defaults = await requireCreatorEligibility(db, ctx.lcmAccount, ctx.lcmMembership);
    const [before] = await db.select().from(lcmCreatorProfiles).where(eq(lcmCreatorProfiles.festivalAccountId, ctx.lcmAccount.accountId)).limit(1);
    const values = {
      displayName: input.displayName,
      profileImageUrl: cleanNullable(input.profileImageUrl),
      coverImageUrl: cleanNullable(input.coverImageUrl),
      bio: cleanNullable(input.bio),
      categories: input.categories,
      supportsLive: input.supportsLive,
      supportsShortVideo: input.supportsShortVideo,
      languages: input.languages,
      activityRegions: input.activityRegions,
      agencyName: cleanNullable(input.agencyName),
      tiktokUrl: cleanNullable(input.tiktokUrl),
      instagramUrl: cleanNullable(input.instagramUrl),
      youtubeUrl: cleanNullable(input.youtubeUrl),
      portfolioUrls: input.portfolioUrls,
      followerRange: input.followerRange,
      averageViewRange: input.averageViewRange,
      performanceSummary: cleanNullable(input.performanceSummary),
      metricsAsOf: input.metricsAsOf ?? null,
      availabilityNote: cleanNullable(input.availabilityNote),
      acceptingOffers: input.acceptingOffers,
    };
    if (before) {
      await db.update(lcmCreatorProfiles).set({
        ...values,
        status: before.status === "published" ? "submitted" : before.status,
        submittedAt: before.status === "published" ? new Date() : before.submittedAt,
        rejectionReason: null,
        metricsVerification: input.performanceSummary ? "self_reported" : "not_submitted",
      }).where(eq(lcmCreatorProfiles.id, before.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "creator", entityType: "creator_profile", entityId: before.id, action: "updated", before: { status: before.status }, after: { fields: Object.keys(values) } });
      return { success: true, profileId: before.id, slug: before.slug };
    }
    const slug = `${slugify(input.displayName)}-${nanoid(7).toLowerCase()}`;
    const result = await db.insert(lcmCreatorProfiles).values({
      ...values,
      festivalAccountId: ctx.lcmAccount.accountId,
      sourceFestivalApplicationId: defaults?.sourceFestivalApplicationId ?? null,
      slug,
      status: "draft",
      metricsVerification: input.performanceSummary ? "self_reported" : "not_submitted",
    });
    const profileId = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "creator", entityType: "creator_profile", entityId: profileId, action: "created", after: { status: "draft" } });
    return { success: true, profileId, slug };
  }),

  submitCreatorProfile: lcmMemberProcedure.input(z.object({ publicConsent: z.literal(true) }).strict()).mutation(async ({ ctx }) => {
    const db = await requireDb();
    await requireCreatorEligibility(db, ctx.lcmAccount, ctx.lcmMembership);
    const [profile] = await db.select().from(lcmCreatorProfiles).where(eq(lcmCreatorProfiles.festivalAccountId, ctx.lcmAccount.accountId)).limit(1);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "ライブコマーサープロフィールを先に保存してください" });
    if (!profile.displayName || !profile.profileImageUrl || !profile.bio || !(profile.categories || []).length || !profile.tiktokUrl || (!profile.supportsLive && !profile.supportsShortVideo)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "活動名、写真、自己紹介、カテゴリ、TikTok URL、対応形式を入力してください" });
    }
    await db.update(lcmCreatorProfiles).set({ status: "submitted", publicConsentAt: new Date(), submittedAt: new Date(), rejectionReason: null }).where(eq(lcmCreatorProfiles.id, profile.id));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "creator", entityType: "creator_profile", entityId: profile.id, action: "submitted", before: { status: profile.status }, after: { status: "submitted", publicConsent: true } });
    return { success: true };
  }),

  uploadCreatorImage: lcmMemberProcedure.input(z.object({ fileName: z.string().trim().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64Data: z.string().min(1).max(7_500_000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireCreatorEligibility(db, ctx.lcmAccount, ctx.lcmMembership);
    assertUploadRateLimit(ctx.lcmAccount.accountId);
    const buffer = Buffer.from(input.base64Data, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "画像は5MB以下にしてください" });
    if (!imageMatchesMime(buffer, input.contentType)) throw new TRPCError({ code: "BAD_REQUEST", message: "画像ファイルの内容を確認してください" });
    const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
    const key = `lcm/creators/${ctx.lcmAccount.accountId}/${Date.now()}-${nanoid(10)}.${ext}`;
    const result = await storagePut(key, buffer, input.contentType);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "creator", entityType: "creator_asset", entityId: key, action: "uploaded", after: { contentType: input.contentType, bytes: buffer.length } });
    return { key: result.key, url: result.url };
  }),

  getWholesaleTerms: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const [product] = await db.select({
      id: lcmProducts.id, brandProfileId: lcmProducts.brandProfileId, wholesalePrice: lcmProducts.wholesalePrice,
      wholesaleMinQuantity: lcmProducts.wholesaleMinQuantity, wholesaleShippingTerms: lcmProducts.wholesaleShippingTerms,
      wholesalePaymentTerms: lcmProducts.wholesalePaymentTerms, wholesaleValidUntil: lcmProducts.wholesaleValidUntil,
      commissionRate: lcmProducts.commissionRate,
    }).from(lcmProducts).where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    return product;
  }),

  getMemberProduct: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const [product] = await db.select({
      ...publicProductFields,
      wholesalePrice: lcmProducts.wholesalePrice,
      wholesaleMinQuantity: lcmProducts.wholesaleMinQuantity,
      wholesaleShippingTerms: lcmProducts.wholesaleShippingTerms,
      wholesalePaymentTerms: lcmProducts.wholesalePaymentTerms,
      wholesaleValidUntil: lcmProducts.wholesaleValidUntil,
      commissionRate: lcmProducts.commissionRate,
      sampleMonthlyLimit: lcmProducts.sampleMonthlyLimit,
      sampleInstructions: lcmProducts.sampleInstructions,
      stockDisclosure: lcmProducts.stockDisclosure,
      stockQuantity: lcmProducts.stockQuantity,
    }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published")))
      .limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    return product;
  }),

  getMyProductEngagement: lcmUserProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select({ id: lcmProducts.id }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    const [[interest], [cartItem], [review], [membership]] = await Promise.all([
      db.select({ id: lcmProductInterests.id }).from(lcmProductInterests).where(and(eq(lcmProductInterests.productId, input.productId), eq(lcmProductInterests.festivalAccountId, ctx.lcmAccount.accountId))).limit(1),
      db.select({ id: lcmSampleCartItems.id }).from(lcmSampleCartItems).where(and(eq(lcmSampleCartItems.productId, input.productId), eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId))).limit(1),
      db.select().from(lcmProductReviews).where(and(eq(lcmProductReviews.productId, input.productId), eq(lcmProductReviews.reviewerAccountId, ctx.lcmAccount.accountId))).limit(1),
      db.select({ status: lcmMemberships.status }).from(lcmMemberships).where(eq(lcmMemberships.festivalAccountId, ctx.lcmAccount.accountId)).limit(1),
    ]);
    const eligibility = membership?.status === "approved"
      ? await getReviewEligibility(db, input.productId, ctx.lcmAccount.accountId)
      : { canReview: false as const, reason: "LCM利用登録後にレビュー資格を確認できます", verificationSource: null, verificationEntityId: null };
    const [cartCountRow] = await db.select({ count: sql<number>`count(*)` }).from(lcmSampleCartItems).where(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId));
    return { interested: Boolean(interest), inSampleCart: Boolean(cartItem), sampleCartCount: Number(cartCountRow?.count || 0), review: review ?? null, eligibility };
  }),

  getMyEngagementSummary: lcmUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [interests, sampleCart] = await Promise.all([
      db.select({ productId: lcmProductInterests.productId }).from(lcmProductInterests).where(eq(lcmProductInterests.festivalAccountId, ctx.lcmAccount.accountId)),
      db.select({ productId: lcmSampleCartItems.productId }).from(lcmSampleCartItems).where(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId)),
    ]);
    return {
      interestedProductIds: interests.map((item) => Number(item.productId)),
      sampleCartProductIds: sampleCart.map((item) => Number(item.productId)),
      sampleCartCount: sampleCart.length,
    };
  }),

  toggleProductInterest: lcmUserProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select({ id: lcmProducts.id }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    const [existing] = await db.select({ id: lcmProductInterests.id }).from(lcmProductInterests)
      .where(and(eq(lcmProductInterests.productId, input.productId), eq(lcmProductInterests.festivalAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (existing) {
      await db.delete(lcmProductInterests).where(eq(lcmProductInterests.id, existing.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "product_interest", entityId: existing.id, action: "removed", before: { productId: input.productId } });
      return { interested: false };
    }
    const result = await db.insert(lcmProductInterests).values({ productId: input.productId, festivalAccountId: ctx.lcmAccount.accountId });
    const id = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "product_interest", entityId: id, action: "added", after: { productId: input.productId } });
    return { interested: true };
  }),

  toggleSampleCart: lcmUserProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [existing] = await db.select({ id: lcmSampleCartItems.id }).from(lcmSampleCartItems)
      .where(and(eq(lcmSampleCartItems.productId, input.productId), eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (existing) {
      await db.delete(lcmSampleCartItems).where(eq(lcmSampleCartItems.id, existing.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "sample_cart", entityId: existing.id, action: "removed", before: { productId: input.productId } });
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(lcmSampleCartItems).where(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId));
      return { inSampleCart: false, sampleCartCount: Number(countRow?.count || 0) };
    }
    const [product] = await db.select({ id: lcmProducts.id, sampleAvailable: lcmProducts.sampleAvailable }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product || !product.sampleAvailable) throw new TRPCError({ code: "BAD_REQUEST", message: "この商品は現在サンプルカートに追加できません" });
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(lcmSampleCartItems).where(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId));
    const currentCount = Number(countRow?.count || 0);
    if (currentCount >= 20) throw new TRPCError({ code: "BAD_REQUEST", message: "サンプルカートは20商品までです" });
    const result = await db.insert(lcmSampleCartItems).values({ productId: input.productId, festivalAccountId: ctx.lcmAccount.accountId });
    const id = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "sample_cart", entityId: id, action: "added", after: { productId: input.productId } });
    return { inSampleCart: true, sampleCartCount: currentCount + 1 };
  }),

  listMySampleCart: lcmUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select({
      cartItemId: lcmSampleCartItems.id,
      addedAt: lcmSampleCartItems.createdAt,
      productId: lcmProducts.id,
      productSlug: lcmProducts.slug,
      productName: lcmProducts.name,
      listPrice: lcmProducts.listPrice,
      taxMode: lcmProducts.taxMode,
      primaryImageUrl: lcmProducts.primaryImageUrl,
      sampleAvailable: lcmProducts.sampleAvailable,
      productStatus: lcmProducts.status,
      brandStatus: lcmBrandProfiles.status,
      brandName: lcmBrandProfiles.displayName,
    }).from(lcmSampleCartItems)
      .innerJoin(lcmProducts, eq(lcmSampleCartItems.productId, lcmProducts.id))
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId))
      .orderBy(desc(lcmSampleCartItems.createdAt));
  }),

  listMyInterests: lcmUserProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const products = await db.select({
      ...publicProductFields,
      interestedAt: lcmProductInterests.createdAt,
    }).from(lcmProductInterests)
      .innerJoin(lcmProducts, eq(lcmProductInterests.productId, lcmProducts.id))
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProductInterests.festivalAccountId, ctx.lcmAccount.accountId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published")))
      .orderBy(desc(lcmProductInterests.createdAt));
    return enrichPublicProducts(db, products);
  }),

  saveProductReview: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive(), rating: z.number().int().min(1).max(5), title: z.string().trim().min(3).max(120), body: z.string().trim().min(20).max(2000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select({ id: lcmProducts.id, brandProfileId: lcmProducts.brandProfileId }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    const eligibility = await getReviewEligibility(db, input.productId, ctx.lcmAccount.accountId);
    if (!eligibility.canReview || !eligibility.verificationSource || !eligibility.verificationEntityId) throw new TRPCError({ code: "FORBIDDEN", message: eligibility.reason || "レビュー資格を確認できません" });
    const [existing] = await db.select().from(lcmProductReviews).where(and(eq(lcmProductReviews.productId, input.productId), eq(lcmProductReviews.reviewerAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (existing) {
      await db.update(lcmProductReviews).set({ rating: input.rating, title: input.title, body: input.body, verificationSource: eligibility.verificationSource, verificationEntityId: eligibility.verificationEntityId, status: "pending", submittedAt: new Date(), publishedAt: null, moderatedByAccountId: null, moderatedAt: null, moderationNote: null }).where(eq(lcmProductReviews.id, existing.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "product_review", entityId: existing.id, action: "resubmitted", before: { status: existing.status }, after: { productId: input.productId, rating: input.rating, status: "pending", verificationSource: eligibility.verificationSource } });
      return { success: true, reviewId: Number(existing.id), status: "pending" as const };
    }
    const result = await db.insert(lcmProductReviews).values({ productId: input.productId, brandProfileId: product.brandProfileId, reviewerAccountId: ctx.lcmAccount.accountId, rating: input.rating, title: input.title, body: input.body, verificationSource: eligibility.verificationSource, verificationEntityId: eligibility.verificationEntityId, status: "pending", submittedAt: new Date() });
    const reviewId = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "product_review", entityId: reviewId, action: "submitted", after: { productId: input.productId, rating: input.rating, status: "pending", verificationSource: eligibility.verificationSource } });
    return { success: true, reviewId, status: "pending" as const };
  }),

  hideMyProductReview: lcmUserProcedure.input(z.object({ reviewId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [review] = await db.select().from(lcmProductReviews).where(and(eq(lcmProductReviews.id, input.reviewId), eq(lcmProductReviews.reviewerAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "レビューが見つかりません" });
    await db.update(lcmProductReviews).set({ status: "hidden", publishedAt: null }).where(eq(lcmProductReviews.id, input.reviewId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "product_review", entityId: input.reviewId, action: "hidden_by_author", before: { status: review.status }, after: { status: "hidden" } });
    return { success: true };
  }),

  reportProductReview: lcmUserProcedure.input(z.object({ reviewId: z.number().int().positive(), reason: z.enum(["inaccurate", "privacy", "offensive", "conflict", "other"]), details: nullableText(1000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [review] = await db.select({ id: lcmProductReviews.id, reviewerAccountId: lcmProductReviews.reviewerAccountId }).from(lcmProductReviews).where(and(eq(lcmProductReviews.id, input.reviewId), eq(lcmProductReviews.status, "published"))).limit(1);
    if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "公開レビューが見つかりません" });
    if (review.reviewerAccountId === ctx.lcmAccount.accountId) throw new TRPCError({ code: "BAD_REQUEST", message: "自分のレビューは非公開にできます" });
    await db.insert(lcmReviewReports).values({ reviewId: input.reviewId, reporterAccountId: ctx.lcmAccount.accountId, reason: input.reason, details: cleanNullable(input.details), status: "open" }).onDuplicateKeyUpdate({ set: { reason: input.reason, details: cleanNullable(input.details), status: "open", reviewedByAccountId: null, reviewedAt: null, resolutionNote: null } });
    const [report] = await db.select({ id: lcmReviewReports.id }).from(lcmReviewReports).where(and(eq(lcmReviewReports.reviewId, input.reviewId), eq(lcmReviewReports.reporterAccountId, ctx.lcmAccount.accountId))).limit(1);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "review_report", entityId: report?.id || input.reviewId, action: "reported", after: { reviewId: input.reviewId, reason: input.reason } });
    return { success: true };
  }),

  createBrand: lcmMemberProcedure.input(brandInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireBrandEligibility(db, ctx.lcmAccount, ctx.lcmMembership);
    const normalizedName = normalizeLcmCatalogName(input.displayName);
    const reservedCatalogIdentity = lcmCatalogIdentities.find((identity) =>
      normalizeLcmCatalogName(identity.brandName) === normalizedName
      || normalizeLcmCatalogName(identity.companyName) === normalizedName,
    );
    if (reservedCatalogIdentity) {
      throw new TRPCError({ code: "CONFLICT", message: "第1回LCF掲載済みのブランド・会社です。既存企業・ブランド検索から管理権限を申請してください" });
    }
    const [ownedBrandCount] = await db.select({ count: sql<number>`count(*)` }).from(lcmBrandMembers).where(and(
      eq(lcmBrandMembers.festivalAccountId, ctx.lcmAccount.accountId),
      inArray(lcmBrandMembers.status, ["pending", "active"]),
    ));
    if (Number(ownedBrandCount?.count || 0) >= MAX_BRANDS_PER_ACCOUNT) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "1アカウントで登録できるブランド数の上限に達しました。LCM運営へご連絡ください" });
    }
    const [duplicateBrand] = await db.select({ id: lcmBrandProfiles.id }).from(lcmBrandMembers)
      .innerJoin(lcmBrandProfiles, eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id))
      .where(and(
        eq(lcmBrandMembers.festivalAccountId, ctx.lcmAccount.accountId),
        inArray(lcmBrandMembers.status, ["pending", "active"]),
        eq(lcmBrandProfiles.displayName, input.displayName),
      )).limit(1);
    if (duplicateBrand) throw new TRPCError({ code: "CONFLICT", message: "同じ名前のブランドを既に管理しています" });
    const slug = `${slugify(input.displayName)}-${nanoid(6).toLowerCase()}`;
    const result = await db.insert(lcmBrandProfiles).values({
      slug, displayName: input.displayName, companyName: cleanNullable(input.companyName), category: cleanNullable(input.category),
      tagline: cleanNullable(input.tagline), description: cleanNullable(input.description), story: cleanNullable(input.story),
      logoUrl: cleanNullable(input.logoUrl), coverUrl: cleanNullable(input.coverUrl), officialWebsiteUrl: cleanNullable(input.officialWebsiteUrl),
      tiktokShopUrl: cleanNullable(input.tiktokShopUrl), amazonUrl: cleanNullable(input.amazonUrl), rakutenUrl: cleanNullable(input.rakutenUrl),
      otherSalesUrl: cleanNullable(input.otherSalesUrl), status: "draft", claimStatus: "claimed", createdByAccountId: ctx.lcmAccount.accountId,
    });
    const brandId = insertedId(result);
    await db.insert(lcmBrandMembers).values({ brandProfileId: brandId, festivalAccountId: ctx.lcmAccount.accountId, role: "owner", status: "active", approvedBy: ctx.lcmAccount.accountId, approvedAt: new Date() });
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand", entityId: brandId, action: "created", after: { displayName: input.displayName, status: "draft" } });
    return { success: true, brandId, slug };
  }),

  claimCatalogSelection: lcmMemberProcedure.input(z.object({
    sourceCatalogPage: z.number().int().min(4).max(32),
    scope: z.enum(["brand", "company"]),
    message: nullableText(1000),
  }).strict()).mutation(async ({ ctx, input }) => {
    await requireBrandEligibility(await requireDb(), ctx.lcmAccount, ctx.lcmMembership);
    const identity = getLcmCatalogIdentity(input.sourceCatalogPage);
    if (!identity) throw new TRPCError({ code: "NOT_FOUND", message: "連携対象のカタログが見つかりません" });
    const targets = input.scope === "company"
      ? getLcmCatalogCompanyBrands(identity.companyName)
      : [getLcmCatalogIdentity(identity.primaryBrandPage)!];
    const db = await requireDb();
    const claims = await db.transaction(async (tx: any) => {
      const transactionClaims = [];
      for (const target of targets) {
        transactionClaims.push(await ensureCatalogBrandClaim(tx, ctx.lcmAccount.accountId, target.primaryBrandPage, cleanNullable(input.message) || undefined));
      }
      return transactionClaims;
    });
    const notification = await notifyLcm({
      to: [ctx.lcmAccount.email],
      subject: input.scope === "company" ? "【LCM】会社との仮連携を開始しました" : "【LCM】ブランドとの仮連携を開始しました",
      content: `${identity.companyName}${input.scope === "company" ? "に属するブランド" : ` / ${identity.brandName}`}との仮連携を開始しました。\n\nブランド情報と商品を非公開の下書きとして編集できます。既存掲載ブランドのため、第三者による権限取得を防ぐ管理権限確認後に、ご自身でブランドと商品を公開できます。問題が確認された場合は、運営が仮連携を却下または停止することがあります。\n\nブランド管理を開く：\n${LCM_BASE_URL}/manage?workspace=brand&brand=${claims[0]?.brandId || ""}`,
      entityType: "brand_claim",
      entityId: claims.map((claim) => claim.brandId).join(","),
    });
    return { success: true, scope: input.scope, companyName: identity.companyName, provisional: true, selectedBrandId: claims[0]?.brandId || null, claims, notification };
  }),

  claimCatalogBrand: lcmMemberProcedure.input(z.object({ sourceCatalogPage: z.number().int().min(2).max(32), displayName: z.string().trim().min(1).max(255), message: z.string().trim().max(3000).optional() }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await requireBrandEligibility(db, ctx.lcmAccount, ctx.lcmMembership);
    const [existing] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.sourceCatalogPage, input.sourceCatalogPage)).limit(1);
    let brandId: number;
    if (existing?.claimStatus === "claimed") throw new TRPCError({ code: "CONFLICT", message: "このブランドは既に管理されています" });
    if (existing) {
      brandId = existing.id;
    } else {
      const result = await db.insert(lcmBrandProfiles).values({ slug: `${slugify(input.displayName)}-${nanoid(6).toLowerCase()}`, sourceCatalogPage: input.sourceCatalogPage, displayName: input.displayName, status: "draft", claimStatus: "pending", createdByAccountId: ctx.lcmAccount.accountId });
      brandId = insertedId(result);
    }
    const [current] = await db.select().from(lcmBrandMembers).where(and(eq(lcmBrandMembers.brandProfileId, brandId), eq(lcmBrandMembers.festivalAccountId, ctx.lcmAccount.accountId))).limit(1);
    const [otherPending] = await db.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(eq(lcmBrandMembers.brandProfileId, brandId), inArray(lcmBrandMembers.status, ["pending", "active"]))).limit(1);
    if (!current && otherPending) throw new TRPCError({ code: "CONFLICT", message: "このブランドは現在確認中です" });
    if (!current) await db.insert(lcmBrandMembers).values({ brandProfileId: brandId, festivalAccountId: ctx.lcmAccount.accountId, role: "owner", status: "pending" });
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "brand_claim", entityId: brandId, action: "requested", after: { sourceCatalogPage: input.sourceCatalogPage, displayName: input.displayName, message: input.message || null } });
    return { success: true, brandId, status: current?.status || "pending" };
  }),

  listMyBrands: lcmMemberProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select({ member: lcmBrandMembers, brand: lcmBrandProfiles }).from(lcmBrandMembers)
      .innerJoin(lcmBrandProfiles, eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id))
      .where(eq(lcmBrandMembers.festivalAccountId, ctx.lcmAccount.accountId)).orderBy(desc(lcmBrandProfiles.updatedAt));
  }),

  getManageBrand: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireDraftBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [brand] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    const products = await db.select().from(lcmProducts).where(eq(lcmProducts.brandProfileId, input.brandId)).orderBy(desc(lcmProducts.updatedAt));
    return { brand, products };
  }),

  updateBrand: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), data: brandInput.partial().refine((value) => Object.keys(value).length > 0, "更新内容がありません") }).strict()).mutation(async ({ ctx, input }) => {
    const member = await requireDraftBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [before] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    if (member.status === "pending" && !["draft", "rejected"].includes(before.status)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "仮連携中は非公開の下書きだけ編集できます" });
    }
    const data = Object.fromEntries(Object.entries(input.data).map(([key, value]) => [key, typeof value === "string" ? cleanNullable(value) : value]));
    if (before.status === "published") assertBrandPublishable({ ...before, ...data });
    await db.update(lcmBrandProfiles).set({ ...data, status: before.status, rejectionReason: before.status === "published" ? null : before.rejectionReason }).where(eq(lcmBrandProfiles.id, input.brandId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand", entityId: input.brandId, action: "updated", before: { status: before.status }, after: { fields: Object.keys(input.data) } });
    return { success: true };
  }),

  submitBrand: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [brand] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    if (["rejected", "suspended", "archived"].includes(brand.status)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "運営により非公開となっているブランドは、運営が再開するまで公開できません" });
    }
    assertBrandPublishable(brand);
    const publishedAt = brand.publishedAt ?? new Date();
    await db.update(lcmBrandProfiles).set({ status: "published", submittedAt: new Date(), publishedAt, reviewedBy: null, reviewedAt: null, rejectionReason: null }).where(eq(lcmBrandProfiles.id, input.brandId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand", entityId: input.brandId, action: "self_published", before: { status: brand.status }, after: { status: "published", preReviewRequired: false } });
    return { success: true };
  }),

  createProduct: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), data: productInput }).strict()).mutation(async ({ ctx, input }) => {
    await requireDraftBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(lcmProducts).where(and(
      eq(lcmProducts.brandProfileId, input.brandId),
      notInArray(lcmProducts.status, ["archived"]),
    ));
    if (Number(productCount?.count || 0) >= MAX_PRODUCTS_PER_BRAND) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "1ブランドで登録できる商品数の上限に達しました。LCM運営へご連絡ください" });
    }
    const result = await db.insert(lcmProducts).values({
      brandProfileId: input.brandId, slug: `${slugify(input.data.name)}-${nanoid(7).toLowerCase()}`, name: input.data.name,
      sku: cleanNullable(input.data.sku), category: cleanNullable(input.data.category), summary: cleanNullable(input.data.summary),
      description: cleanNullable(input.data.description), highlights: input.data.highlights || [],
      thirtySecondPitch: cleanNullable(input.data.thirtySecondPitch), demoInstructions: cleanNullable(input.data.demoInstructions),
      targetAudience: cleanNullable(input.data.targetAudience), prohibitedClaims: cleanNullable(input.data.prohibitedClaims),
      relatedProductsText: cleanNullable(input.data.relatedProductsText),
      listPrice: input.data.listPrice == null ? null : String(input.data.listPrice), currency: "JPY", taxMode: input.data.taxMode,
      wholesalePrice: input.data.wholesalePrice == null ? null : String(input.data.wholesalePrice), wholesaleMinQuantity: input.data.wholesaleMinQuantity ?? null,
      wholesaleShippingTerms: cleanNullable(input.data.wholesaleShippingTerms), wholesalePaymentTerms: cleanNullable(input.data.wholesalePaymentTerms),
      wholesaleValidUntil: input.data.wholesaleValidUntil ?? null, commissionRate: cleanNullable(input.data.commissionRate),
      sampleAvailable: input.data.sampleAvailable, sampleMonthlyLimit: input.data.sampleMonthlyLimit ?? null, sampleInstructions: cleanNullable(input.data.sampleInstructions),
      stockDisclosure: input.data.stockDisclosure, stockQuantity: input.data.stockQuantity ?? null, primaryImageUrl: cleanNullable(input.data.primaryImageUrl),
      imageUrls: input.data.imageUrls || [], officialProductUrl: cleanNullable(input.data.officialProductUrl), tiktokShopUrl: cleanNullable(input.data.tiktokShopUrl),
      amazonUrl: cleanNullable(input.data.amazonUrl), rakutenUrl: cleanNullable(input.data.rakutenUrl), status: "draft", sourceKind: "brand", createdByAccountId: ctx.lcmAccount.accountId,
    });
    const productId = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "product", entityId: productId, action: "created", after: { brandProfileId: input.brandId, name: input.data.name, status: "draft" } });
    return { success: true, productId };
  }),

  updateProduct: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive(), data: productBaseInput.partial().refine((value) => Object.keys(value).length > 0, "更新内容がありません") }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmProducts).where(eq(lcmProducts.id, input.productId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    const member = await requireDraftBrandMember(ctx.lcmAccount.accountId, before.brandProfileId);
    if (member.status === "pending" && !["draft", "rejected"].includes(before.status)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "仮連携中は非公開の商品下書きだけ編集できます" });
    }
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.data)) {
      if (key === "listPrice" || key === "wholesalePrice") data[key] = value == null ? null : String(value);
      else data[key] = typeof value === "string" ? cleanNullable(value) : value;
    }
    if (before.status === "published") assertProductPublishable({ ...before, ...data });
    await db.update(lcmProducts).set({ ...data, status: before.status, rejectionReason: before.status === "published" ? null : before.rejectionReason }).where(eq(lcmProducts.id, input.productId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "product", entityId: input.productId, action: "updated", before: { status: before.status }, after: { fields: Object.keys(input.data) } });
    return { success: true };
  }),

  submitProduct: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select().from(lcmProducts).where(eq(lcmProducts.id, input.productId)).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    await requireActiveBrandMember(ctx.lcmAccount.accountId, product.brandProfileId);
    if (["rejected", "suspended", "archived"].includes(product.status)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "運営により非公開となっている商品は、運営が再開するまで公開できません" });
    }
    const [brand] = await db.select({ status: lcmBrandProfiles.status }).from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, product.brandProfileId)).limit(1);
    if (brand?.status !== "published") throw new TRPCError({ code: "BAD_REQUEST", message: "先にブランドページを公開してください" });
    assertProductPublishable(product);
    const publishedAt = product.publishedAt ?? new Date();
    await db.update(lcmProducts).set({ status: "published", submittedAt: new Date(), publishedAt, reviewedBy: null, reviewedAt: null, rejectionReason: null }).where(eq(lcmProducts.id, input.productId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "product", entityId: input.productId, action: "self_published", before: { status: product.status }, after: { status: "published", preReviewRequired: false } });
    return { success: true };
  }),

  uploadImage: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), fileName: z.string().trim().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64Data: z.string().min(1).max(7_500_000) }).strict()).mutation(async ({ ctx, input }) => {
    await requireDraftBrandMember(ctx.lcmAccount.accountId, input.brandId);
    assertUploadRateLimit(ctx.lcmAccount.accountId);
    if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) throw new TRPCError({ code: "BAD_REQUEST", message: "JPEG・PNG・WebPだけアップロードできます" });
    const buffer = Buffer.from(input.base64Data, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "画像は5MB以下にしてください" });
    if (!imageMatchesMime(buffer, input.contentType)) throw new TRPCError({ code: "BAD_REQUEST", message: "画像ファイルの内容を確認してください" });
    const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
    const key = `lcm/brands/${input.brandId}/${Date.now()}-${nanoid(10)}.${ext}`;
    const result = await storagePut(key, buffer, input.contentType);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand_asset", entityId: key, action: "uploaded", after: { brandProfileId: input.brandId, contentType: input.contentType, bytes: buffer.length } });
    return { key: result.key, url: result.url };
  }),

  createSampleRequest: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive(), purpose: z.string().trim().min(10).max(5000), plannedContentType: z.enum(["live", "short_video", "both", "other"]), plannedDate: z.coerce.date().optional().nullable(), message: nullableText(5000), recipientName: z.string().trim().min(1).max(255), postalCode: z.string().trim().min(3).max(20), address: z.string().trim().min(5).max(2000), phone: z.string().trim().min(7).max(50) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select().from(lcmProducts).where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"))).limit(1);
    if (!product || !product.sampleAvailable) throw new TRPCError({ code: "BAD_REQUEST", message: "この商品は現在サンプルを受け付けていません" });
    const [duplicate] = await db.select({ id: lcmSampleRequests.id }).from(lcmSampleRequests).where(and(eq(lcmSampleRequests.productId, input.productId), eq(lcmSampleRequests.requesterAccountId, ctx.lcmAccount.accountId), notInArray(lcmSampleRequests.status, ["rejected", "completed", "cancelled"]))).limit(1);
    if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "この商品には処理中の申請があります" });
    if (product.sampleMonthlyLimit) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [used] = await db.select({ count: sql<number>`count(*)` }).from(lcmSampleRequests).where(and(eq(lcmSampleRequests.productId, input.productId), gte(lcmSampleRequests.createdAt, monthStart), notInArray(lcmSampleRequests.status, ["rejected", "cancelled"])));
      if (Number(used?.count || 0) >= product.sampleMonthlyLimit) throw new TRPCError({ code: "BAD_REQUEST", message: "今月のサンプル受付上限に達しました" });
    }
    const requestCode = `LCM-S-${nanoid(10).toUpperCase()}`;
    const result = await db.insert(lcmSampleRequests).values({ requestCode, productId: product.id, brandProfileId: product.brandProfileId, requesterAccountId: ctx.lcmAccount.accountId, purpose: input.purpose, plannedContentType: input.plannedContentType, plannedDate: input.plannedDate ?? null, message: cleanNullable(input.message), recipientName: input.recipientName, postalCode: input.postalCode, address: input.address, phone: input.phone, status: "pending" });
    const id = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "sample_request", entityId: id, action: "created", after: { requestCode, productId: product.id, status: "pending" } });
    const owners = await brandOwnerEmails(db, product.brandProfileId);
    await Promise.all([
      notifyLcm({ to: owners, subject: `【LCM】新しいサンプル申請 ${requestCode}`, content: `LCMに新しいサンプル申請が届きました。\n\n商品：${product.name}\n申請番号：${requestCode}\n\n配送先などの詳細はLCMブランド管理で確認してください。\n${LCM_BASE_URL}/manage?brand=${product.brandProfileId}&requests=1`, entityType: "sample_request", entityId: id }),
      notifyLcm({ to: [ctx.lcmAccount.email], subject: `【LCM】サンプル申請を受け付けました ${requestCode}`, content: `サンプル申請を受け付けました。\n\n商品：${product.name}\n申請番号：${requestCode}\n\n進捗はLCMマイページで確認できます。\n${LCM_BASE_URL}/manage?requests=1`, entityType: "sample_request", entityId: id }),
    ]);
    return { success: true, requestCode };
  }),

  submitSampleCart: lcmMemberProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(20), purpose: z.string().trim().min(10).max(5000), plannedContentType: z.enum(["live", "short_video", "both", "other"]), plannedDate: z.coerce.date().optional().nullable(), message: nullableText(5000), recipientName: z.string().trim().min(1).max(255), postalCode: z.string().trim().min(3).max(20), address: z.string().trim().min(5).max(2000), phone: z.string().trim().min(7).max(50) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const productIds = [...new Set(input.productIds)];
    const outcome = await db.transaction(async (tx: any) => {
      const cartRows = await tx.select({ productId: lcmSampleCartItems.productId }).from(lcmSampleCartItems)
        .where(and(eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId), inArray(lcmSampleCartItems.productId, productIds)));
      const cartProductIds = new Set(cartRows.map((row: { productId: number }) => Number(row.productId)));
      const created: Array<{ id: number; requestCode: string; productId: number; productName: string; brandProfileId: number }> = [];
      const skipped: Array<{ productId: number; reason: string }> = [];
      for (const productId of productIds) {
        if (!cartProductIds.has(productId)) {
          skipped.push({ productId, reason: "サンプルカートにありません" });
          continue;
        }
        const [product] = await tx.select({ id: lcmProducts.id, name: lcmProducts.name, brandProfileId: lcmProducts.brandProfileId, sampleAvailable: lcmProducts.sampleAvailable, sampleMonthlyLimit: lcmProducts.sampleMonthlyLimit }).from(lcmProducts)
          .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
          .where(and(eq(lcmProducts.id, productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
        if (!product?.sampleAvailable) {
          skipped.push({ productId, reason: "現在サンプルを受け付けていません" });
          continue;
        }
        const [duplicate] = await tx.select({ id: lcmSampleRequests.id }).from(lcmSampleRequests).where(and(eq(lcmSampleRequests.productId, productId), eq(lcmSampleRequests.requesterAccountId, ctx.lcmAccount.accountId), notInArray(lcmSampleRequests.status, ["rejected", "completed", "cancelled"]))).limit(1);
        if (duplicate) {
          skipped.push({ productId, reason: "処理中の申請があります" });
          continue;
        }
        if (product.sampleMonthlyLimit) {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const [used] = await tx.select({ count: sql<number>`count(*)` }).from(lcmSampleRequests).where(and(eq(lcmSampleRequests.productId, productId), gte(lcmSampleRequests.createdAt, monthStart), notInArray(lcmSampleRequests.status, ["rejected", "cancelled"])));
          if (Number(used?.count || 0) >= product.sampleMonthlyLimit) {
            skipped.push({ productId, reason: "今月の受付上限に達しました" });
            continue;
          }
        }
        const requestCode = `LCM-S-${nanoid(10).toUpperCase()}`;
        const result = await tx.insert(lcmSampleRequests).values({ requestCode, productId: product.id, brandProfileId: product.brandProfileId, requesterAccountId: ctx.lcmAccount.accountId, purpose: input.purpose, plannedContentType: input.plannedContentType, plannedDate: input.plannedDate ?? null, message: cleanNullable(input.message), recipientName: input.recipientName, postalCode: input.postalCode, address: input.address, phone: input.phone, status: "pending" });
        const id = insertedId(result);
        await tx.delete(lcmSampleCartItems).where(and(eq(lcmSampleCartItems.productId, productId), eq(lcmSampleCartItems.festivalAccountId, ctx.lcmAccount.accountId)));
        await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "sample_request", entityId: id, action: "created_from_cart", after: { requestCode, productId, status: "pending" } }, tx);
        created.push({ id, requestCode, productId, productName: product.name, brandProfileId: product.brandProfileId });
      }
      return { created, skipped };
    });
    await Promise.all(outcome.created.flatMap((item) => [
      brandOwnerEmails(db, item.brandProfileId).then((owners) => notifyLcm({ to: owners, subject: `【LCM】新しいサンプル申請 ${item.requestCode}`, content: `LCMのサンプルカートから申請が届きました。\n\n商品：${item.productName}\n申請番号：${item.requestCode}\n\n${LCM_BASE_URL}/manage?brand=${item.brandProfileId}&requests=1`, entityType: "sample_request", entityId: item.id })),
      notifyLcm({ to: [ctx.lcmAccount.email], subject: `【LCM】サンプル申請を受け付けました ${item.requestCode}`, content: `サンプル申請を受け付けました。\n\n商品：${item.productName}\n申請番号：${item.requestCode}\n\n${LCM_BASE_URL}/manage?requests=1`, entityType: "sample_request", entityId: item.id }),
    ]));
    return { success: outcome.created.length > 0, ...outcome };
  }),

  createWholesaleInquiry: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive(), requestedQuantity: z.number().int().min(1).max(1_000_000), intendedUse: z.string().trim().min(10).max(5000), requestedStartDate: z.coerce.date().optional().nullable(), message: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select().from(lcmProducts).where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"))).limit(1);
    if (!product || product.wholesalePrice == null || product.wholesaleMinQuantity == null) throw new TRPCError({ code: "BAD_REQUEST", message: "この商品は現在卸商談を受け付けていません" });
    if (input.requestedQuantity < product.wholesaleMinQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: `最小発注数は${product.wholesaleMinQuantity}点です` });
    const inquiryCode = `LCM-W-${nanoid(10).toUpperCase()}`;
    const result = await db.insert(lcmWholesaleInquiries).values({ inquiryCode, productId: product.id, brandProfileId: product.brandProfileId, requesterAccountId: ctx.lcmAccount.accountId, requestedQuantity: input.requestedQuantity, intendedUse: input.intendedUse, requestedStartDate: input.requestedStartDate ?? null, message: cleanNullable(input.message), status: "requested" });
    const id = insertedId(result);
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "wholesale_inquiry", entityId: id, action: "created", after: { inquiryCode, productId: product.id, requestedQuantity: input.requestedQuantity, status: "requested" } });
    const owners = await brandOwnerEmails(db, product.brandProfileId);
    await Promise.all([
      notifyLcm({ to: owners, subject: `【LCM】新しい卸商談 ${inquiryCode}`, content: `LCMに新しい卸商談が届きました。\n\n商品：${product.name}\n希望数量：${input.requestedQuantity}点\n商談番号：${inquiryCode}\n\n詳細はLCMブランド管理で確認してください。\n${LCM_BASE_URL}/manage?brand=${product.brandProfileId}&requests=1`, entityType: "wholesale_inquiry", entityId: id }),
      notifyLcm({ to: [ctx.lcmAccount.email], subject: `【LCM】卸商談を受け付けました ${inquiryCode}`, content: `卸商談のお申し込みを受け付けました。\n\n商品：${product.name}\n希望数量：${input.requestedQuantity}点\n商談番号：${inquiryCode}\n\n進捗はLCMマイページで確認できます。\n${LCM_BASE_URL}/manage?requests=1`, entityType: "wholesale_inquiry", entityId: id }),
    ]);
    return { success: true, inquiryCode };
  }),

  listMyRequests: lcmMemberProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const samples = await db.select({ request: lcmSampleRequests, productName: lcmProducts.name, productSlug: lcmProducts.slug, brandName: lcmBrandProfiles.displayName }).from(lcmSampleRequests)
      .innerJoin(lcmProducts, eq(lcmSampleRequests.productId, lcmProducts.id)).innerJoin(lcmBrandProfiles, eq(lcmSampleRequests.brandProfileId, lcmBrandProfiles.id))
      .where(eq(lcmSampleRequests.requesterAccountId, ctx.lcmAccount.accountId)).orderBy(desc(lcmSampleRequests.updatedAt));
    const wholesale = await db.select({ inquiry: lcmWholesaleInquiries, productName: lcmProducts.name, productSlug: lcmProducts.slug, brandName: lcmBrandProfiles.displayName }).from(lcmWholesaleInquiries)
      .innerJoin(lcmProducts, eq(lcmWholesaleInquiries.productId, lcmProducts.id)).innerJoin(lcmBrandProfiles, eq(lcmWholesaleInquiries.brandProfileId, lcmBrandProfiles.id))
      .where(eq(lcmWholesaleInquiries.requesterAccountId, ctx.lcmAccount.accountId)).orderBy(desc(lcmWholesaleInquiries.updatedAt));
    return { samples, wholesale };
  }),

  cancelSampleRequest: lcmMemberProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [request] = await db.select().from(lcmSampleRequests).where(and(eq(lcmSampleRequests.id, input.id), eq(lcmSampleRequests.requesterAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
    if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "審査開始後は取消できません" });
    await db.update(lcmSampleRequests).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(lcmSampleRequests.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "sample_request", entityId: input.id, action: "cancelled", before: { status: request.status }, after: { status: "cancelled" } });
    return { success: true };
  }),

  cancelWholesaleInquiry: lcmMemberProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [inquiry] = await db.select().from(lcmWholesaleInquiries).where(and(eq(lcmWholesaleInquiries.id, input.id), eq(lcmWholesaleInquiries.requesterAccountId, ctx.lcmAccount.accountId))).limit(1);
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "商談が見つかりません" });
    if (!["requested", "reviewing"].includes(inquiry.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "この状態では取消できません" });
    await db.update(lcmWholesaleInquiries).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(lcmWholesaleInquiries.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "wholesale_inquiry", entityId: input.id, action: "cancelled", before: { status: inquiry.status }, after: { status: "cancelled" } });
    return { success: true };
  }),

  listBrandRequests: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const samples = await db.select({ request: lcmSampleRequests, productName: lcmProducts.name, requesterName: lcmMemberships.displayName, requesterType: lcmMemberships.memberType }).from(lcmSampleRequests)
      .innerJoin(lcmProducts, eq(lcmSampleRequests.productId, lcmProducts.id)).innerJoin(lcmMemberships, eq(lcmSampleRequests.requesterAccountId, lcmMemberships.festivalAccountId))
      .where(eq(lcmSampleRequests.brandProfileId, input.brandId)).orderBy(desc(lcmSampleRequests.updatedAt));
    const wholesale = await db.select({ inquiry: lcmWholesaleInquiries, productName: lcmProducts.name, requesterName: lcmMemberships.displayName, requesterType: lcmMemberships.memberType }).from(lcmWholesaleInquiries)
      .innerJoin(lcmProducts, eq(lcmWholesaleInquiries.productId, lcmProducts.id)).innerJoin(lcmMemberships, eq(lcmWholesaleInquiries.requesterAccountId, lcmMemberships.festivalAccountId))
      .where(eq(lcmWholesaleInquiries.brandProfileId, input.brandId)).orderBy(desc(lcmWholesaleInquiries.updatedAt));
    return { samples, wholesale };
  }),

  listBrandReviews: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const reviews = await db.select({
      review: lcmProductReviews,
      productName: lcmProducts.name,
      productSlug: lcmProducts.slug,
      reviewerName: lcmMemberships.displayName,
      reviewerType: lcmMemberships.memberType,
    }).from(lcmProductReviews)
      .innerJoin(lcmProducts, eq(lcmProductReviews.productId, lcmProducts.id))
      .innerJoin(lcmMemberships, eq(lcmProductReviews.reviewerAccountId, lcmMemberships.festivalAccountId))
      .where(eq(lcmProductReviews.brandProfileId, input.brandId))
      .orderBy(desc(lcmProductReviews.updatedAt));
    const reviewIds = reviews.map((item) => Number(item.review.id));
    const reports = reviewIds.length
      ? await db.select({ id: lcmReviewReports.id, reviewId: lcmReviewReports.reviewId, reason: lcmReviewReports.reason, details: lcmReviewReports.details, status: lcmReviewReports.status, resolutionNote: lcmReviewReports.resolutionNote, createdAt: lcmReviewReports.createdAt, updatedAt: lcmReviewReports.updatedAt }).from(lcmReviewReports).where(inArray(lcmReviewReports.reviewId, reviewIds)).orderBy(desc(lcmReviewReports.updatedAt))
      : [];
    return { reviews, reports };
  }),

  updateSampleStatus: lcmMemberProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "preparing", "shipped", "delivered", "live_scheduled", "completed"]), brandReply: nullableText(5000), trackingCarrier: nullableText(100), trackingNumber: nullableText(255), liveUrl: nullableHttpsUrl }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [request] = await db.select().from(lcmSampleRequests).where(eq(lcmSampleRequests.id, input.id)).limit(1);
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
    await requireActiveBrandMember(ctx.lcmAccount.accountId, request.brandProfileId);
    assertTransition(LCM_SAMPLE_TRANSITIONS, request.status, input.status);
    if (input.status === "rejected" && !cleanNullable(input.brandReply)) throw new TRPCError({ code: "BAD_REQUEST", message: "却下理由を入力してください" });
    if (input.status === "shipped" && (!cleanNullable(input.trackingCarrier) || !cleanNullable(input.trackingNumber))) throw new TRPCError({ code: "BAD_REQUEST", message: "配送会社と追跡番号を入力してください" });
    const dates: Record<string, Date> = {};
    if (input.status === "shipped") dates.shippedAt = new Date();
    if (input.status === "delivered") dates.deliveredAt = new Date();
    if (input.status === "completed") dates.completedAt = new Date();
    await db.update(lcmSampleRequests).set({ status: input.status, brandReply: cleanNullable(input.brandReply) ?? request.brandReply, trackingCarrier: cleanNullable(input.trackingCarrier) ?? request.trackingCarrier, trackingNumber: cleanNullable(input.trackingNumber) ?? request.trackingNumber, liveUrl: cleanNullable(input.liveUrl) ?? request.liveUrl, reviewedByAccountId: ctx.lcmAccount.accountId, reviewedAt: new Date(), ...dates }).where(eq(lcmSampleRequests.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "sample_request", entityId: input.id, action: "status_changed", before: { status: request.status }, after: { status: input.status } });
    const requesterEmail = await accountEmail(db, request.requesterAccountId);
    if (requesterEmail) await notifyLcm({ to: [requesterEmail], subject: `【LCM】サンプル申請の状態が更新されました ${request.requestCode}`, content: `サンプル申請の状態が「${input.status}」へ更新されました。\n\n申請番号：${request.requestCode}${cleanNullable(input.brandReply) ? `\nブランドからの連絡：${cleanNullable(input.brandReply)}` : ""}${cleanNullable(input.trackingNumber) ? `\n配送：${cleanNullable(input.trackingCarrier)} ${cleanNullable(input.trackingNumber)}` : ""}\n\n${LCM_BASE_URL}/manage?requests=1`, entityType: "sample_request", entityId: input.id });
    return { success: true };
  }),

  updateWholesaleStatus: lcmMemberProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["reviewing", "accepted", "declined", "negotiating", "completed"]), brandReply: nullableText(5000), negotiatedTerms: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [inquiry] = await db.select().from(lcmWholesaleInquiries).where(eq(lcmWholesaleInquiries.id, input.id)).limit(1);
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "商談が見つかりません" });
    await requireActiveBrandMember(ctx.lcmAccount.accountId, inquiry.brandProfileId);
    assertTransition(LCM_WHOLESALE_TRANSITIONS, inquiry.status, input.status);
    if (input.status === "declined" && !cleanNullable(input.brandReply)) throw new TRPCError({ code: "BAD_REQUEST", message: "見送り理由を入力してください" });
    await db.update(lcmWholesaleInquiries).set({ status: input.status, brandReply: cleanNullable(input.brandReply) ?? inquiry.brandReply, negotiatedTerms: cleanNullable(input.negotiatedTerms) ?? inquiry.negotiatedTerms, reviewedByAccountId: ctx.lcmAccount.accountId, reviewedAt: new Date(), completedAt: input.status === "completed" ? new Date() : inquiry.completedAt }).where(eq(lcmWholesaleInquiries.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "wholesale_inquiry", entityId: input.id, action: "status_changed", before: { status: inquiry.status }, after: { status: input.status } });
    const requesterEmail = await accountEmail(db, inquiry.requesterAccountId);
    if (requesterEmail) await notifyLcm({ to: [requesterEmail], subject: `【LCM】卸商談の状態が更新されました ${inquiry.inquiryCode}`, content: `卸商談の状態が「${input.status}」へ更新されました。\n\n商談番号：${inquiry.inquiryCode}${cleanNullable(input.brandReply) ? `\nブランドからの連絡：${cleanNullable(input.brandReply)}` : ""}${cleanNullable(input.negotiatedTerms) ? `\n条件：${cleanNullable(input.negotiatedTerms)}` : ""}\n\n${LCM_BASE_URL}/manage?requests=1`, entityType: "wholesale_inquiry", entityId: input.id });
    return { success: true };
  }),

  adminOverview: lcmAdminProcedure.query(async () => {
    const db = await requireDb();
    const memberships = await db.select().from(lcmMemberships).orderBy(desc(lcmMemberships.updatedAt));
    const brands = await db.select().from(lcmBrandProfiles).orderBy(desc(lcmBrandProfiles.updatedAt));
    const brandMembers = await db.select({ member: lcmBrandMembers, accountEmail: festivalAccounts.email, accountName: festivalAccounts.displayName })
      .from(lcmBrandMembers)
      .innerJoin(festivalAccounts, eq(lcmBrandMembers.festivalAccountId, festivalAccounts.id))
      .orderBy(desc(lcmBrandMembers.updatedAt));
    const products = await db.select().from(lcmProducts).orderBy(desc(lcmProducts.updatedAt));
    const creators = await db.select().from(lcmCreatorProfiles).orderBy(desc(lcmCreatorProfiles.updatedAt));
    const samples = await db.select().from(lcmSampleRequests).orderBy(desc(lcmSampleRequests.updatedAt));
    const wholesale = await db.select().from(lcmWholesaleInquiries).orderBy(desc(lcmWholesaleInquiries.updatedAt));
    const interests = await db.select().from(lcmProductInterests).orderBy(desc(lcmProductInterests.createdAt));
    const eventParticipations = await db.select().from(lcmBrandEventParticipations).orderBy(desc(lcmBrandEventParticipations.verifiedAt));
    const reviews = await db.select({ review: lcmProductReviews, reviewerName: lcmMemberships.displayName, reviewerType: lcmMemberships.memberType })
      .from(lcmProductReviews).innerJoin(lcmMemberships, eq(lcmProductReviews.reviewerAccountId, lcmMemberships.festivalAccountId)).orderBy(desc(lcmProductReviews.updatedAt));
    const reviewReports = await db.select().from(lcmReviewReports).orderBy(desc(lcmReviewReports.updatedAt));
    return { memberships, brands, brandMembers, products, creators, samples, wholesale, interests, eventParticipations, reviews, reviewReports };
  }),

  moderateProductReview: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "rejected", "hidden"]), reason: nullableText(2000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmProductReviews).where(eq(lcmProductReviews.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "レビューが見つかりません" });
    const allowed = before.status === "pending" ? ["published", "rejected"] : before.status === "published" ? ["hidden"] : [];
    if (!allowed.includes(input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "このレビュー状態では指定した審査操作を実行できません" });
    if (input.status !== "published" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "見送り・停止理由を入力してください" });
    await db.update(lcmProductReviews).set({ status: input.status, publishedAt: input.status === "published" ? new Date() : null, moderatedByAccountId: ctx.lcmAdmin.id, moderatedAt: new Date(), moderationNote: cleanNullable(input.reason) }).where(eq(lcmProductReviews.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "product_review", entityId: input.id, action: "moderated", before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reason) } });
    return { success: true };
  }),

  resolveReviewReport: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), outcome: z.enum(["hide_review", "dismiss"]), note: z.string().trim().min(3).max(2000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [report] = await db.select().from(lcmReviewReports).where(eq(lcmReviewReports.id, input.id)).limit(1);
    if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "通報が見つかりません" });
    if (report.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "この通報はすでに処理済みです" });
    await db.transaction(async (tx: any) => {
      await tx.update(lcmReviewReports).set({ status: input.outcome === "hide_review" ? "resolved" : "dismissed", reviewedByAccountId: ctx.lcmAdmin.id, reviewedAt: new Date(), resolutionNote: input.note }).where(eq(lcmReviewReports.id, input.id));
      if (input.outcome === "hide_review") await tx.update(lcmProductReviews).set({ status: "hidden", publishedAt: null, moderatedByAccountId: ctx.lcmAdmin.id, moderatedAt: new Date(), moderationNote: input.note }).where(eq(lcmProductReviews.id, report.reviewId));
      await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "review_report", entityId: input.id, action: input.outcome === "hide_review" ? "resolved_review_hidden" : "dismissed", before: { status: report.status }, after: { status: input.outcome === "hide_review" ? "resolved" : "dismissed", reviewId: report.reviewId, note: input.note } }, tx);
    });
    return { success: true };
  }),

  reviewMembership: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "suspended"]), reviewNote: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmMemberships).where(eq(lcmMemberships.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "会員申請が見つかりません" });
    if (input.status !== "approved" && !cleanNullable(input.reviewNote)) throw new TRPCError({ code: "BAD_REQUEST", message: "理由を入力してください" });
    await db.update(lcmMemberships).set({ status: input.status, reviewNote: cleanNullable(input.reviewNote), reviewedBy: ctx.lcmAdmin.id, reviewedAt: new Date() }).where(eq(lcmMemberships.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "membership", entityId: input.id, action: "moderated", before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reviewNote) } });
    const email = await accountEmail(db, before.festivalAccountId);
    const statusLabel = input.status === "approved" ? "利用再開" : input.status === "rejected" ? "利用不可" : "利用停止";
    const isLiver = before.memberType === "liver";
    const notification = email ? await notifyLcm({
      to: [email],
      subject: input.status === "approved" ? "【LCM】利用を再開しました" : `【LCM】会員状態を変更しました（${statusLabel}）`,
      content: input.status === "approved"
        ? isLiver
          ? `LCMの利用を開始・再開しました。\n\nライブコマーサー公式ページの作成、商品検索、サンプル申請をご利用いただけます。\n公式プロフィールを作成する：\n${LCM_BASE_URL}/manage?creator=profile${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}`
          : `LCMの利用を開始・再開しました。\n\nブランドページの作成・商品登録、サンプル申請、卸商談をご利用いただけます。\nブランド管理を開く：\n${LCM_BASE_URL}/manage${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}`
        : `LCMの会員状態は「${statusLabel}」です。${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}\n\n${LCM_BASE_URL}/manage`,
      entityType: "membership",
      entityId: input.id,
    }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, notification };
  }),

  resendMembershipApprovalEmail: lcmAdminProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [membership] = await db.select().from(lcmMemberships).where(eq(lcmMemberships.id, input.id)).limit(1);
    if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "会員が見つかりません" });
    if (membership.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "利用中の会員だけに案内メールを再送できます" });
    const email = await accountEmail(db, membership.festivalAccountId);
    const isLiver = membership.memberType === "liver";
    const notification = email ? await notifyLcm({
      to: [email],
      subject: isLiver ? "【LCM】ライブコマーサー公式ページ作成のご案内" : "【LCM】無料ブランド・商品登録のご案内",
      content: isLiver
        ? `LCMをご利用いただけます。\n\nライブコマーサー公式ページの作成、商品検索、サンプル申請をご利用ください。\n公式プロフィールを作成する：\n${LCM_BASE_URL}/manage?creator=profile`
        : `LCMをご利用いただけます。\n\nブランド・商品登録は当面無料です。ブランドページを公開した後、続けて商品ページを作成・公開できます。\nブランド管理を開く：\n${LCM_BASE_URL}/manage`,
      entityType: "membership",
      entityId: input.id,
    }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "membership", entityId: input.id, action: "approval_email_resent", after: { success: notification.success, recipientCount: notification.recipientCount } });
    return { success: true, notification };
  }),

  reviewCreatorProfile: lcmAdminProcedure.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(["published", "rejected", "suspended"]),
    reason: nullableText(5000),
    metricsVerification: z.enum(["not_submitted", "self_reported", "verified"]).optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmCreatorProfiles).where(eq(lcmCreatorProfiles.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ライブコマーサープロフィールが見つかりません" });
    if (input.status !== "published" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "理由を入力してください" });
    if (input.status === "published") {
      if (!before.publicConsentAt) throw new TRPCError({ code: "BAD_REQUEST", message: "本人の公開同意を確認できません" });
      if (!["submitted", "rejected", "published", "suspended"].includes(before.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "本人が公開審査へ提出していません" });
      if (!before.profileImageUrl || !before.bio || !before.tiktokUrl || !(before.categories || []).length || (!before.supportsLive && !before.supportsShortVideo)) throw new TRPCError({ code: "BAD_REQUEST", message: "公開必須項目が不足しています" });
    }
    await db.update(lcmCreatorProfiles).set({
      status: input.status,
      publishedAt: input.status === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt,
      reviewedBy: ctx.lcmAdmin.id,
      reviewedAt: new Date(),
      rejectionReason: input.status === "rejected" ? cleanNullable(input.reason) : null,
      metricsVerification: input.metricsVerification ?? before.metricsVerification,
    }).where(eq(lcmCreatorProfiles.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "creator_profile", entityId: input.id, action: "reviewed", before: { status: before.status, metricsVerification: before.metricsVerification }, after: { status: input.status, metricsVerification: input.metricsVerification ?? before.metricsVerification } });
    const email = await accountEmail(db, before.festivalAccountId);
    const statusLabel = input.status === "published" ? "公開承認" : input.status === "rejected" ? "要修正" : "公開停止";
    const notification = email ? await notifyLcm({
      to: [email],
      subject: `【LCM】ライブコマーサー公式ページ審査結果：${before.displayName}`,
      content: input.status === "published"
        ? `${before.displayName}のライブコマーサー公式ページが公開承認されました。\n\n公開ページ：\n${LCM_BASE_URL}/creators/${before.slug}\n\nプロフィール管理：\n${LCM_BASE_URL}/manage?creator=profile`
        : `${before.displayName}のプロフィール審査結果は「${statusLabel}」です。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?creator=profile`,
      entityType: "creator_profile",
      entityId: input.id,
    }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, notification };
  }),

  reviewBrand: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "rejected", "suspended"]), reason: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    if (input.status !== "published" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "非公開・停止理由を入力してください" });
    if (input.status === "published") {
      if (before.status === "archived") throw new TRPCError({ code: "BAD_REQUEST", message: "アーカイブ済みブランドは再公開できません" });
      assertBrandPublishable(before);
    }
    if (input.status === "suspended" && before.status !== "published") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "公開停止できるのは公開中のブランドだけです" });
    }
    let suspendedProductCount = 0;
    const reviewedAt = new Date();
    await db.transaction(async (tx: any) => {
      await tx.update(lcmBrandProfiles).set({ status: input.status, publishedAt: input.status === "published" ? (before.publishedAt ?? reviewedAt) : before.publishedAt, reviewedBy: ctx.lcmAdmin.id, reviewedAt, rejectionReason: input.status === "published" ? null : cleanNullable(input.reason) }).where(eq(lcmBrandProfiles.id, input.id));
      if (input.status === "suspended") {
        const result = await tx.update(lcmProducts).set({ status: "suspended", reviewedBy: ctx.lcmAdmin.id, reviewedAt, rejectionReason: cleanNullable(input.reason) }).where(and(eq(lcmProducts.brandProfileId, input.id), eq(lcmProducts.status, "published")));
        suspendedProductCount = Number((result as any)?.[0]?.affectedRows || (result as any)?.affectedRows || 0);
      }
      await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "brand", entityId: input.id, action: input.status === "published" ? "republished_by_admin" : "suspended_by_admin", before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reason), suspendedProductCount } }, tx);
    });
    const owners = await brandOwnerEmails(db, input.id);
    const statusLabel = input.status === "published" ? "公開再開" : input.status === "rejected" ? "非公開" : "公開停止";
    const notification = await notifyLcm({ to: owners, subject: `【LCM】ブランド公開状態を変更しました：${before.displayName}`, content: input.status === "published" ? `${before.displayName}のブランドページを再公開しました。\n\n公開ページ：\n${LCM_BASE_URL}/brands/${before.slug}\n\nブランド管理：\n${LCM_BASE_URL}/manage?brand=${before.id}` : `${before.displayName}を「${statusLabel}」に変更しました。${suspendedProductCount > 0 ? `\n同ブランドの公開商品${suspendedProductCount}件も非公開にしました。` : ""}${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?brand=${before.id}`, entityType: "brand", entityId: input.id });
    return { success: true, notification };
  }),

  reviewBrandClaim: lcmAdminProcedure.input(z.object({ memberId: z.number().int().positive(), status: z.enum(["active", "rejected", "revoked"]), reason: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmBrandMembers).where(eq(lcmBrandMembers.id, input.memberId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランド管理申請が見つかりません" });
    if (["active", "rejected"].includes(input.status) && before.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "正式承認または却下できるのは仮連携中の申請だけです" });
    if (input.status === "revoked" && before.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "停止できるのは正式承認済みの権限だけです" });
    if (["rejected", "revoked"].includes(input.status) && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: input.status === "revoked" ? "停止理由を入力してください" : "却下理由を入力してください" });
    const action = input.status === "active" ? "formally_approved" : input.status === "rejected" ? "provisional_rejected" : "access_revoked";
    const reviewedAt = new Date();
    await db.transaction(async (tx: any) => {
      if (input.status === "active") {
        await tx.update(lcmBrandMembers).set({ status: "rejected", approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
          .where(and(eq(lcmBrandMembers.brandProfileId, before.brandProfileId), eq(lcmBrandMembers.status, "pending")));
        await tx.update(lcmBrandMembers).set({ status: "active", approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
          .where(eq(lcmBrandMembers.id, input.memberId));
        await tx.update(lcmBrandProfiles).set({ claimStatus: "claimed" }).where(eq(lcmBrandProfiles.id, before.brandProfileId));
      } else {
        await tx.update(lcmBrandMembers).set({ status: input.status, approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
          .where(eq(lcmBrandMembers.id, input.memberId));
        const [remainingActive] = await tx.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
          eq(lcmBrandMembers.brandProfileId, before.brandProfileId),
          eq(lcmBrandMembers.status, "active"),
        )).limit(1);
        if (!remainingActive) await tx.update(lcmBrandProfiles).set({ claimStatus: "unclaimed" }).where(eq(lcmBrandProfiles.id, before.brandProfileId));
      }
      await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "brand_claim", entityId: input.memberId, action, before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reason) } }, tx);
    });
    const email = await accountEmail(db, before.festivalAccountId);
    const statusLabel = input.status === "active" ? "正式承認" : input.status === "rejected" ? "却下" : "権限停止";
    const notification = email ? await notifyLcm({ to: [email], subject: input.status === "active" ? "【LCM】既存ブランドの管理権限を確認しました" : `【LCM】ブランド連携：${statusLabel}`, content: input.status === "active" ? `既存掲載ブランドの管理権限を確認しました。下書き編集に加え、ご自身でブランド・商品を公開し、申請へ対応できます。\n\nブランド管理を開く：\n${LCM_BASE_URL}/manage?brand=${before.brandProfileId}` : `ブランド連携は「${statusLabel}」となりました。既存アーカイブへの影響はなく、作成済みの下書きは非公開で保全されます。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage`, entityType: "brand_claim", entityId: input.memberId }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, notification };
  }),

  reviewProduct: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "rejected", "suspended"]), reason: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmProducts).where(eq(lcmProducts.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    if (input.status !== "published" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "非公開・停止理由を入力してください" });
    const [brand] = await db.select({ status: lcmBrandProfiles.status, displayName: lcmBrandProfiles.displayName }).from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, before.brandProfileId)).limit(1);
    if (input.status === "published" && brand?.status !== "published") {
      const statusLabel = brand?.status === "draft" ? "下書き" : brand?.status === "rejected" ? "非公開" : brand?.status === "suspended" ? "公開停止中" : "未公開";
      throw new TRPCError({ code: "BAD_REQUEST", message: `ブランド「${brand?.displayName || "不明"}」を先に公開してください（現在：${statusLabel}）` });
    }
    if (input.status === "published") {
      if (before.status === "archived") throw new TRPCError({ code: "BAD_REQUEST", message: "アーカイブ済み商品は再公開できません" });
      assertProductPublishable(before);
    }
    if (input.status === "suspended" && before.status !== "published") throw new TRPCError({ code: "BAD_REQUEST", message: "公開停止できるのは公開中の商品だけです" });
    await db.update(lcmProducts).set({ status: input.status, publishedAt: input.status === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt, reviewedBy: ctx.lcmAdmin.id, reviewedAt: new Date(), rejectionReason: input.status === "published" ? null : cleanNullable(input.reason) }).where(eq(lcmProducts.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "product", entityId: input.id, action: input.status === "published" ? "republished_by_admin" : "suspended_by_admin", before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reason) } });
    const owners = await brandOwnerEmails(db, before.brandProfileId);
    const statusLabel = input.status === "published" ? "公開再開" : input.status === "rejected" ? "非公開" : "公開停止";
    const notification = await notifyLcm({ to: owners, subject: `【LCM】商品公開状態を変更しました：${before.name}`, content: input.status === "published" ? `${before.name}を再公開しました。\n\n公開ページ：\n${LCM_BASE_URL}/products/${before.slug}` : `${before.name}を「${statusLabel}」に変更しました。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?brand=${before.brandProfileId}`, entityType: "product", entityId: input.id });
    return { success: true, notification };
  }),

  reviewCompanyBrandClaims: lcmAdminProcedure.input(z.object({
    memberId: z.number().int().positive(),
    status: z.enum(["active", "rejected", "revoked"]),
    reason: nullableText(5000),
  }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [seed] = await db.select({ member: lcmBrandMembers, brand: lcmBrandProfiles }).from(lcmBrandMembers)
      .innerJoin(lcmBrandProfiles, eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id))
      .where(eq(lcmBrandMembers.id, input.memberId)).limit(1);
    if (!seed) throw new TRPCError({ code: "NOT_FOUND", message: "ブランド管理申請が見つかりません" });
    if (["active", "rejected"].includes(input.status) && seed.member.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "正式承認または却下できるのは仮連携中の申請だけです" });
    if (input.status === "revoked" && seed.member.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "停止できるのは正式承認済みの権限だけです" });
    if (["rejected", "revoked"].includes(input.status) && !cleanNullable(input.reason)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: input.status === "revoked" ? "停止理由を入力してください" : "却下理由を入力してください" });
    }
    const companyName = cleanNullable(seed.brand.companyName);
    const claims = companyName
      ? await db.select({ member: lcmBrandMembers, brand: lcmBrandProfiles }).from(lcmBrandMembers)
        .innerJoin(lcmBrandProfiles, eq(lcmBrandMembers.brandProfileId, lcmBrandProfiles.id))
        .where(and(
          eq(lcmBrandMembers.festivalAccountId, seed.member.festivalAccountId),
          eq(lcmBrandMembers.status, seed.member.status),
          eq(lcmBrandProfiles.companyName, companyName),
        ))
      : [seed];
    const reviewedAt = new Date();
    await db.transaction(async (tx: any) => {
      for (const claim of claims) {
        if (input.status === "active") {
          await tx.update(lcmBrandMembers).set({ status: "rejected", approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
            .where(and(eq(lcmBrandMembers.brandProfileId, claim.brand.id), eq(lcmBrandMembers.status, "pending")));
          await tx.update(lcmBrandMembers).set({ status: "active", approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
            .where(eq(lcmBrandMembers.id, claim.member.id));
          await tx.update(lcmBrandProfiles).set({ claimStatus: "claimed" }).where(eq(lcmBrandProfiles.id, claim.brand.id));
        } else {
          await tx.update(lcmBrandMembers).set({ status: input.status, approvedBy: ctx.lcmAdmin.id, approvedAt: reviewedAt })
            .where(eq(lcmBrandMembers.id, claim.member.id));
          const [remainingActive] = await tx.select({ id: lcmBrandMembers.id }).from(lcmBrandMembers).where(and(
            eq(lcmBrandMembers.brandProfileId, claim.brand.id),
            eq(lcmBrandMembers.status, "active"),
          )).limit(1);
          if (!remainingActive) await tx.update(lcmBrandProfiles).set({ claimStatus: "unclaimed" }).where(eq(lcmBrandProfiles.id, claim.brand.id));
        }
        await writeAudit({
          actorAccountId: ctx.lcmAdmin.id,
          actorRole: "admin",
          entityType: "brand_claim",
          entityId: claim.member.id,
          action: input.status === "active" ? "company_formally_approved" : input.status === "rejected" ? "company_provisional_rejected" : "company_access_revoked",
          before: { status: claim.member.status },
          after: { status: input.status, companyName, reason: cleanNullable(input.reason) },
        }, tx);
      }
    });
    const email = await accountEmail(db, seed.member.festivalAccountId);
    const notification = email ? await notifyLcm({
      to: [email],
      subject: input.status === "active" ? "【LCM】会社・ブランド連携が正式承認されました" : input.status === "rejected" ? "【LCM】会社・ブランド仮連携が却下されました" : "【LCM】会社・ブランド管理権限が停止されました",
      content: input.status === "active"
        ? `${companyName || seed.brand.displayName}との管理権限を確認しました。${claims.length}件のブランドで、ご自身によるブランド・商品の公開と申請対応を利用できます。\n\nブランド管理を開く：\n${LCM_BASE_URL}/manage?workspace=brand`
        : `${companyName || seed.brand.displayName}との連携は「${input.status === "rejected" ? "却下" : "権限停止"}」となりました。既存アーカイブへの影響はなく、作成済みの下書きは非公開で保全されます。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?workspace=brand`,
      entityType: "brand_claim_company",
      entityId: `${seed.member.festivalAccountId}:${companyName || seed.brand.id}`,
    }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, reviewedCount: claims.length, companyName, notification };
  }),

  adminAuditLogs: lcmAdminProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional()).query(async ({ input }) => {
    const db = await requireDb();
    return db.select().from(lcmAuditLogs).orderBy(desc(lcmAuditLogs.createdAt)).limit(input?.limit ?? 200);
  }),
});
