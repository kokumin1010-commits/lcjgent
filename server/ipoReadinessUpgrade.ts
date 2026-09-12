import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import { ensureIpoReadinessOperationsSchema } from "./ipoReadinessOperations";

const UPGRADE_KEY = "ipo-readiness-operations-v1";
const PRE_REASON = "pre-ipo-readiness-operations-v1";
const POST_REASON = "post-ipo-readiness-operations-v1";
const REQUIRED_TABLES = [
  "ipo_monthly_plans",
  "ipo_readiness_settings",
  "ipo_readiness_tasks",
  "ipo_board_report_snapshots",
  "ipo_readiness_audit_logs",
] as const;
const PROTECTED_TABLES = [
  "company_cashflows",
  "finance_monthly_pnl",
  "cashflow_internal_transfers",
  "payroll_import_records",
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS ipo_readiness_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function existingTables(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES],
  );
  const existing = rows.map((row) => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter((table) => !existing.includes(table)) };
}

async function countIfExists(pool: Pool, table: string) {
  const [exists] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  if (!Number(exists[0]?.count || 0)) return null;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0]?.count || 0);
}

async function protectedSnapshot(pool: Pool) {
  const entries = await Promise.all(PROTECTED_TABLES.map(async (table) => [table, await countIfExists(pool, table)] as const));
  return Object.fromEntries(entries) as Record<(typeof PROTECTED_TABLES)[number], number | null>;
}

async function verifiedBackup(pool: Pool, reason: string) {
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE reason=? ORDER BY id DESC LIMIT 1",
    [reason],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || "missing row")}`);
  }
  return Number(row.id);
}

export async function getIpoReadinessUpgradeHealth() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    await ensureRunTable(pool);
    const tables = await existingTables(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,details,errorMessage FROM ipo_readiness_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY],
    );
    return {
      healthy: tables.missing.length === 0,
      recoveryKey: UPGRADE_KEY,
      missingTables: tables.missing,
      protectedRows: await protectedSnapshot(pool),
      recoveryRun: runs[0] || null,
    };
  } finally {
    await pool.end();
  }
}

export async function runIpoReadinessUpgradeSetup() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for IPO readiness upgrade");
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    await ensureRunTable(pool);
    const beforeTables = await existingTables(pool);
    if (beforeTables.missing.length === 0) {
      await ensureIpoReadinessOperationsSchema(pool);
      console.log("[IpoReadinessUpgrade] schema healthy");
      return;
    }
    const before = await protectedSnapshot(pool);
    await pool.query(
      `INSERT INTO ipo_readiness_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, before })],
    );
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await ensureIpoReadinessOperationsSchema(pool);
    const afterTables = await existingTables(pool);
    if (afterTables.missing.length) throw new Error(`missing IPO readiness tables: ${afterTables.missing.join(",")}`);
    const after = await protectedSnapshot(pool);
    for (const table of PROTECTED_TABLES) {
      if (before[table] !== after[table]) throw new Error(`${table} changed during IPO readiness schema upgrade: ${before[table]} -> ${after[table]}`);
    }
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = { beforeTables, afterTables, before, after, preBackupId, postBackupId, existingBusinessRowsModified: 0 };
    await pool.query(
      "UPDATE ipo_readiness_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[IpoReadinessUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      "UPDATE ipo_readiness_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

let ipoReadinessUpgradePromise: Promise<void> | null = null;

export function startIpoReadinessUpgradeSetup() {
  if (!ipoReadinessUpgradePromise) {
    ipoReadinessUpgradePromise = runIpoReadinessUpgradeSetup();
    ipoReadinessUpgradePromise.catch((error) => {
      console.error("[IpoReadinessUpgrade] background setup failed", error);
    });
  }
  return ipoReadinessUpgradePromise;
}

export async function waitForIpoReadinessUpgradeSetup() {
  await startIpoReadinessUpgradeSetup();
}
