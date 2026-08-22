import { describe, expect, it } from "vitest";
import {
  ACTIVE_CASHFLOW_ACCOUNTS,
  MAX_CASHFLOW_RECEIPTS,
  appendCashflowFilter,
  canAppendCashflowReceipts,
  parseCashflowReceiptUrls,
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
});
