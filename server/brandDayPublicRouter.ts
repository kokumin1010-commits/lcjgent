import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import { getBrandDayPool } from "./brandDayPool";
import {
  assessBrandDayPerformanceTime,
  formatJstDateTimeInput,
  getBrandDayDayWindow,
  parseBrandDayJstDateTime,
  type BrandDayWindow,
} from "./brandDayTime";
import {
  classifyScreenshotRecognitionError,
  recognizeBrandDayScreenshot,
  screenshotRecognitionErrorMessage,
} from "./brandDayRecognition";
import { storageGet, storagePut } from "./storage";

const CREATOR_COOKIE = "lcj_brand_day_creator_session";
const CREATOR_SESSION_MS = 12 * 60 * 60 * 1000;

type EventRow = {
  id: number;
  brand_id: number | null;
  slug: string;
  title: string;
  short_name: string;
  timezone: string;
  event_start_at: Date;
  event_end_at: Date;
  registration_open_at: Date | null;
  registration_close_at: Date | null;
  minimum_stream_minutes: number;
  status: string;
  logo_url: string | null;
  theme_json: unknown;
  rules_json: unknown;
};

function parseJsonRecord(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try { return JSON.parse(String(value)); } catch { return {}; }
}

function eventWindow(event: EventRow): BrandDayWindow {
  return {
    eventStartAt: new Date(event.event_start_at),
    eventEndAt: new Date(event.event_end_at),
    timezone: event.timezone,
  };
}

function eventYear(event: EventRow) {
  const jst = new Date(new Date(event.event_start_at).getTime() + 9 * 60 * 60_000);
  return jst.getUTCFullYear();
}

function eventDayCount(event: EventRow) {
  const start = new Date(new Date(event.event_start_at).getTime() + 9 * 60 * 60_000);
  const end = new Date(new Date(event.event_end_at).getTime() + 9 * 60 * 60_000);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endDay - startDay) / 86_400_000) + 1;
}

function publicEvent(event: EventRow) {
  const rules = parseJsonRecord(event.rules_json);
  const theme = parseJsonRecord(event.theme_json);
  return {
    id: Number(event.id),
    slug: event.slug,
    title: event.title,
    shortName: event.short_name,
    timezone: event.timezone,
    eventStartAt: new Date(event.event_start_at).getTime(),
    eventEndAt: new Date(event.event_end_at).getTime(),
    registrationOpenAt: event.registration_open_at ? new Date(event.registration_open_at).getTime() : null,
    registrationCloseAt: event.registration_close_at ? new Date(event.registration_close_at).getTime() : null,
    minimumStreamMinutes: Number(event.minimum_stream_minutes),
    status: event.status,
    logoUrl: event.logo_url,
    subtitle: String(rules.subtitle || "ブランドの成果を、ライブで証明する。"),
    challenge: String(rules.challenge || "BRAND DAY CHALLENGE"),
    brandKeywords: Array.isArray(rules.brandKeywords) ? rules.brandKeywords.map(String) : [event.short_name],
    theme,
    days: Array.from({ length: eventDayCount(event) }, (_, index) => {
      const dayNumber = index + 1;
      const window = getBrandDayDayWindow(eventWindow(event), dayNumber);
      return {
        dayNumber,
        label: `DAY ${dayNumber}`,
        startAt: window.startMs,
        endAt: window.endExclusiveMs - 1,
      };
    }),
  };
}

async function findEventBySlug(slug: string): Promise<EventRow> {
  const pool = await getBrandDayPool();
  const [rows] = await pool.query("SELECT * FROM brand_day_events WHERE slug = ? LIMIT 1", [slug]);
  const event = (rows as EventRow[])[0];
  if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "ブランドデーが見つかりません。" });
  return event;
}

function parseImageDataUri(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "TikTok LIVE 大画面の形式が正しくありません。" });
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > 8 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "画像は8MB以下にしてください。" });
  const mimeType = match[1];
  return { data, mimeType, extension: mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] };
}

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function cookieValue(cookieHeader: string | undefined, name: string) {
  return cookieHeader?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function requireCreator(ctx: any) {
  const token = cookieValue(typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : undefined, CREATOR_COOKIE);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "出場者ログインが必要です。" });
  const pool = await getBrandDayPool();
  const [rows] = await pool.query(
    `SELECT a.id, a.event_id AS eventId, a.entry_id AS entryId, a.tiktok_id AS tiktokId,
            a.tiktok_name AS tiktokName, a.status, e.slug, e.title
       FROM brand_day_creator_sessions s
       JOIN brand_day_creator_accounts a ON a.id = s.creator_account_id
       JOIN brand_day_events e ON e.id = a.event_id
      WHERE s.token_hash = ? AND s.expires_at > NOW() AND a.status = 'active'
      LIMIT 1`,
    [sha256(token)],
  );
  const account = (rows as any[])[0];
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "出場者セッションの有効期限が切れています。" });
  return account;
}

async function signedScreenshot(key: string | null, storedUrl: string | null) {
  if (!key) return storedUrl;
  try { return (await storageGet(key)).url; } catch { return storedUrl; }
}

async function getDashboard(accountId: number) {
  const pool = await getBrandDayPool();
  const [accountRows] = await pool.query(
    `SELECT a.id, a.event_id AS eventId, a.entry_id AS entryId, a.tiktok_id AS tiktokId,
            a.tiktok_name AS tiktokName, a.status, e.*
       FROM brand_day_creator_accounts a
       JOIN brand_day_events e ON e.id = a.event_id
      WHERE a.id = ? LIMIT 1`,
    [accountId],
  );
  const account = (accountRows as any[])[0];
  if (!account) return null;
  const [performanceRows] = await pool.query(
    `SELECT p.* FROM brand_day_performances p
      WHERE p.creator_account_id = ? AND p.event_id = ?
      ORDER BY p.day_number, p.session_number`,
    [accountId, account.eventId],
  );
  const performances = performanceRows as any[];
  const ids = performances.map(row => Number(row.id));
  let products: any[] = [];
  if (ids.length) {
    const [productRows] = await pool.query(
      `SELECT * FROM brand_day_performance_products WHERE performance_id IN (${ids.map(() => "?").join(",")}) ORDER BY performance_id, id`,
      ids,
    );
    products = productRows as any[];
  }
  const mappedPerformances = await Promise.all(performances.map(async row => ({
    id: Number(row.id),
    dayNumber: Number(row.day_number),
    sessionNumber: Number(row.session_number),
    streamDate: row.stream_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    startedAtJst: formatJstDateTimeInput(row.started_at ? new Date(row.started_at) : null),
    endedAtJst: formatJstDateTimeInput(row.ended_at ? new Date(row.ended_at) : null),
    streamMinutes: Number(row.stream_minutes || 0),
    totalGmv: Number(row.total_gmv || 0),
    brandGmv: Number(row.brand_gmv || 0),
    screenshotUrl: await signedScreenshot(row.screenshot_key, row.screenshot_url),
    aiStatus: row.ai_status,
    aiReport: parseJsonRecord(row.ai_report),
    status: row.status,
    reviewDecision: row.review_decision,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    products: products.filter(product => Number(product.performance_id) === Number(row.id)).map(product => ({
      id: Number(product.id),
      productName: product.product_name,
      gmv: Number(product.gmv || 0),
      brandGmv: Number(product.brand_gmv || 0),
      isBrandProduct: Boolean(product.is_brand_product),
      selected: Boolean(product.selected),
      confidenceBasisPoints: Number(product.confidence_basis_points || 0),
    })),
  })));
  const reflected = mappedPerformances.filter(row => row.status === "reflected");
  return {
    account: { id: Number(account.id), eventId: Number(account.eventId), tiktokId: account.tiktokId, tiktokName: account.tiktokName },
    event: publicEvent(account as EventRow),
    totals: {
      brandGmv: reflected.reduce((sum, row) => sum + row.brandGmv, 0),
      streamMinutes: reflected.reduce((sum, row) => sum + row.streamMinutes, 0),
      reflectedCount: reflected.length,
      pendingReviewCount: mappedPerformances.filter(row => row.status === "reviewed" && row.reviewDecision === "pending").length,
    },
    performances: mappedPerformances,
  };
}

async function replaceProducts(connection: any, eventId: number, performanceId: number, products: Array<{ productName: string; gmv: number; isBrandProduct: boolean; confidenceBasisPoints?: number }>) {
  await connection.query("DELETE FROM brand_day_performance_products WHERE performance_id = ?", [performanceId]);
  for (const product of products) {
    await connection.query(
      `INSERT INTO brand_day_performance_products
        (event_id, performance_id, product_name, gmv, brand_gmv, is_brand_product, selected, confidence_basis_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, performanceId, product.productName, product.gmv, product.isBrandProduct ? product.gmv : 0, product.isBrandProduct ? 1 : 0, product.isBrandProduct ? 1 : 0, product.confidenceBasisPoints || 0],
    );
  }
}

async function creatorAudit(connection: any, input: { eventId: number; accountId: number; action: string; entityId: number; detail?: Record<string, unknown> }) {
  await connection.query(
    `INSERT INTO brand_day_audit_logs
      (event_id, creator_account_id, actor_name, actor_type, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, 'creator', ?, 'performance', ?, ?)`,
    [input.eventId, input.accountId, `creator:${input.accountId}`, input.action, input.entityId, input.detail ? JSON.stringify(input.detail) : null],
  );
}

const productInput = z.object({
  productName: z.string().trim().min(1).max(255),
  gmv: z.number().int().min(0).max(1_000_000_000),
  isBrandProduct: z.boolean(),
  confidenceBasisPoints: z.number().int().min(0).max(10_000).default(0),
});

export const brandDayPublicRouter = router({
  event: publicProcedure.input(z.object({ slug: z.string().min(2).max(120) })).query(async ({ input }) => publicEvent(await findEventBySlug(input.slug))),
  leaderboard: publicProcedure.input(z.object({ slug: z.string().min(2).max(120), dayNumber: z.number().int().min(0).max(31).default(0) })).query(async ({ input }) => {
    const event = await findEventBySlug(input.slug);
    const pool = await getBrandDayPool();
    const params: unknown[] = [event.id, event.id, event.minimum_stream_minutes];
    const dayCondition = input.dayNumber ? "AND p.day_number = ?" : "";
    if (input.dayNumber) params.push(input.dayNumber);
    const [rows] = await pool.query(
      `SELECT a.id AS creatorAccountId, a.tiktok_id AS tiktokId, a.tiktok_name AS tiktokName,
              COUNT(p.id) AS performanceCount, COALESCE(SUM(p.brand_gmv),0) AS brandGmv,
              COALESCE(SUM(p.stream_minutes),0) AS streamMinutes
         FROM brand_day_creator_accounts a
         JOIN brand_day_performances p ON p.creator_account_id = a.id
        WHERE a.event_id = ? AND p.event_id = ? AND p.status = 'reflected'
          AND (p.stream_minutes >= ? OR p.force_include_outside_window = 1)
          ${dayCondition}
        GROUP BY a.id, a.tiktok_id, a.tiktok_name`,
      params,
    );
    const normalized = (rows as any[]).map(row => ({ ...row, performanceCount: Number(row.performanceCount), brandGmv: Number(row.brandGmv), streamMinutes: Number(row.streamMinutes) }));
    return { sales: [...normalized].sort((a, b) => b.brandGmv - a.brandGmv || a.tiktokId.localeCompare(b.tiktokId)), streaming: [...normalized].sort((a, b) => b.streamMinutes - a.streamMinutes || a.tiktokId.localeCompare(b.tiktokId)) };
  }),
  enter: publicProcedure.input(z.object({
    slug: z.string().min(2).max(120),
    registrationName: z.string().trim().min(1, "お名前を入力してください。").max(120),
    tiktokId: z.string().trim().min(2, "TikTok IDを2文字以上で入力してください。").max(120),
    tiktokName: z.string().trim().min(1, "TikTok表示名を入力してください。").max(160),
    lineId: z.string().trim().min(1, "LINE IDを入力してください。").max(120),
    phone: z.string().trim().min(6, "電話番号は6文字以上で入力してください。").max(40),
    email: z.string().trim().email("有効なメールアドレスを入力してください。").max(320),
    password: z.string().min(8, "パスワードは8文字以上で入力してください。").max(128),
    passwordConfirmation: z.string().min(8).max(128),
    website: z.string().max(0).optional(),
  })).mutation(async ({ input }) => {
    const event = await findEventBySlug(input.slug);
    const now = Date.now();
    if (event.status !== "registration" && event.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "現在エントリーを受け付けていません。" });
    if (event.registration_open_at && now < new Date(event.registration_open_at).getTime()) throw new TRPCError({ code: "BAD_REQUEST", message: "エントリー受付開始前です。" });
    if (event.registration_close_at && now > new Date(event.registration_close_at).getTime()) throw new TRPCError({ code: "BAD_REQUEST", message: "エントリー受付は終了しました。" });
    if (input.password !== input.passwordConfirmation) throw new TRPCError({ code: "BAD_REQUEST", message: "確認用パスワードが一致しません。" });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const pool = await getBrandDayPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [entryResult] = await connection.query(
        `INSERT INTO brand_day_entries
          (event_id, registration_name, tiktok_id, tiktok_name, line_id, phone, email, dashboard_password_hash, status, source_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'lcj')`,
        [event.id, input.registrationName, input.tiktokId, input.tiktokName, input.lineId, input.phone, input.email, passwordHash],
      );
      const entryId = Number((entryResult as any).insertId);
      const [accountResult] = await connection.query(
        `INSERT INTO brand_day_creator_accounts
          (event_id, entry_id, tiktok_id, tiktok_name, password_hash, status, source_system)
         VALUES (?, ?, ?, ?, ?, 'active', 'lcj')`,
        [event.id, entryId, input.tiktokId, input.tiktokName, passwordHash],
      );
      const accountId = Number((accountResult as any).insertId);
      await connection.query(
        `INSERT INTO brand_day_audit_logs
          (event_id, creator_account_id, actor_name, actor_type, action, entity_type, entity_id, detail)
         VALUES (?, ?, ?, 'creator', 'entry.created', 'entry', ?, ?)`,
        [event.id, accountId, input.tiktokId, entryId, JSON.stringify({ source: "lcj-public-entry" })],
      );
      await connection.commit();
      return { success: true, entryId, accountId };
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) throw new TRPCError({ code: "CONFLICT", message: "このTikTok IDまたはメールアドレスは登録済みです。" });
      throw error;
    } finally { connection.release(); }
  }),
});

export const brandDayCreatorRouter = router({
  login: publicProcedure.input(z.object({ slug: z.string().min(2).max(120), tiktokId: z.string().trim().min(2).max(120), password: z.string().min(8).max(128) })).mutation(async ({ input, ctx }) => {
    const event = await findEventBySlug(input.slug);
    const pool = await getBrandDayPool();
    const [rows] = await pool.query("SELECT * FROM brand_day_creator_accounts WHERE event_id = ? AND tiktok_id = ? AND status = 'active' LIMIT 1", [event.id, input.tiktokId]);
    const account = (rows as any[])[0];
    if (!account || !(await bcrypt.compare(input.password, account.password_hash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "TikTok IDまたはパスワードが正しくありません。" });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CREATOR_SESSION_MS);
    await pool.query("INSERT INTO brand_day_creator_sessions (event_id, creator_account_id, token_hash, expires_at) VALUES (?, ?, ?, ?)", [event.id, account.id, sha256(token), expiresAt]);
    await pool.query("UPDATE brand_day_creator_accounts SET last_signed_in_at = NOW() WHERE id = ?", [account.id]);
    ctx.res.cookie(CREATOR_COOKIE, token, { ...getSessionCookieOptions(ctx.req), maxAge: CREATOR_SESSION_MS });
    return { id: Number(account.id), eventId: Number(event.id), slug: event.slug, tiktokId: account.tiktok_id, tiktokName: account.tiktok_name };
  }),
  me: publicProcedure.input(z.object({ slug: z.string().min(2).max(120) })).query(async ({ ctx, input }) => {
    try {
      const account = await requireCreator(ctx);
      return account.slug === input.slug ? account : null;
    } catch {
      return null;
    }
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = cookieValue(typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : undefined, CREATOR_COOKIE);
    if (token) (await getBrandDayPool()).query("DELETE FROM brand_day_creator_sessions WHERE token_hash = ?", [sha256(token)]).catch(() => undefined);
    ctx.res.clearCookie(CREATOR_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true as const };
  }),
  dashboard: publicProcedure.input(z.object({ slug: z.string().min(2).max(120) })).query(async ({ ctx, input }) => {
    const account = await requireCreator(ctx);
    if (account.slug !== input.slug) throw new TRPCError({ code: "FORBIDDEN", message: "このブランドデーの出場者セッションではありません。" });
    return getDashboard(Number(account.id));
  }),
  beginScreenshot: publicProcedure.input(z.object({ performanceId: z.number().int().positive().optional(), dayNumber: z.number().int().min(1).max(31), imageData: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const account = await requireCreator(ctx);
    const pool = await getBrandDayPool();
    const [eventRows] = await pool.query("SELECT * FROM brand_day_events WHERE id = ? LIMIT 1", [account.eventId]);
    const event = (eventRows as EventRow[])[0];
    if (!event || input.dayNumber > eventDayCount(event)) throw new TRPCError({ code: "BAD_REQUEST", message: "対象DAYが正しくありません。" });
    let existing: any = null;
    if (input.performanceId) {
      const [rows] = await pool.query("SELECT * FROM brand_day_performances WHERE id = ? AND event_id = ? AND creator_account_id = ? LIMIT 1", [input.performanceId, event.id, account.id]);
      existing = (rows as any[])[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "対象の配信実績が見つかりません。" });
    }
    const targetDay = existing ? Number(existing.day_number) : input.dayNumber;
    const image = parseImageDataUri(input.imageData);
    const hash = sha256(image.data);
    const [duplicates] = await pool.query("SELECT id, day_number AS dayNumber, session_number AS sessionNumber FROM brand_day_performances WHERE event_id = ? AND creator_account_id = ? AND screenshot_hash = ? LIMIT 1", [event.id, account.id, hash]);
    const duplicate = (duplicates as any[])[0];
    if (duplicate && Number(duplicate.id) !== Number(existing?.id)) throw new TRPCError({ code: "CONFLICT", message: `同じ画像はすでに DAY ${duplicate.dayNumber}・配信 #${duplicate.sessionNumber} に登録されています。` });
    const stored = await storagePut(`brand-days/${event.slug}/creators/${account.id}/day-${targetDay}-${Date.now()}.${image.extension}`, image.data, image.mimeType);
    const connection = await pool.getConnection();
    let performanceId: number;
    let sessionNumber: number;
    try {
      await connection.beginTransaction();
      if (existing) {
        performanceId = Number(existing.id);
        sessionNumber = Number(existing.session_number);
        await connection.query("UPDATE brand_day_performances SET screenshot_key = ?, screenshot_url = NULL, screenshot_hash = ?, ai_status = 'processing', review_decision = NULL, review_reason = NULL WHERE id = ?", [stored.key, hash, performanceId]);
      } else {
        const [nextRows] = await connection.query("SELECT COALESCE(MAX(session_number),0)+1 AS nextSession FROM brand_day_performances WHERE event_id = ? AND creator_account_id = ? AND day_number = ? FOR UPDATE", [event.id, account.id, targetDay]);
        sessionNumber = Number((nextRows as any[])[0]?.nextSession || 1);
        const dayWindow = getBrandDayDayWindow(eventWindow(event), targetDay);
        const [result] = await connection.query(
          `INSERT INTO brand_day_performances
            (event_id, creator_account_id, day_number, session_number, stream_date, screenshot_key, screenshot_hash, ai_status, status, source_system)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', 'draft', 'lcj')`,
          [event.id, account.id, targetDay, sessionNumber, new Date(dayWindow.startMs), stored.key, hash],
        );
        performanceId = Number((result as any).insertId);
      }
      await creatorAudit(connection, { eventId: event.id, accountId: account.id, action: existing ? "screenshot.replaced" : "screenshot.uploaded", entityId: performanceId, detail: { dayNumber: targetDay, sessionNumber } });
      await connection.commit();
    } catch (error: any) {
      await connection.rollback();
      if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) throw new TRPCError({ code: "CONFLICT", message: "同じ画像または配信番号がすでに登録されています。" });
      throw error;
    } finally { connection.release(); }
    const screenshotUrl = (await storageGet(stored.key)).url;
    try {
      const rules = parseJsonRecord(event.rules_json);
      const parsed = await recognizeBrandDayScreenshot(screenshotUrl, {
        selectedDay: targetDay,
        eventYear: eventYear(event),
        eventTitle: event.title,
        brandKeywords: Array.isArray(rules.brandKeywords) ? rules.brandKeywords.map(String) : [event.short_name],
        timezone: event.timezone,
      });
      const startedAt = parsed.timeReadable ? parseBrandDayJstDateTime(parsed.liveStartedAtJst) : null;
      const endedAt = parsed.timeReadable ? parseBrandDayJstDateTime(parsed.liveEndedAtJst) : null;
      const assessment = assessBrandDayPerformanceTime(eventWindow(event), targetDay, startedAt, endedAt);
      const products = parsed.products.map(product => ({ ...product, confidenceBasisPoints: product.confidenceBasisPoints }));
      const aiReport = { notes: parsed.notes, model: parsed.model, readable: parsed.readable, timeReadable: parsed.timeReadable, timeStatus: assessment.status, detectedStreamMinutes: parsed.streamMinutes, timeEvidence: parsed.timeEvidence, source: "lcj-brand-day-upload" };
      const updateConnection = await pool.getConnection();
      try {
        await updateConnection.beginTransaction();
        await updateConnection.query(
          `UPDATE brand_day_performances
              SET stream_date = ?, started_at = ?, ended_at = ?, stream_minutes = ?, total_gmv = ?, brand_gmv = ?,
                  ai_status = ?, ai_model = ?, ai_report = ?, updated_at = NOW()
            WHERE id = ? AND event_id = ? AND creator_account_id = ?`,
          [assessment.effectiveStartedAt || startedAt || new Date(getBrandDayDayWindow(eventWindow(event), targetDay).startMs), startedAt, endedAt, assessment.validMinutes || parsed.streamMinutes, parsed.totalGmv, products.filter(product => product.isBrandProduct).reduce((sum, product) => sum + product.gmv, 0), parsed.readable ? "completed" : "failed", parsed.model, JSON.stringify(aiReport), performanceId, event.id, account.id],
        );
        await replaceProducts(updateConnection, event.id, performanceId, products);
        await updateConnection.commit();
      } catch (error) { await updateConnection.rollback(); throw error; } finally { updateConnection.release(); }
      const mode = parsed.readable && (assessment.status === "valid" || assessment.status === "partial") ? "ai" as const : "manual" as const;
      return {
        mode,
        performanceId,
        dayNumber: targetDay,
        sessionNumber,
        screenshotUrl,
        totalGmv: parsed.totalGmv,
        streamMinutes: assessment.validMinutes || parsed.streamMinutes,
        products,
        startedAtJst: formatJstDateTimeInput(startedAt),
        endedAtJst: formatJstDateTimeInput(endedAt),
        timeStatus: assessment.status,
        effectiveStreamMinutes: assessment.validMinutes,
        timeEvidence: parsed.timeEvidence,
        errorCode: mode === "ai" ? null : (!parsed.readable ? "AI_METRICS_NOT_READABLE" : assessment.status === "outside" ? "STREAM_OUTSIDE_EVENT_WINDOW" : "AI_TIME_NOT_READABLE"),
      };
    } catch (error) {
      const failureCode = classifyScreenshotRecognitionError(error);
      await pool.query("UPDATE brand_day_performances SET ai_status = 'failed', ai_report = ? WHERE id = ?", [JSON.stringify({ errorCode: failureCode, source: "lcj-brand-day-upload" }), performanceId]);
      return { mode: "manual" as const, performanceId, dayNumber: targetDay, sessionNumber, screenshotUrl, totalGmv: 0, streamMinutes: 0, products: [], startedAtJst: null, endedAtJst: null, timeStatus: "missing" as const, effectiveStreamMinutes: 0, timeEvidence: "", errorCode: failureCode, error: screenshotRecognitionErrorMessage(failureCode) };
    }
  }),
  confirmScreenshot: publicProcedure.input(z.object({
    performanceId: z.number().int().positive(),
    streamMinutes: z.number().int().min(0).max(10_000),
    startedAt: z.number().int().nullable(),
    endedAt: z.number().int().nullable(),
    totalGmv: z.number().int().min(0).max(1_000_000_000),
    source: z.enum(["ai", "manual"]),
    products: z.array(productInput).min(1).max(100),
  })).mutation(async ({ input, ctx }) => {
    const account = await requireCreator(ctx);
    const pool = await getBrandDayPool();
    const [rows] = await pool.query(
      `SELECT p.*, e.event_start_at, e.event_end_at, e.timezone
         FROM brand_day_performances p JOIN brand_day_events e ON e.id = p.event_id
        WHERE p.id = ? AND p.event_id = ? AND p.creator_account_id = ? LIMIT 1`,
      [input.performanceId, account.eventId, account.id],
    );
    const performance = (rows as any[])[0];
    if (!performance?.screenshot_key) throw new TRPCError({ code: "NOT_FOUND", message: "先にライブ大画面をアップロードしてください。" });
    const startedAt = input.startedAt === null ? null : new Date(input.startedAt);
    const endedAt = input.endedAt === null ? null : new Date(input.endedAt);
    const assessment = assessBrandDayPerformanceTime({ eventStartAt: new Date(performance.event_start_at), eventEndAt: new Date(performance.event_end_at), timezone: performance.timezone }, Number(performance.day_number), startedAt, endedAt);
    const reflected = assessment.status === "valid" || assessment.status === "partial";
    const brandGmv = input.products.filter(product => product.isBrandProduct).reduce((sum, product) => sum + product.gmv, 0);
    const status = reflected ? "reflected" : "reviewed";
    const reviewDecision = reflected ? null : "pending";
    const reason = reflected ? null : assessment.status === "outside" ? "配信日時が成績対象期間外" : assessment.status === "invalid" ? "開始・終了日時の順序が不正" : "配信開始・終了日時を画像から確認できない";
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE brand_day_performances
            SET stream_date = ?, started_at = ?, ended_at = ?, stream_minutes = ?, total_gmv = ?, brand_gmv = ?,
                ai_status = 'completed', status = ?, review_decision = ?, review_reason = ?,
                reviewed_by = NULL, reviewed_at = NULL, force_include_outside_window = 0, updated_at = NOW()
          WHERE id = ?`,
        [assessment.effectiveStartedAt || startedAt || performance.stream_date, startedAt, endedAt, reflected ? assessment.validMinutes : (assessment.rawMinutes || input.streamMinutes), input.totalGmv, brandGmv, status, reviewDecision, reason, input.performanceId],
      );
      await replaceProducts(connection, Number(account.eventId), input.performanceId, input.products.map(product => ({ ...product, confidenceBasisPoints: input.source === "manual" ? 0 : product.confidenceBasisPoints })));
      await creatorAudit(connection, { eventId: Number(account.eventId), accountId: Number(account.id), action: reflected ? "performance.auto_reflected" : "performance.review_requested", entityId: input.performanceId, detail: { source: input.source, timeStatus: assessment.status, validMinutes: assessment.validMinutes, reason } });
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    return { dashboard: await getDashboard(Number(account.id)), submissionOutcome: reflected ? "reflected" as const : "pending_review" as const, submittedTimeStatus: assessment.status };
  }),
});
