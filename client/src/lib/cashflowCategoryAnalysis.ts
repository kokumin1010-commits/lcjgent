export type CashflowCategoryAnalysisMode = "expense" | "income";

export type CashflowCategoryBreakdownRow = {
  category: string;
  currency: "JPY" | "CNY";
  totalAmount?: number | string | null;
  normalizedAmountJpy?: number | string | null;
  incomeAmount?: number | string | null;
  incomeAmountJpy?: number | string | null;
  incomeCount?: number | string | null;
  count?: number | string | null;
  percentage?: number | string | null;
  isInternalTransfer?: boolean;
};

export type CashflowCategoryAnalysisRow<T extends CashflowCategoryBreakdownRow> = T & {
  analysisOriginalAmount: number;
  analysisAmountJpy: number;
  analysisCount: number;
  analysisPercentage: number | null;
};

function finite(value: number | string | null | undefined): number {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function buildCashflowCategoryAnalysisRows<T extends CashflowCategoryBreakdownRow>(
  rows: T[],
  mode: CashflowCategoryAnalysisMode,
): Array<CashflowCategoryAnalysisRow<T>> {
  const operatingIncomeTotalJpy = rows
    .filter((row) => !row.isInternalTransfer)
    .reduce((total, row) => total + Math.max(finite(row.incomeAmountJpy), 0), 0);

  return rows
    .filter((row) => mode === "expense" || finite(row.incomeAmountJpy) > 0)
    .map((row) => {
      const analysisAmountJpy = mode === "income"
        ? Math.max(finite(row.incomeAmountJpy), 0)
        : Math.max(finite(row.normalizedAmountJpy), 0);
      const analysisPercentage = row.isInternalTransfer
        ? null
        : mode === "income"
          ? operatingIncomeTotalJpy > 0
            ? Math.round((analysisAmountJpy / operatingIncomeTotalJpy) * 1000) / 10
            : 0
          : finite(row.percentage);

      return {
        ...row,
        analysisOriginalAmount: mode === "income" ? finite(row.incomeAmount) : finite(row.totalAmount),
        analysisAmountJpy,
        analysisCount: mode === "income" ? finite(row.incomeCount) : finite(row.count),
        analysisPercentage,
      };
    })
    .sort((left, right) =>
      right.analysisAmountJpy - left.analysisAmountJpy
      || String(left.category || "").localeCompare(String(right.category || "")),
    );
}
