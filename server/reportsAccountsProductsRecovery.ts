import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import evidence from "./reportsAccountsProductsRecoveryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = evidence.version;
const DATASET_SHA256 = evidence.evidenceSha256;
const PRE_BACKUP_REASON = "pre-report-product-v1";
const POST_BACKUP_REASON = "post-report-product-v1";
const OLD_IMAGE_HOST = "d2xsxph8kpxj0f.cloudfront.net";
const RECOVERED_IMAGE_PREFIX = "/recovered-product-images/";

type ApprovedImage = (typeof evidence.products.approvedImages)[number];
type HistoricalProduct = (typeof evidence.products.historicalCatalog)[number];
type OrphanFollowup = (typeof evidence.reports.orphanFollowups)[number];

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for reports/accounts/products recovery");
  return mysql.createPool(databaseUrl);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseImageList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return typeof value === "string" && value.trim() ? [value.trim()] : [];
  }
}

function canReplaceRecoveredImage(urls: string[]): boolean {
  if (urls.length === 0) return true;
  return urls.every((url) => url.includes(OLD_IMAGE_HOST) || url.startsWith(RECOVERED_IMAGE_PREFIX));
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS report_recovery_orphan_followups (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(160) NOT NULL,
    legacyFollowupId bigint NOT NULL,
    legacyReportId bigint NOT NULL,
    legacyReportStaffId bigint NULL,
    category varchar(80) NULL,
    extractedItem text NULL,
    status varchar(40) NULL,
    dueDate date NULL,
    resultCategory varchar(80) NULL,
    resultNote text NULL,
    completedNote text NULL,
    completedAt datetime NULL,
    sourceCreatedAt datetime NULL,
    sourceUpdatedAt datetime NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY report_recovery_orphan_key_unique (evidenceKey),
    KEY report_recovery_orphan_staff_idx (legacyReportStaffId),
    KEY report_recovery_orphan_status_idx (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS historical_product_catalog (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(160) NOT NULL,
    sourceTable varchar(80) NOT NULL,
    sourceId varchar(80) NOT NULL,
    displayName text NOT NULL,
    category varchar(255) NULL,
    description text NULL,
    brandId varchar(80) NULL,
    regularPrice bigint NULL,
    specialPrice bigint NULL,
    sourceImageUrl text NULL,
    sourceImageStatus varchar(80) NULL,
    sourceImageSource varchar(120) NULL,
    sourceUrl text NULL,
    sourceIsActive tinyint(1) NULL,
    sourceCreatedAt datetime NULL,
    sourceUpdatedAt datetime NULL,
    recoveryStatus varchar(40) NOT NULL,
    nameCompleteness varchar(40) NOT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY historical_product_evidence_unique (evidenceKey),
    KEY historical_product_source_idx (sourceTable, sourceId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS product_image_recovery_audit (
    id bigint NOT NULL AUTO_INCREMENT,
    sourceKey varchar(120) NOT NULL,
    sourceType varchar(40) NOT NULL,
    sourceId varchar(80) NOT NULL,
    productName text NOT NULL,
    publicUrl text NOT NULL,
    officialImageUrl text NULL,
    sourcePageUrl text NULL,
    sourceQuality varchar(80) NULL,
    imageSha256 varchar(64) NOT NULL,
    imageBytes bigint NOT NULL,
    contentType varchar(120) NOT NULL,
    visualReview varchar(80) NOT NULL,
    applyStatus varchar(40) NOT NULL,
    applyNote text NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY product_image_recovery_source_unique (sourceKey),
    KEY product_image_recovery_status_idx (applyStatus)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS account_recovery_inventory (
    id bigint NOT NULL AUTO_INCREMENT,
    accountTable varchar(80) NOT NULL,
    sourceRowCount int NOT NULL,
    sourceEmailCount int NOT NULL,
    sourceActiveCount int NULL,
    preservableHashCount int NOT NULL,
    resetRequiredCount int NOT NULL,
    secretClassification json NOT NULL,
    securityRule text NOT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY account_recovery_inventory_table_unique (accountTable)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS reports_accounts_products_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(160) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    orphanFollowupCount int NOT NULL DEFAULT 0,
    historicalProductCount int NOT NULL DEFAULT 0,
    approvedImageCount int NOT NULL DEFAULT 0,
    accountInventoryCount int NOT NULL DEFAULT 0,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY reports_accounts_products_run_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs").catch(() => [[], []] as any);
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

function toMysqlDateTime(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

async function upsertOrphanFollowup(connection: PoolConnection, row: OrphanFollowup): Promise<void> {
  const legacyId = Number(row.id);
  await connection.execute(
    `INSERT INTO report_recovery_orphan_followups
      (evidenceKey, legacyFollowupId, legacyReportId, legacyReportStaffId, category, extractedItem,
       status, dueDate, resultCategory, resultNote, completedNote, completedAt, sourceCreatedAt,
       sourceUpdatedAt, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE legacyReportId=VALUES(legacyReportId), legacyReportStaffId=VALUES(legacyReportStaffId),
       category=VALUES(category), extractedItem=VALUES(extractedItem), status=VALUES(status), dueDate=VALUES(dueDate),
       resultCategory=VALUES(resultCategory), resultNote=VALUES(resultNote), completedNote=VALUES(completedNote),
       completedAt=VALUES(completedAt), sourceCreatedAt=VALUES(sourceCreatedAt), sourceUpdatedAt=VALUES(sourceUpdatedAt),
       sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      `followup:${legacyId}`, legacyId, Number(row.reportId), row.reportStaffId ? Number(row.reportStaffId) : null,
      row.category || null, row.extractedItem || null, row.status || null, row.dueDate || null,
      row.resultCategory || null, row.resultNote || null, row.completedNote || null,
      toMysqlDateTime(row.completedAt), toMysqlDateTime(row.createdAt), toMysqlDateTime(row.updatedAt), DATASET_SHA256,
    ],
  );
}

async function upsertHistoricalProduct(connection: PoolConnection, row: HistoricalProduct): Promise<void> {
  await connection.execute(
    `INSERT INTO historical_product_catalog
      (evidenceKey, sourceTable, sourceId, displayName, category, description, brandId, regularPrice,
       specialPrice, sourceImageUrl, sourceImageStatus, sourceImageSource, sourceUrl, sourceIsActive,
       sourceCreatedAt, sourceUpdatedAt, recoveryStatus, nameCompleteness, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE displayName=VALUES(displayName), category=VALUES(category), description=VALUES(description),
       brandId=VALUES(brandId), regularPrice=VALUES(regularPrice), specialPrice=VALUES(specialPrice),
       sourceImageUrl=VALUES(sourceImageUrl), sourceImageStatus=VALUES(sourceImageStatus),
       sourceImageSource=VALUES(sourceImageSource), sourceUrl=VALUES(sourceUrl), sourceIsActive=VALUES(sourceIsActive),
       sourceCreatedAt=VALUES(sourceCreatedAt), sourceUpdatedAt=VALUES(sourceUpdatedAt),
       recoveryStatus=VALUES(recoveryStatus), nameCompleteness=VALUES(nameCompleteness),
       sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      `${row.sourceTable}:${row.sourceId}`, row.sourceTable, row.sourceId, row.displayName, row.category || null,
      row.description || null, row.brandId === null || row.brandId === undefined ? null : String(row.brandId),
      row.regularPrice === null || row.regularPrice === undefined ? null : Number(row.regularPrice),
      row.specialPrice === null || row.specialPrice === undefined ? null : Number(row.specialPrice),
      row.imageUrl || null, row.imageStatus || null, row.imageSource || null, row.sourceUrl || null,
      row.isActive === null || row.isActive === undefined ? null : (row.isActive ? 1 : 0),
      toMysqlDateTime(row.createdAt), toMysqlDateTime(row.updatedAt), row.recoveryStatus,
      row.nameCompleteness, DATASET_SHA256,
    ],
  );
}

async function applyImage(connection: PoolConnection, image: ApprovedImage): Promise<{ status: string; note: string }> {
  const [selectionRows] = await connection.query<RowDataPacket[]>(
    "SELECT id, images FROM selection_products WHERE productId = ? AND deletedAt IS NULL LIMIT 1",
    [image.sourceKey],
  );
  const selection = selectionRows[0];
  let status = "missing_selection_product";
  let note = "selection_products sourceKey was not found";
  if (selection) {
    const current = parseImageList(selection.images);
    if (canReplaceRecoveredImage(current)) {
      await connection.execute("UPDATE selection_products SET images = ?, updatedAt = NOW() WHERE id = ?", [jsonText([image.publicUrl]), selection.id]);
      status = "applied";
      note = "replaced missing/legacy image with verified local asset";
    } else {
      status = "preserved_manual_image";
      note = "existing non-legacy image preserved";
    }
  }

  if (image.sourceType === "mall") {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT imageUrl, imageUrls FROM mall_products WHERE id = ? LIMIT 1", [image.sourceId]);
    const row = rows[0];
    if (row) {
      const current = [row.imageUrl ? String(row.imageUrl) : "", ...parseImageList(row.imageUrls)].filter(Boolean);
      if (canReplaceRecoveredImage(current)) {
        await connection.execute("UPDATE mall_products SET imageUrl = ?, imageUrls = ? WHERE id = ?", [image.publicUrl, jsonText([image.publicUrl]), image.sourceId]);
      }
    }
  } else if (image.sourceType === "brand") {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT imageUrls FROM brand_products WHERE id = ? AND deletedAt IS NULL LIMIT 1", [image.sourceId]);
    const row = rows[0];
    if (row && canReplaceRecoveredImage(parseImageList(row.imageUrls))) {
      await connection.execute("UPDATE brand_products SET imageUrls = ?, updatedAt = NOW() WHERE id = ?", [jsonText([image.publicUrl]), image.sourceId]);
    }
  }

  await connection.execute(
    `INSERT INTO product_image_recovery_audit
      (sourceKey, sourceType, sourceId, productName, publicUrl, officialImageUrl, sourcePageUrl,
       sourceQuality, imageSha256, imageBytes, contentType, visualReview, applyStatus, applyNote,
       sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE productName=VALUES(productName), publicUrl=VALUES(publicUrl),
       officialImageUrl=VALUES(officialImageUrl), sourcePageUrl=VALUES(sourcePageUrl),
       sourceQuality=VALUES(sourceQuality), imageSha256=VALUES(imageSha256), imageBytes=VALUES(imageBytes),
       contentType=VALUES(contentType), visualReview=VALUES(visualReview), applyStatus=VALUES(applyStatus),
       applyNote=VALUES(applyNote), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      image.sourceKey, image.sourceType, image.sourceId, image.productName, image.publicUrl,
      image.officialImageUrl || null, image.sourcePageUrl || null, image.sourceQuality || null,
      image.sha256, image.bytes, image.contentType, image.visualReview, status, note, DATASET_SHA256,
    ],
  );
  return { status, note };
}

async function upsertAccountInventory(connection: PoolConnection, row: (typeof evidence.accounts.sourceTableSummary)[number]): Promise<void> {
  await connection.execute(
    `INSERT INTO account_recovery_inventory
      (accountTable, sourceRowCount, sourceEmailCount, sourceActiveCount, preservableHashCount,
       resetRequiredCount, secretClassification, securityRule, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE sourceRowCount=VALUES(sourceRowCount), sourceEmailCount=VALUES(sourceEmailCount),
       sourceActiveCount=VALUES(sourceActiveCount), preservableHashCount=VALUES(preservableHashCount),
       resetRequiredCount=VALUES(resetRequiredCount), secretClassification=VALUES(secretClassification),
       securityRule=VALUES(securityRule), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      row.table, row.rows, row.withEmail, row.activeRows ?? null, row.preservableHashRows,
      row.resetRequiredRows, jsonText(row.secretClassification), evidence.accounts.securityRule, DATASET_SHA256,
    ],
  );
}

async function getState(pool: Pool): Promise<{
  orphanFollowupCount: number;
  historicalProductCount: number;
  approvedImageAuditCount: number;
  validProductImageCount: number;
  accountInventoryCount: number;
  healthy: boolean;
}> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM report_recovery_orphan_followups WHERE sourceDatasetSha256 = ?) AS orphanFollowupCount,
      (SELECT COUNT(*) FROM historical_product_catalog WHERE sourceDatasetSha256 = ?) AS historicalProductCount,
      (SELECT COUNT(*) FROM product_image_recovery_audit WHERE sourceDatasetSha256 = ?) AS approvedImageAuditCount,
      (SELECT COUNT(*) FROM account_recovery_inventory WHERE sourceDatasetSha256 = ?) AS accountInventoryCount
  `, [DATASET_SHA256, DATASET_SHA256, DATASET_SHA256, DATASET_SHA256]);
  const row = rows[0] || {};
  let validProductImageCount = 0;
  for (const image of evidence.products.approvedImages) {
    const [productRows] = await pool.query<RowDataPacket[]>(
      "SELECT images FROM selection_products WHERE productId = ? AND deletedAt IS NULL LIMIT 1",
      [image.sourceKey],
    );
    const urls = parseImageList(productRows[0]?.images);
    if (urls.length > 0 && urls.some((url) => !url.includes(OLD_IMAGE_HOST))) validProductImageCount++;
  }
  const state = {
    orphanFollowupCount: Number(row.orphanFollowupCount || 0),
    historicalProductCount: Number(row.historicalProductCount || 0),
    approvedImageAuditCount: Number(row.approvedImageAuditCount || 0),
    validProductImageCount,
    accountInventoryCount: Number(row.accountInventoryCount || 0),
    healthy: false,
  };
  state.healthy = state.orphanFollowupCount === evidence.reports.orphanFollowupCount
    && state.historicalProductCount === evidence.products.historicalCatalogCount
    && state.approvedImageAuditCount === evidence.products.approvedImageCount
    && state.validProductImageCount === evidence.products.approvedImageCount
    && state.accountInventoryCount === evidence.accounts.sourceTableSummary.length;
  return state;
}

async function getLatestRun(pool: Pool): Promise<Record<string, unknown> | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, recoveryKey, status, startedAt, completedAt, orphanFollowupCount, historicalProductCount, approvedImageCount, accountInventoryCount, details, errorMessage FROM reports_accounts_products_recovery_runs ORDER BY id DESC LIMIT 1",
  );
  return rows[0] || null;
}

export async function getReportsAccountsProductsRecoveryHealth() {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const state = await getState(pool);
    const latestRun = await getLatestRun(pool);
    return {
      ...state,
      datasetSha256: DATASET_SHA256,
      expected: {
        orphanFollowups: evidence.reports.orphanFollowupCount,
        historicalProducts: evidence.products.historicalCatalogCount,
        approvedImages: evidence.products.approvedImageCount,
        accountInventories: evidence.accounts.sourceTableSummary.length,
      },
      latestRun,
    };
  } finally {
    await pool.end();
  }
}

export async function getReportsAccountsProductsOverview() {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const [orphanRows] = await pool.query<RowDataPacket[]>(
      `SELECT legacyFollowupId, legacyReportId, legacyReportStaffId, category, extractedItem, status,
              dueDate, resultCategory, resultNote, completedNote, completedAt, sourceCreatedAt
       FROM report_recovery_orphan_followups WHERE sourceDatasetSha256 = ? ORDER BY legacyFollowupId`,
      [DATASET_SHA256],
    );
    const [historicalRows] = await pool.query<RowDataPacket[]>(
      `SELECT sourceTable, sourceId, displayName, category, regularPrice, specialPrice,
              sourceImageStatus, sourceUrl, recoveryStatus, nameCompleteness
       FROM historical_product_catalog WHERE sourceDatasetSha256 = ? ORDER BY CAST(sourceId AS UNSIGNED), sourceId`,
      [DATASET_SHA256],
    );
    const [accountRows] = await pool.query<RowDataPacket[]>(
      `SELECT accountTable, sourceRowCount, sourceEmailCount, sourceActiveCount,
              preservableHashCount, resetRequiredCount, secretClassification
       FROM account_recovery_inventory WHERE sourceDatasetSha256 = ? ORDER BY accountTable`,
      [DATASET_SHA256],
    );
    const [reportCounts] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM reports) AS totalReports,
        (SELECT COUNT(*) FROM reports WHERE DATE(reportDate) = CURRENT_DATE()) AS todayReports,
        (SELECT COUNT(*) FROM report_staff) AS reportStaffCount,
        (SELECT COUNT(*) FROM report_staff WHERE isActive = 'active') AS activeReportStaffCount
    `).catch(() => [[{ totalReports: 0, todayReports: 0, reportStaffCount: 0, activeReportStaffCount: 0 }], []] as any);
    const [imageRows] = await pool.query<RowDataPacket[]>(
      `SELECT sourceKey, productName, publicUrl, sourceQuality, applyStatus
       FROM product_image_recovery_audit WHERE sourceDatasetSha256 = ? ORDER BY sourceKey`,
      [DATASET_SHA256],
    );
    const [currentAccountRows] = await pool.query<RowDataPacket[]>(`
      SELECT 'users' AS accountTable, COUNT(*) AS currentRows,
             SUM(CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END) AS currentHashCount,
             SUM(CASE WHEN password IS NULL OR password = '' THEN 1 ELSE 0 END) AS resetRequiredCount,
             0 AS alternateLoginCount FROM users
      UNION ALL
      SELECT 'livers', COUNT(*),
             SUM(CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END),
             SUM(CASE WHEN password IS NULL OR password = '' THEN 1 ELSE 0 END), 0 FROM livers
      UNION ALL
      SELECT 'line_users', COUNT(*),
             SUM(CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END),
             SUM(CASE WHEN email IS NOT NULL AND email <> '' AND (password IS NULL OR password = '') THEN 1 ELSE 0 END),
             SUM(CASE WHEN lineUserId IS NOT NULL AND lineUserId <> '' AND (password IS NULL OR password = '') THEN 1 ELSE 0 END) FROM line_users
      UNION ALL
      SELECT 'festival_accounts', COUNT(*),
             SUM(CASE WHEN passwordHash IS NOT NULL AND passwordHash <> '' THEN 1 ELSE 0 END),
             SUM(CASE WHEN passwordHash IS NULL OR passwordHash = '' THEN 1 ELSE 0 END), 0 FROM festival_accounts
      UNION ALL
      SELECT 'staff', COUNT(*), 0, 0, 0 FROM staff
      UNION ALL
      SELECT 'report_staff', COUNT(*), 0, 0, 0 FROM report_staff
    `);
    return {
      reportSummary: {
        totalReports: Number(reportCounts[0]?.totalReports || 0),
        todayReports: Number(reportCounts[0]?.todayReports || 0),
        reportStaffCount: Number(reportCounts[0]?.reportStaffCount || 0),
        activeReportStaffCount: Number(reportCounts[0]?.activeReportStaffCount || 0),
        recoverableReportBodies: evidence.reports.reportRowsRecoverable,
      },
      orphanFollowups: orphanRows,
      accountInventory: accountRows.map((row) => ({ ...row, secretClassification: typeof row.secretClassification === "string" ? JSON.parse(row.secretClassification) : row.secretClassification })),
      currentAccountState: currentAccountRows.map((row) => ({
        accountTable: String(row.accountTable),
        currentRows: Number(row.currentRows || 0),
        currentHashCount: Number(row.currentHashCount || 0),
        resetRequiredCount: Number(row.resetRequiredCount || 0),
        alternateLoginCount: Number(row.alternateLoginCount || 0),
      })),
      historicalProducts: historicalRows,
      productImages: imageRows,
      resetLinks: {
        admin: "/forgot-password-admin",
        liver: "/liver/forgot-password",
        line: "/forgot-password",
        festival: "/lcf/login",
      },
      securityRule: evidence.accounts.securityRule,
      productFallbackRule: evidence.products.fallbackRule,
    };
  } finally {
    await pool.end();
  }
}

export async function runReportsAccountsProductsRecovery(): Promise<{ skipped: boolean; healthy: boolean; details: Record<string, unknown> }> {
  const pool = createPool();
  let runId = 0;
  try {
    await ensureTables(pool);
    const beforeState = await getState(pool);
    if (beforeState.healthy) return { skipped: true, healthy: true, details: beforeState };

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const [runResult] = await pool.execute<any>(
      `INSERT INTO reports_accounts_products_recovery_runs (recoveryKey, status, details)
       VALUES (?, 'running', ?)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL,
         errorMessage=NULL, details=VALUES(details), id=LAST_INSERT_ID(id)`,
      [RECOVERY_KEY, jsonText({ datasetSha256: DATASET_SHA256, preBackupId, beforeState })],
    );
    runId = Number(runResult.insertId || 0);

    const connection = await pool.getConnection();
    const imageStatusCounts: Record<string, number> = {};
    try {
      await connection.beginTransaction();
      for (const row of evidence.reports.orphanFollowups) await upsertOrphanFollowup(connection, row);
      for (const row of evidence.products.historicalCatalog) await upsertHistoricalProduct(connection, row);
      for (const row of evidence.accounts.sourceTableSummary) await upsertAccountInventory(connection, row);
      for (const image of evidence.products.approvedImages) {
        const result = await applyImage(connection, image);
        imageStatusCounts[result.status] = (imageStatusCounts[result.status] || 0) + 1;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const afterState = await getState(pool);
    if (!afterState.healthy) throw new Error(`post-recovery validation failed: ${jsonText(afterState)}`);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = { datasetSha256: DATASET_SHA256, preBackupId, postBackupId, imageStatusCounts, beforeState, afterState };
    await pool.execute(
      `UPDATE reports_accounts_products_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
         orphanFollowupCount=?, historicalProductCount=?, approvedImageCount=?, accountInventoryCount=?,
         details=?, errorMessage=NULL WHERE id=?`,
      [afterState.orphanFollowupCount, afterState.historicalProductCount, afterState.approvedImageAuditCount, afterState.accountInventoryCount, jsonText(details), runId],
    );
    return { skipped: false, healthy: true, details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await pool.execute(
        "UPDATE reports_accounts_products_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE id=?",
        [message, runId],
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}
