import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.join(__dirname, "drizzle");
const REQUIRED_MIGRATION_TAGS = [
  "0161_tw_daily_line_bridge",
  "0162_daily_report_reliable_submission",
  "0163_task_completion_acceptance",
];
const LOCK_NAME = "lcjgent-required-0161-0163-critical-schema";
const MAX_CONNECT_ATTEMPTS = 5;

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function mysqlErrorCode(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = String(current.code || "");
    if (code) return code;
    const message = String(current.message || "");
    if (/^(?:STARTUP_MIGRATION|DATABASE_URL)_[A-Z0-9_]+$/.test(message)) return message;
    current = current.cause;
  }
  return "UNKNOWN";
}

function isDuplicateMysqlSchemaObject(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = String(current.code || "");
    const message = String(current.message || "");
    if (code === "ER_DUP_FIELDNAME" || message.includes("Duplicate column")) return true;
    if (code === "ER_DUP_KEYNAME" || message.includes("Duplicate key name")) return true;
    if (code === "ER_TRG_ALREADY_EXISTS" || message.includes("Trigger already exists")) return true;
    current = current.cause;
  }
  return false;
}

function isOptionalTriggerUnavailable(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = String(current.code || "").toUpperCase();
    const errno = Number(current.errno || 0);
    const message = String(current.message || "").toLowerCase();
    if (errno === 1227
      || errno === 1235
      || code === "ER_SPECIFIC_ACCESS_DENIED_ERROR"
      || code === "ER_TABLEACCESS_DENIED_ERROR"
      || code === "ER_NOT_SUPPORTED_YET"
      || (message.includes("trigger") && (
        message.includes("not supported")
        || message.includes("unsupported")
        || message.includes("denied")
      ))) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

async function connectWithRetry(connectionString) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await mysql.createConnection(connectionString);
    } catch (error) {
      lastError = error;
      console.error("[StartupMigration] Database connection failed", {
        attempt,
        code: mysqlErrorCode(error),
      });
      if (attempt < MAX_CONNECT_ATTEMPTS) await sleep(attempt * 2_000);
    }
  }
  throw lastError;
}

async function readMigrationDescriptor(migrationTag) {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  const journal = JSON.parse(await fs.readFile(journalPath, "utf8"));
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  const targetIndex = entries.findIndex(entry => entry?.tag === migrationTag);
  if (targetIndex <= 0) throw new Error("STARTUP_MIGRATION_JOURNAL_ENTRY_MISSING");
  const targetEntry = entries[targetIndex];
  const previousEntry = entries[targetIndex - 1];
  const migrationPath = path.join(MIGRATIONS_FOLDER, `${migrationTag}.sql`);
  const previousMigrationPath = path.join(
    MIGRATIONS_FOLDER,
    `${String(previousEntry.tag || "")}.sql`,
  );
  const [migrationSql, previousMigrationSql] = await Promise.all([
    fs.readFile(migrationPath, "utf8"),
    fs.readFile(previousMigrationPath, "utf8"),
  ]);
  return {
    tag: migrationTag,
    folderMillis: Number(targetEntry.when),
    previousFolderMillis: Number(previousEntry.when),
    previousHash: createHash("sha256").update(previousMigrationSql).digest("hex"),
    hash: createHash("sha256").update(migrationSql).digest("hex"),
    statements: migrationSql
      .split("--> statement-breakpoint")
      .map(statement => statement.trim())
      .filter(Boolean),
  };
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.count || 0) === 1;
}

async function readDrizzleLedgerState(connection, descriptor) {
  if (!(await tableExists(connection, "__drizzle_migrations"))) {
    return {
      ledgerAvailable: false,
      alreadyRecorded: false,
      canRecordSafely: false,
    };
  }
  const [sameTimestampRows] = await connection.execute(
    "SELECT hash FROM __drizzle_migrations WHERE created_at = ? ORDER BY id",
    [descriptor.folderMillis],
  );
  const timestampHashes = Array.isArray(sameTimestampRows)
    ? sameTimestampRows.map(row => String(row.hash || ""))
    : [];
  if (timestampHashes.some(hash => hash !== descriptor.hash)) {
    throw new Error("STARTUP_MIGRATION_LEDGER_HASH_MISMATCH");
  }
  const alreadyRecorded = timestampHashes.includes(descriptor.hash);
  const [previousTimestampRows] = await connection.execute(
    "SELECT hash FROM __drizzle_migrations WHERE created_at = ? ORDER BY id",
    [descriptor.previousFolderMillis],
  );
  const previousTimestampHashes = Array.isArray(previousTimestampRows)
    ? previousTimestampRows.map(row => String(row.hash || ""))
    : [];
  const predecessorRecordedExactly =
    previousTimestampHashes.length > 0 &&
    previousTimestampHashes.every(hash => hash === descriptor.previousHash);
  return {
    ledgerAvailable: true,
    alreadyRecorded,
    canRecordSafely: alreadyRecorded || predecessorRecordedExactly,
  };
}

function hasRequiredIndex(indexRows, tableName, indexName, columns, unique) {
  const matchingRows = indexRows
    .filter(row =>
      String(row.tableName || row.TABLE_NAME || "") === tableName &&
      String(row.indexName || row.INDEX_NAME || "") === indexName,
    )
    .sort((left, right) =>
      Number(left.seqInIndex || left.SEQ_IN_INDEX || 0) -
      Number(right.seqInIndex || right.SEQ_IN_INDEX || 0),
    );
  if (matchingRows.length !== columns.length) return false;
  if (matchingRows.some(row => Number(row.nonUnique ?? row.NON_UNIQUE ?? 1) !== (unique ? 0 : 1))) {
    return false;
  }
  return columns.every(
    (columnName, index) =>
      String(matchingRows[index]?.columnName || matchingRows[index]?.COLUMN_NAME || "") === columnName,
  );
}

async function verifyRequiredSchema(connection) {
  const readinessQueries = [
    "SELECT dailyReportEnabled FROM line_group_settings LIMIT 0",
    `SELECT report_id, latest_event_id, report_date, staff_name, action, content,
            findings, notes, edit_count, occurred_at, payload_hash, received_at, updated_at
       FROM tw_daily_line_report_inbox LIMIT 0`,
    "SELECT rollout_key, target_group_id, applied_at FROM tw_daily_line_rollouts LIMIT 0",
    `SELECT id, event_id, target_group_id, event_json, messages_json, payload_hash,
            status, attempt_count, next_attempt_at, lease_token, lease_expires_at,
            line_retry_key, first_external_attempt_at, member_count, sent_at,
            last_error, created_at, updated_at
       FROM tw_daily_line_outbox LIMIT 0`,
    "SELECT deletedAt, deletedBy, deleteReason, requestId FROM reports LIMIT 0",
    "SELECT requiresAcceptance FROM tasks LIMIT 0",
    "SELECT requiresAcceptance, completionRevision, completionRequestId FROM report_followups LIMIT 0",
    `SELECT id, requestId, sourceType, sourceId, subjectKey, completionVersion,
            decision, decisionNote, decidedByUserId, decidedAt
       FROM task_completion_review_events LIMIT 0`,
    `SELECT id, entityType, entityId, action, actorUserId,
            beforeState, afterState, createdAt
       FROM entity_revision_audits LIMIT 0`,
    `SELECT id, reportId, uploadId, contentHash, imageUrl, label, filename,
            archivedAt, archivedBy, archiveReason, createdAt
       FROM report_attachments LIMIT 0`,
    `SELECT id, jobKey, reportId, reportUpdatedAt, reportContentHash, status,
            extractedCount, createdCount, updatedCount, archivedCount,
            errorCode, errorMessage, attempts, nextAttemptAt, leaseUntil,
            leaseToken, deadLetterAt, startedAt, finishedAt
       FROM report_followup_extraction_runs LIMIT 0`,
  ];
  try {
    for (const query of readinessQueries) await connection.execute(query);
  } catch {
    throw new Error("STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED");
  }

  let indexRowsResult;
  try {
    [indexRowsResult] = await connection.execute(
      `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
              NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seqInIndex,
              COLUMN_NAME AS columnName
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'tw_daily_line_report_inbox',
            'tw_daily_line_rollouts',
            'tw_daily_line_outbox',
            'reports',
            'report_followups',
            'task_completion_review_events',
            'entity_revision_audits',
            'report_attachments',
            'report_followup_extraction_runs'
          )
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    );
  } catch {
    throw new Error("STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED");
  }
  const indexRows = Array.isArray(indexRowsResult) ? indexRowsResult : [];
  const requiredIndexes = [
    ["tw_daily_line_report_inbox", "PRIMARY", ["report_id"], true],
    ["tw_daily_line_report_inbox", "tw_daily_line_inbox_event_uq", ["latest_event_id"], true],
    ["tw_daily_line_report_inbox", "tw_daily_line_inbox_staff_date_uq", ["report_date", "staff_name"], true],
    ["tw_daily_line_report_inbox", "tw_daily_line_inbox_date_idx", ["report_date", "staff_name", "report_id"], false],
    ["tw_daily_line_rollouts", "PRIMARY", ["rollout_key"], true],
    ["tw_daily_line_outbox", "PRIMARY", ["id"], true],
    ["tw_daily_line_outbox", "tw_daily_line_outbox_event_uq", ["event_id"], true],
    ["tw_daily_line_outbox", "tw_daily_line_outbox_due_idx", ["status", "next_attempt_at", "id"], false],
    ["reports", "uq_reports_request_id", ["requestId"], true],
    ["report_followups", "uq_report_followup_completion_request", ["completionRequestId"], true],
    ["task_completion_review_events", "PRIMARY", ["id"], true],
    ["task_completion_review_events", "uq_task_completion_review_request", ["requestId"], true],
    ["task_completion_review_events", "uq_task_completion_review_version", ["sourceType", "sourceId", "subjectKey", "completionVersion"], true],
    ["entity_revision_audits", "idx_entity_revision_entity", ["entityType", "entityId", "id"], false],
    ["report_attachments", "uq_report_attachments_upload", ["reportId", "uploadId"], true],
    ["report_followup_extraction_runs", "uq_followup_extraction_job", ["jobKey"], true],
    ["report_followup_extraction_runs", "idx_followup_runs_report_status", ["reportId", "status", "id"], false],
  ];
  if (
    requiredIndexes.some(([tableName, indexName, columns, unique]) =>
      !hasRequiredIndex(indexRows, tableName, indexName, columns, unique),
    )
  ) {
    throw new Error("STARTUP_MIGRATION_SCHEMA_VERIFICATION_FAILED");
  }

}

async function main() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const descriptors = await Promise.all(
    REQUIRED_MIGRATION_TAGS.map(tag => readMigrationDescriptor(tag)),
  );
  const connection = await connectWithRetry(connectionString);
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.execute(
      "SELECT GET_LOCK(?, 120) AS acquired",
      [LOCK_NAME],
    );
    lockAcquired = Number(lockRows?.[0]?.acquired || 0) === 1;
    if (!lockAcquired) throw new Error("STARTUP_MIGRATION_LOCK_TIMEOUT");

    if (!(await tableExists(connection, "line_group_settings"))
      || !(await tableExists(connection, "reports"))
      || !(await tableExists(connection, "tasks"))
      || !(await tableExists(connection, "report_followups"))) {
      throw new Error("STARTUP_MIGRATION_PREREQUISITE_MISSING");
    }

    for (const descriptor of descriptors) {
      const ledgerState = await readDrizzleLedgerState(connection, descriptor);
      if (ledgerState.alreadyRecorded) continue;
      for (const statement of descriptor.statements) {
        try {
          await connection.execute(statement);
        } catch (error) {
          if (isDuplicateMysqlSchemaObject(error)) continue;
          if (/^CREATE\s+TRIGGER\b/i.test(statement) && isOptionalTriggerUnavailable(error)) {
            console.warn("[StartupMigration] Optional audit trigger unavailable", {
              migration: descriptor.tag,
              code: mysqlErrorCode(error),
            });
            continue;
          }
          throw error;
        }
      }
    }

    await verifyRequiredSchema(connection);

    for (const descriptor of descriptors) {
      const ledgerState = await readDrizzleLedgerState(connection, descriptor);
      if (!ledgerState.alreadyRecorded && ledgerState.canRecordSafely) {
        await connection.execute(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
          [descriptor.hash, descriptor.folderMillis],
        );
      } else if (!ledgerState.alreadyRecorded) {
        console.warn("[StartupMigration] LEDGER_BEHIND_SCHEMA_VERIFIED", {
          code: ledgerState.ledgerAvailable
            ? "STARTUP_MIGRATION_LEDGER_BEHIND"
            : "STARTUP_MIGRATION_LEDGER_MISSING",
          migration: descriptor.tag,
        });
      }
    }

    console.log(
      `[StartupMigration] REQUIRED_MIGRATIONS_APPLIED ${descriptors
        .map(descriptor => descriptor.tag)
        .join(",")}`,
    );
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    }
    await connection.end().catch(() => undefined);
  }
}

export {
  REQUIRED_MIGRATION_TAGS,
  isOptionalTriggerUnavailable,
  mysqlErrorCode,
  readDrizzleLedgerState,
  verifyRequiredSchema,
};

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch(error => {
    console.error("[StartupMigration] FAILED", { code: mysqlErrorCode(error) });
    process.exit(1);
  });
}
