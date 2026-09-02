import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildFinanceCashForecast } from "./financeCashForecast";

const root = path.resolve(import.meta.dirname, "..");

function operatingRows() {
  return [
    {
      id: 1,
      entity: "japan" as const,
      type: "expense" as const,
      category: "广告费",
      amount: 300_000,
      currency: "JPY" as const,
      transactionDate: "2026-06-05",
    },
    {
      id: 2,
      entity: "japan" as const,
      type: "income" as const,
      category: "销售收入",
      amount: 50_000,
      currency: "JPY" as const,
      transactionDate: "2026-09-02",
    },
    {
      id: 3,
      entity: "japan" as const,
      type: "expense" as const,
      category: "口座間振替",
      amount: 999_999,
      currency: "JPY" as const,
      transactionDate: "2026-09-02",
    },
  ];
}

function payrollMonths() {
  return [
    {
      entity: "japan" as const,
      currency: "JPY" as const,
      payrollMonth: "2026-06",
      totalAmount: 300_000,
      recordCount: 10,
    },
    {
      entity: "japan" as const,
      currency: "JPY" as const,
      payrollMonth: "2026-07",
      totalAmount: 330_000,
      recordCount: 10,
    },
    {
      entity: "japan" as const,
      currency: "JPY" as const,
      payrollMonth: "2026-08",
      totalAmount: 360_000,
      recordCount: 10,
    },
    {
      entity: "japan" as const,
      currency: "JPY" as const,
      payrollMonth: "2026-09",
      totalAmount: 100_000,
      recordCount: 3,
    },
    {
      entity: "china" as const,
      currency: "CNY" as const,
      payrollMonth: "2026-06",
      totalAmount: 20_000,
      recordCount: 8,
    },
    {
      entity: "china" as const,
      currency: "CNY" as const,
      payrollMonth: "2026-07",
      totalAmount: 22_000,
      recordCount: 8,
    },
    {
      entity: "china" as const,
      currency: "CNY" as const,
      payrollMonth: "2026-08",
      totalAmount: 24_000,
      recordCount: 8,
    },
  ];
}

describe("finance cash forecast", () => {
  it("forecasts unpaid payroll, excludes internal transfers, and builds auditable 30-day cash", () => {
    const result = buildFinanceCashForecast({
      now: "2026-09-02T09:00:00Z",
      rows: operatingRows(),
      balanceReferenceJpy: 1_000_000,
      balancesFresh: true,
      payrollMonths: payrollMonths(),
      invoices: [
        {
          entity: "japan",
          invoiceType: "receivable",
          amount: 200_000,
          currency: "JPY",
          dueDate: "2026-09-20",
          status: 0,
        },
        {
          entity: "japan",
          invoiceType: "payable",
          amount: 100_000,
          currency: "JPY",
          dueDate: "2026-09-10",
          status: 0,
        },
      ],
    });

    expect(result.payroll.entities[0]).toEqual(
      expect.objectContaining({
        entity: "japan",
        monthlyBase: 330_000,
        next30Amount: 330_000,
        latestDataMonthIncomplete: true,
        sampleMonths: ["2026-06", "2026-07", "2026-08"],
      })
    );
    expect(result.payroll.next30ReferenceJpy).toBe(781_000);
    expect(result.operatingCosts.monthlyNonPayrollExpenseReferenceJpy).toBe(
      100_000
    );
    expect(result.operatingCosts.monthlyRecurringOutflowReferenceJpy).toBe(
      881_000
    );
    expect(result.baseline30).toEqual(
      expect.objectContaining({
        expectedReceiptsReferenceJpy: 200_000,
        payrollOutflowReferenceJpy: 781_000,
        nonPayrollOutflowReferenceJpy: 100_000,
        expectedPaymentsReferenceJpy: 100_000,
        totalOutflowReferenceJpy: 981_000,
        netChangeReferenceJpy: -781_000,
        endingBalanceReferenceJpy: 219_000,
        fundingGapReferenceJpy: 0,
      })
    );
    expect(result.runway.zeroRevenueMonths).toBe(1.02);
  });

  it("uses a configured payroll budget for one complete future payroll cycle", () => {
    const result = buildFinanceCashForecast({
      now: "2026-09-02T09:00:00Z",
      rows: [],
      balanceReferenceJpy: 5_000_000,
      balancesFresh: true,
      payrollMonths: [
        {
          entity: "japan",
          currency: "JPY",
          payrollMonth: "2026-09",
          totalAmount: 300_000,
          recordCount: 5,
        },
      ],
      payrollBudgets: [
        {
          entity: "japan",
          currency: "JPY",
          payrollMonth: "2026-09",
          budgetAmount: 500_000,
        },
        {
          entity: "china",
          currency: "CNY",
          payrollMonth: "2026-09",
          budgetAmount: 20_000,
        },
      ],
    });

    expect(result.payroll.entities).toEqual([
      expect.objectContaining({
        entity: "japan",
        method: "budget",
        monthlyBase: 500_000,
        next30Amount: 500_000,
        budgetConfigured: true,
      }),
      expect.objectContaining({
        entity: "china",
        method: "budget",
        monthlyBase: 20_000,
        next30Amount: 20_000,
        budgetConfigured: true,
      }),
    ]);
    expect(result.payroll.next30ReferenceJpy).toBe(910_000);
    expect(result.payroll.budgetCoverageCount).toBe(2);
    expect(result.payroll.confidence).toBe("high");
  });

  it("uses only open invoices with a due date and converts CNY as a reference value", () => {
    const result = buildFinanceCashForecast({
      now: "2026-09-02T09:00:00Z",
      rows: [],
      balanceReferenceJpy: 1_000_000,
      balancesFresh: true,
      invoices: [
        {
          entity: "china",
          invoiceType: "receivable",
          amount: 10_000,
          currency: "CNY",
          dueDate: "2026-09-01",
          status: 0,
        },
        {
          entity: "japan",
          invoiceType: "receivable",
          amount: 50_000,
          currency: "JPY",
          dueDate: null,
          status: 0,
        },
        {
          entity: "japan",
          invoiceType: "receivable",
          amount: 99_000,
          currency: "JPY",
          dueDate: "2026-09-10",
          status: 1,
        },
        {
          entity: "japan",
          invoiceType: "payable",
          amount: 80_000,
          currency: "JPY",
          dueDate: "2026-11-01",
          status: 0,
        },
      ],
    });

    expect(result.commitments.receivable).toEqual({
      count: 2,
      referenceJpy: 255_000,
    });
    expect(result.commitments.payable).toEqual({
      count: 1,
      referenceJpy: 80_000,
    });
    expect(result.commitments.overdueReceivable).toEqual({
      count: 1,
      referenceJpy: 205_000,
    });
    expect(result.commitments.missingDueDateCount).toBe(1);
    expect(
      result.scenarios.find(row => row.key === "base")?.horizons[0]
        .expectedReceiptsReferenceJpy
    ).toBe(205_000);
    expect(
      result.scenarios.find(row => row.key === "base")?.horizons[1]
        .expectedPaymentsReferenceJpy
    ).toBe(80_000);
  });

  it("never turns historical income into forecast sales and applies explicit scenario assumptions", () => {
    const rows = operatingRows().concat({
      id: 4,
      entity: "japan" as const,
      type: "income" as const,
      category: "销售收入",
      amount: 100_000_000,
      currency: "JPY" as const,
      transactionDate: "2026-09-01",
    });
    const result = buildFinanceCashForecast({
      now: "2026-09-02T09:00:00Z",
      rows,
      balanceReferenceJpy: 1_000_000,
      balancesFresh: true,
      invoices: [
        {
          entity: "japan",
          invoiceType: "receivable",
          amount: 100_000,
          currency: "JPY",
          dueDate: "2026-09-20",
          status: 0,
        },
      ],
    });

    const conservative30 = result.scenarios.find(
      row => row.key === "conservative"
    )!.horizons[0];
    const base30 = result.scenarios.find(row => row.key === "base")!
      .horizons[0];
    const lean30 = result.scenarios.find(row => row.key === "lean")!
      .horizons[0];
    expect(base30.expectedReceiptsReferenceJpy).toBe(100_000);
    expect(conservative30.expectedReceiptsReferenceJpy).toBe(70_000);
    expect(conservative30.nonPayrollOutflowReferenceJpy).toBe(110_000);
    expect(lean30.nonPayrollOutflowReferenceJpy).toBe(90_000);
  });

  it("marks ledger balances and incomplete source data as estimates instead of false certainty", () => {
    const result = buildFinanceCashForecast({
      now: "2026-09-02T09:00:00Z",
      rows: [],
      balanceReferenceJpy: 500_000,
      balancesFresh: false,
      invoices: [
        {
          entity: "japan",
          invoiceType: "receivable",
          amount: 100_000,
          currency: "JPY",
          dueDate: null,
          status: 0,
        },
      ],
    });

    expect(result.availableCash).toEqual({
      referenceJpy: 500_000,
      basis: "ledger_estimated",
      isBankVerified: false,
    });
    expect(result.runway.isEstimate).toBe(true);
    expect(result.runway.zeroRevenueMonths).toBeNull();
    expect(result.dataQuality.warnings).toEqual(
      expect.arrayContaining([
        "账户余额缺少有效银行基准日，当前可动用现金和跑道均为流水推算值",
        "工资预算或完整历史月份不足，预计人工费可信度较低",
        "1条未结清请求书缺少预计日期，未纳入预测",
      ])
    );
  });

  it("keeps the command-center route aggregate-only and protected by finance access", () => {
    const source = fs.readFileSync(
      path.join(root, "server/cashflowRouter.ts"),
      "utf8"
    );
    const section = source.slice(
      source.indexOf("getFinanceCommandCenter"),
      source.indexOf("// 入出金一覧取得")
    );
    expect(section).toContain(
      "getFinanceCommandCenter: financeProcedure.query"
    );
    expect(section).toContain("SUM(netPay) AS totalAmount");
    expect(section).not.toContain("pir.employeeName");
    expect(section).not.toContain("pea.wechatName");
    expect(section).not.toContain("counterparty AS payroll");
    expect(section).toContain("buildFinanceCashForecast");
  });

  it("renders future cash, payroll, scenario, runway, evidence and read-only explanations", () => {
    const source = fs.readFileSync(
      path.join(root, "client/src/components/FinanceCommandCenter.tsx"),
      "utf8"
    );
    for (const marker of [
      "未来30天预计人工费",
      "未来30／60／90天资金预测",
      "情景比较",
      "确定应收应付",
      "公司现金跑道",
      "预测数据质量",
      "未来资金行动",
      "不外推新销售",
      "不返回员工姓名或个人工资",
      "司令塔只读",
    ]) {
      expect(source).toContain(marker);
    }
  });
});
