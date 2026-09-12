import { describe, expect, it } from "vitest";
import { buildCashflowMonthlySummary } from "./cashflowMonthlySummary";

describe("cashflow monthly operating and internal-transfer summary", () => {
  it("separates operating flows from intercompany bank movements", () => {
    const [month] = buildCashflowMonthlySummary([
      { month: "2026-08", entity: "japan", currency: "JPY", category: "売上", type: "income", totalAmount: 10_000_000, recordCount: 2 },
      { month: "2026-08", entity: "china", currency: "CNY", category: "売上", type: "income", totalAmount: 100_000, recordCount: 3 },
      { month: "2026-08", entity: "japan", currency: "JPY", category: "日本人工費", type: "expense", totalAmount: 5_000_000, recordCount: 5 },
      { month: "2026-08", entity: "china", currency: "CNY", category: "広告・マーケティング", type: "expense", totalAmount: 50_000, recordCount: 4 },
      { month: "2026-08", entity: "japan", currency: "JPY", category: "本社送金", type: "expense", totalAmount: 14_000_000, recordCount: 1 },
      { month: "2026-08", entity: "china", currency: "CNY", category: "本社送金", type: "income", totalAmount: 680_000, recordCount: 1 },
    ]);

    expect(month.operatingIncome).toEqual({ jpy: 10_000_000, cny: 100_000, referenceJpy: 12_050_000, count: 5 });
    expect(month.operatingExpense).toEqual({ jpy: 5_000_000, cny: 50_000, referenceJpy: 6_025_000, count: 9 });
    expect(month.internalTransferExpense).toEqual({ jpy: 14_000_000, cny: 0, referenceJpy: 14_000_000, count: 1 });
    expect(month.internalTransferIncome).toEqual({ jpy: 0, cny: 680_000, referenceJpy: 13_940_000, count: 1 });
    expect(month.bankExpense.referenceJpy).toBe(20_025_000);
    expect(month.bankIncome.referenceJpy).toBe(25_990_000);
    expect(month.operatingNetReferenceJpy).toBe(6_025_000);
    expect(month.bankNetReferenceJpy).toBe(5_965_000);
  });

  it("recognizes both supported internal-transfer categories and sorts newest month first", () => {
    const rows = buildCashflowMonthlySummary([
      { month: "2026-06", entity: "japan", currency: "JPY", category: "口座間振替", type: "expense", totalAmount: 1_000, recordCount: 1 },
      { month: "2026-07", entity: "japan", currency: "JPY", category: "本社送金", type: "expense", totalAmount: 2_000, recordCount: 1 },
      { month: "invalid", entity: "japan", currency: "JPY", category: "売上", type: "income", totalAmount: 9_999, recordCount: 1 },
    ], 12);

    expect(rows.map(row => row.month)).toEqual(["2026-07", "2026-06"]);
    expect(rows[0].operatingExpense.referenceJpy).toBe(0);
    expect(rows[0].internalTransferExpense.referenceJpy).toBe(2_000);
    expect(rows[1].internalTransferExpense.referenceJpy).toBe(1_000);
  });

  it("rounds JPY reference values to two decimals without changing original currencies", () => {
    const [month] = buildCashflowMonthlySummary([
      { month: "2026-09", entity: "china", currency: "CNY", category: "売上", type: "income", totalAmount: "12.34", recordCount: "1" },
    ]);
    expect(month.operatingIncome.cny).toBe(12.34);
    expect(month.operatingIncome.referenceJpy).toBe(252.97);
  });
});
