import { mysqlTable, int, varchar, text, decimal, timestamp, mysqlEnum, json, date, tinyint } from "drizzle-orm/mysql-core";

// 選品商品プール (actual DB structure)
export const selectionProducts = mysqlTable("selection_products", {
  id: int("id").primaryKey().autoincrement(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  brandId: int("brandId"),
  productName: varchar("productName", { length: 500 }).notNull(),
  categoryId: int("categoryId"),
  price: decimal("price", { precision: 12, scale: 2 }),
  marketPrice: decimal("marketPrice", { precision: 12, scale: 2 }),
  costPrice: decimal("costPrice", { precision: 12, scale: 2 }),
  commissionType: mysqlEnum("commissionType", ["percentage", "fixed"]).notNull().default("percentage"),
  commissionValue: decimal("commissionValue", { precision: 10, scale: 2 }).default("0"),
  stock: int("stock").default(0),
  images: json("images"),
  videos: json("videos"),
  sellingPoints: text("sellingPoints"),
  productLink: varchar("productLink", { length: 500 }),
  supplierContact: varchar("supplierContact", { length: 255 }),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "online", "offline"]).notNull().default("draft"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  barcode: varchar("barcode", { length: 100 }),
  productId: varchar("productId", { length: 100 }),
  talentExclusive: tinyint("talentExclusive").default(0),
  exclusiveLiverIds: json("exclusiveLiverIds"),
});

// 選品カテゴリ (actual DB structure)
export const selectionCategories = mysqlTable("selection_categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  parentId: int("parentId"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 主播選品記録 (actual DB structure)
export const anchorSelections = mysqlTable("anchor_selections", {
  id: int("id").primaryKey().autoincrement(),
  liverId: int("liverId").notNull(),
  productId: int("productId").notNull(),
  status: mysqlEnum("status", ["selected", "scheduled", "completed"]).notNull().default("selected"),
  selectedAt: timestamp("selectedAt").defaultNow().notNull(),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 排期管理 (actual DB: sc_schedules)
export const scSchedules = mysqlTable("sc_schedules", {
  id: int("id").primaryKey().autoincrement(),
  anchorId: int("anchorId").notNull(),
  productId: int("productId").notNull(),
  liveDate: date("liveDate").notNull(),
  startTime: varchar("startTime", { length: 10 }),
  endTime: varchar("endTime", { length: 10 }),
  durationMinutes: int("durationMinutes"),
  slotOrder: int("slotOrder"),
  status: mysqlEnum("status", ["pending", "confirmed", "done", "cancelled"]).default("pending"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 帯貨データ（パフォーマンス） (actual DB structure)
export const selectionPerformances = mysqlTable("selection_performances", {
  id: int("id").primaryKey().autoincrement(),
  scheduleId: int("scheduleId"),
  liverId: int("liverId").notNull(),
  productId: int("productId").notNull(),
  liveDate: varchar("liveDate", { length: 10 }).notNull(),
  gmv: decimal("gmv", { precision: 12, scale: 2 }).default("0"),
  salesCount: int("salesCount").default(0),
  avgViewers: int("avgViewers"),
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }).default("0"),
  remark: text("remark"),
  status: mysqlEnum("status", ["draft", "confirmed"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 結算管理 (actual DB structure)
export const selectionSettlements = mysqlTable("selection_settlements", {
  id: int("id").primaryKey().autoincrement(),
  liverId: int("liverId").notNull(),
  periodStart: varchar("periodStart", { length: 10 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 10 }).notNull(),
  totalGmv: decimal("totalGmv", { precision: 14, scale: 2 }).default("0"),
  totalCommission: decimal("totalCommission", { precision: 12, scale: 2 }).default("0"),
  settledPerformanceIds: json("settledPerformanceIds"),
  status: mysqlEnum("status", ["pending", "confirmed", "paid"]).notNull().default("pending"),
  paidAt: timestamp("paidAt"),
  remark: text("remark"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
