import { mysqlTable, int, varchar, text, decimal, timestamp, mysqlEnum, json } from "drizzle-orm/mysql-core";

// 選品商品プール
export const selectionProducts = mysqlTable("selection_products", {
  id: int("id").primaryKey().autoincrement(),
  productName: varchar("productName", { length: 500 }).notNull(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  categoryId: int("categoryId"),
  price: decimal("price", { precision: 10, scale: 2 }),
  marketPrice: decimal("marketPrice", { precision: 10, scale: 2 }),
  commissionType: mysqlEnum("commissionType", ["percentage", "fixed"]).default("percentage"),
  commissionValue: decimal("commissionValue", { precision: 10, scale: 2 }),
  imageUrl: text("imageUrl"),
  productLink: text("productLink"),
  sellingPoints: text("sellingPoints"),
  stock: int("stock"),
  supplierContact: varchar("supplierContact", { length: 255 }),
  status: mysqlEnum("status", ["draft", "online", "offline"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 選品カテゴリ
export const selectionCategories = mysqlTable("selection_categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: int("parentId"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 主播選品記録
export const anchorSelections = mysqlTable("anchor_selections", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  anchorId: int("anchorId").notNull(),
  status: mysqlEnum("status", ["selected", "scheduled", "completed", "cancelled"]).default("selected"),
  scheduledDate: varchar("scheduledDate", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 排期管理
export const selectionSchedules = mysqlTable("selection_schedules", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  anchorId: int("anchorId").notNull(),
  liveDate: varchar("liveDate", { length: 20 }).notNull(),
  startTime: varchar("startTime", { length: 10 }),
  endTime: varchar("endTime", { length: 10 }),
  slotOrder: int("slotOrder"),
  status: mysqlEnum("status", ["pending", "confirmed", "done", "cancelled"]).default("pending"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 帯貨データ（パフォーマンス）
export const selectionPerformances = mysqlTable("selection_performances", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  anchorId: int("anchorId").notNull(),
  scheduleId: int("scheduleId"),
  liveDate: varchar("liveDate", { length: 20 }).notNull(),
  gmv: decimal("gmv", { precision: 12, scale: 2 }).default("0"),
  salesCount: int("salesCount").default(0),
  viewerCount: int("viewerCount").default(0),
  clickCount: int("clickCount").default(0),
  conversionRate: decimal("conversionRate", { precision: 5, scale: 2 }),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["draft", "confirmed"]).default("draft"),
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 結算管理
export const selectionSettlements = mysqlTable("selection_settlements", {
  id: int("id").primaryKey().autoincrement(),
  anchorId: int("anchorId").notNull(),
  periodStart: varchar("periodStart", { length: 20 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 20 }).notNull(),
  totalGmv: decimal("totalGmv", { precision: 12, scale: 2 }).default("0"),
  totalCommission: decimal("totalCommission", { precision: 10, scale: 2 }).default("0"),
  itemCount: int("itemCount").default(0),
  status: mysqlEnum("status", ["pending", "confirmed", "paid"]).default("pending"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
