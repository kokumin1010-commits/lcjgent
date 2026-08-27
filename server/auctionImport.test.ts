import fs from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseAuctionExcelRows } from "../client/src/lib/auctionExcelImport";

const headers = ["商品ID", "商品名", "在庫", "商品の販売数", "GMV", "商品", "PID", "SKU ID", "入札開始価格", "販売価格", "当選者", "入札者", "開始時間", "時間"];
const productIds = [
  "1736985984777553685",
  "1737036002835597077",
  "1737034348051466237",
  "1736985255460177685",
  "1736985218316732181",
  "1736985212549564181",
];

function sampleRows(): unknown[][] {
  return [
    headers,
    [productIds[0], "p1", 19, 1, "¥5,000", "sku1", productIds[0], "1729700000000000001", 1000, 5000, "A", 3, "2026-08-27 12:00", 30],
    [productIds[1], "p2", 17, 3, "¥9,000", "sku2", productIds[1], "1729700000000000002", 1000, 2000, "B", 2, "2026-08-27 12:01", 30],
    [productIds[1], "p2", 17, 3, "¥9,000", "sku2", productIds[1], "1729700000000000002", 1000, 3000, "C", 4, "2026-08-27 12:02", 30],
    [productIds[1], "p2", 17, 3, "¥9,000", "sku2", productIds[1], "1729700000000000002", 1000, 4000, "D", 5, "2026-08-27 12:03", 30],
    [productIds[2], "p3", 18, 2, "¥5,000", "sku3", productIds[2], "1729700000000000003", 1000, 2000, "E", 2, "2026-08-27 12:04", 30],
    [productIds[2], "p3", 18, 2, "¥5,000", "sku3", productIds[2], "1729700000000000003", 1000, 3000, "F", 2, "2026-08-27 12:05", 30],
    [productIds[3], "p4", 18, 2, "¥7,000", "sku4", productIds[3], "1729700000000000004", 1000, 3000, "G", 3, "2026-08-27 12:06", 30],
    [productIds[3], "p4", 18, 2, "¥7,000", "sku4", productIds[3], "1729700000000000004", 1000, 4000, "H", 4, "2026-08-27 12:07", 30],
    [productIds[4], "p5", 19, 1, "¥6,000", "sku5", productIds[4], "1729700000000000005", 1000, 6000, "I", 4, "2026-08-27 12:08", 30],
    [productIds[0], "p1", 19, 1, "¥5,000", "-", productIds[0], "", 1000, 0, "", 0, "2026-08-27 12:09", 30],
    [productIds[1], "p2", 17, 3, "¥9,000", "-", productIds[1], "", 1000, 0, "", 0, "2026-08-27 12:10", 30],
    [productIds[2], "p3", 18, 2, "¥5,000", "-", productIds[2], "", 1000, 0, "", 0, "2026-08-27 12:11", 30],
  ];
}

describe("auction Excel import", () => {
  it("groups the provided file shape into five products and nine rounds", () => {
    const parsed = parseAuctionExcelRows(sampleRows(), "2026-08-27");
    expect(parsed.sourceRowCount).toBe(12);
    expect(parsed.skippedRowCount).toBe(3);
    expect(parsed.records).toHaveLength(5);
    expect(parsed.records.map((record) => record.auctionCount)).toEqual([1, 3, 2, 2, 1]);
    expect(parsed.records.reduce((sum, record) => sum + record.auctionCount, 0)).toBe(9);
    expect(parsed.records.map((record) => record.productId)).toEqual(productIds.slice(0, 5));
    expect(parsed.records[1]?.finalPrice).toBe(3000);
  });

  it("maps by column name rather than fragile fixed positions", () => {
    const reorderedHeaders = ["GMV", "商品名", "商品ID", "販売価格", "商品", "入札開始価格", "入札者", "当選者", "開始時間", "時間", "商品の販売数", "SKU ID"];
    const parsed = parseAuctionExcelRows([
      reorderedHeaders,
      ["¥1,500", "name", productIds[0], 1500, "sku", 1000, 4, "winner", "2026/08/27 10:00", 25, 1, "1729700000000000001"],
    ], "2026-08-27");
    expect(parsed.records[0]).toMatchObject({ productId: productIds[0], totalGmv: 1500, totalOrders: 1, auctionCount: 1, auctionDate: "2026-08-27" });
  });

  it("rejects scientific-notation IDs instead of silently corrupting them", () => {
    const rows = sampleRows();
    rows[1]![0] = "1.7296681879546164E+18";
    expect(() => parseAuctionExcelRows(rows, "2026-08-27")).toThrow(/商品ID/);
  });

  it("keeps the production import atomic, hash-idempotent and source-audited", () => {
    const service = fs.readFileSync(new URL("./auctionImportService.ts", import.meta.url), "utf8");
    const schema = fs.readFileSync(new URL("./auctionSchemaUpgrade.ts", import.meta.url), "utf8");
    const router = fs.readFileSync(new URL("./auctionRouter.ts", import.meta.url), "utf8");
    const client = fs.readFileSync(new URL("../client/src/pages/SelectionCenter.tsx", import.meta.url), "utf8");
    const startup = fs.readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    expect(service).toContain("beginTransaction");
    expect(service).toContain("rollback");
    expect(service).toContain("sourceFileSha256");
    expect(service).toContain("alreadyImported");
    expect(service).toContain("private/auction-imports/");
    expect(service).toContain("storagePut");
    expect(service).toContain("storageGet");
    expect(schema).toContain("sourceStorageKey");
    expect(schema).toContain("pre-auction-import-schema-v1");
    expect(schema).toContain("post-auction-import-schema-v1");
    expect(schema).toContain("roundsJson LONGTEXT");
    expect(router).not.toContain("ADD COLUMN IF NOT EXISTS roundsJson");
    expect(router).toContain("getImportFile");
    expect(client).toContain("sourceFileBase64");
    expect(client).toContain("ダウンロード");
    expect(startup).toContain("runAuctionSchemaUpgradeSetup");
  });
});

const attachedFile = process.env.AUCTION_SAMPLE_FILE;
if (attachedFile && fs.existsSync(attachedFile)) {
  describe("attached auction file", () => {
    it("parses the exact uploaded workbook", () => {
      const workbook = XLSX.read(fs.readFileSync(attachedFile), { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const parsed = parseAuctionExcelRows(rows, "2026-08-27");
      expect(parsed.sourceRowCount).toBe(11);
      expect(parsed.skippedRowCount).toBe(1);
      expect(parsed.records).toHaveLength(6);
      expect(parsed.records.reduce((sum, record) => sum + record.auctionCount, 0)).toBe(10);
      expect(parsed.records.map((record) => record.productId)).toEqual(productIds);
    });
  });
}
