/**
 * Account/Information Management System - 账号/信息管理系统
 * 
 * Manages platform accounts (TikTok, Instagram, LINE, etc.) and
 * brand/client contact information.
 */
import { int, mysqlTable, text, timestamp, varchar, json, mysqlEnum, uniqueIndex, index } from "drizzle-orm/mysql-core";

/**
 * Platform accounts table - 各平台账号管理
 */
export const platformAccounts = mysqlTable("platform_accounts", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 100 }).notNull(), // TikTok Shop, Instagram, LINE, YouTube, etc.
  accountName: varchar("account_name", { length: 255 }).notNull(), // 账号名/用户名
  accountId: varchar("account_id", { length: 255 }), // 平台上的ID
  password: text("password"), // 密码（加密存储）
  loginUrl: text("login_url"), // 登录链接
  email: varchar("email", { length: 320 }), // 绑定邮箱
  phone: varchar("phone", { length: 50 }), // 绑定手机号
  responsible: varchar("responsible", { length: 255 }), // 负责人
  status: mysqlEnum("status", ["active", "inactive", "expired", "suspended"]).default("active").notNull(),
  expiresAt: timestamp("expires_at"), // 到期时间
  tags: json("tags").$type<string[]>(), // 标签分类
  notes: text("notes"), // 备注
  sourceKey: varchar("source_key", { length: 191 }), // 冪等取込キー（手入力行はNULL）
  sourceFileHash: varchar("source_file_hash", { length: 64 }),
  sourceRows: json("source_rows").$type<number[]>(),
  createdBy: int("created_by"), // 创建者
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  sourceKeyUnique: uniqueIndex("unique_platform_accounts_source_key").on(table.sourceKey),
  sourceHashIndex: index("idx_platform_accounts_source_hash").on(table.sourceFileHash),
}));

export type PlatformAccount = typeof platformAccounts.$inferSelect;
export type InsertPlatformAccount = typeof platformAccounts.$inferInsert;

/**
 * Contact information table - 品牌方/客户联系信息
 */
export const contactInfo = mysqlTable("contact_info", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["brand", "client", "partner", "supplier", "other"]).default("client").notNull(),
  companyName: varchar("company_name", { length: 255 }), // 公司名
  contactName: varchar("contact_name", { length: 255 }).notNull(), // 联系人姓名
  position: varchar("position", { length: 255 }), // 职位
  email: varchar("email", { length: 320 }), // 邮箱
  phone: varchar("phone", { length: 50 }), // 电话
  wechat: varchar("wechat", { length: 255 }), // 微信
  lineId: varchar("line_id", { length: 255 }), // LINE ID
  address: text("address"), // 地址
  responsible: varchar("responsible", { length: 255 }), // 负责人（我方）
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  tags: json("tags").$type<string[]>(), // 标签
  notes: text("notes"), // 备注
  sourceKey: varchar("source_key", { length: 191 }),
  sourceFileHash: varchar("source_file_hash", { length: 64 }),
  sourceRows: json("source_rows").$type<number[]>(),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  sourceKeyUnique: uniqueIndex("unique_contact_info_source_key").on(table.sourceKey),
  sourceHashIndex: index("idx_contact_info_source_hash").on(table.sourceFileHash),
}));

export type ContactInfo = typeof contactInfo.$inferSelect;
export type InsertContactInfo = typeof contactInfo.$inferInsert;

/**
 * URL-only references from management workbooks. They are intentionally kept
 * outside platform_accounts because they contain no independent credential.
 */
export const accountReferenceLinks = mysqlTable("account_reference_links", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["system", "meeting", "ai", "workflow", "other"]).default("other").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  notes: text("notes"),
  sourceKey: varchar("source_key", { length: 191 }).notNull(),
  sourceFileHash: varchar("source_file_hash", { length: 64 }).notNull(),
  sourceRows: json("source_rows").$type<number[]>().notNull(),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  sourceKeyUnique: uniqueIndex("unique_account_reference_source_key").on(table.sourceKey),
  categoryIndex: index("idx_account_reference_category").on(table.category),
}));

export const accountWorkbookImports = mysqlTable("account_workbook_imports", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
  sheetName: varchar("sheet_name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["running", "success", "failed"]).default("running").notNull(),
  counts: json("counts").$type<Record<string, number>>(),
  errorMessage: text("error_message"),
  importedBy: int("imported_by"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, table => ({
  fileHashUnique: uniqueIndex("unique_account_workbook_file_hash").on(table.fileSha256),
  statusIndex: index("idx_account_workbook_status").on(table.status),
}));

export type AccountReferenceLink = typeof accountReferenceLinks.$inferSelect;
export type AccountWorkbookImport = typeof accountWorkbookImports.$inferSelect;
