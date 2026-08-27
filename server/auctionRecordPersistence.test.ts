import { describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  AuctionRecordValidationError,
  canonicalAuctionRecordInput,
  normalizeAuctionDate,
  safeAuctionRounds,
} from "@shared/auctionRecordPersistence";
import { createAuctionRecord, updateAuctionRecord } from "./auctionRecordPersistence";

type QueryCall = { sql: string; params: unknown[] };

type Scenario = {
  existing?: boolean;
  insertAffectedRows?: number;
  updateAffectedRows?: number;
  failOnUpdate?: boolean;
};

function fakePool(scenario: Scenario = {}) {
  const calls: QueryCall[] = [];
  let began = 0;
  let committed = 0;
  let rolledBack = 0;
  let released = 0;
  const connection = {
    beginTransaction: async () => { began += 1; },
    commit: async () => { committed += 1; },
    rollback: async () => { rolledBack += 1; },
    release: () => { released += 1; },
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id FROM auction_records")) {
        return [scenario.existing === false ? [] : [{ id: 7 }], []];
      }
      if (sql.startsWith("INSERT INTO auction_records")) {
        return [{ insertId: 17, affectedRows: scenario.insertAffectedRows ?? 1 }, []];
      }
      if (sql.startsWith("UPDATE auction_records")) {
        if (scenario.failOnUpdate) throw new Error("simulated update failure");
        return [{ affectedRows: scenario.updateAffectedRows ?? 1 }, []];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const pool = { getConnection: async () => connection } as unknown as mysql.Pool;
  return {
    pool,
    calls,
    counters: () => ({ began, committed, rolledBack, released }),
  };
}

describe("auction record normalization", () => {
  it("accepts SuperJSON Date values and ISO date strings", () => {
    expect(normalizeAuctionDate(new Date("2026-08-24T00:00:00.000Z"))).toBe("2026-08-24");
    expect(normalizeAuctionDate("2026-08-25T00:00:00.000Z")).toBe("2026-08-25");
  });

  it("rejects impossible dates and negative or non-decimal numbers", () => {
    expect(() => normalizeAuctionDate("2026-02-31")).toThrow(AuctionRecordValidationError);
    expect(() => canonicalAuctionRecordInput({ startPrice: "-1" })).toThrow(/起拍价/);
    expect(() => canonicalAuctionRecordInput({ finalPrice: "1e3" })).toThrow(/成交价/);
  });

  it("normalizes rounds and recalculates count, first start price and average final price", () => {
    const data = canonicalAuctionRecordInput({
      productId: " 1737000000000000000 ",
      productName: " 商品A ",
      auctionDate: "2026-08-27",
      roundsJson: JSON.stringify([
        { roundNumber: 1, startPrice: 1000, salePrice: 3000, bidderCount: 2, winner: " A " },
        { roundNumber: 2, startPrice: 1000, finalPrice: 5000, bidders: 4, winner: "B" },
      ]),
    }, { requireIdentity: true, requireDate: true });
    expect(data).toMatchObject({
      productId: "1737000000000000000",
      productName: "商品A",
      auctionDate: "2026-08-27",
      auctionCount: 2,
      startPrice: 1000,
      finalPrice: 4000,
    });
    const rounds = JSON.parse(String(data.roundsJson));
    expect(rounds).toHaveLength(2);
    expect(rounds[1]).toMatchObject({ salePrice: 5000, bidderCount: 4, winner: "B", promotionType: "" });
  });

  it("keeps each SKU combination per round and infers legacy 1+1 or 1+2 names", () => {
    const data = canonicalAuctionRecordInput({
      roundsJson: JSON.stringify([
        { roundNumber: 1, skuName: "1+1", skuId: "sku-a", salePrice: 2000 },
        { roundNumber: 2, skuName: "10個セット", skuId: "sku-b", promotionType: "1+2", salePrice: 3000 },
        { roundNumber: 3, skuName: "1+4 キャビア", skuId: "sku-c", salePrice: 4000 },
      ]),
    });
    expect(JSON.parse(String(data.roundsJson))).toMatchObject([
      { skuId: "sku-a", promotionType: "1+1" },
      { skuId: "sku-b", promotionType: "1+2" },
      { skuId: "sku-c", promotionType: "1+4" },
    ]);
    expect(() => canonicalAuctionRecordInput({ roundsJson: JSON.stringify([{ roundNumber: 1, promotionType: "buy-one", salePrice: 1000 }]) })).toThrow(/1\+1/);
  });

  it("rejects round number zero even when browser constraints are bypassed", () => {
    expect(() => canonicalAuctionRecordInput({ roundsJson: JSON.stringify([{ roundNumber: 0, salePrice: 1000 }]) })).toThrow(/轮编号/);
  });

  it("does not crash the list for malformed legacy rounds JSON", () => {
    expect(safeAuctionRounds("{broken")).toEqual([]);
  });
});

describe("auction record transactional persistence", () => {
  it("creates a complete record in one transaction", async () => {
    const fake = fakePool();
    const result = await createAuctionRecord(fake.pool, {
      productId: "1737000000000000001",
      productName: "拍卖商品",
      chineseName: "拍卖商品中文",
      auctionDate: "2026-08-27",
      liverName: "主播A",
      totalGmv: "8000",
      totalOrders: "2",
      roundsJson: JSON.stringify([{ roundNumber: 1, startPrice: 1000, salePrice: 8000, bidderCount: 3 }]),
    }, 42);
    expect(result).toEqual({ id: 17, success: true });
    expect(fake.counters()).toEqual({ began: 1, committed: 1, rolledBack: 0, released: 1 });
    const insert = fake.calls.find((call) => call.sql.startsWith("INSERT INTO auction_records"));
    expect(insert?.sql).toContain("roundsJson");
    expect(insert?.params).toContain("拍卖商品中文");
    expect(insert?.params).toContain(42);
  });

  it("updates an existing record under a row lock", async () => {
    const fake = fakePool();
    await updateAuctionRecord(fake.pool, 7, {
      productName: "修改后名称",
      chineseName: "中文修改",
      auctionDate: "2026-08-26",
      note: "已确认",
      roundsJson: "[]",
      finalPrice: "2500",
      auctionCount: "1",
    });
    expect(fake.calls[0]?.sql).toContain("FOR UPDATE");
    expect(fake.calls[1]?.sql).toContain("UPDATE auction_records SET");
    expect(fake.calls[1]?.params).toContain("修改后名称");
    expect(fake.counters()).toEqual({ began: 1, committed: 1, rolledBack: 0, released: 1 });
  });

  it("supports second and third edits of the same record while preserving repeated SKU rounds", async () => {
    const fake = fakePool();
    await updateAuctionRecord(fake.pool, 7, {
      roundsJson: JSON.stringify([
        { roundNumber: 1, skuName: "10個セット", skuId: "sku-10", promotionType: "1+1", salePrice: 2800 },
        { roundNumber: 2, skuName: "10個セット", skuId: "sku-10", promotionType: "1+1", salePrice: 3000 },
      ]),
    });
    await updateAuctionRecord(fake.pool, 7, {
      roundsJson: JSON.stringify([
        { roundNumber: 1, skuName: "10個セット", skuId: "sku-10", promotionType: "1+2", salePrice: 2900 },
        { roundNumber: 2, skuName: "10個セット", skuId: "sku-10", promotionType: "1+2", salePrice: 3100 },
        { roundNumber: 3, skuName: "20個セット", skuId: "sku-20", promotionType: "1+4", salePrice: 5000 },
      ]),
    });
    const updates = fake.calls.filter((call) => call.sql.startsWith("UPDATE auction_records"));
    expect(updates).toHaveLength(2);
    expect(updates[0]?.params.some((value) => typeof value === "string" && value.includes('"promotionType":"1+1"'))).toBe(true);
    expect(updates[1]?.params.some((value) => typeof value === "string" && value.includes('"promotionType":"1+4"'))).toBe(true);
    expect(fake.counters()).toEqual({ began: 2, committed: 2, rolledBack: 0, released: 2 });
  });

  it("returns NOT_FOUND and rolls back when the record does not exist", async () => {
    const fake = fakePool({ existing: false });
    await expect(updateAuctionRecord(fake.pool, 404, { note: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<TRPCError>);
    expect(fake.counters()).toEqual({ began: 1, committed: 0, rolledBack: 1, released: 1 });
  });

  it("rolls back when affectedRows is not exactly one", async () => {
    const fake = fakePool({ updateAffectedRows: 0 });
    await expect(updateAuctionRecord(fake.pool, 7, { note: "x" })).rejects.toThrow(/更新失败/);
    expect(fake.counters()).toEqual({ began: 1, committed: 0, rolledBack: 1, released: 1 });
  });

  it("rolls back when MySQL fails after the row lock", async () => {
    const fake = fakePool({ failOnUpdate: true });
    await expect(updateAuctionRecord(fake.pool, 7, { note: "x" })).rejects.toThrow("simulated update failure");
    expect(fake.counters()).toEqual({ began: 1, committed: 0, rolledBack: 1, released: 1 });
  });

  it("rejects invalid create input before opening a transaction", async () => {
    const fake = fakePool();
    await expect(createAuctionRecord(fake.pool, { productName: "", auctionDate: "" }, 1)).rejects.toMatchObject({ code: "BAD_REQUEST" } satisfies Partial<TRPCError>);
    expect(fake.counters()).toEqual({ began: 0, committed: 0, rolledBack: 0, released: 0 });
  });
});
