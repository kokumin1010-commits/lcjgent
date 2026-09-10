import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkDraftInputForSource,
  previewMallSelectionBulkSync,
  processMallSelectionBulkSyncBatch,
  resetMallSelectionImportSchemaForTests,
} from "./mallSelectionProductImportService";

function source(id: number, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    productName: name,
    productNameCn: null,
    parentProductId: null,
    deletedAt: null,
    productId: `P-${id}`,
    barcode: null,
    brandId: 7,
    brandName: "Brand",
    categoryId: 3,
    categoryName: "Category",
    price: "3980",
    stock: 2,
    images: JSON.stringify(["https://example.invalid/a.jpg"]),
    description: "Description",
    sellingPoints: null,
    commissionType: "percentage",
    commissionValue: "10",
    status: "online",
    skuVariants: JSON.stringify([]),
    skuName: null,
    skuPrice: null,
    skuLowestPrice: null,
    skuDiscountRate: null,
    promotionType: null,
    ...overrides,
  };
}

function loaded(overrides: Record<string, unknown> = {}) {
  return {
    sources: [],
    mallProducts: [],
    categories: [{ id: 8, name: "Category", isActive: "yes" }],
    brands: [{ id: 7 }],
    ...overrides,
  } as any;
}

function poolQueryFor(getSources: () => any[], getMall: () => any[]) {
  return vi.fn(async (sql: string) => {
    if (sql.includes("ALTER TABLE") || sql.includes("CREATE UNIQUE INDEX")) return [[], []];
    if (sql.includes("FROM selection_products sp") && sql.includes("ORDER BY sp.id ASC")) return [getSources(), []];
    if (sql.includes("SELECT id, name, selectionProductId FROM mall_products")) return [getMall(), []];
    if (sql.includes("FROM mall_categories")) return [[{ id: 8, name: "Category", isActive: "yes" }], []];
    if (sql.includes("FROM brands")) return [[{ id: 7 }], []];
    throw new Error(`unexpected pool query: ${sql.slice(0, 80)}`);
  });
}

beforeEach(() => resetMallSelectionImportSchemaForTests());

describe("MALL selection bulk sync service", () => {
  it("keeps incomplete source data eligible but creates a protected zero-price draft input", () => {
    const input = bulkDraftInputForSource(source(1, "Incomplete", {
      price: null,
      stock: null,
      images: [],
      description: "",
      sellingPoints: "",
      brandId: 999,
      categoryName: "Missing category",
      commissionValue: null,
    }) as any, loaded());

    expect(input).toMatchObject({
      selectionProductId: 1,
      name: "Incomplete",
      price: 0,
      stock: 0,
      brandId: null,
      categoryId: null,
      pointPrice: null,
      status: "draft",
      sortOrder: 9999,
      commissionRate: null,
      imageUrls: [],
    });
  });

  it("returns a count-only preview without product details", async () => {
    const sources = [
      source(1, "Ready"),
      source(2, "Existing"),
      source(3, "Mapped"),
      source(4, "Conflict", { productNameCn: "Shared" }),
      source(5, "Shared"),
    ];
    const mall = [
      { id: 10, name: "Existing", selectionProductId: null },
      { id: 11, name: "Other", selectionProductId: 3 },
    ];
    const pool = { query: poolQueryFor(() => sources, () => mall) } as any;

    const preview = await previewMallSelectionBulkSync(pool);
    expect(preview).toMatchObject({
      sourceParentCount: 5,
      mallProductCount: 2,
      ready: 1,
      alreadyMapped: 1,
      mallNameConflict: 1,
      sourceNameConflict: 2,
    });
    expect(JSON.stringify(preview)).not.toContain("Ready");
    expect(JSON.stringify(preview)).not.toContain("selectionProductId");
  });

  it("isolates one failed item, creates the next as draft, and is idempotent on rerun", async () => {
    const sources = [source(1, "Will fail"), source(2, "Will succeed", { price: null })];
    const mall: any[] = [];
    const poolQuery = poolQueryFor(() => sources, () => mall);
    let connectionNumber = 0;
    const pool: any = {
      query: poolQuery,
      getConnection: vi.fn(async () => {
        connectionNumber += 1;
        const sourceId = connectionNumber === 1 ? 1 : 2;
        const connection = {
          beginTransaction: vi.fn(async () => undefined),
          commit: vi.fn(async () => undefined),
          rollback: vi.fn(async () => undefined),
          release: vi.fn(),
          query: vi.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes("FROM selection_products sp") && sql.includes("FOR UPDATE")) {
              return [[sources.find((row) => row.id === sourceId)], []];
            }
            if (sql.includes("SELECT id FROM mall_products")) return [[], []];
            if (sql.includes("INSERT INTO mall_products")) {
              if (sourceId === 1) throw Object.assign(new Error("simulated insert failure"), { code: "ER_LOCK_WAIT_TIMEOUT" });
              mall.push({ id: 200, name: "Will succeed", selectionProductId: 2 });
              expect(params).toContain(0);
              expect(params).toContain("draft");
              return [{ insertId: 200, affectedRows: 1 }, []];
            }
            if (sql.includes("WHERE parentProductId =")) return [[], []];
            if (sql.includes("INSERT INTO mall_product_variants")) return [{ affectedRows: 1 }, []];
            throw new Error(`unexpected connection query: ${sql.slice(0, 80)}`);
          }),
        };
        return connection;
      }),
    };

    const first = await processMallSelectionBulkSyncBatch(pool, { limit: 20 });
    expect(first).toMatchObject({
      attempted: 2,
      created: 1,
      createdZeroPriceDrafts: 1,
      failed: 1,
      remaining: 1,
      done: false,
      haltedWithoutProgress: false,
    });
    expect(first.failureCodes).toEqual({ ER_LOCK_WAIT_TIMEOUT: 1 });
    expect(mall).toHaveLength(1);

    // The successful source is now mapped; the failed source remains safely retryable.
    const preview = await previewMallSelectionBulkSync(pool);
    expect(preview.ready).toBe(1);
    expect(preview.alreadyMapped).toBe(1);
  });
});
