import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const STORE_AD_REPORT_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const STORE_AD_REPORT_PDF_MAX_PAGES = 100;

function cleanFileName(value: string): string {
  const original = String(value || "ad-report.pdf");
  const decoded = Buffer.from(original, "latin1").toString("utf8");
  const readable = decoded.includes("\uFFFD") ? original : decoded;
  const safe = readable.replace(/[\r\n\\/]/g, " ").trim().slice(0, 255) || "ad-report.pdf";
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export async function inspectStoreAdReportPdf(input: {
  buffer: Buffer;
  fileName: string;
  declaredMimeType?: string;
}) {
  const { buffer } = input;
  if (!buffer.length) throw new Error("广告报告PDF为空");
  if (buffer.length > STORE_AD_REPORT_PDF_MAX_BYTES) throw new Error("广告报告PDF请控制在20MB以内");
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("文件内容不是有效PDF");
  if (!buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1").includes("%%EOF")) {
    throw new Error("广告报告PDF文件不完整");
  }
  const declared = String(input.declaredMimeType || "").toLowerCase();
  if (declared && declared !== "application/pdf" && declared !== "application/octet-stream") {
    throw new Error("广告报告只能上传PDF文件");
  }

  const parser = require("pdf-parse") as (data: Buffer) => Promise<any>;
  let pageCount = 0;
  try {
    const parsed = await parser(buffer);
    pageCount = Number(parsed?.numpages || 0);
  } catch {
    const source = buffer.toString("latin1");
    pageCount = (source.match(/\/Type\s*\/Page\b/g) || []).length;
  }
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > STORE_AD_REPORT_PDF_MAX_PAGES) {
    throw new Error(`广告报告PDF页数无法确认或超过${STORE_AD_REPORT_PDF_MAX_PAGES}页`);
  }

  return {
    fileName: cleanFileName(input.fileName),
    fileSize: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    pageCount,
    mimeType: "application/pdf" as const,
  };
}
