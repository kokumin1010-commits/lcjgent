import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type StoreBrandRelationDatabase = Pool | PoolConnection;

export type StoreBrandLink = {
  storeId: number;
  brandId: number;
  isPrimary: boolean;
  brandName: string | null;
  brandNameJa: string | null;
  companyName: string | null;
};

export async function ensureStoreBrandRelations(
  database: StoreBrandRelationDatabase
): Promise<void> {
  await database.query(`CREATE TABLE IF NOT EXISTS managed_store_brands (
    storeId INT NOT NULL,
    brandId INT NOT NULL,
    isPrimary TINYINT(1) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (storeId, brandId),
    INDEX idx_managed_store_brand_lookup (brandId, storeId),
    INDEX idx_managed_store_primary (storeId, isPrimary)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await database.query(`
    INSERT IGNORE INTO managed_store_brands (storeId, brandId, isPrimary)
    SELECT id, brandId, 1
      FROM managed_stores
     WHERE brandId IS NOT NULL
  `);
  await database.query(`
    UPDATE managed_store_brands relation
    JOIN managed_stores store ON store.id = relation.storeId
       SET relation.isPrimary = CASE WHEN relation.brandId = store.brandId THEN 1 ELSE 0 END
     WHERE store.brandId IS NOT NULL
       AND relation.isPrimary <> CASE WHEN relation.brandId = store.brandId THEN 1 ELSE 0 END
  `);
}

export async function assertStoreBrandIdsExist(
  database: StoreBrandRelationDatabase,
  brandIds: number[]
): Promise<number[]> {
  const normalized = [...new Set(brandIds.map(Number))].filter(
    value => Number.isSafeInteger(value) && value > 0
  );
  if (normalized.length === 0) return [];
  const placeholders = normalized.map(() => "?").join(",");
  const [rows] = await database.query<RowDataPacket[]>(
    `SELECT id FROM brands WHERE id IN (${placeholders}) AND deletedAt IS NULL`,
    normalized
  );
  const existing = new Set(rows.map(row => Number(row.id)));
  const missing = normalized.filter(brandId => !existing.has(brandId));
  if (missing.length > 0) {
    throw new Error(`所选服务品牌不存在或已归档: ${missing.join(",")}`);
  }
  return normalized;
}

export async function loadStoreBrandLinks(
  database: StoreBrandRelationDatabase,
  storeIds: number[]
): Promise<Map<number, StoreBrandLink[]>> {
  const normalizedStoreIds = [...new Set(storeIds.map(Number))].filter(
    value => Number.isSafeInteger(value) && value > 0
  );
  const byStore = new Map<number, StoreBrandLink[]>();
  if (normalizedStoreIds.length === 0) return byStore;
  const placeholders = normalizedStoreIds.map(() => "?").join(",");
  const [rows] = await database.query<RowDataPacket[]>(
    `SELECT relation.storeId, relation.brandId, relation.isPrimary,
            brand.name AS brandName, brand.nameJa AS brandNameJa,
            brand.companyName
       FROM managed_store_brands relation
       INNER JOIN brands brand ON brand.id = relation.brandId
        AND brand.deletedAt IS NULL
      WHERE relation.storeId IN (${placeholders})
      ORDER BY relation.storeId, relation.isPrimary DESC,
               COALESCE(NULLIF(brand.nameJa, ''), brand.name), relation.brandId`,
    normalizedStoreIds
  );
  for (const row of rows) {
    const storeId = Number(row.storeId);
    const bucket = byStore.get(storeId) || [];
    bucket.push({
      storeId,
      brandId: Number(row.brandId),
      isPrimary: Boolean(row.isPrimary),
      brandName: row.brandName ? String(row.brandName) : null,
      brandNameJa: row.brandNameJa ? String(row.brandNameJa) : null,
      companyName: row.companyName ? String(row.companyName) : null,
    });
    byStore.set(storeId, bucket);
  }
  return byStore;
}

export async function loadStoreBrandIds(
  database: StoreBrandRelationDatabase,
  storeId: number,
  options?: { forUpdate?: boolean }
): Promise<number[]> {
  const suffix = options?.forUpdate ? " FOR UPDATE" : "";
  const [rows] = await database.query<RowDataPacket[]>(
    `SELECT brandId FROM managed_store_brands WHERE storeId = ? ORDER BY isPrimary DESC, brandId${suffix}`,
    [storeId]
  );
  return rows.map(row => Number(row.brandId));
}

export async function replaceStoreBrandLinks(
  connection: PoolConnection,
  storeId: number,
  brandIds: number[]
): Promise<{ brandIds: number[]; primaryBrandId: number | null }> {
  const normalized = await assertStoreBrandIdsExist(connection, brandIds);
  await connection.query("DELETE FROM managed_store_brands WHERE storeId = ?", [
    storeId,
  ]);
  for (const [index, brandId] of normalized.entries()) {
    await connection.query(
      `INSERT INTO managed_store_brands (storeId, brandId, isPrimary)
       VALUES (?, ?, ?)`,
      [storeId, brandId, index === 0 ? 1 : 0]
    );
  }
  const primaryBrandId = normalized[0] || null;
  await connection.query("UPDATE managed_stores SET brandId = ? WHERE id = ?", [
    primaryBrandId,
    storeId,
  ]);
  return { brandIds: normalized, primaryBrandId };
}

export function attachStoreBrandLinks(
  store: Record<string, any>,
  links: StoreBrandLink[]
): Record<string, any> {
  const normalizedLinks =
    links.length > 0
      ? links
      : store.brandId
        ? [
            {
              storeId: Number(store.id),
              brandId: Number(store.brandId),
              isPrimary: true,
              brandName: store.brandName ? String(store.brandName) : null,
              brandNameJa: store.brandNameJa ? String(store.brandNameJa) : null,
              companyName: store.brandCompanyName
                ? String(store.brandCompanyName)
                : null,
            },
          ]
        : [];
  const primary =
    normalizedLinks.find(link => link.isPrimary) || normalizedLinks[0] || null;
  return {
    ...store,
    brandId: primary?.brandId || null,
    brandName: primary?.brandName || null,
    brandNameJa: primary?.brandNameJa || null,
    brandIds: normalizedLinks.map(link => link.brandId),
    brands: normalizedLinks.map(link => ({
      id: link.brandId,
      name: link.brandName,
      nameJa: link.brandNameJa,
      companyName: link.companyName,
      isPrimary: link.isPrimary,
    })),
  };
}
