import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseDailyShopFile } from "./storeDailyShopImport";

function workbookBuffer(rows: unknown[][]): Buffer {
  return workbookBufferWithSheets([{ name: "Sheet1", rows }]);
}

function workbookBufferWithSheets(sheets: Array<{ name: string; rows: unknown[][] }>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

const headers = [
  "日期","GMV","订单数","客户数","商品成交件数","退款金额","SKU 订单数","总成交额",
  "页面浏览次数","商品访客数","转化率","商品曝光次数","去重商品曝光次数","商品点击量",
  "去重点击次数","平均订单金额","达人直播归因 GMV","达人直播 GMV","达人直播间接 GMV",
  "绑定账号直播归因 GMV","商家直播 GMV","商家直播间接 GMV","联盟视频归因 GMV",
  "达人视频 GMV","达人视频间接 GMV","绑定账号视频归因 GMV","商家视频 GMV","商家视频间接 GMV",
];

const values = [
  "01/09/2026",860458,40,33,41,445188,41,952251,2656,467,0.07066381156316917,55123,
  19889,2753,491,20987,856723,856723,0,0,0,0,0,0,0,0,0,0,
];

function sampleRows(extraDailyRows: unknown[][] = []) {
  return [
    ["分析日期：01/09/2026-01/09/2026", "对比日期：31/08/2026-31/08/2026"],
    ["数据概览"],
    ["", ...headers.slice(1)],
    ["总计值", ...values.slice(1)],
    ["百分比变化", "-37.95%", "-43.66%", "-42.11%"],
    [],
    [],
    ["每日数据"],
    headers,
    values,
    ...extraDailyRows,
  ];
}

describe("daily shop file parser", () => {
  it("parses the provided 2026-09-01 LCJ shop format and exact key metrics", () => {
    const parsed = parseDailyShopFile({
      fileName: "9月1号lcj店铺.xlsx",
      fileBuffer: workbookBuffer(sampleRows()),
    });
    expect(parsed.detectedBusinessDate).toBe("2026-09-01");
    expect(parsed.businessDates).toEqual(["2026-09-01"]);
    expect(parsed.metrics).toMatchObject({
      gmv: 860458,
      orderCount: 40,
      customerCount: 33,
      soldQuantity: 41,
      refundAmount: 445188,
      skuOrderCount: 41,
      grossRevenue: 952251,
      pageViews: 2656,
      productVisitors: 467,
      conversionRate: 0.07066381156316917,
      creatorLiveAttributedGmv: 856723,
    });
    expect(parsed.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.quality.missingRequiredMetrics).toEqual([]);
  });

  it("rejects a multi-day workbook when no business date is selected", () => {
    expect(() => parseDailyShopFile({
      fileName: "two-days.xlsx",
      fileBuffer: workbookBuffer(sampleRows([["02/09/2026", ...values.slice(1)]])),
    })).toThrow("営業日を選択");
  });

  it("selects the requested date from a multi-day workbook without mixing rows", () => {
    const parsed = parseDailyShopFile({
      fileName: "key-metrics.xlsx",
      businessDate: "2026-09-02",
      fileBuffer: workbookBuffer(sampleRows([["02/09/2026", 222000, ...values.slice(2)]])),
    });
    expect(parsed.detectedBusinessDate).toBe("2026-09-02");
    expect(parsed.businessDates).toEqual(["2026-09-01", "2026-09-02"]);
    expect(parsed.metrics.gmv).toBe(222000);
    expect(parsed.quality.warnings.join(" ")).toContain("已按所选业务日期提取1行");
  });

  it("scans every worksheet and accepts a Date column outside the first column", () => {
    const parsed = parseDailyShopFile({
      fileName: "shop-analytics-key-metrics.xlsx",
      businessDate: "2026-09-14",
      fileBuffer: workbookBufferWithSheets([
        { name: "Cover", rows: [["Shop Analytics"], ["Generated report"]] },
        { name: "Key metrics", rows: [
          ["Analysis date", "2026/09/14"],
          [],
          ["No.", "Date", "Gross revenue", "Orders", "Customers", "Refund amount"],
          [1, "09/14/2026", 19800, 31, 20, 500],
        ] },
      ]),
    });
    expect(parsed.sourceSheetIndex).toBe(1);
    expect(parsed.detectedLayout).toBe("daily_rows");
    expect(parsed.detectedBusinessDate).toBe("2026-09-14");
    expect(parsed.metrics).toMatchObject({ gmv: 19800, orderCount: 31, customerCount: 20, refundAmount: 500 });
  });

  it("parses a transposed Key metrics sheet with dates in columns", () => {
    const parsed = parseDailyShopFile({
      fileName: "shop-analytics-key-metrics.xlsx",
      businessDate: "2026-09-14",
      fileBuffer: workbookBuffer([
        ["Metric", "09/14/2026", "09/13/2026"],
        ["Gross revenue", 19800, 17500],
        ["Orders", 31, 25],
        ["Customers", 20, 18],
        ["Refund amount", 500, 200],
      ]),
    });
    expect(parsed.detectedLayout).toBe("date_columns");
    expect(parsed.businessDates).toEqual(["2026-09-13", "2026-09-14"]);
    expect(parsed.metrics).toMatchObject({ gmv: 19800, orderCount: 31, customerCount: 20, refundAmount: 500 });
  });

  it("uses a single-day analysis summary when no daily detail table exists", () => {
    const parsed = parseDailyShopFile({
      fileName: "shop-analytics-summary.xlsx",
      businessDate: "2026-09-14",
      fileBuffer: workbookBuffer([
        ["Analysis date", "2026/09/14"],
        [],
        ["", "GMV", "注文数", "カスタマー数", "返金金額"],
        ["Total", 19800, 31, 20, 500],
      ]),
    });
    expect(parsed.detectedLayout).toBe("single_day_summary");
    expect(parsed.detectedBusinessDate).toBe("2026-09-14");
    expect(parsed.metrics).toMatchObject({ gmv: 19800, orderCount: 31, customerCount: 20, refundAmount: 500 });
  });

  it("uses the selected date for a Key metrics summary only when GMV is present", () => {
    const parsed = parseDailyShopFile({
      fileName: "shop-analytics-key-metrics.xlsx",
      businessDate: "2026-09-14",
      fileBuffer: workbookBuffer([
        ["Shop analytics"],
        ["GMV", "Orders", "Customers", "Refund amount"],
        [19800, 31, 20, 500],
      ]),
    });
    expect(parsed.detectedLayout).toBe("single_day_summary");
    expect(parsed.detectedBusinessDate).toBe("2026-09-14");
    expect(parsed.metrics).toMatchObject({ gmv: 19800, orderCount: 31, customerCount: 20, refundAmount: 500 });
    expect(parsed.quality.warnings.join(" ")).toContain("已使用所选业务日期");
  });

  it("rejects an invalid xlsx signature before parsing", () => {
    expect(() => parseDailyShopFile({
      fileName: "fake.xlsx",
      fileBuffer: Buffer.from("not-an-xlsx"),
    })).toThrow("XLSX実体");
  });
});

describe("three-source daily trend contract", () => {
  const router = readFileSync("server/storeManagementRouter.ts", "utf8");
  const upgrade = readFileSync("server/storeDailyShopUpgrade.ts", "utf8");
  const panel = readFileSync("client/src/components/StoreDailyShopPanel.tsx", "utf8");
  const commandCenter = readFileSync("client/src/components/StoreGrowthCommandCenter.tsx", "utf8");
  const trendSection = router.split("getDailyShopTrend:")[1]?.split("getDailyShopOriginalFile:")[0] || "";

  it("keeps historical daily tables without using them as the new trend source", () => {
    expect(upgrade).toContain("store_daily_shop_imports");
    expect(upgrade).toContain("store_daily_shop_metrics");
    expect(upgrade).toContain("existingMonthlyRowsModified: 0");
    expect(trendSection).toContain("loadImportedStoreUploads");
    expect(trendSection).toContain("buildImportedStoreDailyRows");
    expect(trendSection).toContain("source:'store_data_uploads'");
    expect(trendSection).not.toContain("loadDailyShopRows");
    expect(trendSection).not.toContain("store_daily_shop_metrics");
  });

  it("keeps the three-type primary upload procedure and current version key", () => {
    expect(router).toContain("uploadData: protectedProcedure");
    expect(router).toContain("dataType: z.enum(['shop_stats', 'products', 'ads'])");
    expect(router).toContain("WHERE storeId=? AND year=? AND month=? AND dataType=? AND isCurrent=1");
    expect(router).toContain("UPDATE store_data_uploads SET isCurrent=0 WHERE storeId=? AND year=? AND month=? AND dataType=?");
  });

  it("removes the independent upload and file-history UI while retaining the daily trend", () => {
    expect(commandCenter).toContain("<StoreDailyShopPanel");
    expect(commandCenter).toContain("CSV导入中心 V3");
    for (const removed of [
      "每日文件上传",
      "店铺每日文件",
      "确认导入每日数据",
      "按日期查看",
      "尚未上传每日店铺文件",
      "版本历史",
      "previewDailyShopFile.useMutation",
      "importDailyShopFile.useMutation",
      "deleteDailyShopImport.useMutation",
      "restoreDailyShopImport.useMutation",
    ]) expect(panel).not.toContain(removed);
    for (const label of [
      "每日趋势",
      "来源：三类主上传",
      "店铺数据",
      "商品数据",
      "广告数据",
      "GMV / 退款金额",
      "订单 / 客户 / 成交件数",
      "广告消耗 / 广告GMV",
      "商品上传快照",
      "缺失日不会按0绘图",
    ]) expect(panel).toContain(label);
  });

  it("returns source coverage and never exposes uploaded dataJson to the browser", () => {
    expect(trendSection).toContain("sourceCoverage:coverage");
    expect(trendSection).toContain("uploads.map(({dataJson:_dataJson,...upload}) => upload)");
    expect(trendSection).toContain("missingDates");
    expect(trendSection).toContain("previousPeriod");
  });
});
