export type CashflowCategoryAggregateRow = {
  category: string;
  currency: string;
  totalAmount: number | string | null;
  expenseAmount: number | string | null;
  incomeAmount: number | string | null;
  normalizedAmountJpy: number | string | null;
  count: number | string | null;
  expenseCount: number | string | null;
  incomeCount: number | string | null;
};

function finiteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type CashflowCategoryNetBreakdown = {
  category: string;
  currency: "JPY" | "CNY";
  totalAmount: number;
  expenseAmount: number;
  incomeAmount: number;
  normalizedAmountJpy: number;
  count: number;
  expenseCount: number;
  incomeCount: number;
  percentage: number;
  netDirection: "expense" | "settled" | "refund";
};

/**
 * Percentages describe the composition of actual expenses. Categories that are
 * fully offset or net refunds remain visible, but do not reduce/invert the
 * positive-expense denominator.
 */
export function normalizeCashflowCategoryNetBreakdown(
  rows: CashflowCategoryAggregateRow[],
): CashflowCategoryNetBreakdown[] {
  const normalized = rows.map((row) => {
    const totalAmount = finiteNumber(row.totalAmount);
    return {
      category: String(row.category || "未分类"),
      currency: row.currency === "CNY" ? ("CNY" as const) : ("JPY" as const),
      totalAmount,
      expenseAmount: finiteNumber(row.expenseAmount),
      incomeAmount: finiteNumber(row.incomeAmount),
      normalizedAmountJpy: finiteNumber(row.normalizedAmountJpy),
      count: Math.max(0, Math.trunc(finiteNumber(row.count))),
      expenseCount: Math.max(0, Math.trunc(finiteNumber(row.expenseCount))),
      incomeCount: Math.max(0, Math.trunc(finiteNumber(row.incomeCount))),
      netDirection: totalAmount > 0 ? ("expense" as const) : totalAmount < 0 ? ("refund" as const) : ("settled" as const),
    };
  });

  const positiveTotalsByCurrency = normalized.reduce<Record<string, number>>((totals, row) => {
    if (row.totalAmount > 0) {
      totals[row.currency] = (totals[row.currency] || 0) + row.totalAmount;
    }
    return totals;
  }, {});

  return normalized.map((row) => {
    const denominator = positiveTotalsByCurrency[row.currency] || 0;
    const percentage = row.totalAmount > 0 && denominator > 0
      ? Math.round((row.totalAmount * 1000) / denominator) / 10
      : 0;
    return { ...row, percentage };
  });
}
