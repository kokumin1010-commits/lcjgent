import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("confirmed").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  checkinToken: varchar("checkin_token", { length: 32 }),
  checkedInAt: timestamp("checked_in_at"),
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
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("confirmed").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  checkinToken: varchar("checkin_token", { length: 32 }),
  checkedInAt: timestamp("checked_in_at"),
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
  lineOrLark: varchar("line_or_lark", { length: 255 }),
  brandName: varchar("brand_name", { length: 255 }),
  industryTypes: json("industry_types").$type<string[]>(),
  attendanceSchedule: mysqlEnum("attendance_schedule", ["day1_only", "day2_only", "both_days"]).notNull(),
  visitPurposes: json("visit_purposes").$type<string[]>().notNull(),
  portraitRightsConsent: mysqlEnum("portrait_rights_consent", ["agreed"]).notNull(),
  complianceConsent: mysqlEnum("compliance_consent", ["agreed"]).notNull(),
  // メタ情報
  status: mysqlEnum("status", ["new", "confirmed", "rejected", "cancelled"]).default("confirmed").notNull(),
  notes: text("notes"),
  eventYear: varchar("event_year", { length: 10 }).notNull().default("2026"),
  checkinToken: varchar("checkin_token", { length: 32 }),
  checkedInAt: timestamp("checked_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  emailYearUnique: uniqueIndex("uk_festival_general_email_year").on(table.email, table.eventYear),
}));
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
  authVersion: int("auth_version").default(1).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FestivalAccount = typeof festivalAccounts.$inferSelect;
export type InsertFestivalAccount = typeof festivalAccounts.$inferInsert;

/**
 * Live Commerce Festival - パスワードリセット用ワンタイムトークン
 * 生トークンは保存せず、SHA-256ハッシュのみを保持する。
 */
export const festivalPasswordResetTokens = mysqlTable("festival_password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex("uk_festival_password_reset_token_hash").on(table.tokenHash),
  accountActiveIndex: index("idx_festival_password_reset_account_active").on(table.accountId, table.usedAt, table.expiresAt),
}));
export type FestivalPasswordResetToken = typeof festivalPasswordResetTokens.$inferSelect;
export type InsertFestivalPasswordResetToken = typeof festivalPasswordResetTokens.$inferInsert;

/**
 * Live Commerce Festival - メール配信監査
 * 完全な宛先は保存せず、アカウントID・宛先ハッシュ・ドメインのみ保持する。
 */
export const festivalEmailDeliveryLogs = mysqlTable("festival_email_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  recipientHash: varchar("recipient_hash", { length: 64 }).notNull(),
  recipientDomain: varchar("recipient_domain", { length: 255 }).notNull(),
  purpose: mysqlEnum("purpose", ["password_reset", "password_changed"]).notNull(),
  source: mysqlEnum("source", ["self_service", "mypage", "admin"]).notNull(),
  status: mysqlEnum("status", ["accepted", "failed"]).notNull(),
  provider: varchar("provider", { length: 32 }),
  messageId: varchar("message_id", { length: 255 }),
  errorCode: varchar("error_code", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountCreatedIndex: index("idx_festival_email_delivery_account_created").on(table.accountId, table.createdAt),
  statusCreatedIndex: index("idx_festival_email_delivery_status_created").on(table.status, table.createdAt),
}));
export type FestivalEmailDeliveryLog = typeof festivalEmailDeliveryLogs.$inferSelect;
export type InsertFestivalEmailDeliveryLog = typeof festivalEmailDeliveryLogs.$inferInsert;

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

/**
 * Live Commerce Festival - アクティビティログ（アカウントの操作履歴）
 */
export const festivalActivityLogs = mysqlTable("festival_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  accountEmail: varchar("account_email", { length: 320 }).notNull(),
  accountType: mysqlEnum("account_type", ["company", "liver", "general", "admin"]).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // login, logout, view_dashboard, submit_application, update_profile, password_reset, etc.
  details: text("details"), // JSON形式で追加情報
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FestivalActivityLog = typeof festivalActivityLogs.$inferSelect;
export type InsertFestivalActivityLog = typeof festivalActivityLogs.$inferInsert;
