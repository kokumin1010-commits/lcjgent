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
    imageUrl: "https://example.invalid/receipt.webp",
    imageUrls: null,
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

  it("re-runs force appeals through current evidence rules instead of permanently holding them", () => {
    const item = classifyHeldReceiptForPreview(held({ isForceSubmitted: true }));
    expect(item.category).toBe("force_appeal");
    expect(item.suggestedAction).toBe("approve_after_duplicate_recheck");
  });

  it("classifies exact image reuse as hard risk", () => {
    const item = classifyHeldReceiptForPreview(held({
      reviewNote: "硬风险｜同一画像を検出",
    }));
    expect(item.category).toBe("hard_risk");
  });

  it("classifies missing images through the same current rules", () => {
    const item = classifyHeldReceiptForPreview(held({ imageUrl: null, imageUrls: [] }));
    expect(item.category).toBe("technical_failure");
    expect(item.suggestedAction).toBe("reject_and_resubmit");
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
    expect(serviceBody).toContain("ruleset: PASS2_RULESET");
    expect(previewSource).toContain("evaluatePass2CurrentRules({");
  });

  it("exposes preview as an admin query rather than a mutation", () => {
    const start = routerSource.indexOf("adminPreviewLineHoldRules:");
    const end = routerSource.indexOf("adminDetectDuplicateReceipts:", start);
    const contract = routerSource.slice(start, end);
    expect(contract).toContain("protectedProcedure");
    expect(contract).toContain(".query(");
    expect(contract).not.toContain(".mutation");
  });

  it("requires checkbox confirmation and a signed bounded preview without a typed phrase", () => {
    expect(pageSource).toContain("pass2ExecutionConfirmed");
    expect(pageSource).toContain("!pass2ExecutionConfirmed");
    expect(pageSource).toContain("执行前最终确认");
    expect(pageSource).not.toContain("pass2ConfirmationPhrase");
    expect(pageSource).not.toContain("EXECUTE_PASS2_V2_BATCH");
    expect(previewSource).toContain("normalizePass2CandidateUpdatedAtMs(row.updatedAt)");
    expect(previewSource).not.toContain("row.updatedAt.getTime()");
    expect(routerSource).toContain("confirmationToken");
    expect(routerSource).toContain("normalizePass2CandidateUpdatedAtMs(current.updatedAt)");
    expect(routerSource).not.toContain("confirmationPhrase");
    expect(routerSource).not.toContain("EXECUTE_PASS2_V2_BATCH");
    expect(routerSource).not.toContain("limit: input?.limit ?? 0");
  });
});
