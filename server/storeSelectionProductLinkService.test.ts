import { describe, expect, it, vi } from "vitest";
import {
  saveStoreProductFromSelection,
  searchStoreSelectionProducts,
} from "./storeSelectionProductLinkService";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    productName: "Source Product",
    productNameCn: "源商品",
    productId: "EXT-31",
    barcode: "BAR-31",
    brandName: "Brand",
    categoryName: "Category",
    categoryId: 4,
    productLink: "https://example.invalid/product",
    price: "4280",
    stock: 5,
    images: JSON.stringify(["https://example.invalid/a.jpg"]),
    description: "Description",
    sellingPoints: "Selling point",
    status: "online",
    skuVariants: null,
    skuName: null,
    skuPrice: null,
    skuLowestPrice: null,
    skuDiscountRate: null,
    promotionType: null,
    commissionType: null,
    commissionValue: null,
    updatedAt: "2026-09-11T00:00:00.000Z",
    linkedStoreProductId: null,
    linkedStoreProductDeletedAt: null,
    ...overrides,
  };
}

function child(overrides: Record<string, unknown> = {}) {
  return {
    ...source(),
    id: 32,
    parentProductId: 31,
    productName: "Large",
    productId: "SKU-L",
    barcode: "SKU-BAR-L",
    price: "4500",
    skuName: "Large",
    skuPrice: "4500",
    stock: 3,
    images: null,
    updatedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function createQueryHandler(options: {
  parent?: ReturnType<typeof source>;
  children?: ReturnType<typeof child>[];
  duplicate?: boolean;
  insertProductId?: number;
} = {}) {
  const parent = options.parent || source();
  const children = options.children || [child()];
  let skuId = 800;
  return vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
    if (sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
    if (sql.includes("FROM managed_stores")) return [[{ id: 7 }], []];
    if (sql.includes("FROM selection_products sp")) return [[parent], []];
    if (sql.includes("WHERE parentProductId IN")) return [children, []];
    if (sql.includes("WHERE storeId=? AND selectionProductId=?")) return [options.duplicate ? [{ id: 99, deletedAt: null }] : [], []];
    if (sql.includes("INSERT INTO store_products")) return [{ insertId: options.insertProductId || 701, affectedRows: 1 }, []];
    if (sql.includes("INSERT INTO store_product_skus")) return [{ insertId: ++skuId, affectedRows: 1 }, []];
    if (sql.includes("SELECT imageUrl FROM store_product_images")) return [[], []];
    if (sql.includes("INSERT INTO store_product_images")) return [{ insertId: 901, affectedRows: 1 }, []];
    if (sql.includes("UPDATE store_products SET mainImageUrl")) return [{ affectedRows: 1 }, []];
    if (sql.includes("INSERT INTO store_product_audit_logs")) return [{ insertId: 1001, affectedRows: 1 }, []];
    throw new Error(`unexpected query: ${sql.slice(0, 120)}`);
  });
}

function poolWith(query: ReturnType<typeof createQueryHandler>) {
  const connection = {
    query,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  return {
    pool: { query, getConnection: vi.fn().mockResolvedValue(connection) } as any,
    connection,
  };
}

function saveInput(sourceRevision: string) {
  return {
    storeId: 7,
    selectionProductId: 31,
    sourceRevision,
    product: {
      platformProductId: "EXT-31",
      spuCode: null,
      productName: "Source Product",
      brandName: "Brand",
      category: "Category",
      productUrl: "https://example.invalid/product",
      basePrice: 4280,
      currency: "JPY",
      stock: 5,
      status: "draft" as const,
      notes: "Description",
    },
    skus: [{
      platformSkuId: "SKU-L",
      skuCode: "SKU-L",
      barcode: "SKU-BAR-L",
      variantName: "Large",
      salePrice: 4500,
      stock: 3,
      status: "active" as const,
      imageUrl: null,
      imageKey: null,
    }],
    actorId: 8,
    actorName: "Admin",
  };
}

async function revisionFor(parent = source(), children = [child()]) {
  const query = createQueryHandler({ parent, children });
  const { pool } = poolWith(query);
  const options = await searchStoreSelectionProducts(pool, { storeId: 7, search: "SKU-L", limit: 20 });
  return options[0].sourceRevision;
}

describe("store selection product link service", () => {
  it("searches parent products and returns child SKU, source image and revision", async () => {
    const query = createQueryHandler();
    const { pool } = poolWith(query);
    const result = await searchStoreSelectionProducts(pool, { storeId: 7, search: "SKU-L", limit: 20 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ selectionProductId: 31, externalProductId: "EXT-31", available: true, linkedStoreProductId: null });
    expect(result[0].sourceRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(result[0].imageUrls).toEqual(["https://example.invalid/a.jpg"]);
    expect(result[0].skus).toEqual(expect.arrayContaining([expect.objectContaining({ skuCode: "SKU-L", variantName: "Large" })]));
  });

  it("creates product, SKU, source image and audit in one transaction", async () => {
    const revision = await revisionFor();
    const query = createQueryHandler();
    const { pool, connection } = poolWith(query);
    await expect(saveStoreProductFromSelection(pool, saveInput(revision))).resolves.toEqual({
      id: 701,
      skuCount: 1,
      skuIds: [801],
      imageCount: 1,
      created: true,
    });
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO store_product_skus"))).toBe(true);
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO store_product_images"))).toBe(true);
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO store_product_audit_logs"))).toBe(true);
  });

  it("rolls back when the same source is already linked in the store", async () => {
    const revision = await revisionFor();
    const query = createQueryHandler({ duplicate: true });
    const { pool, connection } = poolWith(query);
    await expect(saveStoreProductFromSelection(pool, saveInput(revision))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(query.mock.calls.some((call) => String(call[0]).includes("INSERT INTO store_products"))).toBe(false);
  });

  it("rolls back when the source changed after selection", async () => {
    const revision = await revisionFor();
    const query = createQueryHandler({ parent: source({ updatedAt: "2026-09-12T00:00:00.000Z" }) });
    const { pool, connection } = poolWith(query);
    await expect(saveStoreProductFromSelection(pool, saveInput(revision))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
