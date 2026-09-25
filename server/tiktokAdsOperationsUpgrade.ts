import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "tiktok-ads-command-center-operations-v1";
const LOCK_KEY = "lcj_tiktok_ads_command_center_operations_v1";
const BACKUP_REASON = "pre-tiktok-ads-ops-v1";
let setupPromise: Promise<void> | null = null;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_ads_operation_upgrade_runs (
    recoveryKey VARCHAR(80) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorCode VARCHAR(128) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableExists(pool: Pool, table: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(pool: Pool, table: string, index: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
    [table, index]
  );
  return Number(rows[0]?.count || 0) > 0;
}

const REQUIRED_COLUMNS = [
  ["tiktok_ads_operation_upgrade_runs", "recoveryKey", "varchar", "NO", null],
  ["tiktok_ads_operation_upgrade_runs", "status", "enum", "NO", "enum('running','success','failed')"],
  ["tiktok_ads_operation_upgrade_runs", "startedAt", "timestamp", "NO", null],
  ["tiktok_ads_operation_upgrade_runs", "completedAt", "timestamp", "YES", null],
  ["tiktok_ads_operation_upgrade_runs", "details", "json", "YES", null],
  ["tiktok_ads_operation_upgrade_runs", "errorCode", "varchar", "YES", null],
  ["tiktok_ads_operations", "id", "bigint", "NO", null],
  ["tiktok_ads_operations", "operationId", "char", "NO", "char(36)"],
  ["tiktok_ads_operations", "requestHash", "char", "NO", "char(64)"],
  ["tiktok_ads_operations", "actorUserId", "int", "NO", null],
  ["tiktok_ads_operations", "actorName", "varchar", "YES", null],
  ["tiktok_ads_operations", "advertiserId", "varchar", "NO", null],
  ["tiktok_ads_operations", "entityType", "enum", "NO", "enum('campaign','adgroup','ad')"],
  ["tiktok_ads_operations", "entityId", "varchar", "NO", null],
  ["tiktok_ads_operations", "entityName", "varchar", "NO", null],
  ["tiktok_ads_operations", "action", "enum", "NO", "enum('status','budget')"],
  ["tiktok_ads_operations", "requestedStatus", "enum", "YES", "enum('ENABLE','DISABLE')"],
  ["tiktok_ads_operations", "requestedBudget", "decimal", "YES", "decimal(20,2)"],
  ["tiktok_ads_operations", "reason", "varchar", "NO", null],
  ["tiktok_ads_operations", "beforeState", "json", "NO", null],
  ["tiktok_ads_operations", "beforeStateHash", "char", "NO", "char(64)"],
  ["tiktok_ads_operations", "status", "enum", "NO", "enum('prepared','executing','succeeded','failed','expired','needs_reconciliation')"],
  ["tiktok_ads_operations", "confirmationExpiresAt", "timestamp", "NO", null],
  ["tiktok_ads_operations", "leaseKey", "varchar", "YES", null],
  ["tiktok_ads_operations", "leaseUntil", "timestamp", "YES", null],
  ["tiktok_ads_operations", "tiktokRequestId", "varchar", "YES", null],
  ["tiktok_ads_operations", "errorCode", "varchar", "YES", null],
  ["tiktok_ads_operations", "afterState", "json", "YES", null],
  ["tiktok_ads_operations", "executedAt", "timestamp", "YES", null],
  ["tiktok_ads_operations", "completedAt", "timestamp", "YES", null],
  ["tiktok_ads_operations", "createdAt", "timestamp", "NO", null],
  ["tiktok_ads_operations", "updatedAt", "timestamp", "NO", null],
  ["tiktok_ads_operation_events", "id", "bigint", "NO", null],
  ["tiktok_ads_operation_events", "operationId", "char", "NO", "char(36)"],
  ["tiktok_ads_operation_events", "actorUserId", "int", "NO", null],
  ["tiktok_ads_operation_events", "eventType", "varchar", "NO", null],
  ["tiktok_ads_operation_events", "payloadJson", "json", "NO", null],
  ["tiktok_ads_operation_events", "createdAt", "timestamp", "NO", null],
] as const;

async function columnMatches(
  pool: Pool,
  table: string,
  column: string,
  dataType: string,
  nullable: string,
  columnType: string | null
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DATA_TYPE AS dataType,COLUMN_TYPE AS columnType,IS_NULLABLE AS nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [table, column]
  );
  const row = rows[0];
  if (!row) return false;
  return String(row.dataType).toLowerCase() === dataType.toLowerCase() &&
    String(row.nullable).toUpperCase() === nullable.toUpperCase() &&
    (columnType === null || String(row.columnType).toLowerCase() === columnType.toLowerCase());
}

async function schemaState(pool: Pool) {
  const checks = [
    ["tiktok_ads_operations", "uk_tiktok_ads_operation_id"],
    ["tiktok_ads_operations", "uk_tiktok_ads_operation_request"],
    ["tiktok_ads_operations", "uk_tiktok_ads_operation_lease"],
    ["tiktok_ads_operations", "idx_tiktok_ads_operation_history"],
    ["tiktok_ads_operation_events", "idx_tiktok_ads_event_operation"],
  ] as const;
  const missing: string[] = [];
  for (const [table, index] of checks) {
    if (!(await tableExists(pool, table)) || !(await indexExists(pool, table, index))) {
      missing.push(`${table}.${index}`);
    }
  }
  for (const [table, column, dataType, nullable, columnType] of REQUIRED_COLUMNS) {
    if (!(await columnMatches(pool, table, column, dataType, nullable, columnType))) {
      missing.push(`${table}.${column}:${dataType}:${nullable}`);
    }
  }
  return { healthy: missing.length === 0, missing };
}

async function latestBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool) {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(BACKUP_REASON, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, BACKUP_REASON]
  );
  if (!rows[0] || String(rows[0].status) !== "success") {
    throw new Error("TIKTOK_ADS_OPERATION_BACKUP_FAILED");
  }
  return Number(rows[0].id);
}

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_ads_operations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operationId CHAR(36) NOT NULL,
    requestHash CHAR(64) NOT NULL,
    actorUserId INT NOT NULL,
    actorName VARCHAR(255) NULL,
    advertiserId VARCHAR(64) NOT NULL,
    entityType ENUM('campaign','adgroup','ad') NOT NULL,
    entityId VARCHAR(64) NOT NULL,
    entityName VARCHAR(512) NOT NULL,
    action ENUM('status','budget') NOT NULL,
    requestedStatus ENUM('ENABLE','DISABLE') NULL,
    requestedBudget DECIMAL(20,2) NULL,
    reason VARCHAR(500) NOT NULL,
    beforeState JSON NOT NULL,
    beforeStateHash CHAR(64) NOT NULL,
    status ENUM('prepared','executing','succeeded','failed','expired','needs_reconciliation') NOT NULL,
    confirmationExpiresAt TIMESTAMP NOT NULL,
    leaseKey VARCHAR(255) NULL,
    leaseUntil TIMESTAMP NULL,
    tiktokRequestId VARCHAR(128) NULL,
    errorCode VARCHAR(128) NULL,
    afterState JSON NULL,
    executedAt TIMESTAMP NULL,
    completedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tiktok_ads_operation_id (operationId),
    UNIQUE KEY uk_tiktok_ads_operation_request (requestHash),
    UNIQUE KEY uk_tiktok_ads_operation_lease (leaseKey),
    INDEX idx_tiktok_ads_operation_history (advertiserId,createdAt),
    INDEX idx_tiktok_ads_operation_target (advertiserId,entityType,entityId,createdAt),
    INDEX idx_tiktok_ads_operation_status (status,leaseUntil)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_ads_operation_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operationId CHAR(36) NOT NULL,
    actorUserId INT NOT NULL,
    eventType VARCHAR(80) NOT NULL,
    payloadJson JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tiktok_ads_event_operation (operationId,id),
    INDEX idx_tiktok_ads_event_actor (actorUserId,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /^TIKTOK_[A-Z0-9_]+$/.test(message) ? message : "TIKTOK_ADS_OPERATION_UPGRADE_FAILED";
}

export async function runTikTokAdsOperationsUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for TikTok Ads operations upgrade");
  const pool = mysql.createPool(databaseUrl);
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 600) AS acquired", [LOCK_KEY]);
    lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!lockAcquired) throw new Error("TIKTOK_ADS_OPERATION_UPGRADE_LOCK_TIMEOUT");
    await ensureRunTable(pool);
    const before = await schemaState(pool);
    if (before.healthy) return;
    await pool.query(
      `INSERT INTO tiktok_ads_operation_upgrade_runs (recoveryKey,status,startedAt,details,errorCode)
       VALUES (?,'running',CURRENT_TIMESTAMP,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorCode=NULL`,
      [UPGRADE_KEY, JSON.stringify({ before })]
    );
    const backupId = await verifiedBackup(pool);
    await createTables(pool);
    const after = await schemaState(pool);
    if (!after.healthy) throw new Error("TIKTOK_ADS_OPERATION_SCHEMA_INCOMPLETE");
    await pool.query(
      "UPDATE tiktok_ads_operation_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorCode=NULL WHERE recoveryKey=?",
      [JSON.stringify({ before, after, backupId, existingRowsModified: 0 }), UPGRADE_KEY]
    );
  } catch (error) {
    await pool.query(
      "UPDATE tiktok_ads_operation_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorCode=? WHERE recoveryKey=?",
      [safeErrorCode(error), UPGRADE_KEY]
    ).catch(() => undefined);
    throw error;
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    connection.release();
    await pool.end();
  }
}

export function startTikTokAdsOperationsUpgradeSetup() {
  if (!setupPromise) {
    setupPromise = runTikTokAdsOperationsUpgradeSetup().catch(error => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export function ensureTikTokAdsOperationsReady() {
  return startTikTokAdsOperationsUpgradeSetup();
}

export async function getTikTokAdsOperationsUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const schema = await schemaState(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,errorCode FROM tiktok_ads_operation_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY]
    );
    return { healthy: schema.healthy, recoveryKey: UPGRADE_KEY, schema, recoveryRun: runs[0] || null };
  } finally {
    await pool.end();
  }
}
