import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import {
  inspectStoreProductHandcardPdf,
  STORE_PRODUCT_HANDCARD_PDF_MAX_BYTES,
} from "./storeProductHandcardPdf";

function createA4Pdf(): Buffer {
  const document = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  document.text("LCJ A4 HANDCARD TEST", 40, 50);
  return Buffer.from(document.output("arraybuffer"));
}

describe("store product handcard PDF validation", () => {
  it("accepts a real A4 PDF and returns deterministic metadata", async () => {
    const buffer = createA4Pdf();
    const result = await inspectStoreProductHandcardPdf({
      buffer,
      fileName: "手カード.pdf",
      declaredMimeType: "application/pdf",
    });
    expect(result.pageCount).toBe(1);
    expect(result.isA4).toBe(true);
    expect(result.fileName).toBe("手カード.pdf");
    expect(result.fileSize).toBe(buffer.length);
    expect(result.sha256).toBe(createHash("sha256").update(buffer).digest("hex"));
  });

  it("rejects renamed non-PDF files and oversized uploads", async () => {
    await expect(inspectStoreProductHandcardPdf({
      buffer: Buffer.from("not a pdf"),
      fileName: "fake.pdf",
      declaredMimeType: "application/pdf",
    })).rejects.toThrow(/有效PDF/);

    await expect(inspectStoreProductHandcardPdf({
      buffer: Buffer.alloc(STORE_PRODUCT_HANDCARD_PDF_MAX_BYTES + 1, 0),
      fileName: "large.pdf",
      declaredMimeType: "application/pdf",
    })).rejects.toThrow(/20MB/);
  });
});
