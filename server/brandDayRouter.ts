import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getBrandDayPool } from "./brandDayPool";
import { BRAND_DAY_PAGE_KEY, requireBrandDayPermission } from "./brandDayAccess";
import { brandDayCreatorRouter, brandDayPublicRouter } from "./brandDayPublicRouter";
import { brandDayMigrationRouter } from "./brandDayMigrationRouter";
import { assessBrandDayPerformanceTime } from "./brandDayTime";
import { storageGet } from "./storage";

const getPool = getBrandDayPool;

function rowArray(result: unknown): any[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as any[];
  if (Array.isArray(result)) return result as any[];
  return [];
}

export { BRAND_DAY_PAGE_KEY, requireBrandDayPermission } from "./brandDayAccess";

function actorFromContext(ctx: any) {
  return {
    id: Number(ctx?.user?.id || 0) || null,
    name: String(ctx?.user?.name || ctx?.user?.email || "LCJ staff").slice(0, 255),
    type: ctx?.user?.role === "admin" ? "admin" : "staff",
  } as const;
}

async function writeAudit(
  connection: any,
  ctx: any,
  input: {
    eventId: number;
    action: string;
    entityType: string;
    entityId?: number | null;
    detail?: Record<string, unknown> | null;
  },
) {
  const actor = actorFromContext(ctx);
  await connection.query(
    `INSERT INTO brand_day_audit_logs
      (event_id, actor_user_id, actor_name, actor_type, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.eventId,
      actor.id,
      actor.name,
      actor.type,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
}

async function reviewScreenshotUrl(key: string | null, storedUrl: string | null) {
  if (!key) return storedUrl;
  try {
    return (await storageGet(key)).url;
  } catch {
    return storedUrl;
  }
}

const eventStatus = z.enum(["draft", "registration", "active", "closed", "archived"]);
const eventInput = z.object({
  brandId: z.number().int().positive().nullable().optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(255),
  shortName: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(3).max(64).default("Asia/Tokyo"),
  eventStartAt: z.number().int().positive(),
  eventEndAt: z.number().int().positive(),
  registrationOpenAt: z.number().int().positive().nullable().optional(),
  registrationCloseAt: z.number().int().positive().nullable().optional(),
  minimumStreamMinutes: z.number().int().min(1).max(1440).default(60),
  status: eventStatus.default("draft"),
  legacyBaseUrl: z.string().url().max(500).nullable().optional(),
  theme: z.record(z.string(), z.unknown()).nullable().optional(),
  rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export function validateBrandDayWindow(input: {
  eventStartAt: number;
  eventEndAt: number;
  registrationOpenAt?: number | null;
  registrationCloseAt?: number | null;
}) {
  if (input.eventEndAt <= input.eventStartAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "終了日時は開始日時より後にしてください / 结束时间必须晚于开始时间",
    });
  }
  if (
    input.registrationOpenAt &&
    input.registrationCloseAt &&
    input.registrationCloseAt <= input.registrationOpenAt
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "申込終了日時は開始日時より後にしてください / 报名结束时间必须晚于开始时间",
    });
  }
}

export const brandDayRouter = router({
  publicPortal: brandDayPublicRouter,
  creatorPortal: brandDayCreatorRouter,
  migration: brandDayMigrationRouter,
  health: protectedProcedure.query(async ({ ctx }) => {
    await requireBrandDayPermission(ctx, "view");
    const pool = await getPool();
    const requiredTables = [
      "brand_day_events",
      "brand_day_entries",
      "brand_day_creator_accounts",
      "brand_day_creator_sessions",
      "brand_day_performances",
      "brand_day_performance_products",
      "brand_day_audit_logs",
      "brand_day_migration_runs",
    ];
    const [rows] = await pool.query(
      `SELECT table_name AS tableName
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (${requiredTables.map(() => "?").join(",")})`,
      requiredTables,
    );
    const existing = new Set((rows as any[]).map(row => String(row.tableName)));
    return {
      healthy: requiredTables.every(name => existing.has(name)),
      requiredTableCount: requiredTables.length,
      existingTableCount: existing.size,
      pageKey: BRAND_DAY_PAGE_KEY,
    };
  }),

  listEvents: protectedProcedure
    .input(z.object({
      search: z.string().trim().max(120).optional(),
      status: eventStatus.optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const conditions = ["1=1"];
      const params: unknown[] = [];
      if (input?.status) {
        conditions.push("e.status = ?");
        params.push(input.status);
      }
      if (input?.search) {
        conditions.push("(e.title LIKE ? OR e.short_name LIKE ? OR e.slug LIKE ? OR b.name LIKE ? OR b.nameJa LIKE ?)");
        const term = `%${input.search}%`;
        params.push(term, term, term, term, term);
      }
      const [rows] = await pool.query(
        `SELECT e.id, e.brand_id AS brandId, e.slug, e.title, e.short_name AS shortName,
                e.timezone, e.event_start_at AS eventStartAt, e.event_end_at AS eventEndAt,
                e.registration_open_at AS registrationOpenAt,
                e.registration_close_at AS registrationCloseAt,
                e.minimum_stream_minutes AS minimumStreamMinutes, e.status,
                e.logo_url AS logoUrl, e.theme_json AS theme, e.rules_json AS rules,
                e.legacy_base_url AS legacyBaseUrl, e.created_at AS createdAt, e.updated_at AS updatedAt,
                COALESCE(b.nameJa, b.name, e.short_name) AS brandName,
                (SELECT COUNT(*) FROM brand_day_entries en WHERE en.event_id = e.id) AS entryCount,
                (SELECT COUNT(*) FROM brand_day_creator_accounts ca WHERE ca.event_id = e.id) AS accountCount,
                (SELECT COUNT(*) FROM brand_day_performances p WHERE p.event_id = e.id) AS performanceCount,
                (SELECT COUNT(*) FROM brand_day_performances p WHERE p.event_id = e.id AND p.status = 'reviewed' AND p.review_decision = 'pending') AS pendingReviewCount,
                (SELECT COALESCE(SUM(p.brand_gmv), 0) FROM brand_day_performances p WHERE p.event_id = e.id AND p.status = 'reflected') AS reflectedBrandGmv
           FROM brand_day_events e
           LEFT JOIN brands b ON b.id = e.brand_id AND b.deletedAt IS NULL
          WHERE ${conditions.join(" AND ")}
          ORDER BY e.event_start_at DESC, e.id DESC`,
        params,
      );
      return (rows as any[]).map(row => ({
        ...row,
        entryCount: Number(row.entryCount || 0),
        accountCount: Number(row.accountCount || 0),
        performanceCount: Number(row.performanceCount || 0),
        pendingReviewCount: Number(row.pendingReviewCount || 0),
        reflectedBrandGmv: Number(row.reflectedBrandGmv || 0),
      }));
    }),

  getEvent: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const [events] = await pool.query(
        `SELECT e.*, COALESCE(b.nameJa, b.name, e.short_name) AS brandName,
                b.logoUrl AS brandLogoUrl
           FROM brand_day_events e
           LEFT JOIN brands b ON b.id = e.brand_id AND b.deletedAt IS NULL
          WHERE e.id = ? LIMIT 1`,
        [input.eventId],
      );
      const event = (events as any[])[0];
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドデーが見つかりません" });
      const [counts] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM brand_day_entries WHERE event_id = ?) AS entryCount,
           (SELECT COUNT(*) FROM brand_day_creator_accounts WHERE event_id = ?) AS accountCount,
           (SELECT COUNT(*) FROM brand_day_performances WHERE event_id = ?) AS performanceCount,
           (SELECT COUNT(*) FROM brand_day_performances WHERE event_id = ? AND status = 'reviewed' AND review_decision = 'pending') AS pendingReviewCount,
           (SELECT COALESCE(SUM(brand_gmv),0) FROM brand_day_performances WHERE event_id = ? AND status = 'reflected') AS reflectedBrandGmv,
           (SELECT COALESCE(SUM(stream_minutes),0) FROM brand_day_performances WHERE event_id = ? AND status = 'reflected') AS reflectedMinutes`,
        [input.eventId, input.eventId, input.eventId, input.eventId, input.eventId, input.eventId],
      );
      const count = (counts as any[])[0] || {};
      return {
        ...event,
        entryCount: Number(count.entryCount || 0),
        accountCount: Number(count.accountCount || 0),
        performanceCount: Number(count.performanceCount || 0),
        pendingReviewCount: Number(count.pendingReviewCount || 0),
        reflectedBrandGmv: Number(count.reflectedBrandGmv || 0),
        reflectedMinutes: Number(count.reflectedMinutes || 0),
      };
    }),

  createEvent: protectedProcedure
    .input(eventInput)
    .mutation(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "edit");
      validateBrandDayWindow(input);
      const pool = await getPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO brand_day_events
            (brand_id, slug, title, short_name, timezone, event_start_at, event_end_at,
             registration_open_at, registration_close_at, minimum_stream_minutes, status,
             legacy_base_url, theme_json, rules_json, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.brandId ?? null,
            input.slug,
            input.title,
            input.shortName,
            input.timezone,
            new Date(input.eventStartAt),
            new Date(input.eventEndAt),
            input.registrationOpenAt ? new Date(input.registrationOpenAt) : null,
            input.registrationCloseAt ? new Date(input.registrationCloseAt) : null,
            input.minimumStreamMinutes,
            input.status,
            input.legacyBaseUrl ?? null,
            input.theme ? JSON.stringify(input.theme) : null,
            input.rules ? JSON.stringify(input.rules) : null,
            ctx.user.id,
          ],
        );
        const eventId = Number((result as any).insertId);
        await writeAudit(connection, ctx, {
          eventId,
          action: "event_created",
          entityType: "event",
          entityId: eventId,
          detail: { slug: input.slug, status: input.status },
        });
        await connection.commit();
        return { success: true, eventId };
      } catch (error: any) {
        await connection.rollback();
        if (String(error?.code || "").includes("DUP")) {
          throw new TRPCError({ code: "CONFLICT", message: "同じslugのブランドデーが既にあります" });
        }
        throw error;
      } finally {
        connection.release();
      }
    }),

  updateEvent: protectedProcedure
    .input(eventInput.partial().extend({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "edit");
      const pool = await getPool();
      const [rows] = await pool.query("SELECT * FROM brand_day_events WHERE id = ? LIMIT 1", [input.eventId]);
      const before = (rows as any[])[0];
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドデーが見つかりません" });
      const startMs = input.eventStartAt ?? new Date(before.event_start_at).getTime();
      const endMs = input.eventEndAt ?? new Date(before.event_end_at).getTime();
      validateBrandDayWindow({
        eventStartAt: startMs,
        eventEndAt: endMs,
        registrationOpenAt: input.registrationOpenAt ?? (before.registration_open_at ? new Date(before.registration_open_at).getTime() : null),
        registrationCloseAt: input.registrationCloseAt ?? (before.registration_close_at ? new Date(before.registration_close_at).getTime() : null),
      });
      const fields: string[] = [];
      const values: unknown[] = [];
      const mapping: Array<[keyof typeof input, string, (value: any) => any]> = [
        ["brandId", "brand_id", value => value ?? null],
        ["slug", "slug", value => value],
        ["title", "title", value => value],
        ["shortName", "short_name", value => value],
        ["timezone", "timezone", value => value],
        ["eventStartAt", "event_start_at", value => new Date(value)],
        ["eventEndAt", "event_end_at", value => new Date(value)],
        ["registrationOpenAt", "registration_open_at", value => value ? new Date(value) : null],
        ["registrationCloseAt", "registration_close_at", value => value ? new Date(value) : null],
        ["minimumStreamMinutes", "minimum_stream_minutes", value => value],
        ["status", "status", value => value],
        ["legacyBaseUrl", "legacy_base_url", value => value ?? null],
        ["theme", "theme_json", value => value ? JSON.stringify(value) : null],
        ["rules", "rules_json", value => value ? JSON.stringify(value) : null],
      ];
      for (const [key, column, serialize] of mapping) {
        if (input[key] !== undefined) {
          fields.push(`${column} = ?`);
          values.push(serialize(input[key]));
        }
      }
      if (fields.length === 0) return { success: true, eventId: input.eventId };
      values.push(input.eventId);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(`UPDATE brand_day_events SET ${fields.join(", ")} WHERE id = ?`, values);
        await writeAudit(connection, ctx, {
          eventId: input.eventId,
          action: "event_updated",
          entityType: "event",
          entityId: input.eventId,
          detail: { changedFields: fields.map(field => field.split(" = ")[0]) },
        });
        await connection.commit();
        return { success: true, eventId: input.eventId };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  listBrands: protectedProcedure.query(async ({ ctx }) => {
    await requireBrandDayPermission(ctx, "view");
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT id, name, nameJa, logoUrl
         FROM brands
        WHERE deletedAt IS NULL
        ORDER BY COALESCE(nameJa, name)`,
    );
    return rows as any[];
  }),

  listEntries: protectedProcedure
    .input(z.object({
      eventId: z.number().int().positive(),
      search: z.string().trim().max(160).optional(),
      status: z.enum(["pending", "approved", "suspended"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const conditions = ["event_id = ?"];
      const params: unknown[] = [input.eventId];
      if (input.status) {
        conditions.push("status = ?");
        params.push(input.status);
      }
      if (input.search) {
        conditions.push("(registration_name LIKE ? OR tiktok_id LIKE ? OR tiktok_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
        const term = `%${input.search}%`;
        params.push(term, term, term, term, term);
      }
      const [rows] = await pool.query(
        `SELECT id, event_id AS eventId, registration_name AS registrationName,
                tiktok_id AS tiktokId, tiktok_name AS tiktokName, line_id AS lineId,
                phone, email, status, source_system AS sourceSystem,
                source_entry_id AS sourceEntryId, created_at AS createdAt, updated_at AS updatedAt
           FROM brand_day_entries
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC, id DESC`,
        params,
      );
      return rows as any[];
    }),

  listAccounts: protectedProcedure
    .input(z.object({
      eventId: z.number().int().positive(),
      search: z.string().trim().max(160).optional(),
      status: z.enum(["active", "suspended"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const conditions = ["a.event_id = ?"];
      const params: unknown[] = [input.eventId];
      if (input.status) {
        conditions.push("a.status = ?");
        params.push(input.status);
      }
      if (input.search) {
        conditions.push("(a.tiktok_id LIKE ? OR a.tiktok_name LIKE ? OR en.registration_name LIKE ? OR en.email LIKE ?)");
        const term = `%${input.search}%`;
        params.push(term, term, term, term);
      }
      const [rows] = await pool.query(
        `SELECT a.id, a.event_id AS eventId, a.entry_id AS entryId,
                a.tiktok_id AS tiktokId, a.tiktok_name AS tiktokName, a.status,
                a.source_system AS sourceSystem, a.source_account_id AS sourceAccountId,
                a.last_signed_in_at AS lastSignedInAt, a.created_at AS createdAt,
                en.registration_name AS registrationName, en.email, en.phone,
                COUNT(DISTINCT p.id) AS performanceCount,
                COALESCE(SUM(CASE WHEN p.status = 'reflected' THEN p.brand_gmv ELSE 0 END),0) AS reflectedBrandGmv
           FROM brand_day_creator_accounts a
           LEFT JOIN brand_day_entries en ON en.id = a.entry_id
           LEFT JOIN brand_day_performances p ON p.creator_account_id = a.id
          WHERE ${conditions.join(" AND ")}
          GROUP BY a.id, en.registration_name, en.email, en.phone
          ORDER BY a.created_at DESC, a.id DESC`,
        params,
      );
      return (rows as any[]).map(row => ({
        ...row,
        performanceCount: Number(row.performanceCount || 0),
        reflectedBrandGmv: Number(row.reflectedBrandGmv || 0),
      }));
    }),

  listPerformances: protectedProcedure
    .input(z.object({
      eventId: z.number().int().positive(),
      dayNumber: z.number().int().min(1).max(31).optional(),
      reviewOnly: z.boolean().default(false),
      search: z.string().trim().max(160).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const conditions = ["p.event_id = ?"];
      const params: unknown[] = [input.eventId];
      if (input.dayNumber) {
        conditions.push("p.day_number = ?");
        params.push(input.dayNumber);
      }
      if (input.reviewOnly) {
        conditions.push("p.status = 'reviewed' AND p.review_decision = 'pending'");
      }
      if (input.search) {
        conditions.push("(a.tiktok_id LIKE ? OR a.tiktok_name LIKE ?)");
        const term = `%${input.search}%`;
        params.push(term, term);
      }
      const [rows] = await pool.query(
        `SELECT p.id, p.event_id AS eventId, p.creator_account_id AS creatorAccountId,
                p.day_number AS dayNumber, p.session_number AS sessionNumber,
                p.stream_date AS streamDate, p.started_at AS startedAt, p.ended_at AS endedAt,
                p.stream_minutes AS streamMinutes, p.total_gmv AS totalGmv, p.brand_gmv AS brandGmv,
                p.screenshot_key AS screenshotKey, p.screenshot_url AS screenshotUrl,
                p.screenshot_hash AS screenshotHash, p.ai_status AS aiStatus,
                p.ai_model AS aiModel, p.ai_report AS aiReport, p.status,
                p.review_decision AS reviewDecision, p.review_reason AS reviewReason,
                p.force_include_outside_window AS forceIncludeOutsideWindow,
                p.reviewed_by AS reviewedBy, p.reviewed_at AS reviewedAt,
                p.source_system AS sourceSystem, p.source_performance_id AS sourcePerformanceId,
                p.created_at AS createdAt, p.updated_at AS updatedAt,
                a.tiktok_id AS tiktokId, a.tiktok_name AS tiktokName,
                COUNT(prod.id) AS productCount,
                SUM(CASE WHEN prod.selected = 1 AND prod.is_brand_product = 1 THEN 1 ELSE 0 END) AS selectedBrandProductCount
           FROM brand_day_performances p
           JOIN brand_day_creator_accounts a ON a.id = p.creator_account_id
           LEFT JOIN brand_day_performance_products prod ON prod.performance_id = p.id
          WHERE ${conditions.join(" AND ")}
          GROUP BY p.id, a.tiktok_id, a.tiktok_name
          ORDER BY p.day_number DESC, p.session_number DESC, p.id DESC`,
        params,
      );
      const performances = rows as any[];
      if (performances.length === 0) return [];
      const ids = performances.map(row => Number(row.id));
      const [productRows] = await pool.query(
        `SELECT id, performance_id AS performanceId, product_name AS productName,
                gmv, brand_gmv AS brandGmv, is_brand_product AS isBrandProduct,
                selected, confidence_basis_points AS confidenceBasisPoints
           FROM brand_day_performance_products
          WHERE performance_id IN (${ids.map(() => "?").join(",")})
          ORDER BY performance_id, id`,
        ids,
      );
      const byPerformance = new Map<number, any[]>();
      for (const product of productRows as any[]) {
        const key = Number(product.performanceId);
        byPerformance.set(key, [...(byPerformance.get(key) || []), {
          ...product,
          gmv: Number(product.gmv || 0),
          brandGmv: Number(product.brandGmv || 0),
          isBrandProduct: Boolean(product.isBrandProduct),
          selected: Boolean(product.selected),
        }]);
      }
      return Promise.all(performances.map(async row => {
        const { screenshotKey, ...safeRow } = row;
        return {
          ...safeRow,
          streamMinutes: Number(row.streamMinutes || 0),
          totalGmv: Number(row.totalGmv || 0),
          brandGmv: Number(row.brandGmv || 0),
          screenshotUrl: await reviewScreenshotUrl(screenshotKey, row.screenshotUrl),
          productCount: Number(row.productCount || 0),
          selectedBrandProductCount: Number(row.selectedBrandProductCount || 0),
          forceIncludeOutsideWindow: Boolean(row.forceIncludeOutsideWindow),
          products: byPerformance.get(Number(row.id)) || [],
        };
      }));
    }),

  reviewPerformance: protectedProcedure
    .input(z.object({
      eventId: z.number().int().positive(),
      performanceId: z.number().int().positive(),
      decision: z.enum(["approve", "force_approve", "reject"]),
      reason: z.string().trim().max(1000).optional(),
      startedAt: z.number().int().nullable().optional(),
      endedAt: z.number().int().nullable().optional(),
      streamMinutes: z.number().int().min(0).max(10_000).optional(),
      totalGmv: z.number().int().min(0).max(1_000_000_000).optional(),
      products: z.array(z.object({
        productName: z.string().trim().min(1).max(255),
        gmv: z.number().int().min(0).max(1_000_000_000),
        isBrandProduct: z.boolean(),
        selected: z.boolean().default(true),
        confidenceBasisPoints: z.number().int().min(0).max(10_000).default(0),
      })).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "edit");
      if (input.decision === "force_approve" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "対象期間外の強制承認は管理者のみ実行できます。" });
      }
      if ((input.decision === "force_approve" || input.decision === "reject") && !input.reason?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "強制承認または差し戻しには理由が必要です。" });
      }
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT p.*, e.event_start_at, e.event_end_at, e.timezone
           FROM brand_day_performances p
           JOIN brand_day_events e ON e.id = p.event_id
          WHERE p.id = ? AND p.event_id = ? LIMIT 1`,
        [input.performanceId, input.eventId],
      );
      const performance = (rows as any[])[0];
      if (!performance) throw new TRPCError({ code: "NOT_FOUND", message: "対象の配信実績が見つかりません。" });

      if (input.decision === "reject") {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE brand_day_performances
                SET status = 'reviewed', review_decision = 'rejected', review_reason = ?,
                    reviewed_by = ?, reviewed_at = NOW(), force_include_outside_window = 0, updated_at = NOW()
              WHERE id = ?`,
            [input.reason!.trim(), ctx.user.id, input.performanceId],
          );
          await writeAudit(connection, ctx, { eventId: input.eventId, action: "performance.rejected", entityType: "performance", entityId: input.performanceId, detail: { reason: input.reason!.trim() } });
          await connection.commit();
          return { success: true, outcome: "rejected" as const };
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }

      const startedAt = input.startedAt !== undefined
        ? (input.startedAt === null ? null : new Date(input.startedAt))
        : (performance.started_at ? new Date(performance.started_at) : null);
      const endedAt = input.endedAt !== undefined
        ? (input.endedAt === null ? null : new Date(input.endedAt))
        : (performance.ended_at ? new Date(performance.ended_at) : null);
      const assessment = assessBrandDayPerformanceTime(
        { eventStartAt: new Date(performance.event_start_at), eventEndAt: new Date(performance.event_end_at), timezone: performance.timezone },
        Number(performance.day_number),
        startedAt,
        endedAt,
      );
      const forceApprove = input.decision === "force_approve";
      if (!forceApprove && assessment.status !== "valid" && assessment.status !== "partial") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "通常承認には成績対象時間内の開始・終了日時が必要です。日時を修正するか、理由を入力して強制承認してください。" });
      }
      const nextProducts = input.products || null;
      let brandGmv = Number(performance.brand_gmv || 0);
      if (nextProducts) brandGmv = nextProducts.filter(product => product.selected && product.isBrandProduct).reduce((sum, product) => sum + product.gmv, 0);
      const approvedMinutes = forceApprove
        ? Math.max(0, input.streamMinutes ?? assessment.rawMinutes ?? Number(performance.stream_minutes || 0))
        : assessment.validMinutes;
      if (approvedMinutes <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "承認する配信時間を1分以上で入力してください。" });
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        if (nextProducts) {
          await connection.query("DELETE FROM brand_day_performance_products WHERE performance_id = ?", [input.performanceId]);
          for (const product of nextProducts) {
            await connection.query(
              `INSERT INTO brand_day_performance_products
                (event_id, performance_id, product_name, gmv, brand_gmv, is_brand_product, selected, confidence_basis_points)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [input.eventId, input.performanceId, product.productName, product.gmv, product.selected && product.isBrandProduct ? product.gmv : 0, product.isBrandProduct ? 1 : 0, product.selected ? 1 : 0, product.confidenceBasisPoints],
            );
          }
        }
        await connection.query(
          `UPDATE brand_day_performances
              SET stream_date = ?, started_at = ?, ended_at = ?, stream_minutes = ?, total_gmv = ?, brand_gmv = ?,
                  status = 'reflected', review_decision = ?, review_reason = ?, reviewed_by = ?, reviewed_at = NOW(),
                  force_include_outside_window = ?, updated_at = NOW()
            WHERE id = ?`,
          [assessment.effectiveStartedAt || startedAt || performance.stream_date, startedAt, endedAt, approvedMinutes, input.totalGmv ?? Number(performance.total_gmv || 0), brandGmv, forceApprove ? "force_approved" : "approved", input.reason?.trim() || null, ctx.user.id, forceApprove ? 1 : 0, input.performanceId],
        );
        await writeAudit(connection, ctx, {
          eventId: input.eventId,
          action: forceApprove ? "performance.force_approved" : "performance.approved",
          entityType: "performance",
          entityId: input.performanceId,
          detail: { reason: input.reason?.trim() || null, timeStatus: assessment.status, approvedMinutes, totalGmv: input.totalGmv ?? Number(performance.total_gmv || 0), brandGmv },
        });
        await connection.commit();
        return { success: true, outcome: forceApprove ? "force_approved" as const : "approved" as const, approvedMinutes, brandGmv };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  deletePerformance: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive(), performanceId: z.number().int().positive(), reason: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "成績削除は管理者のみ実行できます。" });
      const pool = await getPool();
      const [rows] = await pool.query("SELECT id, creator_account_id, day_number, session_number, screenshot_hash, total_gmv, brand_gmv, stream_minutes FROM brand_day_performances WHERE id = ? AND event_id = ? LIMIT 1", [input.performanceId, input.eventId]);
      const target = (rows as any[])[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "対象の配信実績が見つかりません。" });
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM brand_day_performance_products WHERE performance_id = ?", [input.performanceId]);
        await connection.query("DELETE FROM brand_day_performances WHERE id = ? AND event_id = ?", [input.performanceId, input.eventId]);
        await writeAudit(connection, ctx, {
          eventId: input.eventId,
          action: "performance.deleted",
          entityType: "performance",
          entityId: null,
          detail: {
            deletedPerformance: {
              sourceId: input.performanceId,
              creatorAccountId: Number(target.creator_account_id),
              dayNumber: Number(target.day_number),
              sessionNumber: Number(target.session_number),
              screenshotHashPrefix: target.screenshot_hash ? String(target.screenshot_hash).slice(0, 12) : null,
              totalGmv: Number(target.total_gmv || 0),
              brandGmv: Number(target.brand_gmv || 0),
              streamMinutes: Number(target.stream_minutes || 0),
            },
            reason: input.reason,
          },
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  leaderboard: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT a.id AS creatorAccountId, a.tiktok_id AS tiktokId, a.tiktok_name AS tiktokName,
                COUNT(p.id) AS performanceCount,
                COALESCE(SUM(p.brand_gmv),0) AS brandGmv,
                COALESCE(SUM(p.stream_minutes),0) AS streamMinutes
           FROM brand_day_creator_accounts a
           JOIN brand_day_performances p ON p.creator_account_id = a.id
          WHERE a.event_id = ?
            AND p.event_id = ?
            AND p.status = 'reflected'
          GROUP BY a.id, a.tiktok_id, a.tiktok_name`,
        [input.eventId, input.eventId],
      );
      const normalized = (rows as any[]).map(row => ({
        ...row,
        performanceCount: Number(row.performanceCount || 0),
        brandGmv: Number(row.brandGmv || 0),
        streamMinutes: Number(row.streamMinutes || 0),
      }));
      return {
        sales: [...normalized].sort((a, b) => b.brandGmv - a.brandGmv || a.tiktokId.localeCompare(b.tiktokId)),
        streaming: [...normalized].sort((a, b) => b.streamMinutes - a.streamMinutes || a.tiktokId.localeCompare(b.tiktokId)),
      };
    }),

  listAudit: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      await requireBrandDayPermission(ctx, "view");
      const pool = await getPool();
      const [rows] = await pool.query(
        `SELECT id, event_id AS eventId, creator_account_id AS creatorAccountId,
                actor_user_id AS actorUserId, actor_name AS actorName, actor_type AS actorType,
                action, entity_type AS entityType, entity_id AS entityId, detail, created_at AS createdAt
           FROM brand_day_audit_logs
          WHERE event_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
        [input.eventId, input.limit],
      );
      return rows as any[];
    }),
});
