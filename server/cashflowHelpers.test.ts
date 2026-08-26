import { describe, expect, it } from "vitest";
import {
  ACTIVE_CASHFLOW_ACCOUNTS,
  CASHFLOW_ACCOUNT_IDENTITIES,
  MAX_CASHFLOW_RECEIPTS,
  appendCashflowFilter,
  buildPayrollRecordKey,
  calculatePayrollDifference,
  canAppendCashflowReceipts,
  isAuthoritativePaidLaborCashflow,
  isSettledPayrollCashflow,
  normalizePayrollEmployee,
  normalizePayrollMonth,
  parseCashflowReceiptUrls,
  payrollBankDescriptionMatches,
  payrollMonthEndDate,
  resolveCashflowIdentity,
} from "./cashflowHelpers";

describe("cashflowHelpers", () => {
  it("keeps only active accounts in the operational account list", () => {
    expect(ACTIVE_CASHFLOW_ACCOUNTS).toEqual([
      "世曜元宇(中信銀行)",
      "LCJ MITSUI",
      "LCJ RESONA",
    ]);
  });

  it("uses bank account ownership as the authoritative currency and entity", () => {
    expect(CASHFLOW_ACCOUNT_IDENTITIES["LCJ MITSUI"]).toEqual({ entity: "japan", currency: "JPY" });
    expect(resolveCashflowIdentity({ sourceAccount: "LCJ MITSUI", entity: "china", currency: "CNY" })).toEqual({
      entity: "japan",
      currency: "JPY",
      currencySource: "account",
    });
    expect(resolveCashflowIdentity({ sourceAccount: "世曜元宇(中信銀行)", entity: "japan", currency: "JPY" })).toEqual({
      entity: "china",
      currency: "CNY",
      currencySource: "account",
    });
  });

  it("uses payroll metadata before legacy entity fallback", () => {
    expect(resolveCashflowIdentity({ payrollRecordKey: "japan|2026-07|sample", entity: "china" })).toEqual({
      entity: "japan",
      currency: "JPY",
      currencySource: "payroll",
    });
    expect(resolveCashflowIdentity({ entity: "china" })).toEqual({
      entity: "china",
      currency: "CNY",
      currencySource: "entity",
    });
  });

  it("parses both legacy single URLs and JSON arrays", () => {
    expect(parseCashflowReceiptUrls("/legacy.png")).toEqual(["/legacy.png"]);
    expect(parseCashflowReceiptUrls('["/one.png","/two.pdf"]')).toEqual([
      "/one.png",
      "/two.pdf",
    ]);
    expect(parseCashflowReceiptUrls(null)).toEqual([]);
  });

  it("enforces the nine-file attachment limit", () => {
    expect(canAppendCashflowReceipts(8, 1)).toBe(true);
    expect(canAppendCashflowReceipts(8, 2)).toBe(false);
    expect(canAppendCashflowReceipts(MAX_CASHFLOW_RECEIPTS, 1)).toBe(false);
  });

  it("builds date and source-account filters with matching parameters", () => {
    const dateFiltered = appendCashflowFilter(
      "WHERE deletedAt IS NULL",
      [],
      "transactionDate",
      ">=",
      "2026-08-01",
    );
    const accountFiltered = appendCashflowFilter(
      dateFiltered.where,
      dateFiltered.params,
      "sourceAccount",
      "=",
      "LCJ MITSUI",
    );
    expect(accountFiltered.where).toBe(
      "WHERE deletedAt IS NULL AND transactionDate >= ? AND sourceAccount = ?",
    );
    expect(accountFiltered.params).toEqual(["2026-08-01", "LCJ MITSUI"]);
  });

  it("normalizes Japanese and Chinese payroll month formats", () => {
    expect(normalizePayrollMonth("2026年7月")).toBe("2026-07");
    expect(normalizePayrollMonth("2026/06")).toBe("2026-06");
    expect(normalizePayrollMonth("8月份工资提前发", 2026)).toBe("2026-08");
    expect(normalizePayrollMonth("", 2026)).toBeNull();
  });

  it("creates stable employee keys across spacing and width variants", () => {
    expect(normalizePayrollEmployee(" Ｓａｍｐｌｅ　社員 ")).toBe("sample社員");
    expect(buildPayrollRecordKey("japan", "2026-07", "Sample 社員")).toBe(
      "japan|2026-07|sample社員",
    );
  });

  it("matches bank payroll descriptions only when both employee alias and payroll month agree", () => {
    expect(payrollBankDescriptionMatches("付颖", "2026-07", "支付付颖7月工资")).toBe(true);
    expect(payrollBankDescriptionMatches("Chozen Kosaka", "2026-07", "支付Choco7月工资")).toBe(true);
    expect(payrollBankDescriptionMatches("村上紫保", "2026-06", "支付shiho6月工资")).toBe(true);
    expect(payrollBankDescriptionMatches("村上紫保", "2026-06", "支付shiho7月工资")).toBe(false);
    expect(payrollBankDescriptionMatches("王强", "2026-06", "支付李美静6月工资")).toBe(false);
  });

  it("uses the month end as the cashflow transaction date", () => {
    expect(payrollMonthEndDate("2026-06")).toBe("2026-06-30");
    expect(payrollMonthEndDate("2028-02")).toBe("2028-02-29");
  });

  it("rounds reconciliation differences to currency precision", () => {
    expect(calculatePayrollDifference(1000.1, 999.99)).toBe(0.11);
    expect(calculatePayrollDifference(1000, 1000)).toBe(0);
  });

  it("marks payroll as paid only when it is linked to a matching authoritative bank cashflow", () => {
    const settled = {
      cashflowId: 101,
      cashflowDeletedAt: null,
      cashflowType: "expense",
      cashflowCategory: "給与・人件費",
      cashflowAmount: 307538,
      netPay: 307538,
      sourceAccount: "LCJ MITSUI",
    };
    expect(isSettledPayrollCashflow(settled)).toBe(true);
    expect(isSettledPayrollCashflow({ ...settled, sourceAccount: null })).toBe(false);
    expect(isSettledPayrollCashflow({ ...settled, cashflowAmount: 307000 })).toBe(false);
    expect(isSettledPayrollCashflow({ ...settled, cashflowDeletedAt: new Date() })).toBe(false);
  });

  it("accepts paid labor only when currency matches the authoritative bank account", () => {
    expect(isAuthoritativePaidLaborCashflow({ currency: "CNY", sourceAccount: "世曜元宇(中信銀行)" })).toBe(true);
    expect(isAuthoritativePaidLaborCashflow({ currency: "JPY", sourceAccount: "LCJ MITSUI" })).toBe(true);
    expect(isAuthoritativePaidLaborCashflow({ currency: "JPY", sourceAccount: "LCJ RESONA" })).toBe(true);
    expect(isAuthoritativePaidLaborCashflow({ currency: "CNY", sourceAccount: "LCJ MITSUI" })).toBe(false);
    expect(isAuthoritativePaidLaborCashflow({ currency: "JPY", sourceAccount: "世曜元宇(中信銀行)" })).toBe(false);
    expect(isAuthoritativePaidLaborCashflow({ currency: "JPY", sourceAccount: null })).toBe(false);
  });
});
