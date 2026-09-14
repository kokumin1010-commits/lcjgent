import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "store-daily-shop-v1";
const PRE_REASON = "pre-store-daily-shop-v1";
const POST_REASON = "post-store-daily-shop-v1";
const REQUIRED_TABLES = [
  "store_daily_shop_imports",
  "store_daily_shop_metrics",
  "store_daily_shop_audit_logs",
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_shop_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableState(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES]
  );
  const existing = rows.map(row => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter(table => !existing.includes(table)) };
}

async function countIfExists(pool: Pool, table: string) {
  const [exists] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table]
  );
  if (!Number(exists[0]?.count || 0)) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0]?.count || 0);
}

async function sourceSnapshot(pool: Pool) {
  return {
    managedStoreCount: await countIfExists(pool, "managed_stores"),
    monthlyUploadCount: await countIfExists(pool, "store_data_uploads"),
    monthlyRefundRowCount: await countIfExists(pool, "store_data_refund_daily"),
    dailyImportCount: await countIfExists(pool, "store_daily_shop_imports"),
    dailyMetricCount: await countIfExists(pool, "store_daily_shop_metrics"),
  };
}

async function latestBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool, reason: string) {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason]
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || "missing row")}`);
  }
  return Number(row.id);
}

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_shop_imports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    businessDate DATE NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    originalFileUrl TEXT NOT NULL,
    originalFileKey VARCHAR(1000) NOT NULL,
    fileSha256 CHAR(64) NOT NULL,
    fileSize BIGINT NOT NULL,
    mimeType VARCHAR(120) NOT NULL,
    parseVersion VARCHAR(80) NOT NULL,
    versionNumber INT NOT NULL DEFAULT 1,
    isCurrent TINYINT(1) NOT NULL DEFAULT 1,
    supersedesId BIGINT NULL,
    rawRowCount INT NOT NULL DEFAULT 0,
    acceptedCount INT NOT NULL DEFAULT 0,
    rejectedCount INT NOT NULL DEFAULT 0,
    status ENUM('success','warning','failed') NOT NULL DEFAULT 'success',
    qualityJson JSON NULL,
    deletedAt TIMESTAMP NULL,
    deletedById BIGINT NULL,
    deletedByName VARCHAR(255) NULL,
    deleteReason VARCHAR(1000) NULL,
    uploadedById BIGINT NULL,
    uploadedByName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    UNIQUE KEY uq_store_daily_shop_file (storeId,fileSha256),
    UNIQUE KEY uq_store_daily_shop_version (storeId,businessDate,versionNumber),
    INDEX idx_store_daily_shop_current (storeId,businessDate,isCurrent,deletedAt,createdAt),
    INDEX idx_store_daily_shop_period (storeId,businessDate,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_shop_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    importId BIGINT NOT NULL,
    storeId INT NOT NULL,
    businessDate DATE NOT NULL,
    gmv DECIMAL(20,4) NULL,
    orderCount DECIMAL(20,4) NULL,
    customerCount DECIMAL(20,4) NULL,
    soldQuantity DECIMAL(20,4) NULL,
    refundAmount DECIMAL(20,4) NULL,
    skuOrderCount DECIMAL(20,4) NULL,
    grossRevenue DECIMAL(20,4) NULL,
    pageViews DECIMAL(20,4) NULL,
    productVisitors DECIMAL(20,4) NULL,
    conversionRate DECIMAL(20,8) NULL,
    productImpressions DECIMAL(20,4) NULL,
    uniqueProductImpressions DECIMAL(20,4) NULL,
    productClicks DECIMAL(20,4) NULL,
    uniqueClicks DECIMAL(20,4) NULL,
    averageOrderValue DECIMAL(20,4) NULL,
    creatorLiveAttributedGmv DECIMAL(20,4) NULL,
    creatorLiveDirectGmv DECIMAL(20,4) NULL,
    creatorLiveIndirectGmv DECIMAL(20,4) NULL,
    boundAccountLiveAttributedGmv DECIMAL(20,4) NULL,
    merchantLiveGmv DECIMAL(20,4) NULL,
    merchantLiveIndirectGmv DECIMAL(20,4) NULL,
    affiliateVideoAttributedGmv DECIMAL(20,4) NULL,
    creatorVideoDirectGmv DECIMAL(20,4) NULL,
    creatorVideoIndirectGmv DECIMAL(20,4) NULL,
    boundAccountVideoAttributedGmv DECIMAL(20,4) NULL,
    merchantVideoGmv DECIMAL(20,4) NULL,
    merchantVideoIndirectGmv DECIMAL(20,4) NULL,
    comparisonJson JSON NULL,
    rawDailyJson JSON NOT NULL,
    rawSummaryJson JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_daily_shop_metric_import (importId),
    INDEX idx_store_daily_shop_metric_date (storeId,businessDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_shop_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    importId BIGINT NULL,
    storeId INT NOT NULL,
    businessDate DATE NULL,
    action VARCHAR(80) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_daily_shop_audit_store (storeId,createdAt),
    INDEX idx_store_daily_shop_audit_import (importId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function getStoreDailyShopUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const tables = await tableState(pool);
    const snapshot = await sourceSnapshot(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,details,errorMessage FROM store_daily_shop_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY]
    );
    return { healthy: tables.missing.length === 0, recoveryKey: UPGRADE_KEY, missingTables: tables.missing, snapshot, recoveryRun: runs[0] || null };
  } finally {
    await pool.end();
  }
}

export async function runStoreDailyShopUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for store daily shop upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const beforeTables = await tableState(pool);
    if (beforeTables.missing.length === 0) {
      console.log("[StoreDailyShopUpgrade] schema healthy");
      return;
    }
    const before = await sourceSnapshot(pool);
    await pool.query(
      `INSERT INTO store_daily_shop_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, before, monthlyUploadsWillBeModified: false })]
    );
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await createTables(pool);
    const afterTables = await tableState(pool);
    if (afterTables.missing.length) throw new Error(`missing tables: ${afterTables.missing.join(",")}`);
    const after = await sourceSnapshot(pool);
    for (const key of ["managedStoreCount", "monthlyUploadCount", "monthlyRefundRowCount"] as const) {
      if (before[key] !== after[key]) throw new Error(`${key} changed during daily schema upgrade: ${before[key]}->${after[key]}`);
    }
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = { beforeTables, afterTables, before, after, preBackupId, postBackupId, existingMonthlyRowsModified: 0, backfilledRows: 0 };
    await pool.query(
      "UPDATE store_daily_shop_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify(details), UPGRADE_KEY]
    );
    console.log(`[StoreDailyShopUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      "UPDATE store_daily_shop_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
      [message.slice(0, 4000), UPGRADE_KEY]
    ).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
