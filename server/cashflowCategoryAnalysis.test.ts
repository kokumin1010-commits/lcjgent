import { describe, expect, it } from "vitest";
import { buildCashflowCategoryAnalysisRows } from "../client/src/lib/cashflowCategoryAnalysis";

const rows = [
  {
    category: "销售回款",
    currency: "JPY" as const,
    totalAmount: -900,
    normalizedAmountJpy: -900,
    incomeAmount: 1_000,
    incomeAmountJpy: 1_000,
    incomeCount: 4,
    count: 5,
    percentage: 0,
    isInternalTransfer: false,
  },
  {
    category: "平台结算",
    currency: "CNY" as const,
    totalAmount: -20,
    normalizedAmountJpy: -410,
    incomeAmount: 20,
    incomeAmountJpy: 410,
    incomeCount: 2,
    count: 2,
    percentage: 0,
    isInternalTransfer: false,
  },
  {
    category: "本社送金",
    currency: "JPY" as const,
    totalAmount: -5_000,
    normalizedAmountJpy: -5_000,
    incomeAmount: 5_000,
    incomeAmountJpy: 5_000,
    incomeCount: 1,
    count: 1,
    percentage: 0,
    isInternalTransfer: true,
  },
  {
    category: "商品仕入",
    currency: "JPY" as const,
    totalAmount: 800,
    normalizedAmountJpy: 800,
    incomeAmount: 0,
    incomeAmountJpy: 0,
    incomeCount: 0,
    count: 3,
    percentage: 40,
    isInternalTransfer: false,
  },
];

describe("cashflow category income and expense analysis", () => {
  it("ranks category income by JPY reference while preserving original currency and counts", () => {
    const result = buildCashflowCategoryAnalysisRows(rows, "income");

    expect(result.map((row) => row.category)).toEqual(["本社送金", "销售回款", "平台结算"]);
    expect(result.find((row) => row.category === "商品仕入")).toBeUndefined();
    expect(result.find((row) => row.category === "销售回款")).toMatchObject({
      analysisOriginalAmount: 1_000,
      analysisAmountJpy: 1_000,
      analysisCount: 4,
      analysisPercentage: 70.9,
    });
    expect(result.find((row) => row.category === "平台结算")).toMatchObject({
      analysisOriginalAmount: 20,
      analysisAmountJpy: 410,
      analysisCount: 2,
      analysisPercentage: 29.1,
    });
  });

  it("marks internal transfers separately and excludes them from operating income share", () => {
    const result = buildCashflowCategoryAnalysisRows(rows, "income");
    expect(result.find((row) => row.category === "本社送金")?.analysisPercentage).toBeNull();
  });

  it("keeps the existing net-expense amount, count and percentage contract", () => {
    const result = buildCashflowCategoryAnalysisRows(rows, "expense");
    expect(result[0]).toMatchObject({
      category: "商品仕入",
      analysisOriginalAmount: 800,
      analysisAmountJpy: 800,
      analysisCount: 3,
      analysisPercentage: 40,
    });
  });
});
