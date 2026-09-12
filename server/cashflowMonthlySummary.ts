export const CASHFLOW_REFERENCE_CNY_JPY = 20.5;
export const CASHFLOW_INTERNAL_TRANSFER_CATEGORIES = new Set(["本社送金", "口座間振替"]);

type RawMonthlyRow = {
  month: string;
  entity: string;
  currency: string;
  category: string;
  type: string;
  totalAmount: number | string | null;
  recordCount: number | string | null;
};

type CurrencyTotals = {
  jpy: number;
  cny: number;
  referenceJpy: number;
  count: number;
};

export type CashflowMonthlySummary = {
  month: string;
  operatingIncome: CurrencyTotals;
  operatingExpense: CurrencyTotals;
  internalTransferIncome: CurrencyTotals;
  internalTransferExpense: CurrencyTotals;
  bankIncome: CurrencyTotals;
  bankExpense: CurrencyTotals;
  operatingNetReferenceJpy: number;
  bankNetReferenceJpy: number;
};

function emptyTotals(): CurrencyTotals {
  return { jpy: 0, cny: 0, referenceJpy: 0, count: 0 };
}

function emptyMonth(month: string): CashflowMonthlySummary {
  return {
    month,
    operatingIncome: emptyTotals(),
    operatingExpense: emptyTotals(),
    internalTransferIncome: emptyTotals(),
    internalTransferExpense: emptyTotals(),
    bankIncome: emptyTotals(),
    bankExpense: emptyTotals(),
    operatingNetReferenceJpy: 0,
    bankNetReferenceJpy: 0,
  };
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function add(totals: CurrencyTotals, currency: string, amount: number, count: number) {
  if (currency === "CNY") totals.cny += amount;
  else totals.jpy += amount;
  totals.referenceJpy += currency === "CNY" ? amount * CASHFLOW_REFERENCE_CNY_JPY : amount;
  totals.count += count;
}

function roundSummary(summary: CashflowMonthlySummary): CashflowMonthlySummary {
  const keys = [
    "operatingIncome",
    "operatingExpense",
    "internalTransferIncome",
    "internalTransferExpense",
    "bankIncome",
    "bankExpense",
  ] as const;
  for (const key of keys) {
    summary[key].jpy = Math.round(summary[key].jpy * 100) / 100;
    summary[key].cny = Math.round(summary[key].cny * 100) / 100;
    summary[key].referenceJpy = Math.round(summary[key].referenceJpy * 100) / 100;
  }
  summary.operatingNetReferenceJpy = Math.round((summary.operatingIncome.referenceJpy - summary.operatingExpense.referenceJpy) * 100) / 100;
  summary.bankNetReferenceJpy = Math.round((summary.bankIncome.referenceJpy - summary.bankExpense.referenceJpy) * 100) / 100;
  return summary;
}

/**
 * Aggregates source-of-truth cashflow rows without changing them. Bank movement
 * includes internal transfers, while operating movement excludes them.
 */
export function buildCashflowMonthlySummary(
  rows: RawMonthlyRow[],
  months = 12,
): CashflowMonthlySummary[] {
  const byMonth = new Map<string, CashflowMonthlySummary>();
  for (const row of rows) {
    const month = String(row.month || "");
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) continue;
    const amount = finiteNumber(row.totalAmount);
    const count = Math.max(0, Math.trunc(finiteNumber(row.recordCount)));
    const summary = byMonth.get(month) || emptyMonth(month);
    const flow = row.type === "income" ? "income" : "expense";
    const internal = CASHFLOW_INTERNAL_TRANSFER_CATEGORIES.has(String(row.category || "").trim());
    add(flow === "income" ? summary.bankIncome : summary.bankExpense, row.currency, amount, count);
    if (internal) {
      add(flow === "income" ? summary.internalTransferIncome : summary.internalTransferExpense, row.currency, amount, count);
    } else {
      add(flow === "income" ? summary.operatingIncome : summary.operatingExpense, row.currency, amount, count);
    }
    byMonth.set(month, summary);
  }

  return [...byMonth.values()]
    .sort((left, right) => right.month.localeCompare(left.month))
    .slice(0, Math.max(1, months))
    .map(roundSummary);
}
