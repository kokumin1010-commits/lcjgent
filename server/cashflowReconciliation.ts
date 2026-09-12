export type CashflowReconciliationSourceRow = {
  id: number;
  entity: "japan" | "china";
  type: "income" | "expense";
  category: string;
  amount: number | string;
  currency: "JPY" | "CNY";
  transactionDate: string;
  counterparty?: string | null;
  description?: string | null;
  sourceAccount?: string | null;
  receiptUrl?: string | null;
  payrollEmployee?: string | null;
  payrollMonth?: string | null;
  payrollRecordKey?: string | null;
  importDocumentId?: number | string | null;
  importDocumentName?: string | null;
  isPayroll?: boolean;
};

type ReconciliationOptions = {
  exchangeRate?: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildCashflowReconciliation(
  sourceRows: CashflowReconciliationSourceRow[],
  options: ReconciliationOptions = {},
) {
  const exchangeRate = options.exchangeRate ?? 20.5;
  const visibleRows = sourceRows.map((source) => ({
    id: source.id,
    entity: source.entity,
    type: source.type,
    category: source.category,
    amount: roundMoney(Number(source.amount || 0)),
    currency: source.currency,
    transactionDate: source.transactionDate,
    dateEnd: null as string | null,
    counterparty: source.counterparty || source.payrollEmployee || null,
    description: source.description || null,
    sourceAccount: source.sourceAccount || null,
    receiptUrl: source.receiptUrl || null,
    payrollEmployee: source.payrollEmployee || null,
    payrollMonth: source.payrollMonth || null,
    payrollRecordKey: source.payrollRecordKey || null,
    importDocumentId: source.importDocumentId == null ? null : Number(source.importDocumentId),
    importDocumentName: source.importDocumentName || null,
    groupedCount: 1,
    payrollProtected: false,
  }));

  visibleRows.sort((left, right) => {
    const leftReference = left.currency === "CNY" ? left.amount * exchangeRate : left.amount;
    const rightReference = right.currency === "CNY" ? right.amount * exchangeRate : right.amount;
    return rightReference - leftReference
      || right.transactionDate.localeCompare(left.transactionDate)
      || String(right.id).localeCompare(String(left.id));
  });

  let runningJpy = 0;
  let runningCny = 0;
  let runningReferenceJpy = 0;
  const items = visibleRows.map((row, index) => {
    if (row.currency === "CNY") runningCny = roundMoney(runningCny + row.amount);
    else runningJpy = roundMoney(runningJpy + row.amount);
    const referenceAmountJpy = roundMoney(row.currency === "CNY" ? row.amount * exchangeRate : row.amount);
    runningReferenceJpy = roundMoney(runningJpy + runningCny * exchangeRate);
    return {
      ...row,
      sequence: index + 1,
      referenceAmountJpy,
      runningJpy,
      runningCny,
      runningReferenceJpy,
    };
  });

  const totalJpy = roundMoney(sourceRows
    .filter(row => row.currency === "JPY")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const totalCny = roundMoney(sourceRows
    .filter(row => row.currency === "CNY")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const referenceJpy = roundMoney(totalJpy + totalCny * exchangeRate);

  return {
    exchangeRate,
    sourceRowCount: sourceRows.length,
    displayRowCount: items.length,
    payrollRowCount: sourceRows.filter(row => row.isPayroll).length,
    protectedPayrollRowCount: 0,
    totals: { jpy: totalJpy, cny: totalCny, referenceJpy },
    reconstructed: {
      jpy: runningJpy,
      cny: runningCny,
      referenceJpy: runningReferenceJpy,
    },
    difference: {
      jpy: roundMoney(totalJpy - runningJpy),
      cny: roundMoney(totalCny - runningCny),
      referenceJpy: roundMoney(referenceJpy - runningReferenceJpy),
    },
    items,
  };
}
