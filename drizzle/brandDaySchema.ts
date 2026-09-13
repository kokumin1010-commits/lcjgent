import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const brandDayEvents = mysqlTable("brand_day_events", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brand_id"),
  slug: varchar("slug", { length: 120 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 120 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo").notNull(),
  eventStartAt: timestamp("event_start_at").notNull(),
  eventEndAt: timestamp("event_end_at").notNull(),
  registrationOpenAt: timestamp("registration_open_at"),
  registrationCloseAt: timestamp("registration_close_at"),
  minimumStreamMinutes: int("minimum_stream_minutes").default(60).notNull(),
  status: mysqlEnum("status", ["draft", "registration", "active", "closed", "archived"])
    .default("draft")
    .notNull(),
  logoKey: varchar("logo_key", { length: 500 }),
  logoUrl: text("logo_url"),
  themeJson: json("theme_json").$type<Record<string, unknown>>(),
  rulesJson: json("rules_json").$type<Record<string, unknown>>(),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourceEventId: varchar("source_event_id", { length: 120 }),
  legacyBaseUrl: varchar("legacy_base_url", { length: 500 }),
  createdBy: int("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  slugUnique: uniqueIndex("bd_events_slug_unique").on(table.slug),
  brandIdx: index("bd_events_brand_idx").on(table.brandId),
  statusIdx: index("bd_events_status_idx").on(table.status),
  sourceUnique: uniqueIndex("bd_events_source_unique").on(table.sourceSystem, table.sourceEventId),
}));

export const brandDayEntries = mysqlTable("brand_day_entries", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  registrationName: varchar("registration_name", { length: 120 }).notNull(),
  tiktokId: varchar("tiktok_id", { length: 120 }).notNull(),
  tiktokName: varchar("tiktok_name", { length: 160 }).notNull(),
  lineId: varchar("line_id", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  dashboardPasswordHash: varchar("dashboard_password_hash", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "suspended"]).default("pending").notNull(),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourceEntryId: int("source_entry_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  tiktokUnique: uniqueIndex("bd_entries_event_tiktok_unique").on(table.eventId, table.tiktokId),
  emailUnique: uniqueIndex("bd_entries_event_email_unique").on(table.eventId, table.email),
  sourceUnique: uniqueIndex("bd_entries_source_unique").on(table.eventId, table.sourceSystem, table.sourceEntryId),
  eventStatusIdx: index("bd_entries_event_status_idx").on(table.eventId, table.status),
}));

export const brandDayCreatorAccounts = mysqlTable("brand_day_creator_accounts", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  entryId: int("entry_id"),
  tiktokId: varchar("tiktok_id", { length: 120 }).notNull(),
  tiktokName: varchar("tiktok_name", { length: 160 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourceAccountId: int("source_account_id"),
  lastSignedInAt: timestamp("last_signed_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  tiktokUnique: uniqueIndex("bd_accounts_event_tiktok_unique").on(table.eventId, table.tiktokId),
  entryUnique: uniqueIndex("bd_accounts_event_entry_unique").on(table.eventId, table.entryId),
  sourceUnique: uniqueIndex("bd_accounts_source_unique").on(table.eventId, table.sourceSystem, table.sourceAccountId),
  eventStatusIdx: index("bd_accounts_event_status_idx").on(table.eventId, table.status),
}));

export const brandDayCreatorSessions = mysqlTable("brand_day_creator_sessions", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  creatorAccountId: int("creator_account_id").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({
  tokenUnique: uniqueIndex("bd_sessions_token_unique").on(table.tokenHash),
  accountIdx: index("bd_sessions_account_idx").on(table.creatorAccountId, table.expiresAt),
}));

export const brandDayPerformances = mysqlTable("brand_day_performances", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  creatorAccountId: int("creator_account_id").notNull(),
  dayNumber: int("day_number").notNull(),
  sessionNumber: int("session_number").default(1).notNull(),
  streamDate: timestamp("stream_date").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  streamMinutes: int("stream_minutes").default(0).notNull(),
  totalGmv: bigint("total_gmv", { mode: "number" }).default(0).notNull(),
  brandGmv: bigint("brand_gmv", { mode: "number" }).default(0).notNull(),
  screenshotKey: varchar("screenshot_key", { length: 500 }),
  screenshotUrl: text("screenshot_url"),
  screenshotHash: varchar("screenshot_hash", { length: 64 }),
  screenshotMimeType: varchar("screenshot_mime_type", { length: 100 }),
  aiStatus: mysqlEnum("ai_status", ["idle", "processing", "completed", "failed"])
    .default("idle")
    .notNull(),
  aiModel: varchar("ai_model", { length: 120 }),
  aiReport: text("ai_report"),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed", "reflected"])
    .default("draft")
    .notNull(),
  reviewDecision: mysqlEnum("review_decision", ["pending", "approved", "force_approved", "rejected"]),
  reviewReason: text("review_reason"),
  forceIncludeOutsideWindow: boolean("force_include_outside_window").default(false).notNull(),
  reviewedBy: int("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourcePerformanceId: int("source_performance_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  sessionUnique: uniqueIndex("bd_perf_event_creator_day_session_unique").on(
    table.eventId,
    table.creatorAccountId,
    table.dayNumber,
    table.sessionNumber,
  ),
  screenshotUnique: uniqueIndex("bd_perf_event_creator_hash_unique").on(
    table.eventId,
    table.creatorAccountId,
    table.screenshotHash,
  ),
  sourceUnique: uniqueIndex("bd_perf_source_unique").on(table.eventId, table.sourceSystem, table.sourcePerformanceId),
  eventStatusIdx: index("bd_perf_event_status_idx").on(table.eventId, table.status),
  reviewIdx: index("bd_perf_review_idx").on(table.eventId, table.reviewDecision),
}));

export const brandDayPerformanceProducts = mysqlTable("brand_day_performance_products", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  performanceId: int("performance_id").notNull(),
  productName: varchar("product_name", { length: 500 }).notNull(),
  gmv: bigint("gmv", { mode: "number" }).default(0).notNull(),
  brandGmv: bigint("brand_gmv", { mode: "number" }).default(0).notNull(),
  isBrandProduct: boolean("is_brand_product").default(false).notNull(),
  selected: boolean("selected").default(true).notNull(),
  confidenceBasisPoints: int("confidence_basis_points").default(0).notNull(),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourceProductId: int("source_product_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  performanceIdx: index("bd_products_performance_idx").on(table.performanceId),
  sourceUnique: uniqueIndex("bd_products_source_unique").on(table.eventId, table.sourceSystem, table.sourceProductId),
}));

export const brandDayAuditLogs = mysqlTable("brand_day_audit_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  creatorAccountId: int("creator_account_id"),
  actorUserId: int("actor_user_id"),
  actorName: varchar("actor_name", { length: 255 }),
  actorType: mysqlEnum("actor_type", ["creator", "staff", "admin", "system", "migration"])
    .default("system")
    .notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: int("entity_id"),
  detail: json("detail").$type<Record<string, unknown>>(),
  sourceSystem: varchar("source_system", { length: 80 }),
  sourceAuditId: int("source_audit_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({
  entityIdx: index("bd_audit_entity_idx").on(table.eventId, table.entityType, table.entityId),
  createdAtIdx: index("bd_audit_created_idx").on(table.eventId, table.createdAt),
  sourceUnique: uniqueIndex("bd_audit_source_unique").on(table.eventId, table.sourceSystem, table.sourceAuditId),
}));

export const brandDayMigrationRuns = mysqlTable("brand_day_migration_runs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  sourceSystem: varchar("source_system", { length: 80 }).notNull(),
  migrationKey: varchar("migration_key", { length: 160 }).notNull(),
  eventId: int("event_id"),
  status: mysqlEnum("status", ["preview", "running", "completed", "failed", "rolled_back"])
    .default("preview")
    .notNull(),
  sourceCounts: json("source_counts").$type<Record<string, number>>(),
  targetCounts: json("target_counts").$type<Record<string, number>>(),
  manifestSha256: varchar("manifest_sha256", { length: 64 }).notNull(),
  errorSummary: text("error_summary"),
  startedBy: int("started_by"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, table => ({
  migrationUnique: uniqueIndex("bd_migration_unique").on(table.sourceSystem, table.migrationKey),
  statusIdx: index("bd_migration_status_idx").on(table.status),
}));

export type BrandDayEvent = typeof brandDayEvents.$inferSelect;
export type BrandDayEntry = typeof brandDayEntries.$inferSelect;
export type BrandDayCreatorAccount = typeof brandDayCreatorAccounts.$inferSelect;
export type BrandDayCreatorSession = typeof brandDayCreatorSessions.$inferSelect;
export type BrandDayPerformance = typeof brandDayPerformances.$inferSelect;
export type BrandDayPerformanceProduct = typeof brandDayPerformanceProducts.$inferSelect;
export type BrandDayAuditLog = typeof brandDayAuditLogs.$inferSelect;
export type BrandDayMigrationRun = typeof brandDayMigrationRuns.$inferSelect;
