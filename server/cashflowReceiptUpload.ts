import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";

export const MAX_CASHFLOW_RECEIPT_BYTES = 5 * 1024 * 1024;

const RECEIPT_TYPES = {
  pdf: { extension: ".pdf", mimeType: "application/pdf" },
  png: { extension: ".png", mimeType: "image/png" },
  jpg: { extension: ".jpg", mimeType: "image/jpeg" },
  webp: { extension: ".webp", mimeType: "image/webp" },
} as const;

type ReceiptKind = keyof typeof RECEIPT_TYPES;

function decodeStrictBase64(value: string): Buffer {
  const compact = String(value || "").replace(/\s+/g, "");
  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_BASE64_INVALID] 凭证文件格式无效",
    });
  }
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_EMPTY] 凭证文件为空",
    });
  }
  if (buffer.length > MAX_CASHFLOW_RECEIPT_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_TOO_LARGE] 凭证文件必须小于5MB",
    });
  }
  return buffer;
}

function detectReceiptKind(buffer: Buffer): ReceiptKind | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-")
    return "pdf";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return "png";
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "jpg";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

function hasValidReceiptStructure(buffer: Buffer, kind: ReceiptKind): boolean {
  if (kind === "pdf") {
    return buffer.length >= 12 && buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from("%%EOF"));
  }
  if (kind === "png") {
    const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    return buffer.length >= 20 && buffer.subarray(Math.max(0, buffer.length - 32)).includes(iend);
  }
  if (kind === "jpg") {
    return buffer.length >= 4 && buffer.subarray(Math.max(0, buffer.length - 16)).includes(Buffer.from([0xff, 0xd9]));
  }
  return buffer.length >= 20
    && buffer.readUInt32LE(4) + 8 === buffer.length
    && ["VP8 ", "VP8L", "VP8X"].includes(buffer.subarray(12, 16).toString("ascii"));
}

function safeBaseName(fileName: string): string {
  const normalized = String(fileName || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return normalized || "voucher";
}

export function validateCashflowReceiptUpload(input: {
  fileData: string;
  fileName: string;
  mimeType?: string | null;
}) {
  const buffer = decodeStrictBase64(input.fileData);
  const kind = detectReceiptKind(buffer);
  if (!kind) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_INVALID_TYPE] 仅支持有效的PDF、PNG、JPG或WebP凭证",
    });
  }
  if (!hasValidReceiptStructure(buffer, kind)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_CORRUPT] 凭证文件不完整或已损坏，请重新导出后上传",
    });
  }

  const expected = RECEIPT_TYPES[kind];
  const declaredMime = String(input.mimeType || "")
    .trim()
    .toLowerCase();
  const acceptedMime =
    kind === "pdf"
      ? ["application/pdf", "application/x-pdf"]
      : kind === "jpg"
        ? ["image/jpeg", "image/jpg", "image/pjpeg"]
        : [expected.mimeType];
  if (
    declaredMime &&
    declaredMime !== "application/octet-stream" &&
    !acceptedMime.includes(declaredMime)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "[CF_RECEIPT_MIME_MISMATCH] 凭证MIME类型与文件内容不一致",
    });
  }

  const originalName = safeBaseName(input.fileName);
  const baseWithoutExtension =
    originalName.replace(/\.[A-Za-z0-9]+$/, "") || "voucher";
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return {
    buffer,
    contentType: expected.mimeType,
    safeFileName: `${baseWithoutExtension}${expected.extension}`,
    sha256,
    size: buffer.length,
  };
}
