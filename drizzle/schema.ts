import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json, boolean, decimal } from "drizzle-orm/mysql-core";

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
  nameEn: varchar("nameEn", { length: 255 }), // English name
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  department: varchar("department", { length: 255 }),
  position: varchar("position", { length: 255 }), // 役職・ポジション
  country: varchar("country", { length: 100 }), // Country for filtering (e.g., "日本", "中国")
  avatarUrl: text("avatarUrl"), // プロフィール写真
  joinDate: timestamp("joinDate"), // 入社日
  birthDate: timestamp("birthDate"), // 生年月日
  skills: json("skills").$type<string[]>(), // スキルタグ
  lineId: varchar("lineId", { length: 255 }), // LINE ID
  emergencyContact: varchar("emergencyContact", { length: 255 }), // 緊急連絡先
  notes: text("notes"), // メモ
  employmentType: mysqlEnum("employmentType", ["fulltime", "parttime", "contract", "intern"]).default("fulltime").notNull(),
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  resignDate: timestamp("resignDate"), // 退職日
  resignReason: text("resignReason"), // 退職理由
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
  nameJa: varchar("nameJa", { length: 255 }).notNull(), // 日本語読みブランド名（ライブ配信時に使用）
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
  commissionRate: varchar("commissionRate", { length: 50 }), // 成果報酬 (e.g., "15%", "20%")
  imageUrls: json("imageUrls").$type<string[]>(), // 商品画像URLs (最大2枚)
  imageKeys: json("imageKeys").$type<string[]>(), // 商品画像S3 keys
  proposalImageUrl: text("proposalImageUrl"), // 提案書画像URL
  proposalImageKey: varchar("proposalImageKey", { length: 512 }), // 提案書画像S3 key
  // AI抽出情報フィールド
  releaseDate: varchar("releaseDate", { length: 100 }), // 発売日
  catchCopy: text("catchCopy"), // キャッチコピー・広告語
  features: text("features"), // 商品の特徴・セールスポイント
  productDetails: text("productDetails"), // 商品詳細（内容量・容量等）
  accessories: text("accessories"), // 付属品・セット内容
  shippingInfo: text("shippingInfo"), // 配送情報
  targetAudience: varchar("targetAudience", { length: 255 }), // ターゲット層
  usageMethod: text("usageMethod"), // 使用方法
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
  liverId: int("liverId"), // References livers.id - ライバーID（紐付け）
  scheduleId: int("scheduleId"), // References schedules.id - スケジュールとの紐付け
  livestreamDate: timestamp("livestreamDate").notNull(), // 直播日期
  livestreamEndTime: timestamp("livestreamEndTime"), // 配信終了時刻
  streamerName: varchar("streamerName", { length: 255 }).notNull(), // 直播达人
  salesAmount: bigint("salesAmount", { mode: "number" }), // 营业额（売上金額）
  duration: int("duration"), // 直播时长（分钟）
  viewerCount: int("viewerCount"), // 观看人数
  orderCount: int("orderCount"), // 订单数
  platform: varchar("platform", { length: 100 }), // 平台 (e.g., "抖音", "淘宝", "TikTok")
  remarks: text("remarks"), // 备注
  // 追加メトリクスフィールド
  productClicks: int("productClicks"), // 商品クリック数
  impressions: int("impressions"), // 商品インプレッション数
  salesCount: int("salesCount"), // 販売件数
  gmv: bigint("gmv", { mode: "number" }), // GMV（総取引額）
  cartAddCount: int("cartAddCount"), // カート追加回数
  productId: int("productId"), // References brandProducts.id - 紐付いた商品
  productCommission: varchar("productCommission", { length: 50 }), // 商品手数料 (e.g., "15%", "20%")
  adCost: bigint("adCost", { mode: "number" }), // 広告費
  ctr: varchar("ctr", { length: 20 }), // CTR（クリック率）
  cvr: varchar("cvr", { length: 20 }), // CVR（コンバージョン率）
  ctor: varchar("ctor", { length: 20 }), // CTOR（SKU注文率）
  // CSVインポート用追加フィールド
  peakViewers: int("peakViewers"), // ピーク視聴者数
  newFollowers: int("newFollowers"), // 新規フォロワー数
  avgViewDuration: int("avgViewDuration"), // 平均視聴時間（秒）
  likes: int("likes"), // いいね数
  comments: int("comments"), // コメント数
  shares: int("shares"), // シェア数
  avgPrice: bigint("avgPrice", { mode: "number" }), // 平均単価
  gmvPer1kShows: varchar("gmvPer1kShows", { length: 50 }), // GMV/1K shows
  gmvPer1kViews: varchar("gmvPer1kViews", { length: 50 }), // GMV/1K views
  customerCount: int("customerCount"), // 顧客数
  itemsSold: int("itemsSold"), // 販売アイテム数
  csvImported: mysqlEnum("csvImported", ["yes", "no"]).default("no"), // 配信パフォーマンスCSVインポートフラグ
  productCsvImported: mysqlEnum("productCsvImported", ["yes", "no"]).default("no"), // 商品別CSVインポートフラグ
  cpc: bigint("cpc", { mode: "number" }), // CPC（クリック単価）
  acos: varchar("acos", { length: 20 }), // ACOS（広告費売上比率）
  roas: varchar("roas", { length: 20 }), // ROAS（広告費用対効果）
  livestreamStartTime: varchar("livestreamStartTime", { length: 10 }), // ライブ開始時間 (e.g., "14:30", "20:00")
  // 配信結果フィールド
  result: mysqlEnum("result", ["成功", "失敗"]), // 配信結果
  impactFactor: mysqlEnum("impactFactor", ["構成", "商品", "ライバー", "広告", "その他"]), // 影響要因
  resultReason: text("resultReason"), // 理由メモ
  screenshotUrl: text("screenshotUrl"), // 配信後スクリーンショットURL
  screenshotKey: varchar("screenshotKey", { length: 512 }), // S3キー
  beforeScreenshotUrl: text("beforeScreenshotUrl"), // 配信前スクリーンショットURL（任意）
  beforeScreenshotKey: varchar("beforeScreenshotKey", { length: 512 }), // 配信前スクリーンショットS3キー
  manualSalesAmount: bigint("manualSalesAmount", { mode: "number" }), // 手入力売上金額（任意）
  aiAdvice: text("aiAdvice"), // AIによるワンポイントアドバイス
  aiStructuredAdvice: json("aiStructuredAdvice").$type<{
    summary: string;
    goodPoints: string[];
    improvements: string[];
    actionPlans: { action: string; reason: string; timing: string }[];
    nextGoal: string;
    calculatedMetrics: Record<string, string | number>;
  }>(), // AI構造化アドバイス（永続保存用）
  createdBy: int("createdBy").notNull(), // User ID who created the record
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ（NULLなら有効、値があれば削除済み）
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
  // 契約タイプ: 既存の値も含めて互換性を維持
  serviceType: mysqlEnum("serviceType", ["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).default("単発ライブ契約").notNull(), // 契約タイプ
  contractType: mysqlEnum("contractType", ["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).default("その他"), // 互換性のため残す
  fixedFee: bigint("fixedFee", { mode: "number" }), // 固定費（円）
  commissionRate: varchar("commissionRate", { length: 50 }), // 成果報酬（例：10%、または固定金額）
  startDate: timestamp("startDate"), // 契約開始日
  endDate: timestamp("endDate"), // 契約終了日
  plannedLivestreamCount: int("plannedLivestreamCount"), // 予定配信回数
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


/**
 * Chat Report Sessions table for storing chat-based report sessions
 * チャット形式の日報セッションを保存するテーブル
 */
export const chatReportSessions = mysqlTable("chat_report_sessions", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull(), // References reportStaff.id
  reportDate: timestamp("reportDate").notNull(), // 日報の日付
  status: mysqlEnum("status", ["in_progress", "completed", "converted"]).default("in_progress").notNull(), // セッション状態
  convertedReportId: int("convertedReportId"), // 変換後のreports.id（変換済みの場合）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatReportSession = typeof chatReportSessions.$inferSelect;
export type InsertChatReportSession = typeof chatReportSessions.$inferInsert;

/**
 * Chat Report Messages table for storing individual messages in chat sessions
 * チャットセッション内の個別メッセージを保存するテーブル
 */
export const chatReportMessages = mysqlTable("chat_report_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // References chatReportSessions.id
  role: mysqlEnum("role", ["ai", "user"]).notNull(), // メッセージの送信者（AI or ユーザー）
  content: text("content").notNull(), // メッセージ内容
  messageType: varchar("messageType", { length: 100 }), // メッセージタイプ（例：greeting, question, answer, summary）
  questionCategory: varchar("questionCategory", { length: 100 }), // 質問カテゴリ（例：work_content, issues, followup）
  metadata: json("metadata").$type<Record<string, unknown>>(), // 追加情報
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatReportMessage = typeof chatReportMessages.$inferSelect;
export type InsertChatReportMessage = typeof chatReportMessages.$inferInsert;

/**
 * Staff AI Profile table for storing personalized AI settings per staff
 * スタッフごとのパーソナライズされたAI設定を保存するテーブル
 */
export const staffAiProfiles = mysqlTable("staff_ai_profiles", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull().unique(), // References reportStaff.id
  // 質問スタイルの好み
  preferredQuestionStyle: mysqlEnum("preferredQuestionStyle", ["detailed", "simple", "free"]).default("simple"), // 詳細/シンプル/自由形式
  // 学習データ
  strongAreas: json("strongAreas").$type<string[]>(), // 得意分野（例：["イベント", "ライバー対応"]）
  improvementAreas: json("improvementAreas").$type<string[]>(), // 改善が必要な分野
  commonPatterns: json("commonPatterns").$type<Record<string, unknown>>(), // よく使うパターン・キーワード
  // 統計
  totalReports: int("totalReports").default(0).notNull(), // 総日報数
  totalChatSessions: int("totalChatSessions").default(0).notNull(), // 総チャットセッション数
  avgResponseLength: int("avgResponseLength").default(0), // 平均回答文字数
  // フィードバック統計
  goodFeedbackCount: int("goodFeedbackCount").default(0).notNull(), // 👍の数
  badFeedbackCount: int("badFeedbackCount").default(0).notNull(), // 👎の数
  // 最終更新
  lastAnalyzedAt: timestamp("lastAnalyzedAt"), // 最後に分析した日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StaffAiProfile = typeof staffAiProfiles.$inferSelect;
export type InsertStaffAiProfile = typeof staffAiProfiles.$inferInsert;

/**
 * AI Question Templates table for storing question templates
 * AI質問テンプレートを保存するテーブル
 */
export const aiQuestionTemplates = mysqlTable("ai_question_templates", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(), // カテゴリ（例：work_content, issues, followup, weekly_goal）
  questionText: text("questionText").notNull(), // 質問文
  questionTextZh: text("questionTextZh"), // 中国語版
  dayOfWeek: int("dayOfWeek"), // 曜日（0=日曜, 1=月曜, ... 6=土曜）、nullは毎日
  priority: int("priority").default(0).notNull(), // 優先度（高いほど優先）
  isActive: boolean("isActive").default(true).notNull(), // 有効/無効
  usageCount: int("usageCount").default(0).notNull(), // 使用回数
  goodFeedbackCount: int("goodFeedbackCount").default(0).notNull(), // 👍の数
  badFeedbackCount: int("badFeedbackCount").default(0).notNull(), // 👎の数
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiQuestionTemplate = typeof aiQuestionTemplates.$inferSelect;
export type InsertAiQuestionTemplate = typeof aiQuestionTemplates.$inferInsert;


/**
 * LINE Users table for storing LINE user information
 * LINEユーザー情報を保存するテーブル
 */
export const lineUsers = mysqlTable("line_users", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).unique(), // LINE User ID (optional for email users)
  displayName: varchar("displayName", { length: 255 }), // LINE display name or user name
  pictureUrl: text("pictureUrl"), // Profile picture URL
  statusMessage: text("statusMessage"), // Status message
  // Email/Password authentication fields
  email: varchar("email", { length: 320 }).unique(), // Email for email login
  password: varchar("password", { length: 255 }), // Hashed password for email login
  phone: varchar("phone", { length: 20 }), // Phone number (optional)
  // Link to internal entities
  brandId: int("brandId"), // Link to brand (customer)
  staffId: int("staffId"), // Link to staff (internal)
  liverId: int("liverId"), // Link to liver (if applicable)
  userType: mysqlEnum("userType", ["customer", "staff", "liver", "unknown"]).default("unknown").notNull(),
  // Status
  isBlocked: boolean("isBlocked").default(false).notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineUser = typeof lineUsers.$inferSelect;
export type InsertLineUser = typeof lineUsers.$inferInsert;

/**
 * LINE Groups table for storing LINE group information
 * LINEグループ情報を保存するテーブル
 */
export const lineGroups = mysqlTable("line_groups", {
  id: int("id").autoincrement().primaryKey(),
  lineGroupId: varchar("lineGroupId", { length: 64 }).notNull().unique(), // LINE Group ID
  groupName: varchar("groupName", { length: 255 }), // Group name
  pictureUrl: text("pictureUrl"), // Group picture URL
  // Link to internal entities
  brandId: int("brandId"), // Link to brand
  // Settings
  isActive: boolean("isActive").default(true).notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  // Auto follow-up settings
  autoFollowUpEnabled: boolean("autoFollowUpEnabled").default(false).notNull(), // Enable auto follow-up
  autoFollowUpDays: int("autoFollowUpDays").default(2), // Days of inactivity before sending follow-up (default: 2 days)
  autoFollowUpMessage: text("autoFollowUpMessage"), // Custom follow-up message template
  lastAutoFollowUpAt: timestamp("lastAutoFollowUpAt"), // Last auto follow-up sent timestamp
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineGroup = typeof lineGroups.$inferSelect;
export type InsertLineGroup = typeof lineGroups.$inferInsert;

/**
 * LINE Messages table for storing message history
 * LINEメッセージ履歴を保存するテーブル
 */
export const lineMessages = mysqlTable("line_messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(), // LINE Message ID
  // Source
  sourceType: mysqlEnum("sourceType", ["user", "group", "room"]).notNull(),
  lineUserId: varchar("lineUserId", { length: 64 }), // Sender's LINE User ID
  lineGroupId: varchar("lineGroupId", { length: 64 }), // Group ID (if group message)
  senderName: varchar("senderName", { length: 255 }), // Sender's display name
  // Message content
  messageType: varchar("messageType", { length: 32 }).notNull(), // text, image, video, audio, file, sticker, etc.
  content: text("content"), // Text content or description
  // Direction
  direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
  // Status
  isRead: boolean("isRead").default(false).notNull(),
  // Response tracking (要対応フラグ)
  needsResponse: boolean("needsResponse").default(false).notNull(), // AIが「返事が必要」と判定した場合true
  responseStatus: mysqlEnum("responseStatus", ["none", "pending", "responded", "cancelled"]).default("none").notNull(), // 対応ステータス
  responseSummary: text("responseSummary"), // AIによる要約（何についての返事が必要か）
  lastReminderAt: timestamp("lastReminderAt"), // 最後のリマインド送信日時
  reminderCount: int("reminderCount").default(0).notNull(), // リマインド送信回数
  respondedAt: timestamp("respondedAt"), // 返事した日時
  respondedBy: varchar("respondedBy", { length: 64 }), // 返事したスタッフのLINE User ID
  // Timestamps
  lineTimestamp: bigint("lineTimestamp", { mode: "number" }), // LINE's timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LineMessage = typeof lineMessages.$inferSelect;
export type InsertLineMessage = typeof lineMessages.$inferInsert;

/**
 * LINE Follow-ups table for automated follow-up messages
 * 自動フォローアップメッセージ設定テーブル
 */
export const lineFollowUps = mysqlTable("line_follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  // Target
  targetType: mysqlEnum("targetType", ["user", "group"]).notNull(),
  lineUserId: varchar("lineUserId", { length: 64 }),
  lineGroupId: varchar("lineGroupId", { length: 64 }),
  // Follow-up settings
  triggerCondition: mysqlEnum("triggerCondition", ["no_reply", "scheduled", "event"]).notNull(),
  delayHours: int("delayHours").default(72).notNull(), // Hours to wait before follow-up
  maxAttempts: int("maxAttempts").default(3).notNull(), // Maximum follow-up attempts
  currentAttempts: int("currentAttempts").default(0).notNull(),
  // Message
  messageTemplate: text("messageTemplate").notNull(), // Follow-up message template
  // Status
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  lastSentAt: timestamp("lastSentAt"),
  nextScheduledAt: timestamp("nextScheduledAt"),
  // Reference
  brandId: int("brandId"), // Related brand
  createdBy: int("createdBy"), // User who created this follow-up
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineFollowUp = typeof lineFollowUps.$inferSelect;
export type InsertLineFollowUp = typeof lineFollowUps.$inferInsert;


/**
 * Pending Responses table for tracking messages that require staff response
 * スタッフの返事が必要なメッセージを追跡するテーブル
 * 
 * 機能:
 * - AIが「返事が必要」と判定したメッセージを登録
 * - 1時間ごとにリマインドを送信
 * - スタッフが返事したら自動的に解除
 */
export const pendingResponses = mysqlTable("pending_responses", {
  id: int("id").autoincrement().primaryKey(),
  // 対象グループ・メッセージ
  lineGroupId: varchar("lineGroupId", { length: 64 }).notNull(), // LINE Group ID
  lineMessageId: varchar("lineMessageId", { length: 64 }).notNull(), // 元のメッセージID
  senderLineUserId: varchar("senderLineUserId", { length: 64 }), // 送信者のLINE User ID
  senderName: varchar("senderName", { length: 255 }), // 送信者名
  // メッセージ内容
  messageContent: text("messageContent").notNull(), // メッセージ内容
  messageSummary: text("messageSummary"), // AIによる要約
  responseType: mysqlEnum("responseType", ["question", "proposal", "confirmation", "schedule", "other"]).default("other").notNull(), // 返事の種類
  // ステータス
  status: mysqlEnum("status", ["pending", "responded", "cancelled", "expired"]).default("pending").notNull(),
  // リマインド設定
  reminderCount: int("reminderCount").default(0).notNull(), // 送信済みリマインド回数
  lastReminderAt: timestamp("lastReminderAt"), // 最後のリマインド送信日時
  nextReminderAt: timestamp("nextReminderAt"), // 次のリマインド予定日時
  // 解決情報
  respondedBy: varchar("respondedBy", { length: 64 }), // 返事したスタッフのLINE User ID
  respondedAt: timestamp("respondedAt"), // 返事した日時
  // タイムスタンプ
  detectedAt: timestamp("detectedAt").defaultNow().notNull(), // 検出日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PendingResponse = typeof pendingResponses.$inferSelect;
export type InsertPendingResponse = typeof pendingResponses.$inferInsert;


/**
 * Schedules table for calendar/schedule management
 * カレンダー・スケジュール管理テーブル
 * 
 * LINEから操作可能:
 * - @lcj 今日の予定
 * - @lcj 1/25 14:00-16:00 配信 追加
 * - @lcj 〇〇さんの予定
 */
export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  // 予定の基本情報
  title: varchar("title", { length: 255 }).notNull(), // 予定のタイトル
  description: text("description"), // 詳細説明
  // 日時
  startTime: timestamp("startTime").notNull(), // 開始日時
  endTime: timestamp("endTime"), // 終了日時（任意）
  isAllDay: boolean("isAllDay").default(false).notNull(), // 終日予定かどうか
  // カテゴリ・タイプ
  category: mysqlEnum("category", ["delivery", "meeting", "live", "other"]).default("other").notNull(), // 配信、ミーティング、ライブ、その他
  // 関連情報
  liverId: int("liverId"), // ライバーID（将来のライバー管理機能と連携）
  liverName: varchar("liverName", { length: 255 }), // ライバー名（直接入力も可能）
  brandId: int("brandId"), // ブランドID
  lineGroupId: varchar("lineGroupId", { length: 64 }), // 関連するLINEグループ
  // 繰り返し設定
  isRecurring: boolean("isRecurring").default(false).notNull(), // 繰り返し予定かどうか
  recurringPattern: mysqlEnum("recurringPattern", ["daily", "weekly", "monthly", "yearly"]), // 繰り返しパターン
  recurringEndDate: timestamp("recurringEndDate"), // 繰り返し終了日
  parentScheduleId: int("parentScheduleId"), // 繰り返し予定の親ID
  // ステータス
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled"]).default("scheduled").notNull(),
  // メモ
  notes: text("notes"),
  // 作成者情報
  createdBy: int("createdBy"), // 作成したユーザーID
  createdByLineUserId: varchar("createdByLineUserId", { length: 64 }), // LINEから作成した場合のユーザーID
  // リマインド設定
  reminderEnabled: boolean("reminderEnabled").default(true).notNull(), // リマインドを送信するか
  reminderMinutesBefore: int("reminderMinutesBefore").default(30), // 何分前にリマインドを送るか
  reminderSentAt: timestamp("reminderSentAt"), // リマインド送信済み日時
  // スケジュールグループ
  scheduleGroupId: int("scheduleGroupId"), // 紐づくスケジュールグループID
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;


/**
 * Livers table for liver (streamer) accounts
 * ライバー（配信者）アカウント管理テーブル
 * 
 * 機能:
 * - ライバー専用アカウント
 * - 共有カレンダーで全員の予定を閲覧
 * - 自分のスケジュールのみ追加・編集・削除可能
 */
export const livers = mysqlTable("livers", {
  id: int("id").autoincrement().primaryKey(),
  // 基本情報
  name: varchar("name", { length: 255 }).notNull(), // ライバー名
  email: varchar("email", { length: 320 }).notNull().unique(), // メールアドレス
  password: varchar("password", { length: 255 }).notNull(), // ハッシュ化されたパスワード
  // プロフィール
  avatarUrl: text("avatarUrl"), // アバター画像URL
  avatarKey: varchar("avatarKey", { length: 512 }), // アバター画像S3 key
  bio: text("bio"), // 自己紹介
  // カラー設定（カレンダー表示用）
  color: varchar("color", { length: 20 }).default("#FF69B4"), // 表示色（ピンクがデフォルト）
  // SNSアカウント
  tiktokAccount: varchar("tiktokAccount", { length: 255 }), // TikTokアカウント
  instagramAccount: varchar("instagramAccount", { length: 255 }), // Instagramアカウント
  youtubeAccount: varchar("youtubeAccount", { length: 255 }), // YouTubeアカウント
  otherAccount: varchar("otherAccount", { length: 255 }), // その他のSNSアカウント
  // ステータス
  isActive: boolean("isActive").default(true).notNull(), // アクティブかどうか
  role: mysqlEnum("role", ["liver", "admin"]).default("liver").notNull(), // 権限
  // セッション
  lastLoginAt: timestamp("lastLoginAt"), // 最終ログイン日時
  // LINE連携
  lineUserId: varchar("lineUserId", { length: 255 }), // LINE User ID（個別通知用）
  lineNotificationEnabled: boolean("lineNotificationEnabled").default(true), // LINE通知有効/無効
  lineLinkCode: varchar("lineLinkCode", { length: 10 }), // LINE連携コード（L-XXXXXX形式、8文字）
  lineLinkCodeExpiresAt: timestamp("lineLinkCodeExpiresAt"), // LINE連携コードの有効期限
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Liver = typeof livers.$inferSelect;
export type InsertLiver = typeof livers.$inferInsert;


/**
 * 直播商品別GMVテーブル - ライブ配信ごとの商品別売上を記録
 * 1つの直播に複数の商品を紐付けて、それぞれのGMVを記録できる
 * TikTok Creator-Live-Recap-Product-List CSVフォーマット対応
 */
export const livestreamProducts = mysqlTable("livestream_products", {
  id: int("id").autoincrement().primaryKey(),
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id
  productName: varchar("productName", { length: 500 }).notNull(), // 商品名 (Product)
  // 売上データ
  grossRevenue: bigint("grossRevenue", { mode: "number" }), // 総売上 (Gross revenue)
  directGmv: bigint("directGmv", { mode: "number" }), // 直接GMV (Direct GMV)
  gmv: bigint("gmv", { mode: "number" }), // GMV（後方互換用）
  // 販売データ
  itemsSold: int("itemsSold"), // 販売数 (Items sold)
  customers: int("customers"), // 購入者数 (Customers)
  orders: int("orders"), // 注文数 (Orders)
  quantity: int("quantity"), // 販売数量（後方互換用）
  unitPrice: bigint("unitPrice", { mode: "number" }), // 単価
  // クリック・インプレッションデータ
  ctr: varchar("ctr", { length: 20 }), // CTR（クリック率）
  ctor: varchar("ctor", { length: 20 }), // CTOR (SKU orders)
  productImpressions: int("productImpressions"), // 商品インプレッション数 (Product impressions)
  productClicks: int("productClicks"), // 商品クリック数 (Product clicks)
  impressions: int("impressions"), // 後方互換用
  cartAddCount: int("cartAddCount"), // カート追加回数
  conversionRate: varchar("conversionRate", { length: 20 }), // コンバージョン率
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LivestreamProduct = typeof livestreamProducts.$inferSelect;
export type InsertLivestreamProduct = typeof livestreamProducts.$inferInsert;


/**
 * Brand Memos table for activity notes and timeline
 * ブランドの活動メモ（タイムライン形式）を管理するテーブル
 */
export const brandMemos = mysqlTable("brand_memos", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  content: text("content").notNull(), // メモ内容
  authorName: varchar("authorName", { length: 255 }).notNull(), // 作成者名
  createdBy: int("createdBy").notNull(), // User ID who created the memo
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandMemo = typeof brandMemos.$inferSelect;
export type InsertBrandMemo = typeof brandMemos.$inferInsert;


/**
 * Contract-Livestream Links table for linking contracts to livestreams
 * 契約と直播の紐付けテーブル - 契約に関連する直播を紐付けてROASを計算
 */
export const contractLivestreamLinks = mysqlTable("contract_livestream_links", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(), // References brandContracts.id
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id
  createdBy: int("createdBy").notNull(), // User ID who created the link
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractLivestreamLink = typeof contractLivestreamLinks.$inferSelect;
export type InsertContractLivestreamLink = typeof contractLivestreamLinks.$inferInsert;


/**
 * Brand Edit Logs table for tracking all changes to brand data
 * ブランドの編集ログテーブル - 誰が何をしたかを自動記録
 */
export const brandEditLogs = mysqlTable("brand_edit_logs", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  // 操作情報
  actionType: mysqlEnum("actionType", ["create", "update", "delete"]).notNull(), // 操作タイプ
  entityType: mysqlEnum("entityType", ["brand", "product", "livestream", "contract", "memo"]).notNull(), // 対象エンティティ
  entityId: int("entityId"), // 対象のID（削除の場合はnull可）
  entityName: varchar("entityName", { length: 255 }), // 対象の名前（表示用）
  // 変更内容
  changeDescription: text("changeDescription").notNull(), // 変更内容の説明
  previousValue: text("previousValue"), // 変更前の値（JSON形式）
  newValue: text("newValue"), // 変更後の値（JSON形式）
  // 操作者情報
  userId: int("userId").notNull(), // 操作したユーザーID
  userName: varchar("userName", { length: 255 }).notNull(), // 操作したユーザー名
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrandEditLog = typeof brandEditLogs.$inferSelect;
export type InsertBrandEditLog = typeof brandEditLogs.$inferInsert;


/**
 * Brand Product Images table for managing multiple images per product
 * 商品画像テーブル - 商品ごとに複数の画像を管理
 */
export const brandProductImages = mysqlTable("brand_product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(), // References brandProducts.id
  imageUrl: text("imageUrl").notNull(), // S3 URL
  imageKey: varchar("imageKey", { length: 512 }).notNull(), // S3 key
  sortOrder: int("sortOrder").default(0).notNull(), // 表示順序
  createdBy: int("createdBy").notNull(), // User ID who uploaded the image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrandProductImage = typeof brandProductImages.$inferSelect;
export type InsertBrandProductImage = typeof brandProductImages.$inferInsert;


/**
 * Brand Files table for managing files per brand
 * ブランドファイルテーブル - ブランドごとにファイル（契約書、価格表、素材など）を管理
 */
export const brandFiles = mysqlTable("brand_files", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  fileName: varchar("fileName", { length: 255 }).notNull(), // ファイル名
  fileUrl: text("fileUrl").notNull(), // S3 URL
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileSize: bigint("fileSize", { mode: "number" }), // ファイルサイズ（バイト）
  mimeType: varchar("mimeType", { length: 128 }), // MIMEタイプ
  uploadedBy: int("uploadedBy").notNull(), // User ID who uploaded the file
  uploadedByName: varchar("uploadedByName", { length: 255 }).notNull(), // アップロードしたユーザー名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrandFile = typeof brandFiles.$inferSelect;
export type InsertBrandFile = typeof brandFiles.$inferInsert;



/**
 * Product Links table for managing multiple links per product
 * 商品リンクテーブル - 商品ごとに複数のリンク（TikTokショップ、楽天、公式サイトなど）を管理
 */
export const productLinks = mysqlTable("product_links", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(), // References brandProducts.id
  title: varchar("title", { length: 255 }).notNull(), // リンクのタイトル（例：TikTokショップ、楽天、公式サイト）
  url: text("url").notNull(), // リンクURL
  sortOrder: int("sortOrder").default(0).notNull(), // 表示順序
  createdBy: int("createdBy").notNull(), // User ID who added the link
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductLink = typeof productLinks.$inferSelect;
export type InsertProductLink = typeof productLinks.$inferInsert;



/**
 * CSV Import History table for tracking product CSV imports
 * 商品CSVインポート履歴テーブル - インポートしたCSVの履歴を管理
 */
export const csvImportHistory = mysqlTable("csv_import_history", {
  id: int("id").autoincrement().primaryKey(),
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id
  fileName: varchar("fileName", { length: 255 }).notNull(), // インポートしたファイル名
  productCount: int("productCount").notNull(), // インポートした商品数
  totalGmv: bigint("totalGmv", { mode: "number" }), // インポートした商品の合計GMV
  importedBy: int("importedBy").notNull(), // User ID who imported the CSV
  importedByName: varchar("importedByName", { length: 255 }).notNull(), // インポートしたユーザー名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CsvImportHistory = typeof csvImportHistory.$inferSelect;
export type InsertCsvImportHistory = typeof csvImportHistory.$inferInsert;


/**
 * Livestream CSV Import History table for tracking CSV imports
 * 配信履歴CSVインポート履歴テーブル - TikTok配信パフォーマンスCSVのインポート履歴を記録
 */
export const livestreamCsvImportHistory = mysqlTable("livestream_csv_import_history", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id - インポートしたライバー
  brandId: int("brandId").notNull(), // References brands.id - 対象ブランド
  fileName: varchar("fileName", { length: 255 }).notNull(), // インポートしたファイル名
  livestreamCount: int("livestreamCount").notNull(), // インポートした配信数
  createdCount: int("createdCount").notNull(), // 新規作成された配信数
  updatedCount: int("updatedCount").notNull(), // 更新された配信数
  totalGmv: bigint("totalGmv", { mode: "number" }), // インポートした配信の合計GMV
  dateRangeStart: timestamp("dateRangeStart"), // インポートした配信の開始日
  dateRangeEnd: timestamp("dateRangeEnd"), // インポートした配信の終了日
  importedBy: int("importedBy").notNull(), // User ID who imported the CSV
  importedByName: varchar("importedByName", { length: 255 }).notNull(), // インポートしたユーザー名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LivestreamCsvImportHistory = typeof livestreamCsvImportHistory.$inferSelect;
export type InsertLivestreamCsvImportHistory = typeof livestreamCsvImportHistory.$inferInsert;


/**
 * Ad Proposal History table for storing generated TikTok ad proposals
 */
export const adProposalHistory = mysqlTable("ad_proposal_history", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  version: int("version").default(1).notNull(), // Version number for the same brand
  
  // Proposal content
  proposalContent: text("proposalContent").notNull(), // AI-generated proposal text (Markdown)
  
  // Metrics snapshot at the time of generation
  totalGmv: bigint("totalGmv", { mode: "number" }).default(0), // 総GMV
  totalImpressions: bigint("totalImpressions", { mode: "number" }).default(0), // 総インプレッション
  adValue: bigint("adValue", { mode: "number" }).default(0), // 広告換算費用
  totalValue: bigint("totalValue", { mode: "number" }).default(0), // 総価値
  totalAdCost: bigint("totalAdCost", { mode: "number" }).default(0), // 契約金額
  avgRoas: decimal("avgRoas", { precision: 10, scale: 2 }).default("0"), // 平均ROAS
  totalLivestreams: int("totalLivestreams").default(0), // 配信回数
  avgSalesPerLive: bigint("avgSalesPerLive", { mode: "number" }).default(0), // 平均売上/配信
  avgDuration: int("avgDuration").default(0), // 平均配信時間（分）
  productsCount: int("productsCount").default(0), // 商品数
  activeContractsCount: int("activeContractsCount").default(0), // アクティブ契約数
  
  // Top products (JSON array)
  topProducts: json("topProducts").$type<{ name: string; gmv: number }[]>(),
  
  // Status
  status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected"]).default("draft").notNull(),
  
  // User info
  createdBy: int("createdBy").notNull(), // User ID who generated the proposal
  createdByName: varchar("createdByName", { length: 255 }).notNull(), // 生成したユーザー名
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdProposalHistory = typeof adProposalHistory.$inferSelect;
export type InsertAdProposalHistory = typeof adProposalHistory.$inferInsert;


/**
 * Ad Alert History table for storing generated ad investment alert reports
 */
export const adAlertHistory = mysqlTable("ad_alert_history", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  version: int("version").default(1).notNull(), // Version number for the same brand
  
  // Alert content
  aiAnalysis: text("aiAnalysis").notNull(), // AI-generated analysis text (Markdown)
  
  // Current metrics snapshot
  totalGmv: bigint("totalGmv", { mode: "number" }).default(0),
  totalImpressions: bigint("totalImpressions", { mode: "number" }).default(0),
  avgConversionRate: decimal("avgConversionRate", { precision: 10, scale: 4 }).default("0"),
  totalLivestreams: int("totalLivestreams").default(0),
  avgGmvPerLive: bigint("avgGmvPerLive", { mode: "number" }).default(0),
  performanceScore: int("performanceScore").default(0),
  
  // Opportunity cost
  missedImpressions: bigint("missedImpressions", { mode: "number" }).default(0),
  missedGmv: bigint("missedGmv", { mode: "number" }).default(0),
  
  // Scenarios (JSON)
  scenarios: json("scenarios").$type<{
    small: { budget: number; projectedGmv: number; roas: number; allocation?: { liveBudget: number; clipBudget: number } };
    medium: { budget: number; projectedGmv: number; roas: number; allocation?: { liveBudget: number; clipBudget: number } };
    large: { budget: number; projectedGmv: number; roas: number; allocation?: { liveBudget: number; clipBudget: number } };
  }>(),
  
  // Allocation recommendation
  allocationLiveRatio: decimal("allocationLiveRatio", { precision: 5, scale: 2 }).default("0.5"),
  allocationClipRatio: decimal("allocationClipRatio", { precision: 5, scale: 2 }).default("0.5"),
  allocationReason: text("allocationReason"),
  
  // Urgency
  urgencyLevel: mysqlEnum("urgencyLevel", ["high", "medium", "low"]).default("medium").notNull(),
  
  // User info
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdAlertHistory = typeof adAlertHistory.$inferSelect;
export type InsertAdAlertHistory = typeof adAlertHistory.$inferInsert;


/**
 * Ad Investment Records table for tracking actual ad spending and results
 * Used to improve prediction accuracy over time
 */
export const adInvestmentRecords = mysqlTable("ad_investment_records", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  
  // Investment details
  investmentDate: timestamp("investmentDate").notNull(), // When the ad was run
  adType: mysqlEnum("adType", ["live", "clip", "mixed"]).default("mixed").notNull(), // Type of ad
  
  // Budget breakdown
  totalBudget: bigint("totalBudget", { mode: "number" }).notNull(), // Total ad spend
  liveBudget: bigint("liveBudget", { mode: "number" }).default(0), // Budget for live ads
  clipBudget: bigint("clipBudget", { mode: "number" }).default(0), // Budget for clip/video ads
  
  // Actual results
  actualGmv: bigint("actualGmv", { mode: "number" }).default(0), // Actual GMV generated
  actualImpressions: bigint("actualImpressions", { mode: "number" }).default(0), // Actual impressions
  actualClicks: bigint("actualClicks", { mode: "number" }).default(0), // Actual clicks
  actualConversions: int("actualConversions").default(0), // Actual conversions
  
  // Calculated metrics
  actualRoas: decimal("actualRoas", { precision: 10, scale: 4 }).default("0"), // Actual ROAS
  cpm: decimal("cpm", { precision: 10, scale: 2 }).default("0"), // Cost per 1000 impressions
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"), // Cost per click
  conversionRate: decimal("conversionRate", { precision: 10, scale: 4 }).default("0"), // Conversion rate
  
  // Prediction comparison (for learning)
  predictedGmv: bigint("predictedGmv", { mode: "number" }).default(0), // What we predicted
  predictedRoas: decimal("predictedRoas", { precision: 10, scale: 4 }).default("0"), // Predicted ROAS
  predictionAccuracy: decimal("predictionAccuracy", { precision: 10, scale: 4 }).default("0"), // How accurate was prediction (%)
  
  // Context
  campaignName: varchar("campaignName", { length: 255 }), // Optional campaign name
  notes: text("notes"), // Additional notes
  
  // Related livestream (if applicable)
  livestreamId: int("livestreamId"), // References livestreams.id if tied to specific live
  
  // User info
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdInvestmentRecord = typeof adInvestmentRecords.$inferSelect;
export type InsertAdInvestmentRecord = typeof adInvestmentRecords.$inferInsert;

/**
 * Brand Ad Performance Stats table for aggregated learning data
 * Stores calculated averages and trends for each brand
 */
export const brandAdPerformanceStats = mysqlTable("brand_ad_performance_stats", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull().unique(), // References brands.id
  
  // Historical averages
  avgRoas: decimal("avgRoas", { precision: 10, scale: 4 }).default("0"),
  avgCpm: decimal("avgCpm", { precision: 10, scale: 2 }).default("0"),
  avgCpc: decimal("avgCpc", { precision: 10, scale: 2 }).default("0"),
  avgConversionRate: decimal("avgConversionRate", { precision: 10, scale: 4 }).default("0"),
  
  // Performance by ad type
  liveAdAvgRoas: decimal("liveAdAvgRoas", { precision: 10, scale: 4 }).default("0"),
  clipAdAvgRoas: decimal("clipAdAvgRoas", { precision: 10, scale: 4 }).default("0"),
  
  // Optimal allocation (learned from data)
  optimalLiveRatio: decimal("optimalLiveRatio", { precision: 5, scale: 2 }).default("0.5"),
  optimalClipRatio: decimal("optimalClipRatio", { precision: 5, scale: 2 }).default("0.5"),
  
  // Prediction accuracy tracking
  avgPredictionAccuracy: decimal("avgPredictionAccuracy", { precision: 10, scale: 4 }).default("0"),
  totalRecords: int("totalRecords").default(0), // Number of records used for calculation
  
  // Timestamps
  lastCalculatedAt: timestamp("lastCalculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandAdPerformanceStats = typeof brandAdPerformanceStats.$inferSelect;
export type InsertBrandAdPerformanceStats = typeof brandAdPerformanceStats.$inferInsert;


// ============================================
// LCJ Point System Tables
// ============================================

/**
 * Point balances table for tracking user point balances
 * Each user has one balance record
 */
export const pointBalances = mysqlTable("point_balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // References users.id
  
  // Balance info
  balance: bigint("balance", { mode: "number" }).default(0).notNull(), // Current available points
  totalEarned: bigint("totalEarned", { mode: "number" }).default(0).notNull(), // Lifetime earned points
  totalUsed: bigint("totalUsed", { mode: "number" }).default(0).notNull(), // Lifetime used points
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PointBalance = typeof pointBalances.$inferSelect;
export type InsertPointBalance = typeof pointBalances.$inferInsert;

/**
 * Point transactions table for tracking all point movements
 * Includes earning (from receipts) and spending (in shop)
 */
export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // References users.id
  
  // Transaction type
  type: mysqlEnum("type", ["earn", "use", "expire", "refund", "adjustment"]).notNull(),
  
  // Amount (positive for earn, negative for use)
  amount: bigint("amount", { mode: "number" }).notNull(),
  balanceAfter: bigint("balanceAfter", { mode: "number" }).notNull(), // Balance after this transaction
  
  // Reference to source (receipt for earn, order for use)
  referenceType: mysqlEnum("referenceType", ["receipt", "order", "manual", "system"]).notNull(),
  referenceId: int("referenceId"), // ID of the related receipt or order
  
  // Description
  description: text("description"),
  
  // Expiration (3 months from earn date, null for non-earn types)
  expiresAt: timestamp("expiresAt"),
  expired: int("expired").default(0).notNull(), // 0 = active, 1 = expired (processed)
  remainingAmount: bigint("remainingAmount", { mode: "number" }), // Remaining points not yet used/expired (for earn type FIFO tracking)
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = typeof pointTransactions.$inferInsert;

/**
 * Receipts table for tracking receipt submissions
 * Users submit receipts to earn points
 */
export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // References users.id
  
  // Receipt image
  imageUrl: text("imageUrl").notNull(), // S3 URL
  imageKey: varchar("imageKey", { length: 512 }).notNull(), // S3 key
  imageHash: varchar("imageHash", { length: 64 }), // SHA-256 hash for duplicate detection
  
  // OCR extracted data
  storeName: varchar("storeName", { length: 255 }), // Store/shop name
  purchaseDate: timestamp("purchaseDate"), // Date of purchase
  totalAmount: bigint("totalAmount", { mode: "number" }), // Total purchase amount
  currency: varchar("currency", { length: 10 }).default("JPY"), // Currency code
  
  // Raw OCR result
  ocrRawText: text("ocrRawText"), // Full OCR text
  ocrConfidence: decimal("ocrConfidence", { precision: 5, scale: 2 }), // OCR confidence score (0-100)
  
  // Point calculation
  pointsCalculated: bigint("pointsCalculated", { mode: "number" }), // Points to be awarded (2% of amount)
  pointsAwarded: bigint("pointsAwarded", { mode: "number" }), // Actually awarded points (after approval)
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "on_hold"]).default("pending").notNull(),
  
  // Review info
  reviewedBy: int("reviewedBy"), // Admin user who reviewed
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: text("reviewNote"), // Note from reviewer
  
  // Fraud detection
  fraudFlags: json("fraudFlags").$type<string[]>(), // Array of fraud flag codes
  fraudScore: decimal("fraudScore", { precision: 5, scale: 2 }).default("0"), // Risk score (0-100)
  
  // Timestamps
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

/**
 * Fraud detection logs table for tracking suspicious activities
 * Records all fraud checks and their results
 */
export const fraudDetectionLogs = mysqlTable("fraud_detection_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Reference
  receiptId: int("receiptId").notNull(), // References receipts.id
  userId: int("userId").notNull(), // References users.id
  
  // Detection info
  checkType: mysqlEnum("checkType", [
    "duplicate_image",      // Same image submitted before
    "duplicate_receipt",    // Same store/date/amount combination
    "expired_receipt",      // Receipt older than 7 days
    "high_frequency",       // Too many submissions in short time
    "high_amount",          // Unusually high amount
    "suspicious_pattern",   // Other suspicious patterns
    "similar_order_number", // Order number similar to existing one (1-2 digits different)
  ]).notNull(),
  
  // Result
  detected: boolean("detected").default(false).notNull(), // Was fraud detected?
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("low").notNull(),
  
  // Details
  details: text("details"), // Detailed explanation
  relatedReceiptId: int("relatedReceiptId"), // ID of related receipt (for duplicates)
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FraudDetectionLog = typeof fraudDetectionLogs.$inferSelect;
export type InsertFraudDetectionLog = typeof fraudDetectionLogs.$inferInsert;


// =====================================================
// LINE User Point System (LCJ ポイントシステム)
// LINEユーザーベースのポイント管理
// =====================================================

/**
 * LINE User Point Balances table
 * LINEユーザーのポイント残高を管理
 */
export const linePointBalances = mysqlTable("line_point_balances", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull().unique(), // LINE User ID
  
  // Balance info
  balance: bigint("balance", { mode: "number" }).default(0).notNull(), // Current available points
  totalEarned: bigint("totalEarned", { mode: "number" }).default(0).notNull(), // Lifetime earned points
  totalUsed: bigint("totalUsed", { mode: "number" }).default(0).notNull(), // Lifetime used points
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LinePointBalance = typeof linePointBalances.$inferSelect;
export type InsertLinePointBalance = typeof linePointBalances.$inferInsert;

/**
 * LINE User Point Transactions table
 * LINEユーザーのポイント取引履歴
 */
export const linePointTransactions = mysqlTable("line_point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(), // LINE User ID
  
  // Transaction type
  type: mysqlEnum("type", ["earn", "use", "expire", "refund", "adjustment"]).notNull(),
  
  // Amount (positive for earn, negative for use)
  amount: bigint("amount", { mode: "number" }).notNull(),
  balanceAfter: bigint("balanceAfter", { mode: "number" }).notNull(), // Balance after this transaction
  
  // Reference to source (receipt for earn, order for use)
  referenceType: mysqlEnum("referenceType", ["receipt", "order", "manual", "system"]).notNull(),
  referenceId: int("referenceId"), // ID of the related receipt or order
  
  // Description
  description: text("description"),
  
  // Expiration (3 months from earn date, null for non-earn types)
  expiresAt: timestamp("expiresAt"),
  expired: int("expired").default(0).notNull(), // 0 = active, 1 = expired (processed)
  remainingAmount: bigint("remainingAmount", { mode: "number" }), // Remaining points not yet used/expired (for earn type FIFO tracking)
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinePointTransaction = typeof linePointTransactions.$inferSelect;
export type InsertLinePointTransaction = typeof linePointTransactions.$inferInsert;

/**
 * LINE User Receipts table
 * LINEユーザーのレシート申請を管理
 */
export const lineReceipts = mysqlTable("line_receipts", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(), // LINE User ID
  lineMessageId: varchar("lineMessageId", { length: 64 }), // Original LINE message ID
  
  // Receipt image (supports multiple images)
  imageUrl: text("imageUrl").notNull(), // Primary S3 URL (first image)
  imageKey: varchar("imageKey", { length: 512 }).notNull(), // Primary S3 key
  imageHash: varchar("imageHash", { length: 64 }), // SHA-256 hash for duplicate detection
  imageUrls: json("imageUrls").$type<string[]>(), // Array of S3 URLs for multiple images
  imageKeys: json("imageKeys").$type<string[]>(), // Array of S3 keys for multiple images
  
  // OCR extracted data
  storeName: varchar("storeName", { length: 255 }), // Store/shop name
  purchaseDate: timestamp("purchaseDate"), // Date of purchase
  totalAmount: bigint("totalAmount", { mode: "number" }), // Total purchase amount
  currency: varchar("currency", { length: 10 }).default("JPY"), // Currency code
  
  // Raw OCR result
  ocrRawText: text("ocrRawText"), // Full OCR text
  ocrConfidence: decimal("ocrConfidence", { precision: 5, scale: 2 }), // OCR confidence score (0-100)
  
  // Point calculation
  pointsCalculated: bigint("pointsCalculated", { mode: "number" }), // Points to be awarded (2% of amount)
  pointsAwarded: bigint("pointsAwarded", { mode: "number" }), // Actually awarded points (after approval)
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "on_hold"]).default("pending").notNull(),
  
  // Review info
  reviewedBy: int("reviewedBy"), // Admin user who reviewed
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: text("reviewNote"), // Note from reviewer
  
  // AI rejection tracking (for learning data)
  aiRejectionReason: text("aiRejectionReason"), // AI弾き理由テキスト
  aiRejectionCategory: mysqlEnum("aiRejectionCategory", ["not_tiktok", "not_delivered", "incomplete", "other"]), // AI弾きカテゴリ
  isForceSubmitted: boolean("isForceSubmitted").default(false), // お客様が強制申請したか
  forceSubmittedAt: timestamp("forceSubmittedAt"), // 強制申請日時
  
  // Fraud detection
  fraudFlags: json("fraudFlags").$type<string[]>(), // Array of fraud flag codes
  fraudScore: decimal("fraudScore", { precision: 5, scale: 2 }).default("0"), // Risk score (0-100)
  
  // Timestamps
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineReceipt = typeof lineReceipts.$inferSelect;
export type InsertLineReceipt = typeof lineReceipts.$inferInsert;

/**
 * LINE User Fraud Detection Logs table
 * LINEユーザーの不正検知ログ
 */
export const lineFraudDetectionLogs = mysqlTable("line_fraud_detection_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Reference
  receiptId: int("receiptId").notNull(), // References lineReceipts.id
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(), // LINE User ID
  
  // Detection info
  checkType: mysqlEnum("checkType", [
    "duplicate_image",      // Same image submitted before
    "duplicate_receipt",    // Same store/date/amount combination
    "expired_receipt",      // Receipt older than 7 days
    "high_frequency",       // Too many submissions in short time
    "high_amount",          // Unusually high amount
    "suspicious_pattern",   // Other suspicious patterns
    "similar_order_number", // Order number similar to existing one (1-2 digits different)
  ]).notNull(),
  
  // Result
  detected: boolean("detected").default(false).notNull(), // Was fraud detected?
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("low").notNull(),
  
  // Details
  details: text("details"), // Detailed explanation
  relatedReceiptId: int("relatedReceiptId"), // ID of related receipt (for duplicates)
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LineFraudDetectionLog = typeof lineFraudDetectionLogs.$inferSelect;
export type InsertLineFraudDetectionLog = typeof lineFraudDetectionLogs.$inferInsert;


// ============================================
// LCJ MALL - 商品・注文管理
// ============================================

/**
 * MALLブランドテーブル
 */
export const mallBrands = mysqlTable("mall_brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }), // 英語名
  logoUrl: text("logoUrl"),
  logoKey: varchar("logoKey", { length: 512 }),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  linkedBrandId: int("linkedBrandId"), // 営業ブランド（brands）との紐付け
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallBrand = typeof mallBrands.$inferSelect;
export type InsertMallBrand = typeof mallBrands.$inferInsert;

/**
 * MALLカテゴリテーブル
 */
export const mallCategories = mysqlTable("mall_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }), // URL用スラッグ
  description: text("description"),
  parentId: int("parentId"), // 親カテゴリID（階層対応）
  iconEmoji: varchar("iconEmoji", { length: 10 }), // アイコン絵文字
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallCategory = typeof mallCategories.$inferSelect;
export type InsertMallCategory = typeof mallCategories.$inferInsert;

/**
 * MALL商品テーブル
 */
export const mallProducts = mysqlTable("mall_products", {
  id: int("id").autoincrement().primaryKey(),
  
  // 基本情報
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // レガシー（テキスト入力）
  brandId: int("brandId"), // References mallBrands.id
  categoryId: int("categoryId"), // References mallCategories.id
  
  // 価格
  price: int("price").notNull(), // 通常価格（円）
  pointPrice: int("pointPrice"), // ポイント価格（ポイントのみで購入可能な場合）
  
  // 在庫
  stock: int("stock").default(0).notNull(),
  
  // 画像
  imageUrl: text("imageUrl"),
  imageKey: varchar("imageKey", { length: 512 }),
  imageUrls: json("imageUrls").$type<string[]>(), // 複数画像対応
  imageKeys: json("imageKeys").$type<string[]>(),
  
  // ステータス
  status: mysqlEnum("status", ["draft", "active", "sold_out", "archived"]).default("draft").notNull(),
  
  // 表示順
  sortOrder: int("sortOrder").default(0).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallProduct = typeof mallProducts.$inferSelect;
export type InsertMallProduct = typeof mallProducts.$inferInsert;

/**
 * MALL注文テーブル
 */
export const mallOrders = mysqlTable("mall_orders", {
  id: int("id").autoincrement().primaryKey(),
  
  // 注文番号
  orderNumber: varchar("orderNumber", { length: 64 }).notNull().unique(),
  
  // 購入者（LINEユーザー）
  lineUserId: int("lineUserId").notNull(),
  
  // 注文ステータス
  status: mysqlEnum("status", [
    "pending",      // 注文受付（決済待ち）
    "paid",         // 決済完了
    "confirmed",    // 確認済み
    "shipped",      // 発送済み
    "delivered",    // 配達完了
    "cancelled",    // キャンセル
    "refunded",     // 返金済み
  ]).default("pending").notNull(),
  
  // 決済方法
  paymentMethod: mysqlEnum("paymentMethod", [
    "stripe",       // Stripe決済
    "points",       // ポイント全額
    "cod",          // 代引き
  ]).default("stripe").notNull(),
  
  // 金額
  totalAmount: int("totalAmount").notNull(), // 合計金額（円）
  pointsUsed: int("pointsUsed").default(0).notNull(), // 使用ポイント
  cashAmount: int("cashAmount").default(0).notNull(), // 現金支払い額
  
  // 配送先情報
  shippingName: varchar("shippingName", { length: 255 }),
  shippingPhone: varchar("shippingPhone", { length: 50 }),
  shippingPostalCode: varchar("shippingPostalCode", { length: 20 }),
  shippingAddress: text("shippingAddress"),
  
  // Stripe決済情報
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  
  // 配送情報
  shippingCarrier: varchar("shippingCarrier", { length: 100 }), // 配送業者（ヤマト運輸、佐川急便等）
  trackingNumber: varchar("trackingNumber", { length: 255 }), // 追跡番号
  
  // メモ
  notes: text("notes"),
  adminNotes: text("adminNotes"), // 管理者用メモ
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"), // キャンセル理由
});

export type MallOrder = typeof mallOrders.$inferSelect;
export type InsertMallOrder = typeof mallOrders.$inferInsert;

/**
 * MALL注文明細テーブル
 */
export const mallOrderItems = mysqlTable("mall_order_items", {
  id: int("id").autoincrement().primaryKey(),
  
  // 注文ID
  orderId: int("orderId").notNull(),
  
  // 商品情報（注文時点の情報を保存）
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productPrice: int("productPrice").notNull(),
  productPointPrice: int("productPointPrice"),
  
  // 数量
  quantity: int("quantity").default(1).notNull(),
  
  // 小計
  subtotal: int("subtotal").notNull(), // 小計（円）
  pointSubtotal: int("pointSubtotal").default(0).notNull(), // ポイント小計
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MallOrderItem = typeof mallOrderItems.$inferSelect;
export type InsertMallOrderItem = typeof mallOrderItems.$inferInsert;

/**
 * MALLカートテーブル（一時的なカート保存用）
 */
export const mallCarts = mysqlTable("mall_carts", {
  id: int("id").autoincrement().primaryKey(),
  
  // LINEユーザー
  lineUserId: int("lineUserId").notNull(),
  
  // 商品
  productId: int("productId").notNull(),
  
  // 数量
  quantity: int("quantity").default(1).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallCart = typeof mallCarts.$inferSelect;
export type InsertMallCart = typeof mallCarts.$inferInsert;


/**
 * ユーザー配送先住所テーブル
 * LINEユーザーの配送先住所を保存
 */
export const userAddresses = mysqlTable("user_addresses", {
  id: int("id").autoincrement().primaryKey(),
  
  // LINEユーザーID
  lineUserId: int("lineUserId").notNull(),
  
  // 住所ラベル（自宅、会社など）
  label: varchar("label", { length: 50 }).default("自宅").notNull(),
  
  // 受取人情報
  recipientName: varchar("recipientName", { length: 100 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  
  // 住所情報
  postalCode: varchar("postalCode", { length: 10 }).notNull(), // 郵便番号（ハイフンなし）
  prefecture: varchar("prefecture", { length: 20 }).notNull(), // 都道府県
  city: varchar("city", { length: 100 }).notNull(), // 市区町村
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(), // 番地
  addressLine2: varchar("addressLine2", { length: 255 }), // 建物名・部屋番号（任意）
  
  // デフォルト住所フラグ
  isDefault: boolean("isDefault").default(false).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;


// ============================================
// LCJ MALL - パスワードリセット
// ============================================

/**
 * パスワードリセットトークンテーブル
 * LCJ MALL会員のパスワードリセット用トークンを管理
 */
export const linePasswordResetTokens = mysqlTable("line_password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  lineUserId: int("lineUserId").notNull(), // References line_users.id
  email: varchar("email", { length: 320 }).notNull(), // メールアドレス
  
  // トークン
  token: varchar("token", { length: 128 }).notNull().unique(), // リセットトークン
  
  // 有効期限（1時間）
  expiresAt: timestamp("expiresAt").notNull(),
  
  // 使用済みフラグ
  usedAt: timestamp("usedAt"), // 使用された日時（nullなら未使用）
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinePasswordResetToken = typeof linePasswordResetTokens.$inferSelect;
export type InsertLinePasswordResetToken = typeof linePasswordResetTokens.$inferInsert;


/**
 * LINE Link Codes table for linking email accounts with LINE accounts
 * メールアカウントとLINEアカウントを連携するためのコードテーブル
 */
export const lineLinkCodes = mysqlTable("line_link_codes", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  lineUserId: int("lineUserId").notNull(), // References line_users.id (email user)
  
  // 連携コード（プレフィックス付き: L-XXXXXX または M-XXXXXX）
  code: varchar("code", { length: 10 }).notNull(),
  
  // 有効期限（10分）
  expiresAt: timestamp("expiresAt").notNull(),
  
  // 使用済みフラグ
  usedAt: timestamp("usedAt"), // 使用された日時（nullなら未使用）
  linkedLineUserId: varchar("linkedLineUserId", { length: 64 }), // 連携されたLINE User ID
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LineLinkCode = typeof lineLinkCodes.$inferSelect;
export type InsertLineLinkCode = typeof lineLinkCodes.$inferInsert;


/**
 * Screenshot Analysis History table for storing AI analysis results
 * スクリーンショット解析履歴テーブル - AI解析結果を保存
 */
export const screenshotAnalysisHistory = mysqlTable("screenshot_analysis_history", {
  id: int("id").autoincrement().primaryKey(),
  
  // 関連エンティティ
  liverId: int("liverId"), // References livers.id（任意）
  livestreamId: int("livestreamId"), // References brandLivestreams.id（任意）
  
  // 画像情報
  imageHash: varchar("imageHash", { length: 128 }).notNull(), // 画像のハッシュ値（キャッシュキー）
  imageUrl: text("imageUrl"), // S3 URL
  imageKey: varchar("imageKey", { length: 512 }), // S3 key
  
  // 解析結果
  salesAmount: bigint("salesAmount", { mode: "number" }), // 売上金額
  viewerCount: int("viewerCount"), // 視聴者数
  peakViewerCount: int("peakViewerCount"), // ピーク視聴者数
  productClicks: int("productClicks"), // 商品クリック数
  orderCount: int("orderCount"), // 注文数
  durationMinutes: int("durationMinutes"), // 配信時間（分）
  startDateTime: varchar("startDateTime", { length: 20 }), // 開始日時
  endDateTime: varchar("endDateTime", { length: 20 }), // 終了日時
  
  // 追加メトリクス
  impressions: int("impressions"), // インプレッション数
  liveCtr: varchar("liveCtr", { length: 20 }), // LIVE CTR
  orderRate: varchar("orderRate", { length: 20 }), // 注文率
  productSales: int("productSales"), // 商品販売数
  
  // 解析メタデータ
  confidence: mysqlEnum("confidence", ["high", "medium", "low"]).default("medium"), // 解析信頼度
  rawResponse: json("rawResponse").$type<Record<string, any>>(), // LLMの生レスポンス
  analysisVersion: varchar("analysisVersion", { length: 20 }).default("1.0"), // 解析バージョン
  
  // タイムスタンプ
  analyzedBy: int("analyzedBy"), // User ID who performed the analysis
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScreenshotAnalysisHistory = typeof screenshotAnalysisHistory.$inferSelect;
export type InsertScreenshotAnalysisHistory = typeof screenshotAnalysisHistory.$inferInsert;


/**
 * Point Requests table for TikTok Shop receipt point redemption
 * TikTok Shop配達済みレシートによるポイント申請テーブル
 */
export const pointRequests = mysqlTable("point_requests", {
  id: int("id").autoincrement().primaryKey(),
  
  // 申請者情報
  userId: int("userId").notNull(), // References users.id
  
  // レシート情報
  orderNumber: varchar("orderNumber", { length: 64 }).notNull(), // 注文番号（重複チェック用）
  orderAmount: int("orderAmount").notNull(), // 注文金額（円）
  deliveryDate: timestamp("deliveryDate"), // 配達日時
  
  // スクリーンショット
  receiptImageUrl: text("receiptImageUrl").notNull(), // レシート画像URL
  receiptImageKey: varchar("receiptImageKey", { length: 512 }), // S3 key
  deliveryImageUrl: text("deliveryImageUrl"), // 配達済み画面のスクリーンショットURL
  deliveryImageKey: varchar("deliveryImageKey", { length: 512 }), // S3 key
  
  // ポイント計算
  pointsRequested: int("pointsRequested").notNull(), // 申請ポイント（金額の1%）
  pointsApproved: int("pointsApproved"), // 承認されたポイント
  
  // ステータス
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"), // 却下理由
  
  // 審査情報
  reviewedBy: int("reviewedBy"), // 審査した管理者のUser ID
  reviewedAt: timestamp("reviewedAt"), // 審査日時
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PointRequest = typeof pointRequests.$inferSelect;
export type InsertPointRequest = typeof pointRequests.$inferInsert;


/**
 * Password Reset Tokens table for password recovery
 * パスワードリセット用トークンテーブル
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  userId: int("userId").notNull(), // References users.id
  email: varchar("email", { length: 320 }).notNull(),
  
  // トークン情報
  token: varchar("token", { length: 64 }).notNull().unique(), // ランダムトークン
  
  // 有効期限
  expiresAt: timestamp("expiresAt").notNull(), // トークンの有効期限（通常1時間）
  
  // 使用状態
  usedAt: timestamp("usedAt"), // 使用された日時（nullなら未使用）
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;


/**
 * Schedule Groups table for organizing schedules into named groups
 * スケジュールグループテーブル（A/B/Cスケジュールなど）
 * 
 * 機能:
 * - スケジュールを「Aスケジュール」「Bスケジュール」などの名前付きグループに分類
 * - 管理者がグループ名を自由に変更可能
 * - 各グループに複数のライバーを割り当て可能
 */
export const scheduleGroups = mysqlTable("schedule_groups", {
  id: int("id").autoincrement().primaryKey(),
  // グループ情報
  name: varchar("name", { length: 255 }).notNull(), // グループ名（例：「Aスケジュール」「京極チーム」）
  description: text("description"), // グループの説明
  // 表示設定
  color: varchar("color", { length: 20 }).default("#3B82F6"), // 表示色
  icon: varchar("icon", { length: 50 }), // アイコン名（オプション）
  // 並び順
  sortOrder: int("sortOrder").default(0).notNull(), // 表示順序（小さい順）
  // ステータス
  isActive: boolean("isActive").default(true).notNull(), // アクティブかどうか
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleGroup = typeof scheduleGroups.$inferSelect;
export type InsertScheduleGroup = typeof scheduleGroups.$inferInsert;


/**
 * Schedule Group Members table for assigning livers to groups
 * スケジュールグループメンバーテーブル
 * 
 * 機能:
 * - ライバーをスケジュールグループに割り当て
 * - 1人のライバーは複数のグループに所属可能
 */
export const scheduleGroupMembers = mysqlTable("schedule_group_members", {
  id: int("id").autoincrement().primaryKey(),
  // 関連
  groupId: int("groupId").notNull(), // References scheduleGroups.id
  liverId: int("liverId").notNull(), // References livers.id
  // 並び順
  sortOrder: int("sortOrder").default(0).notNull(), // グループ内での表示順序
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduleGroupMember = typeof scheduleGroupMembers.$inferSelect;
export type InsertScheduleGroupMember = typeof scheduleGroupMembers.$inferInsert;


/**
 * Liver Password Reset Tokens table for password recovery
 * ライバーパスワードリセット用トークンテーブル
 */
export const liverPasswordResetTokens = mysqlTable("liver_password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // ライバー情報
  liverId: int("liverId").notNull(), // References livers.id
  email: varchar("email", { length: 320 }).notNull(),
  
  // トークン情報
  token: varchar("token", { length: 64 }).notNull().unique(), // ランダムトークン
  
  // 有効期限
  expiresAt: timestamp("expiresAt").notNull(), // トークンの有効期限（通常1時間）
  
  // 使用状態
  usedAt: timestamp("usedAt"), // 使用された日時（nullなら未使用）
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LiverPasswordResetToken = typeof liverPasswordResetTokens.$inferSelect;
export type InsertLiverPasswordResetToken = typeof liverPasswordResetTokens.$inferInsert;


/**
 * Product-Liver relationship table for many-to-many association
 * 商品×ライバー紐付けテーブル（多対多）
 */
export const productLivers = mysqlTable("product_livers", {
  id: int("id").autoincrement().primaryKey(),
  
  // 商品情報
  productId: int("productId").notNull(), // References brandProducts.id
  
  // ライバー情報
  liverId: int("liverId").notNull(), // References livers.id
  
  // オプション情報
  specialSetName: varchar("specialSetName", { length: 255 }), // 特別セット名
  specialPrice: int("specialPrice"), // ライバー専用価格
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }), // ライバー専用成果報酬率
  
  // 紐付け情報
  assignedAt: timestamp("assignedAt").defaultNow().notNull(), // 紐付け日時
  createdBy: int("createdBy").notNull(), // 作成者
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductLiver = typeof productLivers.$inferSelect;
export type InsertProductLiver = typeof productLivers.$inferInsert;



/**
 * LINE Reminders table for user-requested reminders via LINE
 * LINEからのリマインダー設定テーブル
 */
export const lineReminders = mysqlTable("line_reminders", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(), // LINE User ID
  
  // リマインダー内容
  message: text("message").notNull(), // リマインダーメッセージ
  originalRequest: text("originalRequest"), // 元のリクエストメッセージ
  
  // スケジュール情報
  scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(), // 実行予定時刻（UTC timestamp in milliseconds）
  timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo").notNull(), // タイムゾーン
  
  // 繰り返し設定（将来の拡張用）
  repeatType: mysqlEnum("repeatType", ["none", "daily", "weekly", "monthly"]).default("none").notNull(),
  repeatEndAt: bigint("repeatEndAt", { mode: "number" }), // 繰り返し終了日時
  
  // ステータス
  status: mysqlEnum("status", ["pending", "sent", "cancelled", "failed"]).default("pending").notNull(),
  
  // 実行情報
  sentAt: bigint("sentAt", { mode: "number" }), // 実際に送信された時刻
  errorMessage: text("errorMessage"), // エラーメッセージ（失敗時）
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LineReminder = typeof lineReminders.$inferSelect;
export type InsertLineReminder = typeof lineReminders.$inferInsert;



/**
 * Liver Goals table for storing monthly sales goals
 * ライバーの月間売上目標を保存するテーブル
 */
export const liverGoals = mysqlTable("liver_goals", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id
  year: int("year").notNull(), // Year (e.g., 2026)
  month: int("month").notNull(), // Month (1-12)
  salesGoal: bigint("salesGoal", { mode: "number" }), // 売上目標（円）
  streamCountGoal: int("streamCountGoal"), // 配信回数目標
  streamHoursGoal: int("streamHoursGoal"), // 配信時間目標
  currentSales: bigint("currentSales", { mode: "number" }).default(0), // 現在の売上
  currentStreamCount: int("currentStreamCount").default(0), // 現在の配信回数
  currentStreamHours: int("currentStreamHours").default(0), // 現在の配信時間
  salesGoalAchieved: boolean("salesGoalAchieved").default(false), // 売上目標達成フラグ
  streamCountGoalAchieved: boolean("streamCountGoalAchieved").default(false), // 配信回数目標達成フラグ
  streamHoursGoalAchieved: boolean("streamHoursGoalAchieved").default(false), // 配信時間目標達成フラグ
  salesGoalAchievedAt: bigint("salesGoalAchievedAt", { mode: "number" }), // 売上目標達成日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiverGoal = typeof liverGoals.$inferSelect;
export type InsertLiverGoal = typeof liverGoals.$inferInsert;


/**
 * Product Master table for managing canonical product names
 * 正式な商品名を管理するマスターテーブル
 */
export const productMaster = mysqlTable("product_master", {
  id: int("id").autoincrement().primaryKey(),
  
  // 正式商品名
  canonicalName: varchar("canonicalName", { length: 500 }).notNull().unique(),
  
  // ブランド紐付け（オプション）
  brandId: int("brandId"), // References brands.id
  
  // メタ情報
  category: varchar("category", { length: 255 }), // 商品カテゴリ
  description: text("description"), // 商品説明
  
  // 公式サイト・ECサイトURL（OGP画像取得元）
  sourceUrl: text("sourceUrl"), // 公式サイトまたはECサイトのURL
  
  // 商品画像
  imageUrl: text("imageUrl"), // 確定済み商品画像URL（S3）
  imageKey: varchar("imageKey", { length: 512 }), // S3キー
  imageStatus: mysqlEnum("imageStatus", ["none", "auto_fetched", "confirmed", "rejected"]).default("none").notNull(),
  imageSource: varchar("imageSource", { length: 255 }), // 画像の取得元（ogp, manual等）
  
  // 価格帯
  regularPrice: int("regularPrice"), // 通常価格
  specialPrice: int("specialPrice"), // セール価格
  
  // 有効/無効
  isActive: boolean("isActive").default(true).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductMaster = typeof productMaster.$inferSelect;
export type InsertProductMaster = typeof productMaster.$inferInsert;


/**
 * Product Name Aliases table for mapping variant names to canonical names
 * 表記ゆれの商品名を正式名に紐付けるテーブル
 */
export const productNameAliases = mysqlTable("product_name_aliases", {
  id: int("id").autoincrement().primaryKey(),
  
  // 紐付け情報
  productMasterId: int("productMasterId").notNull(), // References productMaster.id
  aliasName: varchar("aliasName", { length: 500 }).notNull(), // 表記ゆれの商品名
  
  // 紐付け方法
  matchMethod: mysqlEnum("matchMethod", ["manual", "ai_suggested", "auto"]).default("manual").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // AI紐付けの場合の信頼度
  
  // 確認状態
  isConfirmed: boolean("isConfirmed").default(true).notNull(), // 手動確認済みかどうか
  confirmedBy: int("confirmedBy"), // 確認者のユーザーID
  confirmedAt: timestamp("confirmedAt"), // 確認日時
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductNameAlias = typeof productNameAliases.$inferSelect;
export type InsertProductNameAlias = typeof productNameAliases.$inferInsert;


/**
 * Product Alias Suggestions table for AI-generated matching suggestions
 * AIが提案した商品名紐付けを保存するテーブル
 */
export const productAliasSuggestions = mysqlTable("product_alias_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  
  // 提案内容
  aliasName: varchar("aliasName", { length: 500 }).notNull(), // 表記ゆれの商品名
  suggestedProductMasterId: int("suggestedProductMasterId"), // 提案された正式商品ID（新規の場合はnull）
  suggestedCanonicalName: varchar("suggestedCanonicalName", { length: 500 }), // 新規の場合の提案正式名
  
  // AI分析情報
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 信頼度
  reasoning: text("reasoning"), // AIの判断理由
  
  // ステータス
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"), // レビュー者
  reviewedAt: timestamp("reviewedAt"), // レビュー日時
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductAliasSuggestion = typeof productAliasSuggestions.$inferSelect;
export type InsertProductAliasSuggestion = typeof productAliasSuggestions.$inferInsert;


// ============================================
// 広告キャンペーン管理
// ============================================

/**
 * Ad Campaigns table for tracking advertising campaigns
 * 広告キャンペーン管理テーブル
 */
export const adCampaigns = mysqlTable("ad_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  
  // キャンペーン基本情報
  campaignName: varchar("campaignName", { length: 255 }).notNull(), // キャンペーン名
  platform: varchar("platform", { length: 100 }).notNull(), // プラットフォーム
  
  // 期間
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // 予算・費用
  budget: bigint("budget", { mode: "number" }).notNull(), // 予算（円）
  currency: varchar("currency", { length: 10 }).notNull().default("JPY"),
  
  // 目的（AI判定 + 手動修正可能）
  objective: mysqlEnum("objective", ["impression", "click", "conversion", "engagement", "other"]).default("impression").notNull(),
  objectiveConfidence: decimal("objectiveConfidence", { precision: 5, scale: 2 }), // AI判定の信頼度
  
  // 言語
  reportLanguage: mysqlEnum("reportLanguage", ["ja", "zh", "en"]).default("ja").notNull(),
  
  // レポートファイル
  reportFileUrl: text("reportFileUrl"), // アップロードされたPDF/ファイルのURL
  reportFileKey: varchar("reportFileKey", { length: 512 }), // S3 key
  
  // ステータス
  status: mysqlEnum("status", ["active", "completed", "paused", "cancelled"]).default("active").notNull(),
  
  // メモ
  memo: text("memo"),
  
  // 作成者情報
  createdBy: int("createdBy").notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = typeof adCampaigns.$inferInsert;

/**
 * Ad Metrics table for storing campaign performance metrics
 * 広告指標テーブル
 */
export const adMetrics = mysqlTable("ad_metrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(), // References adCampaigns.id
  
  // 期間
  metricDate: timestamp("metricDate"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  
  // 基本指標
  impressions: bigint("impressions", { mode: "number" }), // インプレッション数
  views: bigint("views", { mode: "number" }), // 視聴数
  views6sPlus: bigint("views6sPlus", { mode: "number" }), // 6秒以上視聴数
  focusViewRate: decimal("focusViewRate", { precision: 5, scale: 2 }), // フォーカスビュー率
  clicks: bigint("clicks", { mode: "number" }), // クリック数
  productClicks: bigint("productClicks", { mode: "number" }), // 商品クリック数
  cartAdds: bigint("cartAdds", { mode: "number" }), // カート追加数
  salesCount: bigint("salesCount", { mode: "number" }), // 販売数
  gmv: bigint("gmv", { mode: "number" }), // GMV
  adSpend: bigint("adSpend", { mode: "number" }), // 広告費
  
  // コスト指標
  cpm: decimal("cpm", { precision: 10, scale: 4 }), // Cost per 1000 impressions
  cpc: decimal("cpc", { precision: 10, scale: 4 }), // Cost per click
  cpa: decimal("cpa", { precision: 10, scale: 4 }), // Cost per acquisition
  roas: decimal("roas", { precision: 10, scale: 2 }), // Return on ad spend
  
  // 配信時間
  durationMinutes: int("durationMinutes"),
  
  // AI抽出フラグ
  isAiExtracted: boolean("isAiExtracted").notNull().default(false),
  aiExtractionConfidence: decimal("aiExtractionConfidence", { precision: 5, scale: 2 }),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdMetric = typeof adMetrics.$inferSelect;
export type InsertAdMetric = typeof adMetrics.$inferInsert;

/**
 * Ad Country Breakdown table for storing country-level performance
 * 国別広告パフォーマンステーブル
 */
export const adCountryBreakdown = mysqlTable("ad_country_breakdown", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(), // References adCampaigns.id
  
  // 国情報
  countryCode: varchar("countryCode", { length: 10 }).notNull(), // ISO country code (e.g., ID, TH, PH)
  
  // パフォーマンス
  impressions: bigint("impressions", { mode: "number" }),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  clicks: bigint("clicks", { mode: "number" }),
  conversions: bigint("conversions", { mode: "number" }),
  gmv: bigint("gmv", { mode: "number" }),
  
  // マーケットノート
  marketNote: text("marketNote"),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdCountryBreakdown = typeof adCountryBreakdown.$inferSelect;
export type InsertAdCountryBreakdown = typeof adCountryBreakdown.$inferInsert;


/**
 * Ad Report Files table for storing uploaded report file history
 * 広告レポートファイル履歴テーブル
 */
export const adReportFiles = mysqlTable("ad_report_files", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  
  // ファイル情報
  fileName: varchar("fileName", { length: 512 }).notNull(), // 元のファイル名
  fileUrl: text("fileUrl").notNull(), // S3 URL
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileType: varchar("fileType", { length: 50 }).notNull(), // pdf, xlsx, csv
  fileSize: int("fileSize"), // ファイルサイズ（バイト）
  
  // AI分析結果
  analysisStatus: mysqlEnum("analysisStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  analysisResult: json("analysisResult").$type<Record<string, unknown>>(), // AI分析結果
  detectedLanguage: varchar("detectedLanguage", { length: 10 }), // ja, zh, en
  
  // 関連キャンペーン
  campaignId: int("campaignId"), // References adCampaigns.id（分析後に紐付け）
  
  // 作成者情報
  uploadedBy: int("uploadedBy").notNull(),
  uploadedByName: varchar("uploadedByName", { length: 255 }).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdReportFile = typeof adReportFiles.$inferSelect;
export type InsertAdReportFile = typeof adReportFiles.$inferInsert;


/**
 * TikTok Affiliate Commission Orders table
 * TikTok成果報酬注文データテーブル（CSVインポートデータ）
 */
export const tiktokCommissionOrders = mysqlTable("tiktok_commission_orders", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  importHistoryId: int("importHistoryId"), // References tiktokCsvImportHistory.id
  
  // 注文基本情報
  orderId: varchar("orderId", { length: 64 }).notNull(), // 注文ID
  subOrderId: varchar("subOrderId", { length: 64 }).notNull(), // サブ注文ID（ユニーク）
  orderStatus: varchar("orderStatus", { length: 50 }), // 注文状況（完了/処理中）
  
  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(), // クリエイターのユーザー名
  
  // 商品情報
  productName: text("productName").notNull(), // 商品名
  sku: text("sku"), // SKU
  productId: varchar("productId", { length: 64 }), // 商品ID
  price: int("price").notNull(), // 価格（円）
  quantity: int("quantity").notNull(), // 数量
  
  // ショップ情報
  shopName: varchar("shopName", { length: 255 }), // ショップ名
  shopCode: varchar("shopCode", { length: 64 }), // ショップコード
  
  // コンテンツ情報
  contentType: varchar("contentType", { length: 50 }), // コンテンツタイプ（LIVE/ショーケース/動画）
  contentId: varchar("contentId", { length: 64 }), // コンテンツID
  
  // 成果報酬率
  partnerCommissionRate: decimal("partnerCommissionRate", { precision: 5, scale: 2 }), // アフィリエイトパートナー成果報酬率
  creatorCommissionRate: decimal("creatorCommissionRate", { precision: 5, scale: 2 }), // クリエイター成果報酬率
  partnerRewardRate: int("partnerRewardRate"), // パートナー成果報酬リワード率
  creatorRewardRate: int("creatorRewardRate"), // クリエイターの手数料リワード率
  partnerShopAdRate: int("partnerShopAdRate"), // パートナーのショップ広告成果報酬率
  creatorShopAdRate: int("creatorShopAdRate"), // クリエイターのショップ広告成果報酬率
  
  // 推定手数料
  estimatedCommissionBase: int("estimatedCommissionBase"), // 推定成果報酬ベース
  estimatedPartnerCommission: decimal("estimatedPartnerCommission", { precision: 12, scale: 2 }), // 推定パートナー手数料額
  estimatedCreatorCommission: decimal("estimatedCreatorCommission", { precision: 12, scale: 2 }), // 推定クリエイター手数料額
  estimatedPartnerReward: int("estimatedPartnerReward"), // パートナーの推定成果報酬リワード料
  estimatedCreatorReward: int("estimatedCreatorReward"), // クリエイターの推定成果報酬リワード料
  estimatedCreatorShopAdPay: int("estimatedCreatorShopAdPay"), // クリエイターのショップ広告成果報酬支払額（推定）
  estimatedPartnerShopAdPay: int("estimatedPartnerShopAdPay"), // パートナーのショップ広告成果報酬支払額（推定）
  
  // 実際の手数料
  actualCommissionBase: decimal("actualCommissionBase", { precision: 12, scale: 2 }), // 実際の手数料ベース
  actualPartnerCommission: decimal("actualPartnerCommission", { precision: 12, scale: 2 }), // 実際のパートナー手数料額
  actualCreatorCommission: decimal("actualCreatorCommission", { precision: 12, scale: 2 }), // 実際のクリエイター手数料額
  actualPartnerReward: decimal("actualPartnerReward", { precision: 12, scale: 2 }), // パートナーの実際の手数料リワード料
  actualCreatorReward: decimal("actualCreatorReward", { precision: 12, scale: 2 }), // クリエイターの実際の手数料リワード料
  actualPartnerShopAdPay: decimal("actualPartnerShopAdPay", { precision: 12, scale: 2 }), // パートナーのショップ広告成果報酬支払額（実際）
  actualCreatorShopAdPay: decimal("actualCreatorShopAdPay", { precision: 12, scale: 2 }), // クリエイターのショップ広告成果報酬支払額（実際）
  
  // 返品・返金
  returnQuantity: int("returnQuantity").default(0), // 返品される商品の数量
  refundQuantity: int("refundQuantity").default(0), // 返金される商品の数量
  
  // 日時情報
  orderCreatedAt: timestamp("orderCreatedAt"), // 注文作成日時
  orderDeliveredAt: timestamp("orderDeliveredAt"), // 注文配達日時
  commissionSettledAt: timestamp("commissionSettledAt"), // 手数料決済日時
  
  // 支払い情報
  paymentId: varchar("paymentId", { length: 64 }), // 支払いID
  paymentMethod: varchar("paymentMethod", { length: 50 }), // 支払い方法
  paymentAccount: varchar("paymentAccount", { length: 50 }), // 支払い口座
  
  // その他
  iva: int("iva").default(0), // IVA
  isr: int("isr").default(0), // ISR
  platform: varchar("platform", { length: 20 }), // プラットフォーム（TTS/TT_PRO）
  factorType: varchar("factorType", { length: 20 }), // 要因のタイプ
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TiktokCommissionOrder = typeof tiktokCommissionOrders.$inferSelect;
export type InsertTiktokCommissionOrder = typeof tiktokCommissionOrders.$inferInsert;

/**
 * TikTok CSV Import History table
 * TikTok CSVインポート履歴テーブル
 */
export const tiktokCsvImportHistory = mysqlTable("tiktok_csv_import_history", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  
  // ファイル情報
  fileName: varchar("fileName", { length: 512 }).notNull(), // 元のファイル名
  fileUrl: text("fileUrl"), // S3 URL
  fileKey: varchar("fileKey", { length: 512 }), // S3 key
  
  // インポート結果
  totalRows: int("totalRows").default(0), // 総行数
  importedRows: int("importedRows").default(0), // インポート成功行数
  skippedRows: int("skippedRows").default(0), // スキップ行数（重複等）
  errorRows: int("errorRows").default(0), // エラー行数
  
  // 集計サマリー
  totalSales: bigint("totalSales", { mode: "number" }).default(0), // 総売上
  totalPartnerCommission: bigint("totalPartnerCommission", { mode: "number" }).default(0), // パートナー手数料合計
  totalCreatorCommission: bigint("totalCreatorCommission", { mode: "number" }).default(0), // クリエイター手数料合計
  dateRangeStart: timestamp("dateRangeStart"), // データ期間（開始）
  dateRangeEnd: timestamp("dateRangeEnd"), // データ期間（終了）
  
  // ステータス
  status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(),
  errorMessage: text("errorMessage"), // エラーメッセージ
  
  // 作成者情報
  uploadedBy: int("uploadedBy").notNull(),
  uploadedByName: varchar("uploadedByName", { length: 255 }).notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TiktokCsvImportHistory = typeof tiktokCsvImportHistory.$inferSelect;
export type InsertTiktokCsvImportHistory = typeof tiktokCsvImportHistory.$inferInsert;


// ============================================
// ライブ配信セット組み管理
// ============================================

/**
 * Livestream Sets table for tracking set bundles sold during livestreams
 * ライブ配信で販売したセット組みを記録するテーブル
 */
export const livestreamSets = mysqlTable("livestream_sets", {
  id: int("id").autoincrement().primaryKey(),
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id
  
  // セット情報
  setName: varchar("setName", { length: 255 }).notNull(), // セット名（例：「美容3点セット」）
  setPrice: bigint("setPrice", { mode: "number" }).notNull(), // セット売値（円）
  quantitySold: int("quantitySold").default(1).notNull(), // 販売数量
  
  // 自動計算フィールド
  totalOriginalPrice: bigint("totalOriginalPrice", { mode: "number" }).default(0), // 元値合計（商品の元値を合算）
  discountRate: int("discountRate").default(0), // お得率（%）
  totalRevenue: bigint("totalRevenue", { mode: "number" }).default(0), // セット売上合計（売値 × 販売数量）
  
  // 作成者
  createdBy: int("createdBy").notNull().default(0),
  
  // 並び順
  sortOrder: int("sortOrder").default(0),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LivestreamSet = typeof livestreamSets.$inferSelect;
export type InsertLivestreamSet = typeof livestreamSets.$inferInsert;

/**
 * Livestream Set Items table for tracking individual products within a set
 * セット内の個別商品を記録するテーブル
 */
export const livestreamSetItems = mysqlTable("livestream_set_items", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull(), // References livestreamSets.id
  
  // 商品情報
  productName: varchar("productName", { length: 255 }).notNull(), // 商品名（自由入力）
  originalPrice: bigint("originalPrice", { mode: "number" }).notNull(), // 元値（定価）
  quantity: int("quantity").default(1).notNull(), // 個数（デフォルト1）
  
  // 並び順
  sortOrder: int("sortOrder").default(0),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LivestreamSetItem = typeof livestreamSetItems.$inferSelect;
export type InsertLivestreamSetItem = typeof livestreamSetItems.$inferInsert;

/**
 * Product Category Mappings table for manual product-to-category classification
 * 商品名→カテゴリの手動マッピングを記憶するテーブル
 * 一度設定すれば、同じ商品名は次回以降自動的に正しいカテゴリに分類される
 */
export const productCategoryMappings = mysqlTable("product_category_mappings", {
  id: int("id").autoincrement().primaryKey(),
  productName: varchar("productName", { length: 500 }).notNull(), // 商品名（完全一致で検索）
  category: varchar("category", { length: 255 }).notNull(), // 分類先カテゴリ名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductCategoryMapping = typeof productCategoryMappings.$inferSelect;
export type InsertProductCategoryMapping = typeof productCategoryMappings.$inferInsert;


/**
 * Simulations table for storing livestream simulation inputs and results
 * 配信シミュレーション：入力条件・計算結果・共有トークンを保存
 */
export const simulations = mysqlTable("simulations", {
  id: int("id").autoincrement().primaryKey(),
  shareToken: varchar("shareToken", { length: 64 }).notNull().unique(), // 公開共有用トークン
  
  // 商品条件（SKU）
  productName: varchar("productName", { length: 500 }), // 商品名（任意）
  brandId: int("brandId"), // ブランドID（任意）
  unitPrice: bigint("unitPrice", { mode: "number" }).notNull(), // 商品単価（円）= 実効価格
  listPrice: bigint("listPrice", { mode: "number" }), // 定価（円）
  sellingPrice: bigint("sellingPrice", { mode: "number" }), // 販売価格（円）
  costPrice: bigint("costPrice", { mode: "number" }), // 原価（円）
  grossMarginRate: decimal("grossMarginRate", { precision: 5, scale: 2 }), // 粗利率（%）
  hasSet: boolean("hasSet").default(false), // セット有無
  bundleName: varchar("bundleName", { length: 500 }), // セット名
  bundlePrice: bigint("bundlePrice", { mode: "number" }), // セット販売価格（売値）
  bundleItems: json("bundleItems").$type<Array<{ name: string; price: number }>>(), // セット内容
  expectedAov: bigint("expectedAov", { mode: "number" }), // 想定AOV（円）
  
  // ライバー条件
  liverId: int("liverId").notNull(), // 選択ライバーID
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).notNull(), // 成果報酬率（%）
  fixedFee: bigint("fixedFee", { mode: "number" }).default(0), // 固定報酬（円）
  contractType: mysqlEnum("simContractType", ["単発", "契約", "完全成果報酬"]).default("単発"), // 単発 / 契約 / 完全成果報酬
  
  // 実施条件
  streamDuration: int("streamDuration").notNull(), // 配信時間（分）
  timeSlot: varchar("timeSlot", { length: 50 }), // 時間帯（例："20:00-21:00"）
  dayOfWeek: varchar("dayOfWeek", { length: 20 }), // 曜日
  hasAd: boolean("hasAd").default(false), // 広告有無
  adBudget: bigint("adBudget", { mode: "number" }), // 広告予算（円）
  
  // 計算結果
  estimatedGmv: bigint("estimatedGmv", { mode: "number" }), // 想定GMV
  estimatedSalesCount: int("estimatedSalesCount"), // 想定販売数
  estimatedGrossProfit: bigint("estimatedGrossProfit", { mode: "number" }), // 想定粗利
  estimatedLiverCost: bigint("estimatedLiverCost", { mode: "number" }), // ライバー報酬合計
  estimatedNetProfit: bigint("estimatedNetProfit", { mode: "number" }), // 想定利益
  estimatedRoi: decimal("estimatedRoi", { precision: 8, scale: 2 }), // ROI（%）
  
  // AI予測結果
  aiPrediction: json("aiPrediction").$type<{
    confidence: number; // 予測信頼度（0-100）
    gmvRange: { min: number; max: number }; // GMVレンジ
    similarCases: { avgGmv: number; avgRoi: number; count: number }; // 類似案件統計
    reasoning: string; // AI分析コメント
    adjustmentFactors: Record<string, number>; // 補正係数
  }>(),
  
  // メタ情報
  status: mysqlEnum("simStatus", ["draft", "shared", "archived"]).default("draft"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Simulation = typeof simulations.$inferSelect;
export type InsertSimulation = typeof simulations.$inferInsert;

/**
 * Simulation Feedback table for tracking prediction accuracy
 * シミュレーション予測 vs 実績の差分を記録し、AI学習に活用
 */
export const simulationFeedback = mysqlTable("simulation_feedback", {
  id: int("id").autoincrement().primaryKey(),
  simulationId: int("simulationId").notNull(), // References simulations.id
  livestreamId: int("livestreamId"), // 紐付いた実際の配信ID（任意）
  
  // 実績データ
  actualGmv: bigint("actualGmv", { mode: "number" }), // 実際のGMV
  actualSalesCount: int("actualSalesCount"), // 実際の販売数
  actualNetProfit: bigint("actualNetProfit", { mode: "number" }), // 実際の利益
  actualRoi: decimal("actualRoi", { precision: 8, scale: 2 }), // 実際のROI
  
  // 差分分析
  gmvAccuracy: decimal("gmvAccuracy", { precision: 5, scale: 2 }), // GMV予測精度（%）
  overallAccuracy: decimal("overallAccuracy", { precision: 5, scale: 2 }), // 総合精度（%）
  
  // フィードバック
  feedbackNote: text("feedbackNote"), // 運営者メモ
  impactFactors: json("impactFactors").$type<string[]>(), // 影響要因（例：["広告効果大", "商品人気"]）
  
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SimulationFeedback = typeof simulationFeedback.$inferSelect;
export type InsertSimulationFeedback = typeof simulationFeedback.$inferInsert;


// ============================================
// LCJ MALL - 商品レビュー
// ============================================
export const mallProductReviews = mysqlTable("mall_product_reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  lineUserId: int("lineUserId").notNull(),
  rating: int("rating").notNull(), // 1-5
  title: varchar("title", { length: 100 }),
  content: text("content"),
  imageUrls: json("imageUrls").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MallProductReview = typeof mallProductReviews.$inferSelect;
export type InsertMallProductReview = typeof mallProductReviews.$inferInsert;

// ============================================
// LCJ MALL - 商品説明画像（LP風表示用）
// ============================================
export const mallProductDescImages = mysqlTable("mall_product_desc_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 500 }),
  sortOrder: int("sortOrder").notNull().default(0),
  caption: varchar("caption", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MallProductDescImage = typeof mallProductDescImages.$inferSelect;
export type InsertMallProductDescImage = typeof mallProductDescImages.$inferInsert;


// =====================================================
// Referral Code System (紹介コードシステム)
// ライバーが配信中に宣伝して新規ユーザーを獲得する仕組み
// =====================================================

/**
 * Referral Codes table
 * ライバーごとに4桁数字の紹介コードを管理
 */
export const referralCodes = mysqlTable("referral_codes", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id
  code: varchar("code", { length: 4 }).notNull().unique(), // 4桁数字の紹介コード
  isActive: boolean("isActive").default(true).notNull(), // コードが有効かどうか
  totalReferrals: int("totalReferrals").default(0).notNull(), // 累計紹介人数
  totalPointsEarned: bigint("totalPointsEarned", { mode: "number" }).default(0).notNull(), // 累計獲得ポイント
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;

/**
 * Referral History table
 * 紹介履歴（誰が誰を紹介したか・ポイント付与記録）
 */
export const referralHistory = mysqlTable("referral_history", {
  id: int("id").autoincrement().primaryKey(),
  referralCodeId: int("referralCodeId").notNull(), // References referral_codes.id
  referrerLiverId: int("referrerLiverId").notNull(), // 紹介したライバーのID
  referredLineUserId: int("referredLineUserId").notNull(), // 紹介された新規ユーザーのline_users.id
  // ステータス管理（不正防止）
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("pending").notNull(), // pending=登録時紐付け, confirmed=購入完了時ポイント付与済, cancelled=キャンセル
  // ポイント付与記録
  newUserPoints: int("newUserPoints").default(500).notNull(), // 新規ユーザーに付与したポイント
  referrerPoints: int("referrerPoints").default(200).notNull(), // 紹介ライバーに付与したポイント
  newUserPointAwarded: boolean("newUserPointAwarded").default(false).notNull(), // 新規ユーザーへのポイント付与済みか
  referrerPointAwarded: boolean("referrerPointAwarded").default(false).notNull(), // ライバーへのポイント付与済みか
  // タイムスタンプ
  confirmedAt: timestamp("confirmedAt"), // 購入完了・ポイント付与日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReferralHistoryRecord = typeof referralHistory.$inferSelect;
export type InsertReferralHistory = typeof referralHistory.$inferInsert;


// ============================================
// LCJ MALL - お気に入り
// ============================================
import { uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Mall Favorites table
 * お気に入り商品（ユーザーが気になる商品を保存）
 */
export const mallFavorites = mysqlTable("mall_favorites", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: int("lineUserId").notNull(),
  productId: int("productId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("unique_favorite").on(table.lineUserId, table.productId),
]);
export type MallFavorite = typeof mallFavorites.$inferSelect;
export type InsertMallFavorite = typeof mallFavorites.$inferInsert;

// ============================================
// LCJ MALL - 閲覧履歴
// ============================================
/**
 * Mall View History table
 * 商品閲覧履歴（最近チェックした商品を記録）
 */
export const mallViewHistory = mysqlTable("mall_view_history", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: int("lineUserId").notNull(),
  productId: int("productId").notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
});
export type MallViewHistory = typeof mallViewHistory.$inferSelect;
export type InsertMallViewHistory = typeof mallViewHistory.$inferInsert;


/**
 * Receipt Review Logs - レシート審査の学習データ蓄積テーブル
 * 管理者がレシートを承認・却下するたびに自動記録し、
 * 将来の自動承認判定の学習データとして活用する
 */
export const receiptReviewLogs = mysqlTable("receipt_review_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // レシート情報
  receiptType: mysqlEnum("receiptType", ["line_receipt", "web_receipt", "point_request"]).notNull(),
  receiptId: int("receiptId").notNull(), // 各テーブルのID
  
  // 審査結果
  decision: mysqlEnum("decision", ["approved", "rejected", "on_hold"]).notNull(),
  
  // 却下理由カテゴリ（却下時のみ）
  rejectionCategory: mysqlEnum("rejectionCategory", [
    "blurry_image",        // 画像が不鮮明
    "missing_order_number", // 注文番号が見えない
    "missing_amount",       // 金額が見えない
    "not_delivered",        // 配達未完了
    "duplicate",            // 重複申請
    "wrong_store",          // 対象外の店舗
    "suspicious",           // 不正の疑い
    "incomplete_info",      // 情報不足
    "not_order_detail",     // 注文詳細画面ではない（メール通知、配送通知等）
    "not_tiktok_shop",      // TikTok Shop以外のプラットフォーム
    "partial_screenshot",   // スクリーンショットが不完全（一部しか写っていない）
    "other",                // その他
  ]),
  rejectionNote: text("rejectionNote"), // 自由記述の却下理由
  
  // OCR関連の特徴量（学習用）
  ocrConfidence: decimal("ocrConfidence", { precision: 5, scale: 2 }), // OCR信頼度 (0-100)
  totalAmount: bigint("totalAmount", { mode: "number" }), // 購入金額
  hasOrderNumber: mysqlEnum("hasOrderNumber", ["yes", "no"]).default("no"), // 注文番号の有無
  imageCount: int("imageCount").default(1), // 画像枚数
  fraudScore: decimal("fraudScore", { precision: 5, scale: 2 }).default("0"), // 不正スコア
  fraudFlagCount: int("fraudFlagCount").default(0), // 不正フラグ数
  
  // ポイント情報
  pointsCalculated: bigint("pointsCalculated", { mode: "number" }), // 計算されたポイント
  pointsAwarded: bigint("pointsAwarded", { mode: "number" }), // 実際に付与されたポイント
  
  // 審査者情報
  reviewedBy: int("reviewedBy").notNull(), // 管理者のUser ID
  reviewDurationMs: bigint("reviewDurationMs", { mode: "number" }), // 審査にかかった時間（ミリ秒）
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReceiptReviewLog = typeof receiptReviewLogs.$inferSelect;
export type InsertReceiptReviewLog = typeof receiptReviewLogs.$inferInsert;


/**
 * AI Review Feedback table
 * AI自動判定の学習データ蓄積テーブル
 * 管理者がAI弾きレシートを審査した結果をフィードバックとして記録
 */
export const aiReviewFeedback = mysqlTable("ai_review_feedback", {
  id: int("id").autoincrement().primaryKey(),
  
  // レシート情報
  receiptId: int("receiptId").notNull(), // line_receipts.id
  receiptType: mysqlEnum("feedbackReceiptType", ["line_receipt", "web_receipt"]).notNull(),
  
  // AI判定情報
  aiDecision: mysqlEnum("aiDecision", ["not_tiktok", "not_delivered", "incomplete", "other"]).notNull(),
  aiRejectionReason: text("feedbackAiRejectionReason"),
  
  // 管理者の最終判断
  humanDecision: mysqlEnum("humanDecision", ["approved", "rejected"]).notNull(),
  humanNote: text("humanNote"),
  
  // AIの判断が正しかったか
  aiWasCorrect: boolean("aiWasCorrect").notNull(), // true=AIが正しかった（管理者も却下）, false=AI判断ミス（管理者承認）
  
  // 学習用の特徴量
  imageUrl: text("feedbackImageUrl"),
  imageUrls: json("feedbackImageUrls").$type<string[]>(),
  ocrRawText: text("feedbackOcrRawText"),
  totalAmount: bigint("feedbackTotalAmount", { mode: "number" }),
  storeName: varchar("feedbackStoreName", { length: 255 }),
  ocrConfidence: decimal("feedbackOcrConfidence", { precision: 5, scale: 2 }),
  
  // 審査者情報
  reviewedBy: int("feedbackReviewedBy").notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("feedbackCreatedAt").defaultNow().notNull(),
});
export type AiReviewFeedback = typeof aiReviewFeedback.$inferSelect;
export type InsertAiReviewFeedback = typeof aiReviewFeedback.$inferInsert;


// ===== Aitherhub Sync Logs =====
/**
 * Aitherhub同期ログテーブル
 * Webhook受信や手動同期の結果を記録し、管理画面で確認可能にする
 */
export const aitherhubSyncLogs = mysqlTable("aitherhub_sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // 同期の種類
  eventType: varchar("eventType", { length: 100 }).notNull(), // "webhook_received", "manual_sync"
  
  // 結果
  status: mysqlEnum("syncStatus", ["success", "error", "partial"]).notNull(),
  
  // ライバー情報（解決できた場合）
  liverId: int("liverId"),
  liverEmail: varchar("liverEmail", { length: 255 }),
  streamerName: varchar("streamerName", { length: 255 }),
  
  // ブランド情報
  brandId: int("brandId"),
  
  // 配信情報
  livestreamId: int("livestreamId"), // 作成/更新されたlivestream ID
  livestreamDate: timestamp("livestreamDate"),
  
  // 同期結果の詳細
  action: mysqlEnum("syncAction", ["created", "updated", "skipped"]), // 実行されたアクション
  recordsProcessed: int("recordsProcessed").default(0), // 処理件数
  
  // メッセージ
  message: text("message"), // 成功/エラーメッセージ
  errorDetail: text("errorDetail"), // エラー詳細
  
  // リクエスト情報（機密情報除外）
  requestSummary: json("requestSummary"), // 受信ペイロードの要約
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AitherhubSyncLog = typeof aitherhubSyncLogs.$inferSelect;
export type InsertAitherhubSyncLog = typeof aitherhubSyncLogs.$inferInsert;

/**
 * 入荷リクエストテーブル
 * ユーザーが「入荷してほしい」と投票した商品を記録
 */
export const productRestockRequests = mysqlTable("product_restock_requests", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  userId: int("userId").notNull(), // リクエストしたユーザーID
  
  // 商品情報（tiktok_commission_ordersから正規化）
  productName: text("productName").notNull(), // 商品名
  shopName: varchar("shopName", { length: 255 }), // ショップ名（ブランド名）
  productId: varchar("productId", { length: 64 }), // TikTok商品ID（あれば）
  
  // ステータス
  status: mysqlEnum("status", ["active", "fulfilled", "cancelled"]).default("active").notNull(),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProductRestockRequest = typeof productRestockRequests.$inferSelect;
export type InsertProductRestockRequest = typeof productRestockRequests.$inferInsert;


/**
 * Receipt products - extracted product info from line_receipts OCR data
 * Used for "みんなの購入ランキング" (purchase ranking based on actual receipts)
 */
export const receiptProducts = mysqlTable("receipt_products", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(), // FK to line_receipts.id
  userId: int("userId"), // FK to users.id (the buyer)
  productName: text("productName").notNull(), // 商品名（OCRから抽出）
  shopName: varchar("shopName", { length: 255 }), // ショップ名
  amount: int("amount"), // 購入金額
  orderNumber: varchar("orderNumber", { length: 100 }), // 注文番号
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReceiptProduct = typeof receiptProducts.$inferSelect;
export type InsertReceiptProduct = typeof receiptProducts.$inferInsert;


// ========================================
// 友達招待チャレンジ（ゲーミフィケーション）
// ========================================

/** キャンペーン定義 */
export const referralCampaigns = mysqlTable("referral_campaigns", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  maxDailyReferrals: int("max_daily_referrals").default(5).notNull(),
  monthlyPointCap: int("monthly_point_cap").default(5000).notNull(),
  inviteeBonus: int("invitee_bonus").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ReferralCampaign = typeof referralCampaigns.$inferSelect;

/** ステージ定義 */
export const campaignStages = mysqlTable("campaign_stages", {
  id: int("id").primaryKey().autoincrement(),
  campaignId: int("campaign_id").notNull(),
  stageNumber: int("stage_number").notNull(),
  requiredReferrals: int("required_referrals").notNull(),
  fixedReward: int("fixed_reward").notNull(),
  spinCount: int("spin_count").default(1).notNull(),
  isSpecialSpin: boolean("is_special_spin").default(false).notNull(),
  stageEmoji: varchar("stage_emoji", { length: 10 }).default("🌸").notNull(),
  stageName: varchar("stage_name", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CampaignStage = typeof campaignStages.$inferSelect;

/** ユーザー進捗 */
export const userReferralProgress = mysqlTable("user_referral_progress", {
  id: int("id").primaryKey().autoincrement(),
  lineUserId: int("lineUserId").notNull(),
  campaignId: int("campaignId").notNull(),
  referralCode: varchar("referralCode", { length: 20 }).notNull(),
  totalReferrals: int("totalReferrals").default(0).notNull(),
  currentStage: int("currentStage").default(0).notNull(),
  totalPointsEarned: bigint("totalPointsEarned", { mode: "number" }).default(0).notNull(),
  pendingSpins: int("pendingSpins").default(0).notNull(),
  pendingSpecialSpins: int("pendingSpecialSpins").default(0).notNull(),
  titleLevel: varchar("titleLevel", { length: 20 }).default("none").notNull(),
  monthlyPointsEarned: bigint("monthlyPointsEarned", { mode: "number" }).default(0).notNull(),
  monthlyPointsResetAt: timestamp("monthlyPointsResetAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type UserReferralProgress = typeof userReferralProgress.$inferSelect;

/** 友達招待記録 */
export const friendReferrals = mysqlTable("user_referrals", {
  id: int("id").primaryKey().autoincrement(),
  referrerLineUserId: int("referrerLineUserId").notNull(),
  inviteeLineUserId: int("inviteeLineUserId").notNull(),
  campaignId: int("campaignId").notNull(),
  referrerPointsAwarded: int("referrerPointsAwarded").default(0).notNull(),
  inviteePointsAwarded: int("inviteePointsAwarded").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FriendReferral = typeof friendReferrals.$inferSelect;

/** スピン報酬テーブル */
export const spinRewardTables = mysqlTable("spin_reward_tables", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  isSpecial: boolean("isSpecial").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SpinRewardTable = typeof spinRewardTables.$inferSelect;

/** スピン報酬アイテム */
export const spinRewardItems = mysqlTable("spin_reward_items", {
  id: int("id").primaryKey().autoincrement(),
  tableId: int("tableId").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).default("🎀").notNull(),
  points: int("points").notNull(),
  probability: int("probability").notNull(),
  color: varchar("color", { length: 20 }).default("#ec4899").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type SpinRewardItem = typeof spinRewardItems.$inferSelect;

/** スピン履歴 */
export const userSpinHistory = mysqlTable("spin_history", {
  id: int("id").primaryKey().autoincrement(),
  lineUserId: int("lineUserId").notNull(),
  campaignId: int("campaignId").notNull(),
  rewardItemId: int("rewardItemId").notNull(),
  pointsWon: int("pointsWon").notNull(),
  isSpecialSpin: boolean("isSpecialSpin").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserSpinHistory = typeof userSpinHistory.$inferSelect;

/** アクティビティフィード */
export const referralActivityFeed = mysqlTable("referral_activity_feed", {
  id: int("id").primaryKey().autoincrement(),
  lineUserId: int("lineUserId"),
  activityType: varchar("activityType", { length: 30 }).notNull(),
  message: text("message").notNull(),
  pointsAmount: int("pointsAmount").default(0),
  stageNumber: int("stageNumber").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReferralActivityFeed = typeof referralActivityFeed.$inferSelect;


// ============================================================
// ブログ（メディア）機能
// ============================================================

/** ブログカテゴリ */
export const blogCategories = mysqlTable("blog_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlogCategory = typeof blogCategories.$inferSelect;
export type InsertBlogCategory = typeof blogCategories.$inferInsert;

/** ブログタグ */
export const blogTags = mysqlTable("blog_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BlogTag = typeof blogTags.$inferSelect;
export type InsertBlogTag = typeof blogTags.$inferInsert;

/** ブログ記事 */
export const blogArticles = mysqlTable("blog_articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"), // 抜粋（一覧表示用）
  content: json("content").$type<Record<string, unknown>>(), // Tiptap JSON
  contentHtml: text("contentHtml"), // レンダリング済みHTML（SEO用）
  coverImageUrl: text("coverImageUrl"), // アイキャッチ画像
  coverImageKey: varchar("coverImageKey", { length: 512 }),
  categoryId: int("categoryId"), // References blogCategories.id
  authorId: int("authorId").notNull(), // References users.id
  status: mysqlEnum("status", ["draft", "published", "scheduled"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"), // 公開日時（予約公開対応）
  seoTitle: varchar("seoTitle", { length: 255 }), // SEO用タイトル（未設定ならtitleを使用）
  seoDescription: text("seoDescription"), // SEO用ディスクリプション
  ogImageUrl: text("ogImageUrl"), // OGP画像URL
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlogArticle = typeof blogArticles.$inferSelect;
export type InsertBlogArticle = typeof blogArticles.$inferInsert;

/** ブログ記事-タグ中間テーブル */
export const blogArticleTags = mysqlTable("blog_article_tags", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(), // References blogArticles.id
  tagId: int("tagId").notNull(), // References blogTags.id
});
export type BlogArticleTag = typeof blogArticleTags.$inferSelect;
export type InsertBlogArticleTag = typeof blogArticleTags.$inferInsert;

// =============================================
// Auto-Publish Scheduler Tables (matches existing DB)
// =============================================

/** 自動投稿スケジュール設定 */
export const autoPostSchedules = mysqlTable("auto_post_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  intervalDays: int("intervalDays").default(1).notNull(),
  preferredHour: int("preferredHour").default(10).notNull(),
  keywordStrategy: mysqlEnum("keywordStrategy", ["preset", "custom", "ai_suggest"]).default("preset").notNull(),
  customKeywords: json("customKeywords").$type<string[]>(),
  categoryId: int("categoryId"),
  articleType: mysqlEnum("articleType", ["guide", "review", "comparison", "news", "howto", "listicle"]).default("guide").notNull(),
  tone: mysqlEnum("tone", ["professional", "casual", "friendly", "authoritative"]).default("professional").notNull(),
  articleLength: mysqlEnum("articleLength", ["short", "standard", "long"]).default("standard").notNull(),
  language: mysqlEnum("language", ["ja", "en", "zh", "ko", "th"]).default("ja").notNull(),
  generateImages: boolean("generateImages").default(true).notNull(),
  autoPublish: mysqlEnum("autoPublish", ["draft", "publish", "scheduled"]).default("draft").notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  totalGenerated: int("totalGenerated").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AutoPostSchedule = typeof autoPostSchedules.$inferSelect;
export type InsertAutoPostSchedule = typeof autoPostSchedules.$inferInsert;

/** 自動投稿用プリセットキーワード */
export const presetKeywords = mysqlTable("preset_keywords", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  priority: int("priority").default(0).notNull(),
  usedCount: int("usedCount").default(0).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PresetKeyword = typeof presetKeywords.$inferSelect;
export type InsertPresetKeyword = typeof presetKeywords.$inferInsert;

/** 自動投稿実行履歴 */
export const autoPostLogs = mysqlTable("auto_post_logs", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("scheduleId").notNull(),
  articleId: int("articleId"),
  status: mysqlEnum("status", ["pending", "generating", "image_generating", "publishing", "completed", "failed"]).default("pending").notNull(),
  keyword: varchar("keyword", { length: 255 }),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AutoPostLog = typeof autoPostLogs.$inferSelect;
export type InsertAutoPostLog = typeof autoPostLogs.$inferInsert;


// ============================================
// レシート確変チャンス＋購入証明付きレビュー
// ============================================

/**
 * Receipt Kakuhen Chance - 確変チャンス結果テーブル
 * レシート申請時の確変チャンス（還元率UP＋全額還元抽選）の結果を記録
 */
export const receiptKakuhenResults = mysqlTable("receipt_kakuhen_results", {
  id: int("id").autoincrement().primaryKey(),
  
  // 紐付け（pointRequests or lineReceipts）
  receiptType: mysqlEnum("receiptType", ["point_request", "line_receipt"]).notNull(),
  receiptId: int("receiptId").notNull(), // 各テーブルのID
  userId: int("userId"), // Web users (nullable for LINE users)
  lineUserId: varchar("lineUserId", { length: 64 }), // LINE users
  
  // TikTok URL（確変チャンスの条件）
  tiktokUrl: text("tiktokUrl"),
  
  // 確変チャンス結果
  baseRate: decimal("baseRate", { precision: 5, scale: 2 }).notNull().default("1.00"), // 基本還元率（%）
  boostedRate: decimal("boostedRate", { precision: 5, scale: 2 }).notNull().default("1.00"), // 確変後の還元率（%）
  isKakuhen: boolean("isKakuhen").default(false).notNull(), // 確変モードに入ったか
  
  // 全額還元抽選
  lotteryNumber: varchar("lotteryNumber", { length: 10 }), // 抽選番号（ユーザーの番号）
  winningNumber: varchar("winningNumber", { length: 10 }), // 当選番号
  isJackpot: boolean("isJackpot").default(false).notNull(), // 全額還元当選か
  
  // ポイント計算
  orderAmount: int("orderAmount").notNull(), // 注文金額
  basePoints: int("basePoints").notNull(), // 通常ポイント（1%）
  actualPoints: int("actualPoints").notNull(), // 実際に付与されたポイント
  bonusPoints: int("bonusPoints").default(0).notNull(), // ボーナスポイント（確変分）
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReceiptKakuhenResult = typeof receiptKakuhenResults.$inferSelect;
export type InsertReceiptKakuhenResult = typeof receiptKakuhenResults.$inferInsert;


/**
 * Receipt Reviews - 購入証明付きレビューテーブル
 * レシート（購入証明）がある人だけが書ける100%リアルな口コミ
 * @cosmeキラー：ステマなしの信頼できるレビューDB
 */
export const receiptReviews = mysqlTable("receipt_reviews", {
  id: int("id").autoincrement().primaryKey(),
  
  // 紐付け
  receiptType: mysqlEnum("receiptType", ["point_request", "line_receipt"]).notNull(),
  receiptId: int("receiptId").notNull(), // 各テーブルのID
  kakuhenResultId: int("kakuhenResultId"), // 確変チャンス結果への紐付け（任意）
  userId: int("userId"), // Web users
  lineUserId: varchar("lineUserId", { length: 64 }), // LINE users
  
  // 商品情報（レシートOCRから自動認識）
  productName: text("productName").notNull(), // 商品名
  brandName: varchar("brandName", { length: 255 }), // ブランド名
  shopName: varchar("shopName", { length: 255 }), // ショップ名
  purchaseAmount: int("purchaseAmount"), // 購入金額
  category: varchar("category", { length: 100 }), // カテゴリ（コスメ、ファッション等）
  
  // レビュー内容
  rating: int("rating").notNull(), // 星評価（1-5）
  reviewText: text("reviewText").notNull(), // レビュー本文
  tags: json("tags").$type<string[]>(), // タグ（例：["コスパ最高", "リピ確定"]）
  
  // レシート画像（購入証明）
  receiptImageUrl: text("receiptImageUrl"), // レシート画像URL（証明用）
  
  // 商品画像
  productImageUrl: text("productImageUrl"), // 商品画像URL
  
  // 購入プラットフォーム
  purchasePlatform: varchar("purchasePlatform", { length: 50 }), // TikTok Shop, Qoo10, Amazon, 楽天, SHEIN, LCJ MALL等
  
  // 動画・ライブコマースリンク
  tiktokUrl: text("tiktokUrl"), // TikTok動画URL
  videoUrl: text("videoUrl"), // その他動画URL（YouTube等）
  liveCommerceUrl: text("liveCommerceUrl"), // ライブコマース録画URL
  
  // モデレーション
  isVisible: boolean("isVisible").default(true).notNull(), // 表示/非表示
  reportCount: int("reportCount").default(0).notNull(), // 通報回数
  
  // 統計
  helpfulCount: int("helpfulCount").default(0).notNull(), // 「参考になった」数
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReceiptReview = typeof receiptReviews.$inferSelect;
export type InsertReceiptReview = typeof receiptReviews.$inferInsert;


/**
 * レビューリアクション（「私も買った！」「欲しい！」）
 */
export const reviewReactions = mysqlTable("review_reactions", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(), // receipt_reviews.id
  userId: int("userId"), // Web users
  lineUserId: varchar("lineUserId", { length: 64 }), // LINE users
  reactionType: mysqlEnum("reactionType", ["bought", "want"]).notNull(), // bought=私も買った！, want=欲しい！
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReviewReaction = typeof reviewReactions.$inferSelect;
export type InsertReviewReaction = typeof reviewReactions.$inferInsert;

/**
 * レビューQ&A（商品への質問・回答）
 */
export const reviewQuestions = mysqlTable("review_questions", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(), // receipt_reviews.id
  productName: text("productName").notNull(), // 商品名（検索用）
  userId: int("userId"), // 質問者のWeb user ID
  lineUserId: varchar("lineUserId", { length: 64 }), // 質問者のLINE user ID
  questionText: text("questionText").notNull(), // 質問内容
  
  // 回答
  answerUserId: int("answerUserId"), // 回答者のWeb user ID
  answerLineUserId: varchar("answerLineUserId", { length: 64 }), // 回答者のLINE user ID
  answerText: text("answerText"), // 回答内容
  answeredAt: timestamp("answeredAt"), // 回答日時
  
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReviewQuestion = typeof reviewQuestions.$inferSelect;
export type InsertReviewQuestion = typeof reviewQuestions.$inferInsert;


// ============================================
// Beauty Wallet連携
// LCJポイント → Beauty Walletトークン交換
// ============================================

/**
 * BWアカウント連携テーブル
 * LCJ MALLユーザーとBeauty Walletアカウントの紐付け
 * OAuth的フローで連携：LCJ → BW登録/ログイン → コールバックで紐付け
 */
export const bwLinkedAccounts = mysqlTable("bw_linked_accounts", {
  id: int("id").autoincrement().primaryKey(),
  
  // LCJ側のユーザー（line_users.id）
  lineUserId: int("lineUserId").notNull().unique(), // References line_users.id
  
  // BW側のアカウント情報
  bwUserId: varchar("bwUserId", { length: 128 }).notNull(), // Beauty Wallet側のユーザーID
  bwCustomerId: int("bwCustomerId"), // BW側のsb_customers.id（トークン付与API用）
  bwDisplayName: varchar("bwDisplayName", { length: 255 }), // BW側の表示名
  bwEmail: varchar("bwEmail", { length: 320 }), // BW側のメールアドレス
  
  // 連携状態
  status: mysqlEnum("status", ["active", "unlinked"]).default("active").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(), // 連携日時
  unlinkedAt: timestamp("unlinkedAt"), // 連携解除日時
  
  // OAuth連携用
  linkToken: varchar("linkToken", { length: 128 }), // 連携フロー用の一時トークン
  linkTokenExpiresAt: timestamp("linkTokenExpiresAt"), // トークン有効期限
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BwLinkedAccount = typeof bwLinkedAccounts.$inferSelect;
export type InsertBwLinkedAccount = typeof bwLinkedAccounts.$inferInsert;

/**
 * ポイント交換履歴テーブル
 * LCJポイント → Beauty Walletトークンの交換記録
 * 交換レート: 100 LCJポイント = 40 Beauty Token（= 0.4円換算）
 */
export const pointExchanges = mysqlTable("point_exchanges", {
  id: int("id").autoincrement().primaryKey(),
  
  // ユーザー情報
  lineUserId: int("lineUserId").notNull(), // References line_users.id
  bwLinkedAccountId: int("bwLinkedAccountId").notNull(), // References bw_linked_accounts.id
  
  // 交換内容
  lcjPointsUsed: bigint("lcjPointsUsed", { mode: "number" }).notNull(), // 使用したLCJポイント
  bwTokensReceived: bigint("bwTokensReceived", { mode: "number" }).notNull(), // 受け取ったBWトークン
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }).notNull(), // 交換レート（0.4000 = 100pt→40BT）
  
  // BW側への反映状態
  bwTransferStatus: mysqlEnum("bwTransferStatus", [
    "pending",    // BW側APIへの送信待ち
    "processing", // BW側APIに送信中
    "completed",  // BW側で反映完了
    "failed",     // BW側への反映失敗
  ]).default("pending").notNull(),
  bwTransactionId: varchar("bwTransactionId", { length: 128 }), // BW側のトランザクションID（API応答）
  bwTransferError: text("bwTransferError"), // エラーメッセージ（失敗時）
  bwTransferredAt: timestamp("bwTransferredAt"), // BW側反映日時
  retryCount: int("retryCount").default(0).notNull(), // リトライ回数
  
  // LCJ側のポイントトランザクション参照
  pointTransactionId: int("pointTransactionId"), // References line_point_transactions.id
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PointExchange = typeof pointExchanges.$inferSelect;
export type InsertPointExchange = typeof pointExchanges.$inferInsert;

// ===== AI自動審査ログ =====
// AIが各レシートに対して行った判定の全履歴（人間が後から確認・修正するため）
export const aiAutoReviewLogs = mysqlTable("ai_auto_review_logs", {
  id: int("id").primaryKey().autoincrement(),
  batchId: varchar("batchId", { length: 64 }).notNull(),
  receiptId: int("receiptId").notNull(),
  lineUserId: varchar("lineUserId", { length: 128 }),
  aiDecision: varchar("aiDecision", { length: 32 }).notNull(),
  aiConfidence: int("aiConfidence"),
  aiComment: text("aiComment"),
  aiReason: text("aiReason"),
  orderNumber: varchar("orderNumber", { length: 64 }),
  totalAmount: int("totalAmount"),
  storeName: varchar("storeName", { length: 256 }),
  imageUrl: text("imageUrl"),
  humanOverride: varchar("humanOverride", { length: 32 }),
  humanComment: text("humanComment"),
  humanReviewedBy: int("humanReviewedBy"),
  humanReviewedAt: timestamp("humanReviewedAt"),
  isDryRun: boolean("isDryRun").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiAutoReviewLog = typeof aiAutoReviewLogs.$inferSelect;
export type InsertAiAutoReviewLog = typeof aiAutoReviewLogs.$inferInsert;

// ===== AI自動承認モード設定 =====
export const aiAutoApproveSettings = mysqlTable("ai_auto_approve_settings", {
  id: int("id").primaryKey().autoincrement(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  isRunning: boolean("isRunning").default(false).notNull(),
  confidenceThreshold: int("confidenceThreshold").default(85).notNull(),
  batchSize: int("batchSize").default(20).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  lastRunBatchId: varchar("lastRunBatchId", { length: 64 }),
  totalProcessed: int("totalProcessed").default(0).notNull(),
  totalApproved: int("totalApproved").default(0).notNull(),
  totalRejected: int("totalRejected").default(0).notNull(),
  totalHeld: int("totalHeld").default(0).notNull(),
  totalSkipped: int("totalSkipped").default(0).notNull(),
  currentBatchNumber: int("currentBatchNumber").default(0).notNull(),
  startedAt: timestamp("startedAt"),
  stoppedAt: timestamp("stoppedAt"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiAutoApproveSetting = typeof aiAutoApproveSettings.$inferSelect;


// ===== AIレシート審査 学習フィードバック =====
export const aiReceiptLearningExamples = mysqlTable("ai_receipt_learning_examples", {
  id: int("id").primaryKey().autoincrement(),
  reviewLogId: int("reviewLogId").notNull(), // 元のAI審査ログID
  receiptId: int("receiptId").notNull(), // レシートID
  imageUrl: text("imageUrl"), // 画像URL（参照用）
  aiOriginalDecision: varchar("aiOriginalDecision", { length: 50 }).notNull(), // AI元判定
  aiOriginalConfidence: int("aiOriginalConfidence"), // AI元信頼度
  aiOriginalComment: text("aiOriginalComment"), // AIコメント
  aiOriginalOrderNumber: varchar("aiOriginalOrderNumber", { length: 100 }), // AI認識の注文番号
  aiOriginalAmount: int("aiOriginalAmount"), // AI認識の金額
  aiOriginalStoreName: varchar("aiOriginalStoreName", { length: 255 }), // AI認識の店舗名
  humanDecision: varchar("humanDecision", { length: 50 }).notNull(), // 人間の判定
  humanComment: text("humanComment"), // 人間のコメント
  correctOrderNumber: varchar("correctOrderNumber", { length: 100 }), // 正しい注文番号
  correctAmount: int("correctAmount"), // 正しい金額
  correctStoreName: varchar("correctStoreName", { length: 255 }), // 正しい店舗名
  errorType: varchar("errorType", { length: 100 }), // エラー種別
  learningNote: text("learningNote"), // 学習メモ
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiReceiptLearningExample = typeof aiReceiptLearningExamples.$inferSelect;


// ===== Beauty Wallet ポップアップ ABテスト（自己学習型） =====

/**
 * Popup variants: each combination of theme × menu items shown
 * The Bandit algorithm selects which variant to show based on CTR
 */
export const popupVariants = mysqlTable("popup_variants", {
  id: int("id").autoincrement().primaryKey(),
  variantKey: varchar("variantKey", { length: 128 }).notNull().unique(), // e.g. "gold_matsek_nail_headspa_treatment"
  theme: varchar("theme", { length: 32 }).notNull(), // "gold" | "pink"
  menuItems: json("menuItems").$type<{ name: string; imageUrl: string; ptLabel: string }[]>().notNull(),
  headline: varchar("headline", { length: 255 }).notNull(),
  subtext: varchar("subtext", { length: 255 }).notNull(),
  ctaText: varchar("ctaText", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  impressions: int("impressions").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PopupVariant = typeof popupVariants.$inferSelect;
export type InsertPopupVariant = typeof popupVariants.$inferInsert;

/**
 * Popup impressions: each time a popup is shown to a user
 */
export const popupImpressions = mysqlTable("popup_impressions", {
  id: int("id").autoincrement().primaryKey(),
  variantId: int("variantId").notNull(),
  lineUserId: int("lineUserId"), // nullable for anonymous
  sessionId: varchar("sessionId", { length: 128 }), // browser session
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PopupImpression = typeof popupImpressions.$inferSelect;

/**
 * Popup clicks: each time a user clicks the CTA button
 */
export const popupClicks = mysqlTable("popup_clicks", {
  id: int("id").autoincrement().primaryKey(),
  variantId: int("variantId").notNull(),
  lineUserId: int("lineUserId"),
  sessionId: varchar("sessionId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PopupClick = typeof popupClicks.$inferSelect;


// =====================================================
// Image Perceptual Hash & Fraud Ring Detection System
// =====================================================

/**
 * Image perceptual hashes for duplicate image detection
 * Stores phash (perceptual hash) for each receipt image
 * phash is robust against resizing, compression, minor edits
 */
export const imagePerceptualHashes = mysqlTable("image_perceptual_hashes", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(), // References line_receipts.id
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(),
  imageUrl: text("imageUrl").notNull(), // S3 URL of the image
  imageIndex: int("imageIndex").default(0).notNull(), // Index in imageUrls array (0 = primary)
  
  // Perceptual hashes
  phash: varchar("phash", { length: 64 }).notNull(), // 64-bit perceptual hash as binary string
  
  // Metadata
  imageWidth: int("imageWidth"),
  imageHeight: int("imageHeight"),
  fileSize: int("fileSize"), // bytes
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ImagePerceptualHash = typeof imagePerceptualHashes.$inferSelect;
export type InsertImagePerceptualHash = typeof imagePerceptualHashes.$inferInsert;

/**
 * Fraud rings - groups of connected suspicious users/receipts
 * A ring represents a cluster of users connected by shared images or order numbers
 */
export const fraudRings = mysqlTable("fraud_rings", {
  id: int("id").autoincrement().primaryKey(),
  ringLabel: varchar("ringLabel", { length: 64 }).notNull(), // e.g., "RING-2026-0001"
  status: mysqlEnum("status", ["suspected", "confirmed", "dismissed"]).default("suspected").notNull(),
  
  // Ring statistics
  memberCount: int("memberCount").default(0).notNull(),
  receiptCount: int("receiptCount").default(0).notNull(),
  totalFraudAmount: bigint("totalFraudAmount", { mode: "number" }).default(0),
  
  // Hub user (the central node with most connections)
  hubLineUserId: varchar("hubLineUserId", { length: 64 }),
  hubDisplayName: varchar("hubDisplayName", { length: 255 }),
  
  // Connection type that formed this ring
  connectionType: mysqlEnum("connectionType", [
    "same_image",        // Members share the same receipt image
    "same_order",        // Members share the same order number (cross-user)
    "mixed",             // Both image and order connections
  ]).notNull(),
  
  // Admin notes
  notes: text("notes"),
  confirmedBy: int("confirmedBy"), // Admin who confirmed the ring
  confirmedAt: timestamp("confirmedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FraudRing = typeof fraudRings.$inferSelect;
export type InsertFraudRing = typeof fraudRings.$inferInsert;

/**
 * Fraud ring members - users belonging to a fraud ring
 */
export const fraudRingMembers = mysqlTable("fraud_ring_members", {
  id: int("id").autoincrement().primaryKey(),
  ringId: int("ringId").notNull(), // References fraud_rings.id
  lineUserId: varchar("lineUserId", { length: 64 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  
  // Connection info
  connectionReason: mysqlEnum("connectionReason", [
    "same_image",        // Submitted same image as another member
    "same_order",        // Submitted same order number as another member
    "hub",               // Central node of the ring
  ]).notNull(),
  connectedToMemberId: int("connectedToMemberId"), // The member this one is connected to
  
  // Evidence
  evidenceReceiptId: int("evidenceReceiptId"), // The receipt that links this member
  evidenceDetail: text("evidenceDetail"), // Description of the connection
  
  // Impact
  receiptCount: int("receiptCount").default(0), // Number of receipts from this member in the ring
  totalAmount: bigint("totalAmount", { mode: "number" }).default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FraudRingMember = typeof fraudRingMembers.$inferSelect;
export type InsertFraudRingMember = typeof fraudRingMembers.$inferInsert;

/**
 * Fraud ring evidence - detailed evidence records for each connection
 */
export const fraudRingEvidence = mysqlTable("fraud_ring_evidence", {
  id: int("id").autoincrement().primaryKey(),
  ringId: int("ringId").notNull(), // References fraud_rings.id
  
  // The two connected items
  receiptId1: int("receiptId1").notNull(),
  lineUserId1: varchar("lineUserId1", { length: 64 }).notNull(),
  receiptId2: int("receiptId2").notNull(),
  lineUserId2: varchar("lineUserId2", { length: 64 }).notNull(),
  
  // Connection type
  evidenceType: mysqlEnum("evidenceType", [
    "same_image",        // phash distance < threshold
    "same_order",        // Same order number, different users
  ]).notNull(),
  
  // Details
  phashDistance: int("phashDistance"), // Hamming distance (for same_image)
  orderNumber: varchar("orderNumber", { length: 64 }), // (for same_order)
  imageUrl1: text("imageUrl1"),
  imageUrl2: text("imageUrl2"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FraudRingEvidence = typeof fraudRingEvidence.$inferSelect;
export type InsertFraudRingEvidence = typeof fraudRingEvidence.$inferInsert;

/**
 * User trust level - dynamic trust scoring for review level adjustment
 * Ring connection → stricter review; clean history → relaxed review
 */
export const userTrustLevels = mysqlTable("user_trust_levels", {
  id: int("id").autoincrement().primaryKey(),
  lineUserId: varchar("lineUserId", { length: 64 }).notNull().unique(),
  
  // Trust level: 1=highest trust (relaxed review), 5=lowest trust (strict review)
  trustLevel: int("trustLevel").default(3).notNull(), // Default: normal (3)
  
  // Factors
  ringMembershipCount: int("ringMembershipCount").default(0), // Number of rings this user belongs to
  confirmedFraudCount: int("confirmedFraudCount").default(0), // Number of confirmed fraud incidents
  totalApprovedReceipts: int("totalApprovedReceipts").default(0), // Clean approved receipts
  totalRejectedReceipts: int("totalRejectedReceipts").default(0), // Rejected receipts
  
  // Override
  manualOverride: boolean("manualOverride").default(false), // Admin manually set trust level
  overrideBy: int("overrideBy"), // Admin who overrode
  overrideReason: text("overrideReason"),
  
  lastCalculatedAt: timestamp("lastCalculatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserTrustLevel = typeof userTrustLevels.$inferSelect;
export type InsertUserTrustLevel = typeof userTrustLevels.$inferInsert;
