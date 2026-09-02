import { PAYROLL_REFERENCE_CNY_JPY } from "./payrollCommandCenter";
import type {
  FinanceCommandCashflow,
  FinanceCommandCurrency,
  FinanceCommandEntity,
} from "./financeCommandCenter";

const DAY_MS = 86_400_000;
const INTERNAL_TRANSFER_CATEGORIES = new Set(["本社送金", "口座間振替"]);
const PAYROLL_CATEGORIES = new Set([
  "給与・人件費",
  "中国人工費",
  "日本人工費",
]);
const FORECAST_HORIZONS = [30, 60, 90] as const;

export type FinanceForecastPayrollMonth = {
  entity: FinanceCommandEntity;
  currency: FinanceCommandCurrency;
  payrollMonth: string;
  totalAmount: number;
  recordCount: number;
};

export type FinanceForecastPayrollBudget = {
  entity: FinanceCommandEntity;
  currency: FinanceCommandCurrency;
  payrollMonth: string;
  budgetAmount: number;
};

export type FinanceForecastInvoice = {
  entity: FinanceCommandEntity;
  invoiceType: "receivable" | "payable";
  amount: number;
  currency: FinanceCommandCurrency;
  dueDate?: string | null;
  status: number;
};

export type FinanceForecastScenarioKey = "conservative" | "base" | "lean";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toReferenceJpy(
  amount: number,
  currency: FinanceCommandCurrency
): number {
  return (
    Number(amount || 0) * (currency === "CNY" ? PAYROLL_REFERENCE_CNY_JPY : 1)
  );
}

function parseDateOnly(value: string): Date | null {
  const normalized = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(
  from: string | null | undefined,
  to: string
): number | null {
  const start = from ? parseDateOnly(from) : null;
  const end = parseDateOnly(to);
  if (!start || !end) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}

function currentMonthOf(asOf: string): string {
  return asOf.slice(0, 7);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceRank(
  value: "high" | "medium" | "low" | "unavailable"
): number {
  return { high: 3, medium: 2, low: 1, unavailable: 0 }[value];
}

function buildPayrollForecast(input: {
  asOf: string;
  payrollMonths: FinanceForecastPayrollMonth[];
  payrollBudgets: FinanceForecastPayrollBudget[];
}) {
  const targetMonth = currentMonthOf(input.asOf);
  const entities = [
    { entity: "japan" as const, currency: "JPY" as const },
    { entity: "china" as const, currency: "CNY" as const },
  ];

  const entityForecasts = entities.map(({ entity, currency }) => {
    const months = input.payrollMonths
      .filter(
        row =>
          row.entity === entity &&
          row.currency === currency &&
          row.totalAmount > 0
      )
      .map(row => ({
        payrollMonth: String(row.payrollMonth || "").slice(0, 7),
        totalAmount: Number(row.totalAmount || 0),
        recordCount: Number(row.recordCount || 0),
      }))
      .filter(row => /^\d{4}-\d{2}$/.test(row.payrollMonth))
      .sort((a, b) => a.payrollMonth.localeCompare(b.payrollMonth));

    const latest = months.at(-1) || null;
    const priorCandidates = latest ? months.slice(0, -1).slice(-3) : [];
    const priorAverageAmount = average(
      priorCandidates.map(row => row.totalAmount)
    );
    const priorAverageCount = average(
      priorCandidates.map(row => row.recordCount)
    );
    const latestIncomplete = Boolean(
      latest &&
        priorCandidates.length > 0 &&
        (latest.totalAmount < priorAverageAmount * 0.5 ||
          latest.recordCount < Math.max(1, priorAverageCount * 0.5))
    );
    const completeMonths = (
      latestIncomplete ? months.slice(0, -1) : months
    ).filter(row => row.totalAmount > 0);
    const samples = completeMonths.slice(-3);
    const budget = input.payrollBudgets.find(
      row =>
        row.entity === entity &&
        row.currency === currency &&
        row.payrollMonth.slice(0, 7) === targetMonth &&
        Number(row.budgetAmount || 0) > 0
    );
    const monthlyBase = budget
      ? Number(budget.budgetAmount || 0)
      : average(samples.map(row => row.totalAmount));
    // 发薪日尚未统一结构化保存，因此未来30天按一个完整工资周期计算，
    // 不凭当前日历月或最近付款日期擅自扣减，避免跨月发薪时低估人工费。
    const next30Amount = monthlyBase;
    const confidence = budget
      ? ("high" as const)
      : samples.length >= 3 && !latestIncomplete
        ? ("medium" as const)
        : samples.length >= 2
          ? ("low" as const)
          : monthlyBase > 0
            ? ("low" as const)
            : ("unavailable" as const);

    return {
      entity,
      currency,
      targetMonth,
      method: budget ? ("budget" as const) : ("historical_average" as const),
      monthlyBase: roundMoney(monthlyBase),
      next30Amount: roundMoney(next30Amount),
      sampleMonths: samples.map(row => row.payrollMonth),
      latestDataMonth: latest?.payrollMonth || null,
      latestDataMonthIncomplete: latestIncomplete,
      budgetConfigured: Boolean(budget),
      confidence,
      referenceMonthlyBaseJpy: Math.round(
        toReferenceJpy(monthlyBase, currency)
      ),
      referenceNext30Jpy: Math.round(toReferenceJpy(next30Amount, currency)),
    };
  });

  const confidence =
    entityForecasts
      .map(row => row.confidence)
      .sort((a, b) => confidenceRank(a) - confidenceRank(b))[0] ||
    "unavailable";
  const monthlyReferenceJpy = entityForecasts.reduce(
    (sum, row) => sum + row.referenceMonthlyBaseJpy,
    0
  );
  const next30ReferenceJpy = entityForecasts.reduce(
    (sum, row) => sum + row.referenceNext30Jpy,
    0
  );

  return {
    targetMonth,
    method: "当月预算优先；未设置预算时使用最近最多3个完整工资月平均" as const,
    confidence,
    monthlyReferenceJpy,
    next30ReferenceJpy,
    threeMonthReferenceJpy: next30ReferenceJpy + monthlyReferenceJpy * 2,
    budgetCoverageCount: entityForecasts.filter(row => row.budgetConfigured)
      .length,
    entityForecasts,
    amountForHorizon(days: number) {
      const months = Math.max(1, Math.round(days / 30));
      return next30ReferenceJpy + monthlyReferenceJpy * Math.max(0, months - 1);
    },
  };
}

function buildCommitments(input: {
  asOf: string;
  invoices: FinanceForecastInvoice[];
}) {
  const pending = input.invoices.filter(
    row => Number(row.status || 0) === 0 && Number(row.amount || 0) > 0
  );
  const normalized = pending.map(row => ({
    ...row,
    amount: Number(row.amount || 0),
    dueDate: row.dueDate ? String(row.dueDate).slice(0, 10) : null,
    referenceAmountJpy: Math.round(
      toReferenceJpy(Number(row.amount || 0), row.currency)
    ),
  }));
  const dated = normalized.filter(row => parseDateOnly(row.dueDate || ""));
  const undated = normalized.filter(row => !parseDateOnly(row.dueDate || ""));
  const overdueReceivables = dated.filter(
    row => row.invoiceType === "receivable" && String(row.dueDate) < input.asOf
  );
  const overduePayables = dated.filter(
    row => row.invoiceType === "payable" && String(row.dueDate) < input.asOf
  );

  const dueThrough = (invoiceType: "receivable" | "payable", days: number) => {
    const endDate = addDays(input.asOf, days);
    const rows = dated.filter(
      row => row.invoiceType === invoiceType && String(row.dueDate) <= endDate
    );
    return {
      count: rows.length,
      referenceJpy: rows.reduce((sum, row) => sum + row.referenceAmountJpy, 0),
    };
  };

  const total = (invoiceType: "receivable" | "payable") => {
    const rows = normalized.filter(row => row.invoiceType === invoiceType);
    return {
      count: rows.length,
      referenceJpy: rows.reduce((sum, row) => sum + row.referenceAmountJpy, 0),
    };
  };

  return {
    receivable: total("receivable"),
    payable: total("payable"),
    overdueReceivable: {
      count: overdueReceivables.length,
      referenceJpy: overdueReceivables.reduce(
        (sum, row) => sum + row.referenceAmountJpy,
        0
      ),
    },
    overduePayable: {
      count: overduePayables.length,
      referenceJpy: overduePayables.reduce(
        (sum, row) => sum + row.referenceAmountJpy,
        0
      ),
    },
    missingDueDateCount: undated.length,
    dueThrough,
  };
}

export function buildFinanceCashForecast(input: {
  rows: FinanceCommandCashflow[];
  balanceReferenceJpy: number;
  balancesFresh: boolean;
  payrollMonths?: FinanceForecastPayrollMonth[];
  payrollBudgets?: FinanceForecastPayrollBudget[];
  invoices?: FinanceForecastInvoice[];
  now?: Date | string;
}) {
  const asOf = dateOnly(input.now || new Date());
  const payroll = buildPayrollForecast({
    asOf,
    payrollMonths: input.payrollMonths || [],
    payrollBudgets: input.payrollBudgets || [],
  });
  const commitments = buildCommitments({
    asOf,
    invoices: input.invoices || [],
  });
  const start90 = addDays(asOf, -89);
  const operating90 = input.rows.filter(row => {
    const date = String(row.transactionDate || "").slice(0, 10);
    return (
      date >= start90 &&
      date <= asOf &&
      !INTERNAL_TRANSFER_CATEGORIES.has(String(row.category || "").trim())
    );
  });
  const oldestOperatingDate =
    operating90
      .map(row => row.transactionDate.slice(0, 10))
      .filter(Boolean)
      .sort()[0] || null;
  const coverageDays = oldestOperatingDate
    ? (daysBetween(oldestOperatingDate, asOf) || 0) + 1
    : 0;
  const coveredMonths = Math.max(1, Math.min(3, coverageDays / 30));
  const nonPayrollExpense90ReferenceJpy = operating90
    .filter(
      row =>
        row.type === "expense" &&
        !PAYROLL_CATEGORIES.has(String(row.category || "").trim())
    )
    .reduce(
      (sum, row) => sum + toReferenceJpy(Number(row.amount || 0), row.currency),
      0
    );
  const externalIncome90ReferenceJpy = operating90
    .filter(row => row.type === "income")
    .reduce(
      (sum, row) => sum + toReferenceJpy(Number(row.amount || 0), row.currency),
      0
    );
  const monthlyNonPayrollExpenseReferenceJpy = Math.round(
    nonPayrollExpense90ReferenceJpy / coveredMonths
  );
  const monthlyRecurringOutflowReferenceJpy =
    payroll.monthlyReferenceJpy + monthlyNonPayrollExpenseReferenceJpy;
  const balanceReferenceJpy = Math.round(
    Number(input.balanceReferenceJpy || 0)
  );

  const scenarioDefinitions: Array<{
    key: FinanceForecastScenarioKey;
    label: string;
    collectionRate: number;
    nonPayrollCostFactor: number;
    description: string;
  }> = [
    {
      key: "conservative",
      label: "保守",
      collectionRate: 0.7,
      nonPayrollCostFactor: 1.1,
      description: "只计70%已登记应收，非人工经营支出增加10%",
    },
    {
      key: "base",
      label: "基准",
      collectionRate: 1,
      nonPayrollCostFactor: 1,
      description: "按全部已登记应收应付与历史非人工支出运行",
    },
    {
      key: "lean",
      label: "节流",
      collectionRate: 1,
      nonPayrollCostFactor: 0.9,
      description: "不增加收入，只模拟非人工经营支出降低10%",
    },
  ];

  const scenarios = scenarioDefinitions.map(scenario => ({
    ...scenario,
    horizons: FORECAST_HORIZONS.map(days => {
      const dueReceivable = commitments.dueThrough("receivable", days);
      const duePayable = commitments.dueThrough("payable", days);
      const payrollOutflowReferenceJpy = payroll.amountForHorizon(days);
      const nonPayrollOutflowReferenceJpy = Math.round(
        monthlyNonPayrollExpenseReferenceJpy *
          (days / 30) *
          scenario.nonPayrollCostFactor
      );
      const expectedReceiptsReferenceJpy = Math.round(
        dueReceivable.referenceJpy * scenario.collectionRate
      );
      const expectedPaymentsReferenceJpy = duePayable.referenceJpy;
      const totalOutflowReferenceJpy =
        payrollOutflowReferenceJpy +
        nonPayrollOutflowReferenceJpy +
        expectedPaymentsReferenceJpy;
      const netChangeReferenceJpy =
        expectedReceiptsReferenceJpy - totalOutflowReferenceJpy;
      const endingBalanceReferenceJpy =
        balanceReferenceJpy + netChangeReferenceJpy;
      return {
        days,
        endDate: addDays(asOf, days),
        receivableCount: dueReceivable.count,
        payableCount: duePayable.count,
        expectedReceiptsReferenceJpy,
        payrollOutflowReferenceJpy,
        nonPayrollOutflowReferenceJpy,
        expectedPaymentsReferenceJpy,
        totalOutflowReferenceJpy,
        netChangeReferenceJpy,
        endingBalanceReferenceJpy,
        fundingGapReferenceJpy: Math.max(0, -endingBalanceReferenceJpy),
        coverageRatio:
          totalOutflowReferenceJpy > 0
            ? Number(
                (
                  (balanceReferenceJpy + expectedReceiptsReferenceJpy) /
                  totalOutflowReferenceJpy
                ).toFixed(2)
              )
            : null,
      };
    }),
  }));

  const pendingPayableReferenceJpy = commitments.payable.referenceJpy;
  const spendableAfterCommittedPayables = Math.max(
    0,
    balanceReferenceJpy - pendingPayableReferenceJpy
  );
  const zeroRevenueMonths =
    monthlyRecurringOutflowReferenceJpy > 0
      ? Number(
          (
            spendableAfterCommittedPayables /
            monthlyRecurringOutflowReferenceJpy
          ).toFixed(2)
        )
      : null;
  const registeredReceiptsRunwayMonths =
    monthlyRecurringOutflowReferenceJpy > 0
      ? Number(
          (
            Math.max(
              0,
              balanceReferenceJpy +
                commitments.receivable.referenceJpy -
                pendingPayableReferenceJpy
            ) / monthlyRecurringOutflowReferenceJpy
          ).toFixed(2)
        )
      : null;
  const historicalMonthlyNetReferenceJpy =
    Math.round(
      nonPayrollExpense90ReferenceJpy +
        operating90
          .filter(
            row =>
              row.type === "expense" &&
              PAYROLL_CATEGORIES.has(String(row.category || "").trim())
          )
          .reduce(
            (sum, row) =>
              sum + toReferenceJpy(Number(row.amount || 0), row.currency),
            0
          ) -
        externalIncome90ReferenceJpy
    ) / coveredMonths;

  const warnings: string[] = [];
  if (!input.balancesFresh)
    warnings.push(
      "账户余额缺少有效银行基准日，当前可动用现金和跑道均为流水推算值"
    );
  if (coverageDays < 90)
    warnings.push(
      `历史经营现金流仅覆盖${coverageDays}天，非人工支出月均值可信度较低`
    );
  if (payroll.confidence === "low" || payroll.confidence === "unavailable") {
    warnings.push("工资预算或完整历史月份不足，预计人工费可信度较低");
  }
  if (payroll.budgetCoverageCount < 2)
    warnings.push(`本月仅${payroll.budgetCoverageCount}/2个法人设置工资预算`);
  if (commitments.missingDueDateCount > 0)
    warnings.push(
      `${commitments.missingDueDateCount}条未结清请求书缺少预计日期，未纳入预测`
    );
  if (commitments.overdueReceivable.count > 0)
    warnings.push(
      `${commitments.overdueReceivable.count}条应收已逾期，预测按当前起算日纳入`
    );

  const baseScenario = scenarios.find(scenario => scenario.key === "base")!;
  const conservativeScenario = scenarios.find(
    scenario => scenario.key === "conservative"
  )!;
  const actions: Array<{
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    target: "cashflow" | "payroll" | "invoices";
  }> = [];
  if (payroll.budgetCoverageCount < 2) {
    actions.push({
      key: "forecast_payroll_budget_missing",
      severity: "medium",
      title: "工资预算尚未完整设置",
      detail: `当前仅${payroll.budgetCoverageCount}/2个法人有本月预算，暂按完整历史工资月平均预测`,
      target: "payroll",
    });
  }
  if (commitments.overdueReceivable.count > 0) {
    actions.push({
      key: "forecast_overdue_receivable",
      severity: "high",
      title: "应收款已逾期",
      detail: `${commitments.overdueReceivable.count}条・${Math.round(commitments.overdueReceivable.referenceJpy).toLocaleString("ja-JP")} JPY参考`,
      target: "invoices",
    });
  }
  const conservativeGap = conservativeScenario.horizons.find(
    row => row.fundingGapReferenceJpy > 0
  );
  if (conservativeGap) {
    actions.push({
      key: "forecast_conservative_gap",
      severity: "high",
      title: `${conservativeGap.days}天保守情景出现资金缺口`,
      detail: `预计缺口${Math.round(conservativeGap.fundingGapReferenceJpy).toLocaleString("ja-JP")} JPY参考`,
      target: "cashflow",
    });
  }
  if (zeroRevenueMonths != null && zeroRevenueMonths < 3) {
    actions.push({
      key: "forecast_runway_under_three_months",
      severity: zeroRevenueMonths < 1 ? "high" : "medium",
      title: "无新增收入压力跑道不足3个月",
      detail: `按预计人工费和历史非人工支出计算约${zeroRevenueMonths}个月`,
      target: "cashflow",
    });
  }

  return {
    asOf,
    referenceRate: {
      cnyToJpy: PAYROLL_REFERENCE_CNY_JPY,
      type: "reference" as const,
    },
    availableCash: {
      referenceJpy: balanceReferenceJpy,
      basis: input.balancesFresh
        ? ("bank_verified" as const)
        : ("ledger_estimated" as const),
      isBankVerified: input.balancesFresh,
    },
    payroll: {
      targetMonth: payroll.targetMonth,
      method: payroll.method,
      confidence: payroll.confidence,
      monthlyReferenceJpy: payroll.monthlyReferenceJpy,
      next30ReferenceJpy: payroll.next30ReferenceJpy,
      threeMonthReferenceJpy: payroll.threeMonthReferenceJpy,
      budgetCoverageCount: payroll.budgetCoverageCount,
      entities: payroll.entityForecasts,
    },
    operatingCosts: {
      coverageDays,
      monthlyNonPayrollExpenseReferenceJpy,
      monthlyRecurringOutflowReferenceJpy,
      historicalMonthlyNetReferenceJpy: Math.round(
        historicalMonthlyNetReferenceJpy
      ),
      historicalTrend:
        historicalMonthlyNetReferenceJpy > 0
          ? ("net_burn" as const)
          : ("net_inflow" as const),
      payrollExcludedFromNonPayrollAverage: true,
      internalTransfersExcluded: [...INTERNAL_TRANSFER_CATEGORIES],
    },
    commitments: {
      receivable: commitments.receivable,
      payable: commitments.payable,
      overdueReceivable: commitments.overdueReceivable,
      overduePayable: commitments.overduePayable,
      missingDueDateCount: commitments.missingDueDateCount,
    },
    runway: {
      monthlyRecurringOutflowReferenceJpy,
      zeroRevenueMonths,
      zeroRevenueEndDate:
        zeroRevenueMonths == null
          ? null
          : addDays(asOf, Math.max(0, Math.floor(zeroRevenueMonths * 30))),
      registeredReceiptsRunwayMonths,
      registeredReceiptsRunwayEndDate:
        registeredReceiptsRunwayMonths == null
          ? null
          : addDays(
              asOf,
              Math.max(0, Math.floor(registeredReceiptsRunwayMonths * 30))
            ),
      isEstimate: !input.balancesFresh,
      formula:
        "（流水推算余额 − 未付应付）÷（预计月人工费 + 最近90天月均非人工经营支出）",
    },
    scenarios,
    baseline30: baseScenario.horizons[0],
    dataQuality: {
      balancesFresh: input.balancesFresh,
      payrollConfidence: payroll.confidence,
      payrollBudgetCoverageCount: payroll.budgetCoverageCount,
      historyCoverageDays: coverageDays,
      missingInvoiceDueDateCount: commitments.missingDueDateCount,
      warningCount: warnings.length,
      warnings,
    },
    actions,
  };
}
