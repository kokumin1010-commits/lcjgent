import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import evidence from "./selectionProductDeepRecoveryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = evidence.recoveryKey;
const DATASET_SHA256 = evidence.evidenceSha256;
const PRE_BACKUP_REASON = "pre-selection-product-v2";
const POST_BACKUP_REASON = "post-selection-product-v2";

type MainProduct = (typeof evidence.mainProducts)[number];
type HistoricalProduct = (typeof evidence.historicalCatalogAdditions)[number];
type SourceAlias = (typeof evidence.sourceAliases)[number];

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function mysqlDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute("ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute(`CREATE TABLE IF NOT EXISTS selection_product_deep_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    selectionProductCount int NOT NULL DEFAULT 0,
    historicalCatalogCount int NOT NULL DEFAULT 0,
    brandProductCount int NOT NULL DEFAULT 0,
    verifiedImageCount int NOT NULL DEFAULT 0,
    details json DEFAULT NULL,
    errorMessage text DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY selection_product_deep_recovery_key_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS selection_product_source_evidence (
    id bigint NOT NULL AUTO_INCREMENT,
    sourceKey varchar(120) NOT NULL,
    sourceClass varchar(80) NOT NULL,
    sourceTable varchar(80) NOT NULL,
    sourceId varchar(100) NOT NULL,
    productName varchar(500) NOT NULL,
    originalBrandId int NULL,
    mappedBrandId int NULL,
    mappedBrandName varchar(255) NULL,
    initialStatus varchar(20) NOT NULL,
    evidenceSha256 varchar(64) NOT NULL,
    details json NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY selection_product_source_evidence_key_unique (sourceKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS selection_product_alias_evidence (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(160) NOT NULL,
    sourceTable varchar(80) NOT NULL,
    sourceId varchar(100) NOT NULL,
    productName varchar(500) NOT NULL,
    action varchar(80) NOT NULL,
    duplicateOfSourceKey varchar(120) NULL,
    originalBrandId int NULL,
    mappedBrandId int NULL,
    mappedBrandName varchar(255) NULL,
    historicalGmv bigint NULL,
    historicalSold bigint NULL,
    evidenceSha256 varchar(64) NOT NULL,
    details json NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY selection_product_alias_evidence_key_unique (evidenceKey)
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
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const before = await latestBackupId(pool).catch(() => 0);
    await runDatabaseBackup(reason, { force: true, waitForActive: true });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
      [before, reason],
    );
    const row = rows[0];
    if (row?.status === "success") return Number(row.id);
    if (row?.status === "failed") throw new Error(`database backup failed reason=${reason}: ${String(row.errorMessage || "unknown")}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`database backup did not complete reason=${reason}`);
}

function mainBySourceKey(): Map<string, MainProduct> {
  return new Map(evidence.mainProducts.map((row) => [row.sourceKey, row]));
}

function historicalEvidenceKey(row: HistoricalProduct): string {
  return `${row.sourceTable}:${row.sourceId}`;
}

function aliasEvidenceKey(row: SourceAlias): string {
  return `${row.sourceTable}:${row.sourceId}`;
}

function brandSourceRows(): Array<{
  sourceId: string;
  productName: string;
  brandId: number | null;
  brandName: string | null;
  oldBrandId: number | null;
  sourceClass: string;
}> {
  const rows = evidence.mainProducts
    .filter((row) => row.sourceClass === "historical_brand_product")
    .map((row) => ({
      sourceId: row.sourceId,
      productName: row.productName,
      brandId: row.brandId ?? null,
      brandName: row.brandName ?? null,
      oldBrandId: row.oldBrandId ?? null,
      sourceClass: row.sourceClass,
    }));
  for (const alias of evidence.sourceAliases) {
    if (alias.sourceTable !== "brand_products") continue;
    rows.push({
      sourceId: alias.sourceId,
      productName: alias.productName,
      brandId: alias.brandId ?? null,
      brandName: alias.brandName ?? null,
      oldBrandId: alias.oldBrandId ?? null,
      sourceClass: "historical_brand_product_alias",
    });
  }
  return rows;
}

async function verifyBrandMappings(connection: PoolConnection): Promise<void> {
  const expected = new Map<number, string>();
  for (const row of brandSourceRows()) {
    if (row.brandId && row.brandName) expected.set(row.brandId, row.brandName);
  }
  if (!expected.size) return;
  const ids = [...expected.keys()];
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, name FROM brands WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  const found = new Set(rows.map((row) => Number(row.id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`mapped brands missing ids=${missing.join(",")}`);
}

async function upsertBrandProductSourceRows(connection: PoolConnection): Promise<number> {
  let inserted = 0;
  for (const row of brandSourceRows()) {
    const id = Number(row.sourceId);
    const [existingRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, brandId, productName, deletedAt FROM brand_products WHERE id = ? LIMIT 1",
      [id],
    );
    const existing = existingRows[0];
    if (existing) {
      if (String(existing.productName) !== row.productName) {
        throw new Error(`brand_products id conflict id=${id} existing=${String(existing.productName).slice(0, 120)} evidence=${row.productName.slice(0, 120)}`);
      }
      continue;
    }
    await connection.execute(
      `INSERT INTO brand_products
        (id, brandId, productName, remarks, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`,
      [
        id,
        row.brandId,
        row.productName,
        `保存済みDB操作履歴から復元 (${RECOVERY_KEY}); originalBrandId=${row.oldBrandId ?? "unknown"}; mappedBrand=${row.brandName ?? "unknown"}`,
      ],
    );
    inserted += 1;
  }
  return inserted;
}

async function upsertSelectionProduct(connection: PoolConnection, row: MainProduct): Promise<{ id: number; inserted: boolean }> {
  const [allRows] = await connection.query<RowDataPacket[]>(
    "SELECT id, productName, deletedAt FROM selection_products WHERE productId = ? ORDER BY id LIMIT 2",
    [row.sourceKey],
  );
  if (allRows.length > 1) throw new Error(`duplicate selection productId=${row.sourceKey}`);
  if (allRows[0]) {
    if (String(allRows[0].productName) !== row.productName) {
      throw new Error(`selection productId conflict key=${row.sourceKey}`);
    }
    const id = Number(allRows[0].id);
    await connection.execute(
      `UPDATE selection_products SET
         deletedAt = NULL,
         images = CASE
           WHEN (? IS NOT NULL) AND (images IS NULL OR images = '' OR images = '[]') THEN ?
           ELSE images
         END,
         productLink = CASE
           WHEN productLink IS NULL OR productLink = '' THEN ?
           ELSE productLink
         END
       WHERE id = ?`,
      [row.imageEvidence ? 1 : null, jsonText(row.images || []), row.productLink || null, id],
    );
    return { id, inserted: false };
  }
  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO selection_products
      (productName, brandName, brandId, categoryId, price, marketPrice, costPrice,
       commissionType, commissionValue, stock, images, productLink, sellingPoints,
       description, status, createdBy, productId, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 'percentage', 0, 0, ?, ?, NULL, ?, 'offline', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`,
    [
      row.productName,
      row.brandName,
      row.brandId ?? null,
      jsonText(row.images || []),
      row.productLink || null,
      row.description,
      row.sourceKey,
    ],
  );
  return { id: Number(result.insertId), inserted: true };
}

async function upsertSourceEvidence(connection: PoolConnection, row: MainProduct, selectionProductId: number): Promise<void> {
  await connection.execute(
    `INSERT INTO selection_product_source_evidence
      (sourceKey, sourceClass, sourceTable, sourceId, productName, originalBrandId,
       mappedBrandId, mappedBrandName, initialStatus, evidenceSha256, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?)
     ON DUPLICATE KEY UPDATE sourceClass=VALUES(sourceClass), sourceTable=VALUES(sourceTable),
       sourceId=VALUES(sourceId), productName=VALUES(productName), originalBrandId=VALUES(originalBrandId),
       mappedBrandId=VALUES(mappedBrandId), mappedBrandName=VALUES(mappedBrandName),
       evidenceSha256=VALUES(evidenceSha256), details=VALUES(details)`,
    [
      row.sourceKey,
      row.sourceClass,
      row.sourceTable,
      row.sourceId,
      row.productName,
      row.oldBrandId ?? null,
      row.brandId ?? null,
      row.brandName ?? null,
      DATASET_SHA256,
      jsonText({
        selectionProductId,
        brandMappingEvidence: row.brandMappingEvidence,
        historicalMetrics: row.historicalMetrics || null,
        imageEvidence: row.imageEvidence || null,
        evidenceFiles: row.evidenceFiles,
        evidenceQueryFiles: row.evidenceQueryFiles,
        noInferredPriceStockCommission: true,
      }),
    ],
  );
}

async function upsertHistoricalCatalog(connection: PoolConnection, row: HistoricalProduct): Promise<void> {
  await connection.execute(
    `INSERT INTO historical_product_catalog
      (evidenceKey, sourceTable, sourceId, displayName, category, description, brandId,
       regularPrice, specialPrice, sourceImageUrl, sourceImageStatus, sourceImageSource,
       sourceUrl, sourceIsActive, sourceCreatedAt, sourceUpdatedAt, recoveryStatus,
       nameCompleteness, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE displayName=VALUES(displayName), category=VALUES(category),
       description=VALUES(description), brandId=VALUES(brandId), regularPrice=VALUES(regularPrice),
       specialPrice=VALUES(specialPrice), sourceImageUrl=VALUES(sourceImageUrl),
       sourceImageStatus=VALUES(sourceImageStatus), sourceImageSource=VALUES(sourceImageSource),
       sourceUrl=VALUES(sourceUrl), sourceIsActive=VALUES(sourceIsActive),
       sourceCreatedAt=VALUES(sourceCreatedAt), sourceUpdatedAt=VALUES(sourceUpdatedAt),
       recoveryStatus=VALUES(recoveryStatus), nameCompleteness=VALUES(nameCompleteness),
       sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      historicalEvidenceKey(row),
      row.sourceTable,
      row.sourceId,
      row.displayName,
      row.category || null,
      row.description || null,
      row.brandId || null,
      row.regularPrice ?? null,
      row.specialPrice ?? null,
      row.imageUrl || null,
      row.imageStatus || null,
      row.imageSource || null,
      row.sourceUrl || null,
      row.isActive === null || row.isActive === undefined ? null : Number(row.isActive),
      mysqlDateTime(row.createdAt),
      mysqlDateTime(row.updatedAt),
      row.recoveryStatus,
      row.nameCompleteness,
      DATASET_SHA256,
    ],
  );
}

async function upsertAliasEvidence(connection: PoolConnection, row: SourceAlias): Promise<void> {
  await connection.execute(
    `INSERT INTO selection_product_alias_evidence
      (evidenceKey, sourceTable, sourceId, productName, action, duplicateOfSourceKey,
       originalBrandId, mappedBrandId, mappedBrandName, historicalGmv, historicalSold,
       evidenceSha256, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE productName=VALUES(productName), action=VALUES(action),
       duplicateOfSourceKey=VALUES(duplicateOfSourceKey), originalBrandId=VALUES(originalBrandId),
       mappedBrandId=VALUES(mappedBrandId), mappedBrandName=VALUES(mappedBrandName),
       historicalGmv=VALUES(historicalGmv), historicalSold=VALUES(historicalSold),
       evidenceSha256=VALUES(evidenceSha256), details=VALUES(details)`,
    [
      aliasEvidenceKey(row),
      row.sourceTable,
      row.sourceId,
      row.productName,
      row.action,
      row.duplicateOfSourceKey || null,
      row.oldBrandId ?? null,
      row.brandId ?? null,
      row.brandName ?? null,
      row.totalGmv ?? null,
      row.totalSold ?? null,
      DATASET_SHA256,
      jsonText(row),
    ],
  );
}

async function upsertImageAudit(connection: PoolConnection, row: MainProduct): Promise<void> {
  const image = row.imageEvidence;
  if (!image || !row.images?.[0]) return;
  await connection.execute(
    `INSERT INTO product_image_recovery_audit
      (sourceKey, sourceType, sourceId, productName, publicUrl, officialImageUrl,
       sourcePageUrl, sourceQuality, imageSha256, imageBytes, contentType, visualReview,
       applyStatus, applyNote, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved_exact_product',
       'applied_selection_products_v2', ?, ?)
     ON DUPLICATE KEY UPDATE productName=VALUES(productName), publicUrl=VALUES(publicUrl),
       officialImageUrl=VALUES(officialImageUrl), sourcePageUrl=VALUES(sourcePageUrl),
       sourceQuality=VALUES(sourceQuality), imageSha256=VALUES(imageSha256),
       imageBytes=VALUES(imageBytes), contentType=VALUES(contentType),
       visualReview=VALUES(visualReview), applyStatus=VALUES(applyStatus),
       applyNote=VALUES(applyNote), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    [
      row.sourceKey,
      row.sourceClass,
      row.sourceId,
      row.productName,
      row.images[0],
      image.selectedImageUrl || null,
      image.officialProductUrl || null,
      image.sourceQuality || null,
      image.sha256,
      image.bytes,
      image.assetFile?.endsWith(".webp") ? "image/webp" : "image/jpeg",
      `第二輪商品深掘り。HTTP/画像形式/寸法検証と目視確認済み (${image.width}x${image.height})`,
      DATASET_SHA256,
    ],
  );
}

async function getEvidenceState(pool: Pool): Promise<{
  selectionProductTotal: number;
  evidenceSelectionProductCount: number;
  visibleEvidenceSelectionProductCount: number;
  mismatchedSelectionProductCount: number;
  historicalCatalogTotal: number;
  evidenceHistoricalCatalogCount: number;
  mismatchedHistoricalCatalogCount: number;
  brandProductTotal: number;
  evidenceBrandProductCount: number;
  mismatchedBrandProductCount: number;
  sourceEvidenceCount: number;
  aliasEvidenceCount: number;
  verifiedImageAuditCount: number;
  healthy: boolean;
}> {
  const sourceKeys = evidence.mainProducts.map((row) => row.sourceKey);
  const historicalKeys = evidence.historicalCatalogAdditions.map(historicalEvidenceKey);
  const brandRows = brandSourceRows();
  const brandIds = brandRows.map((row) => Number(row.sourceId));
  const [countRows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM selection_products) AS selectionProductAllRows,
      (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL) AS selectionProductTotal,
      (SELECT COUNT(*) FROM historical_product_catalog) AS historicalCatalogTotal,
      (SELECT COUNT(*) FROM brand_products WHERE deletedAt IS NULL) AS brandProductTotal,
      (SELECT COUNT(*) FROM selection_product_source_evidence WHERE evidenceSha256 = ?) AS sourceEvidenceCount,
      (SELECT COUNT(*) FROM selection_product_alias_evidence WHERE evidenceSha256 = ?) AS aliasEvidenceCount,
      (SELECT COUNT(*) FROM product_image_recovery_audit WHERE sourceDatasetSha256 = ? AND applyStatus = 'applied_selection_products_v2') AS verifiedImageAuditCount
  `, [DATASET_SHA256, DATASET_SHA256, DATASET_SHA256]);

  const [selectionRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, productId, productName, brandId, brandName, status, price, marketPrice, costPrice,
            commissionValue, stock, images, deletedAt
     FROM selection_products WHERE productId IN (${sourceKeys.map(() => "?").join(",")})`,
    sourceKeys,
  );
  const expectedMain = mainBySourceKey();
  let mismatchedSelectionProductCount = 0;
  const seenSelection = new Set<string>();
  for (const row of selectionRows) {
    const key = String(row.productId || "");
    const expected = expectedMain.get(key);
    if (!expected || seenSelection.has(key)) {
      mismatchedSelectionProductCount += 1;
      continue;
    }
    seenSelection.add(key);
    if (String(row.productName) !== expected.productName) mismatchedSelectionProductCount += 1;
    if (expected.imageEvidence) {
      const images = parseJsonArray(row.images);
      if (images.length === 0) mismatchedSelectionProductCount += 1;
    }
  }

  const [historicalRows] = await pool.query<RowDataPacket[]>(
    `SELECT evidenceKey, displayName, recoveryStatus, nameCompleteness
     FROM historical_product_catalog WHERE evidenceKey IN (${historicalKeys.map(() => "?").join(",")})`,
    historicalKeys,
  );
  const expectedHistorical = new Map(evidence.historicalCatalogAdditions.map((row) => [historicalEvidenceKey(row), row]));
  let mismatchedHistoricalCatalogCount = 0;
  const seenHistorical = new Set<string>();
  for (const row of historicalRows) {
    const key = String(row.evidenceKey || "");
    const expected = expectedHistorical.get(key);
    if (!expected || seenHistorical.has(key)) {
      mismatchedHistoricalCatalogCount += 1;
      continue;
    }
    seenHistorical.add(key);
    if (String(row.displayName) !== expected.displayName || String(row.recoveryStatus) !== expected.recoveryStatus) {
      mismatchedHistoricalCatalogCount += 1;
    }
  }

  const [brandProductRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, brandId, productName FROM brand_products WHERE id IN (${brandIds.map(() => "?").join(",")})`,
    brandIds,
  );
  const expectedBrand = new Map(brandRows.map((row) => [Number(row.sourceId), row]));
  let mismatchedBrandProductCount = 0;
  const seenBrand = new Set<number>();
  for (const row of brandProductRows) {
    const id = Number(row.id);
    const expected = expectedBrand.get(id);
    if (!expected || seenBrand.has(id)) {
      mismatchedBrandProductCount += 1;
      continue;
    }
    seenBrand.add(id);
    if (String(row.productName) !== expected.productName || Number(row.brandId) !== Number(expected.brandId)) {
      mismatchedBrandProductCount += 1;
    }
  }

  const counts = (countRows[0] || {}) as RowDataPacket;
  const state = {
    selectionProductTotal: Number(counts.selectionProductTotal || 0),
    evidenceSelectionProductCount: seenSelection.size,
    visibleEvidenceSelectionProductCount: selectionRows.filter((row) => !row.deletedAt).length,
    mismatchedSelectionProductCount,
    historicalCatalogTotal: Number(counts.historicalCatalogTotal || 0),
    evidenceHistoricalCatalogCount: seenHistorical.size,
    mismatchedHistoricalCatalogCount,
    brandProductTotal: Number(counts.brandProductTotal || 0),
    evidenceBrandProductCount: seenBrand.size,
    mismatchedBrandProductCount,
    sourceEvidenceCount: Number(counts.sourceEvidenceCount || 0),
    aliasEvidenceCount: Number(counts.aliasEvidenceCount || 0),
    verifiedImageAuditCount: Number(counts.verifiedImageAuditCount || 0),
    healthy: false,
  };
  state.healthy = state.selectionProductTotal >= evidence.expected.selectionProductsAfter
    && state.evidenceSelectionProductCount === evidence.expected.mainProductsToInsert
    && state.visibleEvidenceSelectionProductCount === evidence.expected.mainProductsToInsert
    && state.mismatchedSelectionProductCount === 0
    && state.historicalCatalogTotal >= evidence.expected.historicalCatalogAfter
    && state.evidenceHistoricalCatalogCount === evidence.expected.historicalCatalogAdditions
    && state.mismatchedHistoricalCatalogCount === 0
    && state.brandProductTotal >= evidence.expected.brandProductsAfter
    && state.evidenceBrandProductCount === evidence.expected.brandProductSourceRowsToRestore
    && state.mismatchedBrandProductCount === 0
    && state.sourceEvidenceCount === evidence.expected.mainProductsToInsert
    && state.aliasEvidenceCount === evidence.expected.archiveAliasCount
    && state.verifiedImageAuditCount === evidence.expected.verifiedImageCount;
  return state;
}

export async function getSelectionProductDeepRecoveryHealth(): Promise<Awaited<ReturnType<typeof getEvidenceState>> & {
  recoveryKey: string;
  evidenceSha256: string;
  expected: typeof evidence.expected;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null; details: unknown } | null;
  backups: Array<{ id: number; reason: string; status: string; tableCount: number | null; rowCount: number | null; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureTables(pool);
    const state = await getEvidenceState(pool);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, completedAt, errorMessage, details FROM selection_product_deep_recovery_runs WHERE recoveryKey = ? LIMIT 1`,
      [RECOVERY_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, tableCount, rowCount, completedAt, errorMessage
       FROM db_backup_runs WHERE reason IN (?, ?) ORDER BY id DESC LIMIT 4`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      ...state,
      recoveryKey: RECOVERY_KEY,
      evidenceSha256: DATASET_SHA256,
      expected: evidence.expected,
      recoveryRun: run ? {
        status: String(run.status || "unknown"),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        errorMessage: run.errorMessage ? String(run.errorMessage).slice(0, 1000) : null,
        details: typeof run.details === "string" ? JSON.parse(run.details) : run.details,
      } : null,
      backups: backupRows.map((row) => ({
        id: Number(row.id),
        reason: String(row.reason || ""),
        status: String(row.status || "unknown"),
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

export async function runSelectionProductDeepRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for selection product deep recovery");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureTables(pool);
    const before = await getEvidenceState(pool);
    if (before.healthy) {
      console.log(`[SelectionProductDeepRecovery] healthy ${JSON.stringify(before)}`);
      return;
    }

    await pool.execute(
      `INSERT INTO selection_product_deep_recovery_runs
        (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [RECOVERY_KEY, jsonText({ before, expected: evidence.expected, evidenceSha256: DATASET_SHA256 })],
    );

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    let insertedBrandProducts = 0;
    let insertedSelectionProducts = 0;
    try {
      await connection.beginTransaction();
      await verifyBrandMappings(connection);
      insertedBrandProducts = await upsertBrandProductSourceRows(connection);
      for (const row of evidence.mainProducts) {
        const saved = await upsertSelectionProduct(connection, row);
        if (saved.inserted) insertedSelectionProducts += 1;
        await upsertSourceEvidence(connection, row, saved.id);
        await upsertImageAudit(connection, row);
      }
      for (const row of evidence.historicalCatalogAdditions) await upsertHistoricalCatalog(connection, row);
      for (const row of evidence.sourceAliases) await upsertAliasEvidence(connection, row);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const after = await getEvidenceState(pool);
    if (!after.healthy) {
      throw new Error(`selection product deep recovery verification failed: ${JSON.stringify(after)}`);
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      before,
      after,
      expected: evidence.expected,
      evidenceSha256: DATASET_SHA256,
      insertedBrandProducts,
      insertedSelectionProducts,
      preBackupId,
      postBackupId,
      oldTiDBUsed: false,
    };
    await pool.execute(
      `UPDATE selection_product_deep_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
       selectionProductCount=?, historicalCatalogCount=?, brandProductCount=?, verifiedImageCount=?,
       details=?, errorMessage=NULL WHERE recoveryKey=?`,
      [
        after.selectionProductTotal,
        after.historicalCatalogTotal,
        after.brandProductTotal,
        after.verifiedImageAuditCount,
        jsonText(details),
        RECOVERY_KEY,
      ],
    );
    console.log(`[SelectionProductDeepRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE selection_product_deep_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[SelectionProductDeepRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
