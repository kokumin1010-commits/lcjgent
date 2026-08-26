import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "procurement-schema-v1";
const PRE_BACKUP_REASON = "pre-procurement-v1";
const POST_BACKUP_REASON = "post-procurement-v1";

const REQUIRED_COLUMN_SQL: Record<string, string> = {
  liveRoom: "ALTER TABLE procurement_orders ADD COLUMN liveRoom VARCHAR(100) NULL",
  shopName: "ALTER TABLE procurement_orders ADD COLUMN shopName VARCHAR(255) NULL",
  productLink: "ALTER TABLE procurement_orders ADD COLUMN productLink TEXT NULL",
  orderStatus: "ALTER TABLE procurement_orders ADD COLUMN orderStatus VARCHAR(100) NULL",
  pendingPaymentQty: "ALTER TABLE procurement_orders ADD COLUMN pendingPaymentQty INT NOT NULL DEFAULT 0",
  pendingShipQty: "ALTER TABLE procurement_orders ADD COLUMN pendingShipQty INT NOT NULL DEFAULT 0",
  qtyPerOrder: "ALTER TABLE procurement_orders ADD COLUMN qtyPerOrder INT NOT NULL DEFAULT 1",
  bundleId: "ALTER TABLE procurement_orders ADD COLUMN bundleId INT NULL",
  expectedArrivalDate: "ALTER TABLE procurement_orders ADD COLUMN expectedArrivalDate DATE NULL",
};
const REQUIRED_COLUMNS = Object.keys(REQUIRED_COLUMN_SQL);
const EXPECTED_ARRIVAL_INDEX = "idx_procurement_expected_arrival";

async function ensureBaseTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandId INT NOT NULL,
      brandName VARCHAR(255) NOT NULL,
      productId INT NULL,
      productName VARCHAR(500) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unitCost DECIMAL(12,2) NOT NULL DEFAULT 0,
      totalCost DECIMAL(14,2) NOT NULL DEFAULT 0,
      orderDate DATE NOT NULL,
      expectedArrivalDate DATE NULL,
      status ENUM('pending','ordered','received','completed','cancelled') NOT NULL DEFAULT 'pending',
      memo TEXT NULL,
      liveRoom VARCHAR(100) NULL,
      shopName VARCHAR(255) NULL,
      productLink TEXT NULL,
      orderStatus VARCHAR(100) NULL,
      pendingPaymentQty INT NOT NULL DEFAULT 0,
      pendingShipQty INT NOT NULL DEFAULT 0,
      qtyPerOrder INT NOT NULL DEFAULT 1,
      bundleId INT NULL,
      createdBy INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_procurement_brand (brandId),
      INDEX idx_procurement_date (orderDate),
      INDEX idx_procurement_status (status),
      INDEX idx_procurement_expected_arrival (expectedArrivalDate),
      INDEX idx_procurement_bundle (bundleId)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procurement_schema_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    )
  `);
}

async function getColumnState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'procurement_orders'`,
  );
  const existing = rows.map((row) => String(row.columnName));
  return { existing, missing: REQUIRED_COLUMNS.filter((column) => !existing.includes(column)) };
}

async function hasExpectedArrivalIndex(pool: Pool): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'procurement_orders'
        AND INDEX_NAME = ?`,
    [EXPECTED_ARRIVAL_INDEX],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function verifyWriteCompatibility(pool: Pool, columnsReady: boolean): Promise<boolean> {
  if (!columnsReady) return false;
  try {
    await pool.query(
      `EXPLAIN INSERT INTO procurement_orders
       (brandId, brandName, productId, productName, quantity, unitCost, totalCost, orderDate, expectedArrivalDate, status, memo, liveRoom, shopName, productLink, orderStatus, pendingPaymentQty, pendingShipQty, qtyPerOrder, bundleId, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [0, "schema-check", null, "schema-check", 1, 0, 0, "2099-01-01", "2099-01-02", "pending", null, "schema-check", "schema-check", null, null, 0, 0, 1, null, 0],
    );
    return true;
  } catch {
    return false;
  }
}

async function getOrderSnapshot(pool: Pool, columnsReady: boolean): Promise<{
  orderCount: number;
  maxOrderId: number;
  totalQuantity: number;
  totalCost: number;
  expectedArrivalCount: number;
  liveRoomCount: number;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(
    columnsReady
      ? `SELECT COUNT(*) AS orderCount,
                COALESCE(MAX(id), 0) AS maxOrderId,
                COALESCE(SUM(quantity), 0) AS totalQuantity,
                COALESCE(SUM(totalCost), 0) AS totalCost,
                SUM(CASE WHEN expectedArrivalDate IS NOT NULL THEN 1 ELSE 0 END) AS expectedArrivalCount,
                SUM(CASE WHEN liveRoom IS NOT NULL AND liveRoom <> '' THEN 1 ELSE 0 END) AS liveRoomCount
           FROM procurement_orders`
      : `SELECT COUNT(*) AS orderCount,
                COALESCE(MAX(id), 0) AS maxOrderId,
                COALESCE(SUM(quantity), 0) AS totalQuantity,
                COALESCE(SUM(totalCost), 0) AS totalCost,
                0 AS expectedArrivalCount,
                0 AS liveRoomCount
           FROM procurement_orders`,
  );
  const row = rows[0] || {};
  return {
    orderCount: Number(row.orderCount || 0),
    maxOrderId: Number(row.maxOrderId || 0),
    totalQuantity: Number(row.totalQuantity || 0),
    totalCost: Number(row.totalCost || 0),
    expectedArrivalCount: Number(row.expectedArrivalCount || 0),
    liveRoomCount: Number(row.liveRoomCount || 0),
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

async function applySchemaUpgrade(pool: Pool, missing: string[], indexMissing: boolean): Promise<void> {
  for (const column of missing) {
    const statement = REQUIRED_COLUMN_SQL[column];
    if (!statement) throw new Error(`unsupported procurement column: ${column}`);
    await pool.query(statement);
  }
  await pool.query(
    "ALTER TABLE procurement_orders MODIFY COLUMN status ENUM('pending','ordered','received','completed','cancelled') NOT NULL DEFAULT 'pending'",
  );
  if (indexMissing) {
    await pool.query(`CREATE INDEX ${EXPECTED_ARRIVAL_INDEX} ON procurement_orders (expectedArrivalDate)`);
  }
}

export async function getProcurementSchemaUpgradeHealth(): Promise<{
  healthy: boolean;
  recoveryKey: string;
  requiredColumnCount: number;
  missingColumns: string[];
  expectedArrivalIndexReady: boolean;
  writeCompatibilityReady: boolean;
  orderSnapshot: Awaited<ReturnType<typeof getOrderSnapshot>>;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null; details: unknown } | null;
  backups: Array<{ id: number; reason: string; status: string; tableCount: number | null; rowCount: number | null; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const columns = await getColumnState(pool);
    const indexReady = columns.missing.includes("expectedArrivalDate") ? false : await hasExpectedArrivalIndex(pool);
    const writeCompatibilityReady = await verifyWriteCompatibility(pool, columns.missing.length === 0);
    const orderSnapshot = await getOrderSnapshot(pool, columns.missing.length === 0);
    const [runRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, errorMessage, details FROM procurement_schema_upgrade_runs WHERE recoveryKey = ? LIMIT 1",
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
      healthy: columns.missing.length === 0 && indexReady && writeCompatibilityReady,
      recoveryKey: UPGRADE_KEY,
      requiredColumnCount: REQUIRED_COLUMNS.length,
      missingColumns: columns.missing,
      expectedArrivalIndexReady: indexReady,
      writeCompatibilityReady,
      orderSnapshot,
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

export async function runProcurementSchemaUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for procurement schema upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureBaseTables(pool);
    const beforeColumns = await getColumnState(pool);
    const beforeIndexReady = beforeColumns.missing.includes("expectedArrivalDate") ? false : await hasExpectedArrivalIndex(pool);
    if (beforeColumns.missing.length === 0 && beforeIndexReady) {
      console.log(`[ProcurementSchemaUpgrade] schema healthy columns=${REQUIRED_COLUMNS.length}`);
      return;
    }
    const beforeSnapshot = await getOrderSnapshot(pool, beforeColumns.missing.length === 0);
    await pool.query(
      `INSERT INTO procurement_schema_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeColumns, beforeIndexReady, beforeSnapshot, requiredColumns: REQUIRED_COLUMNS })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await applySchemaUpgrade(pool, beforeColumns.missing, !beforeIndexReady);
    const afterColumns = await getColumnState(pool);
    const afterIndexReady = await hasExpectedArrivalIndex(pool);
    const writeCompatibilityReady = await verifyWriteCompatibility(pool, afterColumns.missing.length === 0);
    if (afterColumns.missing.length > 0 || !afterIndexReady || !writeCompatibilityReady) {
      throw new Error(`procurement schema still incomplete: columns=${afterColumns.missing.join(",")} index=${afterIndexReady} write=${writeCompatibilityReady}`);
    }
    const afterSnapshot = await getOrderSnapshot(pool, true);
    if (
      afterSnapshot.orderCount !== beforeSnapshot.orderCount ||
      afterSnapshot.maxOrderId !== beforeSnapshot.maxOrderId ||
      afterSnapshot.totalQuantity !== beforeSnapshot.totalQuantity ||
      afterSnapshot.totalCost !== beforeSnapshot.totalCost
    ) {
      throw new Error(`procurement data changed during schema migration: before=${JSON.stringify(beforeSnapshot)} after=${JSON.stringify(afterSnapshot)}`);
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      beforeColumns,
      afterColumns,
      beforeIndexReady,
      afterIndexReady,
      writeCompatibilityReady,
      beforeSnapshot,
      afterSnapshot,
      preBackupId,
      postBackupId,
      dataRowsModified: 0,
      oldTiDBUsed: false,
    };
    await pool.query(
      `UPDATE procurement_schema_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[ProcurementSchemaUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE procurement_schema_upgrade_runs
          SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
        WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    console.error(`[ProcurementSchemaUpgrade] failed ${message}`);
    throw error;
  } finally {
    await pool.end();
  }
}
