import { describe, expect, it, vi } from "vitest";
import { previewStoreSelectionBulkSync } from "./storeSelectionProductLinkService";

function source(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    parentProductId: null,
    productName: `Product ${id}`,
    productNameCn: null,
    productId: `EXT-${id}`,
    barcode: null,
    brandId: 9,
    brandName: "Brand",
    categoryId: 3,
    categoryName: "Beauty",
    productLink: `https://example.invalid/${id}`,
    price: "4280",
    stock: 5,
    status: "online",
    images: JSON.stringify([`https://example.invalid/${id}.jpg`]),
    detailImages: null,
    description: "Description",
    sellingPoints: null,
    skuVariants: null,
    updatedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function previewPool(options: {
  store?: Record<string, unknown>;
  sources?: Record<string, unknown>[];
  children?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
} = {}) {
  const store = options.store || {
    id: 7,
    name: "Brand Official Store",
    brandId: 9,
    brandName: "Brand",
    brandNameJa: "ブランド",
    companyName: "Brand Inc.",
  };
  const sources = options.sources || [source(31), source(32, { price: null, stock: 0, images: null })];
  const children = options.children || [];
  const products = options.products || [{
    id: 701,
    selectionProductId: null,
    selectionSourceRevision: null,
    productName: "Existing Product",
    platformProductId: "EXT-31",
    spuCode: null,
    deletedAt: null,
  }];
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM managed_stores ms")) return [[store], []];
    if (sql.includes("FROM selection_products sp") && sql.includes("sp.brandId=?")) return [sources, []];
    if (sql.includes("WHERE parentProductId IN")) return [children, []];
    if (sql.includes("FROM store_products") && sql.includes("selectionSourceRevision")) return [products, []];
    throw new Error(`unexpected query: ${sql.slice(0, 160)}`);
  });
  return { pool: { query } as any, query };
}

describe("store selection bulk sync preview", () => {
  it("scopes by the managed store brand and separates safe refresh from new drafts", async () => {
    const { pool } = previewPool();
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({
      storeId: 7,
      brandId: 9,
      brandName: "ブランド",
      brandConfigured: true,
      sourceParentCount: 2,
      storeProductCount: 1,
      createCount: 1,
      refreshCount: 1,
      alreadySyncedCount: 0,
      existingConflictCount: 0,
      ready: 2,
      missingPositivePriceCount: 1,
      missingImageCount: 1,
      zeroStockCount: 1,
    });
  });

  it("refuses to infer a brand from the store name when no brandId is configured", async () => {
    const { pool, query } = previewPool({
      store: { id: 7, name: "Brand Official Store", brandId: null, brandName: null, brandNameJa: null, companyName: null },
    });
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({ brandConfigured: false, brandId: null, ready: 0, sourceParentCount: 0 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not auto-link a same-name store product without an exact product ID", async () => {
    const { pool } = previewPool({
      sources: [source(31)],
      products: [{
        id: 701,
        selectionProductId: null,
        selectionSourceRevision: null,
        productName: "Product 31",
        platformProductId: null,
        spuCode: null,
        deletedAt: null,
      }],
    });
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({ createCount: 0, refreshCount: 0, existingConflictCount: 1, ready: 0 });
  });

  it("safely links one exact-name product when the brand also matches", async () => {
    const { pool } = previewPool({
      sources: [source(31)],
      products: [{
        id: 701,
        selectionProductId: null,
        selectionSourceRevision: null,
        productName: "Product 31",
        brandName: "Brand",
        platformProductId: null,
        spuCode: null,
        deletedAt: null,
      }],
    });
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({ createCount: 0, refreshCount: 1, existingConflictCount: 0, ready: 1 });
  });

  it("skips duplicate source names instead of creating ambiguous products", async () => {
    const { pool } = previewPool({
      sources: [source(31, { productName: "Same", productId: null }), source(32, { productName: "Same", productId: null })],
      products: [],
    });
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({ createCount: 0, sourceConflictCount: 2, ready: 0 });
  });

  it("skips duplicate selection-center product IDs before writing", async () => {
    const { pool } = previewPool({
      sources: [source(31, { productId: "DUPLICATE-ID" }), source(32, { productId: "DUPLICATE-ID" })],
      products: [],
    });
    const result = await previewStoreSelectionBulkSync(pool, 7);

    expect(result).toMatchObject({ createCount: 0, sourceConflictCount: 2, ready: 0 });
  });
});
