import { describe, expect, it } from "vitest";
import {
  buildImportedStoreDailyRows,
  importedStoreDailyCoverage,
  resolveStorePeriodAdMetrics,
  summarizeImportedStoreDailyRows,
  type StoreDataUploadSnapshot,
} from "./storeImportedDailyTrend";

function upload(input: Partial<StoreDataUploadSnapshot> & Pick<StoreDataUploadSnapshot, "id" | "dataType" | "dataJson">): StoreDataUploadSnapshot {
  return {
    year: 2026,
    month: 9,
    fileName: "synthetic.xlsx",
    recordCount: Array.isArray(input.dataJson) ? input.dataJson.length : 0,
    versionNumber: 1,
    isCurrent: 1,
    uploadedAt: "2026-09-03T02:00:00.000Z",
    ...input,
  };
}

describe("three-source imported daily trend", () => {
  it("uses the selected-period ad upload total before legacy monthly plan values", () => {
    const result = resolveStorePeriodAdMetrics({
      importedDayCount: 3,
      importedAdCost: 900,
      importedAdGmv: 18_000,
      planRows: [{ adSpend: 25, adAttributedGmv: 10_000 }],
    });
    expect(result).toEqual({
      adSpend: 900,
      adGmv: 18_000,
      adRoi: 20,
      source: "store_ads_upload",
    });
  });

  it("falls back to monthly plan only when no dated ad upload exists", () => {
    expect(resolveStorePeriodAdMetrics({
      importedDayCount: 0,
      importedAdCost: null,
      importedAdGmv: null,
      planRows: [
        { adSpend: 40, adAttributedGmv: 400 },
        { adSpend: 60, adAttributedGmv: 900 },
      ],
    })).toEqual({
      adSpend: 100,
      adGmv: 1_300,
      adRoi: 13,
      source: "ad_monthly_plans",
    });

    expect(resolveStorePeriodAdMetrics({
      importedDayCount: 1,
      importedAdCost: 88,
      importedAdGmv: null,
      planRows: [],
    })).toEqual({
      adSpend: 88,
      adGmv: null,
      adRoi: null,
      source: "store_ads_upload",
    });
  });

  it("combines shop and ad daily rows without adding product snapshots into store GMV", () => {
    const rows = buildImportedStoreDailyRows([
      upload({ id: 1, dataType: "shop_stats", dataJson: [
        { 日期: "2026-09-01", GMV: "1,000", 订单数: "10", 客户数: "8", 退款金额: "100", 页面浏览次数: "300", 商品访客数: "100", 转化率: "8%" },
        { 日期: "2026-09-02", GMV: "2,000", 订单数: "20", 客户数: "15", 退款金额: "0" },
      ] }),
      upload({ id: 2, dataType: "ads", dataJson: [
        { 按天: "2026-09-01", 成本: "100", "Gross revenue (Current shop)": "500", "SKU orders (Current shop)": "5" },
        { 按天: "2026-09-02", 成本: "200", "Gross revenue (Current shop)": "800", "SKU orders (Current shop)": "7" },
      ] }),
      upload({ id: 3, dataType: "products", uploadedAt: "2026-09-02T03:00:00.000Z", dataJson: [
        { 商品名: "Synthetic A", "商品 ID": "p-1", GMV: "900", 订单数: "9", 商品成交件数: "10" },
        { 商品名: "Synthetic B", "商品 ID": "p-2", GMV: "600", 订单数: "6", 商品成交件数: "7" },
      ] }),
    ], "2026-09-01", "2026-09-03");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ businessDate: "2026-09-01", gmv: 1000, adCost: 100, adGmv: 500, adRoi: 5 });
    expect(rows[1]).toMatchObject({
      businessDate: "2026-09-02",
      gmv: 2000,
      adCost: 200,
      adGmv: 800,
      productGmv: 1500,
      productOrders: 15,
      productSoldQuantity: 17,
      productSkuCount: 2,
    });
    expect(rows[1].sourceTypes).toEqual(["shop_stats", "ads", "products"]);

    const summary = summarizeImportedStoreDailyRows(rows);
    expect(summary).toMatchObject({ gmv: 3000, orderCount: 30, customerCount: 23, refundAmount: 100, adCost: 300, adGmv: 1300, adOrders: 12 });
    expect(summary.adRoi).toBeCloseTo(1300 / 300);
    expect(summary.latestProductSnapshot).toMatchObject({ businessDate: "2026-09-02", gmv: 1500, skuCount: 2 });
  });

  it("uses only the current shop and ad generations while preserving product upload snapshots", () => {
    const rows = buildImportedStoreDailyRows([
      upload({ id: 10, dataType: "shop_stats", isCurrent: 0, versionNumber: 1, dataJson: [{ 日期: "2026-09-01", GMV: 999999 }] }),
      upload({ id: 11, dataType: "shop_stats", isCurrent: 1, versionNumber: 2, dataJson: [{ 日期: "2026-09-01", GMV: 123 }] }),
      upload({ id: 12, dataType: "ads", isCurrent: 0, versionNumber: 1, dataJson: [{ 按天: "2026-09-01", 成本: 999 }] }),
      upload({ id: 13, dataType: "ads", isCurrent: 1, versionNumber: 2, dataJson: [{ 按天: "2026-09-01", 成本: 20 }] }),
      upload({ id: 14, dataType: "products", isCurrent: 0, versionNumber: 1, uploadedAt: "2026-09-01T01:00:00.000Z", dataJson: [{ 商品名: "Snapshot 1", "商品 ID": "p-1", GMV: 50 }] }),
      upload({ id: 15, dataType: "products", isCurrent: 1, versionNumber: 2, uploadedAt: "2026-09-02T01:00:00.000Z", dataJson: [{ 商品名: "Snapshot 2", "商品 ID": "p-2", GMV: 80 }] }),
    ], "2026-09-01", "2026-09-02");

    expect(rows[0]).toMatchObject({ businessDate: "2026-09-01", gmv: 123, adCost: 20, productGmv: 50 });
    expect(rows[1]).toMatchObject({ businessDate: "2026-09-02", productGmv: 80 });
    expect(importedStoreDailyCoverage(rows)).toEqual({
      shopStats: { count: 1, firstDate: "2026-09-01", lastDate: "2026-09-01" },
      products: { count: 2, firstDate: "2026-09-01", lastDate: "2026-09-02" },
      ads: { count: 1, firstDate: "2026-09-01", lastDate: "2026-09-01" },
    });
  });

  it("keeps unavailable metrics null instead of manufacturing zero values", () => {
    const rows = buildImportedStoreDailyRows([
      upload({ id: 20, dataType: "ads", dataJson: [{ 按天: "2026-09-01", 成本: "88" }] }),
    ], "2026-09-01", "2026-09-02");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ gmv: null, orderCount: null, refundAmount: null, adCost: 88, adGmv: null });
    expect(summarizeImportedStoreDailyRows(rows)).toMatchObject({ gmv: null, orderCount: null, refundAmount: null, adCost: 88, adGmv: null, adRoi: null, dayCount: 0 });
  });

  it("uses a real business date from dated product rows instead of the upload date", () => {
    const rows = buildImportedStoreDailyRows([
      upload({ id: 30, dataType: "products", uploadedAt: "2026-09-09T03:00:00.000Z", dataJson: [
        { 日期: "2026-09-04", 商品名: "Dated product", "商品 ID": "p-30", GMV: 456, 订单数: 4 },
      ] }),
    ], "2026-09-01", "2026-09-10");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ businessDate: "2026-09-04", productGmv: 456, productOrders: 4 });
  });

  it("retains dated product rows from superseded daily uploads and lets a newer same-day version win", () => {
    const rows = buildImportedStoreDailyRows([
      upload({ id: 40, dataType: "products", isCurrent: 0, versionNumber: 1, uploadedAt: "2026-09-01T03:00:00.000Z", dataJson: [
        { 日期: "2026-09-01", 商品名: "Day 1", "商品 ID": "p-40", GMV: 100 },
      ] }),
      upload({ id: 41, dataType: "products", isCurrent: 0, versionNumber: 2, uploadedAt: "2026-09-02T03:00:00.000Z", dataJson: [
        { 日期: "2026-09-02", 商品名: "Day 2 old", "商品 ID": "p-41", GMV: 200 },
      ] }),
      upload({ id: 42, dataType: "products", isCurrent: 1, versionNumber: 3, uploadedAt: "2026-09-02T04:00:00.000Z", dataJson: [
        { 日期: "2026-09-02", 商品名: "Day 2 new", "商品 ID": "p-42", GMV: 250 },
      ] }),
    ], "2026-09-01", "2026-09-02");
    expect(rows.map(row => ({ date: row.businessDate, productGmv: row.productGmv }))).toEqual([
      { date: "2026-09-01", productGmv: 100 },
      { date: "2026-09-02", productGmv: 250 },
    ]);
  });
});
