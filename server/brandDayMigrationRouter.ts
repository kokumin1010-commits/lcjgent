import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getBrandDayPool } from "./brandDayPool";
import { requireBrandDayPermission } from "./brandDayAccess";
import { storagePut } from "./storage";

const dateValue = z.union([z.string().datetime(), z.null()]);
const manifestSchema = z.object({
  sourceSystem: z.literal("kgday-manus"),
  sourceEventId: z.string().min(1).max(120),
  migrationKey: z.string().min(8).max(160),
  event: z.object({
    slug: z.string().min(2).max(120), title: z.string().min(2).max(255), shortName: z.string().min(1).max(120), timezone: z.literal("Asia/Tokyo"),
    eventStartAt: z.string().datetime(), eventEndAt: z.string().datetime(), registrationOpenAt: dateValue, registrationCloseAt: dateValue,
    minimumStreamMinutes: z.number().int().min(1).max(1440), status: z.enum(["draft", "registration", "active", "closed", "archived"]),
    legacyBaseUrl: z.string().url(), theme: z.record(z.string(), z.unknown()), rules: z.record(z.string(), z.unknown()),
  }),
  entries: z.array(z.object({ sourceEntryId: z.number().int().positive(), registrationName: z.string(), tiktokId: z.string(), tiktokName: z.string(), lineId: z.string(), phone: z.string(), email: z.string().email(), dashboardPasswordHash: z.string().min(20), status: z.enum(["pending", "approved", "suspended"]), createdAt: z.string().datetime(), updatedAt: z.string().datetime() })),
  accounts: z.array(z.object({ sourceAccountId: z.number().int().positive(), sourceEntryId: z.number().int().positive().nullable(), tiktokId: z.string(), tiktokName: z.string(), passwordHash: z.string().min(20), status: z.enum(["active", "suspended"]), lastSignedInAt: dateValue, createdAt: z.string().datetime(), updatedAt: z.string().datetime() })),
  performances: z.array(z.object({
    sourcePerformanceId: z.number().int().positive(), sourceAccountId: z.number().int().positive(), dayNumber: z.number().int().min(1).max(31), sessionNumber: z.number().int().min(1), streamDate: z.string().datetime(), startedAt: dateValue, endedAt: dateValue,
    streamMinutes: z.number().int().min(0), totalGmv: z.number().int().min(0), brandGmv: z.number().int().min(0), screenshotHash: z.string().length(64).nullable(), screenshotMimeType: z.string().nullable(), screenshotDownloadUrl: z.string().url().nullable(),
    aiStatus: z.enum(["idle", "processing", "completed", "failed"]), aiModel: z.string().nullable(), aiReport: z.record(z.string(), z.unknown()).nullable(), status: z.enum(["draft", "submitted", "reviewed", "reflected"]),
    reviewDecision: z.enum(["pending", "approved", "force_approved", "rejected"]).nullable(), reviewReason: z.string().nullable(), forceIncludeOutsideWindow: z.boolean(), reviewedAt: dateValue, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  })),
  products: z.array(z.object({ sourceProductId: z.number().int().positive(), sourcePerformanceId: z.number().int().positive(), productName: z.string(), gmv: z.number().int().min(0), brandGmv: z.number().int().min(0), isBrandProduct: z.boolean(), selected: z.boolean(), confidenceBasisPoints: z.number().int().min(0).max(10_000), createdAt: z.string().datetime(), updatedAt: z.string().datetime() })),
  audits: z.array(z.object({ sourceAuditId: z.number().int().positive(), sourceAccountId: z.number().int().positive().nullable(), action: z.string(), entityType: z.string(), sourceEntityId: z.number().int().positive().nullable(), detail: z.record(z.string(), z.unknown()).nullable(), createdAt: z.string().datetime() })),
});

export type BrandDayMigrationManifest = z.infer<typeof manifestSchema>;

function manifestHash(manifest: BrandDayMigrationManifest) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

function expectedCounts(manifest: BrandDayMigrationManifest) {
  return { entries: manifest.entries.length, accounts: manifest.accounts.length, performances: manifest.performances.length, products: manifest.products.length, audits: manifest.audits.length, screenshots: manifest.performances.filter(row => row.screenshotDownloadUrl).length };
}

function parseOptionalJson(value: unknown) {
  if (!value) return null;
  return JSON.stringify(value);
}

function sqlDate(value: string | null) {
  return value ? new Date(value) : null;
}

async function copyScreenshots(manifest: BrandDayMigrationManifest) {
  const copied = new Map<number, { key: string; hash: string; mimeType: string }>();
  const queue = manifest.performances.filter(row => row.screenshotDownloadUrl && row.screenshotHash);
  let index = 0;
  const worker = async () => {
    while (index < queue.length) {
      const row = queue[index++];
      const response = await fetch(row.screenshotDownloadUrl!, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`SCREENSHOT_DOWNLOAD_FAILED:${row.sourcePerformanceId}:${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error(`SCREENSHOT_SIZE_INVALID:${row.sourcePerformanceId}`);
      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== row.screenshotHash) throw new Error(`SCREENSHOT_HASH_MISMATCH:${row.sourcePerformanceId}`);
      const mimeType = row.screenshotMimeType || response.headers.get("content-type") || "image/png";
      const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
      const stored = await storagePut(`brand-days/${manifest.event.slug}/migration/performance-${row.sourcePerformanceId}-${actualHash.slice(0, 16)}.${extension}`, bytes, mimeType);
      copied.set(row.sourcePerformanceId, { key: stored.key, hash: actualHash, mimeType });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, queue.length || 1) }, () => worker()));
  return copied;
}

async function targetCounts(pool: any, eventId: number) {
  const names = ["entries", "creator_accounts", "performances", "performance_products", "audit_logs"];
  const result: Record<string, number> = {};
  for (const name of names) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM brand_day_${name} WHERE event_id = ? AND source_system = 'kgday-manus'`, [eventId]);
    result[name === "creator_accounts" ? "accounts" : name === "performance_products" ? "products" : name === "audit_logs" ? "audits" : name] = Number((rows as any[])[0]?.total || 0);
  }
  const [screens] = await pool.query("SELECT COUNT(*) AS total FROM brand_day_performances WHERE event_id = ? AND source_system = 'kgday-manus' AND screenshot_key IS NOT NULL", [eventId]);
  result.screenshots = Number((screens as any[])[0]?.total || 0);
  return result;
}

export const brandDayMigrationRouter = router({
  preview: protectedProcedure.input(z.object({ manifest: manifestSchema, manifestSha256: z.string().length(64) })).mutation(async ({ ctx, input }) => {
    await requireBrandDayPermission(ctx, "edit");
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "データ移行は管理者のみ実行できます。" });
    const actualHash = manifestHash(input.manifest);
    if (actualHash !== input.manifestSha256) throw new TRPCError({ code: "BAD_REQUEST", message: "移行ファイルのハッシュが一致しません。" });
    const counts = expectedCounts(input.manifest);
    const missingScreenshots = input.manifest.performances.filter(row => row.screenshotHash && !row.screenshotDownloadUrl).map(row => row.sourcePerformanceId);
    const accountIds = new Set(input.manifest.accounts.map(row => row.sourceAccountId));
    const performanceIds = new Set(input.manifest.performances.map(row => row.sourcePerformanceId));
    const brokenAccounts = input.manifest.performances.filter(row => !accountIds.has(row.sourceAccountId)).map(row => row.sourcePerformanceId);
    const brokenProducts = input.manifest.products.filter(row => !performanceIds.has(row.sourcePerformanceId)).map(row => row.sourceProductId);
    return { valid: missingScreenshots.length === 0 && brokenAccounts.length === 0 && brokenProducts.length === 0, counts, missingScreenshots, brokenAccounts, brokenProducts, manifestSha256: actualHash };
  }),

  run: protectedProcedure.input(z.object({ manifest: manifestSchema, manifestSha256: z.string().length(64), brandId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
    await requireBrandDayPermission(ctx, "edit");
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "データ移行は管理者のみ実行できます。" });
    const actualHash = manifestHash(input.manifest);
    if (actualHash !== input.manifestSha256) throw new TRPCError({ code: "BAD_REQUEST", message: "移行ファイルのハッシュが一致しません。" });
    const sourceCounts = expectedCounts(input.manifest);
    if (sourceCounts.screenshots !== input.manifest.performances.filter(row => row.screenshotHash).length) throw new TRPCError({ code: "BAD_REQUEST", message: "原画像URLが不足しています。" });
    const pool = await getBrandDayPool();
    const [existingRuns] = await pool.query("SELECT id, event_id AS eventId, status, manifest_sha256 AS manifestSha256, target_counts AS targetCounts FROM brand_day_migration_runs WHERE source_system = ? AND migration_key = ? LIMIT 1", [input.manifest.sourceSystem, input.manifest.migrationKey]);
    const existing = (existingRuns as any[])[0];
    if (existing?.status === "completed") {
      if (existing.manifestSha256 !== actualHash) throw new TRPCError({ code: "CONFLICT", message: "同じ移行キーに異なるファイルが使用されています。" });
      return { idempotent: true, eventId: Number(existing.eventId), sourceCounts, targetCounts: typeof existing.targetCounts === "string" ? JSON.parse(existing.targetCounts) : existing.targetCounts };
    }
    const [runResult] = await pool.query(
      `INSERT INTO brand_day_migration_runs (source_system, migration_key, status, source_counts, manifest_sha256, started_by)
       VALUES (?, ?, 'running', ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), status = 'running', source_counts = VALUES(source_counts), manifest_sha256 = VALUES(manifest_sha256), error_summary = NULL, started_by = VALUES(started_by)`,
      [input.manifest.sourceSystem, input.manifest.migrationKey, JSON.stringify(sourceCounts), actualHash, ctx.user.id],
    );
    const runId = Number((runResult as any).insertId);
    try {
      const copiedScreenshots = await copyScreenshots(input.manifest);
      const connection = await pool.getConnection();
      let eventId = 0;
      try {
        await connection.beginTransaction();
        const event = input.manifest.event;
        const [eventResult] = await connection.query(
          `INSERT INTO brand_day_events
            (brand_id, slug, title, short_name, timezone, event_start_at, event_end_at, registration_open_at, registration_close_at, minimum_stream_minutes, status, theme_json, rules_json, source_system, source_event_id, legacy_base_url, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), brand_id = VALUES(brand_id), title = VALUES(title), short_name = VALUES(short_name), timezone = VALUES(timezone), event_start_at = VALUES(event_start_at), event_end_at = VALUES(event_end_at), registration_open_at = VALUES(registration_open_at), registration_close_at = VALUES(registration_close_at), minimum_stream_minutes = VALUES(minimum_stream_minutes), status = VALUES(status), theme_json = VALUES(theme_json), rules_json = VALUES(rules_json), legacy_base_url = VALUES(legacy_base_url)`,
          [input.brandId || null, event.slug, event.title, event.shortName, event.timezone, sqlDate(event.eventStartAt), sqlDate(event.eventEndAt), sqlDate(event.registrationOpenAt), sqlDate(event.registrationCloseAt), event.minimumStreamMinutes, event.status, JSON.stringify(event.theme), JSON.stringify(event.rules), input.manifest.sourceSystem, input.manifest.sourceEventId, event.legacyBaseUrl, ctx.user.id],
        );
        eventId = Number((eventResult as any).insertId);
        const entryMap = new Map<number, number>();
        for (const row of input.manifest.entries) {
          const [result] = await connection.query(
            `INSERT INTO brand_day_entries
              (event_id, registration_name, tiktok_id, tiktok_name, line_id, phone, email, dashboard_password_hash, status, source_system, source_entry_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), registration_name = VALUES(registration_name), tiktok_name = VALUES(tiktok_name), line_id = VALUES(line_id), phone = VALUES(phone), email = VALUES(email), dashboard_password_hash = VALUES(dashboard_password_hash), status = VALUES(status), updated_at = VALUES(updated_at)`,
            [eventId, row.registrationName, row.tiktokId, row.tiktokName, row.lineId, row.phone, row.email, row.dashboardPasswordHash, row.status, input.manifest.sourceSystem, row.sourceEntryId, sqlDate(row.createdAt), sqlDate(row.updatedAt)],
          );
          entryMap.set(row.sourceEntryId, Number((result as any).insertId));
        }
        const accountMap = new Map<number, number>();
        for (const row of input.manifest.accounts) {
          const [result] = await connection.query(
            `INSERT INTO brand_day_creator_accounts
              (event_id, entry_id, tiktok_id, tiktok_name, password_hash, status, source_system, source_account_id, last_signed_in_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), entry_id = VALUES(entry_id), tiktok_name = VALUES(tiktok_name), password_hash = VALUES(password_hash), status = VALUES(status), last_signed_in_at = VALUES(last_signed_in_at), updated_at = VALUES(updated_at)`,
            [eventId, row.sourceEntryId ? entryMap.get(row.sourceEntryId) || null : null, row.tiktokId, row.tiktokName, row.passwordHash, row.status, input.manifest.sourceSystem, row.sourceAccountId, sqlDate(row.lastSignedInAt), sqlDate(row.createdAt), sqlDate(row.updatedAt)],
          );
          accountMap.set(row.sourceAccountId, Number((result as any).insertId));
        }
        const performanceMap = new Map<number, number>();
        for (const row of input.manifest.performances) {
          const copied = copiedScreenshots.get(row.sourcePerformanceId);
          const [result] = await connection.query(
            `INSERT INTO brand_day_performances
              (event_id, creator_account_id, day_number, session_number, stream_date, started_at, ended_at, stream_minutes, total_gmv, brand_gmv, screenshot_key, screenshot_url, screenshot_hash, screenshot_mime_type, ai_status, ai_model, ai_report, status, review_decision, review_reason, force_include_outside_window, reviewed_at, source_system, source_performance_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), creator_account_id = VALUES(creator_account_id), day_number = VALUES(day_number), session_number = VALUES(session_number), stream_date = VALUES(stream_date), started_at = VALUES(started_at), ended_at = VALUES(ended_at), stream_minutes = VALUES(stream_minutes), total_gmv = VALUES(total_gmv), brand_gmv = VALUES(brand_gmv), screenshot_key = VALUES(screenshot_key), screenshot_hash = VALUES(screenshot_hash), screenshot_mime_type = VALUES(screenshot_mime_type), ai_status = VALUES(ai_status), ai_model = VALUES(ai_model), ai_report = VALUES(ai_report), status = VALUES(status), review_decision = VALUES(review_decision), review_reason = VALUES(review_reason), force_include_outside_window = VALUES(force_include_outside_window), reviewed_at = VALUES(reviewed_at), updated_at = VALUES(updated_at)`,
            [eventId, accountMap.get(row.sourceAccountId), row.dayNumber, row.sessionNumber, sqlDate(row.streamDate), sqlDate(row.startedAt), sqlDate(row.endedAt), row.streamMinutes, row.totalGmv, row.brandGmv, copied?.key || null, copied?.hash || row.screenshotHash, copied?.mimeType || row.screenshotMimeType, row.aiStatus, row.aiModel, parseOptionalJson(row.aiReport), row.status, row.reviewDecision, row.reviewReason, row.forceIncludeOutsideWindow ? 1 : 0, sqlDate(row.reviewedAt), input.manifest.sourceSystem, row.sourcePerformanceId, sqlDate(row.createdAt), sqlDate(row.updatedAt)],
          );
          performanceMap.set(row.sourcePerformanceId, Number((result as any).insertId));
        }
        for (const row of input.manifest.products) {
          await connection.query(
            `INSERT INTO brand_day_performance_products
              (event_id, performance_id, product_name, gmv, brand_gmv, is_brand_product, selected, confidence_basis_points, source_system, source_product_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE performance_id = VALUES(performance_id), product_name = VALUES(product_name), gmv = VALUES(gmv), brand_gmv = VALUES(brand_gmv), is_brand_product = VALUES(is_brand_product), selected = VALUES(selected), confidence_basis_points = VALUES(confidence_basis_points), updated_at = VALUES(updated_at)`,
            [eventId, performanceMap.get(row.sourcePerformanceId), row.productName, row.gmv, row.brandGmv, row.isBrandProduct ? 1 : 0, row.selected ? 1 : 0, row.confidenceBasisPoints, input.manifest.sourceSystem, row.sourceProductId, sqlDate(row.createdAt), sqlDate(row.updatedAt)],
          );
        }
        for (const row of input.manifest.audits) {
          const mappedEntityId = row.entityType.includes("performance") && row.sourceEntityId ? performanceMap.get(row.sourceEntityId) || null : row.entityType.includes("account") && row.sourceEntityId ? accountMap.get(row.sourceEntityId) || null : row.sourceEntityId;
          await connection.query(
            `INSERT INTO brand_day_audit_logs
              (event_id, creator_account_id, actor_name, actor_type, action, entity_type, entity_id, detail, source_system, source_audit_id, created_at)
             VALUES (?, ?, ?, 'migration', ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE creator_account_id = VALUES(creator_account_id), action = VALUES(action), entity_type = VALUES(entity_type), entity_id = VALUES(entity_id), detail = VALUES(detail)`,
            [eventId, row.sourceAccountId ? accountMap.get(row.sourceAccountId) || null : null, "KGDAY legacy migration", row.action, row.entityType, mappedEntityId, parseOptionalJson(row.detail), input.manifest.sourceSystem, row.sourceAuditId, sqlDate(row.createdAt)],
          );
        }
        await connection.query("UPDATE brand_day_migration_runs SET event_id = ? WHERE id = ?", [eventId, runId]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      const counts = await targetCounts(pool, eventId);
      const comparableTarget = { entries: counts.entries, accounts: counts.accounts, performances: counts.performances, products: counts.products, audits: counts.audits, screenshots: counts.screenshots };
      const mismatch = Object.keys(sourceCounts).some(key => sourceCounts[key as keyof typeof sourceCounts] !== comparableTarget[key as keyof typeof comparableTarget]);
      if (mismatch) throw new Error(`MIGRATION_COUNT_MISMATCH:${JSON.stringify({ sourceCounts, targetCounts: comparableTarget })}`);
      await pool.query("UPDATE brand_day_migration_runs SET status = 'completed', target_counts = ?, completed_at = NOW() WHERE id = ?", [JSON.stringify(comparableTarget), runId]);
      return { idempotent: false, eventId, sourceCounts, targetCounts: comparableTarget };
    } catch (error) {
      const summary = error instanceof Error ? error.message.slice(0, 2000) : "UNKNOWN_MIGRATION_ERROR";
      await pool.query("UPDATE brand_day_migration_runs SET status = 'failed', error_summary = ? WHERE id = ?", [summary, runId]);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `移行に失敗しました: ${summary}` });
    }
  }),
});
