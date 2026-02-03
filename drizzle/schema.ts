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
  lineLinkCode: varchar("lineLinkCode", { length: 6 }), // LINE連携コード（6桁）
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
 * MALL商品テーブル
 */
export const mallProducts = mysqlTable("mall_products", {
  id: int("id").autoincrement().primaryKey(),
  
  // 基本情報
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  
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
    "pending",      // 注文受付
    "confirmed",    // 確認済み
    "shipped",      // 発送済み
    "delivered",    // 配達完了
    "cancelled",    // キャンセル
  ]).default("pending").notNull(),
  
  // 金額
  totalAmount: int("totalAmount").notNull(), // 合計金額（円）
  pointsUsed: int("pointsUsed").default(0).notNull(), // 使用ポイント
  cashAmount: int("cashAmount").default(0).notNull(), // 現金支払い額
  
  // 配送先情報
  shippingName: varchar("shippingName", { length: 255 }),
  shippingPhone: varchar("shippingPhone", { length: 50 }),
  shippingPostalCode: varchar("shippingPostalCode", { length: 20 }),
  shippingAddress: text("shippingAddress"),
  
  // メモ
  notes: text("notes"),
  adminNotes: text("adminNotes"), // 管理者用メモ
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
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
