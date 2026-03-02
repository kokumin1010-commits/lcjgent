import { describe, it, expect } from "vitest";
import { lineReceiptJa, lineReceiptZh } from "../client/src/pages/lineReceiptI18n";

describe("LINE Receipt Management i18n", () => {
  it("should have matching keys between Japanese and Chinese translations", () => {
    const jaKeys = Object.keys(lineReceiptJa).sort();
    const zhKeys = Object.keys(lineReceiptZh).sort();
    
    // Find keys in JA but not in ZH
    const missingInZh = jaKeys.filter(k => !zhKeys.includes(k));
    // Find keys in ZH but not in JA
    const missingInJa = zhKeys.filter(k => !jaKeys.includes(k));
    
    if (missingInZh.length > 0) {
      console.log("Keys in JA but missing in ZH:", missingInZh);
    }
    if (missingInJa.length > 0) {
      console.log("Keys in ZH but missing in JA:", missingInJa);
    }
    
    expect(missingInZh).toEqual([]);
    expect(missingInJa).toEqual([]);
  });

  it("should have non-empty values for all Japanese translations", () => {
    const emptyKeys = Object.entries(lineReceiptJa)
      .filter(([_, v]) => !v || v.trim() === "")
      .map(([k]) => k);
    
    expect(emptyKeys).toEqual([]);
  });

  it("should have non-empty values for all Chinese translations", () => {
    const emptyKeys = Object.entries(lineReceiptZh)
      .filter(([_, v]) => !v || v.trim() === "")
      .map(([k]) => k);
    
    expect(emptyKeys).toEqual([]);
  });

  it("should have all rejection category translations", () => {
    const categories = [
      "not_order_detail", "not_tiktok_shop", "not_delivered",
      "blurry_image", "missing_order_number", "missing_amount",
      "partial_screenshot", "duplicate", "wrong_store",
      "suspicious", "incomplete_info", "other"
    ];
    
    for (const cat of categories) {
      expect(lineReceiptJa[`lr.reject.${cat}`]).toBeTruthy();
      expect(lineReceiptJa[`lr.reject.${cat}.desc`]).toBeTruthy();
      expect(lineReceiptZh[`lr.reject.${cat}`]).toBeTruthy();
      expect(lineReceiptZh[`lr.reject.${cat}.desc`]).toBeTruthy();
    }
  });

  it("should have confidence label translations", () => {
    expect(lineReceiptJa["lr.highConfidence"]).toBeTruthy();
    expect(lineReceiptJa["lr.medConfidence"]).toBeTruthy();
    expect(lineReceiptJa["lr.lowConfidence"]).toBeTruthy();
    expect(lineReceiptZh["lr.highConfidence"]).toBeTruthy();
    expect(lineReceiptZh["lr.medConfidence"]).toBeTruthy();
    expect(lineReceiptZh["lr.lowConfidence"]).toBeTruthy();
  });

  it("should have core UI element translations in both languages", () => {
    const coreKeys = [
      "lr.title", "lr.subtitle",
      "lr.approved", "lr.rejected", "lr.approve", "lr.hold",
      "lr.reviewPanel", "lr.orderNumber", "lr.purchaseAmount",
      "lr.memo", "lr.approvedStatus", "lr.rejectedStatus", "lr.holdStatus",
    ];
    
    for (const key of coreKeys) {
      expect(lineReceiptJa[key], `Missing JA key: ${key}`).toBeTruthy();
      expect(lineReceiptZh[key], `Missing ZH key: ${key}`).toBeTruthy();
    }
  });

  it("should have toast message translations", () => {
    const toastKeys = [
      "lr.toast.approveComplete", "lr.toast.rejectComplete",
      "lr.toast.selectRejectionReason", "lr.toast.aiRecognizeComplete",
    ];
    
    for (const key of toastKeys) {
      expect(lineReceiptJa[key]).toBeTruthy();
      expect(lineReceiptZh[key]).toBeTruthy();
    }
  });

  it("should have AI review log translations", () => {
    const logKeys = [
      "lr.aiLog.title", "lr.aiLog.total", "lr.aiLog.aiApproved",
      "lr.aiLog.aiRejected", "lr.aiLog.aiHeld", "lr.aiLog.skipped",
    ];
    
    for (const key of logKeys) {
      expect(lineReceiptJa[key]).toBeTruthy();
      expect(lineReceiptZh[key]).toBeTruthy();
    }
  });
});
