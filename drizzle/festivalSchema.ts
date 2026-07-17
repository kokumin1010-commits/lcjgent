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

/**
 * Live Commerce Festival - アカウント（フォーム送信時に自動作成）
 */
export const festivalAccounts = mysqlTable("festival_accounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  accountType: mysqlEnum("account_type", ["company", "liver", "general", "admin"]).notNull(),
  role: mysqlEnum("role", ["applicant", "admin"]).default("applicant").notNull(),
  applicationId: int("application_id"),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalAccount = typeof festivalAccounts.$inferSelect;
export type InsertFestivalAccount = typeof festivalAccounts.$inferInsert;

/**
 * Live Commerce Festival - イベント設定
 */
export const festivalEventSettings = mysqlTable("festival_event_settings", {
  id: int("id").autoincrement().primaryKey(),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  eventName: varchar("event_name", { length: 255 }).notNull().default("Live Commerce Festival 2026"),
  venue: varchar("venue", { length: 500 }),
  venueAddress: text("venue_address"),
  day1Date: varchar("day1_date", { length: 50 }),
  day2Date: varchar("day2_date", { length: 50 }),
  day1StartTime: varchar("day1_start_time", { length: 20 }),
  day1EndTime: varchar("day1_end_time", { length: 20 }),
  day2StartTime: varchar("day2_start_time", { length: 20 }),
  day2EndTime: varchar("day2_end_time", { length: 20 }),
  maxCapacity: int("max_capacity"),
  description: text("description"),
  programs: json("programs").$type<{ time: string; title: string; speaker?: string; description?: string }[]>(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalEventSetting = typeof festivalEventSettings.$inferSelect;
export type InsertFestivalEventSetting = typeof festivalEventSettings.$inferInsert;

/**
 * Live Commerce Festival - スポンサー管理
 */
export const festivalSponsors = mysqlTable("festival_sponsors", {
  id: int("id").autoincrement().primaryKey(),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  tier: mysqlEnum("tier", ["platinum", "gold", "silver", "bronze", "partner"]).notNull().default("bronze"),
  logoUrl: varchar("logo_url", { length: 500 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  sponsorshipAmount: int("sponsorship_amount"),
  boothSize: varchar("booth_size", { length: 50 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalSponsor = typeof festivalSponsors.$inferSelect;
export type InsertFestivalSponsor = typeof festivalSponsors.$inferInsert;

/**
 * Live Commerce Festival - LINE登録者データ
 */
export const festivalLineRegistrations = mysqlTable("festival_line_registrations", {
  id: int("id").autoincrement().primaryKey(),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  lineUserId: varchar("line_user_id", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  registeredFrom: varchar("registered_from", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FestivalLineRegistration = typeof festivalLineRegistrations.$inferSelect;
export type InsertFestivalLineRegistration = typeof festivalLineRegistrations.$inferInsert;
