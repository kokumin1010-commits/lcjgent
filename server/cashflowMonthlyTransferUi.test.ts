import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");

describe("cashflow monthly and transfer UI", () => {
  it("shows original currency and JPY reference for every category", () => {
    expect(pageSource).toContain('formatCurrency(cat.analysisAmountJpy, "JPY")');
    expect(pageSource).toContain('formatCurrency(cat.expenseAmountJpy, "JPY")');
    expect(pageSource).toContain('formatCurrency(cat.incomeAmountJpy, "JPY")');
    expect(pageSource).toContain("setCategoryDetail({ category: cat.category, currency: cat.currency })");
    expect(pageSource).toContain("逐笔详情");
  });

  it("switches the category dashboard between net expense and category income", () => {
    expect(pageSource).toContain("分类入金／净支出分析");
    expect(pageSource).toContain('onClick={() => setCategoryAnalysisMode("expense")}');
    expect(pageSource).toContain('onClick={() => setCategoryAnalysisMode("income")}');
    expect(pageSource).toContain('categoryAnalysisMode === "income" ? "分类入金" : "净支出"');
    expect(pageSource).toContain("按分类汇总实际入金");
    expect(pageSource).toContain("cat.analysisOriginalAmount");
    expect(pageSource).toContain("cat.analysisCount");
    expect(pageSource).toContain("cat.analysisPercentage");
  });

  it("places monthly income and expense below balance and allows exact month drilldown", () => {
    const balanceIndex = pageSource.indexOf("📊 残高推移");
    const monthlyIndex = pageSource.indexOf("📊 月別入金・月別出金");
    const categoryIndex = pageSource.indexOf("分类入金／净支出分析");
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
    expect(routerSource).toContain("AND cf.category NOT IN ('本社送金','口座間振替')");
  });

  it("only links real bank rows and never fabricates CNY from the management exchange rate", () => {
    expect(pageSource).toContain("选择实际出金");
    expect(pageSource).toContain("选择实际入金");
    expect(pageSource).toContain("系统不会按参考汇率自动造账");
    expect(pageSource).toContain("手续费另列");
  });

  it("opens all finance detail popups near full screen without truncating money columns", () => {
    expect(pageSource.match(/w-\[96vw\] max-w-\[96vw\]/g)?.length).toBeGreaterThanOrEqual(4);
    expect(pageSource.match(/h-\[94vh\] max-h-\[94vh\]/g)?.length).toBeGreaterThanOrEqual(4);
    expect(pageSource).toContain('grid-rows-[auto_minmax(0,1fr)_auto]');
    expect(pageSource).toContain('min-w-[1380px]');
    expect(pageSource).toContain('min-w-[1660px]');
    expect(pageSource).toContain('PDF／证凭');
    expect(pageSource).toContain('原文件');
    expect(pageSource).toContain('<th className="p-3 text-right">JPY参考</th>');
    expect(pageSource).toContain('formatCurrency(item.referenceAmountJpy, "JPY")');
    expect(pageSource).toContain('whitespace-normal break-words text-xs leading-5');
    expect(pageSource).not.toContain('max-w-[360px] truncate text-xs text-slate-500');
    expect(pageSource).not.toContain('max-w-[360px] truncate text-xs text-muted-foreground');
  });
});
