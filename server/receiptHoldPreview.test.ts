import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyHeldReceiptForPreview } from "./receiptHoldPreview";

function held(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orderNumber: "581900058582287971",
    totalAmount: 10000,
    ocrRawText: JSON.stringify({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "581900058582287971",
      totalAmount: 10000,
    }),
    reviewNote: null,
    fraudFlags: [] as string[],
    isForceSubmitted: false,
    ...overrides,
  };
}

describe("held receipt preview classification", () => {
  it("classifies cross-account conflicts before other categories", () => {
    const item = classifyHeldReceiptForPreview(held({
      reviewNote: "Level2 cross-user duplicate",
      isForceSubmitted: true,
    }));
    expect(item.category).toBe("cross_account_conflict");
    expect(item.suggestedAction).toBe("manual_review");
  });

  it("classifies force appeals as manual review", () => {
    const item = classifyHeldReceiptForPreview(held({ isForceSubmitted: true }));
    expect(item.category).toBe("force_appeal");
    expect(item.suggestedAction).toBe("manual_review");
  });

  it("classifies exact image reuse as hard risk", () => {
    const item = classifyHeldReceiptForPreview(held({
      reviewNote: "硬风险｜同一画像を検出",
    }));
    expect(item.category).toBe("hard_risk");
  });

  it("classifies infrastructure parsing errors as technical failures", () => {
    const item = classifyHeldReceiptForPreview(held({
      reviewNote: "AI解析失敗。手動確認が必要です。",
    }));
    expect(item.category).toBe("technical_failure");
    expect(item.suggestedAction).toBe("reject_and_resubmit");
  });

  it("separates missing order number and missing amount", () => {
    const missingOrder = classifyHeldReceiptForPreview(held({
      orderNumber: null,
      ocrRawText: JSON.stringify({ isTikTokShop: true, isDelivered: true }),
    }));
    const missingAmount = classifyHeldReceiptForPreview(held({
      totalAmount: 0,
      ocrRawText: JSON.stringify({
        isTikTokShop: true,
        isDelivered: true,
        orderNumber: "581900058582287971",
      }),
    }));
    expect(missingOrder.category).toBe("missing_order_number");
    expect(missingAmount.category).toBe("missing_amount");
  });

  it("only calls complete evidence an approval candidate pending duplicate recheck", () => {
    const item = classifyHeldReceiptForPreview(held());
    expect(item.category).toBe("evidence_complete_recheck");
    expect(item.suggestedAction).toBe("approve_after_duplicate_recheck");
    expect(item.estimatedPoints).toBe(100);
  });
});

describe("hold preview read-only contract", () => {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const previewSource = readFileSync(`${here}/receiptHoldPreview.ts`, "utf8");
  const routerSource = readFileSync(`${here}/routers.ts`, "utf8");
  const pageSource = readFileSync(
    `${here}/../client/src/pages/LineReceiptManagement.tsx`,
    "utf8"
  );

  it("uses only a select query and declares no writes", () => {
    const serviceBody = previewSource.slice(
      previewSource.indexOf("export async function previewHeldReceiptRules")
    );
    expect(serviceBody).toContain(".select({");
    expect(serviceBody).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
    expect(serviceBody).not.toContain("awardPointsForLineReceipt");
    expect(serviceBody).not.toContain("pushMessage");
    expect(serviceBody).toContain("wroteData: false as const");
  });

  it("exposes preview as an admin query rather than a mutation", () => {
    const start = routerSource.indexOf("adminPreviewLineHoldRules:");
    const end = routerSource.indexOf("adminDetectDuplicateReceipts:", start);
    const contract = routerSource.slice(start, end);
    expect(contract).toContain("protectedProcedure.query");
    expect(contract).not.toContain(".mutation");
  });

  it("requires an explicit checkbox and matches displayed Pass 2 thresholds", () => {
    expect(pageSource).toContain("pass2ExecutionConfirmed");
    expect(pageSource).toContain("approveThreshold: 95");
    expect(pageSource).toContain("minUserApprovalRate: 80");
    expect(pageSource).toContain("!pass2ExecutionConfirmed");
  });
});
