import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import * as XLSX from "xlsx";
import { repairAuctionImportBatch } from "./auctionImportService";

function sampleFile() {
  const rows = [
    ["商品 ID", "商品名称", "库存量", "成交件数", "GMV", "商品sku", "PID", "SKU ID", "起拍价", "销售价", "获胜者", "竞拍人数", "开始时间", "时长"],
    ["1737000000000000001", "商品A", 10, 2, 6000, "SKU A", "1737000000000000001", "1737100000000000001", 1000, 3000, "A", 1, "2026-08-27 10:00", 30],
    ["1737000000000000001", "商品A", 10, 2, 6000, "SKU A", "1737000000000000001", "1737100000000000001", 1000, 3000, "B", 1, "2026-08-27 10:05", 30],
    ["1737000000000000002", "零成交商品", 10, 0, 0, "-", "1737000000000000002", "-", 0, 0, "-", 0, "-", 0],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("auction import batch repair", () => {
  it("reparses the saved workbook and transactionally replaces only the target batch", async () => {
    const file = sampleFile();
    const hash = createHash("sha256").update(file).digest("hex");
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const counters = { began: 0, committed: 0, rolledBack: 0, released: 0 };
    const connection = {
      beginTransaction: async () => { counters.began += 1; },
      commit: async () => { counters.committed += 1; },
      rollback: async () => { counters.rolledBack += 1; },
      release: () => { counters.released += 1; },
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.startsWith("SELECT id, roundsJson")) return [[{ id: 7, roundsJson: JSON.stringify([{ roundNumber: 1, skuName: "", skuId: "1737100000000000001", startPrice: 1000, salePrice: 3000 }]) }], []];
        return [{ affectedRows: 1, insertId: calls.length }, []];
      },
    };
    const pool = {
      query: async () => [[{
        id: 9, sourceFileName: "sample.xlsx", sourceFileSha256: hash,
        sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sourceStorageKey: "private/sample.xlsx", liverName: "yuyo", createdBy: 1,
      }], []],
      getConnection: async () => connection,
    } as unknown as mysql.Pool;

    const result = await repairAuctionImportBatch(9, {
      pool,
      ensureSchemaReady: async () => undefined,
      getObject: async () => ({ url: "https://example.invalid/sample.xlsx" }) as any,
      fetchImpl: async () => new Response(file) as any,
    });

    expect(result).toMatchObject({ success: true, batchId: 9, importedRecordCount: 2, roundCount: 2, uniqueSkuCount: 1 });
    expect(calls.some(call => call.sql.startsWith("DELETE FROM auction_records"))).toBe(true);
    const inserts = calls.filter(call => call.sql.startsWith("INSERT INTO auction_records"));
    expect(inserts).toHaveLength(2);
    expect(inserts.some(call => call.params.some(value => typeof value === "string" && value.includes('"skuName":"SKU A"')))).toBe(true);
    expect(counters).toEqual({ began: 1, committed: 1, rolledBack: 0, released: 1 });
  });
});
