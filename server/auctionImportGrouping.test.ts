import fs from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseAuctionExcelRows } from "@shared/auctionExcelParser";

const headers = ["商品ID", "商品名", "在庫", "商品の販売数", "GMV", "商品", "PID", "SKU ID", "入札開始価格", "販売価格", "当選者", "入札者", "開始時間", "時間"];

describe("auction Excel product-name grouping", () => {
  it("groups normalized identical product names and keeps a zero-auction product", () => {
    const parsed = parseAuctionExcelRows([
      headers,
      ["1737000000000000001", " 同名商品 ", 10, 2, 6000, "SKU A", "1737000000000000001", "1737100000000000001", 1000, 3000, "A", 1, "2026-08-27 10:00", 30],
      ["1737000000000000002", "同名商品", 10, 2, 6000, "SKU A", "1737000000000000002", "1737100000000000001", 1000, 3000, "B", 1, "2026-08-27 10:05", 30],
      ["1737000000000000003", "零成交商品", 10, 0, 0, "-", "1737000000000000003", "-", 0, 0, "-", 0, "-", 0],
    ], "2026-08-27");
    expect(parsed).toMatchObject({ sourceRowCount: 3, skippedRowCount: 1, roundCount: 2, uniqueSkuCount: 1 });
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({ productName: "同名商品", auctionCount: 2 });
    expect(parsed.records[1]).toMatchObject({ productName: "零成交商品", auctionCount: 0, finalPrice: null });
  });

  const attachedFile = process.env.AUCTION_SAMPLE_FILE;
  if (attachedFile && fs.existsSync(attachedFile)) {
    it("parses the user's workbook into five products and seventeen auction events", () => {
      const workbook = XLSX.read(fs.readFileSync(attachedFile), { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet!, { header: 1, raw: false, defval: "" });
      const parsed = parseAuctionExcelRows(rows, "2026-08-27");
      expect(parsed).toMatchObject({ sourceRowCount: 18, skippedRowCount: 1, roundCount: 17, uniqueSkuCount: 10 });
      expect(parsed.records).toHaveLength(5);
      expect(parsed.records.find(record => record.productName.includes("ネイチャーブースター"))).toMatchObject({ auctionCount: 0 });
    });
  }
});
