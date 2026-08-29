import { describe, expect, it } from "vitest";
import { buildFinanceCommandCenter } from "./financeCommandCenter";

const rows = [
  { id: 1, entity: "japan" as const, type: "income" as const, category: "売上", amount: 500_000, currency: "JPY" as const, transactionDate: "2026-08-28", counterparty: "A", description: "sale", sourceAccount: "LCJ MITSUI", receiptUrl: null },
  { id: 2, entity: "japan" as const, type: "expense" as const, category: "広告・マーケティング", amount: 120_000, currency: "JPY" as const, transactionDate: "2026-08-28", counterparty: "Vendor", description: "", sourceAccount: "LCJ MITSUI", receiptUrl: null },
  { id: 3, entity: "china" as const, type: "expense" as const, category: "直播・配信", amount: 6_000, currency: "CNY" as const, transactionDate: "2026-08-27", counterparty: "", description: "", sourceAccount: "世曜元宇(中信銀行)", receiptUrl: null },
  { id: 4, entity: "china" as const, type: "expense" as const, category: "直播・配信", amount: 6_000, currency: "CNY" as const, transactionDate: "2026-08-27", counterparty: "", description: "", sourceAccount: "世曜元宇(中信銀行)", receiptUrl: null },
];

describe("finance command center", () => {
  it("keeps JPY and CNY separate and labels the converted total as reference", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows,
      balances: [
        { accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 1_000_000, asOf: "2026-08-29" },
        { accountName: "世曜元宇(中信銀行)", entity: "china", currency: "CNY", amount: 100_000, asOf: "2026-08-28" },
      ],
      importDocuments: [],
    });
    expect(result.referenceRate).toEqual({ cnyToJpy: 20.5, type: "reference" });
    expect(result.flows.last7.jpy.net).toBe(380_000);
    expect(result.flows.last7.cny.net).toBe(-12_000);
    expect(result.balances.referenceJpy).toBe(3_050_000);
  });

  it("builds an action queue without writing or mutating source rows", () => {
    const source = structuredClone(rows);
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: source,
      balances: [
        { accountName: "LCJ RESONA", entity: "japan", currency: "JPY", amount: -1, asOf: "2026-08-20" },
      ],
      importDocuments: [{ id: 7, module: "bank_statement", sourceFileName: "bank.csv", originalFileSaved: true, status: "failed", recordCount: 10, importedCount: 0, skippedCount: 0, errorCount: 1, createdAt: "2026-08-29T00:00:00Z" }],
    });
    expect(result.actions.map((item) => item.type)).toEqual(expect.arrayContaining(["negative_balance", "stale_account", "missing_receipt", "incomplete_row", "possible_duplicate", "failed_import"]));
    expect(source).toEqual(rows);
  });

  it("does not classify an account updated within two days as stale", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: [],
      balances: [{ accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 10, asOf: "2026-08-27" }],
    });
    expect(result.balances.accounts[0]?.freshness).toBe("fresh");
    expect(result.dataQuality.staleAccountCount).toBe(0);
  });
});
