import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import { TRPCError } from "@trpc/server";
import {
  normalizeGrowthRows,
  type NormalizedGrowthRow,
  type StoreCommandDataType,
} from "./storeCommandCenterPolicy";

export const STORE_COMMAND_FILE_MAX_BYTES = 30_000_000;
export const STORE_COMMAND_MAX_ROWS = 50_000;
export const STORE_COMMAND_PARSE_VERSION = "store-command-v1";

export type ParsedCommandFile = {
  fileSha256: string;
  mimeType: string;
  rawRowCount: number;
  rows: NormalizedGrowthRow[];
  rejected: Array<{ row: number; reasons: string[] }>;
  headers: string[];
  periodStart: string | null;
  periodEnd: string | null;
  quality: {
    acceptedCount: number;
    rejectedCount: number;
    warningCount: number;
    duplicateBusinessKeyCount: number;
    missingSkuCount: number;
    missingDateCount: number;
  };
};

function safeBase64(value: string): Buffer {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "文件内容无效 / ファイル内容が不正です",
    });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > STORE_COMMAND_FILE_MAX_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "文件必须小于30MB / ファイルは30MB以下にしてください",
    });
  }
  return buffer;
}

function validateSignature(
  buffer: Buffer,
  fileName: string
): "csv" | "xlsx" | "xls" {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "仅支持CSV、XLSX、XLS / CSV、XLSX、XLSのみ対応しています",
    });
  }
  if (extension === "xlsx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "XLSX文件签名不正确 / XLSX実体が不正です",
    });
  }
  if (
    extension === "xls" &&
    !(
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "XLS文件签名不正确 / XLS実体が不正です",
    });
  }
  return extension as "csv" | "xlsx" | "xls";
}

function workbookFromBuffer(buffer: Buffer, fileType: "csv" | "xlsx" | "xls") {
  if (fileType !== "csv")
    return XLSX.read(buffer, { type: "buffer", cellDates: true });
  const detected = chardet.detect(buffer) || "UTF-8";
  const encoding = /shift|sjis|windows-31j/i.test(detected)
    ? "shift_jis"
    : /utf-16/i.test(detected)
      ? "utf16-le"
      : "utf8";
  const text = iconv.decode(buffer, encoding);
  return XLSX.read(text, { type: "string", cellDates: true });
}

function period(rows: NormalizedGrowthRow[]): {
  periodStart: string | null;
  periodEnd: string | null;
} {
  const dates = rows
    .map(row => row.businessDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    periodStart: dates[0] || null,
    periodEnd: dates[dates.length - 1] || null,
  };
}

export function decodeCommandFileBase64(fileBase64: string): Buffer {
  return safeBase64(fileBase64);
}

export function parseStoreCommandFile(input: {
  fileBuffer: Buffer;
  fileName: string;
  dataType: StoreCommandDataType;
}): ParsedCommandFile {
  const fileType = validateSignature(input.fileBuffer, input.fileName);
  const workbook = workbookFromBuffer(input.fileBuffer, fileType);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "工作表为空 / シートがありません",
    });
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (!rawRows.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "没有可解析的数据 / 解析可能なデータがありません",
    });
  if (rawRows.length > STORE_COMMAND_MAX_ROWS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `单文件最多${STORE_COMMAND_MAX_ROWS.toLocaleString()}行 / 1ファイル${STORE_COMMAND_MAX_ROWS.toLocaleString()}行まで`,
    });
  }
  const headers = [...new Set(rawRows.flatMap(row => Object.keys(row)))].slice(
    0,
    300
  );
  const normalized = normalizeGrowthRows(input.dataType, rawRows);
  const seen = new Set<string>();
  const deduplicated: NormalizedGrowthRow[] = [];
  let duplicateBusinessKeyCount = 0;
  for (const row of normalized.rows) {
    if (seen.has(row.businessKey)) {
      duplicateBusinessKeyCount += 1;
      continue;
    }
    seen.add(row.businessKey);
    deduplicated.push(row);
  }
  const rowPeriod = period(deduplicated);
  return {
    fileSha256: createHash("sha256").update(input.fileBuffer).digest("hex"),
    mimeType:
      fileType === "csv"
        ? "text/csv"
        : fileType === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/vnd.ms-excel",
    rawRowCount: rawRows.length,
    rows: deduplicated,
    rejected: normalized.rejected,
    headers,
    periodStart: rowPeriod.periodStart,
    periodEnd: rowPeriod.periodEnd,
    quality: {
      acceptedCount: deduplicated.length,
      rejectedCount: normalized.rejected.length,
      warningCount: deduplicated.reduce(
        (sum, row) => sum + row.warnings.length,
        0
      ),
      duplicateBusinessKeyCount,
      missingSkuCount: deduplicated.filter(row => !row.skuId && !row.skuName)
        .length,
      missingDateCount: deduplicated.filter(row => !row.businessDate).length,
    },
  };
}

export function safeImportPreview(parsed: ParsedCommandFile) {
  return {
    fileSha256: parsed.fileSha256,
    rawRowCount: parsed.rawRowCount,
    acceptedCount: parsed.quality.acceptedCount,
    rejectedCount: parsed.quality.rejectedCount,
    duplicateBusinessKeyCount: parsed.quality.duplicateBusinessKeyCount,
    warningCount: parsed.quality.warningCount,
    missingSkuCount: parsed.quality.missingSkuCount,
    missingDateCount: parsed.quality.missingDateCount,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    headers: parsed.headers,
    rejected: parsed.rejected.slice(0, 20),
    sample: parsed.rows.slice(0, 5).map(row => ({
      businessDate: row.businessDate,
      productName: row.productName,
      skuName: row.skuName,
      orderId: row.orderId,
      gmv: row.gmv,
      refundQuantity: row.refundQuantity,
      refundAmount: row.refundAmount,
      warnings: row.warnings,
    })),
  };
}
