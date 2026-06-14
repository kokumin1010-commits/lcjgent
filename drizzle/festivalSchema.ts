import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Live Commerce Festival - 企業申込み
 */
export const festivalCompanyApplications = mysqlTable("festival_company_applications", {
  id: int("id").autoincrement().primaryKey(),
  // Page 1: 基本情報
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  contactDepartment: varchar("contact_department", { length: 255 }).notNull(),
  contactNameKana: varchar("contact_name_kana", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  websiteUrl: varchar("website_url", { length: 500 }).notNull(),
  lineOrLark: varchar("line_or_lark", { length: 255 }),
  // Page 2: TikTok Shop情報
  tiktokShopSellerName: varchar("tiktok_shop_seller_name", { length: 255 }).notNull(),
  brandIntro: text("brand_intro").notNull(),
  tiktokShopUrl: varchar("tiktok_shop_url", { length: 500 }),
  matchingProducts: text("matching_products"),
  targetAudience: text("target_audience").notNull(),
  salesLicense: text("sales_license").notNull(),
  // メタ情報
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("new").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalCompanyApplication = typeof festivalCompanyApplications.$inferSelect;
export type InsertFestivalCompanyApplication = typeof festivalCompanyApplications.$inferInsert;

/**
 * Live Commerce Festival - ライバー＆インフルエンサー申込み
 */
export const festivalLiverApplications = mysqlTable("festival_liver_applications", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameKana: varchar("name_kana", { length: 255 }).notNull(),
  liverName: varchar("liver_name", { length: 255 }).notNull(),
  agency: varchar("agency", { length: 255 }),
  accountInfo: text("account_info"),
  genre: varchar("genre", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  lineOrLark: varchar("line_or_lark", { length: 255 }),
  attendanceSchedule: mysqlEnum("attendance_schedule", ["day1_only", "day2_only", "both_days"]).notNull(),
  matchingPreference: mysqlEnum("matching_preference", ["yes", "no"]).notNull(),
  portraitRightsConsent: mysqlEnum("portrait_rights_consent", ["agreed"]).notNull(),
  complianceConsent: mysqlEnum("compliance_consent", ["agreed"]).notNull(),
  // メタ情報
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("new").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalLiverApplication = typeof festivalLiverApplications.$inferSelect;
export type InsertFestivalLiverApplication = typeof festivalLiverApplications.$inferInsert;

/**
 * Live Commerce Festival - 一般来場申込み
 */
export const festivalGeneralApplications = mysqlTable("festival_general_applications", {
  id: int("id").autoincrement().primaryKey(),
  participationType: mysqlEnum("participation_type", ["corporate", "individual"]).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  nameKana: varchar("name_kana", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  attendanceSchedule: mysqlEnum("attendance_schedule", ["day1_only", "day2_only", "both_days"]).notNull(),
  visitPurposes: json("visit_purposes").$type<string[]>().notNull(),
  portraitRightsConsent: mysqlEnum("portrait_rights_consent", ["agreed"]).notNull(),
  complianceConsent: mysqlEnum("compliance_consent", ["agreed"]).notNull(),
  // メタ情報
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("new").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalGeneralApplication = typeof festivalGeneralApplications.$inferSelect;
export type InsertFestivalGeneralApplication = typeof festivalGeneralApplications.$inferInsert;
