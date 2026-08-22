export const ACTIVE_CASHFLOW_ACCOUNTS = [
  "世曜元宇(中信銀行)",
  "LCJ MITSUI",
  "LCJ RESONA",
] as const;

export const RETIRED_CASHFLOW_ACCOUNTS = ["花秘", "品汇盟", "日本総部"] as const;

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
