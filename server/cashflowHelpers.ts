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
