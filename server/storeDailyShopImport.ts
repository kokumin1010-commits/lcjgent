import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import { TRPCError } from "@trpc/server";

export const STORE_DAILY_SHOP_FILE_MAX_BYTES = 30_000_000;
export const STORE_DAILY_SHOP_PARSE_VERSION = "store-daily-shop-v1";

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

export type ParsedDailyShopFile = {
  fileSha256: string;
  mimeType: string;
  rawRowCount: number;
  headers: string[];
  businessDates: string[];
  detectedBusinessDate: string | null;
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
  gmv: ["GMV", "商品GMV", "売上", "销售额", "Gross revenue"],
  orderCount: ["订单数", "注文数", "注文", "Orders"],
  customerCount: ["客户数", "カスタマー数", "顧客数", "Customers", "Buyers"],
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

export function normalizeDailyShopDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = cellText(value).replace(/[.]/g, "/");
  if (!text) return null;
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return null;
}

function metricValue(row: Record<string, unknown>, key: DailyShopMetricKey): number | null {
  for (const alias of METRIC_ALIASES[key]) {
    const exact = Object.keys(row).find(header => normalizeHeader(header).toLowerCase() === normalizeHeader(alias).toLowerCase());
    if (exact) return parseNumber(row[exact]);
  }
  return null;
}

function metricsFromRow(row: Record<string, unknown>): DailyShopMetrics {
  return Object.fromEntries(
    (Object.keys(METRIC_ALIASES) as DailyShopMetricKey[]).map(key => [key, metricValue(row, key)])
  ) as DailyShopMetrics;
}

function rowFromHeaders(headers: string[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(headers.map((header, index) => [header || `col_${index}`, row[index] ?? ""]));
}

function analysisDateFromRows(rows: unknown[][]): string | null {
  const joined = rows.slice(0, 6).flat().map(cellText).join(" ");
  const match = joined.match(/(?:分析日期|分析日|Analysis date)\s*[:：]?\s*(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/i);
  return match ? normalizeDailyShopDate(match[1]) : null;
}

export function parseDailyShopFile(input: { fileBuffer: Buffer; fileName: string }): ParsedDailyShopFile {
  const fileType = validateSignature(input.fileBuffer, input.fileName);
  const workbook = workbookFromBuffer(input.fileBuffer, fileType);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return badRequest("工作表为空 / シートがありません");
  const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!raw.length) return badRequest("没有可解析的数据 / 解析可能なデータがありません");
  if (raw.length > 5000) return badRequest("店铺每日文件最多5000行 / 日次ショップファイルは5000行までです");

  const dailyHeaderIndex = raw.findIndex(row => ["日期", "日付", "Date"].includes(cellText(row[0])));
  if (dailyHeaderIndex < 0) return badRequest("未找到每日数据日期行 / 日次データの日付行が見つかりません");
  const headers = raw[dailyHeaderIndex].map(normalizeHeader);
  const dateHeader = headers[0];
  const dailyRows = raw
    .slice(dailyHeaderIndex + 1)
    .map(row => rowFromHeaders(headers, row))
    .filter(row => Boolean(normalizeDailyShopDate(row[dateHeader])));
  if (!dailyRows.length) return badRequest("未找到有效每日数据 / 有効な日次データがありません");

  const dates = [...new Set(dailyRows.map(row => normalizeDailyShopDate(row[dateHeader])).filter((date): date is string => Boolean(date)))].sort();
  if (dates.length !== 1) return badRequest("每日上传仅支持一个业务日期 / 日次アップロードは1営業日のみ対応しています");
  const rawDailyRow = dailyRows[0];
  const detectedBusinessDate = dates[0] || analysisDateFromRows(raw);

  const totalIndex = raw.findIndex(row => /^(总计值|總計值|合計|総計|Total)$/i.test(cellText(row[0])));
  let rawSummaryRow: Record<string, unknown> = {};
  let comparison: Partial<Record<DailyShopMetricKey, number | null>> = {};
  if (totalIndex >= 0) {
    const metricHeaderIndex = Math.max(0, totalIndex - 1);
    const metricHeaders = raw[metricHeaderIndex].map(normalizeHeader);
    rawSummaryRow = rowFromHeaders(metricHeaders, raw[totalIndex]);
    const comparisonRow = raw.slice(totalIndex + 1, totalIndex + 3).find(row => /百分比|割合|変化率|Change/i.test(cellText(row[0])));
    if (comparisonRow) comparison = metricsFromRow(rowFromHeaders(metricHeaders, comparisonRow));
  }

  const metrics = metricsFromRow(rawDailyRow);
  const missingRequiredMetrics = REQUIRED_METRICS.filter(key => metrics[key] === null);
  const warnings: string[] = [];
  if (missingRequiredMetrics.length) warnings.push(`缺少必需指标: ${missingRequiredMetrics.join(", ")}`);
  for (const key of ["orderCount", "customerCount", "refundAmount"] as DailyShopMetricKey[]) {
    if (metrics[key] === null) warnings.push(`未识别可选指标: ${key}`);
  }
  if (metrics.gmv !== null && metrics.gmv < 0) warnings.push("GMV不能为负数");
  if (metrics.refundAmount !== null && metrics.refundAmount < 0) warnings.push("退款金额不能为负数");
  if (missingRequiredMetrics.length) return badRequest("未识别GMV，无法导入每日店铺数据 / GMVを認識できません");

  return {
    fileSha256: createHash("sha256").update(input.fileBuffer).digest("hex"),
    mimeType: fileType === "csv" ? "text/csv" : fileType === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.ms-excel",
    rawRowCount: raw.length,
    headers,
    businessDates: dates,
    detectedBusinessDate,
    metrics,
    comparison,
    rawDailyRow,
    rawSummaryRow,
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
    metrics: parsed.metrics,
    comparison: parsed.comparison,
    quality: parsed.quality,
  };
}
