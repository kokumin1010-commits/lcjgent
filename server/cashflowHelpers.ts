export const ACTIVE_CASHFLOW_ACCOUNTS = [
  "世曜元宇(中信銀行)",
  "LCJ MITSUI",
  "LCJ RESONA",
] as const;

export const RETIRED_CASHFLOW_ACCOUNTS = ["花秘", "品汇盟", "日本総部"] as const;

export const CASHFLOW_ACCOUNT_IDENTITIES = {
  "LCJ MITSUI": { entity: "japan", currency: "JPY" },
  "LCJ RESONA": { entity: "japan", currency: "JPY" },
  "世曜元宇(中信銀行)": { entity: "china", currency: "CNY" },
} as const;

type CashflowEntity = "japan" | "china";
type CashflowCurrency = "JPY" | "CNY";

export function resolveCashflowIdentity(input: {
  sourceAccount?: string | null;
  payrollRecordKey?: string | null;
  entity?: CashflowEntity | null;
  currency?: CashflowCurrency | null;
}): { entity: CashflowEntity; currency: CashflowCurrency; currencySource: "account" | "payroll" | "explicit" | "entity" } {
  const account = String(input.sourceAccount || "").trim() as keyof typeof CASHFLOW_ACCOUNT_IDENTITIES;
  if (account && CASHFLOW_ACCOUNT_IDENTITIES[account]) {
    return { ...CASHFLOW_ACCOUNT_IDENTITIES[account], currencySource: "account" };
  }

  const payrollEntity = String(input.payrollRecordKey || "").split("|")[0];
  if (payrollEntity === "japan") return { entity: "japan", currency: "JPY", currencySource: "payroll" };
  if (payrollEntity === "china") return { entity: "china", currency: "CNY", currencySource: "payroll" };

  if (input.currency) {
    return {
      entity: input.entity || (input.currency === "JPY" ? "japan" : "china"),
      currency: input.currency,
      currencySource: "explicit",
    };
  }

  const entity = input.entity || "japan";
  return { entity, currency: entity === "japan" ? "JPY" : "CNY", currencySource: "entity" };
}

export const MAX_CASHFLOW_RECEIPTS = 9;

export function parseCashflowReceiptUrls(value: unknown): string[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((url): url is string => typeof url === "string" && url.length > 0);
    }
  } catch {
    // Legacy records store one URL as plain text.
  }
  return value.length > 0 ? [value] : [];
}

export function canAppendCashflowReceipts(existingCount: number, incomingCount = 1): boolean {
  return existingCount >= 0 && incomingCount > 0 && existingCount + incomingCount <= MAX_CASHFLOW_RECEIPTS;
}

export function appendCashflowFilter(
  where: string,
  params: unknown[],
  column: "transactionDate" | "sourceAccount",
  operator: ">=" | "<=" | "=",
  value?: string,
) {
  if (!value) return { where, params };
  return {
    where: `${where} AND ${column} ${operator} ?`,
    params: [...params, value],
  };
}

export function normalizePayrollMonth(value: unknown, fallbackYear?: number): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const fullMatch = text.match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])(?:\D|$)/);
  if (fullMatch) return `${fullMatch[1]}-${String(Number(fullMatch[2])).padStart(2, "0")}`;
  const monthMatch = text.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*月/);
  if (monthMatch && fallbackYear) {
    return `${fallbackYear}-${String(Number(monthMatch[1])).padStart(2, "0")}`;
  }
  return null;
}

export function payrollMonthEndDate(payrollMonth: string): string {
  const match = payrollMonth.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) throw new Error(`Invalid payroll month: ${payrollMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${payrollMonth}-${String(lastDay).padStart(2, "0")}`;
}

export function normalizePayrollEmployee(value: string): string {
  return value.normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase();
}

const PAYROLL_BANK_ALIASES: Record<string, string[]> = {
  "chozenkosaka": ["choco"],
  "村上紫保": ["shiho"],
  "木崎綾音": ["hazuki"],
  "藤井瞳": ["hitomi"],
};

export function payrollBankDescriptionMatches(employeeName: string, payrollMonth: string, description: string): boolean {
  const normalizedEmployee = normalizePayrollEmployee(employeeName);
  const normalizedDescription = normalizePayrollEmployee(description);
  const month = Number(payrollMonth.slice(5, 7));
  if (!month || !normalizedDescription.includes(`${month}月`)) return false;
  const tokens = [normalizedEmployee, ...(PAYROLL_BANK_ALIASES[normalizedEmployee] || [])];
  return tokens.some(token => token && normalizedDescription.includes(token));
}

export function buildPayrollRecordKey(entity: "japan" | "china", payrollMonth: string, employeeName: string): string {
  return `${entity}|${payrollMonth}|${normalizePayrollEmployee(employeeName)}`;
}

export function calculatePayrollDifference(sourceTotal: number, generatedTotal: number): number {
  return Math.round((sourceTotal - generatedTotal) * 100) / 100;
}

export function isSettledPayrollCashflow(input: {
  cashflowId?: number | null;
  cashflowDeletedAt?: unknown;
  cashflowType?: string | null;
  cashflowCategory?: string | null;
  cashflowAmount?: number | string | null;
  netPay?: number | string | null;
  sourceAccount?: string | null;
}): boolean {
  const account = String(input.sourceAccount || "").trim() as keyof typeof CASHFLOW_ACCOUNT_IDENTITIES;
  const amount = Number(input.cashflowAmount || 0);
  const netPay = Number(input.netPay || 0);
  return Boolean(
    input.cashflowId &&
    !input.cashflowDeletedAt &&
    input.cashflowType === "expense" &&
    input.cashflowCategory === "給与・人件費" &&
    CASHFLOW_ACCOUNT_IDENTITIES[account] &&
    Math.abs(amount - netPay) <= 0.01,
  );
}

export function isAuthoritativePaidLaborCashflow(input: {
  currency?: string | null;
  sourceAccount?: string | null;
}): boolean {
  const account = String(input.sourceAccount || "").trim() as keyof typeof CASHFLOW_ACCOUNT_IDENTITIES;
  const identity = CASHFLOW_ACCOUNT_IDENTITIES[account];
  return Boolean(identity && identity.currency === input.currency);
}

export type PaidLaborExpenseType = "employee_salary" | "payroll_batch" | "payroll_tax" | "outsourcing" | "needs_review";

export function classifyPaidLaborExpense(input: {
  payrollEmployee?: string | null;
  description?: string | null;
  counterparty?: string | null;
}): { type: PaidLaborExpenseType; label: string; note: string; originalSummary: string } {
  const originalSummary = [input.payrollEmployee, input.counterparty, input.description]
    .map(value => String(value || "").trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(" / ");
  const text = originalSummary.normalize("NFKC").toLowerCase();

  if (input.payrollEmployee) {
    return { type: "employee_salary", label: "员工工资", note: "员工个人工资付款；姓名与月份以工资表或银行摘要为准", originalSummary };
  }
  if (/(tips|缴税|繳税|納税|税金|个税|個人所得税|所得税|社保|社会保険|年金|健康保険)/i.test(text)) {
    return { type: "payroll_tax", label: "工资相关税费", note: "工资相关税费或社保缴纳；具体税种以银行回单为准", originalSummary };
  }
  if (/(代发业务款项|給与一括|工资代发|一括振込|兼职人员薪资|兼職人員薪資|员工工资合计|員工給与合計)/i.test(text)) {
    return { type: "payroll_batch", label: "工资批量代发", note: "银行批量代发工资；员工拆分请结合工资表或代发回单确认", originalSummary };
  }
  if (/(給与|給料|工资|工資|薪资|薪資)/i.test(text)) {
    return { type: "employee_salary", label: "员工工资", note: "员工个人工资付款；姓名与月份以工资表或银行摘要为准", originalSummary };
  }
  if (/(株式会社|有限会社|合同会社|有限公司|法人|ブランド管理|\(カ\)|（カ）|ｶ\))/i.test(text)) {
    return { type: "outsourcing", label: "外包 / 劳务服务", note: "公司或机构收款；具体劳务、外包或服务用途需结合合同或请求书确认", originalSummary };
  }
  return { type: "needs_review", label: "待确认", note: "银行摘要不足以判断具体用途，需要补充费用说明", originalSummary };
}

type PayrollAnalyticsRow = {
  entity: CashflowEntity;
  currency: CashflowCurrency;
  payrollMonth: string;
  employeeName: string;
  netPay: number | string;
};

export function buildPayrollAnalytics(rows: PayrollAnalyticsRow[], selectedMonth?: string) {
  const monthlyMap = new Map<string, { payrollMonth: string; jpyTotal: number; cnyTotal: number; employeeCount: number }>();
  const monthlyEmployees = new Map<string, Set<string>>();
  const rankingMap = new Map<string, { entity: CashflowEntity; currency: CashflowCurrency; employeeName: string; totalPay: number; monthCount: number; months: Set<string> }>();
  const firstPayMap = new Map<string, { entity: CashflowEntity; currency: CashflowCurrency; employeeName: string; firstPayrollMonth: string; firstPay: number }>();

  for (const row of rows) {
    const amount = Number(row.netPay || 0);
    const monthly = monthlyMap.get(row.payrollMonth) || { payrollMonth: row.payrollMonth, jpyTotal: 0, cnyTotal: 0, employeeCount: 0 };
    if (row.currency === "JPY") monthly.jpyTotal += amount;
    else monthly.cnyTotal += amount;
    monthlyMap.set(row.payrollMonth, monthly);
    const monthEmployees = monthlyEmployees.get(row.payrollMonth) || new Set<string>();
    monthEmployees.add(`${row.entity}|${normalizePayrollEmployee(row.employeeName)}`);
    monthlyEmployees.set(row.payrollMonth, monthEmployees);

    if (!selectedMonth || row.payrollMonth === selectedMonth) {
      const rankingKey = `${row.currency}|${normalizePayrollEmployee(row.employeeName)}`;
      const ranking = rankingMap.get(rankingKey) || { entity: row.entity, currency: row.currency, employeeName: row.employeeName, totalPay: 0, monthCount: 0, months: new Set<string>() };
      ranking.totalPay += amount;
      ranking.months.add(row.payrollMonth);
      ranking.monthCount = ranking.months.size;
      rankingMap.set(rankingKey, ranking);
    }

    const employeeKey = `${row.entity}|${normalizePayrollEmployee(row.employeeName)}`;
    const first = firstPayMap.get(employeeKey);
    if (!first || row.payrollMonth < first.firstPayrollMonth) {
      firstPayMap.set(employeeKey, { entity: row.entity, currency: row.currency, employeeName: row.employeeName, firstPayrollMonth: row.payrollMonth, firstPay: amount });
    } else if (row.payrollMonth === first.firstPayrollMonth) {
      first.firstPay += amount;
    }
  }

  const roundCurrency = (value: number) => Math.round(value * 100) / 100;
  const monthlyTotals = [...monthlyMap.values()]
    .map(item => ({
      ...item,
      jpyTotal: roundCurrency(item.jpyTotal),
      cnyTotal: roundCurrency(item.cnyTotal),
      employeeCount: monthlyEmployees.get(item.payrollMonth)?.size || 0,
    }))
    .sort((a, b) => a.payrollMonth.localeCompare(b.payrollMonth));
  const rankingRows = [...rankingMap.values()].map(({ months: _months, ...row }) => ({ ...row, totalPay: roundCurrency(row.totalPay) }));
  const salaryRanking = {
    JPY: rankingRows.filter(row => row.currency === "JPY").sort((a, b) => b.totalPay - a.totalPay).slice(0, 10),
    CNY: rankingRows.filter(row => row.currency === "CNY").sort((a, b) => b.totalPay - a.totalPay).slice(0, 10),
  };
  const newEmployees = [...firstPayMap.values()]
    .filter(row => !selectedMonth || row.firstPayrollMonth === selectedMonth)
    .sort((a, b) => b.firstPayrollMonth.localeCompare(a.firstPayrollMonth) || a.employeeName.localeCompare(b.employeeName))
    .slice(0, 20)
    .map(row => ({ ...row, firstPay: roundCurrency(row.firstPay) }));

  return { monthlyTotals, salaryRanking, newEmployees };
}
