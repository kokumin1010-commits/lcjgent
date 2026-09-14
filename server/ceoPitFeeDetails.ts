import { sql } from "drizzle-orm";
import { CASHFLOW_REFERENCE_CNY_JPY } from "./cashflowMonthlySummary";
import { getDb } from "./db";

const PIT_FEE_CATEGORY = "売上高-ライブ枠料収入";

export type CeoPitFeeRecord = {
  id: number;
  transactionDate: string;
  entity: "japan" | "china";
  counterparty: string | null;
  description: string | null;
  sourceAccount: string | null;
  currency: "JPY" | "CNY";
  amount: number;
  referenceJpy: number;
  receiptUrl: string | null;
  updatedAt: string | null;
};

export type CeoPitFeeMonth = {
  month: string;
  registered: boolean;
  recordCount: number;
  jpy: number | null;
  cny: number | null;
  referenceJpy: number | null;
};

type PitFeeDatabaseRow = {
  id?: unknown;
  transactionDate?: unknown;
  entity?: unknown;
  counterparty?: unknown;
  description?: unknown;
  sourceAccount?: unknown;
  currency?: unknown;
  amount?: unknown;
  receiptUrl?: unknown;
  updatedAt?: unknown;
};

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function dateOnly(value: unknown): string | null {
  const text = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").trim().slice(0, 10).replace(/\//g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function formatDateInTimeZone(date: Date, timeZone = "Asia/Tokyo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rowsFromResult<T>(result: unknown): T[] {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0] as T[];
}

export function buildCeoPitFeeDetails(
  today: string,
  months: number,
  rows: PitFeeDatabaseRow[],
) {
  const normalizedMonths = Math.max(3, Math.min(24, Math.trunc(months)));
  const currentMonth = monthKey(today);
  const firstMonth = shiftMonth(currentMonth, -(normalizedMonths - 1));
  const monthMap = new Map<string, { recordCount: number; jpy: number; cny: number; referenceJpy: number }>();

  const records: CeoPitFeeRecord[] = rows.flatMap((row) => {
    const transactionDate = dateOnly(row.transactionDate);
    if (!transactionDate || transactionDate > today) return [];
    const month = monthKey(transactionDate);
    if (month < firstMonth || month > currentMonth) return [];
    const currency = String(row.currency) === "CNY" ? "CNY" : "JPY";
    const entity = String(row.entity) === "china" ? "china" : "japan";
    const amount = numberValue(row.amount);
    const referenceJpy = currency === "CNY" ? amount * CASHFLOW_REFERENCE_CNY_JPY : amount;
    const aggregate = monthMap.get(month) || { recordCount: 0, jpy: 0, cny: 0, referenceJpy: 0 };
    aggregate.recordCount += 1;
    aggregate.jpy += currency === "JPY" ? amount : 0;
    aggregate.cny += currency === "CNY" ? amount : 0;
    aggregate.referenceJpy += referenceJpy;
    monthMap.set(month, aggregate);

    return [{
      id: numberValue(row.id),
      transactionDate,
      entity,
      counterparty: stringOrNull(row.counterparty),
      description: stringOrNull(row.description),
      sourceAccount: stringOrNull(row.sourceAccount),
      currency,
      amount,
      referenceJpy,
      receiptUrl: stringOrNull(row.receiptUrl),
      updatedAt: isoOrNull(row.updatedAt),
    } satisfies CeoPitFeeRecord];
  });

  const monthly: CeoPitFeeMonth[] = Array.from({ length: normalizedMonths }, (_, index) => {
    const month = shiftMonth(firstMonth, index);
    const aggregate = monthMap.get(month);
    return aggregate
      ? {
          month,
          registered: true,
          recordCount: aggregate.recordCount,
          jpy: aggregate.jpy,
          cny: aggregate.cny,
          referenceJpy: aggregate.referenceJpy,
        }
      : {
          month,
          registered: false,
          recordCount: 0,
          jpy: null,
          cny: null,
          referenceJpy: null,
        };
  });

  const total = records.reduce((sum, record) => {
    sum.recordCount += 1;
    sum.jpy += record.currency === "JPY" ? record.amount : 0;
    sum.cny += record.currency === "CNY" ? record.amount : 0;
    sum.referenceJpy += record.referenceJpy;
    return sum;
  }, { recordCount: 0, jpy: 0, cny: 0, referenceJpy: 0 });

  return {
    readOnly: true as const,
    category: PIT_FEE_CATEGORY,
    referenceRateCnyToJpy: CASHFLOW_REFERENCE_CNY_JPY,
    period: {
      start: `${firstMonth}-01`,
      end: today,
      months: normalizedMonths,
    },
    total: {
      registered: total.recordCount > 0,
      ...total,
    },
    monthly,
    records,
    definitions: {
      basis: "company_cashflowsのincomeかつ売上高-ライブ枠料収入。削除済み行と未来日付は除外します。",
      currency: `JPYは原額、CNYは原額と1 CNY=${CASHFLOW_REFERENCE_CNY_JPY} JPYの管理参考額を併記します。`,
      access: "在職・非归档・非統合のCEO本人だけが閲覧できる読み取り専用データです。財務パスワードは要求しません。",
    },
  };
}

export async function getCeoPitFeeDetails(now = new Date(), months = 12) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = formatDateInTimeZone(now);
  const normalizedMonths = Math.max(3, Math.min(24, Math.trunc(months)));
  const firstMonth = shiftMonth(monthKey(today), -(normalizedMonths - 1));
  const startDate = `${firstMonth}-01`;

  const result = await db.execute(sql`
    SELECT
      id,
      transactionDate,
      entity,
      counterparty,
      description,
      sourceAccount,
      currency,
      amount,
      receiptUrl,
      updatedAt
    FROM company_cashflows
    WHERE deletedAt IS NULL
      AND type = 'income'
      AND category = ${PIT_FEE_CATEGORY}
      AND transactionDate >= ${startDate}
      AND transactionDate <= ${today}
    ORDER BY transactionDate DESC, id DESC
  `);

  return buildCeoPitFeeDetails(today, normalizedMonths, rowsFromResult<PitFeeDatabaseRow>(result));
}
