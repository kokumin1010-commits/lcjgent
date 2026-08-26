import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "store-products-v1";
const PRE_BACKUP_REASON = "pre-store-products-v1";
const POST_BACKUP_REASON = "post-store-products-v1";
const REQUIRED_TABLES = [
  "store_products",
  "store_product_skus",
  "store_product_images",
  "store_product_promotions",
  "store_product_audit_logs",
] as const;

async function ensureUpgradeTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_product_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    )
  `);
}

async function getTableState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES],
  );
  const existing = rows.map((row) => String(row.tableName));
  return {
    existing,
    missing: REQUIRED_TABLES.filter((table) => !existing.includes(table)),
  };
}

async function getSnapshot(pool: Pool): Promise<{
  activeStoreCount: number;
  productCount: number;
  skuCount: number;
  imageCount: number;
  promotionCount: number;
  auditCount: number;
}> {
  const tables = await getTableState(pool);
  const has = (name: string) => tables.existing.includes(name);
  const count = async (table: string): Promise<number> => {
    if (!has(table)) return 0;
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    return Number(rows[0]?.count || 0);
  };
  const [storeRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM managed_stores WHERE isActive = 1",
  );
  return {
    activeStoreCount: Number(storeRows[0]?.count || 0),
    productCount: await count("store_products"),
    skuCount: await count("store_product_skus"),
    imageCount: await count("store_product_images"),
    promotionCount: await count("store_product_promotions"),
    auditCount: await count("store_product_audit_logs"),
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

async function createBusinessTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      storeId INT NOT NULL,
      selectionProductId INT NULL,
      platformProductId VARCHAR(128) NULL,
      spuCode VARCHAR(128) NULL,
      productName VARCHAR(500) NOT NULL,
      brandName VARCHAR(255) NULL,
      category VARCHAR(255) NULL,
      productUrl VARCHAR(1000) NULL,
      basePrice DECIMAL(12,2) NULL,
      currency VARCHAR(16) NOT NULL DEFAULT 'JPY',
      stock INT NOT NULL DEFAULT 0,
      status ENUM('draft','online','offline') NOT NULL DEFAULT 'draft',
      mainImageUrl VARCHAR(1000) NULL,
      mainImageKey VARCHAR(500) NULL,
      notes TEXT NULL,
      createdById INT NULL,
      createdByName VARCHAR(255) NULL,
      updatedById INT NULL,
      updatedByName VARCHAR(255) NULL,
      deletedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_store_platform_product (storeId, platformProductId),
      UNIQUE KEY uq_store_spu_code (storeId, spuCode),
      INDEX idx_store_product_list (storeId, deletedAt, status, updatedAt),
      INDEX idx_store_product_brand (storeId, brandName),
      INDEX idx_store_product_selection (selectionProductId)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_product_skus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      platformSkuId VARCHAR(128) NULL,
      skuCode VARCHAR(128) NULL,
      barcode VARCHAR(128) NULL,
      variantName VARCHAR(500) NOT NULL,
      imageUrl VARCHAR(1000) NULL,
      imageKey VARCHAR(500) NULL,
      salePrice DECIMAL(12,2) NULL,
      stock INT NOT NULL DEFAULT 0,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      createdById INT NULL,
      createdByName VARCHAR(255) NULL,
      updatedById INT NULL,
      updatedByName VARCHAR(255) NULL,
      deletedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_product_platform_sku (productId, platformSkuId),
      UNIQUE KEY uq_product_sku_code (productId, skuCode),
      INDEX idx_store_product_sku_list (productId, deletedAt, status),
      INDEX idx_store_product_sku_barcode (barcode)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_product_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      skuId INT NULL,
      imageUrl VARCHAR(1000) NOT NULL,
      imageKey VARCHAR(500) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      fileSize INT NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isPrimary TINYINT(1) NOT NULL DEFAULT 0,
      uploadedById INT NULL,
      uploadedByName VARCHAR(255) NULL,
      deletedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_store_product_image_key (imageKey),
      INDEX idx_store_product_images (productId, skuId, deletedAt, sortOrder)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_product_promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      skuId INT NULL,
      isEnabled TINYINT(1) NOT NULL DEFAULT 1,
      discountType ENUM('percentage','fixed_amount') NOT NULL,
      discountValue DECIMAL(12,2) NOT NULL,
      basePriceSnapshot DECIMAL(12,2) NOT NULL,
      promotionPrice DECIMAL(12,2) NOT NULL,
      startsAt DATETIME NULL,
      endsAt DATETIME NULL,
      channel VARCHAR(100) NULL,
      status ENUM('draft','scheduled','active','paused','ended') NOT NULL DEFAULT 'draft',
      notes TEXT NULL,
      createdById INT NULL,
      createdByName VARCHAR(255) NULL,
      updatedById INT NULL,
      updatedByName VARCHAR(255) NULL,
      deletedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_store_product_promotion_list (productId, deletedAt, status, startsAt, endsAt),
      INDEX idx_store_product_promotion_active (isEnabled, status, startsAt, endsAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_product_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      productId INT NULL,
      skuId INT NULL,
      promotionId INT NULL,
      storeId INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      actorId INT NULL,
      actorName VARCHAR(255) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_product_audit_product (productId, createdAt),
      INDEX idx_store_product_audit_store (storeId, createdAt),
      INDEX idx_store_product_audit_action (action, createdAt)
    )
  `);
}

export async function getStoreProductUpgradeHealth(): Promise<{
  healthy: boolean;
  recoveryKey: string;
  requiredTableCount: number;
  missingTables: string[];
  snapshot: Awaited<ReturnType<typeof getSnapshot>>;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null; details: unknown } | null;
  backups: Array<{ id: number; reason: string; status: string; tableCount: number | null; rowCount: number | null; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureUpgradeTables(pool);
    const tables = await getTableState(pool);
    const snapshot = await getSnapshot(pool);
    const [runRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, completedAt, errorMessage, details FROM store_product_upgrade_runs WHERE recoveryKey = ? LIMIT 1",
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
      healthy: tables.missing.length === 0 && snapshot.activeStoreCount === 5,
      recoveryKey: UPGRADE_KEY,
      requiredTableCount: REQUIRED_TABLES.length,
      missingTables: tables.missing,
      snapshot,
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

export async function runStoreProductUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for store product upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureUpgradeTables(pool);
    const beforeTables = await getTableState(pool);
    if (beforeTables.missing.length === 0) {
      console.log(`[StoreProductUpgrade] schema healthy tables=${REQUIRED_TABLES.length}`);
      return;
    }
    const beforeSnapshot = await getSnapshot(pool);
    if (beforeSnapshot.activeStoreCount !== 5) {
      throw new Error(`active store count changed before upgrade: ${beforeSnapshot.activeStoreCount}`);
    }
    await pool.query(
      `INSERT INTO store_product_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, beforeSnapshot, requiredTables: REQUIRED_TABLES })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await createBusinessTables(pool);
    const afterTables = await getTableState(pool);
    if (afterTables.missing.length > 0) {
      throw new Error(`store product tables still missing: ${afterTables.missing.join(",")}`);
    }
    const afterSnapshot = await getSnapshot(pool);
    if (afterSnapshot.activeStoreCount !== beforeSnapshot.activeStoreCount) {
      throw new Error(`active store count changed during upgrade: ${beforeSnapshot.activeStoreCount}->${afterSnapshot.activeStoreCount}`);
    }
    for (const key of ["productCount", "skuCount", "imageCount", "promotionCount", "auditCount"] as const) {
      if (afterSnapshot[key] !== beforeSnapshot[key]) {
        throw new Error(`${key} changed during schema-only upgrade: ${beforeSnapshot[key]}->${afterSnapshot[key]}`);
      }
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      beforeTables,
      afterTables,
      beforeSnapshot,
      afterSnapshot,
      preBackupId,
      postBackupId,
      dataRowsModified: 0,
      oldTiDBUsed: false,
    };
    await pool.query(
      `UPDATE store_product_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[StoreProductUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE store_product_upgrade_runs
          SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
        WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    console.error(`[StoreProductUpgrade] failed ${message}`);
    throw error;
  } finally {
    await pool.end();
  }
}
