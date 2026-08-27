import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "../databaseBackupScheduler";

const MIGRATION_KEY = "staff-identity-consistency-v1-2026-08-27";
const LOCK_NAME = "lcj:staff-identity-consistency:v1";
const PRE_BACKUP_REASON = "pre-staff-identity-consistency-v1";
const POST_BACKUP_REASON = "post-staff-identity-consistency-v1";

async function columnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(pool: Pool, tableName: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
    [before, reason],
  );
  const row = rows[0];
  if (!row || row.status !== "success") {
    throw new Error(`required database backup failed reason=${reason}: ${String(row?.errorMessage || "missing success run")}`);
  }
  return Number(row.id);
}

async function ensureInfrastructure(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS staff_identity_upgrade_runs (
    migrationKey VARCHAR(96) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    details JSON NULL,
    errorMessage TEXT NULL,
    PRIMARY KEY (migrationKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS staff_identity_merge_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    canonicalStaffId INT NOT NULL,
    duplicateStaffId INT NOT NULL,
    identityKey VARCHAR(384) NOT NULL,
    backupId BIGINT NULL,
    actorId INT NOT NULL,
    actorName VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    referenceCountsBefore JSON NOT NULL,
    movedCounts JSON NULL,
    details JSON NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    errorMessage TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY staff_identity_merge_duplicate_unique (duplicateStaffId),
    KEY staff_identity_merge_canonical_idx (canonicalStaffId, startedAt),
    KEY staff_identity_merge_actor_idx (actorId, startedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function assertReportLinkUniqueness(pool: Pool): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT linkedStaffId, COUNT(*) AS count
       FROM report_staff
      WHERE linkedStaffId IS NOT NULL
      GROUP BY linkedStaffId HAVING COUNT(*) > 1 LIMIT 1`,
  );
  if (rows[0]) {
    throw new Error(`cannot add report_staff one-to-one index; duplicate linkedStaffId=${String(rows[0].linkedStaffId)}`);
  }
}

async function ensureIdentityColumnsAndIndexes(pool: Pool): Promise<void> {
  if (!(await columnExists(pool, "staff", "identityKey"))) {
    await pool.execute("ALTER TABLE staff ADD COLUMN identityKey VARCHAR(384) NULL DEFAULT NULL");
  }
  if (!(await columnExists(pool, "staff", "mergedIntoStaffId"))) {
    await pool.execute("ALTER TABLE staff ADD COLUMN mergedIntoStaffId INT NULL DEFAULT NULL");
  }
  if (!(await indexExists(pool, "staff", "staff_identity_key_unique"))) {
    await pool.execute("ALTER TABLE staff ADD UNIQUE KEY staff_identity_key_unique (identityKey)");
  }
  if (!(await indexExists(pool, "staff", "staff_merged_into_idx"))) {
    await pool.execute("ALTER TABLE staff ADD KEY staff_merged_into_idx (mergedIntoStaffId)");
  }
  if (!(await indexExists(pool, "report_staff", "report_staff_linked_staff_unique"))) {
    await assertReportLinkUniqueness(pool);
    await pool.execute("ALTER TABLE report_staff ADD UNIQUE KEY report_staff_linked_staff_unique (linkedStaffId)");
  }
}

export type StaffIdentityUpgradeHealth = {
  healthy: boolean;
  migrationKey: string;
  status: string | null;
  completedAt: string | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
};

export async function getStaffIdentityUpgradeHealth(): Promise<StaffIdentityUpgradeHealth> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { healthy: false, migrationKey: MIGRATION_KEY, status: null, completedAt: null, details: null, errorMessage: "DATABASE_URL is missing" };
  }
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2, waitForConnections: true });
  try {
    await ensureInfrastructure(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, details, errorMessage FROM staff_identity_upgrade_runs WHERE migrationKey = ? LIMIT 1",
      [MIGRATION_KEY],
    );
    const row = rows[0];
    const details = typeof row?.details === "string" ? JSON.parse(row.details) : (row?.details || null);
    return {
      healthy: row?.status === "success",
      migrationKey: MIGRATION_KEY,
      status: row?.status ? String(row.status) : null,
      completedAt: row?.completedAt ? new Date(row.completedAt).toISOString() : null,
      details,
      errorMessage: row?.errorMessage ? String(row.errorMessage) : null,
    };
  } catch (error) {
    return {
      healthy: false,
      migrationKey: MIGRATION_KEY,
      status: "failed",
      completedAt: null,
      details: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end();
  }
}

export async function runStaffIdentityConsistencyUpgrade(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[StaffIdentityConsistency] DATABASE_URL is missing; skipped");
    return;
  }
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  let lockAcquired = false;
  try {
    await ensureInfrastructure(pool);
    const [doneRows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM staff_identity_upgrade_runs WHERE migrationKey = ? LIMIT 1",
      [MIGRATION_KEY],
    );
    if (doneRows[0]?.status === "success") return;

    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 20) AS locked", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.locked || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire staff identity upgrade lock");

    await pool.execute(
      `INSERT INTO staff_identity_upgrade_runs (migrationKey, status)
       VALUES (?, 'running')
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=NULL, errorMessage=NULL`,
      [MIGRATION_KEY],
    );

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await ensureIdentityColumnsAndIndexes(pool);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      columns: ["staff.identityKey", "staff.mergedIntoStaffId"],
      uniqueIndexes: ["staff.identityKey", "report_staff.linkedStaffId"],
      auditTable: "staff_identity_merge_events",
      autoMergedRows: 0,
      preBackupId,
      postBackupId,
      oldTiDBUsed: false,
    };
    await pool.execute(
      `UPDATE staff_identity_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE migrationKey=?`,
      [JSON.stringify(details), MIGRATION_KEY],
    );
    console.log(`[StaffIdentityConsistency] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    await pool.execute(
      `INSERT INTO staff_identity_upgrade_runs (migrationKey, status, completedAt, errorMessage)
       VALUES (?, 'failed', CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=VALUES(errorMessage)`,
      [MIGRATION_KEY, message],
    ).catch(() => undefined);
    console.error(`[StaffIdentityConsistency] failed ${message}`);
    throw error;
  } finally {
    if (lockAcquired) await pool.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    await pool.end();
  }
}
