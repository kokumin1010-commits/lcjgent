import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Staff master table for managing staff members and their email addresses
 */
export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  department: varchar("department", { length: 255 }),
  country: varchar("country", { length: 100 }), // Country for filtering (e.g., "日本", "中国")
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

/**
 * Tasks table for managing work instructions extracted from screenshots
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().unique(), // Unique identifier for email threading
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  staffId: int("staffId").notNull(),
  taskDetail: text("taskDetail").notNull(),
  extractedContext: text("extractedContext"), // Full AI-extracted context
  deadline: timestamp("deadline"),
  screenshotUrl: text("screenshotUrl"), // DEPRECATED: Use screenshotUrls instead
  screenshotKey: varchar("screenshotKey", { length: 512 }), // DEPRECATED: Use screenshotKeys instead
  screenshotUrls: json("screenshotUrls").$type<string[]>(), // Array of S3 URLs (up to 4 screenshots)
  screenshotKeys: json("screenshotKeys").$type<string[]>(), // Array of S3 keys (up to 4 screenshots)
  completionToken: varchar("completionToken", { length: 128 }), // Token for one-click completion
  notes: text("notes"), // Optional memo field for additional task details
  startDate: bigint("startDate", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
  completedAt: bigint("completedAt", { mode: "number" }), // UTC timestamp in milliseconds
  lastReminderAt: bigint("lastReminderAt", { mode: "number" }), // Last reminder sent timestamp in milliseconds
  createdBy: int("createdBy").notNull(), // User ID who created the task
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Reminders table for tracking reminder emails sent to staff
 */
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  sentAt: bigint("sentAt", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  emailSubject: text("emailSubject"),
  emailBody: text("emailBody"),
  status: mysqlEnum("status", ["sent", "failed", "bounced"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

/**
 * Task-Staff junction table for many-to-many relationship
 * Allows assigning multiple staff members to a single task
 */
export const taskStaff = mysqlTable("task_staff", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(), // References tasks.id
  staffId: int("staffId").notNull(), // References staff.id
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type TaskStaff = typeof taskStaff.$inferSelect;
export type InsertTaskStaff = typeof taskStaff.$inferInsert;

/**
 * Email tracking table for monitoring email opens
 * Tracks when reminder emails are opened by recipients
 */
export const emailTracking = mysqlTable("email_tracking", {
  id: int("id").autoincrement().primaryKey(),
  reminderId: int("reminderId").notNull(), // References reminders.id
  taskId: int("taskId").notNull(), // References tasks.id
  trackingToken: varchar("trackingToken", { length: 128 }).notNull().unique(), // Unique token for tracking
  openedAt: bigint("openedAt", { mode: "number" }), // UTC timestamp in milliseconds when email was opened
  openCount: int("openCount").default(0).notNull(), // Number of times email was opened
  ipAddress: varchar("ipAddress", { length: 45 }), // IP address of the opener (IPv4 or IPv6)
  userAgent: text("userAgent"), // Browser/email client user agent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTracking = typeof emailTracking.$inferSelect;
export type InsertEmailTracking = typeof emailTracking.$inferInsert;


/**
 * Report staff table for managing staff members specifically for daily reports
 * Separate from the main staff table (which is for task assignments/email)
 */
export const reportStaff = mysqlTable("report_staff", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(), // "日本" or "中国"
  linkedStaffId: int("linkedStaffId"), // Optional link to staff table for email integration
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportStaff = typeof reportStaff.$inferSelect;
export type InsertReportStaff = typeof reportStaff.$inferInsert;

/**
 * Daily reports table for staff daily work reports
 * Mirrors the existing WordPress report system structure
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reportStaffId: int("reportStaffId").notNull(), // References report_staff.id
  reportDate: timestamp("reportDate").notNull(), // Date of the report
  workContent: text("workContent").notNull(), // 業務内容
  issues: text("issues"), // 気付き・問題・理由
  remarks: text("remarks"), // 備考
  createdBy: int("createdBy").notNull(), // User ID who created the report
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;


/**
 * Brands table for managing brand information and sales activities
 */
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // ブランド名
  companyName: varchar("companyName", { length: 255 }), // 会社名
  category: varchar("category", { length: 100 }), // カテゴリー (e.g., "サービス業")
  phoneNumber: varchar("phoneNumber", { length: 50 }), // 電話番号
  status: mysqlEnum("status", ["進行中", "打ち合わせ中", "契約済み", "保留", "終了"]).default("進行中").notNull(), // ステータス
  materialCategory: varchar("materialCategory", { length: 255 }), // 商材カテゴリ
  email: varchar("email", { length: 320 }), // メールアドレス
  contactPerson: varchar("contactPerson", { length: 255 }), // 担当者名
  adBudget: bigint("adBudget", { mode: "number" }), // 広告費
  salesTarget: bigint("salesTarget", { mode: "number" }), // 売上目標
  commissionRate: varchar("commissionRate", { length: 50 }), // 成果報酬 (e.g., "50%")
  businessCardUrls: json("businessCardUrls").$type<string[]>(), // 名刺画像URLs (up to 2)
  businessCardKeys: json("businessCardKeys").$type<string[]>(), // 名刺画像S3 keys
  logoUrl: text("logoUrl"), // ロゴ画像URL
  logoKey: varchar("logoKey", { length: 512 }), // ロゴ画像S3 key
  memo: text("memo"), // メモ
  createdBy: int("createdBy").notNull(), // User ID who created the brand
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

/**
 * Brand products table for managing products associated with brands
 */
export const brandProducts = mysqlTable("brand_products", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  productName: varchar("productName", { length: 255 }).notNull(), // 商品名
  listPrice: bigint("listPrice", { mode: "number" }), // 定価
  specialPrice: bigint("specialPrice", { mode: "number" }), // 特別価格
  discountRate: varchar("discountRate", { length: 50 }), // 仕切率
  sampleProduct: varchar("sampleProduct", { length: 255 }), // サンプル品
  productCode: varchar("productCode", { length: 100 }), // コード品番
  influencer: varchar("influencer", { length: 255 }), // インフルエンサー
  purchasePrice: bigint("purchasePrice", { mode: "number" }), // 仕入金額
  remarks: text("remarks"), // 備考
  imageUrls: json("imageUrls").$type<string[]>(), // 商品画像URLs (最大2枚)
  imageKeys: json("imageKeys").$type<string[]>(), // 商品画像S3 keys
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandProduct = typeof brandProducts.$inferSelect;
export type InsertBrandProduct = typeof brandProducts.$inferInsert;

/**
 * Brand activity history table for tracking interactions with brands
 */
export const brandActivities = mysqlTable("brand_activities", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  activityDate: timestamp("activityDate").notNull(), // 日付
  activityType: mysqlEnum("activityType", ["進行中", "打ち合わせ", "完了"]).default("進行中").notNull(), // 対応内容
  contactPerson: varchar("contactPerson", { length: 255 }), // 担当者名
  nextAction: text("nextAction"), // 次アクション
  content: text("content"), // 内容（面出メモ）
  createdBy: int("createdBy").notNull(), // User ID who created the activity
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandActivity = typeof brandActivities.$inferSelect;
export type InsertBrandActivity = typeof brandActivities.$inferInsert;


/**
 * Brand livestream history table for tracking live streaming sales activities
 * 直播履歴テーブル - ライブ配信の売上履歴を記録
 */
export const brandLivestreams = mysqlTable("brand_livestreams", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  livestreamDate: timestamp("livestreamDate").notNull(), // 直播日期
  streamerName: varchar("streamerName", { length: 255 }).notNull(), // 直播达人
  salesAmount: bigint("salesAmount", { mode: "number" }), // 营业额（売上金額）
  duration: int("duration"), // 直播时长（分钟）
  viewerCount: int("viewerCount"), // 观看人数
  orderCount: int("orderCount"), // 订单数
  platform: varchar("platform", { length: 100 }), // 平台 (e.g., "抖音", "淘宝", "TikTok")
  remarks: text("remarks"), // 备注
  createdBy: int("createdBy").notNull(), // User ID who created the record
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandLivestream = typeof brandLivestreams.$inferSelect;
export type InsertBrandLivestream = typeof brandLivestreams.$inferInsert;


/**
 * Follow-up items extracted from daily reports
 * 日報から抽出されたフォローアップ項目（提案、打ち合わせ、商談など）
 */
export const reportFollowups = mysqlTable("report_followups", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(), // References reports.id
  reportStaffId: int("reportStaffId").notNull(), // References reportStaff.id
  extractedItem: text("extractedItem").notNull(), // 抽出された項目（例：「shiho合同」「物流公司打ち合わせ」）
  category: mysqlEnum("category", ["提案", "打ち合わせ", "商談", "MTG", "確認", "その他"]).default("その他").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"), // フォローアップ期限（抽出日から2日後）
  // 結果記録用フィールド
  resultCategory: mysqlEnum("resultCategory", ["成約", "継続", "保留", "失注", "完了"]), // 結果カテゴリ
  resultNote: text("resultNote"), // 結果メモ（任意）
  completedAt: timestamp("completedAt"), // 完了日時
  completedNote: text("completedNote"), // 完了時のメモ（後方互換用、resultNoteを使用）
  nextActionId: int("nextActionId"), // 次のアクションへの参照（自己参照）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportFollowup = typeof reportFollowups.$inferSelect;
export type InsertReportFollowup = typeof reportFollowups.$inferInsert;


/**
 * Business cards table for managing scanned business cards
 * 名刺管理テーブル - スキャンした名刺情報を保存
 */
export const businessCards = mysqlTable("business_cards", {
  id: int("id").autoincrement().primaryKey(),
  // 名刺情報
  name: varchar("name", { length: 255 }).notNull(), // 氏名
  nameReading: varchar("nameReading", { length: 255 }), // 氏名（読み仮名）
  company: varchar("company", { length: 255 }), // 会社名
  department: varchar("department", { length: 255 }), // 部署
  position: varchar("position", { length: 255 }), // 役職
  email: varchar("email", { length: 320 }), // メールアドレス
  phone: varchar("phone", { length: 50 }), // 電話番号
  mobile: varchar("mobile", { length: 50 }), // 携帯電話
  fax: varchar("fax", { length: 50 }), // FAX
  address: text("address"), // 住所
  website: varchar("website", { length: 500 }), // ウェブサイト
  // 画像情報
  imageUrl: text("imageUrl"), // 名刺画像URL
  imageKey: varchar("imageKey", { length: 512 }), // S3キー
  // メタ情報
  registeredBy: int("registeredBy").notNull(), // 登録した担当者（user ID）
  notes: text("notes"), // メモ
  tags: json("tags").$type<string[]>(), // タグ（検索用）
  // 重複チェック用ハッシュ
  duplicateHash: varchar("duplicateHash", { length: 64 }), // 会社名+氏名のハッシュ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BusinessCard = typeof businessCards.$inferSelect;
export type InsertBusinessCard = typeof businessCards.$inferInsert;


/**
 * Brand-LCJ Staff junction table for many-to-many relationship
 * ブランドに複数のLCJ担当者（レポートスタッフ）を割り当てる
 */
export const brandLcjStaff = mysqlTable("brand_lcj_staff", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  reportStaffId: int("reportStaffId").notNull(), // References reportStaff.id
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type BrandLcjStaff = typeof brandLcjStaff.$inferSelect;
export type InsertBrandLcjStaff = typeof brandLcjStaff.$inferInsert;


/**
 * Activity logs table for tracking user actions
 * ユーザーの行動ログを記録するテーブル
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // References users.id
  actionType: varchar("actionType", { length: 100 }).notNull(), // アクションタイプ（例：business_card_create, brand_create, task_create）
  actionLabel: varchar("actionLabel", { length: 255 }).notNull(), // 表示用ラベル（例：「名刺を登録」「ブランドを作成」）
  targetType: varchar("targetType", { length: 100 }), // 対象のタイプ（例：business_card, brand, task）
  targetId: int("targetId"), // 対象のID
  targetName: varchar("targetName", { length: 255 }), // 対象の名前（例：名刺の氏名、ブランド名）
  metadata: json("metadata").$type<Record<string, unknown>>(), // 追加情報（JSON形式）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;


/**
 * Brand contracts table for managing contract information
 * ブランドの契約情報を管理するテーブル
 */
export const brandContracts = mysqlTable("brand_contracts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  contractType: mysqlEnum("contractType", ["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).notNull(), // 契約タイプ
  fixedFee: bigint("fixedFee", { mode: "number" }), // 固定費（円）
  commissionRate: varchar("commissionRate", { length: 50 }), // 成果報酬（例：10%、または固定金額）
  startDate: timestamp("startDate"), // 契約開始日
  endDate: timestamp("endDate"), // 契約終了日
  status: mysqlEnum("status", ["契約中", "完了", "保留", "終了"]).default("契約中").notNull(), // ステータス
  memo: text("memo"), // メモ
  createdBy: int("createdBy").notNull(), // 作成者（user ID）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandContract = typeof brandContracts.$inferSelect;
export type InsertBrandContract = typeof brandContracts.$inferInsert;


/**
 * AI Advice table for storing AI-generated advice on reports
 * 日報に対するAIアドバイスを保存するテーブル
 */
export const reportAiAdvice = mysqlTable("report_ai_advice", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(), // References reports.id
  adviceText: text("adviceText").notNull(), // AIが生成したアドバイス
  adviceType: varchar("adviceType", { length: 100 }), // アドバイスのタイプ（例：improvement, followup, time_management）
  promptUsed: text("promptUsed"), // 使用したプロンプト（デバッグ・改善用）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportAiAdvice = typeof reportAiAdvice.$inferSelect;
export type InsertReportAiAdvice = typeof reportAiAdvice.$inferInsert;

/**
 * AI Advice Feedback table for storing user feedback on AI advice
 * AIアドバイスに対するユーザーフィードバックを保存するテーブル
 * このデータを蓄積してLCJ専用AIの精度を向上させる
 */
export const aiAdviceFeedback = mysqlTable("ai_advice_feedback", {
  id: int("id").autoincrement().primaryKey(),
  adviceId: int("adviceId").notNull(), // References reportAiAdvice.id
  userId: int("userId").notNull(), // フィードバックを送信したユーザー
  rating: mysqlEnum("rating", ["good", "bad"]).notNull(), // 👍 good / 👎 bad
  comment: text("comment"), // 任意のコメント
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiAdviceFeedback = typeof aiAdviceFeedback.$inferSelect;
export type InsertAiAdviceFeedback = typeof aiAdviceFeedback.$inferInsert;

/**
 * AI Learning Examples table for storing good/bad advice examples
 * 良い/悪いアドバイスの例を保存して学習に活用するテーブル
 */
export const aiLearningExamples = mysqlTable("ai_learning_examples", {
  id: int("id").autoincrement().primaryKey(),
  reportContent: text("reportContent").notNull(), // 元の日報内容
  adviceText: text("adviceText").notNull(), // アドバイス内容
  isGoodExample: mysqlEnum("isGoodExample", ["yes", "no"]).notNull(), // 良い例か悪い例か
  feedbackCount: int("feedbackCount").default(0).notNull(), // フィードバック数
  goodCount: int("goodCount").default(0).notNull(), // 👍の数
  badCount: int("badCount").default(0).notNull(), // 👎の数
  category: varchar("category", { length: 100 }), // カテゴリ（例：ライバー対応、イベント、営業）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiLearningExample = typeof aiLearningExamples.$inferSelect;
export type InsertAiLearningExample = typeof aiLearningExamples.$inferInsert;
