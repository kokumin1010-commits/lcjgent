import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "store-profile-v2-protect";
const PRE_BACKUP_REASON = "pre-store-profile-v2";
const POST_BACKUP_REASON = "post-store-profile-v2";
const REQUIRED_COLUMNS = ["avatarUrl", "avatarKey", "contactEmail", "contactPhone"] as const;
const REQUIRED_TABLES = ["store_profile_audit_logs"] as const;

async function ensureBaseTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS managed_stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      platform VARCHAR(100) NOT NULL DEFAULT 'tiktok_shop',
      country VARCHAR(100) NOT NULL DEFAULT 'japan',
      storeUrl VARCHAR(500),
      operatorId INT,
      operatorName VARCHAR(255),
      operator2Id INT,
      operator2Name VARCHAR(255),
      notes TEXT,
      isActive TINYINT(1) DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_profile_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    )
  `);
}

async function ensureAuditTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_profile_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      storeId INT NOT NULL,
      action VARCHAR(40) NOT NULL,
      changedFields JSON NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      actorId BIGINT NULL,
      actorName VARCHAR(255) NULL,
      source VARCHAR(80) NOT NULL DEFAULT 'store-management-ui',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_profile_audit_store_time (storeId, createdAt),
      INDEX idx_store_profile_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getTableState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [REQUIRED_TABLES],
  );
  const existing = rows.map((row) => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter((table) => !existing.includes(table)) };
}

async function getColumnState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'managed_stores'`,
  );
  const existing = rows.map((row) => String(row.columnName));
  return {
    existing,
    missing: REQUIRED_COLUMNS.filter((column) => !existing.includes(column)),
  };
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, errorMessage
       FROM db_backup_runs
      WHERE id > ? AND reason = ?
      ORDER BY id DESC
      LIMIT 1`,
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row) throw new Error(`verified backup row missing: ${reason}`);
  if (String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row.errorMessage || "unknown")}`);
  }
  return Number(row.id);
}

async function applyMissingColumns(pool: Pool, missing: string[]): Promise<void> {
  const sqlByColumn: Record<string, string> = {
    avatarUrl: "ALTER TABLE managed_stores ADD COLUMN avatarUrl VARCHAR(1000) NULL",
    avatarKey: "ALTER TABLE managed_stores ADD COLUMN avatarKey VARCHAR(500) NULL",
    contactEmail: "ALTER TABLE managed_stores ADD COLUMN contactEmail VARCHAR(320) NULL",
    contactPhone: "ALTER TABLE managed_stores ADD COLUMN contactPhone VARCHAR(64) NULL",
  };
  for (const column of missing) {
    const sql = sqlByColumn[column];
    if (!sql) throw new Error(`unsupported managed_stores column: ${column}`);
    await pool.query(sql);
  }
}

export async function getStoreProfileUpgradeHealth(): Promise<{
  healthy: boolean;
  recoveryKey: string;
  requiredColumnCount: number;
  missingColumns: string[];
  activeStoreCount: number;
  avatarStoreCount: number;
  assignedOperatorStoreCount: number;
  contactStoreCount: number;
  auditCount: number;
  manualProfileProtection: boolean;
  missingTables: string[];
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null; details: unknown } | null;
  backups: Array<{ id: number; reason: string; status: string; tableCount: number | null; rowCount: number | null; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const columns = await getColumnState(pool);
    const tables = await getTableState(pool);
    let counts = { activeStoreCount: 0, avatarStoreCount: 0, assignedOperatorStoreCount: 0, contactStoreCount: 0, auditCount: 0 };
    if (columns.missing.length === 0) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS activeStoreCount,
                SUM(CASE WHEN avatarUrl IS NOT NULL AND avatarUrl <> '' THEN 1 ELSE 0 END) AS avatarStoreCount,
                SUM(CASE WHEN operatorName IS NOT NULL AND operatorName <> '' THEN 1 ELSE 0 END) AS assignedOperatorStoreCount,
                SUM(CASE WHEN (contactEmail IS NOT NULL AND contactEmail <> '') OR (contactPhone IS NOT NULL AND contactPhone <> '') THEN 1 ELSE 0 END) AS contactStoreCount
           FROM managed_stores
          WHERE isActive = 1`,
      );
      const row = rows[0] || {};
      counts = {
        activeStoreCount: Number(row.activeStoreCount || 0),
        avatarStoreCount: Number(row.avatarStoreCount || 0),
        assignedOperatorStoreCount: Number(row.assignedOperatorStoreCount || 0),
        contactStoreCount: Number(row.contactStoreCount || 0),
        auditCount: 0,
      };
      if (tables.missing.length === 0) {
        const [auditRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS auditCount FROM store_profile_audit_logs");
        counts.auditCount = Number(auditRows[0]?.auditCount || 0);
      }
    }
    const [runRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, errorMessage, details FROM store_profile_upgrade_runs WHERE recoveryKey = ? LIMIT 1",
      [UPGRADE_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, tableCount, rowCount, completedAt, errorMessage
         FROM db_backup_runs
        WHERE reason IN (?, ?)
        ORDER BY id DESC
        LIMIT 4`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      healthy: columns.missing.length === 0 && tables.missing.length === 0 && counts.activeStoreCount === 5,
      recoveryKey: UPGRADE_KEY,
      requiredColumnCount: REQUIRED_COLUMNS.length,
      missingColumns: columns.missing,
      missingTables: tables.missing,
      manualProfileProtection: tables.missing.length === 0,
      ...counts,
      recoveryRun: run ? {
        status: String(run.status),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        errorMessage: run.errorMessage ? String(run.errorMessage).slice(0, 1000) : null,
        details: typeof run.details === "string" ? JSON.parse(run.details) : run.details,
      } : null,
      backups: backupRows.map((row) => ({
        id: Number(row.id),
        reason: String(row.reason),
        status: String(row.status),
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

export async function runStoreProfileUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for store profile upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const before = await getColumnState(pool);
    const beforeTables = await getTableState(pool);
    if (before.missing.length === 0 && beforeTables.missing.length === 0) {
      console.log(`[StoreProfileUpgrade] schema healthy columns=${REQUIRED_COLUMNS.length} auditTable=ready`);
      return;
    }
    await pool.query(
      `INSERT INTO store_profile_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ before, beforeTables, requiredColumns: REQUIRED_COLUMNS, requiredTables: REQUIRED_TABLES })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await applyMissingColumns(pool, before.missing);
    await ensureAuditTable(pool);
    const after = await getColumnState(pool);
    const afterTables = await getTableState(pool);
    if (after.missing.length > 0) throw new Error(`store profile columns still missing: ${after.missing.join(",")}`);
    if (afterTables.missing.length > 0) throw new Error(`store profile tables still missing: ${afterTables.missing.join(",")}`);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = { before, beforeTables, after, afterTables, preBackupId, postBackupId, dataRowsModified: 0, manualProfileProtection: true, oldTiDBUsed: false };
    await pool.query(
      `UPDATE store_profile_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[StoreProfileUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE store_profile_upgrade_runs
          SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
        WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    console.error(`[StoreProfileUpgrade] failed ${message}`);
    throw error;
  } finally {
    await pool.end();
  }
}
