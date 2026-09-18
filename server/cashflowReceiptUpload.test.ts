import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_CASHFLOW_RECEIPT_BYTES,
  validateCashflowReceiptUpload,
} from "./cashflowReceiptUpload";

const routerSource = readFileSync(
  new URL("./cashflowRouter.ts", import.meta.url),
  "utf8"
);
const storageSource = readFileSync(
  new URL("./cashflowReceiptStorage.ts", import.meta.url),
  "utf8"
);

function asBase64(bytes: Buffer | string): string {
  return Buffer.from(bytes).toString("base64");
}

function uploadReceiptBlock(): string {
  const start = routerSource.indexOf("uploadReceipt: financeProcedure");
  const end = routerSource.indexOf("// 請求書削除", start);
  return routerSource.slice(start, end);
}

describe("cashflow receipt upload validation", () => {
  it("accepts a real PDF and normalizes a path-like filename", () => {
    const result = validateCashflowReceiptUpload({
      fileData: asBase64("%PDF-1.4\n% synthetic test\n%%EOF\n"),
      fileName: "../../付款凭证.PDF",
      mimeType: "application/pdf",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.safeFileName).toMatch(/\.pdf$/);
    expect(result.safeFileName).not.toContain("/");
    expect(result.safeFileName).not.toContain("\\");
    expect(result.size).toBeGreaterThan(0);
    expect(result.sha256).toHaveLength(64);
    expect(
      validateCashflowReceiptUpload({
        fileData: asBase64("%PDF-1.7\n%%EOF\n"),
        fileName: "voucher.pdf",
        mimeType: "application/x-pdf",
      }).contentType
    ).toBe("application/pdf");
  });

  it("accepts PNG, JPEG and WebP signatures", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
    const webp = Buffer.alloc(20);
    webp.write("RIFF", 0, "ascii");
    webp.writeUInt32LE(12, 4);
    webp.write("WEBP", 8, "ascii");
    webp.write("VP8 ", 12, "ascii");
    expect(
      validateCashflowReceiptUpload({
        fileData: asBase64(png),
        fileName: "a.png",
        mimeType: "image/png",
      }).contentType
    ).toBe("image/png");
    expect(
      validateCashflowReceiptUpload({
        fileData: asBase64(jpg),
        fileName: "a.jpg",
        mimeType: "image/jpeg",
      }).contentType
    ).toBe("image/jpeg");
    expect(
      validateCashflowReceiptUpload({
        fileData: asBase64(webp),
        fileName: "a.webp",
        mimeType: "image/webp",
      }).contentType
    ).toBe("image/webp");
  });

  it("rejects spoofed, mismatched and oversized files", () => {
    expect(() =>
      validateCashflowReceiptUpload({
        fileData: asBase64("not a receipt"),
        fileName: "fake.pdf",
        mimeType: "application/pdf",
      })
    ).toThrow("仅支持有效的PDF、PNG、JPG或WebP凭证");

    expect(() =>
      validateCashflowReceiptUpload({
        fileData: asBase64("%PDF-1.4\n%%EOF\n"),
        fileName: "fake.png",
        mimeType: "image/png",
      })
    ).toThrow("MIME类型与文件内容不一致");

    expect(() =>
      validateCashflowReceiptUpload({
        fileData: Buffer.alloc(MAX_CASHFLOW_RECEIPT_BYTES + 1, 0x20).toString(
          "base64"
        ),
        fileName: "large.pdf",
        mimeType: "application/pdf",
      })
    ).toThrow("必须小于5MB");

    expect(() => validateCashflowReceiptUpload({
      fileData: asBase64("%PDF-1.4\ntruncated"),
      fileName: "broken.pdf",
      mimeType: "application/pdf",
    })).toThrow("凭证文件不完整或已损坏");
  });

  it("serializes appends, persists private object metadata and records a full audit trail", () => {
    const block = uploadReceiptBlock();
    expect(block).toContain("LIMIT 1 FOR UPDATE");
    expect(block).toContain("beginTransaction");
    expect(block).toContain("connection.commit()");
    expect(block).toContain("connection.rollback()");
    expect(block).toContain("stageCashflowReceiptObject");
    expect(block).toContain("activateCashflowReceiptObject");
    expect(block).toContain("recoverFailedCashflowReceiptUpload");
    expect(block).not.toContain("stored.url");
    expect(block).toContain("INSERT INTO cashflow_audit_log");
    expect(block).toContain('receiptAction: "upload"');
    expect(block).toContain("fileSha256: validated.sha256");
    expect(block).toContain("storageKey: fileKey");
    expect(block).toContain("cashflow_receipt_upload_failed");
    expect(block).toContain("let transactionRolledBack = false");
    expect(block).toContain("transactionRolledBack,");
    expect(block).toContain("CF_RECEIPT_UPLOAD_FAILED");
  });

  it("uses opaque receipt references, signed reads and durable cleanup states", () => {
    expect(storageSource).toContain('const RECEIPT_OBJECT_REF_PREFIX = "cashflow-receipt-object:"');
    expect(storageSource).toContain("storageGet(String(metadata.storageKey))");
    expect(storageSource).toContain("status = 'cleanup_pending'");
    expect(storageSource).toContain("status = 'cleanup_failed'");
    expect(storageSource).toContain("retryPendingCashflowReceiptCleanup");
    expect(storageSource).toContain("findReceiptReference(pool, receiptRef)");
  });
});
