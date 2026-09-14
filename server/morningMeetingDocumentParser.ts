import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export const MORNING_MEETING_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS = 60_000;
const MORNING_MEETING_DOCUMENT_MAX_ZIP_ENTRIES = 512;
const MORNING_MEETING_DOCUMENT_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MORNING_MEETING_DOCUMENT_MAX_DOCX_XML_BYTES = 8 * 1024 * 1024;

export type MorningMeetingDocumentKind = "docx" | "pdf" | "txt" | "md";

export type ParsedMorningMeetingDocument = {
  kind: MorningMeetingDocumentKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  extractedText: string;
  extractedChars: number;
  textTruncated: boolean;
};

const DOCUMENT_MIME_TYPES: Record<MorningMeetingDocumentKind, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  });
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeDocumentFileName(value: string): string {
  const decoded = Buffer.from(String(value || "document"), "latin1").toString("utf-8");
  return decoded
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255) || "document";
}

function detectKind(fileName: string): MorningMeetingDocumentKind | null {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  return extension === "docx" || extension === "pdf" || extension === "txt" || extension === "md"
    ? extension
    : null;
}

function validateDocxArchiveLimits(buffer: Buffer): void {
  const minimumEocdSize = 22;
  const eocdSearchStart = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.length - minimumEocdSize; offset >= eocdSearchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("MORNING_DOCUMENT_DOCX_INVALID");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("MORNING_DOCUMENT_DOCX_ZIP64_UNSUPPORTED");
  }
  if (totalEntries <= 0 || totalEntries > MORNING_MEETING_DOCUMENT_MAX_ZIP_ENTRIES) {
    throw new Error("MORNING_DOCUMENT_DOCX_TOO_COMPLEX");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length || centralDirectoryOffset >= eocdOffset) {
    throw new Error("MORNING_DOCUMENT_DOCX_INVALID");
  }

  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  let documentXmlFound = false;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("MORNING_DOCUMENT_DOCX_INVALID");
    }
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    if (uncompressedSize === 0xffffffff) throw new Error("MORNING_DOCUMENT_DOCX_ZIP64_UNSUPPORTED");
    const entryEnd = offset + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > buffer.length) throw new Error("MORNING_DOCUMENT_DOCX_INVALID");
    const entryName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replaceAll("\\", "/").toLowerCase();
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MORNING_MEETING_DOCUMENT_MAX_UNCOMPRESSED_BYTES) {
      throw new Error("MORNING_DOCUMENT_DOCX_TOO_LARGE_EXPANDED");
    }
    if (entryName === "word/document.xml" || entryName.endsWith("/word/document.xml")) {
      documentXmlFound = true;
      if (uncompressedSize > MORNING_MEETING_DOCUMENT_MAX_DOCX_XML_BYTES) {
        throw new Error("MORNING_DOCUMENT_DOCX_TEXT_TOO_LARGE");
      }
    }
    offset = entryEnd;
  }
  if (!documentXmlFound) throw new Error("MORNING_DOCUMENT_DOCX_INVALID");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  validateDocxArchiveLimits(buffer);
  const XLSX = await import("xlsx");
  const archive = XLSX.CFB.read(buffer, { type: "buffer" });
  const entryPath = archive.FullPaths.find((path: string) => path.toLowerCase().endsWith("/word/document.xml"));
  const entry = entryPath ? XLSX.CFB.find(archive, entryPath) : null;
  if (!entry?.content) throw new Error("MORNING_DOCUMENT_DOCX_INVALID");
  const xml = Buffer.from(entry.content).toString("utf8");
  const transformed = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return normalizeExtractedText(decodeXmlEntities(transformed));
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const parsed = await pdfParse(buffer);
  return normalizeExtractedText(String(parsed.text || ""));
}

function extractUtf8Text(buffer: Buffer): string {
  if (buffer.includes(0)) throw new Error("MORNING_DOCUMENT_TEXT_INVALID");
  const text = buffer.toString("utf8");
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount > Math.max(2, Math.floor(text.length * 0.005))) {
    throw new Error("MORNING_DOCUMENT_TEXT_INVALID");
  }
  return normalizeExtractedText(text);
}

export function morningMeetingDocumentExtension(kind: MorningMeetingDocumentKind): MorningMeetingDocumentKind {
  return kind;
}

export async function parseMorningMeetingDocumentFile(input: {
  filePath: string;
  originalName: string;
  declaredSize?: number;
}): Promise<ParsedMorningMeetingDocument> {
  const fileInfo = await stat(input.filePath);
  const fileSize = Number(fileInfo.size);
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) throw new Error("MORNING_DOCUMENT_EMPTY");
  if (fileSize > MORNING_MEETING_DOCUMENT_MAX_BYTES) throw new Error("MORNING_DOCUMENT_TOO_LARGE");
  if (input.declaredSize !== undefined && Number(input.declaredSize) !== fileSize) {
    throw new Error("MORNING_DOCUMENT_SIZE_MISMATCH");
  }

  const fileName = sanitizeDocumentFileName(input.originalName);
  const kind = detectKind(fileName);
  if (!kind) throw new Error("MORNING_DOCUMENT_UNSUPPORTED_FORMAT");

  const buffer = await readFile(input.filePath);
  const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && ((buffer[2] === 0x03 && buffer[3] === 0x04) || (buffer[2] === 0x05 && buffer[3] === 0x06));
  if (kind === "pdf" && !isPdf) throw new Error("MORNING_DOCUMENT_SIGNATURE_MISMATCH");
  if (kind === "docx" && !isZip) throw new Error("MORNING_DOCUMENT_SIGNATURE_MISMATCH");

  let fullText: string;
  try {
    fullText = kind === "docx"
      ? await extractDocxText(buffer)
      : kind === "pdf"
        ? await extractPdfText(buffer)
        : extractUtf8Text(buffer);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("MORNING_DOCUMENT_")) throw error;
    throw new Error(`MORNING_DOCUMENT_PARSE_FAILED:${kind}`);
  }
  if (!fullText) throw new Error("MORNING_DOCUMENT_NO_TEXT");

  const textTruncated = fullText.length > MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS;
  const extractedText = fullText.slice(0, MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS);
  return {
    kind,
    fileName,
    mimeType: DOCUMENT_MIME_TYPES[kind],
    fileSize,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    extractedText,
    extractedChars: fullText.length,
    textTruncated,
  };
}
