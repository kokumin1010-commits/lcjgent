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
const MAX_CANDIDATES_PER_RUN = 25;

interface TimingCandidate extends RowDataPacket {
  id: number;
  liverId: number | null;
  livestreamDate: Date;
  livestreamEndTime: Date | null;
  duration: number | null;
  screenshotUrl: string;
  createdAt: Date;
}

interface ExtractedTiming {
  start: Date;
  end: Date;
  durationMinutes: number;
  evidenceText: string;
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
    `SELECT id, liverId, livestreamDate, livestreamEndTime, duration, screenshotUrl, createdAt
     FROM brand_livestreams
     WHERE deletedAt IS NULL
       AND screenshotUrl IS NOT NULL
       AND livestreamDate > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY)
     ORDER BY id ASC
     LIMIT ?`,
    [MAX_CANDIDATES_PER_RUN],
  );
  return rows;
}

async function extractTiming(candidate: TimingCandidate): Promise<ExtractedTiming | null> {
  const response = await fetch(candidate.screenshotUrl);
  if (!response.ok) return null;
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  if (imageBuffer.length === 0 || imageBuffer.length > 12 * 1024 * 1024) return null;

  const base64 = imageBuffer.toString("base64");
  const content: Array<Record<string, unknown>> = [
    {
      type: "image_url",
      image_url: {
        url: `data:${response.headers.get("content-type") || "image/jpeg"};base64,${base64}`,
        detail: "high",
      },
    },
  ];
  const headerCrop = await createLivestreamHeaderCropDataUrl(base64);
  if (headerCrop) {
    content.push({
      type: "image_url",
      image_url: { url: headerCrop, detail: "high" },
    });
  }
  content.push({
    type: "text",
    text: `この配信結果画像の上部ヘッダーだけをOCRしてください。登録日時は${candidate.createdAt.toISOString()}です。年が表示されていない場合は登録日時と同じ年を使い、画像に表示されたタイムゾーンをISO 8601オフセットとして保持してください。開始・終了日時、配信時間以外の数値を日時として扱わないでください。`,
  });

  const llm = await invokeLLM({
    model: "gemini-3.1-pro-preview",
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
  if (!raw || typeof raw !== "string") return null;
  const parsed = JSON.parse(raw) as {
    startDateTime: string | null;
    endDateTime: string | null;
    durationMinutes: number | null;
    timezone: string | null;
    evidenceText: string;
    confidence: "high" | "medium" | "low";
  };
  if (!parsed.startDateTime || !parsed.endDateTime || parsed.confidence === "low") return null;

  const timezoneOffset = parsed.timezone?.match(/(?:UTC)?([+-]\d{2}:?\d{2})/i)?.[1]?.replace(/^(\+|-)(\d{2})(\d{2})$/, "$1$2:$3") || "";
  const withTimezone = (value: string) =>
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) || !timezoneOffset
      ? value
      : `${value}${timezoneOffset}`;
  const start = new Date(withTimezone(parsed.startDateTime));
  const end = new Date(withTimezone(parsed.endDateTime));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const derivedDuration = deriveLivestreamDurationMinutes(start, end);
  if (derivedDuration === null) return null;
  const statedDuration = Number(parsed.durationMinutes);
  if (
    Number.isFinite(statedDuration) &&
    statedDuration > 0 &&
    Math.abs(statedDuration - derivedDuration) > 5
  ) {
    return null;
  }

  const createdAt = new Date(candidate.createdAt);
  if (
    start.getTime() < createdAt.getTime() - 72 * 60 * 60 * 1000 ||
    end.getTime() > createdAt.getTime() + 6 * 60 * 60 * 1000
  ) {
    return null;
  }

  return {
    start,
    end,
    durationMinutes: derivedDuration,
    evidenceText: parsed.evidenceText.slice(0, 500),
  };
}

const PLACEHOLDER_CHILD_TABLES = [
  "livestream_realtime_records",
  "livestream_realtime_snapshots",
  "livestream_lucky_bag_images",
  "livestream_csv_snapshots",
  "livestream_csv_products",
] as const;

async function mergeMatchingPlaceholder(
  connection: PoolConnection,
  candidate: TimingCandidate,
  timing: ExtractedTiming,
): Promise<number | null> {
  if (!candidate.liverId) return null;
  const searchStart = new Date(timing.start.getTime() - 30 * 60 * 1000);
  const searchEnd = new Date(timing.end.getTime() + 30 * 60 * 1000);
  const createdStart = new Date(new Date(candidate.createdAt).getTime() - 2 * 60 * 60 * 1000);
  const createdEnd = new Date(new Date(candidate.createdAt).getTime() + 2 * 60 * 60 * 1000);
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM brand_livestreams
     WHERE id <> ? AND liverId = ? AND deletedAt IS NULL
       AND brandId = 0 AND screenshotUrl IS NULL AND beforeScreenshotUrl IS NULL
       AND salesAmount IS NULL AND manualSalesAmount IS NULL AND gmv IS NULL
       AND duration IS NULL AND livestreamEndTime IS NULL
       AND livestreamDate BETWEEN ? AND ?
       AND createdAt BETWEEN ? AND ?
     ORDER BY createdAt DESC LIMIT 1`,
    [candidate.id, candidate.liverId, searchStart, searchEnd, createdStart, createdEnd],
  );
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
  if (await tableExists(connection, "ai_coach_messages")) {
    await connection.execute(
      `UPDATE ai_coach_messages SET contextId = ?
       WHERE contextType = 'livestream' AND contextId = ?`,
      [candidate.id, placeholderId],
    );
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
      console.log("[LivestreamTimingRepair] healthy: no future-dated screenshot records");
      return;
    }

    const extracted: Array<{ candidate: TimingCandidate; timing: ExtractedTiming }> = [];
    for (const candidate of candidates) {
      try {
        const timing = await extractTiming(candidate);
        if (timing) extracted.push({ candidate, timing });
      } catch (error) {
        console.warn(`[LivestreamTimingRepair] OCR failed for ${candidate.id}`, error);
      }
    }
    if (extracted.length === 0) {
      console.warn(`[LivestreamTimingRepair] ${candidates.length} anomalies found but none passed evidence checks`);
      return;
    }

    const candidateDigest = createHash("sha256")
      .update(extracted.map(item => item.candidate.id).join(","))
      .digest("hex")
      .slice(0, 32);
    repairKey = `livestream-timing-v1-${candidateDigest}`;
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM livestream_timing_repair_runs WHERE repairKey = ? LIMIT 1",
      [repairKey],
    );
    if (existing[0]?.status === "success") return;

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await pool.execute<ResultSetHeader>(
      `INSERT INTO livestream_timing_repair_runs
        (repairKey, status, candidateCount, repairedCount, mergedPlaceholderCount, details)
       VALUES (?, 'running', ?, 0, 0, ?)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, errorMessage=NULL, details=VALUES(details)`,
      [repairKey, candidates.length, JSON.stringify({ preBackupId })],
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
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const mergedPlaceholderCount = repaired.filter(item => item.mergedPlaceholderId).length;
    await pool.execute(
      `UPDATE livestream_timing_repair_runs
       SET status='success', repairedCount=?, mergedPlaceholderCount=?,
           completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
       WHERE repairKey=?`,
      [
        repaired.length,
        mergedPlaceholderCount,
        JSON.stringify({ preBackupId, postBackupId, repaired }),
        repairKey,
      ],
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
