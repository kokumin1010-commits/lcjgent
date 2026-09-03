import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  extractReceiptEvidenceWithRetry,
  hasRequiredReceiptEvidence,
  mergeReceiptEvidence,
  type ReceiptEvidence,
} from "./receiptEvidenceExtraction";

function evidence(overrides: Partial<ReceiptEvidence> = {}): ReceiptEvidence {
  return {
    isTikTokShop: true,
    isDelivered: true,
    orderNumber: "581900058582287971",
    allOrderNumbers: ["581900058582287971"],
    totalAmount: 10000,
    orderDate: "2026-09-01",
    shopName: "TikTok Shop",
    productName: "商品",
    orderNumberSource: "注文番号ラベル",
    items: [],
    deliveryInfo: null,
    paymentInfo: null,
    confidence: 96,
    ...overrides,
  };
}

function response(value: ReceiptEvidence) {
  return {
    choices: [{ message: { content: JSON.stringify(value) } }],
  } as any;
}

describe("receipt evidence extraction", () => {
  it("retries once after a technical failure and then returns complete evidence", async () => {
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockResolvedValueOnce(response(evidence()));

    const result = await extractReceiptEvidenceWithRetry(
      ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      invoke as any
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.technicalErrors).toEqual(["temporary timeout"]);
    expect(result.hasRequiredEvidence).toBe(true);
    const secondRequest = invoke.mock.calls[1][0];
    const imageItems = secondRequest.messages[1].content.filter(
      (item: any) => item.type === "image_url"
    );
    expect(imageItems).toHaveLength(2);
  });

  it("retries missing key evidence and accepts the corrected second result", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(response(evidence({ orderNumber: null, allOrderNumbers: [] })))
      .mockResolvedValueOnce(response(evidence()));

    const result = await extractReceiptEvidenceWithRetry(
      ["https://example.com/receipt.jpg"],
      invoke as any
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.evidence.orderNumber).toBe("581900058582287971");
    expect(result.hasRequiredEvidence).toBe(true);
  });

  it("does not retry a clear non-TikTok decision", async () => {
    const invoke = vi.fn().mockResolvedValueOnce(
      response(evidence({
        isTikTokShop: false,
        isDelivered: null,
        orderNumber: null,
        allOrderNumbers: [],
        totalAmount: null,
        confidence: 99,
      }))
    );

    const result = await extractReceiptEvidenceWithRetry(
      ["https://example.com/not-tiktok.jpg"],
      invoke as any
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.hasRequiredEvidence).toBe(false);
  });

  it("preserves valid first-pass fields when retry returns null for them", () => {
    const merged = mergeReceiptEvidence(
      evidence({ totalAmount: null }),
      evidence({
        orderNumber: null,
        allOrderNumbers: [],
        totalAmount: 12000,
        shopName: null,
      })
    );
    expect(merged.orderNumber).toBe("581900058582287971");
    expect(merged.totalAmount).toBe(12000);
    expect(merged.shopName).toBe("TikTok Shop");
    expect(hasRequiredReceiptEvidence(merged)).toBe(true);
  });
});

describe("receipt evidence workflow contracts", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const routerSource = readFileSync(`${here}/routers.ts`, "utf8");
  const approvalSource = readFileSync(`${here}/receiptApprovalService.ts`, "utf8");

  it("rejects unresolved technical and missing-field cases instead of holding them", () => {
    expect(routerSource).toContain("自動却下: 技術解析を2回試行");
    expect(routerSource).toContain("自動却下: 技術再試行後も合計金額");
    expect(routerSource).toContain("自動却下: 技術再試行後も注文番号");
    expect(routerSource).not.toContain("proceeding with approval");
  });

  it("prevents evidence-free force appeals from becoming permanent holds", () => {
    const forceStart = routerSource.indexOf("forceSubmitWebReceipt:");
    const forceEnd = routerSource.indexOf("// 紹介コードシステム", forceStart);
    const forceSource = routerSource.slice(forceStart, forceEnd);
    expect(forceSource).toContain("receipt.status !== \"rejected\"");
    expect(forceSource).toContain("却下理由を修正した新しい画像");
    expect(forceSource).not.toContain("\"on_hold\"");
  });

  it("rechecks the order claim before approval and uses idempotent point award", () => {
    const claimIndex = approvalSource.indexOf("claimReceiptOrderNumber({");
    const statusIndex = approvalSource.indexOf("updateLineReceiptStatus(");
    expect(claimIndex).toBeGreaterThan(0);
    expect(statusIndex).toBeGreaterThan(claimIndex);
    expect(approvalSource).toContain("awardPointsForLineReceipt(receipt.id, pointsToAward)");
  });
});
