import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./selectionProductPersistence", () => ({
  ensureSelectionProductPersistenceSchema: vi.fn(async () => undefined),
}));

import {
  bulkUpdateSelectionProducts,
  hasAtMostTwoDecimalPlaces,
  listSelectionProductIds,
  resolveHistoricalMinimum,
} from "./selectionProductBulkUpdate";

type Snapshot = {
  id: number;
  price: number;
  marketPrice: number;
  historicalLowestPrice: number;
  stock: number;
  commissionType: "percentage";
  commissionValue: number;
  status: "online";
};

function snapshots(): Snapshot[] {
  return [
    { id: 10, price: 1000, marketPrice: 1200, historicalLowestPrice: 900, stock: 2, commissionType: "percentage", commissionValue: 10, status: "online" },
    { id: 11, price: 1000, marketPrice: 1200, historicalLowestPrice: 900, stock: 3, commissionType: "percentage", commissionValue: 10, status: "online" },
  ];
}

function createPool(options?: {
  beforeRows?: Snapshot[];
  historyRows?: Array<{ productId: number; minPrice: number }>;
  completed?: { actorUserId: number; inputHash: string; productCount: number }[];
}) {
  const beforeRows = options?.beforeRows ?? snapshots();
  const afterRows = beforeRows.map(row => ({ ...row, price: 800, historicalLowestPrice: 700, stock: 20 }));
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.includes("FROM selection_products") && normalized.endsWith("FOR UPDATE")) return [beforeRows, []];
      if (normalized.startsWith("SELECT productId, MIN(price) AS minPrice")) {
        return [options?.historyRows ?? beforeRows.map(row => ({ productId: row.id, minPrice: 700 })), []];
      }
      if (normalized.startsWith("SELECT id, price") && normalized.includes("FROM selection_products")) return [afterRows, []];
      return [{ affectedRows: 1 }, []];
    }),
  };
  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM selection_product_bulk_updates")) return [options?.completed ?? [], []];
      return [[], []];
    }),
    getConnection: vi.fn(async () => connection),
  };
  return { pool: pool as any, connection };
}

describe("selection product bulk update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates all selected products in one transaction, appends lowest-price history, and stores before/after audit", async () => {
    const { pool, connection } = createPool();
    const result = await bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000001",
      productIds: [11, 10],
      patch: { price: 800, historicalLowestPrice: 700, stock: 20 },
    }, 42);

    expect(result).toEqual({ success: true, affectedCount: 2, idempotent: false });
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();

    const sql = connection.query.mock.calls.map(call => String(call[0]).replace(/\s+/g, " "));
    expect(sql.some(statement => statement.includes("INSERT INTO selection_product_bulk_updates"))).toBe(true);
    expect(sql.some(statement => statement.includes("SELECT id, price") && statement.includes("parentProductId IS NULL") && statement.includes("FOR UPDATE"))).toBe(true);
    expect(sql.some(statement => statement.includes("UPDATE selection_products SET price = ?, stock = ?"))).toBe(true);
    expect(sql.some(statement => statement.includes("INSERT INTO selection_price_history"))).toBe(true);
    expect(sql.some(statement => statement.includes("MIN(price) AS minPrice"))).toBe(true);
    expect(sql.some(statement => statement.includes("SET beforeState = ?, afterState = ?"))).toBe(true);
  });

  it("rolls back the whole batch when any selected product is missing or archived", async () => {
    const { pool, connection } = createPool({ beforeRows: snapshots().slice(0, 1) });
    await expect(bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000002",
      productIds: [10, 11],
      patch: { stock: 0 },
    }, 42)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(call => String(call[0]).includes("UPDATE selection_products SET stock"))).toBe(false);
  });

  it("rejects a lowest price above the effective current price before writing product values", async () => {
    const { pool, connection } = createPool();
    await expect(bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000003",
      productIds: [10, 11],
      patch: { price: 800, historicalLowestPrice: 900 },
    }, 42)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.some(call => String(call[0]).includes("UPDATE selection_products SET price"))).toBe(false);
  });

  it("never raises a legacy minimum even when active history is empty or higher", async () => {
    expect(resolveHistoricalMinimum(500, null, 700)).toBe(500);
    expect(resolveHistoricalMinimum(500, 600, 700)).toBe(500);
    const legacyRows = snapshots().map(row => ({ ...row, historicalLowestPrice: 500 }));
    const { pool, connection } = createPool({
      beforeRows: legacyRows,
      historyRows: legacyRows.map(row => ({ productId: row.id, minPrice: 600 })),
    });
    await bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000016",
      productIds: [10, 11],
      patch: { historicalLowestPrice: 700 },
    }, 42);
    const minimumUpdate = connection.query.mock.calls.find(call => String(call[0]).includes("historicalLowestPrice = CASE id"));
    expect(minimumUpdate?.[1]).toEqual([10, 500, 11, 500, 10, 11]);
  });

  it("records a price-only update and lowers the product minimum in the same transaction", async () => {
    const { pool, connection } = createPool({
      historyRows: snapshots().map(row => ({ productId: row.id, minPrice: 800 })),
    });
    await bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000018",
      productIds: [10, 11],
      patch: { price: 800 },
    }, 42);
    const priceHistoryInsert = connection.query.mock.calls.find(call => (
      String(call[0]).includes("INSERT INTO selection_price_history")
        && Array.isArray(call[1])
        && call[1].includes("bulk_price")
    ));
    expect(priceHistoryInsert).toBeTruthy();
    const minimumUpdate = connection.query.mock.calls.find(call => String(call[0]).includes("historicalLowestPrice = CASE id"));
    expect(minimumUpdate?.[1]).toEqual([10, 800, 11, 800, 10, 11]);
  });

  it("accepts at most two decimal places and rejects sub-cent values before DB work", async () => {
    expect(hasAtMostTwoDecimalPlaces(1.99)).toBe(true);
    expect(hasAtMostTwoDecimalPlaces(100)).toBe(true);
    expect(hasAtMostTwoDecimalPlaces(0.001)).toBe(false);
    expect(hasAtMostTwoDecimalPlaces(1.999)).toBe(false);
    const { pool } = createPool();
    await expect(bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000017",
      productIds: [10],
      patch: { price: 1.999 },
    }, 42)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  it("returns a completed request without starting another transaction", async () => {
    const input = {
      requestId: "00000000-0000-4000-8000-000000000004",
      productIds: [10],
      patch: { stock: 8 },
    };
    const { createHash } = await import("node:crypto");
    const canonical = JSON.stringify({ productIds: [10], patch: { stock: 8 } });
    const inputHash = createHash("sha256").update(canonical).digest("hex");
    const { pool } = createPool({ completed: [{ actorUserId: 42, inputHash, productCount: 1 }] });

    await expect(bulkUpdateSelectionProducts(pool, input, 42)).resolves.toEqual({ success: true, affectedCount: 1, idempotent: true });
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  it("rejects reuse of the same request ID with a different payload", async () => {
    const { pool } = createPool({ completed: [{ actorUserId: 42, inputHash: "different", productCount: 2 }] });
    await expect(bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000005",
      productIds: [10],
      patch: { stock: 8 },
    }, 42)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects reuse of another actor's request ID", async () => {
    const { createHash } = await import("node:crypto");
    const inputHash = createHash("sha256").update(JSON.stringify({ productIds: [10], patch: { stock: 8 } })).digest("hex");
    const { pool } = createPool({ completed: [{ actorUserId: 99, inputHash, productCount: 1 }] });
    await expect(bulkUpdateSelectionProducts(pool, {
      requestId: "00000000-0000-4000-8000-000000000006",
      productIds: [10],
      patch: { stock: 8 },
    }, 42)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("selects only active parent products for the current search/status/brand filters", async () => {
    const pool = {
      query: vi.fn(async () => [[{ id: 10 }, { id: 12 }], []]),
    } as any;
    await expect(listSelectionProductIds(pool, {
      search: "miavie",
      status: "online",
      brandName: "MIAVIE",
    })).resolves.toEqual([10, 12]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("sp.deletedAt IS NULL AND sp.parentProductId IS NULL");
    expect(sql).toContain("sp.status = ?");
    expect(sql).toContain("sp.brandName = ?");
    expect(sql).toContain("child.parentProductId = sp.id AND child.deletedAt IS NULL");
    expect(params).toEqual(["online", "MIAVIE", ...Array(8).fill("%miavie%")]);
  });
});
