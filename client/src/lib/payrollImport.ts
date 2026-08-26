import * as XLSX from "xlsx";

export type PayrollEntity = "japan" | "china";

export type PayrollImportRecord = {
  employeeName: string;
  payrollMonth: string;
  netPay: number;
  currency: "JPY" | "CNY";
  role?: string;
  payor?: string;
  note?: string;
  sourceRow: number;
};

export type PayrollWorkbookResult = {
  entity: PayrollEntity;
  currency: "JPY" | "CNY";
  fileName: string;
  sheetName: string;
  records: PayrollImportRecord[];
  sourceTotal: number;
  warnings: string[];
};

type CandidateSheet = PayrollWorkbookResult & {
  targetMonthCount: number;
};

const EMPLOYEE_HEADERS = ["姓名", "名前"];
const STREAMER_HEADERS = ["配信者名"];
const MONTH_HEADERS = ["工资月份", "费用月份"];
const NET_PAY_HEADERS = ["实发工资", "振込金額"];
const ROLE_HEADERS = ["岗位", "職務"];
const PAYOR_HEADERS = ["工资发放主体"];
const NOTE_HEADERS = ["备注", "備考"];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function parsePayrollAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value).replace(/[¥￥,\s]/g, "");
  if (!raw || raw.startsWith("#")) return null;
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const parsed = Number(negative ? raw.slice(1, -1) : raw);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function findIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

function normalizeMonth(value: unknown, fallbackYear: number): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const raw = text(value);
  const full = raw.match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])(?:\D|$)/);
  if (full) return `${full[1]}-${String(Number(full[2])).padStart(2, "0")}`;
  const monthOnly = raw.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*月/);
  if (monthOnly) return `${fallbackYear}-${String(Number(monthOnly[1])).padStart(2, "0")}`;
  return null;
}

function inferYear(rows: unknown[][]): number {
  for (const row of rows.slice(0, 30)) {
    for (const value of row) {
      const raw = text(value);
      const fullYear = raw.match(/(20\d{2})/);
      if (fullYear) return Number(fullYear[1]);
      const shortYear = raw.match(/(?:^|\D)\d{1,2}[-/]\d{1,2}[-/](2\d)(?:\D|$)/);
      if (shortYear) return 2000 + Number(shortYear[1]);
    }
  }
  return new Date().getFullYear();
}

function monthFromFile(fileName: string, year: number): string | null {
  const match = fileName.match(/(1[0-2]|0?[1-9])月/);
  return match ? `${year}-${String(Number(match[1])).padStart(2, "0")}` : null;
}

function findHeaderRow(rows: unknown[][]): { rowIndex: number; headers: string[] } | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const headers = rows[rowIndex].map(text);
    const hasEmployee = findIndex(headers, EMPLOYEE_HEADERS) >= 0;
    const hasNetPay = findIndex(headers, NET_PAY_HEADERS) >= 0;
    if (hasEmployee && hasNetPay) return { rowIndex, headers };
  }
  return null;
}

export function parsePayrollRows(
  rows: unknown[][],
  options: { entity: PayrollEntity; fileName: string; sheetName: string },
): CandidateSheet | null {
  const header = findHeaderRow(rows);
  if (!header) return null;

  const employeeIndex = findIndex(header.headers, EMPLOYEE_HEADERS);
  const streamerIndex = findIndex(header.headers, STREAMER_HEADERS);
  const monthIndex = findIndex(header.headers, MONTH_HEADERS);
  const netPayIndex = findIndex(header.headers, NET_PAY_HEADERS);
  const roleIndex = findIndex(header.headers, ROLE_HEADERS);
  const payorIndex = findIndex(header.headers, PAYOR_HEADERS);
  const noteIndex = findIndex(header.headers, NOTE_HEADERS);
  const fallbackYear = inferYear(rows);
  const targetMonth = monthFromFile(options.fileName, fallbackYear);
  const currency = options.entity === "japan" ? "JPY" : "CNY";
  const records: PayrollImportRecord[] = [];
  const warnings: string[] = [];

  rows.slice(header.rowIndex + 1).forEach((row, offset) => {
    const rowNumber = header.rowIndex + offset + 2;
    const employeeName = text(row[employeeIndex]) || (streamerIndex >= 0 ? text(row[streamerIndex]) : "");
    if (!employeeName || ["合计", "总计", "総計"].includes(employeeName)) return;

    const amount = parsePayrollAmount(row[netPayIndex]);
    if (amount === null || amount <= 0) {
      warnings.push(`${options.sheetName} ${rowNumber}行目: ${employeeName}の実支給額を確認してください`);
      return;
    }

    const note = noteIndex >= 0 ? text(row[noteIndex]) : "";
    const monthHint = row.map(text).find((value) => /(?:1[0-2]|0?[1-9])月份?.*(?:工资|給与)/.test(value)) || note;
    const noteMonth = normalizeMonth(monthHint, fallbackYear);
    const payrollMonth = noteMonth || (monthIndex >= 0 ? normalizeMonth(row[monthIndex], fallbackYear) : null) || targetMonth;
    if (!payrollMonth) {
      warnings.push(`${options.sheetName} ${rowNumber}行目: ${employeeName}の給与月を判定できません`);
      return;
    }

    records.push({
      employeeName,
      payrollMonth,
      netPay: Math.round(amount * 100) / 100,
      currency,
      role: roleIndex >= 0 ? text(row[roleIndex]) || undefined : undefined,
      payor: payorIndex >= 0 ? text(row[payorIndex]) || undefined : undefined,
      note: note || undefined,
      sourceRow: rowNumber,
    });
  });

  const grouped = new Map<string, PayrollImportRecord>();
  records.forEach((record) => {
    const key = `${record.payrollMonth}|${record.employeeName.normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase()}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...record });
      return;
    }
    existing.netPay = Math.round((existing.netPay + record.netPay) * 100) / 100;
    existing.note = [existing.note, record.note].filter(Boolean).join(" / ") || undefined;
    warnings.push(`同一給与月・従業員の複数行を合算: ${record.payrollMonth} ${record.employeeName}`);
  });
  const normalizedRecords = [...grouped.values()];

  return {
    entity: options.entity,
    currency,
    fileName: options.fileName,
    sheetName: options.sheetName,
    records: normalizedRecords,
    sourceTotal: Math.round(normalizedRecords.reduce((sum, record) => sum + record.netPay, 0) * 100) / 100,
    warnings,
    targetMonthCount: normalizedRecords.filter((record) => record.payrollMonth === targetMonth).length,
  };
}

export function parsePayrollWorkbook(buffer: ArrayBuffer, fileName: string, entity: PayrollEntity): PayrollWorkbookResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const candidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    return parsePayrollRows(rows, { entity, fileName, sheetName });
  }).filter((candidate): candidate is CandidateSheet => Boolean(candidate && candidate.records.length > 0));

  if (candidates.length === 0) {
    throw new Error("給与表を認識できません。姓名/名前と実発給与/振込金額の列を確認してください。");
  }

  candidates.sort((a, b) => {
    if (b.targetMonthCount !== a.targetMonthCount) return b.targetMonthCount - a.targetMonthCount;
    if (b.records.length !== a.records.length) return b.records.length - a.records.length;
    return b.sourceTotal - a.sourceTotal;
  });
  const { targetMonthCount: _targetMonthCount, ...result } = candidates[0];
  return result;
}
