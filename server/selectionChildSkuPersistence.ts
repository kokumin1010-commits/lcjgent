import { randomUUID } from "node:crypto";
import type mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  legacySelectionProductSkuVariant,
  normalizeSelectionProductSkuVariants,
  selectionProductSkuIdentity,
  SelectionProductValidationError,
  type SelectionProductSkuVariant,
} from "@shared/selectionProductPersistence";
import { ensureSelectionProductPersistenceSchema } from "./selectionProductPersistence";

export type ChildSkuPatch = {
  name: string;
  skuCode?: string | null;
  barcode?: string | null;
  price?: string | null;
  lowestPrice?: string | null;
  discountRate?: string | null;
  promotionType?: string | null;
  stock?: number | null;
  status?: "draft" | "online" | "offline" | null;
};

export type EmbeddedSkuTarget = {
  parentId: number;
  variantId?: string;
  fallbackIndex?: number;
  expectedName?: string;
  expectedSkuCode?: string | null;
};

type ProductSkuRow = {
  id: number;
  parentProductId: number | null;
  productId?: string | null;
  productName?: string | null;
  skuName?: string | null;
  skuPrice?: string | number | null;
  skuLowestPrice?: string | number | null;
  skuDiscountRate?: string | number | null;
  barcode?: string | null;
  price?: string | number | null;
  stock?: number | null;
  discountRate?: string | number | null;
  promotionType?: string | null;
  skuVariants?: unknown;
  status?: string | null;
  historicalLowestPrice?: string | number | null;
};

function toBadRequest(error: unknown): never {
  if (error instanceof SelectionProductValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

function optionalNumericText(value: string | number | null | undefined): string | null | undefined {
  return value === null || value === undefined ? value : String(value);
}

function normalizeBarcode(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const barcode = String(value).trim();
  if (barcode.length > 255) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "条码不能超过255字 / バーコードは255文字以内で入力してください" });
  }
  return barcode;
}

function withStableIds(variants: SelectionProductSkuVariant[]): SelectionProductSkuVariant[] {
  const ids = new Set<string>();
  return variants.map((variant) => {
    let variantId = variant.variantId;
    if (!variantId || ids.has(variantId)) variantId = randomUUID();
    ids.add(variantId);
    return { ...variant, variantId };
  });
}

function normalizePatch(patch: ChildSkuPatch, defaults?: Partial<SelectionProductSkuVariant>): SelectionProductSkuVariant {
  try {
    const [variant] = normalizeSelectionProductSkuVariants([{
      ...defaults,
      name: patch.name,
      skuCode: patch.skuCode,
      price: patch.price,
      lowestPrice: patch.lowestPrice,
      discountRate: patch.discountRate,
      promotionType: patch.promotionType,
      stock: patch.stock,
      status: patch.status,
    }]);
    if (!variant) {
      throw new SelectionProductValidationError("请输入SKU名称 / SKU名称を入力してください");
    }
    return variant;
  } catch (error) {
    return toBadRequest(error);
  }
}

function locateEmbeddedVariant(variants: SelectionProductSkuVariant[], target: EmbeddedSkuTarget): number {
  if (target.variantId) {
    const index = variants.findIndex((variant) => variant.variantId === target.variantId);
    if (index >= 0) return index;
    throw new TRPCError({ code: "CONFLICT", message: "SKU已被其他人修改，请刷新后重试 / SKUが更新されています。再読み込みしてください" });
  }

  const index = target.fallbackIndex;
  if (!Number.isInteger(index) || Number(index) < 0 || Number(index) >= variants.length) {
    throw new TRPCError({ code: "CONFLICT", message: "SKU位置已变化，请刷新后重试 / SKUの位置が変更されています。再読み込みしてください" });
  }
  const current = variants[Number(index)];
  const expectedName = selectionProductSkuIdentity(String(target.expectedName || ""));
  const currentName = selectionProductSkuIdentity(current.name);
  const expectedCode = selectionProductSkuIdentity(String(target.expectedSkuCode || ""));
  const currentCode = selectionProductSkuIdentity(String(current.skuCode || ""));
  if (!expectedName || expectedName !== currentName || expectedCode !== currentCode) {
    throw new TRPCError({ code: "CONFLICT", message: "SKU已被其他人修改，请刷新后重试 / SKUが更新されています。再読み込みしてください" });
  }
  return Number(index);
}

function normalizeVariantsOrBadRequest(value: unknown): SelectionProductSkuVariant[] {
  try {
    return normalizeSelectionProductSkuVariants(value);
  } catch (error) {
    return toBadRequest(error);
  }
}

function parseStoredVariants(row: ProductSkuRow): SelectionProductSkuVariant[] {
  const variants = normalizeVariantsOrBadRequest(row.skuVariants);
  if (variants.length > 0) return variants;
  try {
    return legacySelectionProductSkuVariant(row as Record<string, unknown>);
  } catch (error) {
    return toBadRequest(error);
  }
}

async function updateParentVariantJson(
  connection: mysql.PoolConnection,
  parentId: number,
  variants: SelectionProductSkuVariant[],
): Promise<void> {
  const first = variants[0];
  const [result] = await connection.query(
    `UPDATE selection_products
       SET skuVariants = ?, skuName = ?, skuPrice = ?, skuLowestPrice = ?, skuDiscountRate = ?
     WHERE id = ? AND parentProductId IS NULL AND deletedAt IS NULL`,
    [
      JSON.stringify(variants),
      first?.name ?? null,
      first?.price ?? null,
      first?.lowestPrice ?? null,
      first?.discountRate ?? null,
      parentId,
    ],
  ) as [mysql.ResultSetHeader, unknown];
  if (result.affectedRows !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "父商品不存在或已删除 / 親商品が存在しないか削除済みです" });
  }
}

export async function updateEntityChildSku(
  pool: mysql.Pool,
  childId: number,
  expectedParentId: number,
  patch: ChildSkuPatch,
  updatedBy: number,
): Promise<{ success: true; childId: number }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, parentProductId, productId, productName, skuName, barcode, price, stock, status,
              promotionType, historicalLowestPrice, discountRate
         FROM selection_products
        WHERE id = ? AND deletedAt IS NULL
        LIMIT 1 FOR UPDATE`,
      [childId],
    ) as [ProductSkuRow[], unknown];
    const current = rows[0];
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "子SKU不存在或已删除 / 子SKUが存在しないか削除済みです" });
    }
    if (!current.parentProductId || Number(current.parentProductId) !== expectedParentId) {
      throw new TRPCError({ code: "CONFLICT", message: "子SKU的父商品已变化，请刷新后重试 / 子SKUの親商品が変更されています" });
    }
    const variant = normalizePatch({
      name: patch.name || String(current.productName || ""),
      skuCode: patch.skuCode !== undefined ? patch.skuCode : current.skuName,
      price: patch.price !== undefined ? patch.price : optionalNumericText(current.price),
      lowestPrice: patch.lowestPrice !== undefined ? patch.lowestPrice : optionalNumericText(current.historicalLowestPrice),
      discountRate: patch.discountRate !== undefined ? patch.discountRate : optionalNumericText(current.discountRate),
      promotionType: patch.promotionType !== undefined ? patch.promotionType : current.promotionType,
      stock: patch.stock !== undefined ? patch.stock : (current.stock ?? 0),
      status: patch.status !== undefined ? patch.status : ((current.status === "online" || current.status === "draft") ? current.status : "offline"),
    });
    const barcode = normalizeBarcode(patch.barcode !== undefined ? patch.barcode : current.barcode);

    const [result] = await connection.query(
      `UPDATE selection_products
          SET productName = ?, skuName = ?, barcode = ?, price = ?, skuPrice = ?,
              historicalLowestPrice = ?, skuLowestPrice = ?, discountRate = ?, skuDiscountRate = ?,
              stock = ?, status = ?, promotionType = ?
        WHERE id = ? AND parentProductId = ? AND deletedAt IS NULL`,
      [
        variant.name,
        variant.skuCode ?? null,
        barcode,
        variant.price ?? null,
        variant.price ?? null,
        variant.lowestPrice ?? null,
        variant.lowestPrice ?? null,
        variant.discountRate ?? null,
        variant.discountRate ?? null,
        variant.stock ?? 0,
        variant.status ?? "offline",
        variant.promotionType ?? null,
        childId,
        expectedParentId,
      ],
    ) as [mysql.ResultSetHeader, unknown];
    if (result.affectedRows !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "子SKU更新冲突，请刷新后重试 / 子SKUの更新が競合しました" });
    }

    if (variant.lowestPrice !== undefined && Number(variant.lowestPrice) > 0) {
      await connection.query(
        "INSERT INTO selection_price_history (productId, price, source, note, createdBy) VALUES (?, ?, 'manual', ?, ?)",
        [childId, Number(variant.lowestPrice), "子SKU手動更新", updatedBy],
      );
      const [minRows] = await connection.query(
        `SELECT LEAST(
            COALESCE(MIN(price), 999999999999),
            COALESCE(?, 999999999999)
          ) AS minPrice
         FROM selection_price_history WHERE productId = ?`,
        [current.historicalLowestPrice, childId],
      ) as [Array<{ minPrice: string | number | null }>, unknown];
      const minPrice = minRows[0]?.minPrice;
      if (minPrice !== null && minPrice !== undefined && Number(minPrice) < 999999999999) {
        await connection.query("UPDATE selection_products SET historicalLowestPrice = ? WHERE id = ?", [minPrice, childId]);
      }
    }

    if (variant.discountRate !== undefined && Number(variant.discountRate) > 0) {
      await connection.query(
        "INSERT INTO selection_discount_history (productId, discountRate, source, note, createdBy) VALUES (?, ?, 'manual', ?, ?)",
        [childId, Number(variant.discountRate), "子SKU手動更新", updatedBy],
      );
      const [maxRows] = await connection.query(
        "SELECT MAX(discountRate) AS maxDiscount FROM selection_discount_history WHERE productId = ?",
        [childId],
      ) as [Array<{ maxDiscount: string | number | null }>, unknown];
      if (maxRows[0]?.maxDiscount !== null && maxRows[0]?.maxDiscount !== undefined) {
        await connection.query("UPDATE selection_products SET discountRate = ? WHERE id = ?", [maxRows[0].maxDiscount, childId]);
      }
    }

    await connection.commit();
    return { success: true, childId };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[updateEntityChildSku] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateEmbeddedChildSku(
  pool: mysql.Pool,
  target: EmbeddedSkuTarget,
  patch: ChildSkuPatch,
): Promise<{ success: true; variant: SelectionProductSkuVariant }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, parentProductId, skuName, skuPrice, skuLowestPrice, skuDiscountRate,
              promotionType, skuVariants, status
         FROM selection_products
        WHERE id = ? AND parentProductId IS NULL AND deletedAt IS NULL
        LIMIT 1 FOR UPDATE`,
      [target.parentId],
    ) as [ProductSkuRow[], unknown];
    const parent = rows[0];
    if (!parent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "父商品不存在或已删除 / 親商品が存在しないか削除済みです" });
    }
    const variants = withStableIds(parseStoredVariants(parent));
    const index = locateEmbeddedVariant(variants, target);
    const current = variants[index];
    const updated = normalizePatch({
      name: patch.name || current.name,
      skuCode: patch.skuCode !== undefined ? patch.skuCode : current.skuCode,
      price: patch.price !== undefined ? patch.price : current.price,
      lowestPrice: patch.lowestPrice !== undefined ? patch.lowestPrice : current.lowestPrice,
      discountRate: patch.discountRate !== undefined ? patch.discountRate : current.discountRate,
      promotionType: patch.promotionType !== undefined ? patch.promotionType : current.promotionType,
      stock: patch.stock !== undefined ? patch.stock : (current.stock ?? 0),
      status: patch.status !== undefined ? patch.status : (current.status ?? (parent.status === "online" || parent.status === "draft" ? parent.status : "offline")),
    }, { variantId: current.variantId });
    const normalized = withStableIds(normalizeVariantsOrBadRequest(
      variants.map((variant, variantIndex) => variantIndex === index ? { ...updated, variantId: current.variantId } : variant),
    ));
    await updateParentVariantJson(connection, target.parentId, normalized);
    await connection.commit();
    return { success: true, variant: normalized[index] };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[updateEmbeddedChildSku] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteEmbeddedChildSku(
  pool: mysql.Pool,
  target: EmbeddedSkuTarget,
): Promise<{ success: true }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, parentProductId, skuName, skuPrice, skuLowestPrice, skuDiscountRate,
              promotionType, skuVariants, status
         FROM selection_products
        WHERE id = ? AND parentProductId IS NULL AND deletedAt IS NULL
        LIMIT 1 FOR UPDATE`,
      [target.parentId],
    ) as [ProductSkuRow[], unknown];
    const parent = rows[0];
    if (!parent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "父商品不存在或已删除 / 親商品が存在しないか削除済みです" });
    }
    const variants = withStableIds(parseStoredVariants(parent));
    const index = locateEmbeddedVariant(variants, target);
    variants.splice(index, 1);
    await updateParentVariantJson(connection, target.parentId, variants);
    await connection.commit();
    return { success: true };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[deleteEmbeddedChildSku] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeEntityChildParent(pool: mysql.Pool, childId: number, expectedParentId: number): Promise<{ success: true }> {
  await ensureSelectionProductPersistenceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT id, parentProductId FROM selection_products WHERE id = ? AND deletedAt IS NULL LIMIT 1 FOR UPDATE",
      [childId],
    ) as [ProductSkuRow[], unknown];
    const child = rows[0];
    if (!child) throw new TRPCError({ code: "NOT_FOUND", message: "子SKU不存在或已删除 / 子SKUが存在しないか削除済みです" });
    if (Number(child.parentProductId) !== expectedParentId) {
      throw new TRPCError({ code: "CONFLICT", message: "子SKU的父商品已变化，请刷新后重试 / 子SKUの親商品が変更されています" });
    }
    const [result] = await connection.query(
      "UPDATE selection_products SET parentProductId = NULL WHERE id = ? AND parentProductId = ? AND deletedAt IS NULL",
      [childId, expectedParentId],
    ) as [mysql.ResultSetHeader, unknown];
    if (result.affectedRows !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "解除父级失败，请刷新后重试 / 親設定の解除が競合しました" });
    }
    await connection.commit();
    return { success: true };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[removeEntityChildParent] rollback failed", rollbackError); }
    throw error;
  } finally {
    connection.release();
  }
}
