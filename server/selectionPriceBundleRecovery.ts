import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "selection-price-bundle-recovery-v1-2026-08-25";
const PRE_BACKUP_REASON = "pre-selection-price-recovery-v1";
const POST_BACKUP_REASON = "post-selection-price-recovery-v1";
const BUNDLE_DESCRIPTION = "保存済み復旧資材のbrand_products商品セットから再構築";

const BRAND_PRICE_EVIDENCE = [
  {
    sourceKey: "brand:22",
    sourceBrandProductId: 22,
    productName: "リコアセラム DDS RD カプセル（京極琉LIVEコラボセット、15粒プレゼント、ホワイトポーチプレゼント付き）",
    price: 7_800,
    marketPrice: 18_480,
    discountRate: 30,
    commissionValue: 30,
    evidenceDate: "2026-01-27",
  },
  {
    sourceKey: "brand:23",
    sourceBrandProductId: 23,
    productName: "【ビジュードゥメール】ブリリアントピールゲル・トリートメントリペアクリア美容液・ポーチプレゼント（京極琉LIVEコラボセット）",
    price: 13_200,
    marketPrice: 21_000,
    discountRate: 30,
    commissionValue: 30,
    evidenceDate: "2026-01-27",
  },
  {
    sourceKey: "brand:30001",
    sourceBrandProductId: 30_001,
    productName: "【ビジュードゥメール】・クリームパックマスク×20枚セット",
    price: 5_000,
    marketPrice: 11_000,
    discountRate: 30,
    commissionValue: 30,
    evidenceDate: "2026-01-27",
  },
] as const;

const BUNDLE_EVIDENCE = [
  { sourceKey: "brand:22", productName: BRAND_PRICE_EVIDENCE[0].productName },
  { sourceKey: "brand:23", productName: BRAND_PRICE_EVIDENCE[1].productName },
  { sourceKey: "brand:30001", productName: BRAND_PRICE_EVIDENCE[2].productName },
  { sourceKey: "brand:30002", productName: "リカリアル 30秒美肌オールインワンケアシート 3個セット (京極琉LIVEコラボセット)" },
  { sourceKey: "brand:30003", productName: "Rika Real 1秒グラデーションアイシャドウ・マルチハイライター・リップオイルエッセンス・ブラックポーチプレゼント 京極琉LIVEコラボセット" },
  { sourceKey: "brand:30004", productName: "【ビジュードゥメール】ブリリアントピールゲル・トリートメントリペアクリア美容液・ポーチプレゼント 京極琉LIVEコラボセット" },
  { sourceKey: "brand:30010", productName: "【京極琉(KG)限定】Canban参半 美白・黄ばみ除去セット。ファミリーセット" },
  { sourceKey: "brand:30011", productName: "京極琉(KG)限定|Canban参半 美白・黄ばみ除去セット" },
  { sourceKey: "brand:30012", productName: "スパトリートメント NMNシートマスク 美容液 21ml 含浸マスク×4枚入" },
] as const;

export const SELECTION_PRICE_DATASET_SHA256 = "63dde67b94fa14327acbfe5f62c797002e9da78681558eabaa7e682144cde4cb";
export const SELECTION_BUNDLE_DATASET_SHA256 = "1b7a954e21aba4eae67c7e954949d5eca1d590cd62df0a32398130075a89f765";

async function ensureRecoveryTable(pool: Pool): Promise<void> {
  await pool.execute("ALTER TABLE selection_products ADD COLUMN historicalLowestPrice DECIMAL(12,2) DEFAULT NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute("ALTER TABLE selection_products ADD COLUMN discountRate DECIMAL(5,2) DEFAULT NULL").catch((error: any) => {
    if (error?.code !== "ER_DUP_FIELDNAME") throw error;
  });
  await pool.execute(`CREATE TABLE IF NOT EXISTS selection_price_bundle_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    pricedProductCount int NOT NULL DEFAULT 0,
    historicalLowestCount int NOT NULL DEFAULT 0,
    bundleCount int NOT NULL DEFAULT 0,
    bundleItemCount int NOT NULL DEFAULT 0,
    details json DEFAULT NULL,
    errorMessage text DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY selection_price_bundle_recovery_key_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const before = await latestBackupId(pool).catch(() => 0);
    await runDatabaseBackup(reason, { force: true, waitForActive: true });
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
      [before, reason],
    );
    const row = rows[0];
    if (row?.status === "success") return;
    if (row?.status === "failed") throw new Error(`database backup failed: ${String(row.errorMessage || "unknown")}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`database backup did not complete for reason=${reason}`);
}

async function getEvidenceState(pool: Pool): Promise<{
  selectionProductCount: number;
  pricedProductCount: number;
  historicalLowestCount: number;
  priceHistoryCount: number;
  bundleCount: number;
  bundleItemCount: number;
  healthy: boolean;
}> {
  const sourceKeys = [
    ...BRAND_PRICE_EVIDENCE.map((row) => row.sourceKey),
  ];
  const bundleNames = BUNDLE_EVIDENCE.map((row) => row.productName);
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM selection_products WHERE deletedAt IS NULL) AS selectionProductCount,
      (
        SELECT COUNT(*) FROM selection_products sp
        WHERE sp.deletedAt IS NULL AND sp.price IS NOT NULL AND sp.price > 0
      ) AS pricedProductCount,
      (
        SELECT COUNT(*) FROM selection_products sp
        WHERE sp.deletedAt IS NULL AND sp.historicalLowestPrice IS NOT NULL AND sp.historicalLowestPrice > 0
      ) AS historicalLowestCount,
      (SELECT COUNT(*) FROM selection_price_history) AS priceHistoryCount,
      (
        SELECT COUNT(*) FROM product_bundles pb
        WHERE pb.deletedAt IS NULL AND pb.bundleName IN (${bundleNames.map(() => "?").join(",")})
      ) AS bundleCount,
      (
        SELECT COUNT(*) FROM bundle_items bi
        INNER JOIN product_bundles pb ON pb.id = bi.bundleId
        WHERE pb.deletedAt IS NULL AND pb.bundleName IN (${bundleNames.map(() => "?").join(",")})
      ) AS bundleItemCount,
      (
        SELECT COUNT(*) FROM selection_products sp
        WHERE sp.deletedAt IS NULL AND sp.productId IN (${sourceKeys.map(() => "?").join(",")})
          AND sp.price IS NOT NULL AND sp.price > 0
      ) AS evidenceBrandPriceCount
  `, [...bundleNames, ...bundleNames, ...sourceKeys]);
  const row = rows[0] || {};
  const state = {
    selectionProductCount: Number(row.selectionProductCount || 0),
    pricedProductCount: Number(row.pricedProductCount || 0),
    historicalLowestCount: Number(row.historicalLowestCount || 0),
    priceHistoryCount: Number(row.priceHistoryCount || 0),
    bundleCount: Number(row.bundleCount || 0),
    bundleItemCount: Number(row.bundleItemCount || 0),
    healthy: false,
  };
  state.healthy = state.selectionProductCount >= 40
    && state.pricedProductCount >= 23
    && state.historicalLowestCount >= 23
    && state.priceHistoryCount >= 23
    && state.bundleCount === 9
    && state.bundleItemCount >= 9
    && Number(row.evidenceBrandPriceCount || 0) === 3;
  return state;
}

async function repairMallProductPrices(connection: PoolConnection): Promise<void> {
  await connection.execute(`
    UPDATE selection_products sp
    INNER JOIN mall_products mp ON sp.productId = CONCAT('mall:', mp.id)
    SET
      sp.price = CASE WHEN sp.price IS NULL OR sp.price = 0 THEN mp.price ELSE sp.price END,
      sp.marketPrice = CASE WHEN sp.marketPrice IS NULL OR sp.marketPrice = 0 THEN mp.price ELSE sp.marketPrice END,
      sp.commissionValue = CASE
        WHEN (sp.commissionValue IS NULL OR sp.commissionValue = 0) AND mp.commission_rate IS NOT NULL
          THEN mp.commission_rate
        ELSE sp.commissionValue
      END,
      sp.stock = CASE WHEN sp.stock IS NULL THEN COALESCE(mp.stock, 0) ELSE sp.stock END,
      sp.updatedAt = sp.updatedAt
    WHERE sp.deletedAt IS NULL AND mp.status = 'active' AND mp.price IS NOT NULL AND mp.price > 0
  `);

  await connection.execute(`
    INSERT INTO selection_price_history (productId, price, source, note, createdBy, createdAt)
    SELECT sp.id, mp.price, 'recovered_mall_products', 'mall_products保存済み実レコードから復元', 1,
           COALESCE(mp.updatedAt, mp.createdAt, CURRENT_TIMESTAMP)
    FROM selection_products sp
    INNER JOIN mall_products mp ON sp.productId = CONCAT('mall:', mp.id)
    WHERE sp.deletedAt IS NULL AND mp.status = 'active' AND mp.price IS NOT NULL AND mp.price > 0
      AND NOT EXISTS (
        SELECT 1 FROM selection_price_history ph
        WHERE ph.productId = sp.id AND ph.price = mp.price AND ph.source = 'recovered_mall_products'
      )
  `);
}

async function repairBrandProductPrices(connection: PoolConnection): Promise<void> {
  for (const evidence of BRAND_PRICE_EVIDENCE) {
    await connection.execute(
      `UPDATE selection_products SET
         price = CASE WHEN price IS NULL OR price = 0 THEN ? ELSE price END,
         marketPrice = CASE WHEN marketPrice IS NULL OR marketPrice = 0 THEN ? ELSE marketPrice END,
         discountRate = CASE WHEN discountRate IS NULL OR discountRate = 0 THEN ? ELSE discountRate END,
         commissionType = 'percentage',
         commissionValue = CASE WHEN commissionValue IS NULL OR commissionValue = 0 THEN ? ELSE commissionValue END
       WHERE productId = ? AND productName = ? AND deletedAt IS NULL`,
      [evidence.price, evidence.marketPrice, evidence.discountRate, evidence.commissionValue, evidence.sourceKey, evidence.productName],
    );
    await connection.execute(
      `INSERT INTO selection_price_history (productId, price, source, note, createdBy, createdAt)
       SELECT id, ?, 'recovered_brand_products_direct_select', ?, 1, ?
       FROM selection_products sp
       WHERE sp.productId = ? AND sp.productName = ? AND sp.deletedAt IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM selection_price_history ph
           WHERE ph.productId = sp.id AND ph.price = ? AND ph.source = 'recovered_brand_products_direct_select'
         )`,
      [
        evidence.price,
        `brand_products ID ${evidence.sourceBrandProductId} の保存済み直接SELECTから復元`,
        evidence.evidenceDate,
        evidence.sourceKey,
        evidence.productName,
        evidence.price,
      ],
    );
  }
}

async function repairHistoricalLowestPrices(connection: PoolConnection): Promise<void> {
  await connection.execute(`
    UPDATE selection_products sp
    INNER JOIN (
      SELECT productId, MIN(price) AS minPrice
      FROM selection_price_history
      GROUP BY productId
    ) ph ON ph.productId = sp.id
    SET sp.historicalLowestPrice = ph.minPrice
    WHERE sp.deletedAt IS NULL AND ph.minPrice IS NOT NULL AND ph.minPrice > 0
  `);
}

async function repairBundleCatalog(connection: PoolConnection): Promise<void> {
  for (const evidence of BUNDLE_EVIDENCE) {
    const priceEvidence = BRAND_PRICE_EVIDENCE.find((row) => row.sourceKey === evidence.sourceKey);
    const [products] = await connection.query<RowDataPacket[]>(
      "SELECT id, images FROM selection_products WHERE productId = ? AND productName = ? AND deletedAt IS NULL LIMIT 1 FOR UPDATE",
      [evidence.sourceKey, evidence.productName],
    );
    const product = products[0];
    if (!product) throw new Error(`selection product missing for bundle source=${evidence.sourceKey}`);

    const [bundles] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM product_bundles WHERE bundleName = ? AND deletedAt IS NULL LIMIT 1 FOR UPDATE",
      [evidence.productName],
    );
    let bundleId = Number(bundles[0]?.id || 0);
    if (!bundleId) {
      const [result] = await connection.execute<mysql.ResultSetHeader>(
        `INSERT INTO product_bundles
          (bundleName, description, price, marketPrice, stock, images, status, createdBy)
         VALUES (?, ?, ?, ?, 0, ?, 'draft', 1)`,
        [
          evidence.productName,
          BUNDLE_DESCRIPTION,
          priceEvidence?.price ?? null,
          priceEvidence?.marketPrice ?? null,
          product.images || JSON.stringify([]),
        ],
      );
      bundleId = Number(result.insertId);
    } else {
      await connection.execute(
        `UPDATE product_bundles SET
           description = CASE WHEN description IS NULL OR description = '' OR description = 'brand_productsに存在するセットSKUから再構築' THEN ? ELSE description END,
           price = CASE WHEN (price IS NULL OR price = 0) AND ? IS NOT NULL THEN ? ELSE price END,
           marketPrice = CASE WHEN (marketPrice IS NULL OR marketPrice = 0) AND ? IS NOT NULL THEN ? ELSE marketPrice END
         WHERE id = ?`,
        [
          BUNDLE_DESCRIPTION,
          priceEvidence?.price ?? null,
          priceEvidence?.price ?? null,
          priceEvidence?.marketPrice ?? null,
          priceEvidence?.marketPrice ?? null,
          bundleId,
        ],
      );
    }
    await connection.execute(
      `INSERT INTO bundle_items (bundleId, productId, productName, quantity)
       SELECT ?, ?, ?, 1 FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM bundle_items WHERE bundleId = ? AND productId = ?
       )`,
      [bundleId, Number(product.id), evidence.productName, bundleId, Number(product.id)],
    );
  }
}

export async function getSelectionPriceBundleRecoveryHealth(): Promise<Awaited<ReturnType<typeof getEvidenceState>> & {
  priceDatasetSha256: string;
  bundleDatasetSha256: string;
  recoveryRun: { status: string; completedAt: string | null; errorMessage: string | null } | null;
  backups: Array<{ reason: string; status: string; completedAt: string | null; errorMessage: string | null }>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRecoveryTable(pool);
    const state = await getEvidenceState(pool);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, completedAt, errorMessage
       FROM selection_price_bundle_recovery_runs
       WHERE recoveryKey = ? LIMIT 1`,
      [RECOVERY_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT reason, status, completedAt, errorMessage
       FROM db_backup_runs
       WHERE reason IN (?, ?)
       ORDER BY id DESC LIMIT 4`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      ...state,
      priceDatasetSha256: SELECTION_PRICE_DATASET_SHA256,
      bundleDatasetSha256: SELECTION_BUNDLE_DATASET_SHA256,
      recoveryRun: run ? {
        status: String(run.status || "unknown"),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        errorMessage: run.errorMessage ? String(run.errorMessage).slice(0, 500) : null,
      } : null,
      backups: backupRows.map((row) => ({
        reason: String(row.reason || ""),
        status: String(row.status || "unknown"),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        errorMessage: row.errorMessage ? String(row.errorMessage).slice(0, 500) : null,
      })),
    };
  } finally {
    await pool.end();
  }
}

export async function runSelectionPriceBundleRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for selection price recovery");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRecoveryTable(pool);
    const before = await getEvidenceState(pool);
    if (before.healthy) {
      console.log(`[SelectionPriceBundleRecovery] healthy ${JSON.stringify(before)}`);
      return;
    }

    await pool.execute(
      `INSERT INTO selection_price_bundle_recovery_runs
        (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [RECOVERY_KEY, JSON.stringify({ before, priceDatasetSha256: SELECTION_PRICE_DATASET_SHA256, bundleDatasetSha256: SELECTION_BUNDLE_DATASET_SHA256 })],
    );

    await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await repairMallProductPrices(connection);
      await repairBrandProductPrices(connection);
      await repairHistoricalLowestPrices(connection);
      await repairBundleCatalog(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const after = await getEvidenceState(pool);
    if (!after.healthy) throw new Error(`selection price recovery verification failed: ${JSON.stringify(after)}`);
    await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE selection_price_bundle_recovery_runs SET
         status='success', completedAt=CURRENT_TIMESTAMP,
         pricedProductCount=?, historicalLowestCount=?, bundleCount=?, bundleItemCount=?,
         details=?, errorMessage=NULL
       WHERE recoveryKey=?`,
      [
        after.pricedProductCount,
        after.historicalLowestCount,
        after.bundleCount,
        after.bundleItemCount,
        JSON.stringify({ before, after, priceDatasetSha256: SELECTION_PRICE_DATASET_SHA256, bundleDatasetSha256: SELECTION_BUNDLE_DATASET_SHA256 }),
        RECOVERY_KEY,
      ],
    );
    console.log(`[SelectionPriceBundleRecovery] success ${JSON.stringify(after)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE selection_price_bundle_recovery_runs SET status='failed', completedAt=CURRENT_TIMESTAMP,
       errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), RECOVERY_KEY],
    ).catch(() => undefined);
    console.error("[SelectionPriceBundleRecovery] failed", error);
    throw error;
  } finally {
    await pool.end();
  }
}
