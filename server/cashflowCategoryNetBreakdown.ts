export type CashflowCategoryAggregateRow = {
  category: string;
  currency: string;
  totalAmount: number | string | null;
  expenseAmount: number | string | null;
  incomeAmount: number | string | null;
  normalizedAmountJpy: number | string | null;
  expenseAmountJpy?: number | string | null;
  incomeAmountJpy?: number | string | null;
  count: number | string | null;
  expenseCount: number | string | null;
  incomeCount: number | string | null;
};

const INTERNAL_TRANSFER_CATEGORIES = new Set(["本社送金", "口座間振替"]);

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
  expenseAmountJpy: number;
  incomeAmountJpy: number;
  count: number;
  expenseCount: number;
  incomeCount: number;
  percentage: number;
  netDirection: "expense" | "settled" | "refund";
  isInternalTransfer: boolean;
};

/**
 * Percentages describe operating expenses. Fully offset/refund rows remain
 * visible, while intercompany transfers are disclosed separately and never
 * enter the operating-expense denominator.
 */
export function normalizeCashflowCategoryNetBreakdown(
  rows: CashflowCategoryAggregateRow[],
): CashflowCategoryNetBreakdown[] {
  const normalized = rows.map((row) => {
    const totalAmount = finiteNumber(row.totalAmount);
    const currency = row.currency === "CNY" ? ("CNY" as const) : ("JPY" as const);
    const exchangeRate = currency === "CNY" ? 20.5 : 1;
    const category = String(row.category || "未分类");
    const expenseAmount = finiteNumber(row.expenseAmount);
    const incomeAmount = finiteNumber(row.incomeAmount);
    return {
      category,
      currency,
      totalAmount,
      expenseAmount,
      incomeAmount,
      normalizedAmountJpy: finiteNumber(row.normalizedAmountJpy),
      expenseAmountJpy: row.expenseAmountJpy == null
        ? expenseAmount * exchangeRate
        : finiteNumber(row.expenseAmountJpy),
      incomeAmountJpy: row.incomeAmountJpy == null
        ? incomeAmount * exchangeRate
        : finiteNumber(row.incomeAmountJpy),
      count: Math.max(0, Math.trunc(finiteNumber(row.count))),
      expenseCount: Math.max(0, Math.trunc(finiteNumber(row.expenseCount))),
      incomeCount: Math.max(0, Math.trunc(finiteNumber(row.incomeCount))),
      netDirection: totalAmount > 0 ? ("expense" as const) : totalAmount < 0 ? ("refund" as const) : ("settled" as const),
      isInternalTransfer: INTERNAL_TRANSFER_CATEGORIES.has(category),
    };
  });

  const positiveOperatingTotalsByCurrency = normalized.reduce<Record<string, number>>((totals, row) => {
    if (row.totalAmount > 0 && !row.isInternalTransfer) {
      totals[row.currency] = (totals[row.currency] || 0) + row.totalAmount;
    }
    return totals;
  }, {});

  return normalized.map((row) => {
    const denominator = positiveOperatingTotalsByCurrency[row.currency] || 0;
    const percentage = row.totalAmount > 0 && !row.isInternalTransfer && denominator > 0
      ? Math.round((row.totalAmount * 1000) / denominator) / 10
      : 0;
    return { ...row, percentage };
  });
}
