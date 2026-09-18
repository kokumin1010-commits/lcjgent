import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mocks = vi.hoisted(() => ({
  createLineFraudDetectionLog: vi.fn(),
  getLineReceiptById: vi.fn(),
  updateLineReceiptAiRejection: vi.fn(),
  updateLineReceiptFraudFlags: vi.fn(),
  updateLineReceiptOcr: vi.fn(),
  updateLineReceiptStatus: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { rejectDuplicateReceiptImage } from "./receiptDuplicateImage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("duplicate receipt image rejection", () => {
  it("rejects the later active copy and inherits the canonical DB order number", async () => {
    mocks.getLineReceiptById.mockResolvedValue({
      id: 100,
      lineUserId: "U1",
      status: "approved",
      orderNumber: "5000000000000000001",
      ocrRawText: JSON.stringify({ orderNumber: "5000000000000000002" }),
      storeName: "Yhg jewelry",
      purchaseDate: new Date("2026-07-10T00:00:00.000Z"),
      totalAmount: 7018,
      currency: "JPY",
    });

    const result = await rejectDuplicateReceiptImage({
      receiptId: 101,
      lineUserId: "U1",
      matchedReceiptId: 100,
      detection: "exact_sha256",
      imageUrls: ["https://example.test/copy.png"],
      imageKeys: ["copy.png"],
    });

    expect(result).toEqual(expect.objectContaining({
      rejected: true,
      sameAccount: true,
      orderNumber: "5000000000000000001",
    }));
    expect(mocks.updateLineReceiptOcr).toHaveBeenCalledWith(101, expect.objectContaining({
      orderNumber: "5000000000000000001",
      totalAmount: 7018,
      pointsCalculated: 0,
    }));
    expect(mocks.updateLineReceiptFraudFlags).toHaveBeenCalledWith(
      101,
      ["duplicate_image", "duplicate_order"],
      100
    );
    expect(mocks.createLineFraudDetectionLog).toHaveBeenCalledWith(expect.objectContaining({
      receiptId: 101,
      checkType: "duplicate_image",
      relatedReceiptId: 100,
      severity: "high",
    }));
    expect(mocks.updateLineReceiptStatus).toHaveBeenCalledWith(
      101,
      "rejected",
      0,
      expect.stringContaining("自動却下: 重複画像")
    );
  });

  it("does not reject against a later or already rejected record", async () => {
    mocks.getLineReceiptById.mockResolvedValue({
      id: 102,
      lineUserId: "U1",
      status: "rejected",
    });

    const result = await rejectDuplicateReceiptImage({
      receiptId: 101,
      lineUserId: "U1",
      matchedReceiptId: 102,
      detection: "perceptual_hash",
      perceptualDistance: 0,
      imageUrls: [],
      imageKeys: [],
    });

    expect(result.rejected).toBe(false);
    expect(mocks.updateLineReceiptStatus).not.toHaveBeenCalled();
    expect(mocks.updateLineReceiptOcr).not.toHaveBeenCalled();
  });
});

describe("duplicate image integration contract", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const router = readFileSync(`${here}/routers.ts`, "utf8");
  const db = readFileSync(`${here}/db.ts`, "utf8");
  const upload = readFileSync(`${here}/../client/src/pages/ReceiptUpload.tsx`, "utf8");
  const admin = readFileSync(`${here}/../client/src/pages/LineReceiptManagement.tsx`, "utf8");

  it("checks exact SHA256 before background OCR and returns duplicate immediately", () => {
    const createIndex = router.indexOf("const receiptId = await createLineReceipt");
    const exactIndex = router.indexOf("checkDuplicateLineReceiptByHash(image.hash, receiptId)", createIndex);
    const backgroundIndex = router.indexOf("(async () => {", createIndex);
    expect(exactIndex).toBeGreaterThan(createIndex);
    expect(backgroundIndex).toBeGreaterThan(exactIndex);
    expect(router.slice(exactIndex, backgroundIndex)).toContain('status: "duplicate" as const');
  });

  it("uses only an earlier active SHA256 match as the canonical record", () => {
    const start = db.indexOf("export async function checkDuplicateLineReceiptByHash");
    const end = db.indexOf("export async function checkDuplicateLineReceiptByDetails", start);
    const source = db.slice(start, end);
    expect(source).toContain("lt(lineReceipts.id, excludeId)");
    expect(source).toContain('Array<"pending" | "approved" | "on_hold">');
    expect(source).toContain('"pending",\n    "approved",\n    "on_hold"');
    expect(source).toContain("orderBy(asc(lineReceipts.id))");
  });

  it("rejects strict pHash copies before OCR and no longer sends exact copies to on-hold", () => {
    expect(router).toContain("findSimilarImages(");
    expect(router).toContain("receiptId,\n                    1,");
    expect(router).toContain('detection: "perceptual_hash"');
    expect(router).not.toContain("hard-risk hold - same image");
  });

  it("shows a direct rejection without opening Kakuhen and uses the canonical admin order number", () => {
    expect(upload).toContain('result.status === "duplicate"');
    expect(upload).toContain("重複申請のため自動却下しました");
    expect(upload).toContain('analysisResult.status !== "duplicate" && analysisResult.receiptId');
    expect(admin).toContain("normalizeDisplayOrderNumber(receipt?.orderNumber)");
    expect(admin).toContain("data.ocrOrderNumberCandidate || data.orderNumber");
    expect(admin).toContain("OCR候选号:");
  });

  it("stores a blocked one-edit OCR variant under the earlier canonical order number", () => {
    expect(router).toContain("const canonicalOrderNumber = claimResult.decision.blockingClaim?.orderNumber");
    expect(router).toContain("ocrOrderNumberCandidate: detectedOrderNumber !== canonicalOrderNumber");
    expect(router).toContain('canonicalOrderNumberSource: "blocking_active_receipt"');
    expect(router).toContain('["duplicate_order", "similar_order_number", "ocr_order_number_variant"]');
  });
});
