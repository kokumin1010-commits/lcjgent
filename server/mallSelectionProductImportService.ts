import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  collectSelectionProductImportVariants,
  parseSelectionProductImages,
  selectionProductToMallPrefill,
  type SelectionProductImportSource,
} from "@shared/mallSelectionProductImport";
import {
  mallBulkSyncSourceName,
  planMallSelectionBulkSync,
  type MallBulkSyncExisting,
  type MallBulkSyncSource,
} from "@shared/mallSelectionBulkSync";

export type MallSelectionImportListInput = {
  search?: string;
  limit?: number;
};

export type CreateMallProductFromSelectionInput = {
  selectionProductId: number;
  name: string;
  description?: string | null;
  category?: string | null;
  brandId?: number | null;
  categoryId?: number | null;
  subcategoryId?: number | null;
  price: number;
  pointPrice?: number | null;
  stock: number;
  imageUrls?: string[];
  imageKeys?: string[];
  status: "draft" | "active" | "sold_out" | "archived";
  sortOrder: number;
  commissionRate?: string | null;
};

let schemaEnsurePromise: Promise<void> | null = null;

export async function ensureMallSelectionImportSchema(pool: Pool): Promise<void> {
  if (!schemaEnsurePromise) {
    schemaEnsurePromise = (async () => {
      try {
        await pool.query("ALTER TABLE mall_products ADD COLUMN selectionProductId INT DEFAULT NULL");
      } catch (error: any) {
        if (error?.code !== "ER_DUP_FIELDNAME" && !error?.message?.includes("Duplicate column")) throw error;
      }
      try {
        await pool.query("CREATE UNIQUE INDEX uk_mall_products_selection_product ON mall_products (selectionProductId)");
      } catch (error: any) {
        if (error?.code !== "ER_DUP_KEYNAME" && !error?.message?.includes("Duplicate")) throw error;
      }
    })();
  }
  try {
    await schemaEnsurePromise;
  } catch (error) {
    schemaEnsurePromise = null;
    throw error;
  }
}

export function resetMallSelectionImportSchemaForTests(): void {
  schemaEnsurePromise = null;
}

type SelectionImportRow = RowDataPacket & SelectionProductImportSource & {
  categoryName: string | null;
  importedMallProductId: number | null;
  exactNameMallProductId: number | null;
  entityChildSkuCount: number | string | null;
};

function decodeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function publicImportOption(row: SelectionImportRow) {
  const embeddedSkuCount = decodeJsonArray(row.skuVariants).length;
  const legacySkuCount = embeddedSkuCount === 0 && String(row.skuName || "").trim() ? 1 : 0;
  return {
    id: Number(row.id),
    productName: String(row.productName || ""),
    productNameCn: row.productNameCn ? String(row.productNameCn) : null,
    productId: row.productId ? String(row.productId) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    brandId: row.brandId === null || row.brandId === undefined ? null : Number(row.brandId),
    brandName: row.brandName ? String(row.brandName) : null,
    categoryId: row.categoryId === null || row.categoryId === undefined ? null : Number(row.categoryId),
    categoryName: row.categoryName ? String(row.categoryName) : null,
    price: row.price === null || row.price === undefined ? null : String(row.price),
    stock: Number(row.stock || 0),
    images: parseSelectionProductImages(row.images),
    description: row.description ? String(row.description) : null,
    sellingPoints: row.sellingPoints ? String(row.sellingPoints) : null,
    commissionType: row.commissionType ? String(row.commissionType) : null,
    commissionValue: row.commissionValue === null || row.commissionValue === undefined ? null : String(row.commissionValue),
    status: row.status ? String(row.status) : "draft",
    skuVariants: decodeJsonArray(row.skuVariants),
    skuName: row.skuName ? String(row.skuName) : null,
    skuPrice: row.skuPrice === null || row.skuPrice === undefined ? null : String(row.skuPrice),
    skuLowestPrice: row.skuLowestPrice === null || row.skuLowestPrice === undefined ? null : String(row.skuLowestPrice),
    skuDiscountRate: row.skuDiscountRate === null || row.skuDiscountRate === undefined ? null : String(row.skuDiscountRate),
    promotionType: row.promotionType ? String(row.promotionType) : null,
    entityChildSkuCount: Number(row.entityChildSkuCount || 0),
    totalSkuCount: embeddedSkuCount + legacySkuCount + Number(row.entityChildSkuCount || 0),
    importedMallProductId: row.importedMallProductId ? Number(row.importedMallProductId) : null,
    exactNameMallProductId: row.exactNameMallProductId ? Number(row.exactNameMallProductId) : null,
  };
}

const SELECTION_IMPORT_COLUMNS = `
  sp.id, sp.productName, sp.productNameCn, sp.productId, sp.barcode,
  sp.brandId, sp.brandName, sp.categoryId, sc.name AS categoryName,
  sp.price, sp.stock, sp.images, sp.description, sp.sellingPoints,
  sp.commissionType, sp.commissionValue, sp.status,
  sp.skuVariants, sp.skuName, sp.skuPrice, sp.skuLowestPrice,
  sp.skuDiscountRate, sp.promotionType,
  mp.id AS importedMallProductId,
  (SELECT existing.id FROM mall_products existing
    WHERE LOWER(TRIM(existing.name)) = LOWER(TRIM(sp.productName))
       OR (COALESCE(TRIM(sp.productNameCn), '') <> '' AND LOWER(TRIM(existing.name)) = LOWER(TRIM(sp.productNameCn)))
    ORDER BY existing.id LIMIT 1) AS exactNameMallProductId,
  (SELECT COUNT(*) FROM selection_products child
    WHERE child.parentProductId = sp.id AND child.deletedAt IS NULL) AS entityChildSkuCount
`;

export async function listSelectionProductsForMallImport(
  pool: Pool,
  input: MallSelectionImportListInput,
) {
  await ensureMallSelectionImportSchema(pool);
  const limit = Math.min(Math.max(Number(input.limit || 30), 1), 50);
  const search = String(input.search || "").trim().slice(0, 100);
  const params: unknown[] = [];
  let where = "WHERE sp.deletedAt IS NULL AND sp.parentProductId IS NULL";
  if (search) {
    const keyword = `%${search}%`;
    where += ` AND (
      sp.productName LIKE ? OR COALESCE(sp.productNameCn, '') LIKE ? OR
      COALESCE(sp.productId, '') LIKE ? OR COALESCE(sp.barcode, '') LIKE ? OR
      COALESCE(sp.brandName, '') LIKE ?
    )`;
    params.push(keyword, keyword, keyword, keyword, keyword);
  }
  params.push(limit);

  const [rows] = await pool.query<SelectionImportRow[]>(
    `SELECT ${SELECTION_IMPORT_COLUMNS}
       FROM selection_products sp
       LEFT JOIN selection_categories sc ON sc.id = sp.categoryId
       LEFT JOIN mall_products mp ON mp.selectionProductId = sp.id
       ${where}
       ORDER BY CASE WHEN mp.id IS NULL THEN 0 ELSE 1 END,
                CASE WHEN sp.price IS NOT NULL AND sp.price > 0 THEN 0 ELSE 1 END,
                sp.updatedAt DESC, sp.id DESC
       LIMIT ?`,
    params,
  );
  return rows.map(publicImportOption);
}

async function selectSourceForUpdate(
  connection: PoolConnection,
  selectionProductId: number,
): Promise<SelectionImportRow> {
  const [rows] = await connection.query<SelectionImportRow[]>(
    `SELECT ${SELECTION_IMPORT_COLUMNS}
       FROM selection_products sp
       LEFT JOIN selection_categories sc ON sc.id = sp.categoryId
       LEFT JOIN mall_products mp ON mp.selectionProductId = sp.id
      WHERE sp.id = ? AND sp.deletedAt IS NULL AND sp.parentProductId IS NULL
      LIMIT 1 FOR UPDATE`,
    [selectionProductId],
  );
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "选品中心商品不存在、已删除或属于子SKU / 選品商品が存在しないか子SKUです" });
  }
  if (row.importedMallProductId) {
    throw new TRPCError({ code: "CONFLICT", message: "该选品中心商品已添加到LCJ MALL / この商品はすでにMALLへ追加済みです" });
  }
  return row;
}

function normalizeImageArrays(urls: string[] = [], keys: string[] = []) {
  const normalizedUrls: string[] = [];
  const normalizedKeys: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < urls.length && normalizedUrls.length < 10; index += 1) {
    const url = String(urls[index] || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    normalizedUrls.push(url);
    normalizedKeys.push(String(keys[index] || "").trim());
  }
  return { urls: normalizedUrls, keys: normalizedKeys };
}

function validateCreateInput(
  input: CreateMallProductFromSelectionInput,
  options: { allowZeroPriceForDraft?: boolean } = {},
) {
  const name = input.name.trim();
  if (!name) throw new TRPCError({ code: "BAD_REQUEST", message: "请输入商品名 / 商品名を入力してください" });
  const minimumPrice = options.allowZeroPriceForDraft && input.status === "draft" ? 0 : 1;
  if (!Number.isSafeInteger(input.price) || input.price < minimumPrice) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "价格必须为有效日元整数 / 価格は有効な円整数で入力してください" });
  }
  if (!Number.isSafeInteger(input.stock) || input.stock < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "库存必须为0以上整数 / 在庫は0以上の整数で入力してください" });
  }
  if (input.pointPrice !== undefined && input.pointPrice !== null && (!Number.isSafeInteger(input.pointPrice) || input.pointPrice < 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "积分价格必须为0以上整数 / ポイント価格は0以上の整数で入力してください" });
  }
  const commissionRate = input.commissionRate === undefined || input.commissionRate === null || input.commissionRate === ""
    ? null
    : Number(input.commissionRate);
  if (commissionRate !== null && (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "成果报酬必须为0～100% / 成果報酬は0～100%で入力してください" });
  }
  return { name, commissionRate };
}

export async function createMallProductFromSelection(
  pool: Pool,
  input: CreateMallProductFromSelectionInput,
  options: { allowZeroPriceForDraft?: boolean } = {},
): Promise<{ id: number; variantCount: number }> {
  await ensureMallSelectionImportSchema(pool);
  const validated = validateCreateInput(input, options);
  const images = normalizeImageArrays(input.imageUrls, input.imageKeys);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const source = await selectSourceForUpdate(connection, input.selectionProductId);

    const [sameNameRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM mall_products
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
           OR LOWER(TRIM(name)) = LOWER(TRIM(?))
           OR (COALESCE(TRIM(?), '') <> '' AND LOWER(TRIM(name)) = LOWER(TRIM(?)))
        LIMIT 2 FOR UPDATE`,
      [validated.name, source.productName, source.productNameCn, source.productNameCn],
    );
    if (sameNameRows.length > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "LCJ MALL已有同名商品，请先确认以避免重复 / 同名商品がすでにあります" });
    }

    const [insertResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO mall_products
        (name, description, category, brandId, categoryId, subcategoryId, selectionProductId,
         price, pointPrice, stock, imageUrl, imageKey, imageUrls, imageKeys,
         status, sortOrder, commission_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.name,
        input.description?.trim() || null,
        input.category?.trim() || null,
        input.brandId ?? null,
        input.categoryId ?? null,
        input.subcategoryId ?? null,
        input.selectionProductId,
        input.price,
        input.pointPrice ?? null,
        input.stock,
        images.urls[0] || null,
        images.keys[0] || null,
        JSON.stringify(images.urls),
        JSON.stringify(images.keys),
        input.status,
        input.sortOrder,
        validated.commissionRate,
      ],
    );
    const mallProductId = Number(insertResult.insertId);
    if (!Number.isInteger(mallProductId) || mallProductId <= 0 || insertResult.affectedRows !== 1) {
      throw new Error("MALL商品创建失败：数据库未返回有效ID");
    }

    const [childRows] = await connection.query<SelectionImportRow[]>(
      `SELECT * FROM selection_products
        WHERE parentProductId = ? AND deletedAt IS NULL
        ORDER BY id ASC FOR UPDATE`,
      [input.selectionProductId],
    );
    const variants = collectSelectionProductImportVariants(source, childRows);
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      await connection.query(
        `INSERT INTO mall_product_variants
          (productId, name, variantType, sku, price, stock, sortOrder, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [mallProductId, variant.name, "SKU", variant.sku, variant.price, variant.stock, index, variant.isActive],
      );
    }

    await connection.commit();
    return { id: mallProductId, variantCount: variants.length };
  } catch (error: any) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[createMallProductFromSelection] rollback failed", rollbackError); }
    if (error?.code === "ER_DUP_ENTRY") {
      throw new TRPCError({ code: "CONFLICT", message: "该选品中心商品已添加到LCJ MALL / この商品はすでにMALLへ追加済みです" });
    }
    throw error;
  } finally {
    connection.release();
  }
}


type MallBulkSyncCategoryRow = RowDataPacket & { id: number; name: string; isActive: string | null };
type MallBulkSyncBrandRow = RowDataPacket & { id: number };

type MallSelectionBulkSyncLoaded = {
  sources: MallBulkSyncSource[];
  mallProducts: MallBulkSyncExisting[];
  categories: MallBulkSyncCategoryRow[];
  brands: MallBulkSyncBrandRow[];
};

export type MallSelectionBulkSyncPreview = {
  sourceParentCount: number;
  mallProductCount: number;
  ready: number;
  alreadyMapped: number;
  mallNameConflict: number;
  sourceNameConflict: number;
  invalidName: number;
  missingPositivePrice: number;
  missingImage: number;
  missingBrand: number;
  missingCategory: number;
  missingDescription: number;
  zeroStock: number;
  withSku: number;
};

async function loadMallSelectionBulkSyncData(pool: Pool): Promise<MallSelectionBulkSyncLoaded> {
  await ensureMallSelectionImportSchema(pool);
  const [[sources], [mallProducts], [categories], [brands]] = await Promise.all([
    pool.query<Array<RowDataPacket & MallBulkSyncSource>>(
      `SELECT sp.*, sc.name AS categoryName
         FROM selection_products sp
         LEFT JOIN selection_categories sc ON sc.id = sp.categoryId
        WHERE sp.deletedAt IS NULL
        ORDER BY sp.id ASC`,
    ),
    pool.query<Array<RowDataPacket & MallBulkSyncExisting>>(
      `SELECT id, name, selectionProductId FROM mall_products ORDER BY id ASC`,
    ),
    pool.query<MallBulkSyncCategoryRow[]>(
      `SELECT id, name, isActive FROM mall_categories ORDER BY id ASC`,
    ),
    pool.query<MallBulkSyncBrandRow[]>(
      `SELECT id FROM brands WHERE deletedAt IS NULL ORDER BY id ASC`,
    ),
  ]);
  return { sources, mallProducts, categories, brands };
}

function publicMallSelectionBulkSyncPreview(
  loaded: MallSelectionBulkSyncLoaded,
): MallSelectionBulkSyncPreview {
  const plan = planMallSelectionBulkSync(loaded.sources, loaded.mallProducts);
  return {
    sourceParentCount: plan.sourceParentCount,
    mallProductCount: plan.mallProductCount,
    ready: plan.counts.ready,
    alreadyMapped: plan.counts.alreadyMapped,
    mallNameConflict: plan.counts.mallNameConflict,
    sourceNameConflict: plan.counts.sourceNameConflict,
    invalidName: plan.counts.invalidName,
    missingPositivePrice: plan.counts.missingPositivePrice,
    missingImage: plan.counts.missingImage,
    missingBrand: plan.counts.missingBrand,
    missingCategory: plan.counts.missingCategory,
    missingDescription: plan.counts.missingDescription,
    zeroStock: plan.counts.zeroStock,
    withSku: plan.counts.withSku,
  };
}

export async function previewMallSelectionBulkSync(
  pool: Pool,
): Promise<MallSelectionBulkSyncPreview> {
  return publicMallSelectionBulkSyncPreview(await loadMallSelectionBulkSyncData(pool));
}

export function bulkDraftInputForSource(
  source: MallBulkSyncSource,
  loaded: MallSelectionBulkSyncLoaded,
): CreateMallProductFromSelectionInput {
  const prefill = selectionProductToMallPrefill(source, loaded.categories, loaded.brands);
  return {
    selectionProductId: Number(source.id),
    name: mallBulkSyncSourceName(source),
    description: prefill.description || null,
    category: String(source.categoryName || "").trim() || null,
    brandId: prefill.brandId,
    categoryId: prefill.categoryId,
    subcategoryId: null,
    price: prefill.price,
    pointPrice: null,
    stock: prefill.stock,
    imageUrls: prefill.images.map((image) => image.url),
    imageKeys: prefill.images.map((image) => image.key),
    status: "draft",
    sortOrder: 9999,
    commissionRate: prefill.commissionRate || null,
  };
}

export async function processMallSelectionBulkSyncBatch(
  pool: Pool,
  input: { limit?: number } = {},
) {
  const limit = Math.min(Math.max(Number(input.limit || 20), 1), 20);
  const loaded = await loadMallSelectionBulkSyncData(pool);
  const plan = planMallSelectionBulkSync(loaded.sources, loaded.mallProducts);
  const sourceById = new Map(loaded.sources.map((source) => [Number(source.id), source]));
  const selectedIds = plan.readySourceIds.slice(0, limit);

  let created = 0;
  let createdVariants = 0;
  let createdZeroPriceDrafts = 0;
  let skippedConcurrentConflict = 0;
  let failed = 0;
  const failureCodes: Record<string, number> = {};

  for (const sourceId of selectedIds) {
    const source = sourceById.get(sourceId);
    if (!source) {
      failed += 1;
      failureCodes.SOURCE_MISSING = (failureCodes.SOURCE_MISSING || 0) + 1;
      continue;
    }
    const createInput = bulkDraftInputForSource(source, loaded);
    try {
      const createdResult = await createMallProductFromSelection(
        pool,
        createInput,
        { allowZeroPriceForDraft: true },
      );
      created += 1;
      createdVariants += createdResult.variantCount;
      if (createInput.price === 0) createdZeroPriceDrafts += 1;
    } catch (error: any) {
      if (error instanceof TRPCError && error.code === "CONFLICT") {
        skippedConcurrentConflict += 1;
        continue;
      }
      failed += 1;
      const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,40}$/.test(error.code)
        ? error.code
        : "UNEXPECTED_IMPORT_ERROR";
      failureCodes[code] = (failureCodes[code] || 0) + 1;
      console.error("[mall-selection-bulk-sync] item failed", { code });
    }
  }

  const after = await previewMallSelectionBulkSync(pool);
  const progressed = created + skippedConcurrentConflict > 0;
  return {
    attempted: selectedIds.length,
    created,
    createdVariants,
    createdZeroPriceDrafts,
    skippedConcurrentConflict,
    failed,
    failureCodes,
    remaining: after.ready,
    done: after.ready === 0,
    haltedWithoutProgress: selectedIds.length > 0 && !progressed,
    preview: after,
  };
}
