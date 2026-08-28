import { beforeEach, describe, expect, it, vi } from "vitest";
import type mysql from "mysql2/promise";
import { resetSelectionProductSchemaEnsureForTests } from "./selectionProductPersistence";
import {
  deleteEmbeddedChildSku,
  removeEntityChildParent,
  updateEmbeddedChildSku,
  updateEntityChildSku,
} from "./selectionChildSkuPersistence";

type FakeOptions = {
  childRow?: Record<string, unknown> | null;
  parentRow?: Record<string, unknown> | null;
  updateAffectedRows?: number;
  failOnWrite?: boolean;
  failOnHistory?: boolean;
};

function createFakePool(options: FakeOptions = {}) {
  const state = {
    queries: [] as Array<{ sql: string; params?: unknown[] }>,
    parentRow: options.parentRow === undefined ? {
      id: 7,
      parentProductId: null,
      skuName: "10個セット",
      skuPrice: "1000",
      skuLowestPrice: "800",
      skuDiscountRate: "20",
      promotionType: "1+1",
      status: "online",
      skuVariants: JSON.stringify([
        { name: "10個セット", skuCode: "SET-10", price: "1000", lowestPrice: "800", discountRate: "20", promotionType: "1+1" },
        { name: "20個セット", skuCode: "SET-20", price: "1800", promotionType: "1+2" },
      ]),
    } : options.parentRow,
    childRow: options.childRow === undefined ? {
      id: 130,
      parentProductId: 2,
      productId: "kg-child-sku:f690c0c490bf7ebb",
      productName: "KYOGOKU ケラチンヘアマスクキャップ 5枚セット",
      skuName: "KG-KERATIN-MASK-5",
      barcode: null,
      price: null,
      stock: 0,
      status: "offline",
      promotionType: null,
      historicalLowestPrice: null,
      discountRate: null,
    } : options.childRow,
  };
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      state.queries.push({ sql, params });
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT id, parentProductId, productId")) {
        return [state.childRow ? [state.childRow] : [], []];
      }
      if (normalized.startsWith("SELECT id, parentProductId, skuName")) {
        return [state.parentRow ? [state.parentRow] : [], []];
      }
      if (normalized.startsWith("SELECT id, parentProductId FROM selection_products")) {
        return [state.childRow ? [state.childRow] : [], []];
      }
      if (normalized.startsWith("UPDATE selection_products SET productName")) {
        if (options.failOnWrite) throw new Error("simulated child write failure");
        return [{ affectedRows: options.updateAffectedRows ?? 1 }, []];
      }
      if (normalized.startsWith("UPDATE selection_products SET skuVariants")) {
        if (options.failOnWrite) throw new Error("simulated variant write failure");
        if (state.parentRow && params) {
          state.parentRow = {
            ...state.parentRow,
            skuVariants: params[0],
            skuName: params[1],
            skuPrice: params[2],
            skuLowestPrice: params[3],
            skuDiscountRate: params[4],
          };
        }
        return [{ affectedRows: options.updateAffectedRows ?? 1 }, []];
      }
      if (normalized.startsWith("UPDATE selection_products SET parentProductId = NULL")) {
        if (options.failOnWrite) throw new Error("simulated unlink failure");
        return [{ affectedRows: options.updateAffectedRows ?? 1 }, []];
      }
      if (normalized.startsWith("INSERT INTO selection_price_history")) {
        if (options.failOnHistory) throw new Error("simulated history failure");
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith("INSERT INTO selection_discount_history")) {
        if (options.failOnHistory) throw new Error("simulated history failure");
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith("SELECT LEAST(")) return [[{ minPrice: "700" }], []];
      if (normalized.startsWith("SELECT MAX(discountRate)")) return [[{ maxDiscount: "30" }], []];
      return [{ affectedRows: 1 }, []];
    }),
  };
  const pool = {
    query: vi.fn(async () => [[], []]),
    getConnection: vi.fn(async () => connection),
  };
  return { pool: pool as unknown as mysql.Pool, connection, state };
}

function variantWrite(state: { queries: Array<{ sql: string; params?: unknown[] }> }) {
  const write = state.queries.find((entry) => entry.sql.replace(/\s+/g, " ").includes("UPDATE selection_products SET skuVariants = ?"));
  if (!write) throw new Error("variant write missing");
  return JSON.parse(String(write.params?.[0] || "[]"));
}

describe("selection child SKU persistence", () => {
  beforeEach(() => resetSelectionProductSchemaEnsureForTests());

  it("updates an entity child SKU without changing its recovery source key or parent", async () => {
    const { pool, connection, state } = createFakePool();
    await updateEntityChildSku(pool, 130, 2, {
      name: "KYOGOKU ケラチンヘアマスクキャップ 5枚セット 改",
      skuCode: "KG-KERATIN-MASK-5-NEW",
      barcode: "4580000000001",
      price: "5000",
      lowestPrice: "3980",
      discountRate: "20",
      stock: 28,
      status: "online",
      promotionType: "1+1",
    }, 88);

    const write = state.queries.find((entry) => entry.sql.replace(/\s+/g, " ").startsWith("UPDATE selection_products SET productName"));
    expect(write?.sql).not.toContain("productId =");
    const setClause = String(write?.sql || "").replace(/\s+/g, " ").split(" WHERE ")[0];
    expect(setClause).not.toContain("parentProductId =");
    expect(write?.sql).toContain("WHERE id = ? AND parentProductId = ?");
    expect(write?.params?.slice(0, 12)).toEqual([
      "KYOGOKU ケラチンヘアマスクキャップ 5枚セット 改",
      "KG-KERATIN-MASK-5-NEW",
      "4580000000001",
      "5000",
      "5000",
      "3980",
      "3980",
      "20",
      "20",
      28,
      "online",
      "1+1",
    ]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  it("rolls back an entity child update when its parent changed", async () => {
    const { pool, connection } = createFakePool({ childRow: { id: 130, parentProductId: 99, productName: "child" } });
    await expect(updateEntityChildSku(pool, 130, 2, { name: "child" }, 88)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rolls back the entity row when price history insertion fails", async () => {
    const { pool, connection } = createFakePool({ failOnHistory: true });
    await expect(updateEntityChildSku(pool, 130, 2, { name: "child", lowestPrice: "1000" }, 88)).rejects.toThrow("simulated history failure");
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("backfills stable IDs and updates the same embedded SKU three times", async () => {
    const fixture = createFakePool();
    const first = await updateEmbeddedChildSku(fixture.pool, {
      parentId: 7,
      fallbackIndex: 0,
      expectedName: "10個セット",
      expectedSkuCode: "SET-10",
    }, {
      name: "10個セット",
      skuCode: "SET-10",
      price: "1100",
      lowestPrice: "850",
      discountRate: "23",
      stock: 12,
      status: "online",
      promotionType: "1+1",
    });
    expect(first.variant.variantId).toMatch(/^[0-9a-f-]{36}$/);

    const second = await updateEmbeddedChildSku(fixture.pool, {
      parentId: 7,
      variantId: first.variant.variantId,
    }, {
      name: "10個セット 第2版",
      skuCode: "SET-10",
      stock: 20,
      status: "draft",
    });
    const third = await updateEmbeddedChildSku(fixture.pool, {
      parentId: 7,
      variantId: second.variant.variantId,
    }, {
      name: "10個セット 第3版",
      skuCode: "SET-10-V3",
      promotionType: "1+4",
      stock: 28,
      status: "offline",
    });

    expect(second.variant.variantId).toBe(first.variant.variantId);
    expect(third.variant.variantId).toBe(first.variant.variantId);
    expect(third.variant).toMatchObject({ name: "10個セット 第3版", skuCode: "SET-10-V3", price: "1100", lowestPrice: "850", stock: 28, status: "offline", promotionType: "1+4" });
    const finalVariants = JSON.parse(String(fixture.state.parentRow?.skuVariants || "[]"));
    expect(finalVariants).toHaveLength(2);
    expect(finalVariants[1]).toMatchObject({ name: "20個セット", skuCode: "SET-20", promotionType: "1+2" });
  });

  it("rejects stale fallback identity instead of overwriting another embedded SKU", async () => {
    const { pool, connection } = createFakePool();
    await expect(updateEmbeddedChildSku(pool, {
      parentId: 7,
      fallbackIndex: 0,
      expectedName: "旧名称",
      expectedSkuCode: "SET-10",
    }, { name: "错误覆盖" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rejects duplicate SKU codes and rolls back", async () => {
    const { pool, connection } = createFakePool();
    await expect(updateEmbeddedChildSku(pool, {
      parentId: 7,
      fallbackIndex: 0,
      expectedName: "10個セット",
      expectedSkuCode: "SET-10",
    }, { name: "10個セット", skuCode: "set-20" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("deletes one embedded SKU while preserving the remaining SKU and stable identity", async () => {
    const { pool, connection, state } = createFakePool();
    await deleteEmbeddedChildSku(pool, {
      parentId: 7,
      fallbackIndex: 0,
      expectedName: "10個セット",
      expectedSkuCode: "SET-10",
    });
    const saved = variantWrite(state);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "20個セット", skuCode: "SET-20", promotionType: "1+2" });
    expect(saved[0].variantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  it("unlinks an entity child only when the expected parent still matches", async () => {
    const { pool, connection, state } = createFakePool();
    await removeEntityChildParent(pool, 130, 2);
    const write = state.queries.find((entry) => entry.sql.includes("SET parentProductId = NULL"));
    expect(write?.params).toEqual([130, 2]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  it("rolls back when an embedded variant update affects zero rows", async () => {
    const { pool, connection } = createFakePool({ updateAffectedRows: 0 });
    await expect(updateEmbeddedChildSku(pool, {
      parentId: 7,
      fallbackIndex: 0,
      expectedName: "10個セット",
      expectedSkuCode: "SET-10",
    }, { name: "10個セット" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
