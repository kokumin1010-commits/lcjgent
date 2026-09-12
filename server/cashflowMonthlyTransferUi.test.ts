import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");

describe("cashflow monthly and transfer UI", () => {
  it("shows original currency and JPY reference for every category", () => {
    expect(pageSource).toContain('JPY参考 {formatCurrency(cat.normalizedAmountJpy, "JPY")}');
    expect(pageSource).toContain('formatCurrency(cat.expenseAmountJpy, "JPY")');
    expect(pageSource).toContain('formatCurrency(cat.incomeAmountJpy, "JPY")');
    expect(pageSource).toContain("setCategoryDetail({ category: cat.category, currency: cat.currency })");
    expect(pageSource).toContain("逐笔详情");
  });

  it("places monthly income and expense below balance and allows exact month drilldown", () => {
    const balanceIndex = pageSource.indexOf("📊 残高推移");
    const monthlyIndex = pageSource.indexOf("📊 月別入金・月別出金");
    const categoryIndex = pageSource.indexOf("カテゴリ別純支出分析");
    expect(balanceIndex).toBeGreaterThan(-1);
    expect(monthlyIndex).toBeGreaterThan(balanceIndex);
    expect(categoryIndex).toBeGreaterThan(monthlyIndex);
    expect(pageSource).toContain("applyMonthFilter(month)");
    expect(pageSource).toContain("setReconciliationExcludeInternalTransfers(true)");
    expect(pageSource).toContain("内部转账另列，不进入经营入出金");
  });

  it("uses the same source-account filter and excludes internal transfers in drilldown", () => {
    expect(pageSource).toContain("getMonthlySummary.useQuery({ entity, months: 36, sourceAccount: sourceAccountFilter || undefined })");
    expect(routerSource).toContain("excludeInternalTransfers: z.boolean().default(false)");
    expect(routerSource).toContain("AND category NOT IN ('本社送金','口座間振替')");
  });

  it("only links real bank rows and never fabricates CNY from the management exchange rate", () => {
    expect(pageSource).toContain("选择实际出金");
    expect(pageSource).toContain("选择实际入金");
    expect(pageSource).toContain("系统不会按参考汇率自动造账");
    expect(pageSource).toContain("手续费另列");
  });
});
