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
    expect(result.topExpenseCategories).toEqual([
      expect.objectContaining({
        entity: "china",
        category: "直播・配信",
        currency: "CNY",
        amount: 12_000,
        count: 2,
        referenceAmountJpy: 246_000,
        startDate: "2026-07-31",
        endDate: "2026-08-29",
      }),
      expect.objectContaining({
        entity: "japan",
        category: "広告・マーケティング",
        currency: "JPY",
        amount: 120_000,
        count: 1,
        referenceAmountJpy: 120_000,
      }),
    ]);
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

  it("includes the first calendar day of 7-day and 30-day windows", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: [
        { id: 30, entity: "japan", type: "income", category: "売上", amount: 7, currency: "JPY", transactionDate: "2026-08-23" },
        { id: 31, entity: "japan", type: "income", category: "売上", amount: 30, currency: "JPY", transactionDate: "2026-07-31" },
        { id: 32, entity: "japan", type: "income", category: "売上", amount: 999, currency: "JPY", transactionDate: "2026-07-30" },
      ],
      balances: [{ accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 100, asOf: "2026-08-29" }],
    });
    expect(result.flows.last7.jpy.income).toBe(7);
    expect(result.flows.last30.jpy.income).toBe(37);
  });

  it("reconstructs monthly net cash burn while including payroll and excluding both sides of head-office transfers", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: [
        { id: 10, entity: "japan", type: "expense", category: "給与・人件費", amount: 900, currency: "JPY", transactionDate: "2026-06-01" },
        { id: 11, entity: "china", type: "expense", category: "給与・人件費", amount: 30, currency: "CNY", transactionDate: "2026-07-01" },
        { id: 12, entity: "japan", type: "expense", category: "本社送金", amount: 300, currency: "JPY", transactionDate: "2026-08-29" },
        { id: 13, entity: "china", type: "income", category: "本社送金", amount: 10, currency: "CNY", transactionDate: "2026-08-29" },
        { id: 14, entity: "japan", type: "expense", category: "設備・備品", amount: 300, currency: "JPY", transactionDate: "2026-08-29" },
        { id: 15, entity: "japan", type: "income", category: "売上", amount: 300, currency: "JPY", transactionDate: "2026-08-29" },
      ],
      balances: [{ accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 5_050, asOf: "2026-08-29" }],
    });
    expect(result.runway.coverageDays).toBe(90);
    expect(result.runway.payrollIncluded).toBe(true);
    expect(result.runway.totalIncome90d).toEqual({ jpy: 300, cny: 10, referenceJpy: 505 });
    expect(result.runway.totalExpense90d).toEqual({ jpy: 1_500, cny: 30, referenceJpy: 2_115 });
    expect(result.runway.internalTransfer90d).toEqual({
      incomeJpy: 0,
      incomeCny: 10,
      expenseJpy: 300,
      expenseCny: 0,
      incomeReferenceJpy: 205,
      expenseReferenceJpy: 300,
    });
    expect(result.runway.externalIncome90d).toEqual({ jpy: 300, cny: 0, referenceJpy: 300 });
    expect(result.runway.externalExpense90d).toEqual({ jpy: 1_200, cny: 30, referenceJpy: 1_815 });
    expect(result.runway.netCashBurn90d).toEqual({ jpy: 900, cny: 30, referenceJpy: 1_515 });
    expect(result.runway.referenceMonthlyExpenseJpy).toBe(605);
    expect(result.runway.referenceMonthlyExternalIncomeJpy).toBe(100);
    expect(result.runway.referenceMonthlyNetCashBurnJpy).toBe(505);
    expect(result.runway.ready).toBe(true);
    expect(result.runway.combinedReferenceMonths).toBe(10);
  });

  it("does not publish a runway month value when bank balance dates are missing", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: [
        { id: 20, entity: "japan", type: "expense", category: "給与・人件費", amount: 300, currency: "JPY", transactionDate: "2026-06-01" },
        { id: 21, entity: "japan", type: "expense", category: "設備・備品", amount: 300, currency: "JPY", transactionDate: "2026-08-29" },
      ],
      balances: [{ accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 6_000, asOf: null }],
    });
    expect(result.runway.referenceMonthlyExpenseJpy).toBe(200);
    expect(result.runway.referenceMonthlyNetCashBurnJpy).toBe(200);
    expect(result.runway.ready).toBe(false);
    expect(result.runway.combinedReferenceMonths).toBeNull();
    expect(result.runway.unavailableReasons).toContain("银行账户余额基准日缺失或已过期");
  });

  it("does not calculate a consumption runway when the last 90 days are a net cash inflow", () => {
    const result = buildFinanceCommandCenter({
      now: "2026-08-29T09:00:00Z",
      rows: [
        { id: 40, entity: "japan", type: "expense", category: "給与・人件費", amount: 300, currency: "JPY", transactionDate: "2026-06-01" },
        { id: 41, entity: "japan", type: "income", category: "売上", amount: 600, currency: "JPY", transactionDate: "2026-08-29" },
      ],
      balances: [{ accountName: "LCJ MITSUI", entity: "japan", currency: "JPY", amount: 6_000, asOf: "2026-08-29" }],
    });
    expect(result.runway.referenceMonthlyNetCashBurnJpy).toBe(-100);
    expect(result.runway.ready).toBe(false);
    expect(result.runway.combinedReferenceMonths).toBeNull();
    expect(result.runway.unavailableReasons).toContain("最近90天为净现金流入，不适用消耗型现金跑道");
  });
});
