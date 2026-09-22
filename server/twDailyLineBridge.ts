import { createHash, randomUUID, verify } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  finalizeLineOutgoingAudit,
  getDb,
  reserveLineOutgoingAudit,
} from "./db";
import {
  getLineGroupMemberCount,
  getLineMessageQuotaStatus,
  pushMessage,
} from "./line";
import { createLineRetryKey } from "./lineRetryKey";

const SALESDASH_PUBLIC_KEY_URL =
  process.env.SALESDASH_TW_DAILY_PUBLIC_KEY_URL ||
  "https://salesdash.buzzdrop.co.jp/api/internal/tw-daily-line/public-key";
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;
const SIGNATURE_MAX_FUTURE_SKEW_MS = 60_000;
const PUBLIC_KEY_CACHE_MS = 10 * 60_000;
const LINE_TEXT_MAX_LENGTH = 5_000;
const OUTBOX_LEASE_MINUTES = 10;
const OUTBOX_MAX_BACKOFF_SECONDS = 3_600;
const OUTBOX_WORKER_INTERVAL_MS = 60_000;
const LINE_RETRY_SAFETY_WINDOW_MS = 23 * 60 * 60_000;
const DEFAULT_TARGET_GROUP_NAME = "卡雅仕台灣總部本部TW KYOGOKU";
const salesDashDailyUrlSchema = z.string().max(500).regex(
  /^https:\/\/salesdash\.buzzdrop\.co\.jp\/tw-staff\?(?:reportId=\d+&reportDate=\d{4}-\d{2}-\d{2}|reportDate=\d{4}-\d{2}-\d{2})$/,
);

const reportEventSchema = z.object({
  version: z.literal(1),
  eventId: z.string().regex(/^[A-Za-z0-9:_-]{8,160}$/),
  eventType: z.literal("daily_report_saved"),
  occurredAt: z.string().datetime(),
  payload: z.object({
    reportId: z.number().int().positive(),
    staffName: z.string().trim().min(1).max(64),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    action: z.enum(["submitted", "edited", "backfilled"]),
    content: z.string().max(18_000),
    findings: z.string().max(8_000),
    notes: z.string().max(4_000),
    contentTruncated: z.boolean(),
    findingsTruncated: z.boolean(),
    notesTruncated: z.boolean(),
    editCount: z.number().int().min(0),
    salesdashUrl: salesDashDailyUrlSchema,
  }),
});

const digestItemSchema = z.object({
  text: z.string().trim().min(1).max(1_000),
  textTruncated: z.boolean(),
});
const digestEventSchema = z.object({
  version: z.literal(1),
  eventId: z.string().regex(/^[A-Za-z0-9:_-]{8,160}$/),
  eventType: z.literal("daily_digest_ready"),
  occurredAt: z.string().datetime(),
  payload: z.object({
    digestId: z.number().int().positive(),
    digestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reportCount: z.number().int().min(0).max(1_000),
    urgentCount: z.number().int().min(0).max(1_000),
    executiveSummary: z.string().trim().min(1).max(1_000),
    executiveSummaryTruncated: z.boolean(),
    achievements: z.array(digestItemSchema).max(5),
    risks: z.array(digestItemSchema.extend({ severity: z.enum(["urgent", "high", "normal"]) })).max(5),
    nextActions: z.array(digestItemSchema.extend({
      owner: z.string().max(100),
      ownerTruncated: z.boolean(),
      deadline: z.string().max(100),
      deadlineTruncated: z.boolean(),
    })).max(5),
    supportRequests: z.array(digestItemSchema.extend({ urgency: z.enum(["immediate", "today", "normal"]) })).max(5),
    reports: z.array(z.object({
      reportId: z.number().int().positive(),
      staffName: z.string().trim().min(1).max(64),
      content: z.string().max(600),
      findings: z.string().max(160),
      notes: z.string().max(100),
      contentTruncated: z.boolean(),
      findingsTruncated: z.boolean(),
      notesTruncated: z.boolean(),
      salesdashUrl: salesDashDailyUrlSchema,
    })).max(40),
    salesdashUrl: salesDashDailyUrlSchema,
  }),
});

export const twDailyLineEventSchema = z.discriminatedUnion("eventType", [
  reportEventSchema,
  digestEventSchema,
]);
export type TwDailyLineBridgeEvent = z.infer<typeof twDailyLineEventSchema>;

type SalesDashPublicKey = {
  algorithm: "Ed25519";
  keyId: string;
  publicKeyPem: string;
  canonicalization: string;
  issuer: string;
};

let publicKeyCache: { value: SalesDashPublicKey; expiresAt: number } | null = null;
let twDailyStorageReady = false;
let twDailyStoragePromise: Promise<void> | null = null;

export function canonicalizeSalesDashTwDailyEnvelope(
  timestamp: string,
  eventId: string,
  body: string,
): string {
  return `${timestamp}\n${eventId}\n${body}`;
}

async function getSalesDashPublicKey(force = false): Promise<SalesDashPublicKey> {
  if (!force && publicKeyCache && publicKeyCache.expiresAt > Date.now()) {
    return publicKeyCache.value;
  }
  const response = await fetch(SALESDASH_PUBLIC_KEY_URL, {
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`SALESDASH_PUBLIC_KEY_HTTP_${response.status}`);
  const payload = await response.json() as Partial<SalesDashPublicKey>;
  if (
    payload.algorithm !== "Ed25519" ||
    typeof payload.keyId !== "string" ||
    !/^[a-f0-9]{24}$/.test(payload.keyId) ||
    typeof payload.publicKeyPem !== "string" ||
    !payload.publicKeyPem.includes("BEGIN PUBLIC KEY") ||
    payload.issuer !== "salesdash.buzzdrop.co.jp"
  ) {
    throw new Error("SALESDASH_PUBLIC_KEY_INVALID");
  }
  const value = payload as SalesDashPublicKey;
  publicKeyCache = { value, expiresAt: Date.now() + PUBLIC_KEY_CACHE_MS };
  return value;
}

export async function verifySalesDashTwDailyRequest(input: {
  body: string;
  keyId: string;
  timestamp: string;
  eventId: string;
  signature: string;
  now?: number;
}): Promise<TwDailyLineBridgeEvent> {
  const now = input.now ?? Date.now();
  const timestamp = Number(input.timestamp);
  if (
    !Number.isFinite(timestamp) ||
    timestamp - now > SIGNATURE_MAX_FUTURE_SKEW_MS ||
    now - timestamp > SIGNATURE_MAX_AGE_MS
  ) {
    throw new Error("SALESDASH_SIGNATURE_EXPIRED");
  }
  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(input.eventId)) {
    throw new Error("SALESDASH_EVENT_ID_INVALID");
  }
  const key = await getSalesDashPublicKey(false);
  const resolvedKey = key.keyId === input.keyId ? key : await getSalesDashPublicKey(true);
  if (resolvedKey.keyId !== input.keyId) throw new Error("SALESDASH_KEY_ID_UNKNOWN");
  const signatureBuffer = Buffer.from(input.signature, "base64");
  if (signatureBuffer.length !== 64) throw new Error("SALESDASH_SIGNATURE_INVALID");
  const verified = verify(
    null,
    Buffer.from(canonicalizeSalesDashTwDailyEnvelope(input.timestamp, input.eventId, input.body)),
    resolvedKey.publicKeyPem,
    signatureBuffer,
  );
  if (!verified) throw new Error("SALESDASH_SIGNATURE_INVALID");
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(input.body);
  } catch {
    throw new Error("SALESDASH_PAYLOAD_INVALID");
  }
  const parsedResult = twDailyLineEventSchema.safeParse(rawPayload);
  if (!parsedResult.success) throw new Error("SALESDASH_PAYLOAD_INVALID");
  if (parsedResult.data.eventId !== input.eventId) {
    throw new Error("SALESDASH_EVENT_ID_MISMATCH");
  }
  if (
    parsedResult.data.eventType === "daily_report_saved" &&
    !parsedResult.data.eventId.startsWith(
      `tw-report:${parsedResult.data.payload.reportId}:${parsedResult.data.payload.editCount}:`,
    )
  ) {
    throw new Error("SALESDASH_EVENT_ID_MISMATCH");
  }
  if (
    parsedResult.data.eventType === "daily_digest_ready" &&
    parsedResult.data.eventId !== `tw-digest:${parsedResult.data.payload.digestDate}`
  ) {
    throw new Error("SALESDASH_EVENT_ID_MISMATCH");
  }
  if (parsedResult.data.eventType === "daily_report_saved") {
    const expectedUrl = `https://salesdash.buzzdrop.co.jp/tw-staff?${new URLSearchParams({
      reportId: String(parsedResult.data.payload.reportId),
      reportDate: parsedResult.data.payload.reportDate,
    }).toString()}`;
    if (parsedResult.data.payload.salesdashUrl !== expectedUrl) {
      throw new Error("SALESDASH_REPORT_URL_MISMATCH");
    }
  }
  if (parsedResult.data.eventType === "daily_digest_ready") {
    const expectedDateUrl = `https://salesdash.buzzdrop.co.jp/tw-staff?${new URLSearchParams({
      reportDate: parsedResult.data.payload.digestDate,
    }).toString()}`;
    if (parsedResult.data.payload.salesdashUrl !== expectedDateUrl) {
      throw new Error("SALESDASH_REPORT_URL_MISMATCH");
    }
    for (const report of parsedResult.data.payload.reports) {
      const expectedReportUrl = `https://salesdash.buzzdrop.co.jp/tw-staff?${new URLSearchParams({
        reportId: String(report.reportId),
        reportDate: parsedResult.data.payload.digestDate,
      }).toString()}`;
      if (report.salesdashUrl !== expectedReportUrl) {
        throw new Error("SALESDASH_REPORT_URL_MISMATCH");
      }
    }
  }
  return parsedResult.data;
}

async function initializeTwDailyLineStorage(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`SELECT dailyReportEnabled FROM line_group_settings LIMIT 0`);
  await db.execute(sql`
    SELECT report_id, latest_event_id, report_date, staff_name, payload_hash
    FROM tw_daily_line_report_inbox LIMIT 0
  `);
  await db.execute(sql`
    SELECT rollout_key, target_group_id FROM tw_daily_line_rollouts LIMIT 0
  `);
  await db.execute(sql`
    SELECT id, event_id, target_group_id, status, lease_token, line_retry_key,
           first_external_attempt_at
    FROM tw_daily_line_outbox LIMIT 0
  `);
}

export async function ensureTwDailyLineStorage(): Promise<void> {
  if (twDailyStorageReady) return;
  if (!twDailyStoragePromise) {
    twDailyStoragePromise = initializeTwDailyLineStorage().then(() => {
      twDailyStorageReady = true;
    });
  }
  try {
    await twDailyStoragePromise;
  } finally {
    if (!twDailyStorageReady) twDailyStoragePromise = null;
  }
}

export async function applyTwDailyLineTargetGroupRollout(): Promise<{
  applied: boolean;
  alreadyApplied: boolean;
  matchCount: number;
}> {
  await ensureTwDailyLineStorage();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const targetGroupName = String(
    process.env.TW_DAILY_LINE_TARGET_GROUP_NAME || DEFAULT_TARGET_GROUP_NAME,
  ).trim();
  return db.transaction(async tx => {
    const existingResult: any = await tx.execute(sql`
      SELECT rollout_key
      FROM tw_daily_line_rollouts
      WHERE rollout_key = 'target-group-v1'
      LIMIT 1
      FOR UPDATE
    `);
    const existingRows = Array.isArray(existingResult?.[0]) ? existingResult[0] : existingResult;
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return { applied: false, alreadyApplied: true, matchCount: 1 };
    }

    const matchResult: any = await tx.execute(sql`
      SELECT lineGroupId
      FROM line_groups
      WHERE isActive = true
        AND BINARY groupName = BINARY ${targetGroupName}
        AND OCTET_LENGTH(groupName) = OCTET_LENGTH(${targetGroupName})
      ORDER BY id
      LIMIT 2
      FOR UPDATE
    `);
    const matchRows = Array.isArray(matchResult?.[0]) ? matchResult[0] : matchResult;
    const matches = Array.isArray(matchRows) ? matchRows : [];
    if (matches.length !== 1) {
      return { applied: false, alreadyApplied: false, matchCount: matches.length };
    }
    const lineGroupId = String(matches[0].lineGroupId || "");
    if (!/^C[A-Za-z0-9_-]{8,63}$/.test(lineGroupId)) {
      throw new Error("TW_DAILY_LINE_TARGET_GROUP_ID_INVALID");
    }
    await tx.execute(sql`
      UPDATE line_group_settings
      SET dailyReportEnabled = false
      WHERE lineGroupId <> ${lineGroupId}
    `);
    await tx.execute(sql`
      INSERT INTO line_group_settings (lineGroupId, dailyReportEnabled)
      VALUES (${lineGroupId}, true)
      ON DUPLICATE KEY UPDATE dailyReportEnabled = true
    `);
    await tx.execute(sql`
      INSERT INTO tw_daily_line_rollouts (rollout_key, target_group_id)
      VALUES ('target-group-v1', ${lineGroupId})
    `);
    return { applied: true, alreadyApplied: false, matchCount: 1 };
  });
}

export async function getTwDailyLineBridgeStatus() {
  await ensureTwDailyLineStorage();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)
       FROM line_groups AS g
       INNER JOIN line_group_settings AS settings
         ON settings.lineGroupId = g.lineGroupId
       WHERE g.isActive = true AND settings.dailyReportEnabled = true) AS activeTargetCount,
      (SELECT COUNT(*)
       FROM tw_daily_line_rollouts
       WHERE rollout_key = 'target-group-v1') AS rolloutCount,
      (SELECT COUNT(*) FROM tw_daily_line_outbox
       WHERE status IN ('pending', 'processing')) AS pendingOutboxCount,
      (SELECT COUNT(*) FROM tw_daily_line_outbox
       WHERE status IN ('failed', 'manual_review')) AS failedOutboxCount,
      (SELECT TIMESTAMPDIFF(SECOND, MIN(created_at), NOW())
       FROM tw_daily_line_outbox
       WHERE status IN ('pending', 'processing', 'failed', 'manual_review')) AS oldestUnsentAgeSeconds
  `);
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  const row = Array.isArray(rows) ? rows[0] : null;
  const activeTargetCount = Number(row?.activeTargetCount || 0);
  const failedOutboxCount = Number(row?.failedOutboxCount || 0);
  return {
    ok: activeTargetCount === 1 && failedOutboxCount === 0,
    deliveryMode: "daily_batch" as const,
    activeTargetCount,
    rolloutApplied: Number(row?.rolloutCount || 0) === 1,
    pendingOutboxCount: Number(row?.pendingOutboxCount || 0),
    failedOutboxCount,
    oldestUnsentAgeSeconds: row?.oldestUnsentAgeSeconds === null
      ? null
      : Number(row?.oldestUnsentAgeSeconds || 0),
    maxMessageObjectsPerRequest: 5,
    quotaGuardEnabled: true,
  };
}

async function getDailyReportGroupId(): Promise<string> {
  await ensureTwDailyLineStorage();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.execute(sql`
    SELECT g.lineGroupId
    FROM line_groups AS g
    INNER JOIN line_group_settings AS settings
      ON settings.lineGroupId = g.lineGroupId
    WHERE g.isActive = true
      AND settings.dailyReportEnabled = true
    ORDER BY g.id
    LIMIT 2
  `);
  const rows = Array.isArray(result?.[0]) ? result[0] : result;
  const groupIds = (Array.isArray(rows) ? rows : [])
    .map(row => String(row.lineGroupId || ""))
    .filter(groupId => /^C[A-Za-z0-9_-]{8,63}$/.test(groupId));
  if (groupIds.length !== 1) throw new Error("LINE_DAILY_TARGET_GROUP_CARDINALITY_INVALID");
  return groupIds[0];
}

async function assertDailyReportDeliveryQuota(groupId: string): Promise<number> {
  const [quota, countResult] = await Promise.all([
    getLineMessageQuotaStatus(),
    getLineGroupMemberCount(groupId),
  ]);
  if (countResult.count === null) {
    throw new Error("LINE_DAILY_GROUP_MEMBER_COUNT_UNAVAILABLE");
  }
  // LINE monthly usage is counted per recipient per push request; up to five
  // message objects in one request do not multiply the recipient count.
  const requiredRecipients = Number(countResult.count || 0);
  if (requiredRecipients <= 0) throw new Error("LINE_DAILY_GROUP_HAS_NO_RECIPIENTS");
  if (quota.type === "limited" && quota.value - quota.totalUsage < requiredRecipients) {
    throw new Error("LINE_DAILY_MONTHLY_QUOTA_INSUFFICIENT");
  }
  return requiredRecipients;
}

function clip(value: string, max: number): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function compactLines(items: Array<{ text: string }>, prefix: string): string[] {
  return items.map(item => `${prefix}${clip(item.text, 380)}`);
}

function getTaiwanDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isDigestDateDeliverable(digestDate: string, now = new Date()): boolean {
  const taiwanToday = getTaiwanDate(now);
  const todayMs = Date.parse(`${taiwanToday}T00:00:00.000Z`);
  const digestMs = Date.parse(`${digestDate}T00:00:00.000Z`);
  if (!Number.isFinite(digestMs)) return false;
  const ageDays = Math.floor((todayMs - digestMs) / 86_400_000);
  return ageDays >= 0 && ageDays <= 1;
}

export function formatTwDailyLineMessage(event: TwDailyLineBridgeEvent): string {
  if (event.eventType === "daily_report_saved") {
    const actionLabel = event.payload.action === "edited"
      ? "日報更新"
      : event.payload.action === "backfilled"
        ? "補寫日報"
        : "日報提交";
    return clip([
      `【${actionLabel}｜${event.payload.reportDate}】`,
      `👤 ${event.payload.staffName}`,
      "",
      `工作內容\n${clip(event.payload.content, 1_800)}`,
      event.payload.findings ? `\n發現・重點\n${clip(event.payload.findings, 800)}` : "",
      event.payload.notes ? `\n備註\n${clip(event.payload.notes, 600)}` : "",
      event.payload.contentTruncated || event.payload.findingsTruncated || event.payload.notesTruncated
        ? "\n※LINE顯示為摘要，完整原文請到SalesDash查看。"
        : "",
      "",
      `查看大家日報：${event.payload.salesdashUrl}`,
    ].filter(Boolean).join("\n"), LINE_TEXT_MAX_LENGTH);
  }

  const sections = [
    `【AI每日重點｜${event.payload.digestDate}】`,
    `${event.payload.reportCount}份日報｜需立即處理 ${event.payload.urgentCount}項`,
    "",
    event.payload.executiveSummary,
  ];
  if (event.payload.achievements.length > 0) {
    sections.push("", "✅ 今日完成", ...compactLines(event.payload.achievements, "・"));
  }
  if (event.payload.risks.length > 0) {
    sections.push("", "⚠️ 問題與風險", ...compactLines(event.payload.risks, "・"));
  }
  if (event.payload.nextActions.length > 0) {
    sections.push(
      "",
      "➡️ 下一步",
      ...event.payload.nextActions.map(item => {
        const assignment = [item.owner, item.deadline].filter(Boolean).join("｜");
        return `・${clip(item.text, 340)}${assignment ? `（${assignment}）` : ""}`;
      }),
    );
  }
  if (event.payload.supportRequests.length > 0) {
    sections.push("", "🆘 需要協助", ...compactLines(event.payload.supportRequests, "・"));
  }
  const digestHasTruncation = event.payload.executiveSummaryTruncated
    || event.payload.achievements.some(item => item.textTruncated)
    || event.payload.risks.some(item => item.textTruncated)
    || event.payload.nextActions.some(item => (
      item.textTruncated || item.ownerTruncated || item.deadlineTruncated
    ))
    || event.payload.supportRequests.some(item => item.textTruncated);
  if (digestHasTruncation) {
    sections.push("", "※一部はLINE表示用摘要です。完整内容はSalesDashで確認してください。");
  }
  sections.push("", `查看原文：${event.payload.salesdashUrl}`);
  return clip(sections.join("\n"), LINE_TEXT_MAX_LENGTH);
}

async function saveDailyReportEvent(
  event: Extract<TwDailyLineBridgeEvent, { eventType: "daily_report_saved" }>,
): Promise<void> {
  await ensureTwDailyLineStorage();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const payloadHash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  await db.execute(sql`
    INSERT INTO tw_daily_line_report_inbox
      (report_id, latest_event_id, report_date, staff_name, action, content,
       findings, notes, edit_count, occurred_at, payload_hash)
    VALUES
      (${event.payload.reportId}, ${event.eventId}, ${event.payload.reportDate},
       ${event.payload.staffName}, ${event.payload.action}, ${event.payload.content},
       ${event.payload.findings}, ${event.payload.notes}, ${event.payload.editCount},
       ${new Date(event.occurredAt)}, ${payloadHash})
    ON DUPLICATE KEY UPDATE
      latest_event_id = IF(VALUES(edit_count) >= edit_count, VALUES(latest_event_id), latest_event_id),
      report_date = IF(VALUES(edit_count) >= edit_count, VALUES(report_date), report_date),
      staff_name = IF(VALUES(edit_count) >= edit_count, VALUES(staff_name), staff_name),
      action = IF(VALUES(edit_count) >= edit_count, VALUES(action), action),
      content = IF(VALUES(edit_count) >= edit_count, VALUES(content), content),
      findings = IF(VALUES(edit_count) >= edit_count, VALUES(findings), findings),
      notes = IF(VALUES(edit_count) >= edit_count, VALUES(notes), notes),
      occurred_at = IF(VALUES(edit_count) >= edit_count, VALUES(occurred_at), occurred_at),
      payload_hash = IF(VALUES(edit_count) >= edit_count, VALUES(payload_hash), payload_hash),
      edit_count = GREATEST(edit_count, VALUES(edit_count))
  `);
}

function formatReportDigestEntry(report: any, index: number): string {
  const findings = clip(String(report.findings || ""), 160);
  const notes = clip(String(report.notes || ""), 100);
  return [
    `${index + 1}. ${clip(String(report.staffName || report.staff_name || ""), 64)}`,
    clip(String(report.content || ""), 600),
    findings ? `重點：${findings}` : "",
    notes ? `備註：${notes}` : "",
    report.contentTruncated || report.findingsTruncated || report.notesTruncated
      ? "※摘要顯示；完整原文請查看SalesDash"
      : "",
    report.salesdashUrl ? `原文：${report.salesdashUrl}` : "",
  ].filter(Boolean).join("\n");
}

function chunkDailyReports(
  reports: any[],
  reportDate: string,
  salesdashUrl: string,
  totalReportCount = reports.length,
): string[] {
  if (reports.length === 0) {
    return [`【大家的日報｜${reportDate}】\n沒有可分享的日報原文。\n${salesdashUrl}`];
  }
  const chunks: string[] = [];
  let current = `【大家的日報｜${reportDate}】\n`;
  let included = 0;
  for (let index = 0; index < reports.length; index += 1) {
    const entry = formatReportDigestEntry(reports[index], index);
    const candidate = `${current}${included > 0 ? "\n\n" : ""}${entry}`;
    if (candidate.length > 4_700 && included > 0) {
      chunks.push(current);
      current = `【大家的日報｜${reportDate}（續）】\n${entry}`;
    } else {
      current = candidate;
    }
    included += 1;
    if (chunks.length === 3 && current.length > 4_000 && index < reports.length - 1) {
      const omitted = reports.length - index - 1;
      current += `\n\n另有 ${omitted} 份日報，請到SalesDash查看完整原文。`;
      break;
    }
  }
  if (totalReportCount > reports.length) {
    current += `\n\n另有 ${totalReportCount - reports.length} 份日報，請到SalesDash查看完整原文。`;
  }
  current += `\n\n完整原文：${salesdashUrl}`;
  chunks.push(clip(current, LINE_TEXT_MAX_LENGTH));
  return chunks.slice(0, 4);
}

async function buildDigestMessages(
  event: Extract<TwDailyLineBridgeEvent, { eventType: "daily_digest_ready" }>,
): Promise<Array<{ type: "text"; text: string }>> {
  const digestMessage = formatTwDailyLineMessage(event);
  const reportMessages = chunkDailyReports(
    event.payload.reports,
    event.payload.digestDate,
    event.payload.salesdashUrl,
    event.payload.reportCount,
  );
  return [digestMessage, ...reportMessages]
    .slice(0, 5)
    .map(text => ({ type: "text" as const, text }));
}

function getAuditMessageId(eventId: string, groupId: string): string {
  const groupHash = createHash("sha256").update(groupId).digest("hex").slice(0, 16);
  const eventHash = createHash("sha256").update(eventId).digest("hex").slice(0, 24);
  return `salesdash-daily:${eventHash}:${groupHash}`;
}

type DailyLineMessage = { type: "text"; text: string };

type DailyLineOutboxRow = {
  id: number;
  eventId: string;
  targetGroupId: string;
  event: Extract<TwDailyLineBridgeEvent, { eventType: "daily_digest_ready" }>;
  messages: DailyLineMessage[];
  payloadHash: string;
  attemptCount: number;
  leaseToken: string;
  lineRetryKey: string;
  firstExternalAttemptAt: Date | null;
};

function rowsOf(result: any): any[] {
  if (Array.isArray(result?.[0])) return result[0];
  return Array.isArray(result) ? result : [];
}

function affectedRowsOf(result: any): number {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}

async function enqueueDigestDelivery(
  event: Extract<TwDailyLineBridgeEvent, { eventType: "daily_digest_ready" }>,
): Promise<{ queued: boolean; deduplicated: boolean; targetCount: number; messageObjectCount: number }> {
  await ensureTwDailyLineStorage();
  if (event.payload.reports.length !== event.payload.reportCount) {
    throw new Error("LINE_DAILY_REPORT_SNAPSHOT_INCOMPLETE");
  }
  const groupId = await getDailyReportGroupId();
  const messages = await buildDigestMessages(event);
  const eventJson = JSON.stringify(event);
  const messagesJson = JSON.stringify(messages);
  const payloadHash = createHash("sha256")
    .update(eventJson)
    .update("\n")
    .update(groupId)
    .update("\n")
    .update(messagesJson)
    .digest("hex");
  const lineRetryKey = createLineRetryKey(
    ["salesdash-tw-daily", event.eventId, groupId].join(":"),
  );
  const db = await getDb();
  if (!db) throw new Error("LINE_DAILY_DATABASE_UNAVAILABLE");
  try {
    await db.execute(sql`
      INSERT INTO tw_daily_line_outbox
        (event_id, target_group_id, event_json, messages_json, payload_hash,
         status, next_attempt_at, line_retry_key)
      VALUES
        (${event.eventId}, ${groupId}, ${eventJson}, ${messagesJson}, ${payloadHash},
         'pending', NOW(), ${lineRetryKey})
    `);
    return { queued: true, deduplicated: false, targetCount: 1, messageObjectCount: messages.length };
  } catch (error: any) {
    const code = String(error?.code || error?.cause?.code || "");
    if (code !== "ER_DUP_ENTRY") throw error;
  }
  const existingResult: any = await db.execute(sql`
    SELECT target_group_id, payload_hash, status
    FROM tw_daily_line_outbox
    WHERE event_id = ${event.eventId}
    LIMIT 1
  `);
  const existing = rowsOf(existingResult)[0];
  if (
    !existing ||
    String(existing.target_group_id) !== groupId ||
    String(existing.payload_hash) !== payloadHash
  ) {
    throw new Error("LINE_DAILY_OUTBOX_IDEMPOTENCY_CONFLICT");
  }
  return {
    queued: String(existing.status) !== "sent" && String(existing.status) !== "skipped",
    deduplicated: true,
    targetCount: 1,
    messageObjectCount: messages.length,
  };
}

async function claimNextDailyLineOutbox(): Promise<DailyLineOutboxRow | null> {
  const db = await getDb();
  if (!db) throw new Error("LINE_DAILY_DATABASE_UNAVAILABLE");
  const dueResult: any = await db.execute(sql`
    SELECT id, event_id, target_group_id, event_json, messages_json,
           payload_hash, attempt_count, line_retry_key, first_external_attempt_at
    FROM tw_daily_line_outbox
    WHERE (
      (status IN ('pending', 'failed') AND next_attempt_at <= NOW())
      OR (status = 'processing' AND lease_expires_at < NOW())
    )
    ORDER BY next_attempt_at, id
    LIMIT 1
  `);
  const row = rowsOf(dueResult)[0];
  if (!row) return null;
  const leaseToken = randomUUID();
  const claimed = await db.execute(sql`
    UPDATE tw_daily_line_outbox
    SET status = 'processing', attempt_count = attempt_count + 1,
        lease_token = ${leaseToken},
        lease_expires_at = DATE_ADD(NOW(), INTERVAL ${OUTBOX_LEASE_MINUTES} MINUTE),
        last_error = NULL, updated_at = NOW()
    WHERE id = ${row.id}
      AND (
        (status IN ('pending', 'failed') AND next_attempt_at <= NOW())
        OR (status = 'processing' AND lease_expires_at < NOW())
      )
  `);
  if (affectedRowsOf(claimed) !== 1) return null;
  const event = twDailyLineEventSchema.parse(
    typeof row.event_json === "string" ? JSON.parse(row.event_json) : row.event_json,
  );
  if (event.eventType !== "daily_digest_ready") throw new Error("LINE_DAILY_OUTBOX_EVENT_INVALID");
  const messages = z.array(z.object({
    type: z.literal("text"),
    text: z.string().min(1).max(LINE_TEXT_MAX_LENGTH),
  })).min(1).max(5).parse(
    typeof row.messages_json === "string" ? JSON.parse(row.messages_json) : row.messages_json,
  );
  return {
    id: Number(row.id),
    eventId: String(row.event_id),
    targetGroupId: String(row.target_group_id),
    event,
    messages,
    payloadHash: String(row.payload_hash),
    attemptCount: Number(row.attempt_count || 0) + 1,
    leaseToken,
    lineRetryKey: String(row.line_retry_key),
    firstExternalAttemptAt: row.first_external_attempt_at
      ? new Date(row.first_external_attempt_at)
      : null,
  };
}

function controlledDeliveryError(error: unknown): string {
  const code = error instanceof Error ? error.message : "LINE_DAILY_DELIVERY_FAILED";
  return /^LINE_DAILY_[A-Z0-9_]{1,180}$/.test(code)
    ? code
    : "LINE_DAILY_DELIVERY_FAILED";
}

async function markDailyLineOutboxSkipped(row: DailyLineOutboxRow, reason: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("LINE_DAILY_DATABASE_UNAVAILABLE");
  const result = await db.execute(sql`
    UPDATE tw_daily_line_outbox
    SET status = 'skipped', lease_token = NULL, lease_expires_at = NULL,
        last_error = ${reason}, updated_at = NOW()
    WHERE id = ${row.id} AND status = 'processing' AND lease_token = ${row.leaseToken}
  `);
  return affectedRowsOf(result) === 1;
}

async function markDailyLineOutboxManualReview(row: DailyLineOutboxRow, reason: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("LINE_DAILY_DATABASE_UNAVAILABLE");
  const result = await db.execute(sql`
    UPDATE tw_daily_line_outbox
    SET status = 'manual_review', lease_token = NULL, lease_expires_at = NULL,
        last_error = ${reason}, updated_at = NOW()
    WHERE id = ${row.id} AND status = 'processing' AND lease_token = ${row.leaseToken}
  `);
  return affectedRowsOf(result) === 1;
}

function isLineRetrySafetyWindowExpired(firstAttemptAt: Date | null, now = Date.now()): boolean {
  if (!firstAttemptAt) return false;
  const firstAttemptMs = firstAttemptAt.getTime();
  return !Number.isFinite(firstAttemptMs) || now - firstAttemptMs >= LINE_RETRY_SAFETY_WINDOW_MS;
}

async function reserveOutgoingMessageAudits(row: DailyLineOutboxRow): Promise<void> {
  const baseId = getAuditMessageId(row.eventId, row.targetGroupId);
  const stableTimestamp = Date.parse(row.event.occurredAt);
  for (let index = 0; index < row.messages.length; index += 1) {
    const reservation = await reserveLineOutgoingAudit({
      messageId: `${baseId}:${index + 1}`,
      sourceType: "group",
      lineGroupId: row.targetGroupId,
      senderName: "KG卡雅仕官方",
      content: row.messages[index].text,
      lineTimestamp: Number.isFinite(stableTimestamp) ? stableTimestamp : 0,
      pendingSummary: `SalesDash日報一括配信 準備中 ${index + 1}/${row.messages.length}`,
    });
    if (reservation.status !== "pending" && reservation.status !== "responded") {
      throw new Error("LINE_DAILY_AUDIT_TERMINAL_STATE");
    }
  }
}

async function finalizeOutgoingMessageAudits(row: DailyLineOutboxRow): Promise<void> {
  const baseId = getAuditMessageId(row.eventId, row.targetGroupId);
  for (let index = 0; index < row.messages.length; index += 1) {
    await finalizeLineOutgoingAudit(
      `${baseId}:${index + 1}`,
      `SalesDash日報一括配信 完了 ${index + 1}/${row.messages.length}`,
    );
  }
}

async function processClaimedDailyLineOutbox(row: DailyLineOutboxRow) {
  const db = await getDb();
  if (!db) throw new Error("LINE_DAILY_DATABASE_UNAVAILABLE");
  if (!isDigestDateDeliverable(row.event.payload.digestDate)) {
    if (row.firstExternalAttemptAt) {
      await markDailyLineOutboxManualReview(row, "LINE_DAILY_EXPIRED_AFTER_EXTERNAL_ATTEMPT");
      return { sent: false as const, manualReview: "expired_after_attempt" as const };
    }
    await markDailyLineOutboxSkipped(row, "LINE_DAILY_DIGEST_EXPIRED_BEFORE_ATTEMPT");
    return { sent: false as const, skipped: "expired_before_attempt" as const };
  }
  if (isLineRetrySafetyWindowExpired(row.firstExternalAttemptAt)) {
    await markDailyLineOutboxManualReview(row, "LINE_DAILY_RETRY_KEY_SAFETY_WINDOW_EXPIRED");
    return { sent: false as const, manualReview: "retry_window_expired" as const };
  }
  try {
    const activeGroupId = await getDailyReportGroupId();
    if (activeGroupId !== row.targetGroupId) throw new Error("LINE_DAILY_TARGET_GROUP_CHANGED");
    const memberCount = await assertDailyReportDeliveryQuota(row.targetGroupId);
    await reserveOutgoingMessageAudits(row);
    const attemptStarted = await db.execute(sql`
      UPDATE tw_daily_line_outbox
      SET first_external_attempt_at = COALESCE(first_external_attempt_at, NOW()), updated_at = NOW()
      WHERE id = ${row.id} AND status = 'processing' AND lease_token = ${row.leaseToken}
    `);
    if (affectedRowsOf(attemptStarted) !== 1) throw new Error("LINE_DAILY_LEASE_LOST");
    const delivered = await pushMessage(row.targetGroupId, row.messages, row.lineRetryKey);
    if (!delivered) throw new Error("LINE_DAILY_DELIVERY_UNCONFIRMED");
    await finalizeOutgoingMessageAudits(row);
    const finalized = await db.execute(sql`
      UPDATE tw_daily_line_outbox
      SET status = 'sent', member_count = ${memberCount}, sent_at = NOW(),
          lease_token = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = NOW()
      WHERE id = ${row.id} AND status = 'processing' AND lease_token = ${row.leaseToken}
    `);
    return {
      sent: true as const,
      leaseLost: affectedRowsOf(finalized) !== 1,
      messageObjectCount: row.messages.length,
      memberCount,
    };
  } catch (error) {
    const errorCode = controlledDeliveryError(error);
    const delaySeconds = Math.min(
      OUTBOX_MAX_BACKOFF_SECONDS,
      60 * 2 ** Math.min(Math.max(row.attemptCount - 1, 0), 6),
    );
    await db.execute(sql`
      UPDATE tw_daily_line_outbox
      SET status = 'failed', next_attempt_at = DATE_ADD(NOW(), INTERVAL ${delaySeconds} SECOND),
          lease_token = NULL, lease_expires_at = NULL, last_error = ${errorCode}, updated_at = NOW()
      WHERE id = ${row.id} AND status = 'processing' AND lease_token = ${row.leaseToken}
    `);
    return { sent: false as const, errorCode };
  }
}

let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;

export async function processTwDailyLineOutbox(limit = 20) {
  await ensureTwDailyLineStorage();
  if (workerRunning) return { skipped: "already_running" as const, processed: 0, sent: 0, failed: 0 };
  workerRunning = true;
  let processed = 0;
  let sent = 0;
  let failed = 0;
  try {
    for (let index = 0; index < Math.min(Math.max(limit, 1), 100); index += 1) {
      const row = await claimNextDailyLineOutbox();
      if (!row) break;
      processed += 1;
      const result = await processClaimedDailyLineOutbox(row);
      if (result.sent) sent += 1;
      else if (!("skipped" in result)) failed += 1;
    }
    return { processed, sent, failed };
  } finally {
    workerRunning = false;
  }
}

export function triggerTwDailyLineOutboxSoon() {
  const timer = setTimeout(() => {
    processTwDailyLineOutbox().catch(error => {
      console.error("[TwDailyLine] Outbox worker failed", {
        code: controlledDeliveryError(error),
      });
    });
  }, 0);
  timer.unref?.();
}

export function startTwDailyLineOutboxWorker() {
  if (workerTimer) return workerTimer;
  triggerTwDailyLineOutboxSoon();
  workerTimer = setInterval(triggerTwDailyLineOutboxSoon, OUTBOX_WORKER_INTERVAL_MS);
  workerTimer.unref?.();
  return workerTimer;
}

export async function deliverTwDailyLineEvent(event: TwDailyLineBridgeEvent) {
  if (event.eventType === "daily_report_saved") {
    await saveDailyReportEvent(event);
    return {
      delivered: true as const,
      accepted: true as const,
      deliveryMode: "daily_batch" as const,
      targetCount: 0,
      deliveredCount: 0,
    };
  }

  if (!isDigestDateDeliverable(event.payload.digestDate)) {
    return {
      delivered: true as const,
      skipped: "expired_digest" as const,
      targetCount: 0,
      deliveredCount: 0,
    };
  }

  const queued = await enqueueDigestDelivery(event);
  if (queued.queued) triggerTwDailyLineOutboxSoon();
  return {
    delivered: false as const,
    accepted: true as const,
    queued: queued.queued,
    targetCount: queued.targetCount,
    deliveredCount: 0,
    deduplicatedCount: queued.deduplicated ? 1 : 0,
    messageObjectCount: queued.messageObjectCount,
  };
}

export const __twDailyLineBridgeTestUtils = {
  chunkDailyReports,
  getAuditMessageId,
  isDigestDateDeliverable,
  isLineRetrySafetyWindowExpired,
  resetPublicKeyCache: () => {
    publicKeyCache = null;
  },
};
