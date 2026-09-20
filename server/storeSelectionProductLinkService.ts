import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ensureMysqlColumns } from "./mysqlSchemaHelpers";
import {
  mergeStoreSelectionSkuPrefills,
  normalizeStoreSelectionIdentity,
  selectionProductToStorePrefill,
  type StoreSelectionProductPrefill,
  type StoreSelectionSourceRecord,
} from "../shared/storeSelectionProductLink";

export type StoreSelectionSearchInput = {
  storeId: number;
  search: string;
  currentProductId?: number | null;
  cursor?: number;
  limit?: number;
};

export type StoreSelectionProductOption = StoreSelectionProductPrefill & {
  sourceRevision: string;
  linkedStoreProductId: number | null;
  linkedStoreProductArchived: boolean;
  available: boolean;
};

export type StoreSelectionProductSearchPage = {
  items: StoreSelectionProductOption[];
  total: number;
  nextCursor: number | null;
};

export type StoreSelectionSaveProduct = {
  platformProductId: string | null;
  spuCode: string | null;
  productName: string;
  brandName: string | null;
  category: string | null;
  productUrl: string | null;
  basePrice: number | null;
  currency: string;
  stock: number;
  status: "draft" | "online" | "offline";
  notes: string | null;
};

export type StoreSelectionSaveSku = {
  id?: number;
  platformSkuId: string | null;
  skuCode: string | null;
  barcode: string | null;
  variantName: string;
  salePrice: number | null;
  stock: number;
  status: "active" | "inactive";
  imageUrl: string | null;
  imageKey: string | null;
};

export type SaveStoreProductFromSelectionInput = {
  storeId: number;
  productId?: number | null;
  selectionProductId: number;
  sourceRevision: string;
  product: StoreSelectionSaveProduct;
  skus: StoreSelectionSaveSku[];
  actorId: number | null;
  actorName: string;
};

type SelectionRow = RowDataPacket & StoreSelectionSourceRecord & {
  id: number;
  categoryName: string | null;
  updatedAt: Date | string | null;
  linkedStoreProductId?: number | null;
  linkedStoreProductDeletedAt?: Date | string | null;
};

type ChildRow = RowDataPacket & StoreSelectionSourceRecord & {
  id: number;
  parentProductId: number;
  updatedAt: Date | string | null;
};

type StoreBrandScope = RowDataPacket & {
  id: number;
  name: string;
  brandId: number | null;
  brandName: string | null;
  brandNameJa: string | null;
  companyName: string | null;
};

type ExistingStoreProduct = RowDataPacket & {
  id: number;
  selectionProductId: number | null;
  selectionSourceRevision: string | null;
  productName: string;
  brandName: string | null;
  platformProductId: string | null;
  spuCode: string | null;
  deletedAt: Date | string | null;
};

type StoreSelectionBulkPlan = {
  sources: Array<{ source: SelectionRow; children: ChildRow[]; revision: string; existing: ExistingStoreProduct | null }>;
  sourceParentCount: number;
  storeProductCount: number;
  createCount: number;
  refreshCount: number;
  alreadySyncedCount: number;
  archivedConflictCount: number;
  existingConflictCount: number;
  sourceConflictCount: number;
  missingPositivePriceCount: number;
  missingImageCount: number;
  zeroStockCount: number;
  withSkuCount: number;
};

export type StoreSelectionBulkSyncPreview = Omit<StoreSelectionBulkPlan, "sources"> & {
  storeId: number;
  storeName: string;
  brandId: number | null;
  brandName: string;
  brandConfigured: boolean;
  ready: number;
};

let storeSelectionSyncSchemaPromise: Promise<void> | null = null;

export async function ensureStoreSelectionSyncSchema(pool: Pool): Promise<void> {
  if (!storeSelectionSyncSchemaPromise) {
    storeSelectionSyncSchemaPromise = ensureMysqlColumns(pool, "store_products", [
      { name: "selectionSourceRevision", definition: "CHAR(64) NULL AFTER selectionProductId" },
      { name: "selectionSyncedAt", definition: "TIMESTAMP NULL AFTER selectionSourceRevision" },
    ]).then(() => undefined);
  }
  try {
    await storeSelectionSyncSchemaPromise;
  } catch (error) {
    storeSelectionSyncSchemaPromise = null;
    throw error;
  }
}

function normalizedDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function sourceRevision(source: SelectionRow, children: ChildRow[]): string {
  const stable = {
    id: Number(source.id),
    updatedAt: normalizedDate(source.updatedAt),
    productId: String(source.productId || ""),
    barcode: String(source.barcode || ""),
    productName: normalizeStoreSelectionIdentity(source.productName),
    productNameCn: normalizeStoreSelectionIdentity(source.productNameCn),
    brandId: Number(source.brandId || 0),
    brandName: normalizeStoreSelectionIdentity(source.brandName),
    categoryId: Number(source.categoryId || 0),
    categoryName: normalizeStoreSelectionIdentity(source.categoryName),
    productLink: String(source.productLink || "").trim(),
    price: source.price ?? null,
    stock: source.stock ?? null,
    status: source.status ?? null,
    description: String(source.description || "").trim(),
    sellingPoints: String(source.sellingPoints || "").trim(),
    images: source.images ?? null,
    detailImages: source.detailImages ?? null,
    skuVariants: source.skuVariants ?? null,
    children: children.map((child) => ({
      id: Number(child.id),
      updatedAt: normalizedDate(child.updatedAt),
      productId: String(child.productId || ""),
      barcode: String(child.barcode || ""),
      skuName: String(child.skuName || child.productName || ""),
      skuPrice: child.skuPrice ?? child.price ?? null,
      stock: child.stock ?? null,
      status: child.status ?? null,
      images: child.images ?? null,
      detailImages: child.detailImages ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

async function assertStore(conn: Pool | PoolConnection, storeId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM managed_stores WHERE id=? AND isActive=1 LIMIT 1",
    [storeId],
  );
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "店铺不存在或已停用" });
}

async function loadChildren(
  conn: Pool | PoolConnection,
  parentIds: number[],
  forUpdate = false,
): Promise<Map<number, ChildRow[]>> {
  const map = new Map<number, ChildRow[]>();
  if (parentIds.length === 0) return map;
  const [rows] = await conn.query<ChildRow[]>(
    `SELECT * FROM selection_products
      WHERE parentProductId IN (${placeholders(parentIds.length)}) AND deletedAt IS NULL
      ORDER BY parentProductId ASC, id ASC${forUpdate ? " FOR UPDATE" : ""}`,
    parentIds,
  );
  for (const row of rows) {
    const parentId = Number(row.parentProductId);
    const current = map.get(parentId) || [];
    current.push(row);
    map.set(parentId, current);
  }
  return map;
}

function publicOption(source: SelectionRow, children: ChildRow[], currentProductId?: number | null): StoreSelectionProductOption {
  const prefill = selectionProductToStorePrefill(source, children);
  const linkedId = source.linkedStoreProductId === null || source.linkedStoreProductId === undefined
    ? null
    : Number(source.linkedStoreProductId);
  const linkedToCurrent = linkedId !== null && currentProductId != null && linkedId === Number(currentProductId);
  return {
    ...prefill,
    sourceRevision: sourceRevision(source, children),
    linkedStoreProductId: linkedId,
    linkedStoreProductArchived: Boolean(source.linkedStoreProductDeletedAt),
    available: linkedId === null || linkedToCurrent,
  };
}

export async function searchStoreSelectionProducts(
  pool: Pool,
  input: StoreSelectionSearchInput,
): Promise<StoreSelectionProductSearchPage> {
  await assertStore(pool, input.storeId);
  const search = String(input.search || "").trim().slice(0, 200);
  if (!search) return { items: [], total: 0, nextCursor: null };
  const cursor = Math.max(Math.floor(Number(input.cursor || 0)), 0);
  const limit = Math.min(Math.max(Number(input.limit || 100), 1), 100);
  const like = `%${search}%`;
  const matchSql = `
    sp.deletedAt IS NULL AND sp.parentProductId IS NULL
      AND (
        CAST(sp.id AS CHAR)=? OR COALESCE(sp.productId,'')=? OR COALESCE(sp.barcode,'')=? OR
        sp.productName LIKE ? OR COALESCE(sp.brandName,'') LIKE ? OR
        CAST(COALESCE(sp.skuVariants, JSON_ARRAY()) AS CHAR) LIKE ? OR
        EXISTS (
          SELECT 1 FROM selection_products child
           WHERE child.parentProductId=sp.id AND child.deletedAt IS NULL
             AND (COALESCE(child.productId,'') LIKE ? OR COALESCE(child.barcode,'') LIKE ? OR
                  COALESCE(child.skuName,'') LIKE ? OR child.productName LIKE ?)
        )
      )`;
  const matchParams = [search, search, search, like, like, like, like, like, like, like];
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM selection_products sp WHERE ${matchSql}`,
    matchParams,
  );
  const total = Number(countRows[0]?.total || 0);
  const [rows] = await pool.query<SelectionRow[]>(
    `SELECT sp.*, sc.name AS categoryName,
      linked.id AS linkedStoreProductId, linked.deletedAt AS linkedStoreProductDeletedAt
       FROM selection_products sp
       LEFT JOIN selection_categories sc ON sc.id=sp.categoryId
       LEFT JOIN store_products linked ON linked.id=(
         SELECT p.id FROM store_products p
          WHERE p.storeId=? AND p.selectionProductId=sp.id
          ORDER BY p.deletedAt IS NULL DESC, p.id ASC LIMIT 1
       )
      WHERE ${matchSql}
      ORDER BY
        CASE WHEN COALESCE(sp.productId,'')=? THEN 0 WHEN CAST(sp.id AS CHAR)=? THEN 1 ELSE 2 END,
        CASE WHEN linked.id IS NULL THEN 0 ELSE 1 END,
        sp.updatedAt DESC, sp.id DESC
      LIMIT ? OFFSET ?`,
    [input.storeId, ...matchParams, search, search, limit, cursor],
  );
  const ids = rows.map((row) => Number(row.id));
  const children = await loadChildren(pool, ids);
  const consumed = cursor + rows.length;
  return {
    items: rows.map((row) => publicOption(row, children.get(Number(row.id)) || [], input.currentProductId)),
    total,
    nextCursor: rows.length > 0 && consumed < total ? consumed : null,
  };
}

export async function getStoreSelectionProductOption(
  pool: Pool,
  input: { storeId: number; selectionProductId: number; currentProductId?: number | null },
): Promise<StoreSelectionProductOption> {
  await assertStore(pool, input.storeId);
  const [rows] = await pool.query<SelectionRow[]>(
    `SELECT sp.*, sc.name AS categoryName,
      linked.id AS linkedStoreProductId, linked.deletedAt AS linkedStoreProductDeletedAt
       FROM selection_products sp
       LEFT JOIN selection_categories sc ON sc.id=sp.categoryId
       LEFT JOIN store_products linked ON linked.id=(
         SELECT p.id FROM store_products p
          WHERE p.storeId=? AND p.selectionProductId=sp.id
          ORDER BY p.deletedAt IS NULL DESC, p.id ASC LIMIT 1
       )
      WHERE sp.id=? AND sp.deletedAt IS NULL AND sp.parentProductId IS NULL LIMIT 1`,
    [input.storeId, input.selectionProductId],
  );
  const source = rows[0];
  if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "选品中心商品不存在、已删除或属于子SKU" });
  const children = await loadChildren(pool, [input.selectionProductId]);
  return publicOption(source, children.get(input.selectionProductId) || [], input.currentProductId);
}

function normalizeNullable(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function sourceImageKey(storeId: number, productId: number, sourceId: number, index: number, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `selection-source/${sourceId}/store/${storeId}/product/${productId}/${index}-${hash}`;
}

function inferMimeType(url: string): string {
  const clean = url.split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function writeAudit(
  conn: PoolConnection,
  params: { storeId: number; productId: number; skuId?: number | null; action: string; before?: unknown; after?: unknown; actorId: number | null; actorName: string },
): Promise<void> {
  await conn.query(
    `INSERT INTO store_product_audit_logs
      (productId, skuId, storeId, action, beforeJson, afterJson, actorId, actorName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.productId, params.skuId ?? null, params.storeId, params.action,
      params.before === undefined ? null : JSON.stringify(params.before),
      params.after === undefined ? null : JSON.stringify(params.after),
      params.actorId, params.actorName.slice(0, 255)],
  );
}

async function acquireSourceLock(conn: PoolConnection, storeId: number, selectionProductId: number): Promise<string> {
  const lockName = `store_selection:${storeId}:${selectionProductId}`;
  const [rows] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
  if (Number(rows[0]?.acquired) !== 1) throw new TRPCError({ code: "CONFLICT", message: "该选品商品正在被其他操作关联，请稍后重试" });
  return lockName;
}

async function releaseSourceLock(conn: PoolConnection, lockName: string | null): Promise<void> {
  if (!lockName) return;
  await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
}

function validateProduct(input: StoreSelectionSaveProduct): void {
  if (!input.productName.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "请输入商品名" });
  if (input.basePrice !== null && (!Number.isFinite(input.basePrice) || input.basePrice < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "售价不能为负数" });
  if (!Number.isInteger(input.stock) || input.stock < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "库存必须为0以上整数" });
}

export async function saveStoreProductFromSelection(
  pool: Pool,
  input: SaveStoreProductFromSelectionInput,
): Promise<{ id: number; skuCount: number; skuIds: number[]; imageCount: number; created: boolean }> {
  validateProduct(input.product);
  const conn = await pool.getConnection();
  let lockName: string | null = null;
  try {
    lockName = await acquireSourceLock(conn, input.storeId, input.selectionProductId);
    await conn.beginTransaction();
    await assertStore(conn, input.storeId);
    const [sourceRows] = await conn.query<SelectionRow[]>(
      `SELECT sp.*, sc.name AS categoryName
         FROM selection_products sp
         LEFT JOIN selection_categories sc ON sc.id=sp.categoryId
        WHERE sp.id=? AND sp.deletedAt IS NULL AND sp.parentProductId IS NULL
        LIMIT 1 FOR UPDATE`,
      [input.selectionProductId],
    );
    const source = sourceRows[0];
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "选品中心商品不存在、已删除或属于子SKU" });
    const childMap = await loadChildren(conn, [input.selectionProductId], true);
    const children = childMap.get(input.selectionProductId) || [];
    const currentRevision = sourceRevision(source, children);
    if (currentRevision !== input.sourceRevision) {
      throw new TRPCError({ code: "CONFLICT", message: "选品中心商品已更新，请重新选择后再保存" });
    }

    const [linkedRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, deletedAt FROM store_products
        WHERE storeId=? AND selectionProductId=? AND (? IS NULL OR id<>?)
        ORDER BY id ASC FOR UPDATE`,
      [input.storeId, input.selectionProductId, input.productId ?? null, input.productId ?? null],
    );
    if (linkedRows.length > 0) {
      const archived = linkedRows.some((row) => row.deletedAt != null);
      throw new TRPCError({ code: "CONFLICT", message: archived ? "该选品商品已有归档店铺商品，请先恢复原记录" : "该选品商品已关联到本店铺其他商品" });
    }

    const p = input.product;
    let productId = input.productId ? Number(input.productId) : null;
    let before: RowDataPacket | null = null;
    if (productId) {
      const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM store_products WHERE id=? AND storeId=? LIMIT 1 FOR UPDATE", [productId, input.storeId]);
      before = rows[0] || null;
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "店铺商品不存在" });
      if (Number(before.selectionProductId || 0) > 0 && Number(before.selectionProductId) !== input.selectionProductId) {
        throw new TRPCError({ code: "CONFLICT", message: "该店铺商品已关联其他选品来源，请刷新后重试" });
      }
      await conn.query(
        `UPDATE store_products SET selectionProductId=?, selectionSourceRevision=?, selectionSyncedAt=CURRENT_TIMESTAMP,
          platformProductId=?, spuCode=?, productName=?, brandName=?, category=?, productUrl=?,
          basePrice=?, currency=?, stock=?, status=?, notes=?, updatedById=?, updatedByName=? WHERE id=?`,
        [input.selectionProductId, currentRevision, normalizeNullable(p.platformProductId), normalizeNullable(p.spuCode), p.productName.trim(),
          normalizeNullable(p.brandName), normalizeNullable(p.category), normalizeNullable(p.productUrl), p.basePrice, p.currency,
          p.stock, p.status, normalizeNullable(p.notes), input.actorId, input.actorName.slice(0, 255), productId],
      );
    } else {
      const [insert] = await conn.query<ResultSetHeader>(
        `INSERT INTO store_products
          (storeId, selectionProductId, selectionSourceRevision, selectionSyncedAt,
           platformProductId, spuCode, productName, brandName, category, productUrl,
           basePrice, currency, stock, status, notes, createdById, createdByName, updatedById, updatedByName)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.storeId, input.selectionProductId, currentRevision, normalizeNullable(p.platformProductId), normalizeNullable(p.spuCode), p.productName.trim(),
          normalizeNullable(p.brandName), normalizeNullable(p.category), normalizeNullable(p.productUrl), p.basePrice, p.currency,
          p.stock, p.status, normalizeNullable(p.notes), input.actorId, input.actorName.slice(0, 255), input.actorId, input.actorName.slice(0, 255)],
      );
      productId = Number(insert.insertId);
    }
    if (!Number.isInteger(productId) || productId <= 0) throw new Error("店铺商品保存失败：数据库未返回有效ID");

    const skuIds: number[] = [];
    for (const sku of input.skus) {
      if (!sku.variantName.trim()) continue;
      if (!Number.isInteger(sku.stock) || sku.stock < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `${sku.variantName}: 库存必须为0以上整数` });
      if (sku.salePrice !== null && (!Number.isFinite(sku.salePrice) || sku.salePrice < 0)) throw new TRPCError({ code: "BAD_REQUEST", message: `${sku.variantName}: 售价不能为负数` });
      let skuId = sku.id ? Number(sku.id) : null;
      if (skuId) {
        const [existing] = await conn.query<RowDataPacket[]>("SELECT id FROM store_product_skus WHERE id=? AND productId=? LIMIT 1 FOR UPDATE", [skuId, productId]);
        if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: `${sku.variantName}: SKU不存在` });
        await conn.query(
          `UPDATE store_product_skus SET platformSkuId=?, skuCode=?, barcode=?, variantName=?, imageUrl=?, imageKey=?, salePrice=?, stock=?, status=?, updatedById=?, updatedByName=? WHERE id=?`,
          [normalizeNullable(sku.platformSkuId), normalizeNullable(sku.skuCode), normalizeNullable(sku.barcode), sku.variantName.trim(),
            normalizeNullable(sku.imageUrl), normalizeNullable(sku.imageKey), sku.salePrice, sku.stock, sku.status,
            input.actorId, input.actorName.slice(0, 255), skuId],
        );
      } else {
        const [insert] = await conn.query<ResultSetHeader>(
          `INSERT INTO store_product_skus
            (productId, platformSkuId, skuCode, barcode, variantName, imageUrl, imageKey, salePrice, stock, status,
             createdById, createdByName, updatedById, updatedByName)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, normalizeNullable(sku.platformSkuId), normalizeNullable(sku.skuCode), normalizeNullable(sku.barcode), sku.variantName.trim(),
            normalizeNullable(sku.imageUrl), normalizeNullable(sku.imageKey), sku.salePrice, sku.stock, sku.status,
            input.actorId, input.actorName.slice(0, 255), input.actorId, input.actorName.slice(0, 255)],
        );
        skuId = Number(insert.insertId);
      }
      skuIds.push(skuId);
    }

    const prefill = selectionProductToStorePrefill(source, children);
    const [existingImageRows] = await conn.query<RowDataPacket[]>(
      "SELECT imageUrl FROM store_product_images WHERE productId=? AND deletedAt IS NULL FOR UPDATE",
      [productId],
    );
    const existingUrls = new Set(existingImageRows.map((row) => String(row.imageUrl || "").trim()).filter(Boolean));
    const availableSlots = Math.max(0, 8 - existingUrls.size);
    const sourceUrls = prefill.imageUrls.filter((url) => !existingUrls.has(url)).slice(0, availableSlots);
    let addedImages = 0;
    for (let index = 0; index < sourceUrls.length; index += 1) {
      const url = sourceUrls[index];
      const key = sourceImageKey(input.storeId, productId, input.selectionProductId, existingUrls.size + index, url);
      const isPrimary = existingUrls.size === 0 && index === 0;
      await conn.query(
        `INSERT INTO store_product_images (productId, skuId, imageUrl, imageKey, mimeType, fileSize, sortOrder, isPrimary, uploadedById, uploadedByName)
         VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [productId, url, key, inferMimeType(url), existingUrls.size + index, isPrimary ? 1 : 0, input.actorId, input.actorName.slice(0, 255)],
      );
      if (isPrimary) {
        await conn.query("UPDATE store_products SET mainImageUrl=?, mainImageKey=? WHERE id=?", [url, key, productId]);
      }
      addedImages += 1;
    }

    await writeAudit(conn, {
      storeId: input.storeId,
      productId,
      action: before ? "selection_product_linked" : "product_created_from_selection",
      before: before || undefined,
      after: { selectionProductId: input.selectionProductId, sourceRevision: currentRevision, skuCount: skuIds.length, sourceImageCount: addedImages },
      actorId: input.actorId,
      actorName: input.actorName,
    });
    await conn.commit();
    return { id: productId, skuCount: skuIds.length, skuIds, imageCount: addedImages, created: !before };
  } catch (error: any) {
    try { await conn.rollback(); } catch (rollbackError) { console.error("[saveStoreProductFromSelection] rollback failed", rollbackError); }
    if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "该店铺商品ID、SPU或SKU已存在，请检查重复关联" });
    throw error;
  } finally {
    await releaseSourceLock(conn, lockName);
    conn.release();
  }
}


function compactBrandIdentity(value: unknown): string {
  return normalizeStoreSelectionIdentity(value).replace(/[\s\-_/・･,，.。()（）[\]【】「」『』]+/g, "");
}

async function loadStoreBrandScope(pool: Pool, storeId: number): Promise<StoreBrandScope> {
  const [rows] = await pool.query<StoreBrandScope[]>(
    `SELECT ms.id, ms.name, ms.brandId, b.name AS brandName, b.nameJa AS brandNameJa, b.companyName
       FROM managed_stores ms
       LEFT JOIN brands b ON b.id=ms.brandId AND b.deletedAt IS NULL
      WHERE ms.id=? AND ms.isActive=1
      LIMIT 1`,
    [storeId],
  );
  const scope = rows[0];
  if (!scope) throw new TRPCError({ code: "NOT_FOUND", message: "店铺不存在或已停用" });
  return scope;
}

function storeBrandAliases(scope: StoreBrandScope): string[] {
  return [...new Set([scope.brandName, scope.brandNameJa, scope.companyName]
    .map(compactBrandIdentity)
    .filter(Boolean))];
}

function sourceNameKeys(source: SelectionRow): string[] {
  return [...new Set([source.productName, source.productNameCn]
    .map(normalizeStoreSelectionIdentity)
    .filter(Boolean))];
}

function existingProductIdentity(value: unknown): string {
  return normalizeStoreSelectionIdentity(value);
}

async function loadStoreSelectionBulkPlan(pool: Pool, storeId: number): Promise<{ scope: StoreBrandScope; plan: StoreSelectionBulkPlan }> {
  const scope = await loadStoreBrandScope(pool, storeId);
  const brandId = Number(scope.brandId || 0);
  const configuredBrandName = String(scope.brandNameJa || scope.brandName || scope.companyName || "").trim();
  if (!Number.isSafeInteger(brandId) || brandId <= 0 || !configuredBrandName) {
    return {
      scope,
      plan: {
        sources: [], sourceParentCount: 0, storeProductCount: 0, createCount: 0, refreshCount: 0,
        alreadySyncedCount: 0, archivedConflictCount: 0, existingConflictCount: 0, sourceConflictCount: 0,
        missingPositivePriceCount: 0, missingImageCount: 0, zeroStockCount: 0, withSkuCount: 0,
      },
    };
  }

  const aliases = storeBrandAliases(scope);
  const [sourceRows] = await pool.query<SelectionRow[]>(
    `SELECT sp.*, sc.name AS categoryName
       FROM selection_products sp
       LEFT JOIN selection_categories sc ON sc.id=sp.categoryId
      WHERE sp.deletedAt IS NULL AND sp.parentProductId IS NULL
        AND (sp.brandId=?${aliases.length > 0 ? ` OR (sp.brandId IS NULL AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(sp.brandName,''))), ' ', ''), '-', ''), '_', ''), '/', ''), '・', ''), '･', '') IN (${placeholders(aliases.length)}))` : ""})
      ORDER BY sp.id ASC`,
    [brandId, ...aliases],
  );
  const sourceIds = sourceRows.map((row) => Number(row.id));
  const childMap = await loadChildren(pool, sourceIds);
  const [existingRows] = await pool.query<ExistingStoreProduct[]>(
    `SELECT id, selectionProductId, selectionSourceRevision, productName, brandName, platformProductId, spuCode, deletedAt
       FROM store_products
      WHERE storeId=?
      ORDER BY deletedAt IS NULL DESC, id ASC`,
    [storeId],
  );

  const activeRows = existingRows.filter((row) => row.deletedAt == null);
  const mappedActive = new Map<number, ExistingStoreProduct[]>();
  const mappedArchived = new Map<number, ExistingStoreProduct[]>();
  for (const row of existingRows) {
    const sourceId = Number(row.selectionProductId || 0);
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0) continue;
    const target = row.deletedAt == null ? mappedActive : mappedArchived;
    const bucket = target.get(sourceId) || [];
    bucket.push(row);
    target.set(sourceId, bucket);
  }

  const activeByExternalId = new Map<string, ExistingStoreProduct[]>();
  const activeByName = new Map<string, ExistingStoreProduct[]>();
  const remember = (map: Map<string, ExistingStoreProduct[]>, key: string, row: ExistingStoreProduct) => {
    if (!key) return;
    const bucket = map.get(key) || [];
    if (!bucket.some((candidate) => Number(candidate.id) === Number(row.id))) bucket.push(row);
    map.set(key, bucket);
  };
  for (const row of activeRows) {
    if (Number(row.selectionProductId || 0) > 0) continue;
    for (const value of [row.platformProductId, row.spuCode]) remember(activeByExternalId, existingProductIdentity(value), row);
    remember(activeByName, existingProductIdentity(row.productName), row);
  }

  const sourceKeyCounts = new Map<string, number>();
  const sourceExternalIdCounts = new Map<string, number>();
  for (const source of sourceRows) {
    for (const key of sourceNameKeys(source)) sourceKeyCounts.set(key, (sourceKeyCounts.get(key) || 0) + 1);
    const externalId = existingProductIdentity(source.productId || source.barcode);
    if (externalId) sourceExternalIdCounts.set(externalId, (sourceExternalIdCounts.get(externalId) || 0) + 1);
  }

  const usedExistingIds = new Set<number>();
  const targets: StoreSelectionBulkPlan["sources"] = [];
  let alreadySyncedCount = 0;
  let archivedConflictCount = 0;
  let existingConflictCount = 0;
  let sourceConflictCount = 0;

  for (const source of sourceRows) {
    const sourceId = Number(source.id);
    const children = childMap.get(sourceId) || [];
    const revision = sourceRevision(source, children);
    const linked = mappedActive.get(sourceId) || [];
    if (linked.length > 1) {
      existingConflictCount += 1;
      continue;
    }
    if (linked.length === 1) {
      const existing = linked[0];
      usedExistingIds.add(Number(existing.id));
      if (String(existing.selectionSourceRevision || "") === revision) alreadySyncedCount += 1;
      else targets.push({ source, children, revision, existing });
      continue;
    }
    if ((mappedArchived.get(sourceId) || []).length > 0) {
      archivedConflictCount += 1;
      continue;
    }

    const externalId = existingProductIdentity(source.productId || source.barcode);
    if (externalId && (sourceExternalIdCounts.get(externalId) || 0) > 1) {
      sourceConflictCount += 1;
      continue;
    }
    const exactIdMatches = externalId
      ? (activeByExternalId.get(externalId) || []).filter((row) => !usedExistingIds.has(Number(row.id)))
      : [];
    if (exactIdMatches.length === 1) {
      const existing = exactIdMatches[0];
      usedExistingIds.add(Number(existing.id));
      targets.push({ source, children, revision, existing });
      continue;
    }
    if (exactIdMatches.length > 1) {
      existingConflictCount += 1;
      continue;
    }

    const nameKeys = sourceNameKeys(source);
    if (nameKeys.some((key) => (sourceKeyCounts.get(key) || 0) > 1)) {
      sourceConflictCount += 1;
      continue;
    }
    const nameMatches = nameKeys.flatMap((key) => activeByName.get(key) || [])
      .filter((row, index, rows) => rows.findIndex((candidate) => Number(candidate.id) === Number(row.id)) === index)
      .filter((row) => !usedExistingIds.has(Number(row.id)));
    const sourceBrand = compactBrandIdentity(source.brandName);
    const sameBrandMatches = sourceBrand
      ? nameMatches.filter((row) => compactBrandIdentity(row.brandName) === sourceBrand)
      : [];
    if (sameBrandMatches.length === 1) {
      const existing = sameBrandMatches[0];
      usedExistingIds.add(Number(existing.id));
      targets.push({ source, children, revision, existing });
      continue;
    }
    if (nameMatches.length > 0) {
      existingConflictCount += 1;
      continue;
    }
    targets.push({ source, children, revision, existing: null });
  }

  const prefills = targets.map(({ source, children }) => selectionProductToStorePrefill(source, children));
  return {
    scope,
    plan: {
      sources: targets,
      sourceParentCount: sourceRows.length,
      storeProductCount: activeRows.length,
      createCount: targets.filter((item) => item.existing === null).length,
      refreshCount: targets.filter((item) => item.existing !== null).length,
      alreadySyncedCount,
      archivedConflictCount,
      existingConflictCount,
      sourceConflictCount,
      missingPositivePriceCount: prefills.filter((item) => item.basePrice === null).length,
      missingImageCount: prefills.filter((item) => item.imageUrls.length === 0).length,
      zeroStockCount: prefills.filter((item) => item.stock === 0).length,
      withSkuCount: prefills.filter((item) => item.skus.length > 0).length,
    },
  };
}

function publicBulkPreview(scope: StoreBrandScope, plan: StoreSelectionBulkPlan): StoreSelectionBulkSyncPreview {
  const brandId = Number(scope.brandId || 0);
  const brandName = String(scope.brandNameJa || scope.brandName || scope.companyName || "").trim();
  return {
    storeId: Number(scope.id),
    storeName: String(scope.name),
    brandId: Number.isSafeInteger(brandId) && brandId > 0 ? brandId : null,
    brandName,
    brandConfigured: Number.isSafeInteger(brandId) && brandId > 0 && Boolean(brandName),
    sourceParentCount: plan.sourceParentCount,
    storeProductCount: plan.storeProductCount,
    createCount: plan.createCount,
    refreshCount: plan.refreshCount,
    alreadySyncedCount: plan.alreadySyncedCount,
    archivedConflictCount: plan.archivedConflictCount,
    existingConflictCount: plan.existingConflictCount,
    sourceConflictCount: plan.sourceConflictCount,
    missingPositivePriceCount: plan.missingPositivePriceCount,
    missingImageCount: plan.missingImageCount,
    zeroStockCount: plan.zeroStockCount,
    withSkuCount: plan.withSkuCount,
    ready: plan.createCount + plan.refreshCount,
  };
}

export async function previewStoreSelectionBulkSync(pool: Pool, storeId: number): Promise<StoreSelectionBulkSyncPreview> {
  const { scope, plan } = await loadStoreSelectionBulkPlan(pool, storeId);
  return publicBulkPreview(scope, plan);
}

async function loadExistingStoreProductForSafeRefresh(pool: Pool, productId: number) {
  const [[productRows], [skuRows]] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT * FROM store_products WHERE id=? AND deletedAt IS NULL LIMIT 1", [productId]),
    pool.query<RowDataPacket[]>("SELECT * FROM store_product_skus WHERE productId=? AND deletedAt IS NULL ORDER BY id", [productId]),
  ]);
  const product = productRows[0];
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "店铺商品不存在或已归档" });
  return { product, skus: skuRows };
}

function productValueOrSource(localValue: unknown, sourceValue: string): string | null {
  const local = String(localValue ?? "").trim();
  return local || normalizeNullable(sourceValue);
}

export async function processStoreSelectionBulkSyncBatch(
  pool: Pool,
  input: { storeId: number; limit?: number; actorId: number | null; actorName: string },
) {
  const limit = Math.min(Math.max(Number(input.limit || 10), 1), 20);
  const loaded = await loadStoreSelectionBulkPlan(pool, input.storeId);
  const configuredBrandName = String(loaded.scope.brandNameJa || loaded.scope.brandName || loaded.scope.companyName || "").trim();
  if (!loaded.scope.brandId || !configuredBrandName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请先在店铺资料中关联服务品牌，再同步选品中心商品" });
  }
  const targets = loaded.plan.sources.slice(0, limit);
  let created = 0;
  let refreshed = 0;
  let createdSkus = 0;
  let addedImages = 0;
  let skippedConcurrentConflict = 0;
  let failed = 0;
  const failureCodes: Record<string, number> = {};

  for (const target of targets) {
    const prefill = selectionProductToStorePrefill(target.source, target.children);
    try {
      let productId = target.existing ? Number(target.existing.id) : null;
      let product: StoreSelectionSaveProduct = {
        platformProductId: normalizeNullable(prefill.externalProductId),
        spuCode: null,
        productName: prefill.productName,
        brandName: normalizeNullable(prefill.brandName),
        category: normalizeNullable(prefill.category),
        productUrl: normalizeNullable(prefill.productUrl),
        basePrice: prefill.basePrice,
        currency: "JPY",
        stock: prefill.stock,
        status: "draft" as const,
        notes: normalizeNullable(prefill.notes),
      };
      let skus: StoreSelectionSaveSku[] = prefill.skus.map((sku) => ({ ...sku }));

      if (productId) {
        const current = await loadExistingStoreProductForSafeRefresh(pool, productId);
        product = {
          platformProductId: productValueOrSource(current.product.platformProductId, prefill.externalProductId),
          spuCode: normalizeNullable(current.product.spuCode),
          productName: String(current.product.productName || "").trim() || prefill.productName,
          brandName: productValueOrSource(current.product.brandName, prefill.brandName),
          category: productValueOrSource(current.product.category, prefill.category),
          productUrl: productValueOrSource(current.product.productUrl, prefill.productUrl),
          basePrice: current.product.basePrice === null || current.product.basePrice === undefined ? prefill.basePrice : Number(current.product.basePrice),
          currency: String(current.product.currency || "JPY"),
          stock: Number(current.product.stock || 0),
          status: current.product.status === "online" || current.product.status === "offline" ? current.product.status : "draft",
          notes: productValueOrSource(current.product.notes, prefill.notes),
        };
        skus = mergeStoreSelectionSkuPrefills(
          current.skus.map((sku): StoreSelectionSaveSku => ({
            id: Number(sku.id),
            platformSkuId: normalizeNullable(sku.platformSkuId),
            skuCode: normalizeNullable(sku.skuCode),
            barcode: normalizeNullable(sku.barcode),
            variantName: String(sku.variantName || "").trim(),
            salePrice: sku.salePrice === null ? null : Number(sku.salePrice),
            stock: Number(sku.stock || 0),
            status: sku.status === "inactive" ? "inactive" as const : "active" as const,
            imageUrl: normalizeNullable(sku.imageUrl),
            imageKey: normalizeNullable(sku.imageKey),
          })),
          prefill.skus,
          (sku) => ({ ...sku }),
        );
      }

      const result = await saveStoreProductFromSelection(pool, {
        storeId: input.storeId,
        productId,
        selectionProductId: Number(target.source.id),
        sourceRevision: target.revision,
        product,
        skus,
        actorId: input.actorId,
        actorName: input.actorName,
      });
      if (result.created) created += 1;
      else refreshed += 1;
      createdSkus += result.skuCount;
      addedImages += result.imageCount;
    } catch (error: any) {
      if (error instanceof TRPCError && error.code === "CONFLICT") {
        skippedConcurrentConflict += 1;
        continue;
      }
      failed += 1;
      const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,40}$/.test(error.code)
        ? error.code
        : "UNEXPECTED_SYNC_ERROR";
      failureCodes[code] = (failureCodes[code] || 0) + 1;
      console.error("[store-selection-bulk-sync] item failed", { code });
    }
  }

  const after = await previewStoreSelectionBulkSync(pool, input.storeId);
  const progressed = created + refreshed > 0;
  return {
    attempted: targets.length,
    created,
    refreshed,
    createdSkus,
    addedImages,
    skippedConcurrentConflict,
    failed,
    failureCodes,
    remaining: after.ready,
    done: after.ready === 0,
    haltedWithoutProgress: targets.length > 0 && !progressed,
    preview: after,
  };
}
