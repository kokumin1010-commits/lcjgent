import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, notInArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  lcmAuditLogs,
  lcmBrandMembers,
  lcmBrandProfiles,
  lcmCreatorProfiles,
  lcmMemberships,
  lcmProducts,
  lcmSampleRequests,
  lcmWholesaleInquiries,
} from "../drizzle/lcmSchema";
import { festivalAccounts, festivalCompanyApplications, festivalLiverApplications } from "../drizzle/festivalSchema";
import { publicProcedure, router, t } from "./_core/trpc";
import { getDb } from "./db";
import { sendEmail } from "./emailService";
import { verifyFestivalAdminRequest, verifyFestivalUserRequest } from "./festivalAuthRouter";
import { storagePut } from "./storage";

const LCM_TERMS_VERSION = "2026-09-13-v1";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
    companyName: festivalCompanyApplications.companyName,
    contactName: festivalCompanyApplications.contactName,
  }).from(festivalCompanyApplications)
    .where(sql`LOWER(TRIM(${festivalCompanyApplications.email})) = ${normalizedEmail}`)
    .orderBy(desc(festivalCompanyApplications.id))
    .limit(1);
  return {
    displayName: cleanNullable(application?.contactName) || normalizedEmail.split("@")[0] || "LCF企業会員",
    businessName: cleanNullable(application?.companyName),
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
    displayName: cleanNullable(application.liverName) || normalizedEmail.split("@")[0] || "LCFライバー",
    agencyName: cleanNullable(application.agency),
    categories: cleanNullable(application.genre) ? [cleanNullable(application.genre)!] : [],
  };
}

async function requireCreatorEligibility(db: any, account: { accountId: number; accountType: string; email: string }, membership: { memberType: string }) {
  const defaults = await getLiverAccountDefaults(db, account.email);
  if (account.accountType !== "liver" && membership.memberType !== "liver" && !defaults) {
    throw new TRPCError({ code: "FORBIDDEN", message: "LCFライバーアカウントだけが公式プロフィールを管理できます" });
  }
  return defaults;
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
  if (!membership || membership.status !== "approved") {
    throw new TRPCError({ code: "FORBIDDEN", message: "LCM会員承認が必要です" });
  }
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
}) {
  const db = await requireDb();
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

async function requireActiveBrandMember(festivalAccountId: number, brandProfileId: number) {
  const member = await getActiveBrandMember(festivalAccountId, brandProfileId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "このブランドを編集する権限がありません" });
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
  relatedProductsText: lcmProducts.relatedProductsText,
  listPrice: lcmProducts.listPrice,
  currency: lcmProducts.currency,
  taxMode: lcmProducts.taxMode,
  sampleAvailable: lcmProducts.sampleAvailable,
  sampleInstructions: lcmProducts.sampleInstructions,
  stockDisclosure: lcmProducts.stockDisclosure,
  stockQuantity: lcmProducts.stockQuantity,
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
      return db.select(publicProductFields).from(lcmProducts)
        .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
        .where(and(...conditions)).orderBy(desc(lcmProducts.publishedAt)).limit(input?.limit ?? 60);
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
    return { ...brand, products };
  }),

  getPublicProduct: publicProcedure.input(z.object({ slug: z.string().min(1).max(220) })).query(async ({ input }) => {
    const db = await requireDb();
    const [product] = await db.select(publicProductFields).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.slug, input.slug), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published"))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    return product;
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
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "ライバープロフィールが見つかりません" });
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
    const companyAccountDefaults = !membership && ctx.lcmAccount.accountType === "company"
      ? await getCompanyAccountDefaults(db, ctx.lcmAccount.email)
      : null;
    const liverAccountDefaults = await getLiverAccountDefaults(db, ctx.lcmAccount.email);
    const [creatorProfile] = membership?.status === "approved"
      ? await db.select().from(lcmCreatorProfiles).where(eq(lcmCreatorProfiles.festivalAccountId, ctx.lcmAccount.accountId)).limit(1)
      : [];
    return {
      account: ctx.lcmAccount,
      membership: membership ?? null,
      brands,
      creatorProfile: creatorProfile ?? null,
      companyAccountLink: companyAccountDefaults ? { eligible: true as const, ...companyAccountDefaults } : null,
      liverAccountLink: liverAccountDefaults ? { eligible: true as const, ...liverAccountDefaults } : null,
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
    if (existing?.status === "approved" || existing?.status === "suspended") return { success: true, status: existing.status, notification: null, existing: true };
    const linkedCompanyAccount = ctx.lcmAccount.accountType === "company";
    const liverDefaults = await getLiverAccountDefaults(db, ctx.lcmAccount.email);
    const linkedLiverAccount = Boolean(liverDefaults) && input.memberType === "liver";
    const companyDefaults = linkedCompanyAccount ? await getCompanyAccountDefaults(db, ctx.lcmAccount.email) : null;
    const memberType = linkedCompanyAccount ? "company" as const : linkedLiverAccount ? "liver" as const : input.memberType;
    const displayName = linkedCompanyAccount ? companyDefaults?.displayName || input.displayName : linkedLiverAccount ? liverDefaults?.displayName || input.displayName : input.displayName;
    const businessName = linkedCompanyAccount ? companyDefaults?.businessName || cleanNullable(input.businessName) : cleanNullable(input.businessName);
    const linkedExistingAccount = linkedCompanyAccount || linkedLiverAccount;
    const status = linkedExistingAccount && existing?.status !== "rejected" ? "approved" as const : "pending" as const;
    let membershipId: number;
    if (existing) {
      membershipId = existing.id;
      await db.update(lcmMemberships).set({ memberType, displayName, businessName, status, termsVersion: LCM_TERMS_VERSION, agreedAt: new Date(), reviewedBy: null, reviewedAt: status === "approved" ? new Date() : null, reviewNote: status === "approved" ? (memberType === "liver" ? "LCFライバーアカウント連携" : "LCF企業アカウント連携") : null }).where(eq(lcmMemberships.id, existing.id));
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "membership", entityId: existing.id, action: status === "approved" ? (memberType === "liver" ? "liver_account_activated" : "company_account_activated") : "resubmitted", before: { status: existing.status }, after: { status, memberType } });
    } else {
      const result = await db.insert(lcmMemberships).values({ festivalAccountId: ctx.lcmAccount.accountId, memberType, displayName, businessName, status, termsVersion: LCM_TERMS_VERSION, agreedAt: new Date(), reviewedAt: status === "approved" ? new Date() : null, reviewNote: status === "approved" ? (memberType === "liver" ? "LCFライバーアカウント連携" : "LCF企業アカウント連携") : null });
      membershipId = insertedId(result);
      await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "member", entityType: "membership", entityId: membershipId, action: status === "approved" ? (memberType === "liver" ? "liver_account_activated" : "company_account_activated") : "created", after: { status, memberType } });
    }
    const notification = status === "approved"
      ? await notifyLcm({
          to: [ctx.lcmAccount.email],
          subject: memberType === "liver" ? "【LCM】ライバー会員の利用を開始しました" : "【LCM】企業会員の利用を開始しました",
          content: memberType === "liver"
            ? `LCFライバーアカウントとの連携が完了し、LCMライバー会員として利用できるようになりました。\n\n公式プロフィールの作成を開始できます。\n${LCM_BASE_URL}/manage?creator=profile`
            : `LCF企業アカウントとの連携が完了し、LCM企業会員として利用できるようになりました。\n\nブランドページの作成・商品登録を開始できます。\n${LCM_BASE_URL}/manage`,
          entityType: "membership",
          entityId: membershipId,
        })
      : null;
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
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "ライバープロフィールを先に保存してください" });
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
    }).from(lcmProducts)
      .innerJoin(lcmBrandProfiles, eq(lcmProducts.brandProfileId, lcmBrandProfiles.id))
      .where(and(eq(lcmProducts.id, input.productId), eq(lcmProducts.status, "published"), eq(lcmBrandProfiles.status, "published")))
      .limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    return product;
  }),

  createBrand: lcmMemberProcedure.input(brandInput).mutation(async ({ ctx, input }) => {
    if (ctx.lcmMembership.memberType !== "company" && ctx.lcmMembership.memberType !== "agency") {
      throw new TRPCError({ code: "FORBIDDEN", message: "企業・事務所会員だけがブランドを作成できます" });
    }
    const db = await requireDb();
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

  claimCatalogBrand: lcmMemberProcedure.input(z.object({ sourceCatalogPage: z.number().int().min(2).max(32), displayName: z.string().trim().min(1).max(255), message: z.string().trim().max(3000).optional() }).strict()).mutation(async ({ ctx, input }) => {
    if (ctx.lcmMembership.memberType !== "company" && ctx.lcmMembership.memberType !== "agency") throw new TRPCError({ code: "FORBIDDEN", message: "企業・事務所会員だけが申請できます" });
    const db = await requireDb();
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
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [brand] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    const products = await db.select().from(lcmProducts).where(eq(lcmProducts.brandProfileId, input.brandId)).orderBy(desc(lcmProducts.updatedAt));
    return { brand, products };
  }),

  updateBrand: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), data: brandInput.partial().refine((value) => Object.keys(value).length > 0, "更新内容がありません") }).strict()).mutation(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [before] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    const data = Object.fromEntries(Object.entries(input.data).map(([key, value]) => [key, typeof value === "string" ? cleanNullable(value) : value]));
    await db.update(lcmBrandProfiles).set({ ...data, status: before.status === "published" ? "submitted" : before.status, submittedAt: before.status === "published" ? new Date() : before.submittedAt, rejectionReason: null }).where(eq(lcmBrandProfiles.id, input.brandId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand", entityId: input.brandId, action: "updated", before: { status: before.status }, after: { fields: Object.keys(input.data) } });
    return { success: true };
  }),

  submitBrand: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const [brand] = await db.select().from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, input.brandId)).limit(1);
    if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドが見つかりません" });
    if (!brand.displayName || !brand.description || !brand.category || !brand.coverUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "ブランド名、カテゴリ、紹介文、カバー画像を入力してください" });
    await db.update(lcmBrandProfiles).set({ status: "submitted", submittedAt: new Date(), rejectionReason: null }).where(eq(lcmBrandProfiles.id, input.brandId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "brand", entityId: input.brandId, action: "submitted", before: { status: brand.status }, after: { status: "submitted" } });
    return { success: true };
  }),

  createProduct: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), data: productInput }).strict()).mutation(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
    const db = await requireDb();
    const result = await db.insert(lcmProducts).values({
      brandProfileId: input.brandId, slug: `${slugify(input.data.name)}-${nanoid(7).toLowerCase()}`, name: input.data.name,
      sku: cleanNullable(input.data.sku), category: cleanNullable(input.data.category), summary: cleanNullable(input.data.summary),
      description: cleanNullable(input.data.description), highlights: input.data.highlights || [], relatedProductsText: cleanNullable(input.data.relatedProductsText),
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
    await requireActiveBrandMember(ctx.lcmAccount.accountId, before.brandProfileId);
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.data)) {
      if (key === "listPrice" || key === "wholesalePrice") data[key] = value == null ? null : String(value);
      else data[key] = typeof value === "string" ? cleanNullable(value) : value;
    }
    await db.update(lcmProducts).set({ ...data, status: before.status === "published" ? "submitted" : before.status, submittedAt: before.status === "published" ? new Date() : before.submittedAt, rejectionReason: null }).where(eq(lcmProducts.id, input.productId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "product", entityId: input.productId, action: "updated", before: { status: before.status }, after: { fields: Object.keys(input.data) } });
    return { success: true };
  }),

  submitProduct: lcmMemberProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [product] = await db.select().from(lcmProducts).where(eq(lcmProducts.id, input.productId)).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    await requireActiveBrandMember(ctx.lcmAccount.accountId, product.brandProfileId);
    if (!product.name || !product.category || !product.summary || !product.primaryImageUrl || product.listPrice == null) throw new TRPCError({ code: "BAD_REQUEST", message: "商品名、カテゴリ、要約、価格、メイン画像を入力してください" });
    const wholesaleStarted = product.wholesalePrice != null || product.wholesaleMinQuantity != null || Boolean(product.wholesaleShippingTerms) || Boolean(product.wholesalePaymentTerms);
    if (wholesaleStarted && (product.wholesalePrice == null || product.wholesaleMinQuantity == null || !product.wholesaleShippingTerms || !product.wholesalePaymentTerms)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "卸価格、最小発注数、送料条件、支払条件をすべて入力してください" });
    }
    if (product.sampleAvailable && product.sampleMonthlyLimit == null) throw new TRPCError({ code: "BAD_REQUEST", message: "月間サンプル上限を入力してください" });
    await db.update(lcmProducts).set({ status: "submitted", submittedAt: new Date(), rejectionReason: null }).where(eq(lcmProducts.id, input.productId));
    await writeAudit({ actorAccountId: ctx.lcmAccount.accountId, actorRole: "brand_owner", entityType: "product", entityId: input.productId, action: "submitted", before: { status: product.status }, after: { status: "submitted" } });
    return { success: true };
  }),

  uploadImage: lcmMemberProcedure.input(z.object({ brandId: z.number().int().positive(), fileName: z.string().trim().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64Data: z.string().min(1).max(7_500_000) }).strict()).mutation(async ({ ctx, input }) => {
    await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId);
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
    return { memberships, brands, brandMembers, products, creators, samples, wholesale };
  }),

  reviewMembership: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "suspended"]), reviewNote: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmMemberships).where(eq(lcmMemberships.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "会員申請が見つかりません" });
    if (input.status !== "approved" && !cleanNullable(input.reviewNote)) throw new TRPCError({ code: "BAD_REQUEST", message: "理由を入力してください" });
    await db.update(lcmMemberships).set({ status: input.status, reviewNote: cleanNullable(input.reviewNote), reviewedBy: ctx.lcmAdmin.id, reviewedAt: new Date() }).where(eq(lcmMemberships.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "membership", entityId: input.id, action: "reviewed", before: { status: before.status }, after: { status: input.status } });
    const email = await accountEmail(db, before.festivalAccountId);
    const statusLabel = input.status === "approved" ? "承認" : input.status === "rejected" ? "見送り" : "利用停止";
    const isLiver = before.memberType === "liver";
    const notification = email ? await notifyLcm({
      to: [email],
      subject: input.status === "approved" ? "【LCM】会員登録が承認されました" : `【LCM】会員登録の審査結果（${statusLabel}）`,
      content: input.status === "approved"
        ? isLiver
          ? `LCM会員登録が承認されました。\n\nライバー公式ページの作成、商品検索、サンプル申請をご利用いただけます。\n公式プロフィールを作成する：\n${LCM_BASE_URL}/manage?creator=profile${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}`
          : `LCM会員登録が承認されました。\n\nブランドページの作成・商品登録、サンプル申請、卸商談をご利用いただけます。\nブランド管理を開く：\n${LCM_BASE_URL}/manage${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}`
        : `LCM会員登録の審査結果は「${statusLabel}」です。${cleanNullable(input.reviewNote) ? `\n\n運営からの連絡：${cleanNullable(input.reviewNote)}` : ""}\n\n${LCM_BASE_URL}/manage`,
      entityType: "membership",
      entityId: input.id,
    }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, notification };
  }),

  resendMembershipApprovalEmail: lcmAdminProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [membership] = await db.select().from(lcmMemberships).where(eq(lcmMemberships.id, input.id)).limit(1);
    if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "会員が見つかりません" });
    if (membership.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "承認済み会員だけに案内メールを再送できます" });
    const email = await accountEmail(db, membership.festivalAccountId);
    const isLiver = membership.memberType === "liver";
    const notification = email ? await notifyLcm({
      to: [email],
      subject: isLiver ? "【LCM】会員登録承認とライバー公式ページ作成のご案内" : "【LCM】会員登録承認とブランドページ作成のご案内",
      content: isLiver
        ? `LCM会員登録は承認済みです。\n\nライバー公式ページの作成、商品検索、サンプル申請をご利用いただけます。\n公式プロフィールを作成する：\n${LCM_BASE_URL}/manage?creator=profile`
        : `LCM会員登録は承認済みです。\n\nブランドページの作成・商品登録、サンプル申請、卸商談をご利用いただけます。\nブランド管理を開く：\n${LCM_BASE_URL}/manage`,
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
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ライバープロフィールが見つかりません" });
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
      subject: `【LCM】ライバー公式ページ審査結果：${before.displayName}`,
      content: input.status === "published"
        ? `${before.displayName}のライバー公式ページが公開承認されました。\n\n公開ページ：\n${LCM_BASE_URL}/creators/${before.slug}\n\nプロフィール管理：\n${LCM_BASE_URL}/manage?creator=profile`
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
    if (input.status === "rejected" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "却下理由を入力してください" });
    await db.update(lcmBrandProfiles).set({ status: input.status, publishedAt: input.status === "published" ? new Date() : before.publishedAt, reviewedBy: ctx.lcmAdmin.id, reviewedAt: new Date(), rejectionReason: input.status === "rejected" ? cleanNullable(input.reason) : null }).where(eq(lcmBrandProfiles.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "brand", entityId: input.id, action: "reviewed", before: { status: before.status }, after: { status: input.status } });
    const owners = await brandOwnerEmails(db, input.id);
    const statusLabel = input.status === "published" ? "公開承認" : input.status === "rejected" ? "要修正" : "公開停止";
    const notification = await notifyLcm({ to: owners, subject: `【LCM】ブランド審査結果：${before.displayName}`, content: input.status === "published" ? `${before.displayName}のブランドページが公開承認されました。\n\n公開ページ：\n${LCM_BASE_URL}/brands/${before.slug}\n\nブランド管理：\n${LCM_BASE_URL}/manage?brand=${before.id}` : `${before.displayName}のブランド審査結果は「${statusLabel}」です。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?brand=${before.id}`, entityType: "brand", entityId: input.id });
    return { success: true, notification };
  }),

  reviewBrandClaim: lcmAdminProcedure.input(z.object({ memberId: z.number().int().positive(), status: z.enum(["active", "rejected"]), reason: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmBrandMembers).where(eq(lcmBrandMembers.id, input.memberId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランド管理申請が見つかりません" });
    if (before.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "この申請は既に処理されています" });
    if (input.status === "rejected" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "却下理由を入力してください" });
    if (input.status === "active") {
      await db.update(lcmBrandMembers).set({ status: "rejected", approvedBy: ctx.lcmAdmin.id, approvedAt: new Date() })
        .where(and(eq(lcmBrandMembers.brandProfileId, before.brandProfileId), eq(lcmBrandMembers.status, "pending")));
      await db.update(lcmBrandMembers).set({ status: "active", approvedBy: ctx.lcmAdmin.id, approvedAt: new Date() })
        .where(eq(lcmBrandMembers.id, input.memberId));
      await db.update(lcmBrandProfiles).set({ claimStatus: "claimed" }).where(eq(lcmBrandProfiles.id, before.brandProfileId));
    } else {
      await db.update(lcmBrandMembers).set({ status: "rejected", approvedBy: ctx.lcmAdmin.id, approvedAt: new Date() })
        .where(eq(lcmBrandMembers.id, input.memberId));
    }
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "brand_claim", entityId: input.memberId, action: "reviewed", before: { status: before.status }, after: { status: input.status, reason: cleanNullable(input.reason) } });
    const email = await accountEmail(db, before.festivalAccountId);
    const statusLabel = input.status === "active" ? "承認" : "見送り";
    const notification = email ? await notifyLcm({ to: [email], subject: input.status === "active" ? "【LCM】ブランド管理申請が承認されました" : "【LCM】ブランド管理申請の審査結果", content: input.status === "active" ? `ブランド管理申請が承認されました。ブランド情報と商品を入力・更新できます。\n\nブランド管理を開く：\n${LCM_BASE_URL}/manage?brand=${before.brandProfileId}` : `ブランド管理申請の審査結果は「${statusLabel}」です。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage`, entityType: "brand_claim", entityId: input.memberId }) : { recipientCount: 0, success: false, provider: null, errorCode: "recipient_missing" };
    return { success: true, notification };
  }),

  reviewProduct: lcmAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["published", "rejected", "suspended"]), reason: nullableText(5000) }).strict()).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [before] = await db.select().from(lcmProducts).where(eq(lcmProducts.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
    if (input.status === "rejected" && !cleanNullable(input.reason)) throw new TRPCError({ code: "BAD_REQUEST", message: "却下理由を入力してください" });
    const [brand] = await db.select({ status: lcmBrandProfiles.status }).from(lcmBrandProfiles).where(eq(lcmBrandProfiles.id, before.brandProfileId)).limit(1);
    if (input.status === "published" && brand?.status !== "published") throw new TRPCError({ code: "BAD_REQUEST", message: "ブランドを先に公開してください" });
    await db.update(lcmProducts).set({ status: input.status, publishedAt: input.status === "published" ? new Date() : before.publishedAt, reviewedBy: ctx.lcmAdmin.id, reviewedAt: new Date(), rejectionReason: input.status === "rejected" ? cleanNullable(input.reason) : null }).where(eq(lcmProducts.id, input.id));
    await writeAudit({ actorAccountId: ctx.lcmAdmin.id, actorRole: "admin", entityType: "product", entityId: input.id, action: "reviewed", before: { status: before.status }, after: { status: input.status } });
    const owners = await brandOwnerEmails(db, before.brandProfileId);
    const statusLabel = input.status === "published" ? "公開承認" : input.status === "rejected" ? "要修正" : "公開停止";
    const notification = await notifyLcm({ to: owners, subject: `【LCM】商品審査結果：${before.name}`, content: input.status === "published" ? `${before.name}が公開承認されました。\n\n公開ページ：\n${LCM_BASE_URL}/products/${before.slug}` : `${before.name}の商品審査結果は「${statusLabel}」です。${cleanNullable(input.reason) ? `\n\n運営からの連絡：${cleanNullable(input.reason)}` : ""}\n\n${LCM_BASE_URL}/manage?brand=${before.brandProfileId}`, entityType: "product", entityId: input.id });
    return { success: true, notification };
  }),

  adminAuditLogs: lcmAdminProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional()).query(async ({ input }) => {
    const db = await requireDb();
    return db.select().from(lcmAuditLogs).orderBy(desc(lcmAuditLogs.createdAt)).limit(input?.limit ?? 200);
  }),
});
