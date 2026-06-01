import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json, boolean, decimal, tinyint } from "drizzle-orm/mysql-core";

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
  tier: varchar("tier", { length: 10 }), // 人事Tier (tier1~tier6)
  evaluationScore: int("evaluationScore"), // ランク内評価 (-2~+4)
  salary: decimal("salary", { precision: 10, scale: 2 }), // 月給
  salaryCurrency: varchar("salaryCurrency", { length: 5 }).default("JPY"), // 通貨 (JPY/RMB)
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
  shopId: varchar("shopId", { length: 100 }), // 店舗ID
  shopCode: varchar("shopCode", { length: 100 }), // ショップコード
  memo: text("memo"), // メモ
  businessManagerId: int("businessManagerId"), // 商務負責人 (References staff.id)
  operationsManagerId: int("operationsManagerId"), // 運営負責人 (References staff.id)
  // 飞书(Lark)同期フィールド
  larkRecordId: varchar("larkRecordId", { length: 255 }), // 飞书レコードID
  larkStage: varchar("larkStage", { length: 100 }), // 当前阶段（跟进中/成约客户/TSP/半年框/自营/暂不合作/纯佣/达人配信者）
  larkTier: varchar("larkTier", { length: 50 }), // Tier1/Tier2
  larkCategory: varchar("larkCategory", { length: 255 }), // 类目（美妆个护/饰品&箱包/家电/3C数码&配件/食品料理/保健&健康管理）
  larkContactPlatform: varchar("larkContactPlatform", { length: 100 }), // 联系平台（微信/飞书）
  larkBrandManager: varchar("larkBrandManager", { length: 255 }), // 品牌担当
  larkBusinessContact: varchar("larkBusinessContact", { length: 255 }), // 商务对接
  larkBusinessLead: varchar("larkBusinessLead", { length: 255 }), // 商务负责
  larkOperationsContact: varchar("larkOperationsContact", { length: 255 }), // 运营对接
  larkShopId: varchar("larkShopId", { length: 255 }), // 飞书店铺ID
  larkIntro: text("larkIntro"), // 品牌介绍
  larkSyncedAt: timestamp("larkSyncedAt"), // 最終飞书同期日時
  createdBy: int("createdBy").notNull(), // User ID who created the brand
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ（NULLなら有効、値があれば削除済み）
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
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ
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
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ
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
  verifiedAt: timestamp("verifiedAt"), // 本部確認日時
  verifiedBy: int("verifiedBy"), // 確認者のUser ID
  verifiedByStaffId: int("verifiedByStaffId"), // 確認者のStaff ID (staff.id)
  verifiedByStaffName: varchar("verifiedByStaffName", { length: 255 }), // 確認者のスタッフ名
  // 配信アカウント（間借り配信）
  streamAccountLiverId: int("streamAccountLiverId"), // 配信アカウントの持ち主ライバーID（NULL=自分のアカウント、値あり=そのライバーのアカウントで配信）
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
  // 営業CRM拡張カラム
  salesStatus: mysqlEnum("salesStatus", ["new", "contacted", "negotiating", "meeting", "contracted", "rejected"]).default("new"),
  assignedTo: int("assignedTo"), // 担当者のuser ID
  nextFollowUpAt: timestamp("nextFollowUpAt"), // 次回フォローアップ日時
  linkedBrandId: int("linkedBrandId"), // 連携ブランドID
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
  tspContractId: int("tspContractId"), // tsp_contracts.id への参照（TSP契約連携）
  // ブランド契約追加フィールド
  currency: varchar("currency", { length: 10 }).default("JPY"), // 通貨（JPY, CNY等）
  kgLiveCondition: text("kgLiveCondition"), // KG老师直播条件
  liverLiveCondition: text("liverLiveCondition"), // 达人直播条件
  shortVideoCondition: text("shortVideoCondition"), // 短视频条件
  // ノルマ数値フィールド（自動集計用）
  kgLiveHoursQuota: int("kgLiveHoursQuota"), // KG老师の月間配信ノルマ（分単位）
  liverLiveHoursQuota: int("liverLiveHoursQuota"), // 达人の月間配信ノルマ（分単位）
  shortVideoCountQuota: int("shortVideoCountQuota"), // 短視頻の月間本数ノルマ
  // 構造化ノルマフィールド
  kgLiveFrequency: int("kgLiveFrequency"), // KG月間配信回数
  kgLiveMinutesPerSession: int("kgLiveMinutesPerSession"), // KG 1回あたりの配信時間（分）
  liverLiveAssignments: json("liverLiveAssignments").$type<Array<{liverName: string, minutesPerMonth: number}>>()
  , // 达人別ノルマ [{liverName, minutesPerMonth}]
  shortVideoAssignments: json("shortVideoAssignments").$type<Array<{liverName: string, countPerMonth: number}>>()
  , // 达人別短視頻 [{liverName, countPerMonth}]
  contractPeriodLabel: varchar("contractPeriodLabel", { length: 100 }), // 契約期間ラベル（例：半年矩阵、3个月）
  createdBy: int("createdBy").notNull(), // 作成者（user ID）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ
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
  brandId: int("brandId"), // ブランドID（後方互換用）
  brandIds: json("brandIds").$type<number[]>(), // 複数ブランドID（新規）
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
  // 配信場所
  locationId: int("locationId"), // 配信場所ID（streaming_locations.id）
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

/**
 * Streaming Locations table for managing live streaming venues
 * 配信場所マスタテーブル
 * 
 * 機能:
 * - 配信場所の管理（表参道Aなど）
 * - スケジュールとの紐付けでバッティング防止
 */
export const streamingLocations = mysqlTable("streaming_locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  color: varchar("color", { length: 20 }).default("#3B82F6"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StreamingLocation = typeof streamingLocations.$inferSelect;
export type InsertStreamingLocation = typeof streamingLocations.$inferInsert;


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
  // 言語設定
  language: varchar("language", { length: 10 }).default("ja"), // UI言語設定（ja/zh-TW/en）
  lineLinkCode: varchar("lineLinkCode", { length: 10 }), // LINE連携コード（L-XXXXXX形式、8文字）
  lineLinkCodeExpiresAt: timestamp("lineLinkCodeExpiresAt"), // LINE連携コードの有効期限
   // 事務所（エージェンシー）
  agencyId: int("agencyId"), // References agencies.id（NULLの場合はLCJ直属）
  // CAP契約設定
  capEnabled: boolean("capEnabled").default(false), // CAP契約があるかどうか
  capLcjRate: decimal("capLcjRate", { precision: 5, scale: 2 }).default("0"), // CAP契約のLCJ取り分比率（%）例: 20.00 = 20%
  capCreatorRate: decimal("capCreatorRate", { precision: 5, scale: 2 }).default("100"), // CAP契約のCreator取り分比率（%）例: 80.00 = 80%
  // UID
  uid: varchar("uid", { length: 100 }), // ライバーUID
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
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ
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
  deletedAt: timestamp("deletedAt"), // ソフトデリート用タイムスタンプ
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
  
  // Order number (extracted from OCR or manually entered)
  orderNumber: varchar("orderNumber", { length: 64 }), // TikTok Shop注文番号（独立カラム）
  
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
  subcategoryId: int("subcategoryId"), // サブカテゴリID（2段階カテゴリ対応）
  
  // 動画
  videoUrl: text("videoUrl"), // メイン動画URL
  videoKey: varchar("videoKey", { length: 512 }), // S3キー
  
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
  
  // 成果報酬率（%）
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MallProduct = typeof mallProducts.$inferSelect;
export type InsertMallProduct = typeof mallProducts.$inferInsert;

/**
 * MALL商品バリアント（SKU）テーブル
 * 口紅の色号、シャンプーのサイズ等、多規格商品の管理
 */
export const mallProductVariants = mysqlTable("mall_product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(), // References mallProducts.id
  name: varchar("name", { length: 255 }).notNull(), // バリアント名（例: "ローズレッド", "250ml"）
  variantType: varchar("variantType", { length: 100 }), // タイプ（例: "色", "サイズ", "容量"）
  sku: varchar("sku", { length: 100 }), // SKUコード
  price: int("price"), // バリアント固有価格（nullの場合は親商品の価格を使用）
  stock: int("stock").default(0).notNull(), // バリアント在庫
  imageUrl: text("imageUrl"), // バリアント画像
  imageKey: varchar("imageKey", { length: 512 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MallProductVariant = typeof mallProductVariants.$inferSelect;
export type InsertMallProductVariant = typeof mallProductVariants.$inferInsert;

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
  
  // データソースタグ
  source: mysqlEnum("source", ["CAP", "TAP"]).default("CAP"), // CAP=LCJ専属ライバー, TAP=マーケットプレイス全体
  
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
  
  // データソースタグ
  source: mysqlEnum("importSource", ["CAP", "TAP", "PAYMENT"]).default("CAP"), // CAP=コミッションCSV, TAP=TAPレポートXLSX, PAYMENT=入金CSV
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
// TikTok入金データ
// ============================================

/**
 * TikTok Payments table - 実際の入金データ（Payment CSVからインポート）
 * CAPデータ（コミッション詳細）とは別に、TikTokからの実際の入金を記録
 */
export const tiktokPayments = mysqlTable("tiktok_payments", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  
  // 入金データ
  referenceId: varchar("referenceId", { length: 64 }).notNull(), // TikTok Payment Reference ID
  paymentTime: timestamp("paymentTime"), // 支払い日時(UTC)
  settlementAmount: int("settlementAmount").notNull(), // 決済金額
  settlementCurrency: varchar("settlementCurrency", { length: 10 }).default("JPY"), // 決済通貨
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }).default("1"), // 為替レート
  paymentAmount: int("paymentAmount").notNull(), // 支払い金額
  paymentCurrency: varchar("paymentCurrency", { length: 10 }).default("JPY"), // 支払い通貨
  
  // メタ情報
  importMonth: varchar("importMonth", { length: 7 }), // YYYY-MM形式（どの月のデータか）
  uploadedBy: int("uploadedBy"),
  uploadedByName: varchar("uploadedByName", { length: 255 }),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TiktokPayment = typeof tiktokPayments.$inferSelect;
export type InsertTiktokPayment = typeof tiktokPayments.$inferInsert;


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
  // --- Extended audit fields ---
  aiPass: int("aiPass"), // 1 = first pass, 2 = re-review
  reasonCode: varchar("reasonCode", { length: 64 }), // e.g. DUPLICATE_SAME_USER_ORDER, DUPLICATE_CROSS_USER_ORDER, DUPLICATE_SAME_IMAGE, ORDER_NUMBER_MISSING
  beforeStatus: varchar("beforeStatus", { length: 32 }), // status before this action
  afterStatus: varchar("afterStatus", { length: 32 }), // status after this action
  winnerReceiptId: int("winnerReceiptId"), // Level2: winner receipt ID
  winnerLineUserId: varchar("winnerLineUserId", { length: 128 }), // Level2: winner user ID
  phashDistance: int("phashDistance"), // Level3: perceptual hash distance
  
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

// =============================================
// Blog SEO Monitoring & CV Tracking (Phase 1-3)
// =============================================

/**
 * ブログ記事SEO指標テーブル
 * Search Console APIから取得したデータを記録
 */
export const blogArticleSeoMetrics = mysqlTable("blog_article_seo_metrics", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  impressions: int("impressions").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  ctr: decimal("ctr", { precision: 6, scale: 4 }).default("0.0000"),
  avgPosition: decimal("avgPosition", { precision: 6, scale: 2 }).default("0.00"),
  isIndexed: boolean("isIndexed").default(false).notNull(),
  indexedAt: timestamp("indexedAt"),
  lastCheckedAt: timestamp("lastCheckedAt"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlogArticleSeoMetric = typeof blogArticleSeoMetrics.$inferSelect;
export type InsertBlogArticleSeoMetric = typeof blogArticleSeoMetrics.$inferInsert;

/**
 * ブログ記事CV計測テーブル
 */
export const blogArticleStats = mysqlTable("blog_article_stats", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull().unique(),
  mallClicks: int("mallClicks").default(0).notNull(),
  productClicks: int("productClicks").default(0).notNull(),
  bannerClicks: int("bannerClicks").default(0).notNull(),
  bannerImpressions: int("bannerImpressions").default(0).notNull(),
  titlePattern: varchar("titlePattern", { length: 50 }),
  articleType: varchar("articleType", { length: 30 }),
  categorySlug: varchar("categorySlug", { length: 100 }),
  internalLinkCount: int("internalLinkCount").default(0),
  qualityScore: int("qualityScore").default(0),
  rewriteCount: int("rewriteCount").default(0).notNull(),
  lastRewriteAt: timestamp("lastRewriteAt"),
  rewriteReason: varchar("rewriteReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlogArticleStat = typeof blogArticleStats.$inferSelect;
export type InsertBlogArticleStat = typeof blogArticleStats.$inferInsert;

/**
 * ブログ記事テーマログ（slug重複・近似テーマ重複防止）
 */
export const blogArticleThemeLog = mysqlTable("blog_article_theme_log", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  categorySlug: varchar("categorySlug", { length: 100 }).notNull(),
  problemType: varchar("problemType", { length: 100 }),
  articleType: varchar("articleType", { length: 30 }).notNull(),
  keyword: varchar("keyword", { length: 255 }),
  titlePattern: varchar("titlePattern", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BlogArticleThemeLogEntry = typeof blogArticleThemeLog.$inferSelect;
export type InsertBlogArticleThemeLogEntry = typeof blogArticleThemeLog.$inferInsert;


/**
 * Livestream-Brand junction table for many-to-many relationship
 * Allows a single livestream to be associated with multiple brands
 */
export const livestreamBrands = mysqlTable("livestream_brands", {
  id: int("id").autoincrement().primaryKey(),
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id
  brandId: int("brandId").notNull(), // References brands.id
  durationMinutes: int("durationMinutes"), // 該当ブランドへの配信時間（分）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LivestreamBrand = typeof livestreamBrands.$inferSelect;
export type InsertLivestreamBrand = typeof livestreamBrands.$inferInsert;

/**
 * Brand addition logs table for tracking when livers add new brands
 * Records who added which brand and when for admin review
 */
export const brandAdditionLogs = mysqlTable("brand_addition_logs", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id - who added the brand
  liverName: varchar("liverName", { length: 255 }).notNull(), // Liver name at time of addition
  brandId: int("brandId").notNull(), // References brands.id - the brand that was added
  brandName: varchar("brandName", { length: 255 }).notNull(), // Brand name at time of addition
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandAdditionLog = typeof brandAdditionLogs.$inferSelect;
export type InsertBrandAdditionLog = typeof brandAdditionLogs.$inferInsert;

/**
 * Lessons Learned table for AI self-evolution system.
 * Stores all bugs, fixes, patterns, and knowledge discovered during development.
 * Each new Manus session reads all active lessons to avoid repeating past mistakes.
 *
 * Categories:
 *   danger     - Things that must NEVER be done
 *   lesson     - Patterns learned from past failures
 *   dependency - File/module dependencies
 *   rule       - System invariants / correct state definitions
 *   status     - Current state of features
 *   checklist  - Verification items for specific operations
 *   preference - User preferences and policies
 *   bugfix     - Specific bug fixes with root cause analysis
 *   workflow   - Development workflow best practices
 */
export const lessonsLearned = mysqlTable("lessons_learned", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", [
    "danger", "lesson", "dependency", "rule", "status",
    "checklist", "preference", "bugfix", "workflow"
  ]).notNull(),
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).default("info").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  compactRule: text("compactRule"),
  checkPattern: varchar("checkPattern", { length: 500 }),
  relatedFeature: varchar("relatedFeature", { length: 100 }),
  relatedFiles: json("relatedFiles").$type<string[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LessonLearned = typeof lessonsLearned.$inferSelect;
export type InsertLessonLearned = typeof lessonsLearned.$inferInsert;


/**
 * Set Applications table - ライバーがライブ前にセットを事前申請するテーブル
 * ライバーが申請 → 運営が承認/却下/修正依頼 → 承認後にセットとして登録
 */
export const setApplications = mysqlTable("set_applications", {
  id: int("id").autoincrement().primaryKey(),
  
  // 申請者（ライバー）
  liverId: int("liverId").notNull(), // References livers.id
  liverName: varchar("liverName", { length: 255 }).notNull(),
  
  // 配信情報
  scheduledDate: timestamp("scheduledDate"), // 配信予定日時
  livestreamId: int("livestreamId"), // 承認後に紐付けるlivestreamのID（オプション）
  
  // セット情報
  setName: varchar("setName", { length: 255 }).notNull(), // セット名
  setPrice: bigint("setPrice", { mode: "number" }).notNull(), // 希望セット価格
  totalOriginalPrice: bigint("totalOriginalPrice", { mode: "number" }).default(0), // 元値合計（自動計算）
  discountRate: int("discountRate").default(0), // 割引率（自動計算）
  
  // 申請ステータス
  status: mysqlEnum("status", ["pending", "approved", "rejected", "revision_requested"]).default("pending").notNull(),
  
  // 運営コメント（却下理由・修正依頼内容）
  adminComment: text("adminComment"),
  reviewedBy: int("reviewedBy"), // 審査した管理者のuser ID
  reviewedAt: timestamp("reviewedAt"),
  
  // ライバーのメモ
  memo: text("memo"),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SetApplication = typeof setApplications.$inferSelect;
export type InsertSetApplication = typeof setApplications.$inferInsert;

/**
 * Set Application Items table - セット申請内の個別商品
 */
export const setApplicationItems = mysqlTable("set_application_items", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(), // References setApplications.id
  
  // 商品情報
  productMasterId: int("productMasterId"), // References productMaster.id（商品マスタから選択した場合）
  productName: varchar("productName", { length: 255 }).notNull(), // 商品名
  originalPrice: bigint("originalPrice", { mode: "number" }).notNull(), // 元値（定価）
  quantity: int("quantity").default(1).notNull(), // 個数
  
  // 並び順
  sortOrder: int("sortOrder").default(0),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SetApplicationItem = typeof setApplicationItems.$inferSelect;
export type InsertSetApplicationItem = typeof setApplicationItems.$inferInsert;


/**
 * Liver Credits table - ライバーの月間クレジット管理
 * 毎月リセット。配信時間×1,000円 + 前月売上×10% + ランクボーナスで自動計算
 * ※クレジットは繰り越し無し
 */
export const liverCredits = mysqlTable("liver_credits", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liver_id").notNull(), // References livers.id
  
  // 対象月（YYYY-MM形式で管理）
  month: varchar("month", { length: 7 }).notNull(), // 例: "2026-03"
  
  // ランク（その月の判定結果）
  rank: varchar("rank", { length: 20 }).default("none").notNull(),
  
  // 実績データ（運営が入力 → 将来的にAPI自動取得）
  streamingHours: decimal("streaming_hours", { precision: 10, scale: 2 }).default("0"), // 配信時間（時間）
  monthlySales: decimal("monthly_sales", { precision: 12, scale: 2 }).default("0"), // 月間売上（円）
  
  // クレジット計算結果
  streamingCredit: decimal("streaming_credit", { precision: 10, scale: 2 }).default("0"), // 配信時間クレジット（時間×500）
  salesCredit: decimal("sales_credit", { precision: 10, scale: 2 }).default("0"), // 売上クレジット（売上×3%）
  rankBonus: decimal("rank_bonus", { precision: 10, scale: 2 }).default("0"), // ランクボーナス（SILVER:5000, GOLD:15000, BLACK:50000）
  carryoverCredit: decimal("carryover_credit", { precision: 10, scale: 2 }).default("0"), // 繰り越しクレジット
  totalCredit: decimal("total_credit", { precision: 10, scale: 2 }).default("0"), // 合計クレジット
  usedCredit: decimal("used_credit", { precision: 10, scale: 2 }).default("0"), // 使用済みクレジット
  remainingCredit: decimal("remaining_credit", { precision: 10, scale: 2 }).default("0"), // 残りクレジット
  
  // 初月フラグ（初月は10万円枠）
  isFirstMonth: boolean("is_first_month").default(false),
  
  // タイムスタンプ
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LiverCredit = typeof liverCredits.$inferSelect;
export type InsertLiverCredit = typeof liverCredits.$inferInsert;

/**
 * Sample Requests table - ライバーのサンプル請求
 * ライバーが請求 → 運営が承認/却下 → 発送
 */
export const sampleRequests = mysqlTable("sample_requests", {
  id: int("id").autoincrement().primaryKey(),
  
  // 請求者（ライバー）
  liverId: int("liver_id").notNull(), // References livers.id
  liverName: varchar("liver_name", { length: 255 }).notNull(),
  
  // 対象月
  month: varchar("month", { length: 7 }).notNull(), // 例: "2026-03"
  
  // 配信予定日（必須）
  scheduledDate: timestamp("scheduled_date").notNull(),
  
  // 金額情報
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"), // 請求合計金額（定価）
  creditUsed: decimal("credit_used", { precision: 10, scale: 2 }).default("0"), // クレジット使用額
  outOfPocketAmount: decimal("out_of_pocket_amount", { precision: 10, scale: 2 }).default("0"), // 実費（クレジット超過分、60%OFF価格）
  cashAmount: decimal("cash_amount", { precision: 10, scale: 2 }).default("0"), // 現金支払い額
  
  // ステータス
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  
  // 運営コメント
  adminComment: text("admin_comment"),
  reviewedBy: varchar("reviewed_by", { length: 255 }), // 審査した管理者
  reviewedAt: timestamp("reviewed_at"),
  shippedAt: timestamp("shipped_at"), // 発送日時
  
  // 配送先住所
  postalCode: varchar("postal_code", { length: 10 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  recipientName: varchar("recipient_name", { length: 255 }), // 宛名（本名）
  
  // ライバーのメモ
  memo: text("memo"),
  
  // タイムスタンプ
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SampleRequest = typeof sampleRequests.$inferSelect;
export type InsertSampleRequest = typeof sampleRequests.$inferInsert;

/**
 * Sample Request Items table - サンプル請求内の個別商品
 */
export const sampleRequestItems = mysqlTable("sample_request_items", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("request_id").notNull(), // References sampleRequests.id
  
  // 商品情報
  mallProductId: int("product_id"), // References mall_products.id
  productName: varchar("product_name", { length: 500 }).notNull(),
  price: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // 定価
  quantity: int("quantity").default(1).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }), // 小計
  
  // タイムスタンプ
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SampleRequestItem = typeof sampleRequestItems.$inferSelect;
export type InsertSampleRequestItem = typeof sampleRequestItems.$inferInsert;

// ===== 招商管理 (Recruitment Management) =====
export const recruitmentBrands = mysqlTable("recruitment_brands", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  brandType: varchar("brand_type", { length: 100 }).notNull().default(""),
  personInCharge: int("person_in_charge"),
  contactInfo: text("contact_info"),
  memo: text("memo"),
  status: mysqlEnum("status", ["registered", "email_sent", "replied", "agreed", "cooperating", "rejected"]).notNull().default("registered"),
  rejectReason: text("reject_reason"),
  lastFollowedAt: timestamp("last_followed_at"),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  // === 招商アップグレード: 新カラム ===
  brandStage: mysqlEnum("brand_stage", ["startup", "growth", "mature", "famous"]),
  annualRevenue: varchar("annual_revenue", { length: 50 }),
  cooperationHistory: varchar("cooperation_history", { length: 50 }),
  sourceChannel: varchar("source_channel", { length: 100 }),
  wechat: varchar("wechat", { length: 100 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  intentLevel: mysqlEnum("intent_level", ["high", "normal", "dormant"]),
  clientValue: mysqlEnum("client_value", ["high", "medium", "low"]),
  followDifficulty: mysqlEnum("follow_difficulty", ["easy", "medium", "hard"]),
  customTags: text("custom_tags"),
  nextFollowDate: timestamp("next_follow_date"),
  nextFollowAction: varchar("next_follow_action", { length: 255 }),
});
export type RecruitmentBrand = typeof recruitmentBrands.$inferSelect;
export type InsertRecruitmentBrand = typeof recruitmentBrands.$inferInsert;

export const recruitmentStatusHistory = mysqlTable("recruitment_status_history", {
  id: int("id").autoincrement().primaryKey(),
  recruitmentBrandId: int("recruitment_brand_id").notNull(),
  oldStatus: varchar("old_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }).notNull(),
  changedBy: int("changed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RecruitmentStatusHistory = typeof recruitmentStatusHistory.$inferSelect;

// 跟進記録テーブル (Follow-up Records)
export const recruitmentFollowRecords = mysqlTable("recruitment_follow_records", {
  id: int("id").autoincrement().primaryKey(),
  recruitmentBrandId: int("recruitment_brand_id").notNull(),
  staffId: int("staff_id"),
  communicationType: mysqlEnum("communication_type", ["email", "phone", "wechat", "meeting", "other"]).notNull().default("other"),
  durationMinutes: int("duration_minutes"),
  summary: text("summary"),
  keyPoints: text("key_points"),
  nextAction: varchar("next_action", { length: 255 }),
  nextFollowDate: timestamp("next_follow_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RecruitmentFollowRecord = typeof recruitmentFollowRecords.$inferSelect;
export type InsertRecruitmentFollowRecord = typeof recruitmentFollowRecords.$inferInsert;


// ============================================
// TikTok TAP (TikTok Affiliate Program) データ
// ============================================

/**
 * TikTok TAP Reports table - TAPレポートデータ（XLSXインポート）
 * クリエイター×商品×ショップ×月の集計データ
 * CAPデータ（注文単位の明細）とは別に、マーケットプレイス全体のパフォーマンスを記録
 */
export const tiktokTapReports = mysqlTable("tiktok_tap_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  importHistoryId: int("importHistoryId"), // References tiktokCsvImportHistory.id

  // 期間情報
  dateRange: varchar("dateRange", { length: 50 }).notNull(), // 例: "2025-10-01-2025-10-31"
  reportMonth: varchar("reportMonth", { length: 7 }).notNull(), // YYYY-MM形式

  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(),

  // 商品情報
  productId: varchar("productId", { length: 64 }).notNull(),
  productName: text("productName").notNull(),

  // ショップ情報
  shopId: varchar("shopId", { length: 64 }),
  shopName: varchar("shopName", { length: 255 }),

  // GMVデータ（円）
  affiliateGmv: bigint("affiliateGmv", { mode: "number" }).default(0), // アフィリエイトGMV
  videoGmv: bigint("videoGmv", { mode: "number" }).default(0), // アフィリエイト動画GMV
  liveGmv: bigint("liveGmv", { mode: "number" }).default(0), // アフィリエイトLIVE GMV
  gmvRefund: bigint("gmvRefund", { mode: "number" }).default(0), // GMV（返金）
  settledGmv: bigint("settledGmv", { mode: "number" }).default(0), // 決済済みGMV
  showcaseRevenue: bigint("showcaseRevenue", { mode: "number" }).default(0), // 収益（ショーケース）
  linkGmv: bigint("linkGmv", { mode: "number" }).default(0), // リンクGMV

  // 注文・販売データ
  orders: int("orders").default(0), // 注文数
  salesCount: int("salesCount").default(0), // 販売数
  linkSalesCount: int("linkSalesCount").default(0), // リンクでの商品販売数
  linkOrders: int("linkOrders").default(0), // リンク注文数

  // パフォーマンスデータ
  videoViews: bigint("videoViews", { mode: "number" }).default(0), // 動画視聴数
  liveViews: bigint("liveViews", { mode: "number" }).default(0), // LIVE視聴数
  liveCount: int("liveCount").default(0), // LIVE回数
  videoCount: int("videoCount").default(0), // 動画数
  showcaseProducts: int("showcaseProducts").default(0), // ショーケースに追加した商品数

  // 手数料データ（円）
  estimatedPartnerCommission: bigint("estimatedPartnerCommission", { mode: "number" }).default(0), // 推定アフィリエイトパートナー手数料額
  actualPartnerCommission: bigint("actualPartnerCommission", { mode: "number" }).default(0), // 実際のアフィリエイトパートナー手数料額
  estimatedCreatorCommission: bigint("estimatedCreatorCommission", { mode: "number" }).default(0), // クリエイターの推定成果報酬額
  actualCreatorCommission: bigint("actualCreatorCommission", { mode: "number" }).default(0), // クリエイターの実際の手数料額
  linkEstimatedPartnerCommission: bigint("linkEstimatedPartnerCommission", { mode: "number" }).default(0), // リンクパートナーの推定成果報酬額
  linkEstimatedCreatorCommission: bigint("linkEstimatedCreatorCommission", { mode: "number" }).default(0), // リンククリエイターの推定成果報酬額

  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TiktokTapReport = typeof tiktokTapReports.$inferSelect;
export type InsertTiktokTapReport = typeof tiktokTapReports.$inferInsert;

// =============================================
// TikTok TAP Live Reports (LIVE配信×商品明細)
// =============================================

export const tiktokTapLiveReports = mysqlTable("tiktok_tap_live_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull().default(0),
  reportMonth: varchar("reportMonth", { length: 7 }).notNull(),
  dateRange: varchar("dateRange", { length: 50 }).notNull(),

  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(),

  // LIVE配信情報
  liveRoomId: varchar("liveRoomId", { length: 64 }),
  liveName: text("liveName"),
  liveTimeInfo: text("liveTimeInfo"),

  // 商品情報
  productId: varchar("productId", { length: 64 }).notNull(),
  productName: text("productName").notNull(),

  // ショップ情報
  shopId: varchar("shopId", { length: 64 }),
  shopName: varchar("shopName", { length: 255 }),

  // カテゴリー
  category1: varchar("category1", { length: 255 }),
  category2: varchar("category2", { length: 255 }),

  // GMV・パフォーマンス
  liveGmv: bigint("liveGmv", { mode: "number" }).default(0),
  liveOrders: int("liveOrders").default(0),
  broadcastTime: bigint("broadcastTime", { mode: "number" }).default(0),
  liveViews: bigint("liveViews", { mode: "number" }).default(0),
  liveLikes: bigint("liveLikes", { mode: "number" }).default(0),
  liveRpm: decimal("liveRpm", { precision: 20, scale: 2 }).default("0"),
  estimatedPartnerCommission: bigint("estimatedPartnerCommission", { mode: "number" }).default(0),
  actualPartnerCommission: bigint("actualPartnerCommission", { mode: "number" }).default(0),
  salesCount: int("salesCount").default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TiktokTapLiveReport = typeof tiktokTapLiveReports.$inferSelect;
export type InsertTiktokTapLiveReport = typeof tiktokTapLiveReports.$inferInsert;

// =============================================
// TikTok TAP Video Reports (動画×商品明細)
// =============================================

export const tiktokTapVideoReports = mysqlTable("tiktok_tap_video_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull().default(0),
  reportMonth: varchar("reportMonth", { length: 7 }).notNull(),
  dateRange: varchar("dateRange", { length: 50 }).notNull(),

  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(),

  // 動画情報
  videoId: varchar("videoId", { length: 64 }),
  videoName: text("videoName"),
  postTime: text("postTime"),

  // 商品情報
  productId: varchar("productId", { length: 64 }).notNull(),
  productName: text("productName").notNull(),

  // ショップ情報
  shopId: varchar("shopId", { length: 64 }),
  shopName: varchar("shopName", { length: 255 }),

  // カテゴリー
  category1: varchar("category1", { length: 255 }),
  category2: varchar("category2", { length: 255 }),

  // GMV・パフォーマンス
  videoGmv: bigint("videoGmv", { mode: "number" }).default(0),
  videoOrders: int("videoOrders").default(0),
  estimatedPartnerCommission: bigint("estimatedPartnerCommission", { mode: "number" }).default(0),
  actualPartnerCommission: bigint("actualPartnerCommission", { mode: "number" }).default(0),
  broadcastTime: bigint("broadcastTime", { mode: "number" }).default(0),
  videoViews: bigint("videoViews", { mode: "number" }).default(0),
  videoLikes: bigint("videoLikes", { mode: "number" }).default(0),
  videoRpm: decimal("videoRpm", { precision: 20, scale: 2 }).default("0"),
  salesCount: int("salesCount").default(0),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TiktokTapVideoReport = typeof tiktokTapVideoReports.$inferSelect;
export type InsertTiktokTapVideoReport = typeof tiktokTapVideoReports.$inferInsert;

// =============================================
// Step Email Templates & Logs
// ステップメール自動送信テンプレートと送信ログ
// =============================================

/**
 * Step Email Templates
 * 会員登録後に自動送信されるステップメールのテンプレート
 */
export const stepEmailTemplates = mysqlTable("step_email_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // テンプレート名（管理用）
  subject: varchar("subject", { length: 500 }).notNull(), // メール件名
  bodyHtml: text("bodyHtml").notNull(), // HTML本文
  bodyText: text("bodyText").notNull(), // テキスト本文（フォールバック）
  delayDays: int("delayDays").notNull(), // 登録後何日目に送信するか
  sortOrder: int("sortOrder").default(0).notNull(), // 表示順
  isEnabled: boolean("isEnabled").default(true).notNull(), // 有効/無効
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StepEmailTemplate = typeof stepEmailTemplates.$inferSelect;
export type InsertStepEmailTemplate = typeof stepEmailTemplates.$inferInsert;

/**
 * Step Email Logs
 * ステップメール送信ログ（重複送信防止・履歴管理）
 */
export const stepEmailLogs = mysqlTable("step_email_logs", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(), // References step_email_templates.id
  lineUserId: int("lineUserId").notNull(), // References line_users.id
  email: varchar("email", { length: 320 }).notNull(), // 送信先メールアドレス
  status: mysqlEnum("status", ["sent", "failed", "skipped"]).default("sent").notNull(),
  errorMessage: text("errorMessage"), // エラーメッセージ（失敗時）
  trackingId: varchar("tracking_id", { length: 64 }), // ユニークトラッキングID
  openedAt: timestamp("opened_at"), // 開封日時
  openCount: int("open_count").default(0).notNull(), // 開封回数
  clickedAt: timestamp("clicked_at"), // 初回クリック日時
  clickCount: int("click_count").default(0).notNull(), // クリック回数
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type StepEmailLog = typeof stepEmailLogs.$inferSelect;
export type InsertStepEmailLog = typeof stepEmailLogs.$inferInsert;

/**
 * Step Email Click Tracking
 * メール内リンクのクリック追跡
 */
export const stepEmailClicks = mysqlTable("step_email_clicks", {
  id: int("id").autoincrement().primaryKey(),
  logId: int("log_id").notNull(), // References step_email_logs.id
  trackingId: varchar("tracking_id", { length: 64 }).notNull(), // References step_email_logs.tracking_id
  url: text("url").notNull(), // クリックされたURL
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
});

export type StepEmailClick = typeof stepEmailClicks.$inferSelect;
export type InsertStepEmailClick = typeof stepEmailClicks.$inferInsert;


/**
 * Brand Sample Applications table - ブランド向けサンプル提供LP申込
 */
export const brandSampleApplications = mysqlTable("brand_sample_applications", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  productUrl: text("product_url").notNull(),
  productStrength: text("product_strength").notNull(), // 商品の強み
  pastSalesRecord: text("past_sales_record"), // 過去の販売実績
  plan: mysqlEnum("plan", ["light", "algorithm", "market_jack"]).notNull(), // 梅・竹・松
  sampleCount: int("sample_count").notNull(), // 30, 50, 100
  status: mysqlEnum("status", ["pending", "reviewing", "approved", "rejected"]).default("pending").notNull(),
  reviewNote: text("review_note"), // 審査メモ
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: int("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BrandSampleApplication = typeof brandSampleApplications.$inferSelect;
export type InsertBrandSampleApplication = typeof brandSampleApplications.$inferInsert;


/**
 * AB Test Events table - ファーストビューABテスト計測
 * バリアント別の滞在時間・CTAタップを記録
 */
export const abTestEvents = mysqlTable("ab_test_events", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(), // ブラウザセッション識別子
  variantId: varchar("variant_id", { length: 32 }).notNull(), // バリアント識別子 (e.g., "A", "B", "C")
  eventType: mysqlEnum("event_type", ["view", "cta_click", "scroll_past_hero"]).notNull(),
  dwellTimeMs: bigint("dwell_time_ms", { mode: "number" }), // ページ滞在時間（ミリ秒）
  pageUrl: text("page_url"), // ページURL
  userAgent: text("user_agent"), // ブラウザ情報
  referrer: text("referrer"), // リファラー
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AbTestEvent = typeof abTestEvents.$inferSelect;
export type InsertAbTestEvent = typeof abTestEvents.$inferInsert;


/**
 * Ad Form Submissions table - TikTok広告LP申込フォーム
 */
export const adFormSubmissions = mysqlTable("ad_form_submissions", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  monthlyBudget: varchar("monthly_budget", { length: 100 }),
  plan: mysqlEnum("plan", ["light", "algorithm", "market_jack"]).default("light").notNull(),
  message: text("message"),
  source: varchar("source", { length: 100 }).default("tiktok_ads_lp"),
  status: mysqlEnum("status", ["pending", "contacted", "in_progress", "contracted", "rejected"]).default("pending").notNull(),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: int("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AdFormSubmission = typeof adFormSubmissions.$inferSelect;
export type InsertAdFormSubmission = typeof adFormSubmissions.$inferInsert;

/**
 * Agencies table for managing external live commerce agencies
 * 事務所（エージェンシー）管理テーブル
 * 
 * 機能:
 * - 外部事務所のアカウント管理
 * - 事務所ごとのライバー管理・ライブ管理
 * - マルチテナント対応
 */
export const agencies = mysqlTable("agencies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  loginId: varchar("loginId", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  logoUrl: text("logoUrl"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Agency = typeof agencies.$inferSelect;
export type InsertAgency = typeof agencies.$inferInsert;


/**
 * TSP (TikTok Shop Partner) Contracts table
 * TSP契約管理テーブル
 * 
 * 機能:
 * - 取引先（ショップ）との月額契約管理
 * - Stripe Customer/Subscription連携
 * - 自動請求書発行・入金管理
 */
export const tspContracts = mysqlTable("tsp_contracts", {
  id: int("id").autoincrement().primaryKey(),
  // ブランド・LCJ担当者紐付け
  brandId: int("brandId"), // brands.id への参照（任意）
  lcjStaffId: int("lcjStaffId"), // staff.id への参照（LCJ担当者、任意）
  // 取引先情報
  shopName: varchar("shopName", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }),
  postalCode: varchar("postalCode", { length: 20 }),
  address: text("address"),
  // 契約情報
  monthlyAmount: int("monthlyAmount").notNull(), // 月額料金（税抜・円）
  taxRate: int("taxRate").default(10).notNull(), // 消費税率（%）
  contractStartDate: timestamp("contractStartDate").notNull(),
  contractEndDate: timestamp("contractEndDate"),
  billingDay: int("billingDay").default(1).notNull(), // 毎月の請求日（1-28）
  paymentDueDays: int("paymentDueDays").default(30).notNull(), // 支払期限（請求日から何日後）
  paymentMethod: varchar("paymentMethod", { length: 50 }).default("bank_transfer").notNull(), // bank_transfer | auto_charge
  description: text("description"), // 契約内容の説明（請求書の明細に使用）
  // Stripe連携
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  // TAPショップ紐付け（任意）
  tapShopName: varchar("tapShopName", { length: 255 }),
  // ステータス
  status: varchar("status", { length: 50 }).default("active").notNull(), // active | paused | cancelled
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TspContract = typeof tspContracts.$inferSelect;
export type InsertTspContract = typeof tspContracts.$inferInsert;

/**
 * TSP Invoices table
 * TSP請求書テーブル
 * 
 * 機能:
 * - Stripe Invoice連携
 * - 請求書の発行・送信・入金ステータス管理
 */
export const tspInvoices = mysqlTable("tsp_invoices", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  // 請求情報
  invoiceNumber: varchar("invoiceNumber", { length: 100 }), // LCJ独自の請求書番号
  billingMonth: varchar("billingMonth", { length: 7 }).notNull(), // YYYY-MM
  amount: int("amount").notNull(), // 税抜金額
  taxAmount: int("taxAmount").notNull(), // 消費税額
  totalAmount: int("totalAmount").notNull(), // 税込合計
  description: text("description"), // 明細内容
  dueDate: timestamp("dueDate"), // 支払期限
  // Stripe連携
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  stripeInvoiceUrl: text("stripeInvoiceUrl"), // Stripe請求書のURL（取引先が支払いに使う）
  stripeInvoicePdf: text("stripeInvoicePdf"), // Stripe請求書のPDF URL
  // ステータス
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft | sent | paid | overdue | cancelled | void
  paidAt: timestamp("paidAt"),
  sentAt: timestamp("sentAt"),
  // メモ
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TspInvoice = typeof tspInvoices.$inferSelect;
export type InsertTspInvoice = typeof tspInvoices.$inferInsert;


// =============================================
// TikTok CAP (Creator Affiliate Program) Reports
// =============================================

/**
 * TikTok CAP Creator Reports - CAPレポート（Creator単位）
 * CAPはLCJとライバー間の総契約ルール。推定成果報酬額・手数料ベースを含む。
 */
export const tiktokCapCreatorReports = mysqlTable("tiktok_cap_creator_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  importHistoryId: int("importHistoryId"),

  // 期間情報
  dateRange: varchar("dateRange", { length: 50 }).notNull(),
  reportMonth: varchar("reportMonth", { length: 7 }).notNull(),

  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(),

  // GMVデータ（円）
  affiliateGmv: bigint("affiliateGmv", { mode: "number" }).default(0),
  affiliateLiveGmv: bigint("affiliateLiveGmv", { mode: "number" }).default(0),
  affiliateVideoGmv: bigint("affiliateVideoGmv", { mode: "number" }).default(0),
  directGmv: bigint("directGmv", { mode: "number" }).default(0),
  liveDirectGmv: bigint("liveDirectGmv", { mode: "number" }).default(0),
  videoDirectGmv: bigint("videoDirectGmv", { mode: "number" }).default(0),

  // 注文データ
  affiliateOrders: int("affiliateOrders").default(0),
  affiliateLiveOrders: int("affiliateLiveOrders").default(0),
  affiliateVideoOrders: int("affiliateVideoOrders").default(0),
  directOrders: int("directOrders").default(0),
  liveDirectOrders: int("liveDirectOrders").default(0),
  videoDirectOrders: int("videoDirectOrders").default(0),
  salesCount: int("salesCount").default(0),

  // 手数料データ（円）- CAP固有
  estimatedCommission: bigint("estimatedCommission", { mode: "number" }).default(0), // 推定成果報酬額
  commissionBase: bigint("commissionBase", { mode: "number" }).default(0), // 手数料ベース

  // パフォーマンスデータ
  liveViews: bigint("liveViews", { mode: "number" }).default(0),
  videoViews: bigint("videoViews", { mode: "number" }).default(0),
  liveCount: int("liveCount").default(0),
  videoCount: int("videoCount").default(0),

  // CTR
  liveCtr: varchar("liveCtr", { length: 20 }),
  videoCtr: varchar("videoCtr", { length: 20 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TiktokCapCreatorReport = typeof tiktokCapCreatorReports.$inferSelect;
export type InsertTiktokCapCreatorReport = typeof tiktokCapCreatorReports.$inferInsert;

/**
 * TikTok CAP Product Reports - CAPレポート（Creator×Product×Shop単位）
 * 商品単位の返金GMV・返金アイテム数を含む。手数料データは含まない。
 */
export const tiktokCapProductReports = mysqlTable("tiktok_cap_product_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  importHistoryId: int("importHistoryId"),

  // 期間情報
  dateRange: varchar("dateRange", { length: 50 }).notNull(),
  reportMonth: varchar("reportMonth", { length: 7 }).notNull(),

  // クリエイター情報
  creatorUsername: varchar("creatorUsername", { length: 255 }).notNull(),

  // 商品情報
  productId: varchar("productId", { length: 64 }).notNull(),
  productName: text("productName").notNull(),
  shopId: varchar("shopId", { length: 64 }),
  shopName: varchar("shopName", { length: 255 }),

  // GMVデータ（円）
  affiliateGmv: bigint("affiliateGmv", { mode: "number" }).default(0),
  affiliateLiveGmv: bigint("affiliateLiveGmv", { mode: "number" }).default(0),
  affiliateVideoGmv: bigint("affiliateVideoGmv", { mode: "number" }).default(0),
  directGmv: bigint("directGmv", { mode: "number" }).default(0),
  liveDirectGmv: bigint("liveDirectGmv", { mode: "number" }).default(0),
  videoDirectGmv: bigint("videoDirectGmv", { mode: "number" }).default(0),
  productCardDirectGmv: bigint("productCardDirectGmv", { mode: "number" }).default(0),

  // 注文データ
  affiliateOrders: int("affiliateOrders").default(0),
  affiliateLiveOrders: int("affiliateLiveOrders").default(0),
  affiliateVideoOrders: int("affiliateVideoOrders").default(0),
  directOrders: int("directOrders").default(0),
  liveDirectOrders: int("liveDirectOrders").default(0),
  videoDirectOrders: int("videoDirectOrders").default(0),
  productCardOrders: int("productCardOrders").default(0),
  salesCount: int("salesCount").default(0),
  liveSalesCount: int("liveSalesCount").default(0),
  videoSalesCount: int("videoSalesCount").default(0),
  productCardSalesCount: int("productCardSalesCount").default(0),

  // 返金データ（CAP固有）
  directRefundGmv: bigint("directRefundGmv", { mode: "number" }).default(0),
  refundedItems: int("refundedItems").default(0),

  // CTR
  ctr: varchar("ctr", { length: 20 }),
  ctor: varchar("ctor", { length: 20 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TiktokCapProductReport = typeof tiktokCapProductReports.$inferSelect;
export type InsertTiktokCapProductReport = typeof tiktokCapProductReports.$inferInsert;


// =====================================================
// Brand Portal System - ブランドポータルシステム
// =====================================================

/**
 * ブランドポータルテーブル
 * ブランド方がトークン付きリンクでアクセスするポータルの管理
 * 1ブランドに対して1つのポータルを持つ
 */
export const brandPortals = mysqlTable("brand_portals", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  accessToken: varchar("accessToken", { length: 64 }).notNull().unique(), // URLトークン（例: lcjmall.com/brand/abc123）
  
  // ポータル設定
  portalName: varchar("portalName", { length: 255 }), // ポータル表示名（デフォルトはブランド名）
  welcomeMessage: text("welcomeMessage"), // ウェルカムメッセージ
  
  // ステータス
  status: mysqlEnum("portalStatus", ["active", "suspended", "expired"]).default("active").notNull(),
  expiresAt: timestamp("portalExpiresAt"), // 有効期限（NULLなら無期限）
  lastAccessedAt: timestamp("lastAccessedAt"), // 最終アクセス日時
  accessCount: int("accessCount").default(0).notNull(), // アクセス回数
  
  // メタ情報
  createdBy: int("createdBy").notNull(), // 作成者（LCJスタッフ）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandPortal = typeof brandPortals.$inferSelect;
export type InsertBrandPortal = typeof brandPortals.$inferInsert;

/**
 * ブランドポータル商品テーブル（手卡 = 商品紹介カード）
 * ブランド方がポータルから入力する商品情報
 * 既存のbrandProductsとは別テーブル（ブランド方が直接入力 → LCJが承認後にbrandProductsに反映）
 */
export const brandPortalProducts = mysqlTable("brand_portal_products", {
  id: int("id").autoincrement().primaryKey(),
  portalId: int("portalId").notNull(), // References brand_portals.id
  brandId: int("brandId").notNull(), // References brands.id
  brandProductId: int("brandProductId"), // 承認後にbrandProducts.idと紐付け
  
  // 基本情報
  productName: varchar("productName", { length: 500 }).notNull(), // 製品名
  productCode: varchar("productCode", { length: 100 }), // 品番・SKU
  category: varchar("bppCategory", { length: 255 }), // カテゴリ
  
  // 価格情報
  listPrice: bigint("listPrice", { mode: "number" }), // 通常価格（定価）
  livePrice: bigint("livePrice", { mode: "number" }), // ライブ配信価格（希望）
  costPrice: bigint("costPrice", { mode: "number" }), // 原価（仕入れ値）
  commissionRate: varchar("commissionRate", { length: 50 }), // ライセンス料配分率
  
  // 商品詳細
  productDescription: text("productDescription"), // 商品説明
  specifications: text("specifications"), // 仕様・スペック
  targetAudience: varchar("targetAudience", { length: 500 }), // ターゲット層
  
  // コアセールスポイント（6項目）
  sellingPoint1: text("sellingPoint1"),
  sellingPoint2: text("sellingPoint2"),
  sellingPoint3: text("sellingPoint3"),
  sellingPoint4: text("sellingPoint4"),
  sellingPoint5: text("sellingPoint5"),
  sellingPoint6: text("sellingPoint6"),
  
  // 使用方法・その他
  usageMethod: text("usageMethod"), // 使用方法
  ingredients: text("ingredients"), // 成分・原材料
  shippingInfo: text("shippingInfo"), // 発送情報
  stockQuantity: int("stockQuantity"), // 在庫数
  
  // 画像
  imageUrls: json("imageUrls").$type<string[]>(), // 商品画像URLs
  imageKeys: json("imageKeys").$type<string[]>(), // 商品画像S3 keys
  
  // 販売メカニズム
  salesMechanism: text("salesMechanism"), // 販売メカニズム（セット販売・おまけ等）
  giftItems: text("giftItems"), // 贈品・おまけ情報
  
  // LCJチューニング（管理者が調整）
  adjustedLivePrice: bigint("adjustedLivePrice", { mode: "number" }), // 調整後ライブ価格
  adjustedDiscountRate: varchar("adjustedDiscountRate", { length: 50 }), // 調整後割引率
  adjustedGiftItems: text("adjustedGiftItems"), // 調整後贈品
  tuningNotes: text("tuningNotes"), // チューニングメモ
  tunedBy: int("tunedBy"), // チューニング担当者
  tunedAt: timestamp("tunedAt"), // チューニング日時
  
  // ステータス管理
  status: mysqlEnum("bppStatus", [
    "draft",        // ブランド方が入力中
    "submitted",    // ブランド方が提出済み
    "reviewing",    // LCJが審査中
    "tuning",       // LCJがチューニング中
    "simulating",   // シミュレーション中
    "proposed",     // ブランド方に提案済み
    "approved",     // ブランド方が承認
    "live_ready",   // 配信準備完了
    "live_done",    // 配信完了
    "rejected",     // 却下
  ]).default("draft").notNull(),
  
  // 承認フロー
  submittedAt: timestamp("submittedAt"), // ブランド方が提出した日時
  approvedAt: timestamp("approvedAt"), // ブランド方が承認した日時
  approvedBy: varchar("approvedBy", { length: 255 }), // 承認者名（ブランド方の担当者名）
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: text("rejectionReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"), // ソフトデリート
});
export type BrandPortalProduct = typeof brandPortalProducts.$inferSelect;
export type InsertBrandPortalProduct = typeof brandPortalProducts.$inferInsert;

/**
 * ブランドポータルシミュレーションテーブル
 * 商品ごとの価格別シミュレーション結果を保存
 * ブランド方に提案する際に使用
 */
export const brandPortalSimulations = mysqlTable("brand_portal_simulations", {
  id: int("id").autoincrement().primaryKey(),
  portalProductId: int("portalProductId").notNull(), // References brand_portal_products.id
  brandId: int("brandId").notNull(),
  
  // シミュレーション条件
  simulationName: varchar("simulationName", { length: 255 }), // シミュレーション名
  priceScenarios: json("priceScenarios").$type<Array<{
    label: string;          // シナリオ名（例: "強気価格", "標準価格", "攻め価格"）
    livePrice: number;      // ライブ価格
    discountRate: number;   // 割引率（%）
    commissionRate?: number; // 成果報酬率（%）
    giftItems: string;      // 贈品
    estimatedSalesCount: number; // 予想販売数
    estimatedGmv: number;   // 予想GMV
    estimatedProfit: number; // 予想利益
    commissionAmount: number; // 手数料額
  }>>(),
  
  // 推奨シナリオ
  recommendedScenarioIndex: int("recommendedScenarioIndex"), // 推奨シナリオのインデックス
  recommendationReason: text("recommendationReason"), // 推奨理由
  
  // 共有設定
  shareToken: varchar("simShareToken", { length: 64 }).unique(), // ブランド方に共有するトークン
  sharedAt: timestamp("sharedAt"), // 共有日時
  
  // ブランド方の回答
  selectedScenarioIndex: int("selectedScenarioIndex"), // ブランド方が選択したシナリオ
  brandFeedback: text("brandFeedback"), // ブランド方のフィードバック
  respondedAt: timestamp("respondedAt"), // 回答日時
  
  // メタ情報
  status: mysqlEnum("simStatus2", ["draft", "shared", "responded", "finalized"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandPortalSimulation = typeof brandPortalSimulations.$inferSelect;
export type InsertBrandPortalSimulation = typeof brandPortalSimulations.$inferInsert;

/**
 * ブランドポータル配信実績テーブル
 * 配信後にブランド方が確認できる実績データ
 * brandLivestreamsから集計して自動反映
 */
export const brandPortalPerformance = mysqlTable("brand_portal_performance", {
  id: int("id").autoincrement().primaryKey(),
  portalProductId: int("portalProductId").notNull(), // References brand_portal_products.id
  brandId: int("brandId").notNull(),
  livestreamId: int("livestreamId"), // References brand_livestreams.id
  
  // 配信情報
  livestreamDate: timestamp("livestreamDate").notNull(),
  streamerName: varchar("streamerName", { length: 255 }),
  platform: varchar("platform", { length: 100 }),
  duration: int("duration"), // 配信時間（分）
  
  // 売上実績
  salesAmount: bigint("salesAmount", { mode: "number" }), // 売上金額
  gmv: bigint("gmv", { mode: "number" }), // GMV
  salesCount: int("salesCount"), // 販売数
  orderCount: int("orderCount"), // 注文数
  
  // 視聴データ
  viewerCount: int("viewerCount"), // 視聴者数
  peakViewers: int("peakViewers"), // ピーク視聴者数
  
  // エンゲージメント
  likes: int("likes"),
  comments: int("comments"),
  shares: int("shares"),
  
  // ブランド方への表示設定
  isVisible: boolean("isVisible").default(true).notNull(), // ブランド方に表示するか
  notes: text("notes"), // 備考（ブランド方に見せるメモ）
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandPortalPerformance = typeof brandPortalPerformance.$inferSelect;
export type InsertBrandPortalPerformance = typeof brandPortalPerformance.$inferInsert;

// ===== 広告司令塔テーブル =====

// 月次広告計画（店舗×ブランド×広告タイプ）
export const adMonthlyPlans = mysqlTable("ad_monthly_plans", {
  id: int("id").autoincrement().primaryKey(),
  month: varchar("month", { length: 7 }).notNull(),
  liverId: int("liverId"),
  liverName: varchar("liverName", { length: 255 }).notNull(),
  brandId: int("brandId"),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  adType: mysqlEnum("adType", ["short_video", "live", "mixed"]).default("mixed").notNull(),
  planType: mysqlEnum("planType", ["shop", "talent"]).default("shop").notNull(), // shop=店铺維度（品牌方予算）, talent=达人維度（LCJ自社予算）
  budget: bigint("budget", { mode: "number" }).default(0),
  actualSpend: bigint("actualSpend", { mode: "number" }).default(0),
  spendRate: decimal("spendRate", { precision: 10, scale: 4 }).default("0"),
  targetGmv: bigint("targetGmv", { mode: "number" }).default(0),
  targetRoi: decimal("targetRoi", { precision: 10, scale: 4 }).default("0"),
  actualGmv: bigint("actualGmv", { mode: "number" }).default(0),
  actualRoi: decimal("actualRoi", { precision: 10, scale: 4 }).default("0"),
  impressions: bigint("impressions", { mode: "number" }).default(0),
  clicks: bigint("clicks", { mode: "number" }).default(0),
  conversions: int("conversions").default(0),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdMonthlyPlan = typeof adMonthlyPlans.$inferSelect;
export type InsertAdMonthlyPlan = typeof adMonthlyPlans.$inferInsert;

// 日次広告実績
export const adDailyRecords = mysqlTable("ad_daily_records", {
  id: int("id").autoincrement().primaryKey(),
  monthlyPlanId: int("monthlyPlanId").notNull(),
  recordDate: timestamp("recordDate").notNull(),
  spend: bigint("spend", { mode: "number" }).default(0),
  gmv: bigint("gmv", { mode: "number" }).default(0),
  impressions: bigint("impressions", { mode: "number" }).default(0),
  clicks: bigint("clicks", { mode: "number" }).default(0),
  conversions: int("conversions").default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdDailyRecord = typeof adDailyRecords.$inferSelect;
export type InsertAdDailyRecord = typeof adDailyRecords.$inferInsert;


// IndexNow送信ログ
export const indexNowLogs = mysqlTable("index_now_logs", {
  id: int("id").autoincrement().primaryKey(),
  urls: text("urls").notNull(), // JSON array of submitted URLs
  urlCount: int("urlCount").notNull().default(1),
  trigger: varchar("trigger", { length: 50 }).notNull().default("manual"), // manual, auto_create, auto_update, auto_publish, auto_post, bulk
  indexNowStatus: int("indexNowStatus"),
  bingStatus: int("bingStatus"),
  yandexStatus: int("yandexStatus"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IndexNowLog = typeof indexNowLogs.$inferSelect;
export type InsertIndexNowLog = typeof indexNowLogs.$inferInsert;

// 招商メールテンプレート
export const recruitmentEmailTemplates = mysqlTable("recruitment_email_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  variables: text("variables"),
  isDefault: boolean("isDefault").notNull().default(false),
  sortOrder: int("sortOrder").notNull().default(0),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type RecruitmentEmailTemplate = typeof recruitmentEmailTemplates.$inferSelect;
export type InsertRecruitmentEmailTemplate = typeof recruitmentEmailTemplates.$inferInsert;

// メール署名
export const emailSignatures = mysqlTable("email_signatures", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  content: text("content").notNull(),
  isDefault: boolean("isDefault").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmailSignature = typeof emailSignatures.$inferSelect;
export type InsertEmailSignature = typeof emailSignatures.$inferInsert;

// 招商メール送信ログ
export const recruitmentEmailLogs = mysqlTable("recruitment_email_logs", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  templateId: int("templateId"),
  toAddress: varchar("toAddress", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body"),
  sentBy: varchar("sentBy", { length: 100 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  isBulk: boolean("isBulk").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("sent"),
});
export type RecruitmentEmailLog = typeof recruitmentEmailLogs.$inferSelect;
export type InsertRecruitmentEmailLog = typeof recruitmentEmailLogs.$inferInsert;

// ============================================================
// 短動画マトリックス管理 (Short Video Matrix Management)
// ============================================================

/**
 * TikTokアカウント管理テーブル
 * 50+アカウントの一元管理
 */
export const svmAccounts = mysqlTable("svm_accounts", {
  id: int("id").primaryKey().autoincrement(),
  accountName: varchar("accountName", { length: 255 }).notNull(), // @username
  displayName: varchar("displayName", { length: 255 }), // 表示名
  platform: varchar("platform", { length: 50 }).notNull().default("tiktok"), // tiktok, youtube_shorts, instagram_reels
  category: varchar("category", { length: 100 }), // カテゴリ（美容, ヘアケア等）
  assignedTo: varchar("assignedTo", { length: 100 }), // 担当者名
  followerCount: int("followerCount").default(0),
  profileUrl: varchar("profileUrl", { length: 500 }),
  avatarUrl: varchar("avatarUrl", { length: 500 }),
  description: text("description"),
  tags: text("tags"), // JSON配列
  status: mysqlEnum("status", ["active", "paused", "archived"]).notNull().default("active"),
  targetPostsPerDay: int("targetPostsPerDay").default(1),
  lastPostDate: timestamp("lastPostDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SvmAccount = typeof svmAccounts.$inferSelect;
export type InsertSvmAccount = typeof svmAccounts.$inferInsert;

/**
 * 動画投稿記録テーブル
 */
export const svmVideoPosts = mysqlTable("svm_video_posts", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("accountId").notNull(),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  videoUrl: varchar("videoUrl", { length: 500 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  postDate: timestamp("postDate").notNull(),
  duration: int("duration"), // 秒
  hashtags: text("hashtags"), // JSON配列
  views: int("views").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  saves: int("saves").default(0),
  contentType: varchar("contentType", { length: 50 }), // original, repost, collaboration
  productName: varchar("productName", { length: 255 }),
  status: mysqlEnum("status", ["draft", "scheduled", "posted", "failed"]).notNull().default("posted"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SvmVideoPost = typeof svmVideoPosts.$inferSelect;
export type InsertSvmVideoPost = typeof svmVideoPosts.$inferInsert;

/**
 * 投稿スケジュールテーブル
 */
export const svmSchedules = mysqlTable("svm_schedules", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("accountId").notNull(),
  scheduledDate: timestamp("scheduledDate").notNull(),
  title: varchar("title", { length: 500 }),
  description: text("description"),
  contentPlan: text("contentPlan"),
  hashtags: text("hashtags"),
  assignedTo: varchar("assignedTo", { length: 100 }),
  status: mysqlEnum("status", ["planned", "in_progress", "ready", "posted", "cancelled"]).notNull().default("planned"),
  videoPostId: int("videoPostId"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).notNull().default("medium"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SvmSchedule = typeof svmSchedules.$inferSelect;
export type InsertSvmSchedule = typeof svmSchedules.$inferInsert;

/**
 * コンテンツ企画テーブル
 */
export const svmContentPlans = mysqlTable("svm_content_plans", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  targetAccounts: text("targetAccounts"), // JSON配列
  scriptContent: text("scriptContent"),
  referenceUrls: text("referenceUrls"), // JSON配列
  hashtags: text("hashtags"),
  status: mysqlEnum("status", ["idea", "planning", "scripted", "filming", "editing", "ready", "used", "archived"]).notNull().default("idea"),
  assignedTo: varchar("assignedTo", { length: 100 }),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).notNull().default("medium"),
  dueDate: timestamp("dueDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SvmContentPlan = typeof svmContentPlans.$inferSelect;
export type InsertSvmContentPlan = typeof svmContentPlans.$inferInsert;


// ============================================================
// LCJ Coin (Phantom Stock) System - ファントムストック報酬システム
// ============================================================

/**
 * LCJコイン設定テーブル - システム全体の設定（PSR倍率、ベスティング率など）
 * 管理画面から自由に変更可能
 */
export const lcjCoinSettings = mysqlTable("lcj_coin_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(), // JSON or string value
  description: text("description"), // 設定の説明
  category: mysqlEnum("category", ["valuation", "vesting", "gamification", "general"]).default("general").notNull(),
  updatedBy: int("updatedBy"), // staff id who last updated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinSetting = typeof lcjCoinSettings.$inferSelect;
export type InsertLcjCoinSetting = typeof lcjCoinSettings.$inferInsert;

/**
 * LCJコイン擬似時価総額ログ - 月次の擬似時価総額を記録
 * 月間売上 × 12 × PSR倍率 で算出
 */
export const lcjCoinValuationLog = mysqlTable("lcj_coin_valuation_log", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // "2026-04" format
  monthlyRevenue: decimal("monthlyRevenue", { precision: 15, scale: 2 }).notNull(), // 月間売上
  psrMultiplier: decimal("psrMultiplier", { precision: 5, scale: 2 }).notNull(), // PSR倍率
  valuationAmount: decimal("valuationAmount", { precision: 18, scale: 2 }).notNull(), // 擬似時価総額
  totalCoinsIssued: bigint("totalCoinsIssued", { mode: "number" }).notNull(), // 発行済み総コイン数
  coinPrice: decimal("coinPrice", { precision: 12, scale: 4 }).notNull(), // 1コインあたりの価格
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinValuationLog = typeof lcjCoinValuationLog.$inferSelect;
export type InsertLcjCoinValuationLog = typeof lcjCoinValuationLog.$inferInsert;

/**
 * LCJコイン保有テーブル - 各ユーザーのコイン保有状況
 * staff / liver の両方に対応
 */
export const lcjCoinHoldings = mysqlTable("lcj_coin_holdings", {
  id: int("id").autoincrement().primaryKey(),
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(), // staff.id or livers.id
  totalCoins: bigint("totalCoins", { mode: "number" }).default(0).notNull(), // 総付与コイン数
  vestedCoins: bigint("vestedCoins", { mode: "number" }).default(0).notNull(), // ベスティング済みコイン数
  exercisedCoins: bigint("exercisedCoins", { mode: "number" }).default(0).notNull(), // 行使済みコイン数
  level: int("level").default(1).notNull(), // ゲーミフィケーション レベル
  xp: bigint("xp", { mode: "number" }).default(0).notNull(), // 経験値
  streak: int("streak").default(0).notNull(), // 連続日数
  lastActiveDate: timestamp("lastActiveDate"), // 最終アクティブ日
  tierCode: varchar("tierCode", { length: 10 }), // 貢献期待度Tier（S/A/B/C/D）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinHolding = typeof lcjCoinHoldings.$inferSelect;
export type InsertLcjCoinHolding = typeof lcjCoinHoldings.$inferInsert;

/**
 * LCJコイン付与トランザクション - コイン付与・行使の全履歴
 */
export const lcjCoinTransactions = mysqlTable("lcj_coin_transactions", {
  id: int("id").autoincrement().primaryKey(),
  holdingId: int("holdingId").notNull(), // lcj_coin_holdings.id
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "grant",           // 初回付与
    "refresh_grant",   // リフレッシュグラント（追加付与）
    "vest",            // ベスティング確定
    "exercise",        // 行使（換金）
    "bonus",           // ボーナス付与
    "season_reward",   // シーズン報酬
    "achievement",     // 実績達成報酬
    "penalty",         // ペナルティ（減額）
    "adjustment",      // 管理者調整
  ]).notNull(),
  coinAmount: bigint("coinAmount", { mode: "number" }).notNull(), // コイン数（マイナスも可）
  coinPriceAtTime: decimal("coinPriceAtTime", { precision: 12, scale: 4 }), // 取引時のコイン価格
  vestingScheduleId: int("vestingScheduleId"), // ベスティングスケジュールID
  reason: text("reason"), // 付与理由
  approvedBy: int("approvedBy"), // 承認者 staff.id
  metadata: json("metadata").$type<Record<string, any>>(), // 追加メタデータ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinTransaction = typeof lcjCoinTransactions.$inferSelect;
export type InsertLcjCoinTransaction = typeof lcjCoinTransactions.$inferInsert;

/**
 * LCJコイン ベスティングスケジュール - 個人ごとのベスティング計画
 * Amazonバックローデッド型: Year1=5%, Year2=15%, Year3=40%, Year4=40%
 */
export const lcjCoinVestingSchedules = mysqlTable("lcj_coin_vesting_schedules", {
  id: int("id").autoincrement().primaryKey(),
  holdingId: int("holdingId").notNull(),
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(),
  grantDate: timestamp("grantDate").notNull(), // 付与日
  totalGrantCoins: bigint("totalGrantCoins", { mode: "number" }).notNull(), // 付与総数
  vestingType: mysqlEnum("vestingType", ["backloaded", "frontloaded", "flat", "custom"]).default("backloaded").notNull(),
  // ベスティング率（JSON: {"year1": 5, "year2": 15, "year3": 40, "year4": 40}）
  vestingRates: json("vestingRates").$type<Record<string, number>>().notNull(),
  vestingPeriodMonths: int("vestingPeriodMonths").default(48).notNull(), // ベスティング期間（月）
  cliffMonths: int("cliffMonths").default(12).notNull(), // クリフ期間（月）
  vestedSoFar: bigint("vestedSoFar", { mode: "number" }).default(0).notNull(), // これまでのベスティング済み
  nextVestDate: timestamp("nextVestDate"), // 次回ベスティング日
  status: mysqlEnum("status", ["active", "completed", "cancelled", "paused"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinVestingSchedule = typeof lcjCoinVestingSchedules.$inferSelect;
export type InsertLcjCoinVestingSchedule = typeof lcjCoinVestingSchedules.$inferInsert;

/**
 * LCJコイン バッジ定義テーブル - 獲得可能なバッジの一覧
 */
export const lcjCoinBadges = mysqlTable("lcj_coin_badges", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  description: text("description"),
  iconUrl: text("iconUrl"), // バッジアイコンURL
  iconEmoji: varchar("iconEmoji", { length: 10 }), // 絵文字アイコン
  category: mysqlEnum("category", ["performance", "loyalty", "special", "season", "social"]).default("performance").notNull(),
  rarity: mysqlEnum("rarity", ["common", "rare", "epic", "legendary"]).default("common").notNull(),
  requirement: json("requirement").$type<Record<string, any>>(), // 獲得条件（JSON）
  xpReward: int("xpReward").default(0).notNull(), // 獲得時のXP報酬
  coinReward: bigint("coinReward", { mode: "number" }).default(0).notNull(), // 獲得時のコイン報酬
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinBadge = typeof lcjCoinBadges.$inferSelect;
export type InsertLcjCoinBadge = typeof lcjCoinBadges.$inferInsert;

/**
 * LCJコイン バッジ獲得履歴 - ユーザーが獲得したバッジ
 */
export const lcjCoinBadgeAwards = mysqlTable("lcj_coin_badge_awards", {
  id: int("id").autoincrement().primaryKey(),
  badgeId: int("badgeId").notNull(),
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
  metadata: json("metadata").$type<Record<string, any>>(), // 獲得時の追加情報
});
export type LcjCoinBadgeAward = typeof lcjCoinBadgeAwards.$inferSelect;
export type InsertLcjCoinBadgeAward = typeof lcjCoinBadgeAwards.$inferInsert;

/**
 * LCJコイン シーズン定義 - 期間限定イベント・シーズン
 */
export const lcjCoinSeasons = mysqlTable("lcj_coin_seasons", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  theme: varchar("theme", { length: 100 }), // テーマカラーやスタイル
  bonusMultiplier: decimal("bonusMultiplier", { precision: 5, scale: 2 }).default("1.00").notNull(), // ボーナス倍率
  rewards: json("rewards").$type<Record<string, any>>(), // シーズン報酬定義
  status: mysqlEnum("status", ["upcoming", "active", "ended"]).default("upcoming").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinSeason = typeof lcjCoinSeasons.$inferSelect;
export type InsertLcjCoinSeason = typeof lcjCoinSeasons.$inferInsert;

/**
 * LCJコイン ランキング履歴 - 月次/シーズンのランキングスナップショット
 */
export const lcjCoinRankingHistory = mysqlTable("lcj_coin_ranking_history", {
  id: int("id").autoincrement().primaryKey(),
  period: varchar("period", { length: 20 }).notNull(), // "2026-04" or "season-1"
  periodType: mysqlEnum("periodType", ["monthly", "season", "yearly"]).notNull(),
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(),
  rank: int("rank").notNull(),
  totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(), // ランキング時の総資産価値
  xpEarned: bigint("xpEarned", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinRankingHistory = typeof lcjCoinRankingHistory.$inferSelect;
export type InsertLcjCoinRankingHistory = typeof lcjCoinRankingHistory.$inferInsert;

// ============================================================
// LCJ Coin: Financial Document Upload History
// ============================================================
export const lcjCoinDocuments = mysqlTable("lcj_coin_documents", {
  id: int("id").autoincrement().primaryKey(),
  documentType: varchar("documentType", { length: 50 }).notNull(), // 'financial_statement' | 'shareholder_registry' | 'other'
  title: varchar("title", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  periodStart: varchar("periodStart", { length: 20 }), // e.g. '2025-08-14'
  periodEnd: varchar("periodEnd", { length: 20 }), // e.g. '2026-01-31'
  // Extracted data (JSON)
  extractedData: text("extractedData"), // JSON: parsed financial data or shareholder data
  // Revenue extracted from financial statement
  extractedRevenue: bigint("extractedRevenue", { mode: "number" }),
  extractedNetIncome: bigint("extractedNetIncome", { mode: "number" }),
  extractedTotalAssets: bigint("extractedTotalAssets", { mode: "number" }),
  extractedNetAssets: bigint("extractedNetAssets", { mode: "number" }),
  // Upload info
  uploadedBy: int("uploadedBy"),
  uploadedByName: varchar("uploadedByName", { length: 255 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type LcjCoinDocument = typeof lcjCoinDocuments.$inferSelect;
export type InsertLcjCoinDocument = typeof lcjCoinDocuments.$inferInsert;

// ============================================================
// LCJ Coin: Shareholder Registry
// ============================================================
export const lcjCoinShareholders = mysqlTable("lcj_coin_shareholders", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId"), // References lcjCoinDocuments.id
  shareholderNo: int("shareholderNo"),
  name: varchar("name", { length: 255 }).notNull(),
  shares: int("shares").notNull(),
  ratio: varchar("ratio", { length: 20 }), // e.g. '52.11%'
  shareType: varchar("shareType", { length: 50 }).default("普通株式"),
  acquisitionDate: varchar("acquisitionDate", { length: 20 }),
  address: text("address"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type LcjCoinShareholder = typeof lcjCoinShareholders.$inferSelect;
export type InsertLcjCoinShareholder = typeof lcjCoinShareholders.$inferInsert;

// ============================================================
// LCJ Coin V3: Tier Templates
// ============================================================
export const lcjCoinTierTemplates = mysqlTable("lcj_coin_tier_templates", {
  id: int("id").autoincrement().primaryKey(),
  tierCode: varchar("tierCode", { length: 10 }).notNull().unique(),
  tierType: varchar("tierType", { length: 20 }).default("staff").notNull(), // 'staff' or 'creator'
  tierName: varchar("tierName", { length: 100 }).notNull(),
  description: text("description"),
  salaryCoefficient: decimal("salaryCoefficient", { precision: 5, scale: 2 }).default("0.00").notNull(),
  exampleRoles: text("exampleRoles"),
  vestingPeriodMonths: int("vestingPeriodMonths").default(36).notNull(),
  cliffMonths: int("cliffMonths").default(12).notNull(),
  vestingType: varchar("vestingType", { length: 30 }).default("monthly_flat").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  salaryMinJPY: int("salaryMinJPY"),
  salaryMaxJPY: int("salaryMaxJPY"),
  salaryMinRMB: int("salaryMinRMB"),
  salaryMaxRMB: int("salaryMaxRMB"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinTierTemplate = typeof lcjCoinTierTemplates.$inferSelect;
export type InsertLcjCoinTierTemplate = typeof lcjCoinTierTemplates.$inferInsert;

// ============================================================
// LCJ Coin V3: Peer Bonuses
// ============================================================
export const lcjCoinPeerBonuses = mysqlTable("lcj_coin_peer_bonuses", {
  id: int("id").autoincrement().primaryKey(),
  senderHolderType: mysqlEnum("senderHolderType", ["staff", "liver"]).notNull(),
  senderHolderId: int("senderHolderId").notNull(),
  receiverHolderType: mysqlEnum("receiverHolderType", ["staff", "liver"]).notNull(),
  receiverHolderId: int("receiverHolderId").notNull(),
  coinAmount: int("coinAmount").notNull(),
  message: text("message").notNull(),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjCoinPeerBonus = typeof lcjCoinPeerBonuses.$inferSelect;
export type InsertLcjCoinPeerBonus = typeof lcjCoinPeerBonuses.$inferInsert;

// ============================================================
// LCJ Coin V3: Buyback Periods
// ============================================================
export const lcjCoinBuybackPeriods = mysqlTable("lcj_coin_buyback_periods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  maxPercentage: decimal("maxPercentage", { precision: 5, scale: 2 }).default("20.00").notNull(),
  coinPriceAtOpen: decimal("coinPriceAtOpen", { precision: 12, scale: 4 }).notNull(),
  totalBudget: decimal("totalBudget", { precision: 18, scale: 2 }),
  totalRequested: decimal("totalRequested", { precision: 18, scale: 2 }).default("0"),
  totalApproved: decimal("totalApproved", { precision: 18, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["upcoming", "open", "closed", "settled"]).default("upcoming").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinBuybackPeriod = typeof lcjCoinBuybackPeriods.$inferSelect;
export type InsertLcjCoinBuybackPeriod = typeof lcjCoinBuybackPeriods.$inferInsert;

// ============================================================
// LCJ Coin V3: Buyback Requests
// ============================================================
export const lcjCoinBuybackRequests = mysqlTable("lcj_coin_buyback_requests", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  holdingId: int("holdingId").notNull(),
  holderType: mysqlEnum("holderType", ["staff", "liver"]).notNull(),
  holderId: int("holderId").notNull(),
  requestedCoins: bigint("requestedCoins", { mode: "number" }).notNull(),
  coinPriceAtRequest: decimal("coinPriceAtRequest", { precision: 12, scale: 4 }).notNull(),
  requestedAmount: decimal("requestedAmount", { precision: 18, scale: 2 }).notNull(),
  approvedCoins: bigint("approvedCoins", { mode: "number" }).default(0),
  approvedAmount: decimal("approvedAmount", { precision: 18, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "settled", "cancelled"]).default("pending").notNull(),
  reason: text("reason"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  settledAt: timestamp("settledAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjCoinBuybackRequest = typeof lcjCoinBuybackRequests.$inferSelect;
export type InsertLcjCoinBuybackRequest = typeof lcjCoinBuybackRequests.$inferInsert;


/**
 * AI Coach Messages table - LCJ 神コーチ
 * ライバーごとに1つのチャットルーム（永続）
 * 配信記録保存時にAIが自動で質問を生成し、ライバーが回答していく
 */
export const aiCoachMessages = mysqlTable("ai_coach_messages", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id
  roomId: int("roomId"), // References ai_coach_rooms.id (null = default/legacy room)
  role: mysqlEnum("role", ["ai", "user"]).notNull(), // ai = 神コーチ, user = ライバー
  content: text("content").notNull(), // メッセージ内容
  messageType: varchar("messageType", { length: 100 }), // auto_question（配信記録後の自動質問）, advice（アドバイス）, chat（通常チャット）, welcome（初回挨拶）
  contextType: varchar("contextType", { length: 100 }), // livestream（配信記録）, set_analysis（セット分析）, goal（目標相談）, general（一般）
  contextId: int("contextId"), // 関連する配信記録ID等
  metadata: json("metadata").$type<Record<string, unknown>>(), // 追加情報（売上データ等のスナップショット）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiCoachMessage = typeof aiCoachMessages.$inferSelect;
export type InsertAiCoachMessage = typeof aiCoachMessages.$inferInsert;

/**
 * AI Coach Rooms - ChatGPT風のトークルーム管理
 */
export const aiCoachRooms = mysqlTable("ai_coach_rooms", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("新しい会話"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type AiCoachRoom = typeof aiCoachRooms.$inferSelect;
export type InsertAiCoachRoom = typeof aiCoachRooms.$inferInsert;


/**
 * Live Suggestions - AI配信提案の履歴管理
 * 今日のスケジュールに基づいてAIが配信提案を生成し、LINEグループに送信した履歴
 */
export const liveSuggestions = mysqlTable("live_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  // 対象日
  targetDate: timestamp("targetDate").notNull(), // 提案対象の日付
  // 対象ライバー情報
  liverName: varchar("liverName", { length: 255 }).notNull(),
  liverId: int("liverId"),
  scheduleId: int("scheduleId"), // 紐づくスケジュールID
  // スケジュール情報
  scheduledStartTime: timestamp("scheduledStartTime"), // 配信予定開始時刻
  scheduledEndTime: timestamp("scheduledEndTime"), // 配信予定終了時刻
  // AI提案内容
  suggestionText: text("suggestionText").notNull(), // AI生成の提案テキスト
  promptUsed: text("promptUsed"), // AIに渡したプロンプト（デバッグ用）
  // 送信情報
  sentToLineGroupId: varchar("sentToLineGroupId", { length: 64 }), // 送信先LINEグループID
  sentToLineGroupName: varchar("sentToLineGroupName", { length: 255 }), // 送信先LINEグループ名
  lineSendSuccess: boolean("lineSendSuccess").default(false).notNull(), // LINE送信成功したか
  lineSendError: text("lineSendError"), // LINE送信エラーメッセージ
  // メタ情報
  generatedBy: varchar("generatedBy", { length: 255 }), // 生成者（admin email等）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveSuggestion = typeof liveSuggestions.$inferSelect;
export type InsertLiveSuggestion = typeof liveSuggestions.$inferInsert;

/**
 * Livestream Promotions table for tracking individual product discounts during live streams
 * 配信中の単品割引プロモーションを記録するテーブル
 */
export const livestreamPromotions = mysqlTable("livestream_promotions", {
  id: int("id").autoincrement().primaryKey(),
  livestreamId: int("livestreamId").notNull(), // References brandLivestreams.id

  // 商品情報
  productName: varchar("productName", { length: 255 }).notNull(), // 商品名（自由入力）
  originalPrice: bigint("originalPrice", { mode: "number" }).notNull(), // 元値（定価）
  discountPrice: bigint("discountPrice", { mode: "number" }).notNull(), // 割引後価格
  quantity: int("quantity").default(1).notNull(), // 販売数量

  // 自動計算フィールド
  discountRate: int("discountRate").default(0), // 割引率（%）
  totalRevenue: bigint("totalRevenue", { mode: "number" }).default(0), // 売上合計（割引後価格 × 数量）

  // 並び順
  sortOrder: int("sortOrder").default(0),

  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LivestreamPromotion = typeof livestreamPromotions.$inferSelect;
export type InsertLivestreamPromotion = typeof livestreamPromotions.$inferInsert;


/**
 * Master Set Suggestions table - 管理者が作成するセット提案マスター
 * ライバーがマイページから選んで採用できるセット提案
 */
export const masterSetSuggestions = mysqlTable("master_set_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  
  // セット提案情報
  title: varchar("title", { length: 255 }).notNull(), // セット提案名（例：「5月UVケアセット」）
  description: text("description"), // 提案の説明・セールスポイント
  category: varchar("category", { length: 100 }), // カテゴリ（季節、定番、キャンペーン等）
  
  // 価格情報
  suggestedPrice: bigint("suggestedPrice", { mode: "number" }).notNull(), // 推奨売値
  totalOriginalPrice: bigint("totalOriginalPrice", { mode: "number" }).default(0), // 元値合計
  suggestedDiscountRate: int("suggestedDiscountRate").default(0), // 推奨割引率（%）
  
  // 予測情報（AI生成）
  expectedSales: int("expectedSales").default(0), // 予想販売数
  expectedRevenue: bigint("expectedRevenue", { mode: "number" }).default(0), // 予想売上
  aiReasoning: text("aiReasoning"), // AI提案理由
  
  // ステータス管理
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, approved, rejected, active, archived, expired
  priority: int("priority").default(0), // 表示優先度（高い順）
  
  // 有効期間
  validFrom: timestamp("validFrom"), // 提案有効開始日
  validUntil: timestamp("validUntil"), // 提案有効終了日
  
  // 採用数トラッキング
  adoptionCount: int("adoptionCount").default(0), // ライバーに採用された回数
  
  // 作成者
  createdBy: int("createdBy").default(0), // 0=AI生成, その他=管理者ID
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MasterSetSuggestion = typeof masterSetSuggestions.$inferSelect;
export type InsertMasterSetSuggestion = typeof masterSetSuggestions.$inferInsert;

/**
 * Master Set Suggestion Items - マスターセット提案の個別商品
 */
export const masterSetSuggestionItems = mysqlTable("master_set_suggestion_items", {
  id: int("id").autoincrement().primaryKey(),
  suggestionId: int("suggestionId").notNull(), // References masterSetSuggestions.id
  
  // 商品情報
  productName: varchar("productName", { length: 255 }).notNull(), // 商品名
  originalPrice: bigint("originalPrice", { mode: "number" }).notNull(), // 元値（定価）
  quantity: int("quantity").default(1).notNull(), // 個数
  isFree: tinyint("isFree").default(0), // 無料ギフトフラグ（0=通常, 1=無料）
  
  // 並び順
  sortOrder: int("sortOrder").default(0),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterSetSuggestionItem = typeof masterSetSuggestionItems.$inferSelect;
export type InsertMasterSetSuggestionItem = typeof masterSetSuggestionItems.$inferInsert;

/**
 * Master Set Adoptions - ライバーがマスター提案を採用した記録
 */
export const masterSetAdoptions = mysqlTable("master_set_adoptions", {
  id: int("id").autoincrement().primaryKey(),
  suggestionId: int("suggestionId").notNull(), // References masterSetSuggestions.id
  liverId: int("liverId").notNull(), // ライバーID
  liverName: varchar("liverName", { length: 255 }), // ライバー名
  
  // 採用時の設定（ライバーがカスタマイズ可能）
  customPrice: bigint("customPrice", { mode: "number" }), // カスタム売値（nullなら推奨価格を使用）
  
  // 結果トラッキング
  livestreamId: int("livestreamId"), // 実際に使用した配信ID（紐付け）
  actualSales: int("actualSales"), // 実際の販売数
  actualRevenue: bigint("actualRevenue", { mode: "number" }), // 実際の売上
  
  // タイムスタンプ
  adoptedAt: timestamp("adoptedAt").defaultNow().notNull(),
});
export type MasterSetAdoption = typeof masterSetAdoptions.$inferSelect;
export type InsertMasterSetAdoption = typeof masterSetAdoptions.$inferInsert;

/**
 * Master Set Feedback - 管理者/ライバーからのフィードバック（承認/却下理由含む）
 * Phase 1: 管理者の承認/却下理由
 * Phase 3: AIが自動分類してパターン認識に活用
 */
export const masterSetFeedback = mysqlTable("master_set_feedback", {
  id: int("id").autoincrement().primaryKey(),
  suggestionId: int("suggestionId").notNull(), // References masterSetSuggestions.id
  
  // フィードバック情報
  action: varchar("action", { length: 50 }).notNull(), // approved, rejected, comment
  reason: text("reason"), // 自由テキスト（「割引率が低い」「季節外れ」等）
  
  // AI自動分類（Phase 3）
  category: varchar("category", { length: 100 }), // AI分類カテゴリ（割引率, 季節性, 商品相性, 在庫, 価格帯, その他）
  sentiment: varchar("sentiment", { length: 20 }), // positive, negative, neutral
  keywords: json("keywords").$type<string[]>(), // AIが抽出したキーワード
  
  // 投稿者情報
  userId: int("userId").notNull(), // 管理者ID
  userName: varchar("userName", { length: 255 }),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterSetFeedback = typeof masterSetFeedback.$inferSelect;
export type InsertMasterSetFeedback = typeof masterSetFeedback.$inferInsert;

/**
 * Master Set Reviews - ライバーからの口コミ・星評価（Phase 2）
 */
export const masterSetReviews = mysqlTable("master_set_reviews", {
  id: int("id").autoincrement().primaryKey(),
  suggestionId: int("suggestionId").notNull(), // References masterSetSuggestions.id
  
  // ライバー情報
  liverId: int("liverId").notNull(),
  liverName: varchar("liverName", { length: 255 }),
  
  // 評価
  rating: int("rating").notNull(), // 1-5星
  comment: text("comment"), // 口コミテキスト
  
  // AI自動分類
  category: varchar("category", { length: 100 }), // AI分類カテゴリ
  sentiment: varchar("sentiment", { length: 20 }), // positive, negative, neutral
  keywords: json("keywords").$type<string[]>(), // AIが抽出したキーワード
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MasterSetReview = typeof masterSetReviews.$inferSelect;
export type InsertMasterSetReview = typeof masterSetReviews.$inferInsert;


/**
 * Mega Channel Settings - メガチャンネル配信制度の設定
 * 管理者がティアの閾値やメガチャンネル情報を設定する
 */
export const megaChannelSettings = mysqlTable("mega_channel_settings", {
  id: int("id").autoincrement().primaryKey(),
  // ティア設定
  tierName: varchar("tierName", { length: 50 }).notNull().default("Gold"), // ティア名
  hourlyRateThreshold: int("hourlyRateThreshold").notNull().default(100000), // 時間単価の閾値（円/h）
  recentLivestreamCount: int("recentLivestreamCount").notNull().default(3), // 直近何回のライブで判定するか
  // メガチャンネル情報
  channelName: varchar("channelName", { length: 255 }).default("Ryu kyogoku"), // メガチャンネル名
  channelDescription: text("channelDescription"), // メガチャンネルの説明
  channelFollowerCount: int("channelFollowerCount"), // フォロワー数（表示用）
  // 制度設定
  isActive: boolean("isActive").default(true).notNull(), // 制度が有効かどうか
  requireApproval: boolean("requireApproval").default(true).notNull(), // 管理者承認が必要か
  maintenanceMonths: int("maintenanceMonths").default(3), // 維持条件: N ヶ月連続で基準を下回ったら降格
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MegaChannelSetting = typeof megaChannelSettings.$inferSelect;
export type InsertMegaChannelSetting = typeof megaChannelSettings.$inferInsert;

/**
 * Mega Channel Qualifications - ライバーのメガチャンネル配信資格
 * ライバーごとの資格状態・承認状態を管理する
 */
export const megaChannelQualifications = mysqlTable("mega_channel_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id
  liverName: varchar("liverName", { length: 255 }).notNull(),
  // 資格状態
  status: mysqlEnum("status", [
    "not_qualified",   // 未達成
    "qualified",       // 条件達成（承認待ち）
    "approved",        // 承認済み（配信可能）
    "rejected",        // 却下
    "suspended",       // 一時停止（基準を下回った）
  ]).default("not_qualified").notNull(),
  // 計算値（最終更新時点）
  avgHourlyRate: int("avgHourlyRate").default(0), // 直近N回の平均時間単価
  recentLivestreamCount: int("recentLivestreamCount").default(0), // 直近のライブ回数
  totalLivestreamCount: int("totalLivestreamCount").default(0), // 累計ライブ回数
  // 承認関連
  approvedAt: timestamp("approvedAt"), // 承認日時
  approvedBy: int("approvedBy"), // 承認者のUser ID
  rejectedAt: timestamp("rejectedAt"), // 却下日時
  rejectedReason: text("rejectedReason"), // 却下理由
  // 履歴
  qualifiedAt: timestamp("qualifiedAt"), // 条件達成日時
  suspendedAt: timestamp("suspendedAt"), // 停止日時
  consecutiveMonthsBelowThreshold: int("consecutiveMonthsBelowThreshold").default(0), // 基準を下回った連続月数
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MegaChannelQualification = typeof megaChannelQualifications.$inferSelect;
export type InsertMegaChannelQualification = typeof megaChannelQualifications.$inferInsert;

/**
 * Mega Channel History - メガチャンネル資格変更履歴
 * 資格の変更（達成、承認、却下、停止等）の履歴を記録
 */
export const megaChannelHistory = mysqlTable("mega_channel_history", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // References livers.id
  liverName: varchar("liverName", { length: 255 }).notNull(),
  // 変更内容
  action: mysqlEnum("action", [
    "qualified",    // 条件達成
    "approved",     // 承認
    "rejected",     // 却下
    "suspended",    // 停止
    "restored",     // 復帰
  ]).notNull(),
  previousStatus: varchar("previousStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }).notNull(),
  // 詳細
  avgHourlyRate: int("avgHourlyRate"), // その時点の平均時間単価
  note: text("note"), // メモ
  actionBy: int("actionBy"), // 操作者のUser ID（自動の場合はNULL）
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MegaChannelHistoryRecord = typeof megaChannelHistory.$inferSelect;
export type InsertMegaChannelHistoryRecord = typeof megaChannelHistory.$inferInsert;

// ===== 今週の重点商品システム =====

// 重点商品テーブル
export const featuredProducts = mysqlTable("featured_products", {
  id: int("id").autoincrement().primaryKey(),
  tiktokShopUrl: varchar("tiktokShopUrl", { length: 500 }),
  productName: varchar("productName", { length: 255 }).notNull(),
  productImageUrl: varchar("productImageUrl", { length: 500 }),
  brandName: varchar("brandName", { length: 255 }),
  quotaDurationMinutes: int("quotaDurationMinutes").notNull().default(60),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }).notNull(),
  notes: text("notes"),
  setProposal: text("setProposal"),
  talkScript: text("talkScript"),
  successCase: text("successCase"),
  targetType: mysqlEnum("targetType", ["all", "specific"]).notNull().default("all"),
  isActive: boolean("isActive").notNull().default(true),
  priority: int("priority").notNull().default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FeaturedProduct = typeof featuredProducts.$inferSelect;
export type InsertFeaturedProduct = typeof featuredProducts.$inferInsert;

// 重点商品の対象ライバー
export const featuredProductTargets = mysqlTable("featured_product_targets", {
  id: int("id").autoincrement().primaryKey(),
  featuredProductId: int("featuredProductId").notNull(),
  liverId: int("liverId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FeaturedProductTarget = typeof featuredProductTargets.$inferSelect;
export type InsertFeaturedProductTarget = typeof featuredProductTargets.$inferInsert;

// ライバーの確認記録
export const featuredProductAcknowledgements = mysqlTable("featured_product_acknowledgements", {
  id: int("id").autoincrement().primaryKey(),
  featuredProductId: int("featuredProductId").notNull(),
  liverId: int("liverId").notNull(),
  acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
});
export type FeaturedProductAcknowledgement = typeof featuredProductAcknowledgements.$inferSelect;
export type InsertFeaturedProductAcknowledgement = typeof featuredProductAcknowledgements.$inferInsert;

// ライバーのノルマ達成記録
export const featuredProductProgress = mysqlTable("featured_product_progress", {
  id: int("id").autoincrement().primaryKey(),
  featuredProductId: int("featuredProductId").notNull(),
  liverId: int("liverId").notNull(),
  achievedDurationMinutes: int("achievedDurationMinutes").notNull().default(0),
  livestreamCount: int("livestreamCount").notNull().default(0),
  salesAmount: int("salesAmount").notNull().default(0),
  status: mysqlEnum("status", ["in_progress", "completed", "failed"]).notNull().default("in_progress"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FeaturedProductProgress = typeof featuredProductProgress.$inferSelect;
export type InsertFeaturedProductProgress = typeof featuredProductProgress.$inferInsert;

// 未達成ペナルティ履歴
export const featuredProductPenalties = mysqlTable("featured_product_penalties", {
  id: int("id").autoincrement().primaryKey(),
  featuredProductId: int("featuredProductId").notNull(),
  liverId: int("liverId").notNull(),
  liverName: varchar("liverName", { length: 255 }),
  quotaDurationMinutes: int("quotaDurationMinutes").notNull(),
  achievedDurationMinutes: int("achievedDurationMinutes").notNull().default(0),
  achievementRate: decimal("achievementRate", { precision: 5, scale: 2 }).notNull().default("0"),
  penaltyDate: varchar("penaltyDate", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FeaturedProductPenalty = typeof featuredProductPenalties.$inferSelect;
export type InsertFeaturedProductPenalty = typeof featuredProductPenalties.$inferInsert;

/**
 * Brand Short Videos table for tracking short video posts per brand
 * ブランド別短視頻投稿記録テーブル - 各ブランドの短視頻投稿実績を記録
 */
export const brandShortVideos = mysqlTable("brand_short_videos", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  liverId: int("liverId"), // References livers.id - 投稿者ライバーID
  liverName: varchar("liverName", { length: 255 }).notNull(), // 投稿者名
  contractId: int("contractId"), // References brand_contracts.id - 紐付く契約
  postDate: timestamp("postDate").notNull(), // 投稿日
  platform: varchar("platform", { length: 100 }).default("TikTok"), // プラットフォーム (TikTok, YouTube Shorts, Instagram Reels)
  videoUrl: text("videoUrl"), // 動画URL
  thumbnailUrl: text("thumbnailUrl"), // サムネイルURL
  title: varchar("title", { length: 500 }), // タイトル/説明
  productName: varchar("productName", { length: 255 }), // 紐付く商品名
  productId: int("productId"), // References brand_products.id
  // パフォーマンスメトリクス
  views: int("views").default(0), // 再生数
  likes: int("likes").default(0), // いいね数
  comments: int("comments").default(0), // コメント数
  shares: int("shares").default(0), // シェア数
  saves: int("saves").default(0), // 保存数
  // ステータス
  status: mysqlEnum("status", ["draft", "scheduled", "posted", "failed"]).default("posted").notNull(),
  isViolation: int("isViolation").default(0).notNull(), // 違規フラグ (0=正常, 1=違規)
  violationNote: text("violationNote"), // 違規理由メモ
  deadline: timestamp("deadline"), // 截止日期（ブランド方の投稿期限）
  notes: text("notes"), // メモ
  // 作成者情報
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"), // ソフトデリート
});
export type BrandShortVideo = typeof brandShortVideos.$inferSelect;
export type InsertBrandShortVideo = typeof brandShortVideos.$inferInsert;

// ============================================================
// LCJ Brain チャットログ
// ============================================================
export const lcjBrainChatLogs = mysqlTable("lcj_brain_chat_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId"), // staff or user ID
  userName: varchar("userName", { length: 100 }),
  sessionId: varchar("sessionId", { length: 100 }), // チャットセッションID
  conversationId: int("conversationId"), // 会話ID
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  content: text("content").notNull(),
  context: varchar("context", { length: 50 }), // chat | diagnosis | training | scripts | scoring
  suggestedQuestions: text("suggestedQuestions"), // JSON array of suggested follow-up questions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LcjBrainChatLog = typeof lcjBrainChatLogs.$inferSelect;

// LCJ Brain 会話（GPTのような会話管理）
// ============================================================
export const lcjBrainConversations = mysqlTable("lcj_brain_conversations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  context: varchar("context", { length: 50 }).default("chat"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type LcjBrainConversation = typeof lcjBrainConversations.$inferSelect;
export type InsertLcjBrainConversation = typeof lcjBrainConversations.$inferInsert;


// LCJ Brain 知識庫（会議纪要・日報・SOP等）
// ============================================================
export const lcjBrainKnowledge = mysqlTable("lcj_brain_knowledge", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 500 }).notNull(), // 纪要タイトル
  category: varchar("category", { length: 50 }).notNull().default("meeting"), // meeting / daily_report / sop / brand / other
  content: text("content").notNull(), // 全文テキスト
  summary: text("summary"), // AI生成の要約
  participants: json("participants").$type<string[]>(), // 参加者リスト
  tags: json("tags").$type<string[]>(), // タグ（品牌名、プロジェクト名等）
  meetingDate: timestamp("meetingDate"), // 会議日時
  sourceFileName: varchar("sourceFileName", { length: 500 }), // 元ファイル名
  uploadedBy: int("uploadedBy"), // アップロードしたユーザーID
  uploadedByName: varchar("uploadedByName", { length: 100 }), // アップロードしたユーザー名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LcjBrainKnowledge = typeof lcjBrainKnowledge.$inferSelect;
export type InsertLcjBrainKnowledge = typeof lcjBrainKnowledge.$inferInsert;

// ============================================================
// Brand Ad Reports (広告実績スクショレポート)
// ============================================================
export const brandAdReports = mysqlTable("brand_ad_reports", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  
  // レポート基本情報
  title: varchar("title", { length: 500 }), // レポートタイトル（任意）
  periodStart: timestamp("periodStart").notNull(), // 期間開始
  periodEnd: timestamp("periodEnd").notNull(), // 期間終了
  
  // スクショ画像
  screenshotUrl: text("screenshotUrl").notNull(), // スクショ画像URL
  screenshotKey: varchar("screenshotKey", { length: 512 }), // S3 key
  
  // AI OCR抽出データ
  extractedData: json("extractedData").$type<{
    cost?: number;
    skuOrders?: number;
    avgOrderCost?: number;
    totalRevenue?: number;
    roi?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    currency?: string;
    platform?: string;
    shopName?: string;
    rawText?: string;
  }>(),
  ocrStatus: mysqlEnum("ocrStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  
  // メモ・コメント
  memo: text("memo"),
  
  // メール送信履歴
  lastEmailSentAt: timestamp("lastEmailSentAt"),
  emailSentCount: int("emailSentCount").default(0),
  
  // 作成者
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  
  // タイムスタンプ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandAdReport = typeof brandAdReports.$inferSelect;
export type InsertBrandAdReport = typeof brandAdReports.$inferInsert;

// ============================================================
// Brand Ad Email Recipients (ブランド広告レポートメール送信先)
// ============================================================
export const brandAdEmailRecipients = mysqlTable("brand_ad_email_recipients", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(), // References brands.id
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }), // 担当者名
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandAdEmailRecipient = typeof brandAdEmailRecipients.$inferSelect;
export type InsertBrandAdEmailRecipient = typeof brandAdEmailRecipients.$inferInsert;

// ============================================================
// 月度GMV目標テーブル
// ============================================================
export const brandMonthlyGmvTargets = mysqlTable("brand_monthly_gmv_targets", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  gmvTarget: bigint("gmvTarget", { mode: "number" }).default(0).notNull(),
  memo: text("memo"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandMonthlyGmvTarget = typeof brandMonthlyGmvTargets.$inferSelect;
export type InsertBrandMonthlyGmvTarget = typeof brandMonthlyGmvTargets.$inferInsert;

// ============================================================
// 飛書同期履歴テーブル (Feishu Sync History)
// ============================================================
export const feishuSyncHistory = mysqlTable("feishu_sync_history", {
  id: int("id").autoincrement().primaryKey(),
  syncType: varchar("syncType", { length: 50 }).notNull().default("brands"), // brands, tasks, etc.
  status: varchar("status", { length: 20 }).notNull().default("success"), // success, error
  totalRecords: int("totalRecords").default(0).notNull(), // 飛書から取得した総レコード数
  newRecords: int("newRecords").default(0).notNull(), // 新規作成数
  updatedRecords: int("updatedRecords").default(0).notNull(), // 更新数
  errorMessage: text("errorMessage"), // エラーメッセージ（失敗時）
  triggeredBy: varchar("triggeredBy", { length: 50 }).notNull().default("auto"), // auto, manual
  durationMs: int("durationMs").default(0), // 同期にかかった時間（ミリ秒）
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type FeishuSyncHistory = typeof feishuSyncHistory.$inferSelect;
export type InsertFeishuSyncHistory = typeof feishuSyncHistory.$inferInsert;

// ============================================================
// 営業CRM: 通話記録テーブル (Call Logs)
// ============================================================
export const callLogs = mysqlTable("call_logs", {
  id: int("id").autoincrement().primaryKey(),
  businessCardId: int("businessCardId").notNull(), // References business_cards.id
  calledBy: int("calledBy").notNull(), // User ID who made the call
  calledAt: timestamp("calledAt").defaultNow().notNull(), // When the call was made
  duration: int("duration"), // Duration in minutes (nullable for unanswered)
  result: mysqlEnum("result", ["answered", "no_answer", "busy", "callback", "meeting_set", "rejected"]).notNull(),
  memo: text("memo"), // Call notes
  contactName: varchar("contactName", { length: 255 }), // Contact name (denormalized for display)
  contactCompany: varchar("contactCompany", { length: 255 }), // Contact company (denormalized for display)
  nextFollowUpAt: timestamp("nextFollowUpAt"), // Next follow-up date/time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

// ============================================================
// 営業CRM: 営業アクティビティテーブル (Sales Activities)
// ============================================================
export const salesActivities = mysqlTable("sales_activities", {
  id: int("id").autoincrement().primaryKey(),
  businessCardId: int("businessCardId").notNull(), // References business_cards.id
  activityType: mysqlEnum("activityType", ["call", "email", "status_change", "note", "meeting", "brand_linked"]).notNull(),
  description: text("description"), // Activity description
  performedBy: int("performedBy").notNull(), // User ID
  metadata: json("metadata").$type<Record<string, any>>(), // Additional data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SalesActivity = typeof salesActivities.$inferSelect;
export type InsertSalesActivity = typeof salesActivities.$inferInsert;

// ============================================================
// ブランド分析キャッシュテーブル (Brand Analysis Cache)
// ============================================================
export const brandAnalysisCache = mysqlTable("brand_analysis_cache", {
  id: int("id").autoincrement().primaryKey(),
  liverId: int("liverId").notNull(), // ライバーID
  cacheKey: varchar("cacheKey", { length: 100 }).notNull(), // キャッシュキー（例: "alltime_stats"）
  data: json("data").$type<Record<string, any>>().notNull(), // 分析結果JSON
  updatedAt: timestamp("updatedAt").defaultNow().notNull(), // 最終更新日時
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BrandAnalysisCache = typeof brandAnalysisCache.$inferSelect;
export type InsertBrandAnalysisCache = typeof brandAnalysisCache.$inferInsert;

// リード収集履歴テーブル
export const leadCollectionHistory = mysqlTable("lead_collection_history", {
  id: int("id").autoincrement().primaryKey(),
  keyword: varchar("keyword", { length: 255 }).notNull(), // 検索キーワード
  prefecture: varchar("prefecture", { length: 50 }), // 都道府県
  pipeline: varchar("pipeline", { length: 50 }).notNull(), // google_maps, google_search, portals, full_pipeline
  leadsFound: int("leadsFound").default(0), // 収集されたリード数
  executedBy: varchar("executedBy", { length: 255 }), // 実行者
  executedAt: timestamp("executedAt").defaultNow().notNull(), // 実行日時
  batchId: varchar("batchId", { length: 100 }), // salesdash APIのbatchId
  status: varchar("status", { length: 50 }).default("completed"), // completed, running, failed
});
export type LeadCollectionHistory = typeof leadCollectionHistory.$inferSelect;
export type InsertLeadCollectionHistory = typeof leadCollectionHistory.$inferInsert;


// ============================================================
// 営業メール送信履歴テーブル (Sales Email Send History)
// ============================================================
export const salesEmailLogs = mysqlTable("sales_email_logs", {
  id: int("id").autoincrement().primaryKey(),
  toEmail: varchar("toEmail", { length: 320 }).notNull(), // 送信先メールアドレス
  toName: varchar("toName", { length: 255 }), // 送信先名前
  toCompany: varchar("toCompany", { length: 255 }), // 送信先会社名
  subject: varchar("subject", { length: 500 }).notNull(), // 件名
  contentPreview: text("contentPreview"), // 本文プレビュー（最初の200文字程度）
  sendType: varchar("sendType", { length: 50 }).notNull().default("bulk"), // test, bulk_card, bulk_lead, bulk_unsent, bulk_all
  attachPdf: boolean("attachPdf").default(false), // PDF添付有無
  status: varchar("status", { length: 20 }).notNull().default("sent"), // sent, failed
  errorMessage: text("errorMessage"), // エラーメッセージ（失敗時）
  businessCardId: int("businessCardId"), // 名刺ID（名刺経由の場合）
  sentBy: int("sentBy"), // 送信者のuser ID
  sentAt: timestamp("sentAt").defaultNow().notNull(), // 送信日時
  // トラッキング
  trackingId: varchar("trackingId", { length: 64 }), // ユニークトラッキングID
  openedAt: timestamp("openedAt"), // 初回開封日時
  openCount: int("openCount").default(0), // 開封回数
  lastOpenedAt: timestamp("lastOpenedAt"), // 最終開封日時
  pdfDownloadedAt: timestamp("pdfDownloadedAt"), // 初回PDFダウンロード日時
  pdfDownloadCount: int("pdfDownloadCount").default(0), // PDFダウンロード回数
});
export type SalesEmailLog = typeof salesEmailLogs.$inferSelect;
export type InsertSalesEmailLog = typeof salesEmailLogs.$inferInsert;
