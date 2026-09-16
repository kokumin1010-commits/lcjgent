export type NormalizedStoreShopStats = {
  data: Record<string, unknown>[];
  headerRowIndex: number;
  dateHeader: string;
  gmvHeader: string;
  businessDates: string[];
};

type CanonicalMetric = "GMV" | "注文" | "カスタマー数" | "退款金额";

const DATE_HEADERS = new Set(["日期", "日付", "date", "day", "年月日", "日時", "时间", "時間", "期间", "期間"]);
const TOTAL_LABEL = /^(总计值|總計值|合计|合計|総計|total|grand total)$/i;
const NON_ADDITIVE_HEADER = /%|率|roi|roas|ctr|ctor|conversion|转化|転換|平均|人均|avg|average|时长|時長/i;

const METRIC_ALIASES: Record<CanonicalMetric, string[]> = {
  GMV: [
    "GMV",
    "商品GMV",
    "売上",
    "销售额",
    "Gross revenue",
    "总成交额",
    "総取引額",
    "直播归因 GMV",
    "直播归因GMV",
    "ライブ帰属 GMV",
    "LIVE帰属 GMV",
  ],
  注文: ["注文", "注文数", "订单", "订单数", "Orders", "归因 SKU 订单数", "帰属 SKU 注文数"],
  カスタマー数: ["カスタマー数", "顧客数", "客户数", "Customers", "Buyers", "客户数（搜索）", "顧客数（検索）"],
  退款金额: ["退款金额", "退款金額", "返金金額", "返金", "返品金額", "キャンセル金額", "Refund amount", "Refund"],
};

function text(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/\ufeff|\u200b/g, "").trim();
}

function token(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s_\-/:：・]/g, "")
    .replace(/[¥￥円]/g, "");
}

function canonicalMetric(header: unknown): CanonicalMetric | null {
  const normalized = token(header);
  if (!normalized) return null;
  for (const [metric, aliases] of Object.entries(METRIC_ALIASES) as [CanonicalMetric, string[]][]) {
    if (aliases.some(alias => token(alias) === normalized)) return metric;
  }
  return null;
}

function uniqueHeaders(row: unknown[]): string[] {
  const counts = new Map<string, number>();
  return row.map((value, index) => {
    const base = text(value) || `col_${index}`;
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen + 1}`;
  });
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const normalized = text(value).replace(/[.]/g, "/");
  if (!normalized) return null;
  let match = normalized.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (!match) match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "-" || value === "—") return null;
  if (value && typeof value === "object" && "value" in value) return numeric((value as { value?: unknown }).value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[¥￥円,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function bestHeader(matrix: unknown[][]): { rowIndex: number; dateColumn: number; headers: string[]; gmvHeader: string } | null {
  let best: { rowIndex: number; dateColumn: number; headers: string[]; gmvHeader: string; score: number } | null = null;
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 100); rowIndex += 1) {
    const headers = uniqueHeaders(matrix[rowIndex] || []);
    const dateColumn = headers.findIndex(header => DATE_HEADERS.has(text(header).toLowerCase()));
    if (dateColumn < 0) continue;
    const gmvHeader = headers.find(header => canonicalMetric(header) === "GMV");
    if (!gmvHeader) continue;
    const recognized = headers.filter(header => canonicalMetric(header)).length;
    const datedRows = matrix.slice(rowIndex + 1, rowIndex + 40).filter(row => isoDate(row?.[dateColumn])).length;
    const score = recognized * 10 + datedRows;
    if (!best || score > best.score) best = { rowIndex, dateColumn, headers, gmvHeader, score };
  }
  return best;
}

function rowObject(headers: string[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function findMetricValue(row: Record<string, unknown>, metric: CanonicalMetric): number | null {
  for (const [header, value] of Object.entries(row)) {
    if (canonicalMetric(header) === metric) return numeric(value);
  }
  return null;
}

export function hasRecognizedStoreGmv(rows: Record<string, unknown>[]): boolean {
  return rows.some(row => findMetricValue(row, "GMV") !== null);
}

export function normalizeStoreShopStatsMatrix(matrix: unknown[][]): NormalizedStoreShopStats | null {
  const header = bestHeader(matrix);
  if (!header) return null;
  const dailyRows = matrix
    .slice(header.rowIndex + 1)
    .map(row => ({ row, date: isoDate(row?.[header.dateColumn]) }))
    .filter((entry): entry is { row: unknown[]; date: string } => Boolean(entry.date))
    .map(entry => {
      const result = rowObject(header.headers, entry.row);
      result.日期 = entry.date;
      for (const metric of Object.keys(METRIC_ALIASES) as CanonicalMetric[]) {
        const value = findMetricValue(result, metric);
        if (value !== null) result[metric] = value;
      }
      return result;
    });
  if (!dailyRows.length || !hasRecognizedStoreGmv(dailyRows)) return null;

  const totalIndex = matrix.findIndex(row => row.some(value => TOTAL_LABEL.test(text(value))));
  const totalValues = totalIndex >= 0 ? rowObject(header.headers, matrix[totalIndex] || []) : null;
  const summary: Record<string, unknown> = { _type: "summary" };
  for (const column of header.headers) {
    if (!column || column.startsWith("col_") || DATE_HEADERS.has(text(column).toLowerCase())) continue;
    const fromTotal = totalValues ? numeric(totalValues[column]) : null;
    const values = dailyRows.map(row => numeric(row[column])).filter((value): value is number => value !== null);
    if (fromTotal !== null) summary[column] = { value: fromTotal, pct: 0 };
    else if (values.length && !NON_ADDITIVE_HEADER.test(column)) summary[column] = { value: values.reduce((sum, value) => sum + value, 0), pct: 0 };
  }
  for (const metric of Object.keys(METRIC_ALIASES) as CanonicalMetric[]) {
    const values = dailyRows.map(row => findMetricValue(row, metric)).filter((value): value is number => value !== null);
    if (values.length) summary[metric] = { value: values.reduce((sum, value) => sum + value, 0), pct: 0 };
  }

  return {
    data: [summary, ...dailyRows],
    headerRowIndex: header.rowIndex,
    dateHeader: header.headers[header.dateColumn],
    gmvHeader: header.gmvHeader,
    businessDates: dailyRows.map(row => String(row.日期)),
  };
}
