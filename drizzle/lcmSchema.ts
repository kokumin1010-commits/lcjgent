import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * LCM uses the existing LCF login as its identity boundary.
 * Existing company accounts may activate LCM after explicitly accepting the LCM
 * terms. Brand ownership remains a separate reviewed permission boundary.
 */
export const lcmMemberships = mysqlTable("lcm_memberships", {
  id: int("id").autoincrement().primaryKey(),
  festivalAccountId: int("festivalAccountId").notNull(),
  memberType: mysqlEnum("memberType", ["company", "liver", "agency", "buyer"]).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  businessName: varchar("businessName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "suspended"]).default("pending").notNull(),
  termsVersion: varchar("termsVersion", { length: 32 }).notNull(),
  agreedAt: timestamp("agreedAt").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: text("reviewNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_membership_account").on(table.festivalAccountId),
  index("idx_lcm_membership_status").on(table.status, table.updatedAt),
]);

export const lcmCreatorProfiles = mysqlTable("lcm_creator_profiles", {
  id: int("id").autoincrement().primaryKey(),
  festivalAccountId: int("festivalAccountId").notNull(),
  sourceFestivalApplicationId: int("sourceFestivalApplicationId"),
  slug: varchar("slug", { length: 180 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  profileImageUrl: text("profileImageUrl"),
  profileImageKey: varchar("profileImageKey", { length: 512 }),
  coverImageUrl: text("coverImageUrl"),
  coverImageKey: varchar("coverImageKey", { length: 512 }),
  bio: text("bio"),
  categories: json("categories").$type<string[]>(),
  supportsLive: boolean("supportsLive").default(false).notNull(),
  supportsShortVideo: boolean("supportsShortVideo").default(false).notNull(),
  languages: json("languages").$type<string[]>(),
  activityRegions: json("activityRegions").$type<string[]>(),
  agencyName: varchar("agencyName", { length: 255 }),
  tiktokUrl: varchar("tiktokUrl", { length: 1000 }),
  instagramUrl: varchar("instagramUrl", { length: 1000 }),
  youtubeUrl: varchar("youtubeUrl", { length: 1000 }),
  portfolioUrls: json("portfolioUrls").$type<string[]>(),
  followerRange: mysqlEnum("followerRange", ["not_disclosed", "under_1k", "1k_10k", "10k_50k", "50k_100k", "100k_500k", "500k_plus"]).default("not_disclosed").notNull(),
  averageViewRange: mysqlEnum("averageViewRange", ["not_disclosed", "under_50", "50_200", "200_500", "500_1000", "1000_plus"]).default("not_disclosed").notNull(),
  performanceSummary: text("performanceSummary"),
  metricsVerification: mysqlEnum("metricsVerification", ["not_submitted", "self_reported", "evidence_submitted", "verified"]).default("not_submitted").notNull(),
  metricsAsOf: timestamp("metricsAsOf"),
  availabilityNote: text("availabilityNote"),
  acceptingOffers: boolean("acceptingOffers").default(true).notNull(),
  publicConsentAt: timestamp("publicConsentAt"),
  status: mysqlEnum("status", ["draft", "submitted", "published", "rejected", "suspended", "archived"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  publishedAt: timestamp("publishedAt"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_creator_account").on(table.festivalAccountId),
  uniqueIndex("uq_lcm_creator_slug").on(table.slug),
  index("idx_lcm_creator_public").on(table.status, table.acceptingOffers, table.publishedAt),
  index("idx_lcm_creator_source").on(table.sourceFestivalApplicationId),
]);

export const lcmBrandProfiles = mysqlTable("lcm_brand_profiles", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 180 }).notNull(),
  sourceBrandId: int("sourceBrandId"),
  sourceFestivalApplicationId: int("sourceFestivalApplicationId"),
  sourceCatalogPage: int("sourceCatalogPage"),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  category: varchar("category", { length: 120 }),
  tagline: varchar("tagline", { length: 500 }),
  description: text("description"),
  story: text("story"),
  logoUrl: text("logoUrl"),
  logoKey: varchar("logoKey", { length: 512 }),
  coverUrl: text("coverUrl"),
  coverKey: varchar("coverKey", { length: 512 }),
  officialWebsiteUrl: varchar("officialWebsiteUrl", { length: 1000 }),
  tiktokShopUrl: varchar("tiktokShopUrl", { length: 1000 }),
  amazonUrl: varchar("amazonUrl", { length: 1000 }),
  rakutenUrl: varchar("rakutenUrl", { length: 1000 }),
  otherSalesUrl: varchar("otherSalesUrl", { length: 1000 }),
  status: mysqlEnum("status", ["draft", "submitted", "published", "rejected", "suspended", "archived"]).default("draft").notNull(),
  claimStatus: mysqlEnum("claimStatus", ["unclaimed", "pending", "claimed"]).default("unclaimed").notNull(),
  createdByAccountId: int("createdByAccountId"),
  submittedAt: timestamp("submittedAt"),
  publishedAt: timestamp("publishedAt"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_brand_slug").on(table.slug),
  uniqueIndex("uq_lcm_brand_catalog_page").on(table.sourceCatalogPage),
  index("idx_lcm_brand_public").on(table.status, table.category, table.publishedAt),
  index("idx_lcm_brand_source").on(table.sourceBrandId, table.sourceFestivalApplicationId),
]);

export const lcmBrandMembers = mysqlTable("lcm_brand_members", {
  id: int("id").autoincrement().primaryKey(),
  brandProfileId: int("brandProfileId").notNull(),
  festivalAccountId: int("festivalAccountId").notNull(),
  role: mysqlEnum("role", ["owner", "editor"]).default("owner").notNull(),
  status: mysqlEnum("status", ["pending", "active", "rejected", "revoked"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_brand_member").on(table.brandProfileId, table.festivalAccountId),
  index("idx_lcm_brand_member_account").on(table.festivalAccountId, table.status),
]);

export const lcmProducts = mysqlTable("lcm_products", {
  id: int("id").autoincrement().primaryKey(),
  brandProfileId: int("brandProfileId").notNull(),
  slug: varchar("slug", { length: 220 }).notNull(),
  sku: varchar("sku", { length: 120 }),
  name: varchar("name", { length: 500 }).notNull(),
  category: varchar("category", { length: 120 }),
  summary: varchar("summary", { length: 1000 }),
  description: text("description"),
  highlights: json("highlights").$type<string[]>(),
  thirtySecondPitch: text("thirtySecondPitch"),
  demoInstructions: text("demoInstructions"),
  targetAudience: text("targetAudience"),
  prohibitedClaims: text("prohibitedClaims"),
  relatedProductsText: text("relatedProductsText"),
  listPrice: decimal("listPrice", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 16 }).default("JPY").notNull(),
  taxMode: mysqlEnum("taxMode", ["included", "excluded", "unknown"]).default("unknown").notNull(),
  wholesalePrice: decimal("wholesalePrice", { precision: 12, scale: 2 }),
  wholesaleMinQuantity: int("wholesaleMinQuantity"),
  wholesaleShippingTerms: text("wholesaleShippingTerms"),
  wholesalePaymentTerms: text("wholesalePaymentTerms"),
  wholesaleValidUntil: timestamp("wholesaleValidUntil"),
  commissionRate: varchar("commissionRate", { length: 50 }),
  sampleAvailable: boolean("sampleAvailable").default(false).notNull(),
  sampleMonthlyLimit: int("sampleMonthlyLimit"),
  sampleInstructions: text("sampleInstructions"),
  stockDisclosure: mysqlEnum("stockDisclosure", ["hidden", "range", "exact"]).default("hidden").notNull(),
  stockQuantity: int("stockQuantity"),
  primaryImageUrl: text("primaryImageUrl"),
  imageUrls: json("imageUrls").$type<string[]>(),
  imageKeys: json("imageKeys").$type<string[]>(),
  officialProductUrl: varchar("officialProductUrl", { length: 1000 }),
  tiktokShopUrl: varchar("tiktokShopUrl", { length: 1000 }),
  amazonUrl: varchar("amazonUrl", { length: 1000 }),
  rakutenUrl: varchar("rakutenUrl", { length: 1000 }),
  status: mysqlEnum("status", ["draft", "submitted", "published", "rejected", "suspended", "archived"]).default("draft").notNull(),
  sourceKind: mysqlEnum("sourceKind", ["brand", "lcf_catalog", "admin"]).default("brand").notNull(),
  sourceReference: varchar("sourceReference", { length: 255 }),
  createdByAccountId: int("createdByAccountId"),
  submittedAt: timestamp("submittedAt"),
  publishedAt: timestamp("publishedAt"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_product_slug").on(table.slug),
  uniqueIndex("uq_lcm_product_source").on(table.sourceKind, table.sourceReference),
  index("idx_lcm_product_public").on(table.status, table.category, table.publishedAt),
  index("idx_lcm_product_brand").on(table.brandProfileId, table.status, table.updatedAt),
]);

export const lcmCampaigns = mysqlTable("lcm_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  brandProfileId: int("brandProfileId").notNull(),
  slug: varchar("slug", { length: 220 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: varchar("summary", { length: 1000 }),
  description: text("description"),
  heroImageUrl: text("heroImageUrl"),
  commissionRateMin: decimal("commissionRateMin", { precision: 5, scale: 2 }),
  commissionRateMax: decimal("commissionRateMax", { precision: 5, scale: 2 }),
  discountRateMin: decimal("discountRateMin", { precision: 5, scale: 2 }),
  discountRateMax: decimal("discountRateMax", { precision: 5, scale: 2 }),
  rewardNotes: text("rewardNotes"),
  trackingMethod: mysqlEnum("trackingMethod", ["platform", "coupon", "affiliate_link", "manual_report", "other"]).default("other").notNull(),
  settlementTerms: text("settlementTerms"),
  eligibility: text("eligibility"),
  creativeGuidance: text("creativeGuidance"),
  prohibitedClaims: text("prohibitedClaims"),
  sampleAvailable: boolean("sampleAvailable").default(false).notNull(),
  samplePolicy: text("samplePolicy"),
  applicationNotes: text("applicationNotes"),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  status: mysqlEnum("status", ["draft", "published", "suspended", "archived"]).default("draft").notNull(),
  createdByAccountId: int("createdByAccountId"),
  publishedAt: timestamp("publishedAt"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  moderationReason: text("moderationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_campaign_slug").on(table.slug),
  index("idx_lcm_campaign_public").on(table.status, table.startsAt, table.endsAt, table.publishedAt),
  index("idx_lcm_campaign_brand").on(table.brandProfileId, table.status, table.updatedAt),
]);

export const lcmCampaignProducts = mysqlTable("lcm_campaign_products", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  productId: int("productId").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_campaign_product").on(table.campaignId, table.productId),
  index("idx_lcm_campaign_product_order").on(table.campaignId, table.displayOrder),
  index("idx_lcm_campaign_product_product").on(table.productId, table.campaignId),
]);

export const lcmSampleRequests = mysqlTable("lcm_sample_requests", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  requestCode: varchar("requestCode", { length: 32 }).notNull(),
  productId: int("productId").notNull(),
  brandProfileId: int("brandProfileId").notNull(),
  requesterAccountId: int("requesterAccountId").notNull(),
  purpose: text("purpose").notNull(),
  plannedContentType: mysqlEnum("plannedContentType", ["live", "short_video", "both", "other"]).notNull(),
  plannedDate: timestamp("plannedDate"),
  message: text("message"),
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  postalCode: varchar("postalCode", { length: 20 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "preparing", "shipped", "delivered", "live_scheduled", "completed", "cancelled"]).default("pending").notNull(),
  brandReply: text("brandReply"),
  trackingCarrier: varchar("trackingCarrier", { length: 100 }),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  reviewedByAccountId: int("reviewedByAccountId"),
  reviewedAt: timestamp("reviewedAt"),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  liveUrl: varchar("liveUrl", { length: 1000 }),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_sample_code").on(table.requestCode),
  index("idx_lcm_sample_requester").on(table.requesterAccountId, table.status, table.updatedAt),
  index("idx_lcm_sample_brand").on(table.brandProfileId, table.status, table.updatedAt),
  index("idx_lcm_sample_product").on(table.productId, table.requesterAccountId, table.status),
]);

export const lcmWholesaleInquiries = mysqlTable("lcm_wholesale_inquiries", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  inquiryCode: varchar("inquiryCode", { length: 32 }).notNull(),
  productId: int("productId").notNull(),
  brandProfileId: int("brandProfileId").notNull(),
  requesterAccountId: int("requesterAccountId").notNull(),
  requestedQuantity: int("requestedQuantity").notNull(),
  intendedUse: text("intendedUse").notNull(),
  requestedStartDate: timestamp("requestedStartDate"),
  message: text("message"),
  status: mysqlEnum("status", ["requested", "reviewing", "accepted", "declined", "negotiating", "completed", "cancelled"]).default("requested").notNull(),
  brandReply: text("brandReply"),
  negotiatedTerms: text("negotiatedTerms"),
  reviewedByAccountId: int("reviewedByAccountId"),
  reviewedAt: timestamp("reviewedAt"),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_inquiry_code").on(table.inquiryCode),
  index("idx_lcm_inquiry_requester").on(table.requesterAccountId, table.status, table.updatedAt),
  index("idx_lcm_inquiry_brand").on(table.brandProfileId, table.status, table.updatedAt),
]);

export const lcmBrandContacts = mysqlTable("lcm_brand_contacts", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  contactCode: varchar("contactCode", { length: 32 }).notNull(),
  productId: int("productId").notNull(),
  brandProfileId: int("brandProfileId").notNull(),
  requesterAccountId: int("requesterAccountId").notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["open", "replied", "closed"]).default("open").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_brand_contact_code").on(table.contactCode),
  index("idx_lcm_brand_contact_requester").on(table.requesterAccountId, table.lastMessageAt),
  index("idx_lcm_brand_contact_brand").on(table.brandProfileId, table.status, table.lastMessageAt),
  index("idx_lcm_brand_contact_product").on(table.productId, table.lastMessageAt),
]);

export const lcmBrandContactMessages = mysqlTable("lcm_brand_contact_messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  contactId: bigint("contactId", { mode: "number" }).notNull(),
  senderAccountId: int("senderAccountId").notNull(),
  senderRole: mysqlEnum("senderRole", ["requester", "brand"]).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_lcm_brand_contact_message_thread").on(table.contactId, table.id),
  index("idx_lcm_brand_contact_message_sender").on(table.senderAccountId, table.createdAt),
]);

export const lcmProductInterests = mysqlTable("lcm_product_interests", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  festivalAccountId: int("festivalAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_product_interest").on(table.productId, table.festivalAccountId),
  index("idx_lcm_interest_account").on(table.festivalAccountId, table.createdAt),
  index("idx_lcm_interest_product").on(table.productId, table.createdAt),
]);

export const lcmSampleCartItems = mysqlTable("lcm_sample_cart_items", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  festivalAccountId: int("festivalAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_sample_cart_item").on(table.productId, table.festivalAccountId),
  index("idx_lcm_sample_cart_account").on(table.festivalAccountId, table.createdAt),
  index("idx_lcm_sample_cart_product").on(table.productId, table.createdAt),
]);

export const lcmBrandEventParticipations = mysqlTable("lcm_brand_event_participations", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  brandProfileId: int("brandProfileId").notNull(),
  eventKey: varchar("eventKey", { length: 32 }).notNull(),
  eventLabel: varchar("eventLabel", { length: 120 }).notNull(),
  archivePath: varchar("archivePath", { length: 500 }).notNull(),
  verificationSource: mysqlEnum("verificationSource", ["lcf_catalog", "festival_application", "admin"]).notNull(),
  sourceReference: varchar("sourceReference", { length: 255 }).notNull(),
  verifiedByAccountId: int("verifiedByAccountId"),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_brand_event").on(table.brandProfileId, table.eventKey),
  index("idx_lcm_event_participation").on(table.eventKey, table.verifiedAt),
  index("idx_lcm_event_brand").on(table.brandProfileId, table.verifiedAt),
]);

export const lcmProductReviews = mysqlTable("lcm_product_reviews", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  brandProfileId: int("brandProfileId").notNull(),
  reviewerAccountId: int("reviewerAccountId").notNull(),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  body: text("body").notNull(),
  verificationSource: mysqlEnum("verificationSource", ["sample_request", "wholesale_inquiry"]).notNull(),
  verificationEntityId: bigint("verificationEntityId", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "published", "rejected", "hidden"]).default("pending").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  publishedAt: timestamp("publishedAt"),
  moderatedByAccountId: int("moderatedByAccountId"),
  moderatedAt: timestamp("moderatedAt"),
  moderationNote: text("moderationNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_product_review").on(table.productId, table.reviewerAccountId),
  index("idx_lcm_review_public").on(table.productId, table.status, table.publishedAt),
  index("idx_lcm_review_brand").on(table.brandProfileId, table.status, table.updatedAt),
  index("idx_lcm_review_reviewer").on(table.reviewerAccountId, table.status, table.updatedAt),
]);

export const lcmReviewReports = mysqlTable("lcm_review_reports", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  reviewId: bigint("reviewId", { mode: "number" }).notNull(),
  reporterAccountId: int("reporterAccountId").notNull(),
  reason: mysqlEnum("reason", ["inaccurate", "privacy", "offensive", "conflict", "other"]).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["open", "resolved", "dismissed"]).default("open").notNull(),
  reviewedByAccountId: int("reviewedByAccountId"),
  reviewedAt: timestamp("reviewedAt"),
  resolutionNote: text("resolutionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("uq_lcm_review_reporter").on(table.reviewId, table.reporterAccountId),
  index("idx_lcm_review_report_status").on(table.status, table.updatedAt),
  index("idx_lcm_review_report_review").on(table.reviewId, table.status),
]);

export const lcmAuditLogs = mysqlTable("lcm_audit_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  actorAccountId: int("actorAccountId"),
  actorRole: varchar("actorRole", { length: 50 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  beforeJson: json("beforeJson").$type<Record<string, unknown>>(),
  afterJson: json("afterJson").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_lcm_audit_entity").on(table.entityType, table.entityId, table.createdAt),
  index("idx_lcm_audit_actor").on(table.actorAccountId, table.createdAt),
]);

export type LcmMembership = typeof lcmMemberships.$inferSelect;
export type InsertLcmMembership = typeof lcmMemberships.$inferInsert;
export type LcmCreatorProfile = typeof lcmCreatorProfiles.$inferSelect;
export type InsertLcmCreatorProfile = typeof lcmCreatorProfiles.$inferInsert;
export type LcmBrandProfile = typeof lcmBrandProfiles.$inferSelect;
export type InsertLcmBrandProfile = typeof lcmBrandProfiles.$inferInsert;
export type LcmBrandMember = typeof lcmBrandMembers.$inferSelect;
export type InsertLcmBrandMember = typeof lcmBrandMembers.$inferInsert;
export type LcmProduct = typeof lcmProducts.$inferSelect;
export type InsertLcmProduct = typeof lcmProducts.$inferInsert;
export type LcmCampaign = typeof lcmCampaigns.$inferSelect;
export type InsertLcmCampaign = typeof lcmCampaigns.$inferInsert;
export type LcmCampaignProduct = typeof lcmCampaignProducts.$inferSelect;
export type InsertLcmCampaignProduct = typeof lcmCampaignProducts.$inferInsert;
export type LcmSampleRequest = typeof lcmSampleRequests.$inferSelect;
export type InsertLcmSampleRequest = typeof lcmSampleRequests.$inferInsert;
export type LcmWholesaleInquiry = typeof lcmWholesaleInquiries.$inferSelect;
export type InsertLcmWholesaleInquiry = typeof lcmWholesaleInquiries.$inferInsert;
export type LcmBrandContact = typeof lcmBrandContacts.$inferSelect;
export type InsertLcmBrandContact = typeof lcmBrandContacts.$inferInsert;
export type LcmBrandContactMessage = typeof lcmBrandContactMessages.$inferSelect;
export type InsertLcmBrandContactMessage = typeof lcmBrandContactMessages.$inferInsert;
export type LcmProductInterest = typeof lcmProductInterests.$inferSelect;
export type InsertLcmProductInterest = typeof lcmProductInterests.$inferInsert;
export type LcmSampleCartItem = typeof lcmSampleCartItems.$inferSelect;
export type InsertLcmSampleCartItem = typeof lcmSampleCartItems.$inferInsert;
export type LcmBrandEventParticipation = typeof lcmBrandEventParticipations.$inferSelect;
export type InsertLcmBrandEventParticipation = typeof lcmBrandEventParticipations.$inferInsert;
export type LcmProductReview = typeof lcmProductReviews.$inferSelect;
export type InsertLcmProductReview = typeof lcmProductReviews.$inferInsert;
export type LcmReviewReport = typeof lcmReviewReports.$inferSelect;
export type InsertLcmReviewReport = typeof lcmReviewReports.$inferInsert;
export type LcmAuditLog = typeof lcmAuditLogs.$inferSelect;
export type InsertLcmAuditLog = typeof lcmAuditLogs.$inferInsert;
