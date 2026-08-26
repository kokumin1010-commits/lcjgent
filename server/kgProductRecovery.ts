import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import evidence from "./kgProductRecoveryEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = evidence.recoveryKey;
const DATASET_SHA256 = evidence.evidenceSha256;
const PRE_BACKUP_REASON = "pre-kg-product-v3";
const POST_BACKUP_REASON = "post-kg-product-v3";
const PRICE_HISTORY_SOURCE = "kg_product_v3_saved_livestream";
const IMAGE_APPLY_STATUS = "applied_kg_product_v3";

type MainProduct = (typeof evidence.mainProducts)[number];
type ChildSku = (typeof evidence.childSkus)[number];
type HistoricalProduct = (typeof evidence.historicalCatalogAdditions)[number];
type EvidenceProduct = MainProduct | ChildSku;

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function sqlParams(values: unknown[]): any[] {
  return values.map((value) => value === undefined ? null : value);
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

function mysqlDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isChild(row: EvidenceProduct): row is ChildSku {
  return "parentSourceKey" in row;
}

function historicalEvidenceKey(row: HistoricalProduct): string {
  return `kg-v3:${row.sourceKey}`;
}

async function ensureTables(pool: Pool): Promise<void> {
  const alters = [
    "ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE selection_products ADD COLUMN parentProductId INT DEFAULT NULL",
    "ALTER TABLE selection_products ADD COLUMN skuName VARCHAR(200) DEFAULT NULL",
    "ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(10,2) DEFAULT NULL",
    "ALTER TABLE selection_products ADD COLUMN barcode VARCHAR(100) DEFAULT NULL",
  ];
  for (const sql of alters) {
    await pool.execute(sql).catch((error: any) => {
      if (error?.code !== "ER_DUP_FIELDNAME") throw error;
    });
  }

  await pool.execute(`CREATE TABLE IF NOT EXISTS kg_product_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    parentProductCount int NOT NULL DEFAULT 0,
    childSkuCount int NOT NULL DEFAULT 0,
    historicalCatalogCount int NOT NULL DEFAULT 0,
    verifiedImageCount int NOT NULL DEFAULT 0,
    details json DEFAULT NULL,
    errorMessage text DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY kg_product_recovery_key_unique (recoveryKey)
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

  await pool.execute(`CREATE TABLE IF NOT EXISTS selection_price_history (
    id int NOT NULL AUTO_INCREMENT,
    productId int NOT NULL,
    price decimal(12,2) NOT NULL,
    source varchar(100) NULL,
    note text NULL,
    createdBy int NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY selection_price_history_product_idx (productId)
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
    if (row?.status === "failed") {
      throw new Error(`database backup failed reason=${reason}: ${String(row.errorMessage || "unknown")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`database backup did not complete reason=${reason}`);
}

async function findProductBySourceKey(connection: PoolConnection, sourceKey: string): Promise<RowDataPacket | null> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT id, productId, productName, brandId, parentProductId, deletedAt, images, barcode, skuName, historicalLowestPrice FROM selection_products WHERE productId = ? ORDER BY id LIMIT 2",
    [sourceKey],
  );
  if (rows.length > 1) throw new Error(`duplicate selection product sourceKey=${sourceKey}`);
  return rows[0] || null;
}

async function upsertMainProduct(connection: PoolConnection, row: MainProduct): Promise<{ id: number; inserted: boolean }> {
  const existing = await findProductBySourceKey(connection, row.sourceKey);
  if (existing) {
    if (String(existing.productName) !== row.productName || Number(existing.brandId) !== Number(row.brandId)) {
      throw new Error(`KG parent identity conflict sourceKey=${row.sourceKey}`);
    }
    await connection.execute(
      `UPDATE selection_products SET
         deletedAt = NULL,
         parentProductId = NULL,
         images = CASE WHEN images IS NULL OR images = '' OR images = '[]' THEN ? ELSE images END,
         productLink = CASE WHEN productLink IS NULL OR productLink = '' THEN ? ELSE productLink END,
         barcode = CASE WHEN barcode IS NULL OR barcode = '' THEN ? ELSE barcode END
       WHERE id = ?`,
      sqlParams([jsonText(row.images || []), row.officialUrl || null, row.barcode || null, Number(existing.id)]),
    );
    return { id: Number(existing.id), inserted: false };
  }

  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO selection_products
      (productName, brandName, brandId, price, marketPrice, costPrice, commissionType,
       commissionValue, stock, images, productLink, description, status, createdBy,
       productId, barcode, parentProductId, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, NULL, NULL, NULL, 'percentage', 0, 0, ?, ?, ?, 'offline', 1,
       ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`,
    sqlParams([
      row.productName,
      row.brandName,
      row.brandId,
      jsonText(row.images || []),
      row.officialUrl || null,
      row.description,
      row.sourceKey,
      row.barcode || null,
    ]),
  );
  return { id: Number(result.insertId), inserted: true };
}

async function resolveParentId(connection: PoolConnection, parentSourceKey: string): Promise<number> {
  const parent = await findProductBySourceKey(connection, parentSourceKey);
  if (!parent || parent.deletedAt) throw new Error(`KG child parent missing sourceKey=${parentSourceKey}`);
  if (parent.parentProductId) throw new Error(`KG child parent is itself a child sourceKey=${parentSourceKey}`);
  return Number(parent.id);
}

async function upsertChildSku(connection: PoolConnection, row: ChildSku): Promise<{ id: number; inserted: boolean }> {
  const parentId = await resolveParentId(connection, row.parentSourceKey);
  const existing = await findProductBySourceKey(connection, row.sourceKey);
  if (existing) {
    if (String(existing.productName) !== row.productName || Number(existing.brandId) !== Number(row.brandId)) {
      throw new Error(`KG child identity conflict sourceKey=${row.sourceKey}`);
    }
    await connection.execute(
      `UPDATE selection_products SET
         deletedAt = NULL,
         parentProductId = ?,
         skuName = CASE WHEN skuName IS NULL OR skuName = '' THEN ? ELSE skuName END,
         historicalLowestPrice = CASE
           WHEN historicalLowestPrice IS NULL AND ? IS NOT NULL THEN ?
           ELSE historicalLowestPrice
         END,
         images = CASE WHEN images IS NULL OR images = '' OR images = '[]' THEN ? ELSE images END,
         productLink = CASE WHEN productLink IS NULL OR productLink = '' THEN ? ELSE productLink END,
         barcode = CASE WHEN barcode IS NULL OR barcode = '' THEN ? ELSE barcode END
       WHERE id = ?`,
      sqlParams([
        parentId,
        row.sku,
        row.historicalLowestPrice ?? null,
        row.historicalLowestPrice ?? null,
        jsonText(row.images || []),
        row.officialUrl || null,
        row.barcode || null,
        Number(existing.id),
      ]),
    );
    return { id: Number(existing.id), inserted: false };
  }

  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO selection_products
      (productName, brandName, brandId, price, marketPrice, costPrice, commissionType,
       commissionValue, stock, images, productLink, description, status, createdBy,
       productId, barcode, parentProductId, skuName, historicalLowestPrice,
       createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, NULL, NULL, NULL, 'percentage', 0, 0, ?, ?, ?, 'offline', 1,
       ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)`,
    sqlParams([
      row.productName,
      row.brandName,
      row.brandId,
      jsonText(row.images || []),
      row.officialUrl || null,
      row.description,
      row.sourceKey,
      row.barcode || null,
      parentId,
      row.sku,
      row.historicalLowestPrice ?? null,
    ]),
  );
  return { id: Number(result.insertId), inserted: true };
}

async function upsertSourceEvidence(
  connection: PoolConnection,
  row: EvidenceProduct,
  selectionProductId: number,
): Promise<void> {
  const sourceTable = isChild(row) ? "kg_child_sku" : row.sourceTable;
  const sourceId = isChild(row) ? row.sourceKey : row.sourceId;
  await connection.execute(
    `INSERT INTO selection_product_source_evidence
      (sourceKey, sourceClass, sourceTable, sourceId, productName, originalBrandId,
       mappedBrandId, mappedBrandName, initialStatus, evidenceSha256, details)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'offline', ?, ?)
     ON DUPLICATE KEY UPDATE sourceClass=VALUES(sourceClass), sourceTable=VALUES(sourceTable),
       sourceId=VALUES(sourceId), productName=VALUES(productName), mappedBrandId=VALUES(mappedBrandId),
       mappedBrandName=VALUES(mappedBrandName), evidenceSha256=VALUES(evidenceSha256), details=VALUES(details)`,
    sqlParams([
      row.sourceKey,
      row.sourceClass,
      sourceTable,
      sourceId,
      row.productName,
      row.brandId,
      row.brandName,
      DATASET_SHA256,
      jsonText({
        selectionProductId,
        evidence: row,
        noInferredCurrentPriceStockCommission: true,
        oldTiDBUsed: false,
      }),
    ]),
  );
}

async function upsertPriceHistory(connection: PoolConnection, row: ChildSku, productId: number): Promise<void> {
  const value = row.historicalLowestPrice;
  if (value === null || value === undefined || Number(value) <= 0) return;
  await connection.execute(
    `INSERT INTO selection_price_history (productId, price, source, note, createdBy, createdAt)
     SELECT ?, ?, ?, ?, 1, CURRENT_TIMESTAMP
     WHERE NOT EXISTS (
       SELECT 1 FROM selection_price_history
       WHERE productId = ? AND price = ? AND source = ?
     )`,
    sqlParams([
      productId,
      Number(value),
      PRICE_HISTORY_SOURCE,
      `保存済み直播商品名から復元 (${RECOVERY_KEY}); variant=${row.variant}; currentPriceNotInferred=true`,
      productId,
      Number(value),
      PRICE_HISTORY_SOURCE,
    ]),
  );
}

async function upsertHistoricalCatalog(connection: PoolConnection, row: HistoricalProduct): Promise<void> {
  const item = row as any;
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
    sqlParams([
      historicalEvidenceKey(row),
      item.sourceTable,
      item.sourceId,
      item.displayName || item.productName,
      item.category || null,
      item.description || item.reason || null,
      item.brandId || null,
      item.regularPrice ?? item.historicalPrice ?? null,
      item.specialPrice ?? null,
      item.imageUrl || null,
      item.imageStatus || null,
      item.imageSource || null,
      item.sourceUrl || null,
      item.isActive === null || item.isActive === undefined ? null : Number(item.isActive),
      mysqlDateTime(item.createdAt),
      mysqlDateTime(item.updatedAt),
      item.recoveryStatus || "historical_evidence_only",
      item.nameCompleteness || "complete",
      DATASET_SHA256,
    ]),
  );
}

async function upsertImageAudit(connection: PoolConnection, row: EvidenceProduct): Promise<void> {
  const image = row.imageEvidence;
  if (!image || !row.images?.[0]) return;
  await connection.execute(
    `INSERT INTO product_image_recovery_audit
      (sourceKey, sourceType, sourceId, productName, publicUrl, officialImageUrl,
       sourcePageUrl, sourceQuality, imageSha256, imageBytes, contentType, visualReview,
       applyStatus, applyNote, sourceDatasetSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'official_exact_product', ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE productName=VALUES(productName), publicUrl=VALUES(publicUrl),
       officialImageUrl=VALUES(officialImageUrl), sourcePageUrl=VALUES(sourcePageUrl),
       sourceQuality=VALUES(sourceQuality), imageSha256=VALUES(imageSha256),
       imageBytes=VALUES(imageBytes), contentType=VALUES(contentType),
       visualReview=VALUES(visualReview), applyStatus=VALUES(applyStatus),
       applyNote=VALUES(applyNote), sourceDatasetSha256=VALUES(sourceDatasetSha256)`,
    sqlParams([
      row.sourceKey,
      row.sourceClass,
      row.sourceKey,
      row.productName,
      image.publicUrl,
      image.officialImageUrl,
      image.sourcePageUrl,
      image.sha256,
      image.bytes,
      image.contentType,
      image.visualReview,
      IMAGE_APPLY_STATUS,
      "KG商品第三輪。HTTP/形式/寸法/目視を確認し、価格入り画像を除外済み。",
      DATASET_SHA256,
    ]),
  );
}

async function getEvidenceState(pool: Pool): Promise<{
  selectionProductTotal: number;
  selectionParentTotal: number;
  evidenceProductCount: number;
  evidenceParentCount: number;
  evidenceChildCount: number;
  visibleEvidenceProductCount: number;
  mismatchedProductCount: number;
  historicalCatalogCount: number;
  sourceEvidenceCount: number;
  verifiedImageCount: number;
  savedPriceHistoryCount: number;
  kgVisibleProductCount: number;
  healthy: boolean;
}> {
  const allEvidenceRows: EvidenceProduct[] = [...evidence.mainProducts, ...evidence.childSkus];
  const sourceKeys = allEvidenceRows.map((row) => row.sourceKey);
  const historicalKeys = evidence.historicalCatalogAdditions.map(historicalEvidenceKey);
  const [countRows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL) AS selectionProductTotal,
      (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL AND parentProductId IS NULL) AS selectionParentTotal,
      (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL AND (UPPER(brandName) LIKE '%KYOGOKU%' OR UPPER(brandName) = 'KG')) AS kgVisibleProductCount,
      (SELECT COUNT(*) FROM selection_product_source_evidence WHERE evidenceSha256 = ?) AS sourceEvidenceCount,
      (SELECT COUNT(*) FROM historical_product_catalog WHERE sourceDatasetSha256 = ?) AS historicalCatalogCount,
      (SELECT COUNT(*) FROM product_image_recovery_audit WHERE sourceDatasetSha256 = ? AND applyStatus = ?) AS verifiedImageCount,
      (SELECT COUNT(*) FROM selection_price_history WHERE source = ?) AS savedPriceHistoryCount
  `, [DATASET_SHA256, DATASET_SHA256, DATASET_SHA256, IMAGE_APPLY_STATUS, PRICE_HISTORY_SOURCE]);

  const [productRows] = await pool.query<RowDataPacket[]>(
    `SELECT child.id, child.productId, child.productName, child.brandId, child.brandName,
            child.parentProductId, child.skuName, child.historicalLowestPrice, child.images,
            child.deletedAt, parent.productId AS parentSourceKey
     FROM selection_products child
     LEFT JOIN selection_products parent ON parent.id = child.parentProductId
     WHERE child.productId IN (${sourceKeys.map(() => "?").join(",")})`,
    sourceKeys,
  );

  const expected = new Map(allEvidenceRows.map((row) => [row.sourceKey, row]));
  const seen = new Set<string>();
  let mismatchedProductCount = 0;
  let evidenceParentCount = 0;
  let evidenceChildCount = 0;
  for (const dbRow of productRows) {
    const key = String(dbRow.productId || "");
    const expectedRow = expected.get(key);
    if (!expectedRow || seen.has(key)) {
      mismatchedProductCount += 1;
      continue;
    }
    seen.add(key);
    if (String(dbRow.productName) !== expectedRow.productName || Number(dbRow.brandId) !== Number(expectedRow.brandId)) {
      mismatchedProductCount += 1;
    }
    if (isChild(expectedRow)) {
      evidenceChildCount += 1;
      if (String(dbRow.parentSourceKey || "") !== expectedRow.parentSourceKey) mismatchedProductCount += 1;
      if (String(dbRow.skuName || "") !== expectedRow.sku) mismatchedProductCount += 1;
      if (expectedRow.historicalLowestPrice !== null && expectedRow.historicalLowestPrice !== undefined
        && Number(dbRow.historicalLowestPrice || 0) !== Number(expectedRow.historicalLowestPrice)) {
        mismatchedProductCount += 1;
      }
    } else {
      evidenceParentCount += 1;
      if (dbRow.parentProductId !== null && dbRow.parentProductId !== undefined) mismatchedProductCount += 1;
    }
    if (expectedRow.images?.length && parseJsonArray(dbRow.images).length === 0) mismatchedProductCount += 1;
  }

  const counts = (countRows[0] || {}) as RowDataPacket;
  const state = {
    selectionProductTotal: Number(counts.selectionProductTotal || 0),
    selectionParentTotal: Number(counts.selectionParentTotal || 0),
    evidenceProductCount: seen.size,
    evidenceParentCount,
    evidenceChildCount,
    visibleEvidenceProductCount: productRows.filter((row) => !row.deletedAt).length,
    mismatchedProductCount,
    historicalCatalogCount: Number(counts.historicalCatalogCount || 0),
    sourceEvidenceCount: Number(counts.sourceEvidenceCount || 0),
    verifiedImageCount: Number(counts.verifiedImageCount || 0),
    savedPriceHistoryCount: Number(counts.savedPriceHistoryCount || 0),
    kgVisibleProductCount: Number(counts.kgVisibleProductCount || 0),
    healthy: false,
  };
  state.healthy = state.selectionProductTotal >= evidence.expected.selectionProductMaximumAfter
    && state.evidenceProductCount === allEvidenceRows.length
    && state.evidenceParentCount === evidence.mainProducts.length
    && state.evidenceChildCount === evidence.childSkus.length
    && state.visibleEvidenceProductCount === allEvidenceRows.length
    && state.mismatchedProductCount === 0
    && state.historicalCatalogCount === historicalKeys.length
    && state.sourceEvidenceCount === allEvidenceRows.length
    && state.verifiedImageCount === 6
    && state.savedPriceHistoryCount === 5;
  return state;
}

export async function getKgProductRecoveryHealth(): Promise<Awaited<ReturnType<typeof getEvidenceState>> & {
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
      "SELECT status, completedAt, errorMessage, details FROM kg_product_recovery_runs WHERE recoveryKey = ? LIMIT 1",
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

export async function runKgProductRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for KG product recovery");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureTables(pool);
    const before = await getEvidenceState(pool);
    if (before.healthy) {
      console.log(`[KgProductRecovery] healthy ${JSON.stringify(before)}`);
      return;
    }

    await pool.execute(
      `INSERT INTO kg_product_recovery_runs
        (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [RECOVERY_KEY, jsonText({ before, expected: evidence.expected, evidenceSha256: DATASET_SHA256 })],
    );

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    let insertedParents = 0;
    let insertedChildren = 0;
    try {
      await connection.beginTransaction();
      const [brandRows] = await connection.query<RowDataPacket[]>("SELECT id, name FROM brands WHERE id = 91 LIMIT 1");
      if (!brandRows[0]) throw new Error("KYOGOKU brand id=91 is missing");

      for (const row of evidence.mainProducts) {
        const saved = await upsertMainProduct(connection, row);
        if (saved.inserted) insertedParents += 1;
        await upsertSourceEvidence(connection, row, saved.id);
        await upsertImageAudit(connection, row);
      }
      for (const row of evidence.childSkus) {
        const saved = await upsertChildSku(connection, row);
        if (saved.inserted) insertedChildren += 1;
        await upsertSourceEvidence(connection, row, saved.id);
        await upsertPriceHistory(connection, row, saved.id);
        await upsertImageAudit(connection, row);
      }
      for (const row of evidence.historicalCatalogAdditions) {
        await upsertHistoricalCatalog(connection, row);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const after = await getEvidenceState(pool);
    if (!after.healthy) {
      throw new Error(`KG product recovery verification failed: ${JSON.stringify(after)}`);
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      before,
      after,
      expected: evidence.expected,
      evidenceSha256: DATASET_SHA256,
      insertedParents,
      insertedChildren,
      preBackupId,
      postBackupId,
      oldTiDBUsed: false,
      currentWebPricesUsed: false,
      similarImagesUsed: false,
    };
    await pool.execute(
      `UPDATE kg_product_recovery_runs SET status='success', completedAt=CURRENT_TIMESTAMP,
       parentProductCount=?, childSkuCount=?, historicalCatalogCount=?, verifiedImageCount=?,
       details=?, errorMessage=NULL WHERE recoveryKey=?`,
      [
        after.evidenceParentCount,
        after.evidenceChildCount,
        after.historicalCatalogCount,
        after.verifiedImageCount,
        jsonText(details),
        RECOVERY_KEY,
      ],
    );
    console.log(`[KgProductRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE kg_product_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[KgProductRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
