import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");

function section(start: string, end: string) {
  const from = routerSource.indexOf(start);
  const to = routerSource.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return routerSource.slice(from, to);
}

describe("cashflow aggregate privacy and sorting", () => {
  it("keeps payroll rows hidden from the detailed list", () => {
    const source = section("  getAll: financeProcedure", "  // 月別サマリー");
    expect(source).toContain("PAYROLL_PROTECTED_ROW_SQL");
  });

  it("includes payroll totals in anonymous monthly, category, balance and filter aggregates", () => {
    const monthly = section("  getMonthlySummary: financeProcedure", "  // カテゴリ別サマリー");
    const category = section("  getCategorySummary: financeProcedure", "  // 入出金登録");
    const breakdown = section("  getCategoryBreakdown: financeProcedure", "  // カテゴリ一覧取得");
    const balanceHistory = section("  getBalanceHistory: financeProcedure", "  // 全体サマリー");
    const total = section("  getTotalSummary: financeProcedure", "  // 銀行流水インポート");
    const accountBalances = section("  getAccountBalances: financeProcedure", "  // 初期残高を設定");

    expect(monthly).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(category).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(breakdown).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(balanceHistory).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(total).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(accountBalances).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
  });

  it("still requires payroll access before an aggregate can filter by employee", () => {
    const total = section("  getTotalSummary: financeProcedure", "  // 銀行流水インポート");
    const breakdown = section("  getCategoryBreakdown: financeProcedure", "  // カテゴリ一覧取得");
    expect(total).toContain("if (input.payrollEmployee) await requirePayrollAccess(ctx)");
    expect(breakdown).toContain("if (input.payrollEmployee) await requirePayrollAccess(ctx)");
  });

  it("defaults to amount descending and exposes both amount directions", () => {
    expect(pageSource).toContain('useState<"transactionDate" | "amount" | "category" | "counterparty">("amount")');
    expect(pageSource).toContain('<option value="amount:desc">金额：从大到小</option>');
    expect(pageSource).toContain('<option value="amount:asc">金额：从小到大</option>');
    expect(pageSource).toContain('setSortBy("amount"); setSortOrder("desc")');
    expect(pageSource).toContain('筛选结果・收入金额{entity === "all" ? "（JPY参考）" : ""}');
    expect(pageSource).toContain('筛选结果・支出金额{entity === "all" ? "（JPY参考）" : ""}');
    expect(pageSource).toContain('1 CNY = ${EXCHANGE_RATE_CNY_JPY} JPY');
  });
});
