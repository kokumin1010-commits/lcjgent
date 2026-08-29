import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCashflowMonthRange } from "../client/src/lib/cashflowMonthFilter";
import { buildCashflowReconciliation, type CashflowReconciliationSourceRow } from "./cashflowReconciliation";

const cashflowPage = readFileSync(new URL("../client/src/pages/CashflowTab.tsx", import.meta.url), "utf8");
const cashflowRouter = readFileSync(new URL("./cashflowRouter.ts", import.meta.url), "utf8");

function row(input: Partial<CashflowReconciliationSourceRow> & Pick<CashflowReconciliationSourceRow, "id" | "amount">): CashflowReconciliationSourceRow {
  return {
    entity: "japan",
    type: "expense",
    category: "测试支出",
    currency: "JPY",
    transactionDate: "2026-06-15",
    counterparty: "测试交易方",
    description: "测试说明",
    sourceAccount: "LCJ MITSUI",
    ...input,
  };
}

describe("cashflow row-by-row reconciliation", () => {
  it("sorts amounts from largest to smallest and reconstructs the exact JPY total", () => {
    const result = buildCashflowReconciliation([
      row({ id: 1, amount: 100 }),
      row({ id: 2, amount: 300 }),
      row({ id: 3, amount: 50 }),
    ], { payrollUnlocked: true });

    expect(result.items.map(item => item.amount)).toEqual([300, 100, 50]);
    expect(result.items.map(item => item.runningJpy)).toEqual([300, 400, 450]);
    expect(result.totals.jpy).toBe(450);
    expect(result.reconstructed.jpy).toBe(450);
    expect(result.difference.jpy).toBe(0);
  });

  it("keeps JPY and CNY originals separate while producing a zero-difference JPY reference", () => {
    const result = buildCashflowReconciliation([
      row({ id: 1, amount: 1_000, currency: "JPY" }),
      row({ id: 2, amount: 10.01, currency: "CNY", entity: "china", sourceAccount: "世曜元宇(中信銀行)" }),
      row({ id: 3, amount: 0.01, currency: "CNY", entity: "china", sourceAccount: "世曜元宇(中信銀行)" }),
    ], { payrollUnlocked: true, exchangeRate: 20.5 });

    expect(result.totals).toEqual({ jpy: 1000, cny: 10.02, referenceJpy: 1205.41 });
    expect(result.reconstructed.referenceJpy).toBe(1205.41);
    expect(result.difference.referenceJpy).toBe(0);
  });

  it("includes payroll totals but masks personal payroll rows while payroll detail is locked", () => {
    const result = buildCashflowReconciliation([
      row({ id: 1, amount: 200, isPayroll: true, counterparty: "员工A", description: "员工A工资" }),
      row({ id: 2, amount: 300, isPayroll: true, counterparty: "员工B", description: "员工B工资" }),
      row({ id: 3, amount: 50, category: "手续费", counterparty: "银行", description: "手续费" }),
    ], { payrollUnlocked: false });

    expect(result.sourceRowCount).toBe(3);
    expect(result.displayRowCount).toBe(2);
    expect(result.protectedPayrollRowCount).toBe(2);
    expect(result.totals.jpy).toBe(550);
    expect(result.difference.jpy).toBe(0);
    const payroll = result.items.find(item => item.payrollProtected);
    expect(payroll).toMatchObject({ amount: 500, groupedCount: 2, counterparty: null, description: null });
  });

  it("returns individual payroll rows only after payroll detail is unlocked", () => {
    const result = buildCashflowReconciliation([
      row({ id: 1, amount: 200, isPayroll: true, counterparty: "员工A" }),
      row({ id: 2, amount: 300, isPayroll: true, counterparty: "员工B" }),
    ], { payrollUnlocked: true });

    expect(result.displayRowCount).toBe(2);
    expect(result.protectedPayrollRowCount).toBe(0);
    expect(result.items.map(item => item.counterparty)).toEqual(["员工B", "员工A"]);
  });
});

describe("cashflow month shortcuts", () => {
  it("maps June to the complete calendar month", () => {
    expect(buildCashflowMonthRange("2026-06")).toEqual({
      year: 2026,
      month: 6,
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });

  it("handles leap years and rejects malformed months", () => {
    expect(buildCashflowMonthRange("2028-02")?.end).toBe("2028-02-29");
    expect(buildCashflowMonthRange("2026-13")).toBeNull();
    expect(buildCashflowMonthRange("June 2026")).toBeNull();
  });
});

describe("cashflow reconciliation UI and route guardrails", () => {
  it("shows a month selector next to the detail filters and opens row-by-row addition", () => {
    expect(cashflowPage).toContain("onValueChange={applyMonthFilter}");
    expect(cashflowPage).toContain("月份：全部");
    expect(cashflowPage).toContain("点击查看逐笔相加");
    expect(cashflowPage).toContain('{reconciliationType === "income" ? "收入" : "支出"}逐笔累计核对');
    expect(cashflowPage).toContain("权威总额 − 逐笔累计");
    expect(cashflowPage).toContain("authoritativeFilteredCount");
    expect(cashflowPage).toContain("件已隐藏，但总额已计入");
  });

  it("uses the same search, category, currency and period filters for totals and reconciliation", () => {
    expect(cashflowPage).toContain("const reconciliationQuery = trpc.cashflow.getReconciliation.useQuery");
    for (const field of ["startDate", "endDate", "sourceAccount", "payrollMonth", "payrollEmployee", "category", "currency", "search"]) {
      expect(cashflowPage).toContain(`${field}:`);
    }
    expect(cashflowRouter).toContain("getReconciliation: financeProcedure");
    expect(cashflowRouter).toContain("逐笔核对范围超过5000笔");
  });

  it("includes payroll totals in ordinary reconciliation but blocks personal payroll name search before unlock", () => {
    const start = cashflowRouter.indexOf("getReconciliation: financeProcedure");
    const end = cashflowRouter.indexOf("// 銀行流水インポート", start);
    const section = cashflowRouter.slice(start, end);
    const searchStart = section.indexOf("if (input.search)");
    expect(section).toContain("const payrollUnlocked = await hasPayrollAccess(ctx)");
    expect(section).toContain("CASE WHEN ${PAYROLL_PROTECTED_ROW_SQL} THEN 1 ELSE 0 END AS isPayroll");
    expect(section.slice(0, searchStart)).not.toContain("AND NOT ${PAYROLL_PROTECTED_ROW_SQL}");
    expect(section.slice(searchStart)).toContain("if (!payrollUnlocked) where += ` AND NOT ${PAYROLL_PROTECTED_ROW_SQL}`");
  });
});
