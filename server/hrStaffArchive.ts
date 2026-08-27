import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const SETUP_KEY = "hr-staff-archive-v1-2026-08-26";
const PRE_BACKUP_REASON = "pre-hr-archive-v1";
const POST_BACKUP_REASON = "post-hr-archive-v1";

type ReferenceCounts = Record<string, number>;

async function ensureSetupRunTable(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS hr_staff_archive_setup_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    setupKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY hr_staff_archive_setup_key_unique (setupKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensureArchiveSchema(pool: Pool): Promise<void> {
  await pool.execute("ALTER TABLE staff ADD COLUMN archivedAt TIMESTAMP NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute("ALTER TABLE staff ADD COLUMN archivedBy INT NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute("ALTER TABLE staff ADD COLUMN archiveReason TEXT NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute(`CREATE TABLE IF NOT EXISTS hr_staff_archive_events (
    id bigint NOT NULL AUTO_INCREMENT,
    staffId int NOT NULL,
    reportStaffId int NOT NULL,
    action varchar(20) NOT NULL,
    archiveReason text NULL,
    performedBy int NULL,
    referenceCounts json NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY hr_staff_archive_events_staff_idx (staffId, createdAt),
    KEY hr_staff_archive_events_report_staff_idx (reportStaffId, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const before = await latestBackupId(pool).catch(() => 0);
    await runDatabaseBackup(reason, { force: true, waitForActive: true });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
      [before, reason],
    );
    const row = rows[0];
    if (row?.status === "success") return Number(row.id);
    if (row?.status === "failed") throw new Error(`database backup failed reason=${reason}: ${String(row.errorMessage || "unknown")}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`database backup did not complete reason=${reason}`);
}

async function tableColumnExists(connection: PoolConnection, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function countReference(
  connection: PoolConnection,
  tableName: string,
  columnName: string,
  id: number,
): Promise<number> {
  if (!(await tableColumnExists(connection, tableName, columnName))) return 0;
  const safeTable = `\`${tableName.replace(/`/g, "``")}\``;
  const safeColumn = `\`${columnName.replace(/`/g, "``")}\``;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM ${safeTable} WHERE ${safeColumn} = ?`,
    [id],
  );
  return Number(rows[0]?.count || 0);
}

async function getReferenceCounts(
  connection: PoolConnection,
  staffId: number,
  reportStaffId: number,
): Promise<ReferenceCounts> {
  const definitions: Array<[string, string, string, number]> = [
    ["tasks", "tasks", "staffId", staffId],
    ["taskStaff", "task_staff", "staffId", staffId],
    ["reportStaffLinks", "report_staff", "linkedStaffId", staffId],
    ["reports", "reports", "reportStaffId", reportStaffId],
    ["reportFollowups", "report_followups", "reportStaffId", reportStaffId],
    ["brandLcjStaff", "brand_lcj_staff", "reportStaffId", reportStaffId],
    ["chatReportSessions", "chat_report_sessions", "staffId", reportStaffId],
    ["staffAiProfiles", "staff_ai_profiles", "staffId", reportStaffId],
    ["lineUsers", "line_users", "staffId", staffId],
    ["recruitmentFollowRecords", "recruitment_follow_records", "staff_id", staffId],
    ["staffSchedules", "staff_schedules", "staffId", staffId],
  ];
  const counts: ReferenceCounts = {};
  for (const [key, tableName, columnName, id] of definitions) {
    counts[key] = await countReference(connection, tableName, columnName, id);
  }
  return counts;
}

async function selectArchiveTarget(
  connection: PoolConnection,
  staffId: number,
  reportStaffId: number,
): Promise<{ staff: RowDataPacket; reportStaff: RowDataPacket }> {
  const [staffRows] = await connection.query<RowDataPacket[]>(
    `SELECT id, name, email, isActive, resignDate, resignReason, evidenceStatus,
      archivedAt, archivedBy, archiveReason, manualRevisionAt, manualRevisionBy
     FROM staff WHERE id = ? LIMIT 1 FOR UPDATE`,
    [staffId],
  );
  if (!staffRows[0]) throw new Error("スタッフが見つかりません");
  const [reportRows] = await connection.query<RowDataPacket[]>(
    `SELECT id, name, email, linkedStaffId, isActive, archivedAt, archivedBy,
      archiveReason, manualRevisionAt, manualRevisionBy
     FROM report_staff WHERE id = ? LIMIT 1 FOR UPDATE`,
    [reportStaffId],
  );
  if (!reportRows[0]) throw new Error("日報スタッフが見つかりません");
  if (Number(reportRows[0].linkedStaffId || 0) !== staffId) {
    throw new Error("スタッフと日報スタッフの紐付けが一致しません");
  }
  return { staff: staffRows[0], reportStaff: reportRows[0] };
}

export async function archiveResignedStaff(input: {
  staffId: number;
  reportStaffId: number;
  archiveReason?: string;
  performedBy?: number | null;
}): Promise<{ archived: boolean; referenceCounts: ReferenceCounts }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureArchiveSchema(pool);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const target = await selectArchiveTarget(connection, input.staffId, input.reportStaffId);
      const referenceCounts = await getReferenceCounts(connection, input.staffId, input.reportStaffId);
      if (target.staff.archivedAt) {
        await connection.commit();
        return { archived: false, referenceCounts };
      }
      const evidenceStatus = String(target.staff.evidenceStatus || "");
      const evidenceAllowsArchive = target.staff.resignDate
        || evidenceStatus === "historical_unknown"
        || evidenceStatus === "affiliation_unknown";
      if (String(target.staff.isActive) !== "inactive" || !evidenceAllowsArchive) {
        throw new Error("現在活動確認のスタッフは先に退職処理が必要です。退職確認・過去在籍・所属未確認の非活動人物はアーカイブできます");
      }
      await connection.execute(
        `UPDATE staff SET archivedAt = CURRENT_TIMESTAMP, archivedBy = ?, archiveReason = ?,
          manualRevisionAt = CURRENT_TIMESTAMP, manualRevisionBy = ? WHERE id = ?`,
        [input.performedBy ?? null, input.archiveReason?.trim() || "非活動人物をHR人物目录から非表示", input.performedBy ?? null, input.staffId],
      );
      await connection.execute(
        `INSERT INTO hr_staff_archive_events
          (staffId, reportStaffId, action, archiveReason, performedBy, referenceCounts)
         VALUES (?, ?, 'archive', ?, ?, ?)`,
        [
          input.staffId,
          input.reportStaffId,
          input.archiveReason?.trim() || "非活動人物をHR人物目录から非表示",
          input.performedBy ?? null,
          JSON.stringify(referenceCounts),
        ],
      );
      await connection.commit();
      return { archived: true, referenceCounts };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } finally {
    await pool.end();
  }
}

function eventSnapshot(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id),
    name: row.name ? String(row.name) : null,
    email: row.email ? String(row.email) : null,
    linkedStaffId: row.linkedStaffId === undefined || row.linkedStaffId === null ? null : Number(row.linkedStaffId),
    isActive: row.isActive ? String(row.isActive) : null,
    resignDate: row.resignDate ? new Date(row.resignDate).toISOString() : null,
    resignReason: row.resignReason ? String(row.resignReason) : null,
    evidenceStatus: row.evidenceStatus ? String(row.evidenceStatus) : null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    archivedBy: row.archivedBy === undefined || row.archivedBy === null ? null : Number(row.archivedBy),
    archiveReason: row.archiveReason ? String(row.archiveReason) : null,
    manualRevisionAt: row.manualRevisionAt ? new Date(row.manualRevisionAt).toISOString() : null,
    manualRevisionBy: row.manualRevisionBy === undefined || row.manualRevisionBy === null ? null : Number(row.manualRevisionBy),
  };
}

async function writeRestoreAudit(
  connection: PoolConnection,
  input: {
    entityType: "staff" | "report_staff";
    entityId: number;
    before: RowDataPacket;
    after: RowDataPacket;
    performedBy: number;
    performedByName: string;
  },
): Promise<void> {
  const before = eventSnapshot(input.before);
  const after = eventSnapshot(input.after);
  const changedFields = Object.keys(after).filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  await connection.execute(
    `INSERT INTO manual_data_change_events
      (entityType, entityId, action, changedFields, beforeJson, afterJson, actorId, actorName, source)
     VALUES (?, ?, 'restore', ?, ?, ?, ?, ?, 'ui')`,
    [
      input.entityType,
      input.entityId,
      JSON.stringify(changedFields),
      JSON.stringify(before),
      JSON.stringify(after),
      input.performedBy,
      input.performedByName.slice(0, 255),
    ],
  );
}

export type RestoreArchivedStaffInput = {
  staffId: number;
  reportStaffId: number;
  performedBy: number;
  performedByName: string;
  restoreMode?: "restore" | "reinstate";
};

type RestoreArchivedStaffResult = {
  restored: boolean;
  referenceCounts: ReferenceCounts;
  userAccountRestored: boolean;
};

export async function restoreArchivedStaffWithPool(
  pool: Pool,
  input: RestoreArchivedStaffInput,
): Promise<RestoreArchivedStaffResult> {
  await ensureArchiveSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await selectArchiveTarget(connection, input.staffId, input.reportStaffId);
    const referenceCounts = await getReferenceCounts(connection, input.staffId, input.reportStaffId);
    const restoreNeeded = target.staff.archivedAt
      || target.staff.resignDate
      || String(target.staff.isActive || "") !== "active"
      || target.reportStaff.archivedAt
      || String(target.reportStaff.isActive || "") !== "active";
    if (!restoreNeeded) {
      await connection.commit();
      return { restored: false, referenceCounts, userAccountRestored: false };
    }

    await connection.execute(
      `UPDATE staff SET isActive = 'active', resignDate = NULL, resignReason = NULL,
        archivedAt = NULL, archivedBy = NULL, archiveReason = NULL,
        manualRevisionAt = CURRENT_TIMESTAMP, manualRevisionBy = ? WHERE id = ?`,
      [input.performedBy, input.staffId],
    );
    await connection.execute(
      `UPDATE report_staff SET isActive = 'active', archivedAt = NULL, archivedBy = NULL,
        archiveReason = NULL, manualRevisionAt = CURRENT_TIMESTAMP, manualRevisionBy = ?
       WHERE id = ? AND linkedStaffId = ?`,
      [input.performedBy, input.reportStaffId, input.staffId],
    );

    let userAccountRestored = false;
    if (target.staff.email) {
      const [userResult] = await connection.execute(
        `UPDATE users SET email = ? WHERE email = CONCAT('resigned_', id, '_', ?)`,
        [String(target.staff.email), String(target.staff.email)],
      );
      userAccountRestored = Number((userResult as { affectedRows?: number }).affectedRows || 0) > 0;
    }

    const restoredTarget = await selectArchiveTarget(connection, input.staffId, input.reportStaffId);
    await writeRestoreAudit(connection, {
      entityType: "staff",
      entityId: input.staffId,
      before: target.staff,
      after: restoredTarget.staff,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
    });
    await writeRestoreAudit(connection, {
      entityType: "report_staff",
      entityId: input.reportStaffId,
      before: target.reportStaff,
      after: restoredTarget.reportStaff,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
    });
    const eventAction = input.restoreMode === "reinstate" ? "reinstate" : "restore";
    const eventReason = input.restoreMode === "reinstate"
      ? "HR人物目录で復職し、関連する報告スタッフ状態も復元"
      : "HRアーカイブ箱から人物目录へ復元し、復職状態も同期";
    await connection.execute(
      `INSERT INTO hr_staff_archive_events
        (staffId, reportStaffId, action, archiveReason, performedBy, referenceCounts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.staffId, input.reportStaffId, eventAction, eventReason, input.performedBy, JSON.stringify(referenceCounts)],
    );
    await connection.commit();
    return { restored: true, referenceCounts, userAccountRestored };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function restoreArchivedStaff(input: RestoreArchivedStaffInput): Promise<RestoreArchivedStaffResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    return await restoreArchivedStaffWithPool(pool, input);
  } finally {
    await pool.end();
  }
}

export async function getHrStaffArchiveHealth(): Promise<{
  totalStaff: number;
  visibleStaff: number;
  archivedStaff: number;
  visibleResignedStaff: number;
  archivedResignedStaff: number;
  visibleArchiveEligibleStaff: number;
  visibleProtectedActiveStaff: number;
  archiveEventCount: number;
  setupRun: { status: string; completedAt: string | null; errorMessage: string | null } | null;
  backups: Array<{ id: number; reason: string; status: string; tableCount: number | null; rowCount: number | null; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureSetupRunTable(pool);
    await ensureArchiveSchema(pool);
    const [countRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS totalStaff,
        SUM(archivedAt IS NULL) AS visibleStaff,
        SUM(archivedAt IS NOT NULL) AS archivedStaff,
        SUM(archivedAt IS NULL AND resignDate IS NOT NULL) AS visibleResignedStaff,
        SUM(archivedAt IS NOT NULL AND resignDate IS NOT NULL) AS archivedResignedStaff,
        SUM(archivedAt IS NULL AND isActive='inactive' AND
          (resignDate IS NOT NULL OR evidenceStatus IN ('historical_unknown', 'affiliation_unknown'))) AS visibleArchiveEligibleStaff,
        SUM(archivedAt IS NULL AND isActive='active') AS visibleProtectedActiveStaff
      FROM staff
    `);
    const [eventRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM hr_staff_archive_events");
    const [setupRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, errorMessage FROM hr_staff_archive_setup_runs WHERE setupKey = ? LIMIT 1",
      [SETUP_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, tableCount, rowCount, completedAt, errorMessage
       FROM db_backup_runs WHERE reason IN (?, ?) ORDER BY id DESC LIMIT 4`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const counts = (countRows[0] || {}) as RowDataPacket;
    const setup = setupRows[0];
    return {
      totalStaff: Number(counts.totalStaff || 0),
      visibleStaff: Number(counts.visibleStaff || 0),
      archivedStaff: Number(counts.archivedStaff || 0),
      visibleResignedStaff: Number(counts.visibleResignedStaff || 0),
      archivedResignedStaff: Number(counts.archivedResignedStaff || 0),
      visibleArchiveEligibleStaff: Number(counts.visibleArchiveEligibleStaff || 0),
      visibleProtectedActiveStaff: Number(counts.visibleProtectedActiveStaff || 0),
      archiveEventCount: Number(eventRows[0]?.count || 0),
      setupRun: setup ? {
        status: String(setup.status || "unknown"),
        completedAt: setup.completedAt ? new Date(setup.completedAt).toISOString() : null,
        errorMessage: setup.errorMessage ? String(setup.errorMessage).slice(0, 1000) : null,
      } : null,
      backups: backupRows.map((row) => ({
        id: Number(row.id),
        reason: String(row.reason || ""),
        status: String(row.status || "unknown"),
        tableCount: row.tableCount === null ? null : Number(row.tableCount),
        rowCount: row.rowCount === null ? null : Number(row.rowCount),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        errorMessage: row.errorMessage ? String(row.errorMessage).slice(0, 1000) : null,
      })),
    };
  } finally {
    await pool.end();
  }
}

export async function runHrStaffArchiveSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for HR archive setup");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureSetupRunTable(pool);
    const [existingRows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM hr_staff_archive_setup_runs WHERE setupKey = ? LIMIT 1",
      [SETUP_KEY],
    );
    if (existingRows[0]?.status === "success") {
      await ensureArchiveSchema(pool);
      console.log("[HrStaffArchive] schema healthy");
      return;
    }
    await pool.execute(
      `INSERT INTO hr_staff_archive_setup_runs (setupKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [SETUP_KEY, JSON.stringify({ oldTiDBUsed: false, mode: "soft_archive_only" })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await ensureArchiveSchema(pool);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE hr_staff_archive_setup_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
       details=?, errorMessage=NULL WHERE setupKey=?`,
      [JSON.stringify({ oldTiDBUsed: false, mode: "soft_archive_only", preBackupId, postBackupId }), SETUP_KEY],
    );
    console.log(`[HrStaffArchive] setup success ${JSON.stringify({ preBackupId, postBackupId })}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE hr_staff_archive_setup_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE setupKey=?`,
      [message.slice(0, 4000), SETUP_KEY],
    ).catch(() => undefined);
    console.error("[HrStaffArchive] setup failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
