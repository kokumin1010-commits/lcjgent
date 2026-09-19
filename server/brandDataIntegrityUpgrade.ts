import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const LOCK_KEY = "brand-data-integrity-v1";
const UPGRADE_KEY = "brand-data-integrity-v1";
const PRE_BACKUP_REASON = "pre-brand-data-schema-v1";
const POST_BACKUP_REASON = "post-brand-data-schema-v1";
let setupPromise: Promise<void> | null = null;

const REQUIRED_TABLES = [
  "brand_data_integrity_upgrade_runs",
  "brand_lark_sync_runs",
  "brand_lark_source_snapshots",
  "brand_lark_field_changes",
  "brand_data_recovery_runs",
  "brand_data_recovery_items",
] as const;

const REQUIRED_BRAND_COLUMNS = {
  larkReportedGmv: "DECIMAL(20,2) NULL",
  larkReportedSalesAmount: "DECIMAL(20,2) NULL",
  larkNumericFacts: "JSON NULL",
  larkSourceHash: "CHAR(64) NULL",
} as const;
const REQUIRED_SYNC_RUN_COLUMNS = {
  actorUserId: "BIGINT NULL",
  actorName: "VARCHAR(255) NULL",
} as const;

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnDataType(pool: Pool, tableName: string, columnName: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [tableName, columnName],
  );
  return rows[0]?.dataType ? String(rows[0].dataType).toLowerCase() : null;
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_data_integrity_upgrade_runs (
    recoveryKey VARCHAR(100) NOT NULL PRIMARY KEY,
    status VARCHAR(24) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function schemaState(pool: Pool) {
  const tables = Object.fromEntries(await Promise.all(REQUIRED_TABLES.map(async table => [table, await tableExists(pool, table)])));
  const columns = Object.fromEntries(await Promise.all(Object.keys(REQUIRED_BRAND_COLUMNS).map(async column => [column, await columnExists(pool, "brands", column)])));
  const syncRunColumns = Object.fromEntries(await Promise.all(Object.keys(REQUIRED_SYNC_RUN_COLUMNS).map(async column => [column, await columnExists(pool, "brand_lark_sync_runs", column)])));
  const monetaryColumnTypes = await Promise.all(["larkReportedGmv", "larkReportedSalesAmount"].map(column => columnDataType(pool, "brands", column)));
  const monetaryColumnsAreDecimal = monetaryColumnTypes.every(type => type === "decimal");
  return {
    tables,
    columns,
    syncRunColumns,
    monetaryColumnsAreDecimal,
    healthy: Object.values(tables).every(Boolean) && Object.values(columns).every(Boolean) && Object.values(syncRunColumns).every(Boolean) && monetaryColumnsAreDecimal,
  };
}

async function verifiedBackup(pool: Pool, reason = PRE_BACKUP_REASON): Promise<number> {
  let beforeId = 0;
  if (await tableExists(pool, "db_backup_runs")) {
    const [beforeRows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS maxId FROM db_backup_runs");
    beforeId = Number(beforeRows[0]?.maxId || 0);
  }
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") throw new Error(`verified backup failed: ${String(row?.errorMessage || "missing run")}`);
  return Number(row.id);
}

async function createTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_lark_sync_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(24) NOT NULL,
    triggeredBy VARCHAR(50) NOT NULL,
    actorUserId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    totalRecords INT NOT NULL DEFAULT 0,
    matchedRecords INT NOT NULL DEFAULT 0,
    createdRecords INT NOT NULL DEFAULT 0,
    updatedFields INT NOT NULL DEFAULT 0,
    preservedFields INT NOT NULL DEFAULT 0,
    conflictFields INT NOT NULL DEFAULT 0,
    errorCount INT NOT NULL DEFAULT 0,
    sourceDigest CHAR(64) NULL,
    details JSON NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    KEY idx_brand_lark_runs_time (startedAt),
    KEY idx_brand_lark_runs_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_lark_source_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    syncRunId BIGINT NOT NULL,
    recordId VARCHAR(255) NOT NULL,
    brandId INT NULL,
    sourceHash CHAR(64) NOT NULL,
    rawFields JSON NOT NULL,
    normalizedFields JSON NOT NULL,
    fieldNames JSON NOT NULL,
    collectedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_brand_lark_snapshot_run_record (syncRunId,recordId),
    KEY idx_brand_lark_snapshot_record_time (recordId,collectedAt),
    KEY idx_brand_lark_snapshot_brand_time (brandId,collectedAt),
    KEY idx_brand_lark_snapshot_hash (sourceHash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_lark_field_changes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    syncRunId BIGINT NOT NULL,
    brandId INT NULL,
    recordId VARCHAR(255) NOT NULL,
    targetField VARCHAR(100) NOT NULL,
    sourceField VARCHAR(255) NULL,
    action VARCHAR(32) NOT NULL,
    beforeValue JSON NULL,
    incomingValue JSON NULL,
    afterValue JSON NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_brand_lark_change_run (syncRunId),
    KEY idx_brand_lark_change_brand_time (brandId,createdAt),
    KEY idx_brand_lark_change_action (action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_data_recovery_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(100) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL,
    sourceBackupId BIGINT NULL,
    preBackupId BIGINT NULL,
    postBackupId BIGINT NULL,
    proposedItems INT NOT NULL DEFAULT 0,
    appliedItems INT NOT NULL DEFAULT 0,
    conflictItems INT NOT NULL DEFAULT 0,
    details JSON NULL,
    errorMessage TEXT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    UNIQUE KEY uq_brand_data_recovery_key (runKey),
    KEY idx_brand_data_recovery_time (startedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS brand_data_recovery_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recoveryRunId BIGINT NOT NULL,
    sourceKind VARCHAR(48) NOT NULL,
    sourceReference VARCHAR(255) NULL,
    sourceBrandId INT NULL,
    targetBrandId INT NULL,
    tableName VARCHAR(128) NULL,
    recordId VARCHAR(255) NULL,
    fieldName VARCHAR(128) NULL,
    action VARCHAR(48) NOT NULL,
    status VARCHAR(24) NOT NULL,
    evidence JSON NULL,
    beforeValue JSON NULL,
    afterValue JSON NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_brand_recovery_item_run (recoveryRunId),
    KEY idx_brand_recovery_item_brand (targetBrandId,createdAt),
    KEY idx_brand_recovery_item_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function createColumns(pool: Pool): Promise<void> {
  for (const [column, definition] of Object.entries(REQUIRED_BRAND_COLUMNS)) {
    if (!await columnExists(pool, "brands", column)) {
      if (!/^[A-Za-z0-9_]+$/.test(column)) throw new Error(`unsafe brand column ${column}`);
      await pool.query(`ALTER TABLE brands ADD COLUMN \`${column}\` ${definition}`);
    }
  }
  for (const [column, definition] of Object.entries(REQUIRED_SYNC_RUN_COLUMNS)) {
    if (!await columnExists(pool, "brand_lark_sync_runs", column)) {
      await pool.query(`ALTER TABLE brand_lark_sync_runs ADD COLUMN \`${column}\` ${definition}`);
    }
  }
  for (const column of ["larkReportedGmv", "larkReportedSalesAmount"] as const) {
    if (await columnDataType(pool, "brands", column) !== "decimal") {
      await pool.query(`ALTER TABLE brands MODIFY COLUMN \`${column}\` DECIMAL(20,2) NULL`);
    }
  }
}

export async function runBrandDataIntegrityUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand data integrity upgrade");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z" });
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,600) AS acquired", [LOCK_KEY]);
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("brand data integrity upgrade lock timeout");
    const beforeSchema = await schemaState(pool);
    if (beforeSchema.healthy) {
      const [existingRows] = await pool.query<RowDataPacket[]>("SELECT status FROM brand_data_integrity_upgrade_runs WHERE recoveryKey=? LIMIT 1", [UPGRADE_KEY]);
      if (!existingRows[0] || String(existingRows[0].status) === "success") return;
      const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
      await pool.query("UPDATE brand_data_integrity_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
        [JSON.stringify({ resumedAfterSchemaCommit: true, afterSchema: beforeSchema, postBackupId }), UPGRADE_KEY]);
      return;
    }
    const backupId = await verifiedBackup(pool);
    await ensureRunTable(pool);
    await pool.query(`INSERT INTO brand_data_integrity_upgrade_runs (recoveryKey,status,startedAt,details)
      VALUES (?,'running',CURRENT_TIMESTAMP,?)
      ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
    [UPGRADE_KEY, JSON.stringify({ beforeSchema })]);
    await createTables(pool);
    await createColumns(pool);
    const afterSchema = await schemaState(pool);
    if (!afterSchema.healthy) throw new Error("brand data integrity schema incomplete");
    const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
    await pool.query("UPDATE brand_data_integrity_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify({ beforeSchema, afterSchema, backupId, postBackupId }), UPGRADE_KEY]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query("UPDATE brand_data_integrity_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
      [message.slice(0, 4000), UPGRADE_KEY]).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    connection.release();
    await pool.end();
  }
}

export function ensureBrandDataIntegrityReady(): Promise<void> {
  if (!setupPromise) setupPromise = runBrandDataIntegrityUpgradeSetup().catch(error => {
    setupPromise = null;
    throw error;
  });
  return setupPromise;
}

export async function getBrandDataIntegrityUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z" });
  try {
    const schema = await schemaState(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,errorMessage FROM brand_data_integrity_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY],
    ).catch(() => [[] as RowDataPacket[], undefined] as any);
    const run = rows[0];
    return {
      healthy: schema.healthy && (!run || String(run.status) === "success"),
      schema,
      run: run ? { status: String(run.status), completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null, hasError: Boolean(run.errorMessage) } : null,
    };
  } finally {
    await pool.end();
  }
}
