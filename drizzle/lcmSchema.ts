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
export type LcmBrandProfile = typeof lcmBrandProfiles.$inferSelect;
export type InsertLcmBrandProfile = typeof lcmBrandProfiles.$inferInsert;
export type LcmBrandMember = typeof lcmBrandMembers.$inferSelect;
export type InsertLcmBrandMember = typeof lcmBrandMembers.$inferInsert;
export type LcmProduct = typeof lcmProducts.$inferSelect;
export type InsertLcmProduct = typeof lcmProducts.$inferInsert;
export type LcmSampleRequest = typeof lcmSampleRequests.$inferSelect;
export type InsertLcmSampleRequest = typeof lcmSampleRequests.$inferInsert;
export type LcmWholesaleInquiry = typeof lcmWholesaleInquiries.$inferSelect;
export type InsertLcmWholesaleInquiry = typeof lcmWholesaleInquiries.$inferInsert;
export type LcmAuditLog = typeof lcmAuditLogs.$inferSelect;
export type InsertLcmAuditLog = typeof lcmAuditLogs.$inferInsert;
