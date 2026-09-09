import { describe, expect, it } from "vitest";
import {
  normalizeReceiptPurchaseDate,
  receiptDateInputValue,
  receiptPurchaseDateOrUndefined,
} from "../shared/receiptDate";

describe("receipt purchase date normalization", () => {
  it.each([
    ["2026-08-29", "2026-08-29"],
    ["2026/8/29 11:51", "2026-08-29"],
    ["2026年8月29日 11:51", "2026-08-29"],
    ["2026.08.29", "2026-08-29"],
    ["2026-08-29T11:51:00+09:00", "2026-08-29"],
  ])("normalizes %s without throwing", (input, expectedDate) => {
    const result = normalizeReceiptPurchaseDate(input);
    expect(result.valid).toBe(true);
    expect(result.date).toBeInstanceOf(Date);
    expect(Number.isFinite(result.date!.getTime())).toBe(true);
    expect(result.normalizedIsoDate).toBe(expectedDate);
  });

  it.each([
    null,
    undefined,
    "",
    "not-a-date",
    "2026-02-31",
    "2026年13月1日",
    Number.NaN,
    new Date(Number.NaN),
  ])("omits invalid value %s instead of creating an Invalid Date", input => {
    const result = normalizeReceiptPurchaseDate(input);
    expect(result).toEqual({ normalizedIsoDate: null, valid: false });
    expect(receiptPurchaseDateOrUndefined(input)).toBeUndefined();
    expect(receiptDateInputValue(input)).toBe("");
  });

  it("copies a valid Date and never mutates the caller value", () => {
    const original = new Date("2026-08-29T11:51:00.000Z");
    const result = normalizeReceiptPurchaseDate(original);
    expect(result.valid).toBe(true);
    expect(result.date).not.toBe(original);
    expect(result.date?.getTime()).toBe(original.getTime());
  });
});
