import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const AUCTION_SCHEMA_UPGRADE_KEY = "auction-import-schema-v1";
export const AUCTION_PRE_BACKUP_REASON = "pre-auction-import-schema-v1";
export const AUCTION_POST_BACKUP_REASON = "post-auction-import-schema-v1";

const REQUIRED_COLUMN_SQL: Record<string, string> = {
  productId: "ALTER TABLE auction_records ADD COLUMN productId VARCHAR(255) NULL",
  productName: "ALTER TABLE auction_records ADD COLUMN productName VARCHAR(500) NULL",
  chineseName: "ALTER TABLE auction_records ADD COLUMN chineseName VARCHAR(255) NULL",
  startPrice: "ALTER TABLE auction_records ADD COLUMN startPrice DECIMAL(10,2) NULL",
  finalPrice: "ALTER TABLE auction_records ADD COLUMN finalPrice DECIMAL(10,2) NULL",
  totalGmv: "ALTER TABLE auction_records ADD COLUMN totalGmv DECIMAL(12,2) NULL",
  totalOrders: "ALTER TABLE auction_records ADD COLUMN totalOrders INT NULL",
  auctionCount: "ALTER TABLE auction_records ADD COLUMN auctionCount INT NULL",
  liverName: "ALTER TABLE auction_records ADD COLUMN liverName VARCHAR(255) NULL",
  auctionDate: "ALTER TABLE auction_records ADD COLUMN auctionDate DATE NULL",
  note: "ALTER TABLE auction_records ADD COLUMN note TEXT NULL",
  roundsJson: "ALTER TABLE auction_records ADD COLUMN roundsJson LONGTEXT NULL",
  livestreamId: "ALTER TABLE auction_records ADD COLUMN livestreamId VARCHAR(50) NULL",
  sourceFileName: "ALTER TABLE auction_records ADD COLUMN sourceFileName VARCHAR(500) NULL",
  sourceFileSha256: "ALTER TABLE auction_records ADD COLUMN sourceFileSha256 CHAR(64) NULL",
  sourceRowCount: "ALTER TABLE auction_records ADD COLUMN sourceRowCount INT NULL",
  createdAt: "ALTER TABLE auction_records ADD COLUMN createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
  createdBy: "ALTER TABLE auction_records ADD COLUMN createdBy INT NULL",
  updatedAt: "ALTER TABLE auction_records ADD COLUMN updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
};

export const AUCTION_REQUIRED_COLUMNS = Object.keys(REQUIRED_COLUMN_SQL);
const REQUIRED_IMPORT_BATCH_COLUMN_SQL: Record<string, string> = {
  sourceFileSize: "ALTER TABLE auction_import_batches ADD COLUMN sourceFileSize INT NOT NULL DEFAULT 0",
  sourceMimeType: "ALTER TABLE auction_import_batches ADD COLUMN sourceMimeType VARCHAR(255) NULL",
  sourceStorageKey: "ALTER TABLE auction_import_batches ADD COLUMN sourceStorageKey VARCHAR(1000) NULL",
};
const REQUIRED_IMPORT_BATCH_COLUMNS = Object.keys(REQUIRED_IMPORT_BATCH_COLUMN_SQL);
let schemaReady = false;
let runtimePool: mysql.Pool | undefined;

export function getAuctionPool(): mysql.Pool {
  if (!runtimePool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL is not configured");
    runtimePool = mysql.createPool({ uri, connectionLimit: 3, waitForConnections: true, queueLimit: 30 });
  }
  return runtimePool;
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function getColumns(pool: Pool, tableName: string): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows.map((row) => String(row.columnName));
}

async function createAuctionRecords(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId VARCHAR(255) NULL,
      productName VARCHAR(500) NULL,
      chineseName VARCHAR(255) NULL,
      startPrice DECIMAL(10,2) NULL,
      finalPrice DECIMAL(10,2) NULL,
      totalGmv DECIMAL(12,2) NULL,
      totalOrders INT NULL,
      auctionCount INT NULL,
      liverName VARCHAR(255) NULL,
      auctionDate DATE NULL,
      note TEXT NULL,
      roundsJson LONGTEXT NULL,
      livestreamId VARCHAR(50) NULL,
      sourceFileName VARCHAR(500) NULL,
      sourceFileSha256 CHAR(64) NULL,
      sourceRowCount INT NULL,
      createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      createdBy INT NULL,
      updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_auction_product (productId),
      INDEX idx_auction_date (auctionDate),
      INDEX idx_auction_liver_date (liverName, auctionDate),
      INDEX idx_auction_source_hash (sourceFileSha256)
    )
  `);
}

async function createUpgradeTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_schema_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_import_batches (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sourceFileName VARCHAR(500) NOT NULL,
      sourceFileSha256 CHAR(64) NOT NULL,
      sourceFileSize INT NOT NULL DEFAULT 0,
      sourceMimeType VARCHAR(255) NULL,
      sourceStorageKey VARCHAR(1000) NULL,
      sourceRowCount INT NOT NULL DEFAULT 0,
      groupedRecordCount INT NOT NULL DEFAULT 0,
      importedRecordCount INT NOT NULL DEFAULT 0,
      skippedRowCount INT NOT NULL DEFAULT 0,
      liverName VARCHAR(255) NOT NULL,
      status ENUM('running','success','failed') NOT NULL,
      errorMessage TEXT NULL,
      createdBy INT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      UNIQUE KEY uq_auction_import_hash_liver (sourceFileSha256, liverName),
      INDEX idx_auction_import_created (createdAt),
      INDEX idx_auction_import_status (status)
    )
  `);
}

async function ensureIndexes(pool: Pool): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT INDEX_NAME AS indexName
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auction_records'`,
  );
  const indexes = new Set(rows.map((row) => String(row.indexName)));
  const definitions: Record<string, string> = {
    idx_auction_product: "CREATE INDEX idx_auction_product ON auction_records (productId)",
    idx_auction_date: "CREATE INDEX idx_auction_date ON auction_records (auctionDate)",
    idx_auction_liver_date: "CREATE INDEX idx_auction_liver_date ON auction_records (liverName, auctionDate)",
    idx_auction_source_hash: "CREATE INDEX idx_auction_source_hash ON auction_records (sourceFileSha256)",
  };
  for (const [name, sql] of Object.entries(definitions)) {
    if (!indexes.has(name)) await pool.query(sql);
  }
}

async function getRecordSnapshot(pool: Pool): Promise<{
  rowCount: number;
  maxId: number;
  totalGmv: number;
  totalOrders: number;
}> {
  if (!(await tableExists(pool, "auction_records"))) {
    return { rowCount: 0, maxId: 0, totalGmv: 0, totalOrders: 0 };
  }
  const columns = new Set(await getColumns(pool, "auction_records"));
  const totalGmvExpression = columns.has("totalGmv") ? "COALESCE(SUM(totalGmv), 0)" : "0";
  const totalOrdersExpression = columns.has("totalOrders") ? "COALESCE(SUM(totalOrders), 0)" : "0";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS rowCount,
            COALESCE(MAX(id), 0) AS maxId,
            ${totalGmvExpression} AS totalGmv,
            ${totalOrdersExpression} AS totalOrders
       FROM auction_records`,
  );
  const row = rows[0] || {};
  return {
    rowCount: Number(row.rowCount || 0),
    maxId: Number(row.maxId || 0),
    totalGmv: Number(row.totalGmv || 0),
    totalOrders: Number(row.totalOrders || 0),
  };
}

async function verifyInsertCompatibility(pool: Pool, columnsReady: boolean): Promise<boolean> {
  if (!columnsReady) return false;
  try {
    await pool.query(
      `EXPLAIN INSERT INTO auction_records
       (productId, productName, chineseName, startPrice, finalPrice, totalGmv, totalOrders, auctionCount, liverName, auctionDate, note, roundsJson, livestreamId, sourceFileName, sourceFileSha256, sourceRowCount, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["schema-check", "schema-check", null, 1, 1, 1, 1, 1, "schema-check", "2099-01-01", null, "[]", null, "schema-check.xlsx", "0".repeat(64), 1, 0],
    );
    return true;
  } catch {
    return false;
  }
}

async function latestSuccessfulBackup(pool: Pool, reason: string): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs
      WHERE reason = ? AND status = 'success'
      ORDER BY id DESC LIMIT 1`,
    [reason],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const [beforeRows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  const beforeId = Number(beforeRows[0]?.id || 0);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, errorMessage
       FROM db_backup_runs
      WHERE id > ? AND reason = ?
      ORDER BY id DESC LIMIT 1`,
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || "missing run")}`);
  }
  return Number(row.id);
}

async function getState(pool: Pool) {
  const recordsExists = await tableExists(pool, "auction_records");
  const existingColumns = recordsExists ? await getColumns(pool, "auction_records") : [];
  const missingColumns = AUCTION_REQUIRED_COLUMNS.filter((column) => !existingColumns.includes(column));
  const importBatchesReady = await tableExists(pool, "auction_import_batches");
  const importBatchColumns = importBatchesReady ? await getColumns(pool, "auction_import_batches") : [];
  const missingImportBatchColumns = importBatchesReady
    ? REQUIRED_IMPORT_BATCH_COLUMNS.filter((column) => !importBatchColumns.includes(column))
    : REQUIRED_IMPORT_BATCH_COLUMNS;
  const upgradeRunsReady = await tableExists(pool, "auction_schema_upgrade_runs");
  return { recordsExists, existingColumns, missingColumns, importBatchesReady, importBatchColumns, missingImportBatchColumns, upgradeRunsReady };
}

async function applyUpgrade(pool: Pool, state: Awaited<ReturnType<typeof getState>>): Promise<void> {
  if (!state.recordsExists) await createAuctionRecords(pool);
  const existing = new Set(await getColumns(pool, "auction_records"));
  for (const column of AUCTION_REQUIRED_COLUMNS) {
    if (existing.has(column)) continue;
    const sql = REQUIRED_COLUMN_SQL[column];
    if (!sql) throw new Error(`unsupported auction column: ${column}`);
    await pool.query(sql);
  }
  await ensureIndexes(pool);
  await createUpgradeTables(pool);
  const importBatchColumns = new Set(await getColumns(pool, "auction_import_batches"));
  for (const column of REQUIRED_IMPORT_BATCH_COLUMNS) {
    if (importBatchColumns.has(column)) continue;
    const sql = REQUIRED_IMPORT_BATCH_COLUMN_SQL[column];
    if (!sql) throw new Error(`unsupported auction import column: ${column}`);
    await pool.query(sql);
  }
}

export async function getAuctionSchemaUpgradeHealth(poolOverride?: Pool) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!poolOverride && !databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = poolOverride || mysql.createPool(databaseUrl!);
  const shouldClose = !poolOverride;
  try {
    const state = await getState(pool);
    const writeCompatibilityReady = await verifyInsertCompatibility(pool, state.missingColumns.length === 0);
    const [runRows] = state.upgradeRunsReady
      ? await pool.query<RowDataPacket[]>(
          "SELECT status, completedAt, details, errorMessage FROM auction_schema_upgrade_runs WHERE recoveryKey = ? LIMIT 1",
          [AUCTION_SCHEMA_UPGRADE_KEY],
        )
      : [[] as unknown as RowDataPacket[], [] as unknown as any];
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum, errorMessage
         FROM db_backup_runs
        WHERE reason IN (?, ?)
        ORDER BY id DESC LIMIT 6`,
      [AUCTION_PRE_BACKUP_REASON, AUCTION_POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      healthy: state.recordsExists && state.missingColumns.length === 0 && state.importBatchesReady && state.missingImportBatchColumns.length === 0 && state.upgradeRunsReady && writeCompatibilityReady && String(run?.status || "") === "success",
      ...state,
      requiredColumnCount: AUCTION_REQUIRED_COLUMNS.length,
      writeCompatibilityReady,
      recordSnapshot: await getRecordSnapshot(pool),
      run: run
        ? {
            status: String(run.status),
            completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
            details: typeof run.details === "string" ? JSON.parse(run.details) : run.details,
            errorMessage: run.errorMessage == null ? null : String(run.errorMessage),
          }
        : null,
      backups: backupRows.map((row) => ({
        id: Number(row.id),
        reason: String(row.reason),
        status: String(row.status),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        tableCount: row.tableCount == null ? null : Number(row.tableCount),
        rowCount: row.rowCount == null ? null : Number(row.rowCount),
        encryptedBytes: row.encryptedBytes == null ? null : Number(row.encryptedBytes),
        checksum: row.checksum == null ? null : String(row.checksum),
        errorMessage: row.errorMessage == null ? null : String(row.errorMessage),
      })),
    };
  } finally {
    if (shouldClose) await pool.end();
  }
}

export async function ensureAuctionSchemaReady(poolOverride?: Pool): Promise<void> {
  if (schemaReady) return;
  const health = await getAuctionSchemaUpgradeHealth(poolOverride);
  if (!health.healthy) {
    throw new Error(`auction schema is not ready: missing=${health.missingColumns.join(",")} batches=${health.importBatchesReady} write=${health.writeCompatibilityReady}`);
  }
  schemaReady = true;
}

export async function runAuctionSchemaUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for auction schema upgrade");
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2, waitForConnections: true });
  try {
    const beforeState = await getState(pool);
    let completedRun = false;
    if (beforeState.upgradeRunsReady) {
      const [runRows] = await pool.query<RowDataPacket[]>(
        "SELECT status FROM auction_schema_upgrade_runs WHERE recoveryKey = ? LIMIT 1",
        [AUCTION_SCHEMA_UPGRADE_KEY],
      );
      completedRun = String(runRows[0]?.status || "") === "success";
    }
    if (
      beforeState.recordsExists &&
      beforeState.missingColumns.length === 0 &&
      beforeState.importBatchesReady &&
      beforeState.missingImportBatchColumns.length === 0 &&
      beforeState.upgradeRunsReady &&
      completedRun &&
      (await verifyInsertCompatibility(pool, true))
    ) {
      schemaReady = true;
      console.log(`[AuctionSchemaUpgrade] schema healthy columns=${AUCTION_REQUIRED_COLUMNS.length}`);
      return;
    }

    const beforeSnapshot = await getRecordSnapshot(pool);
    let preBackupId = await latestSuccessfulBackup(pool, AUCTION_PRE_BACKUP_REASON);
    if (!preBackupId) preBackupId = await runVerifiedBackup(pool, AUCTION_PRE_BACKUP_REASON);

    await applyUpgrade(pool, beforeState);
    await pool.query(
      `INSERT INTO auction_schema_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [AUCTION_SCHEMA_UPGRADE_KEY, JSON.stringify({ beforeState, beforeSnapshot, preBackupId })],
    );

    const afterState = await getState(pool);
    const writeCompatibilityReady = await verifyInsertCompatibility(pool, afterState.missingColumns.length === 0);
    const afterSnapshot = await getRecordSnapshot(pool);
    if (afterState.missingColumns.length > 0 || !afterState.importBatchesReady || afterState.missingImportBatchColumns.length > 0 || !writeCompatibilityReady) {
      throw new Error(`auction schema still incomplete: missing=${afterState.missingColumns.join(",")} importMissing=${afterState.missingImportBatchColumns.join(",")} batches=${afterState.importBatchesReady} write=${writeCompatibilityReady}`);
    }
    if (
      beforeSnapshot.rowCount !== afterSnapshot.rowCount ||
      beforeSnapshot.maxId !== afterSnapshot.maxId ||
      beforeSnapshot.totalGmv !== afterSnapshot.totalGmv ||
      beforeSnapshot.totalOrders !== afterSnapshot.totalOrders
    ) {
      throw new Error(`auction data changed during schema migration: before=${JSON.stringify(beforeSnapshot)} after=${JSON.stringify(afterSnapshot)}`);
    }

    const postBackupId = await runVerifiedBackup(pool, AUCTION_POST_BACKUP_REASON);
    const details = {
      beforeState,
      afterState,
      beforeSnapshot,
      afterSnapshot,
      writeCompatibilityReady,
      preBackupId,
      postBackupId,
      dataRowsModified: 0,
    };
    await pool.query(
      `UPDATE auction_schema_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(details), AUCTION_SCHEMA_UPGRADE_KEY],
    );
    schemaReady = true;
    console.log(`[AuctionSchemaUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (await tableExists(pool, "auction_schema_upgrade_runs").catch(() => false)) {
      await pool
        .query(
          `UPDATE auction_schema_upgrade_runs
              SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
            WHERE recoveryKey=?`,
          [message.slice(0, 4000), AUCTION_SCHEMA_UPGRADE_KEY],
        )
        .catch(() => undefined);
    }
    console.error(`[AuctionSchemaUpgrade] failed ${message}`);
    throw error;
  } finally {
    await pool.end();
  }
}
