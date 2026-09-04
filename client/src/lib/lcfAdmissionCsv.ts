import { escapeLcfCsvCell } from "./lcfBoothReservationCsv";

export type LcfAdmissionCsvRow = {
  ticketId?: unknown;
  applicantName?: unknown;
  applicantType?: unknown;
  applicantEmail?: unknown;
  admissionCount?: unknown;
  firstCheckedInAt?: unknown;
  lastCheckedInAt?: unknown;
};

const HEADERS = [
  "チケットID",
  "名前",
  "区分",
  "メール",
  "受付人数",
  "初回受付",
  "最終受付",
] as const;

function typeLabel(value: unknown): string {
  if (value === "company") return "企業";
  if (value === "liver") return "ライバー";
  if (value === "general") return "一般";
  return String(value ?? "");
}

export function formatLcfAdmissionDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function exportTimestamp(value: Date): string {
  return formatLcfAdmissionDate(value).slice(0, 16).replace(/[-: ]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
}

export function buildLcfAdmissionCsv(
  rows: readonly LcfAdmissionCsvRow[],
  now = new Date(),
): { csv: string; fileName: string; rowCount: number; admissionTotal: number } {
  let admissionTotal = 0;
  const csvRows = rows.map((row) => {
    const admissionCount = Math.max(0, Number(row.admissionCount || 0));
    admissionTotal += admissionCount;
    return [
      row.ticketId,
      row.applicantName,
      typeLabel(row.applicantType),
      row.applicantEmail,
      admissionCount,
      formatLcfAdmissionDate(row.firstCheckedInAt),
      formatLcfAdmissionDate(row.lastCheckedInAt),
    ];
  });
  const csv = `\uFEFF${[HEADERS, ...csvRows]
    .map((row) => row.map(escapeLcfCsvCell).join(","))
    .join("\r\n")}\r\n`;
  return {
    csv,
    fileName: `LCF2026_入場受付_${exportTimestamp(now)}.csv`,
    rowCount: rows.length,
    admissionTotal,
  };
}
