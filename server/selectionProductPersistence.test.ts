import { beforeEach, describe, expect, it, vi } from "vitest";
import type mysql from "mysql2/promise";
import {
  createSelectionProduct,
  resetSelectionProductSchemaEnsureForTests,
  updateSelectionProduct,
} from "./selectionProductPersistence";

function insertColumns(sql: string): string[] {
  const match = sql.match(/INSERT INTO selection_products \(([^)]+)\)/);
  if (!match) throw new Error(`Unexpected insert SQL: ${sql}`);
  return match[1].split(",").map((column) => column.trim());
}

function updateColumns(sql: string): string[] {
  const match = sql.match(/UPDATE selection_products SET (.+) WHERE id = \?/);
  if (!match) throw new Error(`Unexpected update SQL: ${sql}`);
  return match[1].split(",").map((assignment) => assignment.split("=")[0].trim());
}

function createFakePool(options: {
  existing?: boolean;
  insertAffectedRows?: number;
  updateAffectedRows?: number;
  failOnProductWrite?: boolean;
  failOnHistoryWrite?: boolean;
} = {}) {
  const state = {
    schemaQueries: [] as Array<{ sql: string; params?: unknown[] }>,
    transactionQueries: [] as Array<{ sql: string; params?: unknown[] }>,
  };
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      state.transactionQueries.push({ sql, params });
      if (sql.startsWith("SELECT id FROM selection_products")) {
        return [options.existing === false ? [] : [{ id: 7 }], []];
      }
      if (sql.startsWith("INSERT INTO selection_products")) {
        if (options.failOnProductWrite) throw new Error("simulated insert failure");
        return [{ insertId: 101, affectedRows: options.insertAffectedRows ?? 1 }, []];
      }
      if (sql.startsWith("UPDATE selection_products SET") && sql.includes("deletedAt IS NULL")) {
        if (options.failOnProductWrite) throw new Error("simulated update failure");
        return [{ affectedRows: options.updateAffectedRows ?? 1 }, []];
      }
      if (sql.startsWith("INSERT INTO selection_price_history") && options.failOnHistoryWrite) {
        throw new Error("simulated history failure");
      }
      if (sql.startsWith("SELECT MIN(price)")) return [[{ minPrice: "1200" }], []];
      if (sql.startsWith("SELECT MAX(discountRate)")) return [[{ maxDiscount: "25" }], []];
      return [{ affectedRows: 1 }, []];
    }),
  };
  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      state.schemaQueries.push({ sql, params });
      return [[], []];
    }),
    getConnection: vi.fn(async () => connection),
  };
  return { pool: pool as unknown as mysql.Pool, connection, state };
}

describe("selection product SKU persistence", () => {
  beforeEach(() => {
    resetSelectionProductSchemaEnsureForTests();
  });

  it("creates a new product with canonical tags and multiple SKU variants in one transaction", async () => {
    const { pool, connection, state } = createFakePool();
    const result = await createSelectionProduct(pool, {
      productName: "  新商品A  ",
      productNameCn: "  新商品中文名  ",
      brandName: "LCJ",
      tags: '["引流款", "引流款", " 福利款 "]',
      skuVariants: [
        { name: " 10個セット ", price: "17500", lowestPrice: "2826", discountRate: "65", promotionType: "1+1" },
        { name: "20個セット", price: 30000, lowestPrice: 5000, discountRate: 60 },
      ],
    }, 88);

    expect(result.id).toBe(101);
    expect(result.skuVariants).toEqual([
      { name: "10個セット", price: "17500", lowestPrice: "2826", discountRate: "65", promotionType: "1+1" },
      { name: "20個セット", price: "30000", lowestPrice: "5000", discountRate: "60" },
    ]);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();

    const insert = state.transactionQueries.find((entry) => entry.sql.startsWith("INSERT INTO selection_products"));
    expect(insert).toBeTruthy();
    const columns = insertColumns(insert!.sql);
    const values = Object.fromEntries(columns.map((column, index) => [column, insert!.params?.[index]]));
    expect(values.productName).toBe("新商品A");
    expect(values.productNameCn).toBe("新商品中文名");
    expect(values.commissionType).toBe("percentage");
    expect(values.stock).toBe(0);
    expect(values.talentExclusive).toBe(0);
    expect(values.selfOperated).toBe(0);
    expect(values.tags).toBe('["引流款","福利款"]');
    expect(values.skuVariants).toBe(JSON.stringify(result.skuVariants));
    expect(values.skuName).toBe("10個セット");
    expect(values.skuPrice).toBe("17500");
  });

  it("updates product and Chinese names together with legacy string tags and multiple SKUs", async () => {
    const { pool, connection, state } = createFakePool();
    const result = await updateSelectionProduct(pool, 7, {
      productName: "更新商品名",
      productNameCn: "更新中文名",
      tags: '["KG品牌款","爆品款"]',
      skuVariants: JSON.stringify([
        { name: "A套组", price: "1000" },
        { name: "B套组", price: "2000", lowestPrice: "1600", discountRate: "20" },
      ]),
    }, 88);

    expect(result.success).toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    const update = state.transactionQueries.find((entry) => entry.sql.startsWith("UPDATE selection_products SET") && entry.sql.includes("deletedAt IS NULL"));
    expect(update).toBeTruthy();
    const columns = updateColumns(update!.sql);
    const values = Object.fromEntries(columns.map((column, index) => [column, update!.params?.[index]]));
    expect(values.productName).toBe("更新商品名");
    expect(values.productNameCn).toBe("更新中文名");
    expect(values.tags).toBe('["KG品牌款","爆品款"]');
    expect(values.skuVariants).toBe('[{"name":"A套组","price":"1000"},{"name":"B套组","price":"2000","lowestPrice":"1600","discountRate":"20"}]');
    expect(values.skuName).toBe("A套组");
    expect(values.skuPrice).toBe("1000");
  });

  it("clears the final SKU and legacy SKU columns when an empty array is submitted", async () => {
    const { pool, state } = createFakePool();
    await updateSelectionProduct(pool, 7, { skuVariants: [] }, 88);

    const update = state.transactionQueries.find((entry) => entry.sql.startsWith("UPDATE selection_products SET") && entry.sql.includes("deletedAt IS NULL"));
    const columns = updateColumns(update!.sql);
    const values = Object.fromEntries(columns.map((column, index) => [column, update!.params?.[index]]));
    expect(values.skuVariants).toBe("[]");
    expect(values.skuName).toBeNull();
    expect(values.skuPrice).toBeNull();
    expect(values.skuLowestPrice).toBeNull();
    expect(values.skuDiscountRate).toBeNull();
  });

  it("ignores a completely blank added SKU row instead of blocking product save", async () => {
    const { pool } = createFakePool();
    const result = await createSelectionProduct(pool, {
      productName: "空白SKU行商品",
      brandName: "LCJ",
      skuVariants: [
        { name: "有效SKU", price: "1000" },
        { name: "", price: "", lowestPrice: "", discountRate: "", promotionType: "" },
      ],
    }, 88);
    expect(result.skuVariants).toEqual([{ name: "有效SKU", price: "1000" }]);
  });

  it.each([
    [{ name: "负数价格SKU", price: "-1" }, "0以上"],
    [{ name: "折扣越界SKU", discountRate: "101" }, "0〜100"],
    [{ name: "非数字SKU", lowestPrice: "not-a-number" }, "数値"],
  ])("rejects an invalid SKU numeric field before starting a transaction", async (variant, expectedMessage) => {
    const { pool, connection } = createFakePool();
    await expect(createSelectionProduct(pool, {
      productName: "非法SKU商品",
      brandName: "LCJ",
      skuVariants: [variant],
    }, 88)).rejects.toThrow(expectedMessage);
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate normalized SKU names before starting a transaction", async () => {
    const { pool, connection } = createFakePool();
    await expect(createSelectionProduct(pool, {
      productName: "重复SKU商品",
      brandName: "LCJ",
      skuVariants: [{ name: "Ａ 套组" }, { name: "a   套组" }],
    }, 88)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });

  it("rolls back a new product and its SKUs when history insertion fails", async () => {
    const { pool, connection } = createFakePool({ failOnHistoryWrite: true });
    await expect(createSelectionProduct(pool, {
      productName: "不应残留的商品",
      brandName: "LCJ",
      historicalLowestPrice: "1000",
      skuVariants: [{ name: "不应残留的SKU", price: "1500" }],
    }, 88)).rejects.toThrow("simulated history failure");
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rolls back when the product update fails", async () => {
    const { pool, connection } = createFakePool({ failOnProductWrite: true });
    await expect(updateSelectionProduct(pool, 7, {
      productName: "不应保存",
      skuVariants: [{ name: "SKU-A" }],
    }, 88)).rejects.toThrow("simulated update failure");
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rolls back and returns NOT_FOUND when no active product row is locked", async () => {
    const { pool, connection } = createFakePool({ existing: false });
    await expect(updateSelectionProduct(pool, 999, { productName: "不存在" }, 88)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rolls back when UPDATE affects zero rows", async () => {
    const { pool, connection } = createFakePool({ updateAffectedRows: 0 });
    await expect(updateSelectionProduct(pool, 7, { productName: "并发删除" }, 88)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
