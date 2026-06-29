/**
 * Account/Information Management System - 账号/信息管理系统
 * 
 * Manages platform accounts (TikTok, Instagram, LINE, etc.) and
 * brand/client contact information.
 */
import { int, mysqlTable, text, timestamp, varchar, json, mysqlEnum } from "drizzle-orm/mysql-core";

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
  createdBy: int("created_by"), // 创建者
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

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
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ContactInfo = typeof contactInfo.$inferSelect;
export type InsertContactInfo = typeof contactInfo.$inferInsert;
