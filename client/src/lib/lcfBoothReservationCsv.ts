/**
 * LCF admin booth reservation CSV export.
 * Current-view semantics, Excel-compatible UTF-8 BOM, and spreadsheet formula-injection protection.
 */

export type LcfBoothReservationExportFilter = "active" | "cancelled" | "all";
export type LcfBoothReservationExportSort = "latest" | "schedule";

export type LcfBoothReservationExportRow = {
  reservationId?: unknown;
  createdAtMs?: unknown;
  date?: unknown;
  timeSlot?: unknown;
  boothId?: unknown;
  bookingType?: unknown;
  creatorName?: unknown;
  email?: unknown;
  status?: unknown;
  statusLabel?: unknown;
  guidelineConflicts?: unknown;
};

const CSV_HEADERS = [
  "予約ID",
  "受付日時",
  "日付",
  "時間",
  "ブース",
  "区分",
  "クリエイター",
  "メール",
  "ステータス",
  "ルール確認",
] as const;

const FILTER_LABELS: Record<LcfBoothReservationExportFilter, string> = {
  active: "有効予約",
  cancelled: "終了・キャンセル",
  all: "すべて",
};

const SORT_LABELS: Record<LcfBoothReservationExportSort, string> = {
  latest: "最新受付順",
  schedule: "利用時間順",
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function protectLcfCsvFormula(value: unknown): string {
  const text = toText(value);
  return /^[\u0000-\u0020]*[=+\-@]/u.test(text) || /^[\t\r]/u.test(text)
    ? `'${text}`
    : text;
}

export function escapeLcfCsvCell(value: unknown): string {
  const protectedValue = protectLcfCsvFormula(value).replace(/\r\n|\r|\n/g, "\n");
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function formatJstParts(value: Date, includeSeconds: boolean): string {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`;
  return `${date} ${time}`;
}

export function formatLcfReservationCreatedAt(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return formatJstParts(new Date(timestamp), true);
}

function formatLcfExportTimestamp(value: Date): string {
  return formatJstParts(value, false).replace(/[-: ]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
}

function bookingTypeLabel(value: unknown): string {
  if (value === "same_day") return "当日枠";
  if (value === "advance") return "事前予約";
  return toText(value) || "-";
}

function guidelineConflictLabel(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "-";
  return value.map(toText).filter(Boolean).join(" / ") || "-";
}

export function buildLcfBoothReservationsCsv(
  rows: readonly LcfBoothReservationExportRow[],
  options: {
    filter: LcfBoothReservationExportFilter;
    sort: LcfBoothReservationExportSort;
    now?: Date;
  },
): { csv: string; fileName: string; rowCount: number } {
  const csvRows = rows.map((row) => [
    row.reservationId,
    formatLcfReservationCreatedAt(row.createdAtMs),
    row.date,
    row.timeSlot,
    row.boothId,
    bookingTypeLabel(row.bookingType),
    row.creatorName,
    row.email,
    row.statusLabel || row.status,
    guidelineConflictLabel(row.guidelineConflicts),
  ]);

  const csv = `\uFEFF${[CSV_HEADERS, ...csvRows]
    .map((row) => row.map(escapeLcfCsvCell).join(","))
    .join("\r\n")}\r\n`;
  const exportedAt = formatLcfExportTimestamp(options.now ?? new Date());
  const fileName = `LCF2026_ブース予約_${FILTER_LABELS[options.filter]}_${SORT_LABELS[options.sort]}_${exportedAt}.csv`;

  return { csv, fileName, rowCount: rows.length };
}
