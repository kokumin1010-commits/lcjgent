import { describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { deleteAuctionRound, updateAuctionRound } from "./auctionRecordPersistence";

type QueryCall = { sql: string; params: unknown[] };

function fakePool(existingRoundsJson: string) {
  const calls: QueryCall[] = [];
  const counters = { began: 0, committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    beginTransaction: async () => { counters.began += 1; },
    commit: async () => { counters.committed += 1; },
    rollback: async () => { counters.rolledBack += 1; },
    release: () => { counters.released += 1; },
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id, roundsJson")) return [[{ id: 7, roundsJson: existingRoundsJson }], []];
      if (sql.startsWith("UPDATE auction_records SET roundsJson")) return [{ affectedRows: 1 }, []];
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  return { pool: { getConnection: async () => connection } as unknown as mysql.Pool, calls, counters };
}

const existingRounds = JSON.stringify([
  { roundNumber: 1, skuName: "100点", skuId: "sku-a", promotionType: "", startPrice: 1000, salePrice: 2000, bidderCount: 1, winner: "A", startTime: "2026-08-27 19:22:34", duration: 128 },
  { roundNumber: 2, skuName: "100点", skuId: "sku-a", promotionType: "", startPrice: 1000, salePrice: 3000, bidderCount: 2, winner: "B", startTime: "2026-08-27 19:28:25", duration: 67 },
]);

describe("single auction event persistence", () => {
  it("updates only the selected event and recalculates the record summary", async () => {
    const fake = fakePool(existingRounds);
    const result = await updateAuctionRound(fake.pool, 7, 1, {
      roundNumber: 2, skuName: "100点", skuId: "sku-a", promotionType: "", startPrice: 1000,
      salePrice: 5000, bidderCount: 3, winner: "修改后", startTime: "2026-08-27 19:28:25", duration: 67,
    });
    expect(result).toEqual({ success: true, auctionCount: 2 });
    const update = fake.calls.find(call => call.sql.startsWith("UPDATE auction_records SET roundsJson"));
    expect(update?.params).toMatchObject([expect.stringContaining('"salePrice":5000'), 2, 1000, 3500, 7]);
    expect(String(update?.params[0])).toContain('"winner":"A"');
    expect(fake.counters).toEqual({ began: 1, committed: 1, rolledBack: 0, released: 1 });
  });

  it("deletes only the selected event and renumbers the remainder", async () => {
    const fake = fakePool(existingRounds);
    const result = await deleteAuctionRound(fake.pool, 7, 0);
    expect(result).toEqual({ success: true, auctionCount: 1 });
    const update = fake.calls.find(call => call.sql.startsWith("UPDATE auction_records SET roundsJson"));
    expect(update?.params).toMatchObject([expect.stringContaining('"roundNumber":1'), 1, 1000, 3000, 7]);
    expect(String(update?.params[0])).toContain('"winner":"B"');
    expect(String(update?.params[0])).not.toContain('"winner":"A"');
  });
});
