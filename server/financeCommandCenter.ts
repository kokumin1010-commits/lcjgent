import { PAYROLL_REFERENCE_CNY_JPY } from "./payrollCommandCenter";

export type FinanceCommandCurrency = "JPY" | "CNY";
export type FinanceCommandEntity = "japan" | "china";

export type FinanceCommandCashflow = {
  id: number;
  entity: FinanceCommandEntity;
  type: "income" | "expense";
  category: string;
  amount: number;
  currency: FinanceCommandCurrency;
  transactionDate: string;
  counterparty?: string | null;
  description?: string | null;
  sourceAccount?: string | null;
  receiptUrl?: string | null;
};

export type FinanceCommandBalance = {
  accountName: string;
  entity: FinanceCommandEntity;
  currency: FinanceCommandCurrency;
  amount: number;
  asOf?: string | null;
};

export type FinanceCommandImportDocument = {
  id: number;
  module: string;
  sourceFileName: string;
  originalFileSaved: boolean;
  status: string;
  recordCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: Date | string;
};

const DAY_MS = 86_400_000;

function dateOnly(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string | null | undefined, to: string): number | null {
  if (!from) return null;
  const start = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function sum(rows: FinanceCommandCashflow[], currency: FinanceCommandCurrency, type?: "income" | "expense") {
  return rows
    .filter((row) => row.currency === currency && (!type || row.type === type))
    .reduce((total, row) => total + Number(row.amount || 0), 0);
}

function periodRows(rows: FinanceCommandCashflow[], asOf: string, days: number) {
  const end = new Date(`${asOf}T23:59:59Z`).getTime();
  const start = end - (days - 1) * DAY_MS;
  return rows.filter((row) => {
    const time = new Date(`${row.transactionDate.slice(0, 10)}T12:00:00Z`).getTime();
    return time >= start && time <= end;
  });
}

function hasReceipt(receiptUrl: string | null | undefined): boolean {
  if (!receiptUrl) return false;
  try {
    const parsed = JSON.parse(receiptUrl);
    return Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed);
  } catch {
    return Boolean(receiptUrl.trim());
  }
}

function flowSummary(rows: FinanceCommandCashflow[]) {
  const jpyIncome = sum(rows, "JPY", "income");
  const jpyExpense = sum(rows, "JPY", "expense");
  const cnyIncome = sum(rows, "CNY", "income");
  const cnyExpense = sum(rows, "CNY", "expense");
  return {
    jpy: { income: jpyIncome, expense: jpyExpense, net: jpyIncome - jpyExpense },
    cny: { income: cnyIncome, expense: cnyExpense, net: cnyIncome - cnyExpense },
    referenceJpy: {
      income: Math.round(jpyIncome + cnyIncome * PAYROLL_REFERENCE_CNY_JPY),
      expense: Math.round(jpyExpense + cnyExpense * PAYROLL_REFERENCE_CNY_JPY),
      net: Math.round(jpyIncome - jpyExpense + (cnyIncome - cnyExpense) * PAYROLL_REFERENCE_CNY_JPY),
    },
    transactionCount: rows.length,
  };
}

export function buildFinanceCommandCenter(input: {
  rows: FinanceCommandCashflow[];
  balances: FinanceCommandBalance[];
  importDocuments?: FinanceCommandImportDocument[];
  now?: Date | string;
}) {
  const nowDate = input.now ? new Date(input.now) : new Date();
  const asOf = dateOnly(nowDate);
  const rows = input.rows.filter((row) => row.transactionDate <= asOf);
  const last7 = periodRows(rows, asOf, 7);
  const last30 = periodRows(rows, asOf, 30);
  const last90 = periodRows(rows, asOf, 90);
  const oldestRowDate = rows.map((row) => row.transactionDate).filter(Boolean).sort()[0] || null;
  const coverageDays = oldestRowDate ? (daysBetween(oldestRowDate, asOf) || 0) + 1 : 0;
  const balances = input.balances.map((balance) => ({
    ...balance,
    amount: Number(balance.amount || 0),
    staleDays: daysBetween(balance.asOf, asOf),
    freshness: balance.asOf == null ? "missing" as const : (daysBetween(balance.asOf, asOf) || 0) > 2 ? "stale" as const : "fresh" as const,
  }));
  const balanceJpy = balances.filter((item) => item.currency === "JPY").reduce((total, item) => total + item.amount, 0);
  const balanceCny = balances.filter((item) => item.currency === "CNY").reduce((total, item) => total + item.amount, 0);
  const monthlyExpenseJpy = sum(last90, "JPY", "expense") / 3;
  const monthlyExpenseCny = sum(last90, "CNY", "expense") / 3;
  const referenceMonthlyExpenseJpy = monthlyExpenseJpy + monthlyExpenseCny * PAYROLL_REFERENCE_CNY_JPY;
  const balanceReferenceJpy = balanceJpy + balanceCny * PAYROLL_REFERENCE_CNY_JPY;

  const categoryMap = new Map<string, { category: string; currency: FinanceCommandCurrency; amount: number; count: number }>();
  for (const row of last30.filter((item) => item.type === "expense")) {
    const key = `${row.currency}|${row.category}`;
    const current = categoryMap.get(key) || { category: row.category || "未分类", currency: row.currency, amount: 0, count: 0 };
    current.amount += Number(row.amount || 0);
    current.count += 1;
    categoryMap.set(key, current);
  }
  const topExpenseCategories = [...categoryMap.values()]
    .sort((a, b) => (b.currency === a.currency ? b.amount - a.amount : a.currency.localeCompare(b.currency)))
    .slice(0, 8);

  const actions: Array<{
    key: string;
    severity: "high" | "medium" | "low";
    type: string;
    title: string;
    detail: string;
    targetTab: "cashflow" | "imports";
  }> = [];

  for (const balance of balances) {
    if (balance.amount < 0) {
      actions.push({ key: `negative|${balance.accountName}`, severity: "high", type: "negative_balance", title: "账户余额为负", detail: `${balance.accountName} 需要立即核对`, targetTab: "cashflow" });
    }
    if (balance.freshness !== "fresh") {
      actions.push({ key: `stale|${balance.accountName}`, severity: balance.freshness === "missing" ? "high" : "medium", type: "stale_account", title: "银行数据未更新", detail: balance.asOf ? `${balance.accountName} 最后数据为${balance.asOf}` : `${balance.accountName} 没有余额基准日`, targetTab: "cashflow" });
    }
  }

  const missingReceiptRows = last30.filter((row) => row.type === "expense" && !hasReceipt(row.receiptUrl) && (row.currency === "JPY" ? row.amount >= 100_000 : row.amount >= 5_000));
  if (missingReceiptRows.length) {
    actions.push({ key: "missing_receipts", severity: "high", type: "missing_receipt", title: "大额支出缺少请求书", detail: `最近30天有${missingReceiptRows.length}件达到阈值但未附文件`, targetTab: "cashflow" });
  }

  const incompleteRows = last30.filter((row) => !String(row.description || "").trim() && !String(row.counterparty || "").trim());
  if (incompleteRows.length) {
    actions.push({ key: "incomplete_rows", severity: "medium", type: "incomplete_row", title: "交易说明不完整", detail: `最近30天有${incompleteRows.length}件缺少取引先和说明`, targetTab: "cashflow" });
  }

  const duplicateMap = new Map<string, number>();
  for (const row of last30) {
    const key = [row.entity, row.currency, row.type, row.transactionDate, Number(row.amount).toFixed(2), String(row.counterparty || "").trim().toLowerCase()].join("|");
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }
  const possibleDuplicateCount = [...duplicateMap.values()].reduce((total, count) => total + (count > 1 ? count : 0), 0);
  if (possibleDuplicateCount) {
    actions.push({ key: "possible_duplicates", severity: "medium", type: "possible_duplicate", title: "可能的重复记录", detail: `最近30天有${possibleDuplicateCount}件需要人工确认`, targetTab: "cashflow" });
  }

  const documents = [...(input.importDocuments || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const failedImports = documents.filter((item) => item.status === "failed");
  const unsavedImports = documents.filter((item) => !item.originalFileSaved);
  if (failedImports.length) {
    actions.push({ key: "failed_imports", severity: "high", type: "failed_import", title: "导入失败待处理", detail: `有${failedImports.length}个文件导入失败，原文件已保留`, targetTab: "imports" });
  }
  if (unsavedImports.length) {
    actions.push({ key: "unsaved_imports", severity: "high", type: "unsaved_import", title: "原文件保存异常", detail: `有${unsavedImports.length}个新批次缺少原文件`, targetTab: "imports" });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 } as const;
  actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    asOf,
    referenceRate: { cnyToJpy: PAYROLL_REFERENCE_CNY_JPY, type: "reference" as const },
    balances: {
      accounts: balances,
      jpy: balanceJpy,
      cny: balanceCny,
      referenceJpy: Math.round(balanceReferenceJpy),
    },
    flows: {
      last7: flowSummary(last7),
      last30: flowSummary(last30),
    },
    runway: {
      method: "最近90天实际支出的月均值",
      confidence: coverageDays >= 90 ? "medium" as const : "low" as const,
      coverageDays,
      monthlyExpenseJpy,
      monthlyExpenseCny,
      referenceMonthlyExpenseJpy: Math.round(referenceMonthlyExpenseJpy),
      japanMonths: monthlyExpenseJpy > 0 ? Number((balanceJpy / monthlyExpenseJpy).toFixed(2)) : null,
      chinaMonths: monthlyExpenseCny > 0 ? Number((balanceCny / monthlyExpenseCny).toFixed(2)) : null,
      combinedReferenceMonths: referenceMonthlyExpenseJpy > 0 ? Number((balanceReferenceJpy / referenceMonthlyExpenseJpy).toFixed(2)) : null,
    },
    topExpenseCategories,
    actions,
    actionCounts: {
      high: actions.filter((item) => item.severity === "high").length,
      medium: actions.filter((item) => item.severity === "medium").length,
      total: actions.length,
    },
    dataQuality: {
      staleAccountCount: balances.filter((item) => item.freshness !== "fresh").length,
      missingReceiptCount: missingReceiptRows.length,
      incompleteRowCount: incompleteRows.length,
      possibleDuplicateCount,
      failedImportCount: failedImports.length,
      unsavedImportCount: unsavedImports.length,
    },
    latestImports: documents.slice(0, 8),
    rowCount: rows.length,
  };
}
