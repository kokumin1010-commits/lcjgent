import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMallProductFromSelection,
  resetMallSelectionImportSchemaForTests,
} from "./mallSelectionProductImportService";

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    productName: "Source Product",
    productNameCn: "源商品",
    productId: "P-31",
    barcode: null,
    brandId: 7,
    brandName: "Brand",
    categoryId: 3,
    categoryName: "Category",
    price: "3980.00",
    stock: 2,
    images: JSON.stringify(["https://example.invalid/a.jpg"]),
    description: "Description",
    sellingPoints: "Selling point",
    commissionType: "percentage",
    commissionValue: "10.00",
    status: "online",
    skuVariants: JSON.stringify([{ name: "Small", skuCode: "SKU-S", price: "3900", stock: 2, status: "online" }]),
    skuName: "Small",
    skuPrice: "3900",
    skuLowestPrice: null,
    skuDiscountRate: null,
    promotionType: null,
    importedMallProductId: null,
    exactNameMallProductId: null,
    entityChildSkuCount: 1,
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    selectionProductId: 31,
    name: "Source Product",
    description: "Description",
    category: "Category",
    brandId: 7,
    categoryId: 8,
    subcategoryId: null,
    price: 3980,
    pointPrice: null,
    stock: 2,
    imageUrls: ["https://example.invalid/a.jpg"],
    imageKeys: [""],
    status: "draft" as const,
    sortOrder: 0,
    commissionRate: "10",
    ...overrides,
  };
}

function fakePool(connectionQuery: ReturnType<typeof vi.fn>) {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    query: connectionQuery,
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn().mockResolvedValue(connection),
  };
  return { pool: pool as any, connection };
}

beforeEach(() => resetMallSelectionImportSchemaForTests());

describe("createMallProductFromSelection", () => {
  it("creates the mall product and all source SKUs in one transaction", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[sourceRow()], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 701, affectedRows: 1 }, []])
      .mockResolvedValueOnce([[
        { id: 32, productName: "Large", productId: "SKU-L", price: "4200", stock: 4, status: "online" },
      ], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const { pool, connection } = fakePool(query);

    await expect(createMallProductFromSelection(pool, input())).resolves.toEqual({ id: 701, variantCount: 2 });
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();

    const productInsert = query.mock.calls[2];
    expect(productInsert[0]).toContain("INSERT INTO mall_products");
    expect(productInsert[1]).toContain(31);
    expect(productInsert[1]).toContain("draft");
    expect(query.mock.calls.filter((call) => String(call[0]).includes("INSERT INTO mall_product_variants"))).toHaveLength(2);
  });

  it("rolls back when the source product is already mapped", async () => {
    const query = vi.fn().mockResolvedValueOnce([[sourceRow({ importedMallProductId: 88 })], []]);
    const { pool, connection } = fakePool(query);

    await expect(createMallProductFromSelection(pool, input())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO mall_products"))).toBe(false);
  });

  it("rolls back when an existing mall product matches the source or edited name", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[sourceRow()], []])
      .mockResolvedValueOnce([[{ id: 99 }], []]);
    const { pool, connection } = fakePool(query);

    await expect(createMallProductFromSelection(pool, input({ name: "Edited Name" }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it("rolls back the product when any SKU insert fails", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[sourceRow()], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 702, affectedRows: 1 }, []])
      .mockResolvedValueOnce([[], []])
      .mockRejectedValueOnce(new Error("variant insert failed"));
    const { pool, connection } = fakePool(query);

    await expect(createMallProductFromSelection(pool, input())).rejects.toThrow("variant insert failed");
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rejects invalid mall prices before opening a transaction", async () => {
    const query = vi.fn();
    const { pool, connection } = fakePool(query);
    await expect(createMallProductFromSelection(pool, input({ price: 0 }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });
});
