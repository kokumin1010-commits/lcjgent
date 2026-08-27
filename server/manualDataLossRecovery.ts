import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { readDatabaseBackupTables, runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "manual-hr-report-store-recovery-2026-08-27-v1";
const CONFIRMATION = "RECOVER_MANUAL_HR_REPORT_STORE_2026_08_27";
const LOCK_NAME = "lcj:manual-data-loss-recovery:2026-08-27";

type PlainRow = Record<string, unknown>;
type FieldPatch = Record<string, unknown>;

type RecoveryCandidate = {
  table: "staff" | "report_staff" | "managed_stores";
  id: number;
  displayName: string;
  fields: string[];
  patch: FieldPatch;
  reason: string;
};

type AmbiguousDifference = {
  table: "staff" | "report_staff" | "managed_stores";
  id: number;
  displayName: string;
  fields: string[];
  reason: string;
};

type RecoveryContext = {
  hrRun: { startedAt: Date; completedAt: Date; preBackupId: number | null } | null;
  storeRun: { startedAt: Date; completedAt: Date } | null;
  hrBackupId: number | null;
  hrBackupReason: string | null;
  storeBackupId: number | null;
  storeBackupReason: string | null;
};

export type ManualDataLossPreview = {
  recoveryKey: string;
  context: RecoveryContext;
  safeCandidates: Array<Omit<RecoveryCandidate, "patch">>;
  ambiguousDifferences: AmbiguousDifference[];
  counts: {
    safeStaff: number;
    safeReportStaff: number;
    safeStores: number;
    ambiguous: number;
  };
  evidencePolicy: string[];
};

function parseJson(value: unknown): any {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRecoveryWindow(value: unknown, startedAt: Date, completedAt: Date): boolean {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() >= startedAt.getTime() - 90_000 && date.getTime() <= completedAt.getTime() + 180_000;
}

function comparable(value: unknown): string {
  if (value === null || value === undefined) return "<null>";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `buffer:${value.toString("base64")}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function differs(before: PlainRow, current: PlainRow, field: string): boolean {
  return comparable(before[field]) !== comparable(current[field]);
}

function indexById(rows: PlainRow[]): Map<number, PlainRow> {
  return new Map(rows.map((row) => [Number(row.id), row]).filter(([id]) => Number.isInteger(id) && id > 0));
}

async function successfulBackupIdsBefore(pool: Pool, before: Date, preferredIds: number[]): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs
      WHERE status = 'success' AND completedAt <= ? AND objectKeys IS NOT NULL
      ORDER BY completedAt DESC, id DESC LIMIT 40`,
    [before],
  );
  return [...new Set([
    ...preferredIds.filter((id) => Number.isInteger(id) && id > 0),
    ...rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0),
  ])];
}

async function firstReadableBackup(
  backupIds: number[],
  tables: string[],
): Promise<Awaited<ReturnType<typeof readDatabaseBackupTables>> | null> {
  for (const backupId of backupIds) {
    try {
      return await readDatabaseBackupTables(backupId, tables);
    } catch {
      // Pruned daily objects are expected; continue to a retained weekly/monthly copy.
    }
  }
  return null;
}

async function loadContext(pool: Pool): Promise<{
  context: RecoveryContext;
  hrBackup: Awaited<ReturnType<typeof readDatabaseBackupTables>> | null;
  storeBackup: Awaited<ReturnType<typeof readDatabaseBackupTables>> | null;
}> {
  const [hrRows] = await pool.query<RowDataPacket[]>(
    `SELECT startedAt, completedAt, details
       FROM hr36_directory_recovery_runs
      WHERE status = 'success' ORDER BY completedAt DESC LIMIT 1`,
  );
  const [storeRows] = await pool.query<RowDataPacket[]>(
    `SELECT startedAt, completedAt
       FROM gmv_hr_recovery_runs
      WHERE status = 'success' ORDER BY completedAt DESC LIMIT 1`,
  );
  const hrRaw = hrRows[0];
  const storeRaw = storeRows[0];
  const hrStartedAt = toDate(hrRaw?.startedAt);
  const hrCompletedAt = toDate(hrRaw?.completedAt);
  const storeStartedAt = toDate(storeRaw?.startedAt);
  const storeCompletedAt = toDate(storeRaw?.completedAt);
  const hrDetails = parseJson(hrRaw?.details);
  const hrPreBackupId = Number(hrDetails?.preBackupId || 0) || null;

  const hrRun = hrStartedAt && hrCompletedAt
    ? { startedAt: hrStartedAt, completedAt: hrCompletedAt, preBackupId: hrPreBackupId }
    : null;
  const storeRun = storeStartedAt && storeCompletedAt
    ? { startedAt: storeStartedAt, completedAt: storeCompletedAt }
    : null;

  const hrBackupIds = hrRun
    ? await successfulBackupIdsBefore(pool, hrRun.startedAt, hrPreBackupId ? [hrPreBackupId] : [])
    : [];
  const [preferredStoreRows] = storeRun
    ? await pool.query<RowDataPacket[]>(
        `SELECT id FROM db_backup_runs
          WHERE status = 'success' AND reason = 'pre-gmv-hr-recovery' AND completedAt <= ?
          ORDER BY completedAt DESC, id DESC LIMIT 10`,
        [storeRun.completedAt],
      )
    : [[] as RowDataPacket[], [] as any];
  const storePreferredIds = (preferredStoreRows as RowDataPacket[])
    .map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  const storeBackupIds = storeRun
    ? await successfulBackupIdsBefore(pool, storeRun.startedAt, storePreferredIds)
    : [];

  const hrBackup = await firstReadableBackup(hrBackupIds, ["staff", "report_staff"]);
  const storeBackup = await firstReadableBackup(storeBackupIds, ["managed_stores"]);
  return {
    context: {
      hrRun,
      storeRun,
      hrBackupId: hrBackup?.runId || null,
      hrBackupReason: hrBackup?.reason || null,
      storeBackupId: storeBackup?.runId || null,
      storeBackupReason: storeBackup?.reason || null,
    },
    hrBackup,
    storeBackup,
  };
}

async function buildPreview(pool: Pool): Promise<{
  publicPreview: ManualDataLossPreview;
  safeCandidates: RecoveryCandidate[];
}> {
  const { context, hrBackup, storeBackup } = await loadContext(pool);
  const safeCandidates: RecoveryCandidate[] = [];
  const ambiguousDifferences: AmbiguousDifference[] = [];

  const [currentStaffRows] = await pool.query<RowDataPacket[]>("SELECT * FROM staff ORDER BY id");
  const [currentReportRows] = await pool.query<RowDataPacket[]>("SELECT * FROM report_staff ORDER BY id");
  const [currentStoreRows] = await pool.query<RowDataPacket[]>("SELECT * FROM managed_stores ORDER BY id");
  const currentStaff = indexById(currentStaffRows as PlainRow[]);
  const currentReport = indexById(currentReportRows as PlainRow[]);
  const currentStores = indexById(currentStoreRows as PlainRow[]);

  if (hrBackup && context.hrRun) {
    const beforeStaff = indexById(hrBackup.tables.staff || []);
    for (const [id, before] of beforeStaff) {
      const current = currentStaff.get(id);
      if (!current || !inRecoveryWindow(current.updatedAt, context.hrRun.startedAt, context.hrRun.completedAt)) continue;
      const patch: FieldPatch = {};
      const fields: string[] = [];
      if (before.employmentTypeEvidence === "verified" && current.employmentTypeEvidence === "unverified") {
        patch.employmentType = before.employmentType;
        patch.employmentTypeEvidence = before.employmentTypeEvidence;
        fields.push("employmentType", "employmentTypeEvidence");
      }
      if (before.emailEvidenceStatus === "verified" && current.emailEvidenceStatus === "unverified" && differs(before, current, "email")) {
        patch.email = before.email;
        patch.emailEvidenceStatus = before.emailEvidenceStatus;
        fields.push("email", "emailEvidenceStatus");
      }
      if (differs(before, current, "name") && String(before.name || "").trim()) {
        patch.name = before.name;
        fields.push("name");
      }
      if (before.isActive === "inactive" && current.isActive === "active" && (before.resignDate || current.resignDate)) {
        patch.isActive = before.isActive;
        fields.push("isActive");
      }
      if (fields.length > 0) {
        safeCandidates.push({
          table: "staff", id, displayName: String(before.name || current.name || `staff:${id}`), fields: [...new Set(fields)], patch,
          reason: `manual value existed in backup ${hrBackup.runId} and was downgraded during hr36 recovery`,
        });
      }
    }

    const beforeReport = indexById(hrBackup.tables.report_staff || []);
    for (const [id, before] of beforeReport) {
      const current = currentReport.get(id);
      if (!current || !inRecoveryWindow(current.updatedAt, context.hrRun.startedAt, context.hrRun.completedAt)) continue;
      const differing = ["name", "country", "linkedStaffId", "isActive"].filter((field) => differs(before, current, field));
      if (differing.length === 0) continue;
      const patch: FieldPatch = {};
      const safeFields: string[] = [];
      if (differing.includes("name") && String(before.name || "").trim()) {
        patch.name = before.name;
        safeFields.push("name");
      }
      if (safeFields.length > 0) {
        safeCandidates.push({
          table: "report_staff", id, displayName: String(before.name || current.name || `report_staff:${id}`), fields: safeFields, patch,
          reason: `manual name existed in backup ${hrBackup.runId} before hr36 synchronization`,
        });
      }
      const ambiguous = differing.filter((field) => !safeFields.includes(field));
      if (ambiguous.length > 0) {
        ambiguousDifferences.push({
          table: "report_staff", id, displayName: String(before.name || current.name || `report_staff:${id}`), fields: ambiguous,
          reason: "status/country/link changes can be intentional directory classification and are not auto-restored",
        });
      }
    }
  }

  if (storeBackup && context.storeRun) {
    const beforeStores = indexById(storeBackup.tables.managed_stores || []);
    for (const [id, before] of beforeStores) {
      const current = currentStores.get(id);
      if (!current || !inRecoveryWindow(current.updatedAt, context.storeRun.startedAt, context.storeRun.completedAt)) continue;
      const patch: FieldPatch = {};
      const fields: string[] = [];
      for (const field of ["operatorId", "operatorName", "operator2Id", "operator2Name"] as const) {
        const oldPresent = before[field] !== null && before[field] !== undefined && String(before[field]).trim() !== "";
        const currentMissing = current[field] === null || current[field] === undefined || String(current[field]).trim() === "";
        if (oldPresent && currentMissing) {
          patch[field] = before[field];
          fields.push(field);
        }
      }
      const currentNotes = String(current.notes || "");
      if (differs(before, current, "notes") && String(before.notes || "").trim() && currentNotes.startsWith("Recovered from original 2026-07")) {
        patch.notes = before.notes;
        fields.push("notes");
      }
      if (fields.length > 0) {
        safeCandidates.push({
          table: "managed_stores", id, displayName: String(current.name || before.name || `store:${id}`), fields, patch,
          reason: `manager/profile value existed in backup ${storeBackup.runId} and current row matches the destructive GMV recovery window`,
        });
      }
    }
  }

  const publicPreview: ManualDataLossPreview = {
    recoveryKey: RECOVERY_KEY,
    context,
    safeCandidates: safeCandidates.map(({ patch: _patch, ...candidate }) => candidate),
    ambiguousDifferences,
    counts: {
      safeStaff: safeCandidates.filter((item) => item.table === "staff").length,
      safeReportStaff: safeCandidates.filter((item) => item.table === "report_staff").length,
      safeStores: safeCandidates.filter((item) => item.table === "managed_stores").length,
      ambiguous: ambiguousDifferences.length,
    },
    evidencePolicy: [
      "Only values present in a verified encrypted Railway MySQL backup are candidates.",
      "Only rows whose updatedAt matches the destructive startup recovery window are candidates.",
      "Current non-empty values are never overwritten by an empty backup value.",
      "Ambiguous country/status/link differences are reported but never auto-restored.",
    ],
  };
  return { publicPreview, safeCandidates };
}

async function ensureRecoveryTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_data_loss_recovery_runs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recoveryKey VARCHAR(96) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    actorId INT NULL,
    actorName VARCHAR(255) NULL,
    contextJson JSON NULL,
    resultJson JSON NULL,
    errorMessage TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY manual_data_loss_recovery_key_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_data_loss_recovery_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recoveryRunId BIGINT NOT NULL,
    tableName VARCHAR(64) NOT NULL,
    rowId BIGINT NOT NULL,
    changedFields JSON NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY manual_data_loss_event_run_idx (recoveryRunId, id),
    KEY manual_data_loss_event_row_idx (tableName, rowId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

const PATCHABLE_FIELDS: Record<RecoveryCandidate["table"], Set<string>> = {
  staff: new Set(["name", "email", "employmentType", "employmentTypeEvidence", "emailEvidenceStatus", "isActive"]),
  report_staff: new Set(["name"]),
  managed_stores: new Set(["operatorId", "operatorName", "operator2Id", "operator2Name", "notes"]),
};

async function selectRowForUpdate(connection: PoolConnection, table: RecoveryCandidate["table"], id: number): Promise<PlainRow> {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1 FOR UPDATE`, [id]);
  const row = rows[0];
  if (!row) throw new Error(`${table} row not found: ${id}`);
  return row as PlainRow;
}

async function applyCandidate(
  connection: PoolConnection,
  recoveryRunId: number,
  candidate: RecoveryCandidate,
  actorId: number,
): Promise<void> {
  const allowed = PATCHABLE_FIELDS[candidate.table];
  const entries = Object.entries(candidate.patch).filter(([field]) => allowed.has(field));
  if (entries.length === 0) return;
  const before = await selectRowForUpdate(connection, candidate.table, candidate.id);
  const sets = entries.map(([field]) => `\`${field}\` = ?`);
  const params = entries.map(([, value]) => value);
  if (candidate.table === "staff" || candidate.table === "report_staff" || candidate.table === "managed_stores") {
    sets.push("`manualRevisionAt` = CURRENT_TIMESTAMP", "`manualRevisionBy` = ?");
    params.push(actorId);
  }
  params.push(candidate.id);
  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `UPDATE \`${candidate.table}\` SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
  if (result.affectedRows !== 1) throw new Error(`recovery update affected ${result.affectedRows} rows for ${candidate.table}:${candidate.id}`);
  const after = await selectRowForUpdate(connection, candidate.table, candidate.id);
  await connection.execute(
    `INSERT INTO manual_data_loss_recovery_events
       (recoveryRunId, tableName, rowId, changedFields, beforeJson, afterJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      recoveryRunId,
      candidate.table,
      candidate.id,
      JSON.stringify(candidate.fields),
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );
}

export async function previewManualDataLossRecovery(): Promise<ManualDataLossPreview> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  try {
    await ensureRecoveryTables(pool);
    return (await buildPreview(pool)).publicPreview;
  } finally {
    await pool.end();
  }
}

export async function executeManualDataLossRecovery(input: {
  confirmation: string;
  actorId: number;
  actorName: string;
}): Promise<{ alreadyRecovered: boolean; recovered: ManualDataLossPreview["counts"]; preview: ManualDataLossPreview }> {
  if (input.confirmation !== CONFIRMATION) throw new Error("manual recovery confirmation does not match");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  let lockAcquired = false;
  try {
    await ensureRecoveryTables(pool);
    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS locked", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.locked || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire manual recovery lock");

    const [existingRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, resultJson FROM manual_data_loss_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    if (existingRows[0]?.status === "success") {
      const preview = (await buildPreview(pool)).publicPreview;
      return { alreadyRecovered: true, recovered: { safeStaff: 0, safeReportStaff: 0, safeStores: 0, ambiguous: preview.counts.ambiguous }, preview };
    }

    const { publicPreview, safeCandidates } = await buildPreview(pool);
    await runDatabaseBackup("pre-manual-loss-recovery", { force: true, waitForActive: true });
    await pool.execute(
      `INSERT INTO manual_data_loss_recovery_runs
         (recoveryKey, status, actorId, actorName, contextJson, resultJson, errorMessage)
       VALUES (?, 'running', ?, ?, ?, NULL, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL,
         actorId=VALUES(actorId), actorName=VALUES(actorName), contextJson=VALUES(contextJson), resultJson=NULL, errorMessage=NULL`,
      [RECOVERY_KEY, input.actorId, input.actorName.slice(0, 255), JSON.stringify(publicPreview.context)],
    );
    const [runRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM manual_data_loss_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    const recoveryRunId = Number(runRows[0]?.id || 0);
    if (!recoveryRunId) throw new Error("manual recovery run id is missing");

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const candidate of safeCandidates) {
        await applyCandidate(connection, recoveryRunId, candidate, input.actorId);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await runDatabaseBackup("post-manual-loss-recovery", { force: true, waitForActive: true });
    const resultJson = {
      recovered: publicPreview.counts,
      safeCandidates: publicPreview.safeCandidates,
      ambiguousDifferences: publicPreview.ambiguousDifferences,
    };
    await pool.execute(
      `UPDATE manual_data_loss_recovery_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, resultJson=?, errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(resultJson), RECOVERY_KEY],
    );
    return { alreadyRecovered: false, recovered: publicPreview.counts, preview: publicPreview };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    await pool.execute(
      `INSERT INTO manual_data_loss_recovery_runs (recoveryKey, status, actorId, actorName, completedAt, errorMessage)
       VALUES (?, 'failed', ?, ?, CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE status='failed', completedAt=CURRENT_TIMESTAMP,
         actorId=VALUES(actorId), actorName=VALUES(actorName), errorMessage=VALUES(errorMessage)`,
      [RECOVERY_KEY, input.actorId, input.actorName.slice(0, 255), message],
    ).catch(() => undefined);
    throw error;
  } finally {
    if (lockAcquired) await pool.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    await pool.end();
  }
}

export const manualDataLossRecoveryConfirmation = CONFIRMATION;
