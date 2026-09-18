import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { createHash } from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import { createLivestreamHeaderCropDataUrl } from "./livestreamScreenshotImage";
import { deriveLivestreamDurationMinutes } from "./livestreamTime";

const LOCK_NAME = "lcj_livestream_timing_repair_v1";
const PRE_BACKUP_REASON = "pre-livestream-timing-repair-v1";
const POST_BACKUP_REASON = "post-livestream-timing-repair-v1";
const MAX_CANDIDATES_PER_RUN = 100;

interface TimingCandidate extends RowDataPacket {
  id: number;
  liverId: number | null;
  streamAccountLiverId: number | null;
  livestreamDate: Date;
  livestreamEndTime: Date | null;
  duration: number | null;
  screenshotUrl: string | null;
  createdAt: Date;
  repairMode: "future_ocr" | "endpoint_duration";
}

interface ExtractedTiming {
  start: Date;
  end: Date;
  durationMinutes: number;
  evidenceText: string;
  evidenceSource: "screenshot_ocr" | "persisted_endpoints";
  imageSha256?: string;
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for livestream timing repair");
  return mysql.createPool(databaseUrl);
}

async function tableExists(connection: PoolConnection, tableName: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS livestream_timing_repair_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    repairKey varchar(160) NOT NULL,
    status varchar(20) NOT NULL,
    candidateCount int NOT NULL DEFAULT 0,
    repairedCount int NOT NULL DEFAULT 0,
    mergedPlaceholderCount int NOT NULL DEFAULT 0,
    details json NULL,
    errorMessage text NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY livestream_timing_repair_key_unique (repairKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [tableRows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'db_backup_runs' LIMIT 1`,
  );
  if (tableRows.length === 0) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs",
  );
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, errorMessage FROM db_backup_runs
     WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1`,
    [before, reason],
  );
  const row = rows[0];
  if (!row || row.status !== "success") {
    throw new Error(`required database backup failed reason=${reason}: ${String(row?.errorMessage || "missing success run")}`);
  }
  return Number(row.id);
}

async function loadCandidates(pool: Pool): Promise<TimingCandidate[]> {
  const [rows] = await pool.query<TimingCandidate[]>(
    `SELECT id, liverId, streamAccountLiverId, livestreamDate, livestreamEndTime,
            duration, screenshotUrl, createdAt,
            CASE
              WHEN screenshotUrl IS NOT NULL
               AND livestreamDate > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
              THEN 'future_ocr'
              ELSE 'endpoint_duration'
            END AS repairMode
     FROM brand_livestreams
     WHERE deletedAt IS NULL
       AND (
         (screenshotUrl IS NOT NULL
          AND livestreamDate > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))
         OR
         (livestreamEndTime IS NOT NULL
          AND TIMESTAMPDIFF(MINUTE, livestreamDate, livestreamEndTime) BETWEEN 1 AND 10080
          AND (duration IS NULL
               OR duration <> TIMESTAMPDIFF(MINUTE, livestreamDate, livestreamEndTime)))
       )
     ORDER BY CASE WHEN screenshotUrl IS NOT NULL
                       AND livestreamDate > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
                   THEN 0 ELSE 1 END, id ASC
     LIMIT ?`,
    [MAX_CANDIDATES_PER_RUN],
  );
  return rows;
}

export function parseLivestreamEvidenceDateTime(
  rawValue: string,
  createdAt: Date,
  rawTimezone: string | null,
): Date | null {
  const timezoneOffset = rawTimezone
    ?.match(/(?:UTC)?([+-]\d{2}:?\d{2})/i)?.[1]
    ?.replace(/^(\+|-)(\d{2})(\d{2})$/, "$1$2:$3") || "+09:00";
  let normalized = rawValue.trim();
  const localized = normalized.match(
    /^(?:(\d{4})[年/-])?(\d{1,2})月(\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (localized) {
    const year = localized[1] || String(createdAt.getUTCFullYear());
    normalized = `${year}-${localized[2].padStart(2, "0")}-${localized[3].padStart(2, "0")}T${localized[4].padStart(2, "0")}:${localized[5]}:${localized[6] || "00"}`;
  }
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    normalized += timezoneOffset;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function classifyLivestreamTimingFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/^[a-z0-9_]+$/.test(message)) return message;
  if (/model_not_found|does not exist|do not have access/i.test(message)) return "llm_model_unavailable";
  if (/401|unauthorized|invalid_api_key/i.test(message)) return "llm_auth_failed";
  if (/429|rate.?limit/i.test(message)) return "llm_rate_limited";
  if (/fetch|network|timeout/i.test(message)) return "screenshot_fetch_failed";
  return "timing_extraction_failed";
}

async function extractTiming(candidate: TimingCandidate): Promise<ExtractedTiming> {
  if (!candidate.screenshotUrl) throw new Error("screenshot_missing");
  const response = await fetch(candidate.screenshotUrl);
  if (!response.ok) throw new Error(`screenshot_fetch_http_${response.status}`);
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  if (imageBuffer.length === 0) throw new Error("screenshot_empty");
  if (imageBuffer.length > 12 * 1024 * 1024) throw new Error("screenshot_too_large");

  const base64 = imageBuffer.toString("base64");
  const content: Array<Record<string, unknown>> = [{
    type: "text",
    text: `この配信結果画像の上部ヘッダーだけをOCRしてください。登録日時は${candidate.createdAt.toISOString()}です。年が表示されていない場合は登録日時と同じ年を使ってください。startDateTimeとendDateTimeは必ず年・月・日・時・分・秒・UTCオフセットを含むISO 8601（例: 2026-09-11T10:27:41+08:00）で返してください。開始・終了日時、配信時間以外の数値を日時として扱わないでください。`,
  }];
  const headerCrop = await createLivestreamHeaderCropDataUrl(base64);
  if (headerCrop) {
    content.push({
      type: "image_url",
      image_url: { url: headerCrop, detail: "high" },
    });
  } else {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${response.headers.get("content-type") || "image/jpeg"};base64,${base64}`,
        detail: "high",
      },
    });
  }

  const llm = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "ライブ配信結果画像の日時欄を正確に読むOCRです。見えない値はnullにし、推測した未来日は返しません。",
      },
      { role: "user", content: content as any },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "livestream_timing_repair",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            startDateTime: { type: ["string", "null"] },
            endDateTime: { type: ["string", "null"] },
            durationMinutes: { type: ["number", "null"] },
            timezone: { type: ["string", "null"] },
            evidenceText: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: [
            "startDateTime",
            "endDateTime",
            "durationMinutes",
            "timezone",
            "evidenceText",
            "confidence",
          ],
        },
      },
    },
  });

  const raw = llm.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("llm_content_missing");
  let parsed: {
    startDateTime: string | null;
    endDateTime: string | null;
    durationMinutes: number | null;
    timezone: string | null;
    evidenceText: string;
    confidence: "high" | "medium" | "low";
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("llm_json_invalid");
  }
  if (!parsed.startDateTime || !parsed.endDateTime) throw new Error("datetime_missing");
  if (parsed.confidence === "low") throw new Error("confidence_low");

  const createdAt = new Date(candidate.createdAt);
  const start = parseLivestreamEvidenceDateTime(parsed.startDateTime, createdAt, parsed.timezone);
  const end = parseLivestreamEvidenceDateTime(parsed.endDateTime, createdAt, parsed.timezone);
  if (!start || !end) throw new Error("datetime_parse_failed");
  const derivedDuration = deriveLivestreamDurationMinutes(start, end);
  if (derivedDuration === null) throw new Error("endpoint_interval_invalid");
  const statedDuration = Number(parsed.durationMinutes);
  if (
    Number.isFinite(statedDuration) &&
    statedDuration > 0 &&
    Math.abs(statedDuration - derivedDuration) > 5
  ) {
    throw new Error("duration_mismatch");
  }

  if (
    start.getTime() < createdAt.getTime() - 366 * 24 * 60 * 60 * 1000 ||
    end.getTime() > createdAt.getTime() + 24 * 60 * 60 * 1000
  ) {
    throw new Error("evidence_outside_upload_window");
  }

  return {
    start,
    end,
    durationMinutes: derivedDuration,
    evidenceText: parsed.evidenceText.slice(0, 500),
    evidenceSource: "screenshot_ocr",
    imageSha256: createHash("sha256").update(imageBuffer).digest("hex"),
  };
}

function timingFromPersistedEndpoints(candidate: TimingCandidate): ExtractedTiming | null {
  if (!candidate.livestreamEndTime) return null;
  const durationMinutes = deriveLivestreamDurationMinutes(
    candidate.livestreamDate,
    candidate.livestreamEndTime,
  );
  if (durationMinutes === null) return null;
  return {
    start: new Date(candidate.livestreamDate),
    end: new Date(candidate.livestreamEndTime),
    durationMinutes,
    evidenceText: "persisted start/end timestamp interval",
    evidenceSource: "persisted_endpoints",
  };
}

const PLACEHOLDER_CHILD_TABLES = [
  "livestream_products",
  "contract_livestream_links",
  "csv_import_history",
  "ad_investment_records",
  "screenshot_analysis_history",
  "livestream_sets",
  "simulation_feedback",
  "aitherhub_sync_logs",
  "set_applications",
  "brand_portal_performance",
  "livestream_promotions",
  "master_set_adoptions",
  "livestream_realtime_records",
  "livestream_realtime_snapshots",
  "livestream_lucky_bag_images",
  "livestream_csv_snapshots",
  "livestream_csv_products",
  "auction_records",
] as const;

async function moveLivestreamBrandRows(
  connection: PoolConnection,
  placeholderId: number,
  targetId: number,
): Promise<void> {
  if (!(await tableExists(connection, "livestream_brands"))) return;
  await connection.execute(
    `UPDATE livestream_brands source
     LEFT JOIN livestream_brands target
       ON target.livestreamId = ? AND target.brandId = source.brandId
     SET source.livestreamId = ?
     WHERE source.livestreamId = ? AND target.id IS NULL`,
    [targetId, targetId, placeholderId],
  );
  await connection.execute(
    `UPDATE livestream_brands target
     JOIN livestream_brands source
       ON source.livestreamId = ? AND source.brandId = target.brandId
     SET target.durationMinutes = COALESCE(target.durationMinutes, source.durationMinutes),
         target.gmv = COALESCE(target.gmv, source.gmv)
     WHERE target.livestreamId = ?`,
    [placeholderId, targetId],
  );
  await connection.execute(
    `DELETE source FROM livestream_brands source
     JOIN livestream_brands target
       ON target.livestreamId = ? AND target.brandId = source.brandId
     WHERE source.livestreamId = ?`,
    [targetId, placeholderId],
  );
}

async function mergeMatchingPlaceholder(
  connection: PoolConnection,
  candidate: TimingCandidate,
  timing: ExtractedTiming,
): Promise<number | null> {
  const identityId = candidate.streamAccountLiverId ?? candidate.liverId;
  if (!identityId) return null;
  const searchStart = new Date(timing.start.getTime() - 30 * 60 * 1000);
  const searchEnd = new Date(timing.end.getTime() + 30 * 60 * 1000);
  const createdStart = new Date(new Date(candidate.createdAt).getTime() - 2 * 60 * 60 * 1000);
  const createdEnd = new Date(new Date(candidate.createdAt).getTime() + 2 * 60 * 60 * 1000);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM brand_livestreams
     WHERE id <> ? AND (liverId = ? OR streamAccountLiverId = ?) AND deletedAt IS NULL
       AND brandId = 0 AND screenshotUrl IS NULL AND beforeScreenshotUrl IS NULL
       AND salesAmount IS NULL AND manualSalesAmount IS NULL AND gmv IS NULL
       AND duration IS NULL AND livestreamEndTime IS NULL
       AND livestreamDate BETWEEN ? AND ?
       AND createdAt BETWEEN ? AND ?
     ORDER BY createdAt DESC LIMIT 2`,
    [candidate.id, identityId, identityId, searchStart, searchEnd, createdStart, createdEnd],
  );
  if (rows.length > 1) {
    console.warn(`[LivestreamTimingRepair] ambiguous placeholders for livestream ${candidate.id}`);
    return null;
  }
  const placeholderId = Number(rows[0]?.id || 0);
  if (!placeholderId) return null;

  for (const tableName of PLACEHOLDER_CHILD_TABLES) {
    if (await tableExists(connection, tableName)) {
      await connection.execute(
        `UPDATE \`${tableName}\` SET livestreamId = ? WHERE livestreamId = ?`,
        [candidate.id, placeholderId],
      );
    }
  }
  await moveLivestreamBrandRows(connection, placeholderId, candidate.id);
  if (await tableExists(connection, "ai_coach_messages")) {
    await connection.execute(
      `UPDATE ai_coach_messages SET contextId = ?
       WHERE contextType = 'livestream' AND contextId = ?`,
      [candidate.id, placeholderId],
    );
  }
  if (await tableExists(connection, "brand_edit_logs")) {
    await connection.execute(
      `UPDATE brand_edit_logs SET entityId = ?
       WHERE entityType = 'livestream' AND entityId = ?`,
      [candidate.id, placeholderId],
    );
  }
  for (const tableName of PLACEHOLDER_CHILD_TABLES) {
    if (!(await tableExists(connection, tableName))) continue;
    const [remaining] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE livestreamId = ?`,
      [placeholderId],
    );
    if (Number(remaining[0]?.count || 0) !== 0) {
      throw new Error(`unmigrated ${tableName} rows remain for placeholder ${placeholderId}`);
    }
  }
  if (await tableExists(connection, "livestream_brands")) {
    const [remainingBrands] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM livestream_brands WHERE livestreamId = ?",
      [placeholderId],
    );
    if (Number(remainingBrands[0]?.count || 0) !== 0) {
      throw new Error(`unmigrated livestream_brands rows remain for placeholder ${placeholderId}`);
    }
  }
  await connection.execute(
    `UPDATE brand_livestreams
     SET deletedAt = CURRENT_TIMESTAMP,
         remarks = CONCAT_WS('\n', NULLIF(remarks, ''), ?)
     WHERE id = ? AND deletedAt IS NULL`,
    [`auto-merged into livestream ${candidate.id} by timing repair`, placeholderId],
  );
  return placeholderId;
}

async function applyRepair(
  connection: PoolConnection,
  candidate: TimingCandidate,
  timing: ExtractedTiming,
): Promise<number | null> {
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE brand_livestreams
     SET livestreamDate = ?, livestreamEndTime = ?, duration = ?
     WHERE id = ? AND deletedAt IS NULL AND livestreamDate = ?`,
    [timing.start, timing.end, timing.durationMinutes, candidate.id, candidate.livestreamDate],
  );
  if (result.affectedRows !== 1) {
    throw new Error(`livestream ${candidate.id} changed during timing repair`);
  }

  if (await tableExists(connection, "livestream_brands")) {
    await connection.execute(
      `UPDATE livestream_brands
       SET durationMinutes = ?
       WHERE livestreamId = ? AND (durationMinutes IS NULL OR durationMinutes = ?)`,
      [timing.durationMinutes, candidate.id, candidate.duration],
    );
  }
  return await mergeMatchingPlaceholder(connection, candidate, timing);
}

export async function runLivestreamTimingRepair(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const pool = createPool();
  let lockAcquired = false;
  let repairKey: string | null = null;
  try {
    await ensureRunTable(pool);
    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS acquired", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!lockAcquired) return;

    const candidates = await loadCandidates(pool);
    if (candidates.length === 0) {
      console.log("[LivestreamTimingRepair] healthy: no timing anomalies");
      return;
    }

    const candidateDigest = createHash("sha256")
      .update(candidates.map(item => `${item.id}:${item.repairMode}`).join(","))
      .digest("hex")
      .slice(0, 24);
    repairKey = `livestream-timing-v2-${candidateDigest}-${Date.now().toString(36)}`;
    const extracted: Array<{ candidate: TimingCandidate; timing: ExtractedTiming }> = [];
    const skipped: Array<{ livestreamId: number; repairMode: string; reason: string }> = [];
    for (const candidate of candidates) {
      try {
        const timing = candidate.repairMode === "endpoint_duration"
          ? timingFromPersistedEndpoints(candidate)
          : await extractTiming(candidate);
        if (timing) {
          extracted.push({ candidate, timing });
        } else {
          skipped.push({
            livestreamId: candidate.id,
            repairMode: candidate.repairMode,
            reason: "evidence_not_accepted",
          });
        }
      } catch (error) {
        console.warn(`[LivestreamTimingRepair] OCR failed for ${candidate.id}`, error);
        skipped.push({
          livestreamId: candidate.id,
          repairMode: candidate.repairMode,
          reason: classifyLivestreamTimingFailure(error),
        });
      }
    }
    if (extracted.length === 0) {
      await pool.execute(
        `INSERT INTO livestream_timing_repair_runs
          (repairKey, status, candidateCount, repairedCount, mergedPlaceholderCount, details, completedAt)
         VALUES (?, 'no_evidence', ?, 0, 0, ?, CURRENT_TIMESTAMP)`,
        [repairKey, candidates.length, JSON.stringify({ skipped })],
      );
      console.warn(`[LivestreamTimingRepair] ${candidates.length} anomalies found but none passed evidence checks`);
      return;
    }

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await pool.execute<ResultSetHeader>(
      `INSERT INTO livestream_timing_repair_runs
        (repairKey, status, candidateCount, repairedCount, mergedPlaceholderCount, details)
       VALUES (?, 'running', ?, 0, 0, ?)
      `,
      [repairKey, candidates.length, JSON.stringify({ preBackupId, skipped })],
    );
    const connection = await pool.getConnection();
    const repaired: Array<Record<string, unknown>> = [];
    try {
      await connection.beginTransaction();
      for (const item of extracted) {
        const placeholderId = await applyRepair(connection, item.candidate, item.timing);
        repaired.push({
          livestreamId: item.candidate.id,
          previousDate: new Date(item.candidate.livestreamDate).toISOString(),
          correctedDate: item.timing.start.toISOString(),
          correctedEndTime: item.timing.end.toISOString(),
          correctedDuration: item.timing.durationMinutes,
          mergedPlaceholderId: placeholderId,
          evidenceText: item.timing.evidenceText,
          evidenceSource: item.timing.evidenceSource,
          imageSha256: item.timing.imageSha256 || null,
          previousEndTime: item.candidate.livestreamEndTime
            ? new Date(item.candidate.livestreamEndTime).toISOString()
            : null,
          previousDuration: item.candidate.duration,
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const mergedPlaceholderCount = repaired.filter(item => item.mergedPlaceholderId).length;
    await pool.execute(
      `UPDATE livestream_timing_repair_runs
       SET status='repaired', repairedCount=?, mergedPlaceholderCount=?,
           completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
       WHERE repairKey=?`,
      [
        repaired.length,
        mergedPlaceholderCount,
        JSON.stringify({ preBackupId, repaired, skipped }),
        repairKey,
      ],
    );
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE livestream_timing_repair_runs
       SET status='success', details=? WHERE repairKey=?`,
      [JSON.stringify({ preBackupId, postBackupId, repaired, skipped }), repairKey],
    );
    console.log(`[LivestreamTimingRepair] success repaired=${repaired.length} merged=${mergedPlaceholderCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (repairKey) {
      await pool.execute(
        `UPDATE livestream_timing_repair_runs
         SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE repairKey=?`,
        [message.slice(0, 4000), repairKey],
      ).catch(() => undefined);
    }
    console.error("[LivestreamTimingRepair] failed", error);
  } finally {
    if (lockAcquired) {
      await pool.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    }
    await pool.end();
  }
}

export async function getLivestreamTimingRepairHealth(): Promise<{
  available: boolean;
  anomalyCount: number;
  latestRun: null | {
    status: string;
    candidateCount: number;
    repairedCount: number;
    mergedPlaceholderCount: number;
    hasError: boolean;
    reasonCodes: string[];
    completedAt: Date | null;
  };
}> {
  if (!process.env.DATABASE_URL) {
    return { available: false, anomalyCount: 0, latestRun: null };
  }
  const pool = createPool();
  try {
    const [tableRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'livestream_timing_repair_runs' LIMIT 1`,
    );
    if (tableRows.length === 0) {
      return { available: false, anomalyCount: 0, latestRun: null };
    }
    const [anomalyRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM brand_livestreams
       WHERE deletedAt IS NULL
         AND (
           (screenshotUrl IS NOT NULL
            AND livestreamDate > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))
           OR
           (livestreamEndTime IS NOT NULL
            AND TIMESTAMPDIFF(MINUTE, livestreamDate, livestreamEndTime) BETWEEN 1 AND 10080
            AND (duration IS NULL
                 OR duration <> TIMESTAMPDIFF(MINUTE, livestreamDate, livestreamEndTime)))
         )`,
    );
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, candidateCount, repairedCount, mergedPlaceholderCount,
              details, errorMessage, completedAt
       FROM livestream_timing_repair_runs ORDER BY id DESC LIMIT 1`,
    );
    const row = runRows[0];
    let reasonCodes: string[] = [];
    if (row?.details) {
      try {
        const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
        reasonCodes = Array.from(new Set(
          (Array.isArray(details?.skipped) ? details.skipped : [])
            .map((item: unknown) => String((item as { reason?: unknown })?.reason || ""))
            .filter(Boolean),
        )).slice(0, 20);
      } catch {
        reasonCodes = ["details_unreadable"];
      }
    }
    return {
      available: true,
      anomalyCount: Number(anomalyRows[0]?.count || 0),
      latestRun: row
        ? {
            status: String(row.status),
            candidateCount: Number(row.candidateCount || 0),
            repairedCount: Number(row.repairedCount || 0),
            mergedPlaceholderCount: Number(row.mergedPlaceholderCount || 0),
            hasError: Boolean(row.errorMessage),
            reasonCodes,
            completedAt: row.completedAt ? new Date(row.completedAt) : null,
          }
        : null,
    };
  } finally {
    await pool.end();
  }
}
