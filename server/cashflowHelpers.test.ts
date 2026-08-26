import { describe, expect, it } from "vitest";
import {
  ACTIVE_CASHFLOW_ACCOUNTS,
  MAX_CASHFLOW_RECEIPTS,
  appendCashflowFilter,
  buildPayrollRecordKey,
  calculatePayrollDifference,
  canAppendCashflowReceipts,
  normalizePayrollEmployee,
  normalizePayrollMonth,
  parseCashflowReceiptUrls,
  payrollMonthEndDate,
} from "./cashflowHelpers";

describe("cashflowHelpers", () => {
  it("keeps only active accounts in the operational account list", () => {
    expect(ACTIVE_CASHFLOW_ACCOUNTS).toEqual([
      "世曜元宇(中信銀行)",
      "LCJ MITSUI",
      "LCJ RESONA",
    ]);
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

  it("uses the month end as the cashflow transaction date", () => {
    expect(payrollMonthEndDate("2026-06")).toBe("2026-06-30");
    expect(payrollMonthEndDate("2028-02")).toBe("2028-02-29");
  });

  it("rounds reconciliation differences to currency precision", () => {
    expect(calculatePayrollDifference(1000.1, 999.99)).toBe(0.11);
    expect(calculatePayrollDifference(1000, 1000)).toBe(0);
  });
});
