import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * 24H爆速商品ラボ - 商品パイプライン
 * 1688仕入れ→テスト配信→爆品判定→横推のフロー管理
 */
export const productPipeline = mysqlTable("product_pipeline", {
  id: int("id").autoincrement().primaryKey(),
  // 商品基本情報
  name: varchar("name", { length: 500 }).notNull(), // 商品名
  imageUrl: text("imageUrl"), // 商品画像URL
  sourceUrl: text("sourceUrl"), // 1688/AliExpress URL
  sourceType: mysqlEnum("sourceType", ["1688", "aliexpress", "manual"]).default("manual").notNull(),
  // 価格情報
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }).notNull(), // 原価（仕入れ値）
  sellPrice: decimal("sellPrice", { precision: 10, scale: 2 }).notNull(), // 売値
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }), // 利益率（自動計算）
  // パイプラインステータス
  status: mysqlEnum("status", [
    "candidate",    // 候補
    "testing",      // テスト中
    "hit",          // 爆品
    "spreading",    // 横推中
    "standard",     // 定番
    "eliminated",   // 淘汰
  ]).default("candidate").notNull(),
  // スコアリング
  score: decimal("score", { precision: 8, scale: 2 }).default("0"), // AIスコア
  totalSales: int("totalSales").default(0), // 累計販売数
  totalGmv: decimal("totalGmv", { precision: 12, scale: 2 }).default("0"), // 累計GMV
  conversionRate: decimal("conversionRate", { precision: 5, scale: 2 }).default("0"), // 転換率
  // カテゴリ・タグ
  category: varchar("category", { length: 255 }), // カテゴリ
  tags: json("tags").$type<string[]>(), // タグ（配列）
  // 話術・説明
  talkScript: text("talkScript"), // 主播用話術テンプレート
  productDescription: text("productDescription"), // 商品説明
  // メタ情報
  notes: text("notes"), // メモ
  createdBy: int("createdBy"), // 登録者（staff ID）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductPipeline = typeof productPipeline.$inferSelect;
export type InsertProductPipeline = typeof productPipeline.$inferInsert;

/**
 * 24H爆速商品ラボ - テスト配信アサイン
 * 商品を主播にアサインしてテスト配信する記録
 */
export const productTestAssignment = mysqlTable("product_test_assignment", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(), // References product_pipeline.id
  liverId: int("liverId").notNull(), // References livers.id
  // 配信情報
  scheduledAt: timestamp("scheduledAt"), // 配信予定日時
  completedAt: timestamp("completedAt"), // 配信完了日時
  durationMinutes: int("durationMinutes").default(5), // 配信時間（分）
  // LINE通知
  lineNotifiedAt: timestamp("lineNotifiedAt"), // LINE通知送信日時
  lineNotifyStatus: mysqlEnum("lineNotifyStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  // 結果
  salesCount: int("salesCount").default(0), // 販売数
  gmv: decimal("gmv", { precision: 10, scale: 2 }).default("0"), // 売上金額
  viewCount: int("viewCount").default(0), // 視聴数
  conversionRate: decimal("conversionRate", { precision: 5, scale: 2 }).default("0"), // 転換率
  // メモ
  notes: text("notes"),
  assignedBy: int("assignedBy"), // アサイン者
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductTestAssignment = typeof productTestAssignment.$inferSelect;
export type InsertProductTestAssignment = typeof productTestAssignment.$inferInsert;

/**
 * 24H爆速商品ラボ - 売上データ（CSVインポート）
 * 主播がアップロードしたCSVから取り込んだ売上データ
 */
export const productLabSalesData = mysqlTable("product_lab_sales_data", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(), // References product_pipeline.id
  liverId: int("liverId"), // References livers.id（紐づけ可能な場合）
  assignmentId: int("assignmentId"), // References product_test_assignment.id
  // 売上データ
  salesDate: timestamp("salesDate"), // 売上日
  quantity: int("quantity").default(0), // 販売数
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"), // 売上金額
  // インポート情報
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  importSource: varchar("importSource", { length: 255 }), // CSVファイル名等
  rawData: json("rawData").$type<Record<string, unknown>>(), // 元データ
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProductLabSalesData = typeof productLabSalesData.$inferSelect;
export type InsertProductLabSalesData = typeof productLabSalesData.$inferInsert;
