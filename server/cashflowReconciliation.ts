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
  isPayroll?: boolean;
};

type ReconciliationOptions = {
  payrollUnlocked: boolean;
  exchangeRate?: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildCashflowReconciliation(
  sourceRows: CashflowReconciliationSourceRow[],
  options: ReconciliationOptions,
) {
  const exchangeRate = options.exchangeRate ?? 20.5;
  const visibleRows: Array<{
    id: number | string;
    entity: "japan" | "china";
    type: "income" | "expense";
    category: string;
    amount: number;
    currency: "JPY" | "CNY";
    transactionDate: string;
    dateEnd: string | null;
    counterparty: string | null;
    description: string | null;
    sourceAccount: string | null;
    groupedCount: number;
    payrollProtected: boolean;
  }> = [];
  const payrollGroups = new Map<string, typeof visibleRows[number]>();

  for (const source of sourceRows) {
    const amount = roundMoney(Number(source.amount || 0));
    if (source.isPayroll && !options.payrollUnlocked) {
      const key = `${source.entity}:${source.currency}:${source.sourceAccount || "unassigned"}`;
      const existing = payrollGroups.get(key);
      if (existing) {
        existing.amount = roundMoney(existing.amount + amount);
        existing.groupedCount += 1;
        if (source.transactionDate < existing.transactionDate) existing.transactionDate = source.transactionDate;
        if (!existing.dateEnd || source.transactionDate > existing.dateEnd) existing.dateEnd = source.transactionDate;
      } else {
        payrollGroups.set(key, {
          id: `payroll:${key}`,
          entity: source.entity,
          type: source.type,
          category: "工资合计（个人明细已保护）",
          amount,
          currency: source.currency,
          transactionDate: source.transactionDate,
          dateEnd: source.transactionDate,
          counterparty: null,
          description: null,
          sourceAccount: source.sourceAccount || null,
          groupedCount: 1,
          payrollProtected: true,
        });
      }
      continue;
    }

    visibleRows.push({
      id: source.id,
      entity: source.entity,
      type: source.type,
      category: source.category,
      amount,
      currency: source.currency,
      transactionDate: source.transactionDate,
      dateEnd: null,
      counterparty: source.counterparty || null,
      description: source.description || null,
      sourceAccount: source.sourceAccount || null,
      groupedCount: 1,
      payrollProtected: false,
    });
  }

  visibleRows.push(...payrollGroups.values());
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
    protectedPayrollRowCount: sourceRows.filter(row => row.isPayroll && !options.payrollUnlocked).length,
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
