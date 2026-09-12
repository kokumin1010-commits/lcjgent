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
    ]);

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
    ], { exchangeRate: 20.5 });

    expect(result.totals).toEqual({ jpy: 1000, cny: 10.02, referenceJpy: 1205.41 });
    expect(result.reconstructed.referenceJpy).toBe(1205.41);
    expect(result.difference.referenceJpy).toBe(0);
  });

  it("returns every payroll row after the existing finance unlock and preserves attachment links", () => {
    const result = buildCashflowReconciliation([
      row({ id: 1, amount: 200, isPayroll: true, counterparty: "员工A", payrollEmployee: "员工A", receiptUrl: "https://files.example/a.pdf" }),
      row({ id: 2, amount: 300, isPayroll: true, counterparty: "员工B", payrollEmployee: "员工B", importDocumentId: 91, importDocumentName: "2026-08-payroll.xlsx" }),
      row({ id: 3, amount: 50, category: "手续费", counterparty: "银行", description: "手续费" }),
    ]);

    expect(result.sourceRowCount).toBe(3);
    expect(result.displayRowCount).toBe(3);
    expect(result.payrollRowCount).toBe(2);
    expect(result.protectedPayrollRowCount).toBe(0);
    expect(result.totals.jpy).toBe(550);
    expect(result.difference.jpy).toBe(0);
    expect(result.items.find(item => item.id === 1)).toMatchObject({
      counterparty: "员工A",
      payrollEmployee: "员工A",
      receiptUrl: "https://files.example/a.pdf",
      payrollProtected: false,
    });
    expect(result.items.find(item => item.id === 2)).toMatchObject({
      counterparty: "员工B",
      importDocumentId: 91,
      importDocumentName: "2026-08-payroll.xlsx",
    });
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
  });

  it("uses the same search, category, currency and period filters for totals and reconciliation", () => {
    expect(cashflowPage).toContain("const reconciliationQuery = trpc.cashflow.getReconciliation.useQuery");
    for (const field of ["startDate", "endDate", "sourceAccount", "payrollMonth", "payrollEmployee", "category", "currency", "search"]) {
      expect(cashflowPage).toContain(`${field}:`);
    }
    expect(cashflowRouter).toContain("getReconciliation: financeProcedure");
    expect(cashflowRouter).toContain("逐笔核对范围超过5000笔");
  });

  it("returns payroll names and registered evidence without a second popup-only unlock", () => {
    const start = cashflowRouter.indexOf("getReconciliation: financeProcedure");
    const end = cashflowRouter.indexOf("// 銀行流水インポート", start);
    const section = cashflowRouter.slice(start, end);
    expect(section).not.toContain("hasPayrollAccess(ctx)");
    expect(section).not.toContain("AND NOT ${PAYROLL_PROTECTED_ROW_SQL}");
    expect(section).toContain("cf.receiptUrl, cf.payrollEmployee, cf.payrollMonth, cf.payrollRecordKey");
    expect(section).toContain("payrollDocument.id AS importDocumentId");
    expect(cashflowPage).not.toContain('requestPayrollAccess("popupDetails")');
    expect(cashflowPage).toContain("笔逐人工资明细已在下表直接完整显示");
    expect(cashflowPage).toContain("PDF／证凭");
    expect(cashflowPage).toContain("原文件");
    expect(cashflowPage).toContain("未登记");
  });
});
