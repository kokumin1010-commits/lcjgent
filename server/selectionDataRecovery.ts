import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import brandLivestreamEvidence from "./recoveryData/brandLivestreamEvidence.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "selection-center-recovery-v1";
const PRE_BACKUP_REASON = "pre-selection-recovery-v1";
const POST_BACKUP_REASON = "post-selection-recovery-v1";

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

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentageOrZero(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[\s\(\)（）/／・._-]+/g, "");
}

function inferredBrand(productName: string, sourceBrandName?: string | null): string {
  const source = sourceBrandName && sourceBrandName !== "NULL" ? sourceBrandName.trim() : "";
  if (source) return source;
  const name = productName.toLowerCase();
  if (name.includes("kyogoku") || name.includes("京極")) return "KYOGOKU JAPAN";
  if (name.includes("リカリアル") || name.includes("rika real") || name.includes("リコアセラム")) return "星睿肌 RikaReal （リカリアル）";
  if (name.includes("ビジュードゥメール")) return "BIJOU DE MER";
  if (name.includes("canban") || name.includes("参半")) return "参半canban (サンバン)";
  if (name.includes("スパトリートメント")) return "spa treatment (スパ・トリートメント)";
  if (name.includes("renovatio") || name.includes("フリーズドライ") || name.includes("nmn24000")) return "DDS RENOVATIO （レノバティオ）";
  if (name.includes("icell")) return "iCell (アイセル)";
  if (name.includes("ラフロリア") || name.includes("デリケート") || name.includes("フェムケア")) return "I'm La Floria (アイムラフロリア)";
  if (name.includes("セインムー") || name.includes("シャンパーニュカーボン") || name.includes("エクソソーム")) return "コスメメゾン・セインムー";
  if (name.includes("プロテイン") || name.includes("wpc")) return "ホエイプロテイン";
  return "LCJ MALL";
}

function isBundleProduct(name: string): boolean {
  return /セット|コラボ|プレゼント|×\s*\d+/i.test(name);
}

async function ensureRecoveryTables(connection: Connection): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS \`selection_recovery_markers\` (
    \`recoveryKey\` varchar(100) NOT NULL,
    \`status\` varchar(20) NOT NULL,
    \`details\` json DEFAULT NULL,
    \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`completedAt\` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (\`recoveryKey\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await connection.execute("ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL").catch(() => undefined);
}

async function verifyBackup(connection: Connection, reason: string): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT status, tableCount, rowCount, completedAt FROM db_backup_runs WHERE reason = ? ORDER BY id DESC LIMIT 1",
    [reason],
  );
  if (!rows[0] || rows[0].status !== "success") {
    throw new Error(`required backup did not complete successfully: ${reason}`);
  }
}

async function getCurrentBrandMap(connection: Connection): Promise<Map<string, { id: number; name: string }>> {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id, name, companyName FROM brands WHERE deletedAt IS NULL OR deletedAt IS NULL");
  const map = new Map<string, { id: number; name: string }>();
  for (const row of rows) {
    const name = String(row.name || row.companyName || "").trim();
    if (!name) continue;
    map.set(normalizeName(name), { id: Number(row.id), name });
  }
  return map;
}

function findBrandId(brandMap: Map<string, { id: number; name: string }>, brandName: string): number | null {
  const exact = brandMap.get(normalizeName(brandName));
  if (exact) return exact.id;
  const key = normalizeName(brandName);
  for (const [candidate, value] of brandMap) {
    if (candidate.includes(key) || key.includes(candidate)) return value.id;
  }
  return null;
}

async function insertSelectionProduct(
  connection: Connection,
  input: {
    sourceKey: string;
    productName: string;
    brandName: string;
    brandId: number | null;
    categoryId: number | null;
    price: number | null;
    marketPrice: number | null;
    costPrice: number | null;
    commissionValue: number;
    stock: number;
    images: string[];
    sellingPoints: string | null;
    description: string;
  },
): Promise<{ id: number; inserted: boolean }> {
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM selection_products WHERE productId = ? AND deletedAt IS NULL LIMIT 1",
    [input.sourceKey],
  );
  if (existing[0]) return { id: Number(existing[0].id), inserted: false };

  const [result] = await connection.execute<mysql.ResultSetHeader>(
    `INSERT INTO selection_products
      (productName, brandName, brandId, categoryId, price, marketPrice, costPrice,
       commissionType, commissionValue, stock, images, sellingPoints, description,
       status, createdBy, productId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'percentage', ?, ?, ?, ?, ?, 'online', 1, ?, NOW(), NOW())`,
    [
      input.productName,
      input.brandName,
      input.brandId,
      input.categoryId,
      input.price,
      input.marketPrice,
      input.costPrice,
      input.commissionValue,
      input.stock,
      JSON.stringify(input.images),
      input.sellingPoints,
      input.description,
      input.sourceKey,
    ],
  );
  return { id: Number(result.insertId), inserted: true };
}

async function executeSelectionRecovery(connection: Connection) {
  const summary = {
    categoriesInserted: 0,
    mallProductsInserted: 0,
    brandProductsInserted: 0,
    bundlesInserted: 0,
    bundleItemsInserted: 0,
    pricesInserted: 0,
    livestreamsInserted: 0,
  };

  const [mallCategories] = await connection.query<RowDataPacket[]>(
    "SELECT id, name, parentId, sortOrder FROM mall_categories WHERE isActive = 'yes' ORDER BY id",
  );
  for (const category of mallCategories) {
    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT INTO selection_categories (name, parentId, sortOrder)
       SELECT ?, NULL, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM selection_categories WHERE name = ?)`,
      [category.name, category.sortOrder || 0, category.name],
    );
    summary.categoriesInserted += result.affectedRows;
  }

  const [selectionCategories] = await connection.query<RowDataPacket[]>("SELECT id, name FROM selection_categories");
  const categoryByName = new Map(selectionCategories.map((row) => [String(row.name), Number(row.id)]));
  const brandMap = await getCurrentBrandMap(connection);

  const [mallProducts] = await connection.query<RowDataPacket[]>(`
    SELECT mp.id, mp.name, mp.description, mp.price, mp.pointPrice, mp.stock,
           mp.imageUrl, mp.imageUrls, mp.commission_rate, mp.categoryId,
           mb.name AS sourceBrandName, mc.name AS categoryName
    FROM mall_products mp
    LEFT JOIN mall_brands mb ON mb.id = mp.brandId
    LEFT JOIN mall_categories mc ON mc.id = mp.categoryId
    WHERE mp.status = 'active'
    ORDER BY mp.id
  `);

  const selectionBySource = new Map<string, number>();
  for (const product of mallProducts) {
    const productName = String(product.name);
    const brandName = inferredBrand(productName, product.sourceBrandName ? String(product.sourceBrandName) : null);
    const images = [String(product.imageUrl || ""), ...parseJsonArray(product.imageUrls)].filter(Boolean);
    const categoryId = categoryByName.get(String(product.categoryName || "")) || null;
    const saved = await insertSelectionProduct(connection, {
      sourceKey: `mall:${product.id}`,
      productName,
      brandName,
      brandId: findBrandId(brandMap, brandName),
      categoryId,
      price: numberOrNull(product.price),
      marketPrice: numberOrNull(product.price),
      costPrice: null,
      commissionValue: numberOrNull(product.commission_rate) || 0,
      stock: numberOrNull(product.stock) || 0,
      images,
      sellingPoints: product.description ? String(product.description) : null,
      description: "Railway MySQL内のmall_products実レコードから再構築",
    });
    selectionBySource.set(`mall:${product.id}`, saved.id);
    if (saved.inserted) summary.mallProductsInserted++;
    const price = numberOrNull(product.price);
    if (price !== null) {
      const [priceResult] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO selection_price_history (productId, price, source, note, createdBy)
         SELECT ?, ?, 'recovered_mall_products', 'mall_products実レコードから復元', 1 FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM selection_price_history
           WHERE productId = ? AND price = ? AND source = 'recovered_mall_products'
         )`,
        [saved.id, price, saved.id, price],
      );
      summary.pricesInserted += priceResult.affectedRows;
    }
  }

  const [brandProducts] = await connection.query<RowDataPacket[]>(`
    SELECT id, brandId, productName, listPrice, specialPrice, purchasePrice,
           commissionRate, imageUrls, catchCopy, features, productDetails, remarks
    FROM brand_products
    WHERE deletedAt IS NULL
    ORDER BY id
  `);

  for (const product of brandProducts) {
    const productName = String(product.productName);
    const brandName = inferredBrand(productName, null);
    const sellingPoints = [product.catchCopy, product.features, product.productDetails]
      .filter((value) => value !== null && value !== undefined && String(value).trim())
      .map(String)
      .join("\n\n") || null;
    const saved = await insertSelectionProduct(connection, {
      sourceKey: `brand:${product.id}`,
      productName,
      brandName,
      brandId: findBrandId(brandMap, brandName),
      categoryId: null,
      price: numberOrNull(product.specialPrice) ?? numberOrNull(product.listPrice),
      marketPrice: numberOrNull(product.listPrice),
      costPrice: numberOrNull(product.purchasePrice),
      commissionValue: percentageOrZero(product.commissionRate),
      stock: 0,
      images: parseJsonArray(product.imageUrls),
      sellingPoints,
      description: product.remarks ? String(product.remarks) : "Railway MySQL内のbrand_products実レコードから再構築",
    });
    selectionBySource.set(`brand:${product.id}`, saved.id);
    if (saved.inserted) summary.brandProductsInserted++;

    if (isBundleProduct(productName)) {
      const [existingBundles] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM product_bundles WHERE bundleName = ? AND deletedAt IS NULL LIMIT 1",
        [productName],
      );
      let bundleId = existingBundles[0] ? Number(existingBundles[0].id) : 0;
      if (!bundleId) {
        const [bundleResult] = await connection.execute<mysql.ResultSetHeader>(
          `INSERT INTO product_bundles
            (bundleName, description, price, marketPrice, stock, images, status, createdBy)
           VALUES (?, 'brand_productsに存在するセットSKUから再構築', ?, ?, 0, ?, 'draft', 1)`,
          [
            productName,
            numberOrNull(product.specialPrice) ?? numberOrNull(product.listPrice),
            numberOrNull(product.listPrice),
            JSON.stringify(parseJsonArray(product.imageUrls)),
          ],
        );
        bundleId = Number(bundleResult.insertId);
        summary.bundlesInserted++;
      }
      const [itemResult] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO bundle_items (bundleId, productId, productName, quantity)
         SELECT ?, ?, ?, 1 FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM bundle_items WHERE bundleId = ? AND productId = ?)`,
        [bundleId, saved.id, productName, bundleId, saved.id],
      );
      summary.bundleItemsInserted += itemResult.affectedRows;
    }
  }

  for (const row of brandLivestreamEvidence.rows) {
    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT INTO brand_livestreams
        (id, brandId, liverId, livestreamDate, streamerName, createdBy, platform, remarks)
       SELECT ?, ?, ?, ?, ?, ?, 'TikTok', 'DB操作履歴の直接SELECTから復元' FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM brand_livestreams WHERE id = ?)`,
      [row.id, row.brandId, row.liverId, row.livestreamDate, row.streamerName, row.createdBy, row.id],
    );
    summary.livestreamsInserted += result.affectedRows;
  }

  return summary;
}

export async function runSelectionDataRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for selection recovery");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureRecoveryTables(connection);
    const [markers] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM selection_recovery_markers WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY],
    );
    if (markers[0]?.status === "success") {
      console.log(`[SelectionRecovery] already complete key=${RECOVERY_KEY}`);
      return;
    }

    await connection.execute(
      `INSERT INTO selection_recovery_markers (recoveryKey, status, details, startedAt, completedAt)
       VALUES (?, 'running', NULL, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE status='running', details=NULL, startedAt=CURRENT_TIMESTAMP, completedAt=NULL`,
      [RECOVERY_KEY],
    );

    await runDatabaseBackup(PRE_BACKUP_REASON);
    await verifyBackup(connection, PRE_BACKUP_REASON);

    await connection.beginTransaction();
    let summary;
    try {
      summary = await executeSelectionRecovery(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    await runDatabaseBackup(POST_BACKUP_REASON);
    await verifyBackup(connection, POST_BACKUP_REASON);

    const [counts] = await connection.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL) AS selectionProducts,
        (SELECT COUNT(*) FROM product_bundles WHERE deletedAt IS NULL) AS bundles,
        (SELECT COUNT(*) FROM bundle_items) AS bundleItems,
        (SELECT COUNT(*) FROM selection_price_history) AS priceHistory,
        (SELECT COUNT(*) FROM brand_livestreams WHERE deletedAt IS NULL) AS brandLivestreams
    `);
    const details = { ...summary, finalCounts: counts[0] };
    await connection.execute(
      "UPDATE selection_recovery_markers SET status='success', details=?, completedAt=CURRENT_TIMESTAMP WHERE recoveryKey=?",
      [JSON.stringify(details), RECOVERY_KEY],
    );
    console.log(`[SelectionRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await connection.execute(
      "UPDATE selection_recovery_markers SET status='failed', details=?, completedAt=CURRENT_TIMESTAMP WHERE recoveryKey=?",
      [JSON.stringify({ error: message.slice(0, 3000) }), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[SelectionRecovery] failed", error);
    throw error;
  } finally {
    await connection.end();
  }
}
