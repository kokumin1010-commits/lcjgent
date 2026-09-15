import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { parseMorningMeetingDocumentFile } from "./morningMeetingDocumentParser";

export const HR_ROLE_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const HR_ROLE_DOCUMENT_MAX_EXTRACTED_CHARS = 100_000;
const HR_ROLE_DOCUMENT_MAX_WORKSHEETS = 32;
const HR_ROLE_DOCUMENT_MAX_ROWS_PER_SHEET = 10_000;
const HR_ROLE_DOCUMENT_MAX_COLUMNS_PER_SHEET = 200;
const HR_ROLE_DOCUMENT_MAX_CELLS = 100_000;

export type HrRoleDocumentKind = "doc" | "docx" | "pdf" | "txt" | "md" | "xlsx";

export type ParsedHrRoleDocument = {
  kind: HrRoleDocumentKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  extractedText: string;
  extractedChars: number;
  textTruncated: boolean;
  extractionStatus: "extracted" | "stored_only";
};

const MIME_TYPES: Record<HrRoleDocumentKind, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function sanitizeHrRoleFileName(value: string): string {
  const original = String(value || "document");
  const latin1Decoded = Buffer.from(original, "latin1").toString("utf-8");
  const decoded = latin1Decoded.includes("\uFFFD") ? original : latin1Decoded;
  return decoded.replace(/[\\/\u0000-\u001f\u007f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 255) || "document";
}

function detectKind(fileName: string): HrRoleDocumentKind | null {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  return extension === "doc" || extension === "docx" || extension === "pdf" || extension === "txt" || extension === "md" || extension === "xlsx"
    ? extension
    : null;
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && ((buffer[2] === 0x03 && buffer[3] === 0x04) || (buffer[2] === 0x05 && buffer[3] === 0x06));
}

function isLegacyOleDocument(buffer: Buffer): boolean {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  if (!isZip(buffer)) throw new Error("HR_ROLE_DOCUMENT_SIGNATURE_MISMATCH");
  const xlsxModule = await import("xlsx");
  const XLSX = (xlsxModule.default || xlsxModule) as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: true });
  if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error("HR_ROLE_DOCUMENT_XLSX_EMPTY");
  }
  if (workbook.SheetNames.length > HR_ROLE_DOCUMENT_MAX_WORKSHEETS) {
    throw new Error("HR_ROLE_DOCUMENT_XLSX_TOO_COMPLEX");
  }

  let totalCells = 0;
  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    if (rows.length > HR_ROLE_DOCUMENT_MAX_ROWS_PER_SHEET) throw new Error("HR_ROLE_DOCUMENT_XLSX_TOO_COMPLEX");
    const normalizedRows: string[] = [];
    for (const rowValue of rows) {
      const row = Array.isArray(rowValue) ? rowValue : [];
      if (row.length > HR_ROLE_DOCUMENT_MAX_COLUMNS_PER_SHEET) throw new Error("HR_ROLE_DOCUMENT_XLSX_TOO_COMPLEX");
      totalCells += row.length;
      if (totalCells > HR_ROLE_DOCUMENT_MAX_CELLS) throw new Error("HR_ROLE_DOCUMENT_XLSX_TOO_COMPLEX");
      const cells = row.map(cell => String(cell ?? "").replace(/\r?\n/g, " ").trim());
      if (cells.some(Boolean)) normalizedRows.push(cells.join("\t"));
    }
    if (normalizedRows.length > 0) sections.push(`[Sheet: ${String(sheetName).slice(0, 120)}]\n${normalizedRows.join("\n")}`);
  }
  const text = sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("HR_ROLE_DOCUMENT_NO_TEXT");
  return text;
}

export async function parseHrRoleDocumentFile(input: {
  filePath: string;
  originalName: string;
  declaredSize?: number;
}): Promise<ParsedHrRoleDocument> {
  const fileInfo = await stat(input.filePath);
  const fileSize = Number(fileInfo.size);
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) throw new Error("HR_ROLE_DOCUMENT_EMPTY");
  if (fileSize > HR_ROLE_DOCUMENT_MAX_BYTES) throw new Error("HR_ROLE_DOCUMENT_TOO_LARGE");
  if (input.declaredSize !== undefined && Number(input.declaredSize) !== fileSize) throw new Error("HR_ROLE_DOCUMENT_SIZE_MISMATCH");

  const fileName = sanitizeHrRoleFileName(input.originalName);
  const kind = detectKind(fileName);
  if (!kind) throw new Error("HR_ROLE_DOCUMENT_UNSUPPORTED_FORMAT");

  if (kind === "docx" || kind === "pdf" || kind === "txt" || kind === "md") {
    const parsed = await parseMorningMeetingDocumentFile({ filePath: input.filePath, originalName: fileName, declaredSize: fileSize });
    return { ...parsed, kind, extractionStatus: "extracted" };
  }

  const buffer = await readFile(input.filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (kind === "doc") {
    if (!isLegacyOleDocument(buffer)) throw new Error("HR_ROLE_DOCUMENT_SIGNATURE_MISMATCH");
    return {
      kind,
      fileName,
      mimeType: MIME_TYPES.doc,
      fileSize,
      sha256,
      extractedText: "",
      extractedChars: 0,
      textTruncated: false,
      extractionStatus: "stored_only",
    };
  }

  const fullText = await extractXlsxText(buffer);
  return {
    kind,
    fileName,
    mimeType: MIME_TYPES.xlsx,
    fileSize,
    sha256,
    extractedText: fullText.slice(0, HR_ROLE_DOCUMENT_MAX_EXTRACTED_CHARS),
    extractedChars: fullText.length,
    textTruncated: fullText.length > HR_ROLE_DOCUMENT_MAX_EXTRACTED_CHARS,
    extractionStatus: "extracted",
  };
}
