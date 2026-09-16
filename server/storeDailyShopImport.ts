import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import { TRPCError } from "@trpc/server";

export const STORE_DAILY_SHOP_FILE_MAX_BYTES = 30_000_000;
export const STORE_DAILY_SHOP_PARSE_VERSION = "store-daily-shop-v2";

export type DailyShopMetricKey =
  | "gmv"
  | "orderCount"
  | "customerCount"
  | "soldQuantity"
  | "refundAmount"
  | "skuOrderCount"
  | "grossRevenue"
  | "pageViews"
  | "productVisitors"
  | "conversionRate"
  | "productImpressions"
  | "uniqueProductImpressions"
  | "productClicks"
  | "uniqueClicks"
  | "averageOrderValue"
  | "creatorLiveAttributedGmv"
  | "creatorLiveDirectGmv"
  | "creatorLiveIndirectGmv"
  | "boundAccountLiveAttributedGmv"
  | "merchantLiveGmv"
  | "merchantLiveIndirectGmv"
  | "affiliateVideoAttributedGmv"
  | "creatorVideoDirectGmv"
  | "creatorVideoIndirectGmv"
  | "boundAccountVideoAttributedGmv"
  | "merchantVideoGmv"
  | "merchantVideoIndirectGmv";

export type DailyShopMetrics = Record<DailyShopMetricKey, number | null>;
export type DailyShopDetectedLayout = "daily_rows" | "date_columns" | "single_day_summary";

export type ParsedDailyShopFile = {
  fileSha256: string;
  mimeType: string;
  rawRowCount: number;
  headers: string[];
  businessDates: string[];
  detectedBusinessDate: string;
  sourceSheetIndex: number;
  detectedLayout: DailyShopDetectedLayout;
  metrics: DailyShopMetrics;
  comparison: Partial<Record<DailyShopMetricKey, number | null>>;
  rawDailyRow: Record<string, unknown>;
  rawSummaryRow: Record<string, unknown>;
  quality: {
    acceptedCount: number;
    rejectedCount: number;
    warningCount: number;
    missingRequiredMetrics: string[];
    warnings: string[];
  };
};

const METRIC_ALIASES: Record<DailyShopMetricKey, string[]> = {
  gmv: ["GMV", "商品GMV", "売上", "销售额", "Gross revenue", "直播归因 GMV", "直播归因GMV", "ライブ帰属 GMV", "LIVE帰属 GMV"],
  orderCount: ["订单数", "注文数", "注文", "Orders", "归因 SKU 订单数", "帰属 SKU 注文数"],
  customerCount: ["客户数", "カスタマー数", "顧客数", "Customers", "Buyers", "客户数（搜索）", "顧客数（検索）"],
  soldQuantity: ["商品成交件数", "販売数量", "成交件数", "Items sold"],
  refundAmount: ["退款金额", "退款金額", "返金金額", "返金", "Refund amount", "Refund"],
  skuOrderCount: ["SKU 订单数", "SKU订单数", "SKU 注文数", "SKU orders"],
  grossRevenue: ["总成交额", "総取引額", "総売上", "Gross merchandise value"],
  pageViews: ["页面浏览次数", "ページビュー", "Page views"],
  productVisitors: ["商品访客数", "商品訪問者数", "Product visitors"],
  conversionRate: ["转化率", "転換率", "Conversion rate"],
  productImpressions: ["商品曝光次数", "商品表示回数", "Product impressions"],
  uniqueProductImpressions: ["去重商品曝光次数", "ユニーク商品表示回数", "Unique product impressions"],
  productClicks: ["商品点击量", "商品クリック数", "Product clicks"],
  uniqueClicks: ["去重点击次数", "ユニーククリック数", "Unique clicks"],
  averageOrderValue: ["平均订单金额", "平均注文金額", "Average order value"],
  creatorLiveAttributedGmv: ["达人直播归因 GMV", "达人直播归因GMV", "クリエイターLIVE帰属 GMV"],
  creatorLiveDirectGmv: ["达人直播 GMV", "达人直播GMV", "クリエイターLIVE GMV"],
  creatorLiveIndirectGmv: ["达人直播间接 GMV", "达人直播间接GMV", "クリエイターLIVE間接 GMV"],
  boundAccountLiveAttributedGmv: ["绑定账号直播归因 GMV", "绑定账号直播归因GMV", "紐付けアカウントLIVE帰属 GMV"],
  merchantLiveGmv: ["商家直播 GMV", "商家直播GMV", "ショップLIVE GMV"],
  merchantLiveIndirectGmv: ["商家直播间接 GMV", "商家直播间接GMV", "ショップLIVE間接 GMV"],
  affiliateVideoAttributedGmv: ["联盟视频归因 GMV", "联盟视频归因GMV", "アフィリエイト動画帰属 GMV"],
  creatorVideoDirectGmv: ["达人视频 GMV", "达人视频GMV", "クリエイター動画 GMV"],
  creatorVideoIndirectGmv: ["达人视频间接 GMV", "达人视频间接GMV", "クリエイター動画間接 GMV"],
  boundAccountVideoAttributedGmv: ["绑定账号视频归因 GMV", "绑定账号视频归因GMV", "紐付けアカウント動画帰属 GMV"],
  merchantVideoGmv: ["商家视频 GMV", "商家视频GMV", "ショップ動画 GMV"],
  merchantVideoIndirectGmv: ["商家视频间接 GMV", "商家视频间接GMV", "ショップ動画間接 GMV"],
};

const REQUIRED_METRICS: DailyShopMetricKey[] = ["gmv"];
const DATE_HEADER_ALIASES = new Set(["日期", "日付", "date", "day", "年月日", "日時", "时间", "時間", "期间", "期間"]);
const TOTAL_LABEL = /^(总计值|總計值|合计|合計|総計|total|grand total)$/i;

type SheetRows = { sheetIndex: number; rows: unknown[][] };
type ParseCandidate = {
  sheetIndex: number;
  layout: DailyShopDetectedLayout;
  rawRowCount: number;
  headers: string[];
  businessDates: string[];
  detectedBusinessDate: string;
  metrics: DailyShopMetrics;
  comparison: Partial<Record<DailyShopMetricKey, number | null>>;
  rawDailyRow: Record<string, unknown>;
  rawSummaryRow: Record<string, unknown>;
  warnings: string[];
  score: number;
};

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function decodeDailyShopFileBase64(fileBase64: string): Buffer {
  const normalized = fileBase64.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return badRequest("文件内容无效 / ファイル内容が不正です");
  }
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > STORE_DAILY_SHOP_FILE_MAX_BYTES) {
    return badRequest("文件必须小于30MB / ファイルは30MB以下にしてください");
  }
  return buffer;
}

function validateSignature(buffer: Buffer, fileName: string): "csv" | "xlsx" | "xls" {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
    return badRequest("仅支持CSV、XLSX、XLS / CSV、XLSX、XLSのみ対応しています");
  }
  if (extension === "xlsx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return badRequest("XLSX文件签名不正确 / XLSX実体が不正です");
  }
  if (extension === "xls" && !(buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0)) {
    return badRequest("XLS文件签名不正确 / XLS実体が不正です");
  }
  return extension as "csv" | "xlsx" | "xls";
}

function workbookFromBuffer(buffer: Buffer, fileType: "csv" | "xlsx" | "xls") {
  if (fileType !== "csv") return XLSX.read(buffer, { type: "buffer", cellDates: true });
  const detected = chardet.detect(buffer) || "UTF-8";
  const encoding = /shift|sjis|windows-31j/i.test(detected)
    ? "shift_jis"
    : /utf-16/i.test(detected)
      ? "utf16-le"
      : "utf8";
  return XLSX.read(iconv.decode(buffer, encoding), { type: "string", cellDates: true });
}

function cellText(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

function normalizeHeader(value: unknown): string {
  return cellText(value).replace(/\s+/g, " ");
}

function metricToken(value: unknown): string {
  return normalizeHeader(value)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s_\-/:：・]/g, "")
    .replace(/[¥￥円]/g, "");
}

function metricKeyFromHeader(value: unknown): DailyShopMetricKey | null {
  const token = metricToken(value);
  if (!token) return null;
  for (const [key, aliases] of Object.entries(METRIC_ALIASES) as [DailyShopMetricKey, string[]][]) {
    if (aliases.some(alias => metricToken(alias) === token)) return key;
  }
  return null;
}

function isDateHeader(value: unknown): boolean {
  return DATE_HEADER_ALIASES.has(normalizeHeader(value).toLowerCase());
}

function validIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeDailyShopDate(value: unknown, preferredDate?: string): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return validIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 100000) {
    const decoded = XLSX.SSF.parse_date_code(value);
    const isoDate = decoded ? validIsoDate(decoded.y, decoded.m, decoded.d) : null;
    return preferredDate && isoDate === preferredDate ? isoDate : null;
  }
  const text = cellText(value).replace(/[.]/g, "/");
  if (!text) return null;

  let match = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const dayFirst = validIsoDate(year, second, first);
    const monthFirst = validIsoDate(year, first, second);
    if (preferredDate && dayFirst === preferredDate) return dayFirst;
    if (preferredDate && monthFirst === preferredDate) return monthFirst;
    if (first > 12) return dayFirst;
    if (second > 12) return monthFirst;
    return dayFirst || monthFirst;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cellText(value);
  if (!text || text === "—") return null;
  const percent = text.endsWith("%");
  const parsed = Number(text.replace(/[¥￥円,%\s,]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return percent ? parsed / 100 : parsed;
}

function metricValue(row: Record<string, unknown>, key: DailyShopMetricKey): number | null {
  for (const [header, value] of Object.entries(row)) {
    if (metricKeyFromHeader(header) === key) return parseNumber(value);
  }
  return null;
}

function metricsFromRow(row: Record<string, unknown>): DailyShopMetrics {
  return Object.fromEntries(
    (Object.keys(METRIC_ALIASES) as DailyShopMetricKey[]).map(key => [key, metricValue(row, key)])
  ) as DailyShopMetrics;
}

export function dailyShopMetricsFromRow(row: Record<string, unknown>): DailyShopMetrics {
  return metricsFromRow(row);
}

function recognizedMetricCount(metrics: DailyShopMetrics): number {
  return Object.values(metrics).filter(value => value !== null).length;
}

function uniqueHeaders(row: unknown[]): string[] {
  const counts = new Map<string, number>();
  return row.map((value, index) => {
    const base = normalizeHeader(value) || `col_${index}`;
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen + 1}`;
  });
}

function rowFromHeaders(headers: string[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(headers.map((header, index) => [header || `col_${index}`, row[index] ?? ""]));
}

function extractDatesFromText(value: unknown, preferredDate?: string): string[] {
  const text = cellText(value);
  const matches = text.match(/\d{4}年\d{1,2}月\d{1,2}日?|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\b\d{8}\b/g) || [];
  return matches.map(match => normalizeDailyShopDate(match, preferredDate)).filter((date): date is string => Boolean(date));
}

function analysisDatesFromRows(rows: unknown[][], preferredDate?: string): string[] {
  const dates: string[] = [];
  for (const row of rows.slice(0, 20)) {
    const rowText = row.map(cellText).join(" ");
    if (!/(?:分析日期|分析日|analysis date|date range|期間|期间|対象日)/i.test(rowText)) continue;
    dates.push(...extractDatesFromText(rowText, preferredDate));
  }
  return [...new Set(dates)].sort();
}

function comparisonFromRows(rows: unknown[][], fallbackHeaders: string[]): Partial<Record<DailyShopMetricKey, number | null>> {
  const comparisonRow = rows.find(row => row.some(value => /百分比|割合|変化率|change/i.test(cellText(value))));
  if (!comparisonRow) return {};
  return metricsFromRow(rowFromHeaders(fallbackHeaders, comparisonRow));
}

function tableCandidates(sheet: SheetRows, preferredDate?: string): ParseCandidate[] {
  const candidates: ParseCandidate[] = [];
  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    const headerRow = sheet.rows[rowIndex];
    const dateColumns = headerRow.map((value, index) => isDateHeader(value) ? index : -1).filter(index => index >= 0);
    for (const dateColumn of dateColumns) {
      const headers = uniqueHeaders(headerRow);
      const allRows = sheet.rows.slice(rowIndex + 1)
        .map(row => ({ row, date: normalizeDailyShopDate(row[dateColumn], preferredDate) }))
        .filter((entry): entry is { row: unknown[]; date: string } => Boolean(entry.date));
      if (!allRows.length) continue;
      const businessDates = [...new Set(allRows.map(entry => entry.date))].sort();
      const selectedRows = preferredDate ? allRows.filter(entry => entry.date === preferredDate) : allRows;
      if (!selectedRows.length) continue;
      const rawDailyRow = rowFromHeaders(headers, selectedRows[0].row);
      const metrics = metricsFromRow(rawDailyRow);
      const totalRow = sheet.rows.find(row => row.some(value => TOTAL_LABEL.test(cellText(value))));
      const totalIndex = totalRow ? sheet.rows.indexOf(totalRow) : -1;
      const summaryHeaders = totalIndex > 0 ? uniqueHeaders(sheet.rows[totalIndex - 1]) : headers;
      const rawSummaryRow = totalRow ? rowFromHeaders(summaryHeaders, totalRow) : {};
      const warnings: string[] = [];
      if (businessDates.length > 1 && preferredDate) warnings.push(`文件含${businessDates.length}个日期，已按所选业务日期提取1行`);
      candidates.push({
        sheetIndex: sheet.sheetIndex,
        layout: "daily_rows",
        rawRowCount: sheet.rows.length,
        headers,
        businessDates,
        detectedBusinessDate: selectedRows[0].date,
        metrics,
        comparison: comparisonFromRows(sheet.rows, summaryHeaders),
        rawDailyRow,
        rawSummaryRow,
        warnings,
        score: 300 + recognizedMetricCount(metrics) * 10 + (metrics.gmv !== null ? 100 : 0),
      });
    }
  }
  return candidates;
}

function transposedCandidates(sheet: SheetRows, preferredDate?: string): ParseCandidate[] {
  const candidates: ParseCandidate[] = [];
  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    const dateCells = sheet.rows[rowIndex]
      .map((value, index) => ({ index, date: normalizeDailyShopDate(value, preferredDate) }))
      .filter((entry): entry is { index: number; date: string } => Boolean(entry.date));
    if (!dateCells.length) continue;
    const businessDates = [...new Set(dateCells.map(entry => entry.date))].sort();
    for (const dateCell of dateCells) {
      if (preferredDate && dateCell.date !== preferredDate) continue;
      const rawDailyRow: Record<string, unknown> = { 日期: dateCell.date };
      for (const row of sheet.rows) {
        const labelIndex = row.findIndex(value => Boolean(metricKeyFromHeader(value)));
        if (labelIndex < 0 || labelIndex === dateCell.index) continue;
        const label = normalizeHeader(row[labelIndex]);
        rawDailyRow[label] = row[dateCell.index] ?? "";
      }
      const metrics = metricsFromRow(rawDailyRow);
      if (recognizedMetricCount(metrics) === 0) continue;
      const warnings: string[] = ["检测到横向日期报表，已转换为单日指标"];
      if (businessDates.length > 1 && preferredDate) warnings.push(`文件含${businessDates.length}个日期，已按所选业务日期提取1列`);
      candidates.push({
        sheetIndex: sheet.sheetIndex,
        layout: "date_columns",
        rawRowCount: sheet.rows.length,
        headers: Object.keys(rawDailyRow),
        businessDates,
        detectedBusinessDate: dateCell.date,
        metrics,
        comparison: {},
        rawDailyRow,
        rawSummaryRow: rawDailyRow,
        warnings,
        score: 200 + recognizedMetricCount(metrics) * 10 + (metrics.gmv !== null ? 100 : 0),
      });
    }
  }
  return candidates;
}

function singleDaySummaryCandidates(sheet: SheetRows, preferredDate?: string): ParseCandidate[] {
  const analysisDates = analysisDatesFromRows(sheet.rows, preferredDate);
  if (analysisDates.length > 1) return [];
  const detectedBusinessDate = analysisDates[0] || preferredDate;
  if (!detectedBusinessDate) return [];

  const totalRowIndex = sheet.rows.findIndex(row => row.some(value => TOTAL_LABEL.test(cellText(value))));
  let headers: string[] = [];
  let rawSummaryRow: Record<string, unknown> = {};
  if (totalRowIndex >= 1) {
    headers = uniqueHeaders(sheet.rows[totalRowIndex - 1]);
    rawSummaryRow = rowFromHeaders(headers, sheet.rows[totalRowIndex]);
  } else {
    for (let rowIndex = 0; rowIndex < sheet.rows.length - 1; rowIndex += 1) {
      const candidateHeaders = uniqueHeaders(sheet.rows[rowIndex]);
      const headerMetricCount = candidateHeaders.filter(header => Boolean(metricKeyFromHeader(header))).length;
      if (headerMetricCount < 2) continue;
      const candidateRow = rowFromHeaders(candidateHeaders, sheet.rows[rowIndex + 1]);
      if (metricsFromRow(candidateRow).gmv === null) continue;
      headers = candidateHeaders;
      rawSummaryRow = candidateRow;
      break;
    }
  }
  const metrics = metricsFromRow(rawSummaryRow);
  if (metrics.gmv === null) return [];
  const warnings = ["未找到每日明细表，已使用单日指标汇总"];
  if (!analysisDates.length) warnings.push("报表内未识别日期，已使用所选业务日期");
  return [{
    sheetIndex: sheet.sheetIndex,
    layout: "single_day_summary",
    rawRowCount: sheet.rows.length,
    headers,
    businessDates: [detectedBusinessDate],
    detectedBusinessDate,
    metrics,
    comparison: comparisonFromRows(sheet.rows, headers),
    rawDailyRow: { 日期: detectedBusinessDate, ...rawSummaryRow },
    rawSummaryRow,
    warnings,
    score: 100 + recognizedMetricCount(metrics) * 10 + (metrics.gmv !== null ? 100 : 0),
  }];
}

export function parseDailyShopFile(input: { fileBuffer: Buffer; fileName: string; businessDate?: string }): ParsedDailyShopFile {
  const fileType = validateSignature(input.fileBuffer, input.fileName);
  const workbook = workbookFromBuffer(input.fileBuffer, fileType);
  const sheets: SheetRows[] = [];
  let oversizedSheetCount = 0;
  for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex += 1) {
    const sheetName = workbook.SheetNames[sheetIndex];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: true });
    if (!rows.length) continue;
    if (rows.length > 5000) {
      oversizedSheetCount += 1;
      continue;
    }
    sheets.push({ sheetIndex, rows });
  }
  if (!sheets.length) {
    if (oversizedSheetCount) return badRequest("店铺每日文件的工作表最多5000行 / 日次ショップシートは5000行までです");
    return badRequest("工作表为空 / シートがありません");
  }

  const allCandidates = sheets.flatMap(sheet => [
    ...tableCandidates(sheet, input.businessDate),
    ...transposedCandidates(sheet, input.businessDate),
    ...singleDaySummaryCandidates(sheet, input.businessDate),
  ]);
  const gmvCandidates = allCandidates.filter(candidate => candidate.metrics.gmv !== null);
  const candidates = (gmvCandidates.length ? gmvCandidates : allCandidates)
    .sort((left, right) => right.score - left.score || left.sheetIndex - right.sheetIndex);

  if (!candidates.length) {
    return badRequest(`未找到可导入的每日数据。已检查${sheets.length}个工作表；支持日期/日付/Date不在首列、非首个工作表及横向日期格式 / 日次データを認識できませんでした`);
  }

  const candidate = candidates[0];
  if (!input.businessDate && candidate.businessDates.length !== 1) {
    return badRequest("文件包含多个业务日期，请先选择业务日期后重新预览 / 複数日を含むため営業日を選択してください");
  }
  if (input.businessDate && candidate.detectedBusinessDate !== input.businessDate) {
    return badRequest(`所选日期 ${input.businessDate} 在文件中不存在 / 選択した営業日がファイル内にありません`);
  }

  const missingRequiredMetrics = REQUIRED_METRICS.filter(key => candidate.metrics[key] === null);
  const warnings = [...candidate.warnings];
  for (const key of ["orderCount", "customerCount", "refundAmount"] as DailyShopMetricKey[]) {
    if (candidate.metrics[key] === null) warnings.push(`未识别可选指标: ${key}`);
  }
  if (candidate.metrics.gmv !== null && candidate.metrics.gmv < 0) warnings.push("GMV不能为负数");
  if (candidate.metrics.refundAmount !== null && candidate.metrics.refundAmount < 0) warnings.push("退款金额不能为负数");
  if (missingRequiredMetrics.length) return badRequest("未识别GMV，无法导入每日店铺数据 / GMVを認識できません");

  return {
    fileSha256: createHash("sha256").update(input.fileBuffer).digest("hex"),
    mimeType: fileType === "csv" ? "text/csv" : fileType === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.ms-excel",
    rawRowCount: candidate.rawRowCount,
    headers: candidate.headers,
    businessDates: candidate.businessDates,
    detectedBusinessDate: candidate.detectedBusinessDate,
    sourceSheetIndex: candidate.sheetIndex,
    detectedLayout: candidate.layout,
    metrics: candidate.metrics,
    comparison: candidate.comparison,
    rawDailyRow: candidate.rawDailyRow,
    rawSummaryRow: candidate.rawSummaryRow,
    quality: {
      acceptedCount: 1,
      rejectedCount: 0,
      warningCount: warnings.length,
      missingRequiredMetrics,
      warnings,
    },
  };
}

export function safeDailyShopPreview(parsed: ParsedDailyShopFile) {
  return {
    fileSha256: parsed.fileSha256,
    mimeType: parsed.mimeType,
    rawRowCount: parsed.rawRowCount,
    headers: parsed.headers,
    detectedBusinessDate: parsed.detectedBusinessDate,
    businessDates: parsed.businessDates,
    sourceSheetIndex: parsed.sourceSheetIndex,
    detectedLayout: parsed.detectedLayout,
    metrics: parsed.metrics,
    comparison: parsed.comparison,
    quality: parsed.quality,
  };
}
