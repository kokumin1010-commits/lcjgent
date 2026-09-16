import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const STORE_PRODUCT_HANDCARD_PDF_MAX_BYTES = 20 * 1024 * 1024;

function cleanFileName(value: string): string {
  const original = String(value || "handcard.pdf");
  const decoded = Buffer.from(original, "latin1").toString("utf8");
  const readable = decoded.includes("\uFFFD") ? original : decoded;
  const safe = readable.replace(/[\r\n\\/]/g, " ").trim().slice(0, 255) || "handcard.pdf";
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

function detectA4(buffer: Buffer): boolean | null {
  const source = buffer.toString("latin1", 0, Math.min(buffer.length, 2 * 1024 * 1024));
  const match = source.match(/\/MediaBox\s*\[\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const portrait = Math.abs(width - 595.276) <= 6 && Math.abs(height - 841.89) <= 6;
  const landscape = Math.abs(width - 841.89) <= 6 && Math.abs(height - 595.276) <= 6;
  return portrait || landscape;
}

export async function inspectStoreProductHandcardPdf(input: {
  buffer: Buffer;
  fileName: string;
  declaredMimeType?: string;
}) {
  const { buffer } = input;
  if (!buffer.length) throw new Error("PDF文件为空");
  if (buffer.length > STORE_PRODUCT_HANDCARD_PDF_MAX_BYTES) throw new Error("PDF请控制在20MB以内");
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("文件内容不是有效PDF");
  if (!buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1").includes("%%EOF")) throw new Error("PDF文件不完整");
  const declared = String(input.declaredMimeType || "").toLowerCase();
  if (declared && declared !== "application/pdf" && declared !== "application/octet-stream") {
    throw new Error("只能上传PDF文件");
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
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) {
    throw new Error("PDF页数无法确认或超过20页");
  }

  return {
    fileName: cleanFileName(input.fileName),
    fileSize: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    pageCount,
    isA4: detectA4(buffer),
    mimeType: "application/pdf" as const,
  };
}
