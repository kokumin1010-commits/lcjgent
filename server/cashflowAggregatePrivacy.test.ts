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
  it("uses the existing finance unlock as the single read boundary and returns payroll rows in the detailed list", () => {
    const source = section("  getAll: financeProcedure", "  // 月別サマリー");
    expect(source).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(source).not.toContain("hasPayrollAccess(ctx)");
    expect(source).toContain("SELECT * FROM company_cashflows");
  });

  it("keeps payroll totals in monthly, category, balance and filter aggregates", () => {
    const monthly = section("  getMonthlySummary: financeProcedure", "  // カテゴリ別サマリー");
    const category = section("  getCategorySummary: financeProcedure", "  // 入出金登録");
    const breakdown = section("  getCategoryBreakdown: financeProcedure", "  // 分类主数据");
    const balanceHistory = section("  getBalanceHistory: financeProcedure", "  // 全体サマリー");
    const total = section("  getTotalSummary: financeProcedure", "  // 逐笔累计对账");
    const accountBalances = section("  getAccountBalances: financeProcedure", "  // 初期残高を設定");

    expect(monthly).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(category).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(breakdown).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(balanceHistory).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
    expect(total).not.toContain("hasPayrollAccess(ctx)");
    expect(total).not.toContain("requirePayrollAccess(ctx)");
    expect(accountBalances).not.toContain("PAYROLL_PROTECTED_ROW_SQL");
  });

  it("allows employee filtering inside the already finance-unlocked page without a duplicate popup lock", () => {
    const total = section("  getTotalSummary: financeProcedure", "  // 逐笔累计对账");
    const reconciliation = section("  getReconciliation: financeProcedure", "  // 銀行流水インポート");
    expect(total).toContain('if (input.payrollEmployee) { dateFilter += " AND payrollEmployee = ?"');
    expect(total).not.toContain("requirePayrollAccess(ctx)");
    expect(reconciliation).toContain('if (input.payrollEmployee) { where += " AND cf.payrollEmployee = ?"');
    expect(reconciliation).not.toContain("requirePayrollAccess(ctx)");
  });

  it("allows payroll read APIs and source-document download after the finance unlock while keeping payroll writes protected", () => {
    expect(routerSource).toContain("getPayrollReconciliation: financeProcedure");
    expect(routerSource).toContain("getPayrollCommandCenter: financeProcedure");
    const documents = section("  getImportDocuments: financeProcedure", "  // インポート履歴取得");
    expect(documents).not.toContain("hasPayrollAccess(ctx)");
    expect(documents).not.toContain("requirePayrollAccess(ctx)");
    expect(routerSource).toContain("importPayroll: financePayrollProcedure");
    expect(routerSource).toContain("upsertPayrollEmployeeAlias: financePayrollProcedure");
  });

  it("still keeps the CEO command-center aggregate free of payroll names and payroll files", () => {
    const commandCenter = section("  getFinanceCommandCenter: financeProcedure", "  // 入出金一覧取得");
    expect(commandCenter).toContain("THEN NULL ELSE counterparty");
    expect(commandCenter).toContain("THEN NULL ELSE description");
    expect(commandCenter).toContain("THEN NULL ELSE receiptUrl");
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
