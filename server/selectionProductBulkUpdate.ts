import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type mysql from "mysql2/promise";
import { ensureSelectionProductPersistenceSchema } from "./selectionProductPersistence";

export const MAX_SELECTION_PRODUCT_BULK_UPDATE = 2_000;

export function hasAtMostTwoDecimalPlaces(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

export function resolveHistoricalMinimum(...values: Array<string | number | null | undefined>): number | null {
  const valid = values.map(value => Number(value)).filter(value => Number.isFinite(value) && value > 0);
  return valid.length > 0 ? Math.min(...valid) : null;
}

export type SelectionProductBulkPatch = {
  price?: number;
  marketPrice?: number;
  historicalLowestPrice?: number;
  stock?: number;
  commission?: {
    type: "percentage" | "fixed";
    value: number;
  };
  status?: "draft" | "online" | "offline";
};

type ProductSnapshot = {
  id: number;
  price: string | number | null;
  marketPrice: string | number | null;
  historicalLowestPrice: string | number | null;
  stock: number | null;
  commissionType: "percentage" | "fixed" | null;
  commissionValue: string | number | null;
  status: "draft" | "online" | "offline";
};

function isDuplicateRequest(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
    const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
    const errno = typeof candidate.errno === "number" ? candidate.errno : null;
    const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
    if (code === "ER_DUP_ENTRY" || errno === 1062 || message.includes("duplicate entry")) return true;
    current = candidate.cause;
  }
  return false;
}

function canonicalPayload(productIds: number[], patch: SelectionProductBulkPatch): string {
  return JSON.stringify({
    productIds: [...productIds].sort((a, b) => a - b),
    patch: {
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.marketPrice !== undefined ? { marketPrice: patch.marketPrice } : {}),
      ...(patch.historicalLowestPrice !== undefined ? { historicalLowestPrice: patch.historicalLowestPrice } : {}),
      ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
      ...(patch.commission !== undefined ? { commission: patch.commission } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    },
  });
}

function assertBulkPatch(patch: SelectionProductBulkPatch): void {
  if (Object.keys(patch).length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "至少选择一个要更新的字段 / 更新項目を1つ以上選択してください" });
  }
  const assertMoney = (value: number | undefined, label: string) => {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0 || value > 99_999_999.99 || !hasAtMostTwoDecimalPlaces(value))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${label}必须大于0、不超过99,999,999.99且最多两位小数` });
    }
  };
  assertMoney(patch.price, "价格");
  assertMoney(patch.marketPrice, "市场价");
  assertMoney(patch.historicalLowestPrice, "历史最低价");
  if (patch.stock !== undefined && (!Number.isInteger(patch.stock) || patch.stock < 0 || patch.stock > 2_147_483_647)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "库存必须是0以上的整数 / 在庫は0以上の整数で入力してください" });
  }
  if (patch.commission) {
    const max = patch.commission.type === "percentage" ? 100 : 99_999_999.99;
    if (!Number.isFinite(patch.commission.value) || patch.commission.value < 0 || patch.commission.value > max
      || !hasAtMostTwoDecimalPlaces(patch.commission.value)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: patch.commission.type === "percentage" ? "佣金比例必须在0到100之间" : "固定佣金超出允许范围" });
    }
  }
}

function selectSnapshotSql(productIds: number[]): string {
  return `SELECT id, price, marketPrice, historicalLowestPrice, stock, commissionType, commissionValue, status
    FROM selection_products
    WHERE id IN (${productIds.map(() => "?").join(",")}) AND deletedAt IS NULL AND parentProductId IS NULL
    ORDER BY id`;
}

async function loadCompletedRequest(
  pool: mysql.Pool,
  requestId: string,
  inputHash: string,
  actorUserId: number,
): Promise<{ success: true; affectedCount: number; idempotent: true } | null> {
  const [rows] = await pool.query(
    "SELECT actorUserId, inputHash, productCount FROM selection_product_bulk_updates WHERE requestId = ? LIMIT 1",
    [requestId],
  ) as [Array<{ actorUserId: number; inputHash: string; productCount: number }>, unknown];
  if (rows.length === 0) return null;
  if (Number(rows[0].actorUserId) !== actorUserId || rows[0].inputHash !== inputHash) {
    throw new TRPCError({ code: "CONFLICT", message: "相同请求编号不能用于不同的批量更新内容" });
  }
  return { success: true, affectedCount: Number(rows[0].productCount), idempotent: true };
}

export async function bulkUpdateSelectionProducts(
  pool: mysql.Pool,
  input: {
    requestId: string;
    productIds: number[];
    patch: SelectionProductBulkPatch;
  },
  actorUserId: number,
): Promise<{ success: true; affectedCount: number; idempotent: boolean }> {
  const productIds = [...new Set(input.productIds)].sort((a, b) => a - b);
  if (productIds.length !== input.productIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "商品ID重复，请重新选择 / 商品IDが重複しています" });
  }
  if (productIds.length === 0 || productIds.length > MAX_SELECTION_PRODUCT_BULK_UPDATE) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `一次可更新1到${MAX_SELECTION_PRODUCT_BULK_UPDATE}件商品` });
  }
  assertBulkPatch(input.patch);
  await ensureSelectionProductPersistenceSchema(pool);

  const canonical = canonicalPayload(productIds, input.patch);
  const inputHash = createHash("sha256").update(canonical).digest("hex");
  const completed = await loadCompletedRequest(pool, input.requestId, inputHash, actorUserId);
  if (completed) return completed;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO selection_product_bulk_updates
        (requestId, actorUserId, inputHash, productCount, patchJson, beforeState, afterState)
       VALUES (?, ?, ?, ?, ?, JSON_ARRAY(), JSON_ARRAY())`,
      [input.requestId, actorUserId, inputHash, productIds.length, JSON.stringify(input.patch)],
    );

    const [beforeRows] = await connection.query(
      `${selectSnapshotSql(productIds)} FOR UPDATE`,
      productIds,
    ) as [ProductSnapshot[], unknown];
    if (beforeRows.length !== productIds.length) {
      const found = new Set(beforeRows.map(row => Number(row.id)));
      const missing = productIds.filter(id => !found.has(id));
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `商品不存在或已删除，批量更新未执行：${missing.slice(0, 10).join(", ")}`,
      });
    }

    const effectivePrice = input.patch.price;
    if (input.patch.historicalLowestPrice !== undefined) {
      const invalid = beforeRows.find(row => {
        const price = effectivePrice ?? Number(row.price || 0);
        return price > 0 && input.patch.historicalLowestPrice! > price;
      });
      if (invalid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `历史最低价不能高于当前价格（商品ID: ${invalid.id}）`,
        });
      }
    }

    const assignments: string[] = [];
    const updateParams: Array<string | number> = [];
    if (input.patch.price !== undefined) { assignments.push("price = ?"); updateParams.push(input.patch.price); }
    if (input.patch.marketPrice !== undefined) { assignments.push("marketPrice = ?"); updateParams.push(input.patch.marketPrice); }
    if (input.patch.stock !== undefined) { assignments.push("stock = ?"); updateParams.push(input.patch.stock); }
    if (input.patch.commission !== undefined) {
      assignments.push("commissionType = ?", "commissionValue = ?");
      updateParams.push(input.patch.commission.type, input.patch.commission.value);
    }
    if (input.patch.status !== undefined) { assignments.push("status = ?"); updateParams.push(input.patch.status); }
    if (assignments.length > 0) {
      await connection.query(
        `UPDATE selection_products SET ${assignments.join(", ")}, updatedAt = CURRENT_TIMESTAMP
         WHERE id IN (${productIds.map(() => "?").join(",")}) AND deletedAt IS NULL`,
        [...updateParams, ...productIds],
      );
    }

    if (input.patch.historicalLowestPrice !== undefined || input.patch.price !== undefined) {
      await connection.query(
        `INSERT INTO selection_price_history (productId, price, source, note, createdBy)
         SELECT sp.id, sp.historicalLowestPrice, 'legacy_snapshot', ?, ?
         FROM selection_products sp
         WHERE sp.id IN (${productIds.map(() => "?").join(",")})
           AND sp.historicalLowestPrice IS NOT NULL AND sp.historicalLowestPrice > 0
           AND NOT EXISTS (
             SELECT 1 FROM selection_price_history existing
             WHERE existing.productId = sp.id AND existing.archivedAt IS NULL
               AND existing.price = sp.historicalLowestPrice
           )`,
        [`批量更新前的既存最低价 request:${input.requestId}`, actorUserId, ...productIds],
      );
      const newHistoryRows = productIds.flatMap(productId => {
        const rows: Array<[number, number, string, string, number]> = [];
        if (input.patch.price !== undefined) {
          rows.push([productId, input.patch.price, "bulk_price", `批量价格更新 request:${input.requestId}`, actorUserId]);
        }
        if (input.patch.historicalLowestPrice !== undefined && input.patch.historicalLowestPrice !== input.patch.price) {
          rows.push([productId, input.patch.historicalLowestPrice, "bulk_manual", `批量最低价更新 request:${input.requestId}`, actorUserId]);
        }
        return rows;
      });
      if (newHistoryRows.length > 0) {
        await connection.query(
          `INSERT INTO selection_price_history (productId, price, source, note, createdBy)
           VALUES ${newHistoryRows.map(() => "(?, ?, ?, ?, ?)").join(",")}`,
          newHistoryRows.flat(),
        );
      }
      const [historyMinimumRows] = await connection.query(
        `SELECT productId, MIN(price) AS minPrice
         FROM selection_price_history
         WHERE productId IN (${productIds.map(() => "?").join(",")}) AND archivedAt IS NULL
         GROUP BY productId`,
        productIds,
      ) as [Array<{ productId: number; minPrice: string | number | null }>, unknown];
      const historyMinimumByProduct = new Map(historyMinimumRows.map(row => [Number(row.productId), row.minPrice]));
      const minimums = beforeRows.map(row => ({
        productId: Number(row.id),
        price: resolveHistoricalMinimum(
          row.historicalLowestPrice,
          historyMinimumByProduct.get(Number(row.id)),
          input.patch.historicalLowestPrice,
          input.patch.price,
        ),
      }));
      await connection.query(
        `UPDATE selection_products
         SET historicalLowestPrice = CASE id ${minimums.map(() => "WHEN ? THEN ?").join(" ")} ELSE historicalLowestPrice END,
             updatedAt = CURRENT_TIMESTAMP
         WHERE id IN (${productIds.map(() => "?").join(",")}) AND deletedAt IS NULL`,
        [...minimums.flatMap(item => [item.productId, item.price!]), ...productIds],
      );
    }

    const [afterRows] = await connection.query(selectSnapshotSql(productIds), productIds) as [ProductSnapshot[], unknown];
    await connection.query(
      `UPDATE selection_product_bulk_updates
       SET beforeState = ?, afterState = ?
       WHERE requestId = ?`,
      [JSON.stringify(beforeRows), JSON.stringify(afterRows), input.requestId],
    );
    await connection.commit();
    return { success: true, affectedCount: productIds.length, idempotent: false };
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error("[bulkUpdateSelectionProducts] rollback failed", rollbackError); }
    if (isDuplicateRequest(error)) {
      const replay = await loadCompletedRequest(pool, input.requestId, inputHash, actorUserId);
      if (replay) return replay;
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function listSelectionProductIds(
  pool: mysql.Pool,
  filters: { search?: string; status?: "draft" | "online" | "offline"; brandName?: string },
): Promise<number[]> {
  await ensureSelectionProductPersistenceSchema(pool);
  let where = "WHERE sp.deletedAt IS NULL AND sp.parentProductId IS NULL";
  const params: Array<string> = [];
  if (filters.status) { where += " AND sp.status = ?"; params.push(filters.status); }
  if (filters.brandName) { where += " AND sp.brandName = ?"; params.push(filters.brandName); }
  if (filters.search?.trim()) {
    const search = `%${filters.search.trim().toLowerCase()}%`;
    where += ` AND (
      LOWER(sp.productName) LIKE ? OR LOWER(COALESCE(sp.productNameCn, '')) LIKE ?
      OR LOWER(COALESCE(sp.productId, '')) LIKE ? OR LOWER(COALESCE(sp.barcode, '')) LIKE ?
      OR LOWER(COALESCE(sp.brandName, '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM selection_products child
        WHERE child.parentProductId = sp.id AND child.deletedAt IS NULL
          AND (LOWER(child.productName) LIKE ? OR LOWER(COALESCE(child.skuName, '')) LIKE ? OR LOWER(COALESCE(child.barcode, '')) LIKE ?)
      )
    )`;
    params.push(search, search, search, search, search, search, search, search);
  }
  const [rows] = await pool.query(
    `SELECT sp.id FROM selection_products sp ${where} ORDER BY sp.id ASC LIMIT ${MAX_SELECTION_PRODUCT_BULK_UPDATE + 1}`,
    params,
  ) as [Array<{ id: number }>, unknown];
  if (rows.length > MAX_SELECTION_PRODUCT_BULK_UPDATE) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `筛选结果超过${MAX_SELECTION_PRODUCT_BULK_UPDATE}件，请缩小筛选范围` });
  }
  return rows.map(row => Number(row.id));
}
