export const SHORT_VIDEO_DAILY_PAGE_KEY = "/master/short-video";
export const SHORT_VIDEO_DAILY_TIME_ZONE = "Asia/Tokyo";
export const SHORT_VIDEO_DAILY_CURRENCIES = ["JPY", "CNY"] as const;

export type ShortVideoDailyCurrency =
  (typeof SHORT_VIDEO_DAILY_CURRENCIES)[number];

export type ShortVideoDailyMetricInput = {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  productClicks?: number | null;
  orders?: number | null;
  gmv?: number | string | null;
};

export type ShortVideoDailyMetricSummary = {
  postCount: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagements: number;
  productClicks: number;
  orders: number;
  gmv: number;
  engagementRate: number | null;
  clickRate: number | null;
  clickConversionRate: number | null;
  viewConversionRate: number | null;
};

function finiteNonNegative(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function calculateShortVideoDailyMetrics(
  rows: ShortVideoDailyMetricInput[]
): ShortVideoDailyMetricSummary {
  const totals = rows.reduce(
    (sum, row) => ({
      views: sum.views + finiteNonNegative(row.views),
      likes: sum.likes + finiteNonNegative(row.likes),
      comments: sum.comments + finiteNonNegative(row.comments),
      shares: sum.shares + finiteNonNegative(row.shares),
      saves: sum.saves + finiteNonNegative(row.saves),
      productClicks: sum.productClicks + finiteNonNegative(row.productClicks),
      orders: sum.orders + finiteNonNegative(row.orders),
      gmv: sum.gmv + finiteNonNegative(row.gmv),
    }),
    {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      productClicks: 0,
      orders: 0,
      gmv: 0,
    }
  );
  const engagements =
    totals.likes + totals.comments + totals.shares + totals.saves;
  return {
    postCount: rows.length,
    ...totals,
    engagements,
    engagementRate: totals.views > 0 ? engagements / totals.views : null,
    clickRate: totals.views > 0 ? totals.productClicks / totals.views : null,
    clickConversionRate:
      totals.productClicks > 0 ? totals.orders / totals.productClicks : null,
    viewConversionRate: totals.views > 0 ? totals.orders / totals.views : null,
  };
}

function formatTokyoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHORT_VIDEO_DAILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function getTokyoToday(now = new Date()): string {
  return formatTokyoDate(now);
}

export function getDefaultShortVideoReportDate(now = new Date()): string {
  const tokyoToday = getTokyoToday(now);
  const midnightUtc = new Date(`${tokyoToday}T00:00:00Z`);
  midnightUtc.setUTCDate(midnightUtc.getUTCDate() - 1);
  return midnightUtc.toISOString().slice(0, 10);
}

export function isValidBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isFutureTokyoDate(value: string, now = new Date()): boolean {
  return !isValidBusinessDate(value) || value > getTokyoToday(now);
}

export function getMonthBounds(month: string): {
  startDate: string;
  endDate: string;
} {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("invalid month");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function normalizeShortVideoUrl(value: string): string {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("video URL must use http or https");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}
