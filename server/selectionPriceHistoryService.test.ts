import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./selectionProductPersistence", () => ({
  ensureSelectionProductPersistenceSchema: vi.fn(async () => undefined),
}));

import { archiveSelectionPriceHistory } from "./selectionPriceHistoryService";

function setup(options?: {
  missing?: boolean;
  archived?: boolean;
  archiveAffectedRows?: number;
  minPrice?: number | null;
  archivedPrice?: number;
  currentMinimum?: number;
}) {
  const connection = {
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
    query: vi.fn(async (sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT ph.id, ph.productId")) {
        return [options?.missing ? [] : [{
          id: 9,
          productId: 10,
          price: options?.archivedPrice ?? 500,
          historicalLowestPrice: options?.currentMinimum ?? 500,
          archivedAt: options?.archived ? new Date() : null,
        }], []];
      }
      if (normalized.startsWith("UPDATE selection_price_history")) return [{ affectedRows: options?.archiveAffectedRows ?? 1 }, []];
      if (normalized.startsWith("SELECT MIN(price)")) return [[{ minPrice: options?.minPrice ?? 600 }], []];
      return [{ affectedRows: 1 }, []];
    }),
  };
  const pool = { getConnection: vi.fn(async () => connection) } as any;
  return { pool, connection };
}

describe("selection price history archive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft archives with actor/reason and recomputes the product minimum in one transaction", async () => {
    const { pool, connection } = setup({ minPrice: 600 });
    await expect(archiveSelectionPriceHistory(pool, { id: 9, reason: "incorrect evidence" }, 42))
      .resolves.toEqual({ success: true, archived: true, idempotent: false });
    const sql = connection.query.mock.calls.map(call => String(call[0]).replace(/\s+/g, " "));
    expect(sql.some(statement => statement.includes("FOR UPDATE"))).toBe(true);
    expect(sql.some(statement => statement.includes("SET archivedAt = CURRENT_TIMESTAMP, archivedBy = ?, archiveReason = ?"))).toBe(true);
    expect(sql.some(statement => statement.includes("archivedAt IS NULL"))).toBe(true);
    expect(sql.some(statement => /^DELETE /i.test(statement))).toBe(false);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  it("is idempotent for an already archived record and does not update the product", async () => {
    const { pool, connection } = setup({ archived: true });
    await expect(archiveSelectionPriceHistory(pool, { id: 9, reason: "retry" }, 42))
      .resolves.toEqual({ success: true, archived: true, idempotent: true });
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.some(call => String(call[0]).includes("UPDATE selection_products"))).toBe(false);
  });

  it("does not raise a lower legacy product minimum when archiving a different history row", async () => {
    const { pool, connection } = setup({ currentMinimum: 500, archivedPrice: 600, minPrice: 700 });
    await archiveSelectionPriceHistory(pool, { id: 9, reason: "wrong row" }, 42);
    const productUpdate = connection.query.mock.calls.find(call => String(call[0]).includes("UPDATE selection_products SET historicalLowestPrice"));
    expect(productUpdate?.[1]).toEqual([500, 10]);
  });

  it("rolls back when the row is missing or the compare-and-set loses", async () => {
    const missing = setup({ missing: true });
    await expect(archiveSelectionPriceHistory(missing.pool, { id: 9, reason: "missing" }, 42))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(missing.connection.rollback).toHaveBeenCalledTimes(1);

    const conflict = setup({ archiveAffectedRows: 0 });
    await expect(archiveSelectionPriceHistory(conflict.pool, { id: 9, reason: "race" }, 42))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(conflict.connection.rollback).toHaveBeenCalledTimes(1);
  });
});
