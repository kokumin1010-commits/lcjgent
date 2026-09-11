import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  normalizeStoreSelectionIdentity,
  selectionProductToStorePrefill,
  type StoreSelectionProductPrefill,
  type StoreSelectionSourceRecord,
} from "../shared/storeSelectionProductLink";

export type StoreSelectionSearchInput = {
  storeId: number;
  search: string;
  currentProductId?: number | null;
  limit?: number;
};

export type StoreSelectionProductOption = StoreSelectionProductPrefill & {
  sourceRevision: string;
  linkedStoreProductId: number | null;
  linkedStoreProductArchived: boolean;
  available: boolean;
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
): Promise<StoreSelectionProductOption[]> {
  await assertStore(pool, input.storeId);
  const search = String(input.search || "").trim().slice(0, 200);
  if (!search) return [];
  const limit = Math.min(Math.max(Number(input.limit || 20), 1), 30);
  const like = `%${search}%`;
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
      WHERE sp.deletedAt IS NULL AND sp.parentProductId IS NULL
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
        )
      ORDER BY
        CASE WHEN COALESCE(sp.productId,'')=? THEN 0 WHEN CAST(sp.id AS CHAR)=? THEN 1 ELSE 2 END,
        CASE WHEN linked.id IS NULL THEN 0 ELSE 1 END,
        sp.updatedAt DESC, sp.id DESC
      LIMIT ?`,
    [input.storeId, search, search, search, like, like, like, like, like, like, like, search, search, limit],
  );
  const ids = rows.map((row) => Number(row.id));
  const children = await loadChildren(pool, ids);
  return rows.map((row) => publicOption(row, children.get(Number(row.id)) || [], input.currentProductId));
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
      await conn.query(
        `UPDATE store_products SET selectionProductId=?, platformProductId=?, spuCode=?, productName=?, brandName=?, category=?, productUrl=?,
          basePrice=?, currency=?, stock=?, status=?, notes=?, updatedById=?, updatedByName=? WHERE id=?`,
        [input.selectionProductId, normalizeNullable(p.platformProductId), normalizeNullable(p.spuCode), p.productName.trim(),
          normalizeNullable(p.brandName), normalizeNullable(p.category), normalizeNullable(p.productUrl), p.basePrice, p.currency,
          p.stock, p.status, normalizeNullable(p.notes), input.actorId, input.actorName.slice(0, 255), productId],
      );
    } else {
      const [insert] = await conn.query<ResultSetHeader>(
        `INSERT INTO store_products
          (storeId, selectionProductId, platformProductId, spuCode, productName, brandName, category, productUrl,
           basePrice, currency, stock, status, notes, createdById, createdByName, updatedById, updatedByName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.storeId, input.selectionProductId, normalizeNullable(p.platformProductId), normalizeNullable(p.spuCode), p.productName.trim(),
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
