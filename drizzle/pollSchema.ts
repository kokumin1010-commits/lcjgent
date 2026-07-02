import { mysqlTable, int, varchar, text, decimal, timestamp, mysqlEnum, json } from "drizzle-orm/mysql-core";

/**
 * 商品投票（Polls）
 * 管理者が商品に対して投票を作成し、リンクを共有する
 * お客さんが希望価格を投票する
 */
export const polls = mysqlTable("polls", {
  id: int("id").primaryKey().autoincrement(),
  // 商品情報（投票作成時に入力、選品中心の商品とリンク可能）
  productId: int("productId"), // 選品中心の商品ID（任意リンク）
  productName: varchar("productName", { length: 500 }).notNull(),
  brandName: varchar("brandName", { length: 255 }),
  imageUrl: text("imageUrl"), // 商品画像URL
  description: text("description"), // 商品説明・特徴
  originalPrice: decimal("originalPrice", { precision: 12, scale: 2 }), // 定価（参考価格）
  // 投票設定
  status: mysqlEnum("status", ["active", "closed", "draft"]).notNull().default("active"),
  expiresAt: timestamp("expiresAt"), // 投票締切（任意）
  // メタ
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Poll = typeof polls.$inferSelect;
export type InsertPoll = typeof polls.$inferInsert;

/**
 * 投票回答（Poll Votes）
 * お客さんの希望価格投票
 * ログイン不要、IP+fingerprint で重複制限
 */
export const pollVotes = mysqlTable("poll_votes", {
  id: int("id").primaryKey().autoincrement(),
  pollId: int("pollId").notNull(),
  desiredPrice: decimal("desiredPrice", { precision: 12, scale: 2 }).notNull(), // 希望価格
  nickname: varchar("nickname", { length: 100 }), // 任意ニックネーム
  ipAddress: varchar("ipAddress", { length: 45 }), // 重複防止用
  fingerprint: varchar("fingerprint", { length: 64 }), // ブラウザフィンガープリント
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PollVote = typeof pollVotes.$inferSelect;
export type InsertPollVote = typeof pollVotes.$inferInsert;
