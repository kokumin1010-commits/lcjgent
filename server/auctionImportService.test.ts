import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { Pool } from "mysql2/promise";
import { importAuctionBatch, type AuctionImportBatchInput } from "./auctionImportService";

function workbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["商品ID", "商品名"],
    ["1737000000000000999", "拍卖上传测试"],
  ]), "拍卖");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function inputFor(buffer: Buffer): AuctionImportBatchInput {
  return {
    sourceFileName: "auction-test.xlsx",
    sourceFileSha256: createHash("sha256").update(buffer).digest("hex"),
    sourceFileBase64: buffer.toString("base64"),
    sourceFileSize: buffer.length,
    sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sourceRowCount: 1,
    skippedRowCount: 0,
    liverName: "主播测试",
    createdBy: 99,
    records: [{
      productId: "1737000000000000999",
      productName: "拍卖上传测试",
      startPrice: 1000,
      finalPrice: 4000,
      totalGmv: 4000,
      totalOrders: 1,
      auctionCount: 1,
      auctionDate: "2026-08-27",
      roundsJson: "[]",
    }],
  };
}

function fakeDatabase(options: { failRecordInsert?: boolean; failConnection?: boolean } = {}) {
  const poolQueries: Array<{ sql: string; params: unknown[] }> = [];
  const connectionQueries: Array<{ sql: string; params: unknown[] }> = [];
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
      connectionQueries.push({ sql, params });
      if (sql.includes("FROM auction_import_batches") && sql.includes("FOR UPDATE")) return [[], []];
      if (sql.startsWith("INSERT INTO auction_import_batches")) return [{ insertId: 11, affectedRows: 1 }, []];
      if (sql.startsWith("INSERT INTO auction_records")) {
        if (options.failRecordInsert) throw new Error("simulated record insert failure");
        return [{ insertId: 21, affectedRows: 1 }, []];
      }
      if (sql.startsWith("UPDATE auction_import_batches")) return [{ affectedRows: 1 }, []];
      throw new Error(`unexpected connection query: ${sql}`);
    },
  };
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      poolQueries.push({ sql, params });
      if (sql.includes("FROM auction_import_batches") && sql.includes("LIMIT 1")) return [[], []];
      if (sql.startsWith("UPDATE auction_import_batches")) return [{ affectedRows: 1 }, []];
      throw new Error(`unexpected pool query: ${sql}`);
    },
    getConnection: async () => {
      if (options.failConnection) throw new Error("simulated connection failure");
      return connection;
    },
  } as unknown as Pool;
  return {
    pool,
    poolQueries,
    connectionQueries,
    counters: () => ({ began, committed, rolledBack, released }),
  };
}

describe("auction import service", () => {
  it("stores a verified XLSX and commits the batch and records atomically", async () => {
    const buffer = workbookBuffer();
    const database = fakeDatabase();
    const putObject = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    const result = await importAuctionBatch(inputFor(buffer), {
      pool: database.pool,
      ensureSchemaReady: async () => undefined,
      putObject,
    });
    expect(result).toMatchObject({ success: true, alreadyImported: false, batchId: 11, importedRecordCount: 1, originalFileSaved: true });
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(putObject.mock.calls[0]?.[0]).toMatch(/^private\/auction-imports\/[a-f0-9]{64}-auction-test\.xlsx$/);
    expect(database.connectionQueries.some((call) => call.sql.startsWith("INSERT INTO auction_records"))).toBe(true);
    expect(database.counters()).toEqual({ began: 1, committed: 1, rolledBack: 0, released: 1 });
  });

  it("rolls back all imported records and records a failed batch when a record insert fails", async () => {
    const buffer = workbookBuffer();
    const database = fakeDatabase({ failRecordInsert: true });
    const putObject = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    const deleteObject = vi.fn(async (key: string) => ({ key }));
    await expect(importAuctionBatch(inputFor(buffer), {
      pool: database.pool,
      ensureSchemaReady: async () => undefined,
      putObject,
      deleteObject,
    })).rejects.toThrow("simulated record insert failure");
    expect(database.counters()).toEqual({ began: 1, committed: 0, rolledBack: 1, released: 1 });
    expect(database.poolQueries.some((call) => call.sql.startsWith("UPDATE auction_import_batches") && call.params[4] === "simulated record insert failure")).toBe(true);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("deletes the uploaded object when MySQL cannot create an auditable batch", async () => {
    const buffer = workbookBuffer();
    const database = fakeDatabase({ failConnection: true });
    const putObject = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    const deleteObject = vi.fn(async (key: string) => ({ key }));
    await expect(importAuctionBatch(inputFor(buffer), {
      pool: database.pool,
      ensureSchemaReady: async () => undefined,
      putObject,
      deleteObject,
    })).rejects.toThrow("simulated connection failure");
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject.mock.calls[0]?.[0]).toBe(putObject.mock.calls[0]?.[0]);
    expect(database.counters()).toEqual({ began: 0, committed: 0, rolledBack: 0, released: 0 });
  });

  it("rejects SHA mismatch before storage or transaction", async () => {
    const buffer = workbookBuffer();
    const database = fakeDatabase();
    const putObject = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    const input = inputFor(buffer);
    input.sourceFileSha256 = "0".repeat(64);
    await expect(importAuctionBatch(input, {
      pool: database.pool,
      ensureSchemaReady: async () => undefined,
      putObject,
    })).rejects.toThrow(/SHA-256/);
    expect(putObject).not.toHaveBeenCalled();
    expect(database.counters().began).toBe(0);
  });

  it("rejects malformed base64 before storage or transaction", async () => {
    const buffer = workbookBuffer();
    const database = fakeDatabase();
    const putObject = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    const input = inputFor(buffer);
    input.sourceFileBase64 = "%%%not-base64%%%";
    await expect(importAuctionBatch(input, {
      pool: database.pool,
      ensureSchemaReady: async () => undefined,
      putObject,
    })).rejects.toThrow(/base64/);
    expect(putObject).not.toHaveBeenCalled();
    expect(database.counters().began).toBe(0);
  });
});
