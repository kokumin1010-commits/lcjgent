import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { hasRecognizedStoreGmv, normalizeStoreShopStatsMatrix } from "../shared/storeShopStatsImport";
import { parseStoreShopStatsWorkbook, resolveStoreUploadData } from "./storeUploadReadModel";

const syntheticRows = [
  ["日期范围: 2026-10-01 ~ 2026-10-02"],
  [],
  ["时间", "直播归因 GMV (円)", "归因 SKU 订单数", "客户数（搜索）", "点击率（直播）"],
  ["2026-10-01", "120000", 12, 8, "3.5%"],
  ["2026-10-02", "230000", 21, 13, "4.1%"],
];

function workbookBuffer(rows: unknown[][]): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Core Stats");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("store shop-stat read model", () => {
  it("normalizes a Time header and live-attributed GMV into canonical daily rows and totals", () => {
    const parsed = normalizeStoreShopStatsMatrix(syntheticRows);
    expect(parsed?.headerRowIndex).toBe(2);
    expect(parsed?.dateHeader).toBe("时间");
    expect(parsed?.gmvHeader).toBe("直播归因 GMV (円)");
    expect(parsed?.businessDates).toEqual(["2026-10-01", "2026-10-02"]);
    expect(parsed?.data[0]).toMatchObject({
      _type: "summary",
      GMV: { value: 350000, pct: 0 },
      注文: { value: 33, pct: 0 },
      カスタマー数: { value: 21, pct: 0 },
    });
    expect(parsed?.data[1]).toMatchObject({ 日期: "2026-10-01", GMV: 120000, 注文: 12, カスタマー数: 8 });
    expect(parsed?.data[0]).not.toHaveProperty("点击率（直播）");
    expect(hasRecognizedStoreGmv(parsed?.data || [])).toBe(true);
  });

  it("parses the same format directly from an xlsx buffer without changing the file", () => {
    const source = workbookBuffer(syntheticRows);
    const before = Buffer.from(source);
    const rows = parseStoreShopStatsWorkbook(source);
    expect(rows?.[0]).toMatchObject({ GMV: { value: 350000, pct: 0 } });
    expect(source.equals(before)).toBe(true);
  });

  it("keeps valid stored JSON and does not require an original-file read", async () => {
    const stored = [{ _type: "summary", GMV: { value: 350000 } }, { 日期: "2026-10-01", GMV: 120000 }];
    const resolved = await resolveStoreUploadData({ id: 1, dataType: "shop_stats", dataJson: JSON.stringify(stored) });
    expect(resolved.source).toBe("stored_json");
    expect(resolved.data).toEqual(stored);
  });

  it("uses the read-only resolver in overview, detail, daily trend, command center and future uploads", () => {
    const execution = readFileSync("server/storeExecutionRouter.ts", "utf8");
    const management = readFileSync("server/storeManagementRouter.ts", "utf8");
    const commandCenter = readFileSync("server/storeCommandCenterRouter.ts", "utf8");
    const page = readFileSync("client/src/pages/StoreManagement.tsx", "utf8");
    const readModel = readFileSync("server/storeUploadReadModel.ts", "utf8");
    expect(execution).toContain("resolveStoreUploadData(upload)");
    expect(management).toContain("resolveStoreUploadData(row)");
    expect(management).toContain("resolveStoreUploadData(upload)");
    expect(commandCenter).toContain("resolveStoreUploadData(upload as any)");
    expect(page).toContain("normalizeStoreShopStatsMatrix(raw)");
    expect(readModel).toContain("storageGet");
    expect(readModel).not.toContain("storagePut");
    expect(readModel).not.toContain("UPDATE store_data_uploads");
    expect(readModel).not.toContain("INSERT INTO store_data_uploads");
  });
});
