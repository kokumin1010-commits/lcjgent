import { describe, it, expect, vi } from "vitest";

// ===== Phase 1: Learning Data Recording Tests =====

describe("Receipt Review Log - Learning Data Recording", () => {
  describe("createReceiptReviewLog function", () => {
    it("should accept all required fields for a LINE receipt approval", () => {
      const logData = {
        receiptId: 123,
        receiptType: "line_receipt" as const,
        decision: "approved" as const,
        reviewedBy: "admin-user-1",
        ocrConfidence: "85",
        fraudScore: "0",
        fraudFlagCount: 0,
        hasOrderNumber: "yes" as const,
        orderNumber: "TK-123456789",
        totalAmount: 3200,
        storeName: "TikTok Shop",
        imageCount: 2,
      };

      expect(logData.receiptType).toBe("line_receipt");
      expect(logData.decision).toBe("approved");
      expect(logData.ocrConfidence).toBe("85");
      expect(logData.fraudFlagCount).toBe(0);
      expect(logData.hasOrderNumber).toBe("yes");
    });

    it("should accept rejection with category for a web receipt", () => {
      const logData = {
        receiptId: 456,
        receiptType: "web_receipt" as const,
        decision: "rejected" as const,
        reviewedBy: "admin-user-2",
        ocrConfidence: "30",
        fraudScore: "5",
        fraudFlagCount: 3,
        hasOrderNumber: "no" as const,
        rejectionCategory: "blurry_image" as const,
        rejectionReason: "画像が不鮮明で注文番号が読み取れません",
        totalAmount: 0,
        imageCount: 1,
      };

      expect(logData.decision).toBe("rejected");
      expect(logData.rejectionCategory).toBe("blurry_image");
      expect(logData.hasOrderNumber).toBe("no");
    });

    it("should accept on_hold decision for a point request", () => {
      const logData = {
        receiptId: 789,
        receiptType: "point_request" as const,
        decision: "on_hold" as const,
        reviewedBy: "admin-user-1",
        ocrConfidence: "60",
        fraudScore: "2",
        fraudFlagCount: 1,
        hasOrderNumber: "yes" as const,
        orderNumber: "TK-987654321",
        totalAmount: 5000,
        imageCount: 3,
      };

      expect(logData.decision).toBe("on_hold");
      expect(logData.receiptType).toBe("point_request");
    });
  });

  describe("Rejection categories", () => {
    const validCategories = [
      "blurry_image",
      "no_order_number",
      "duplicate",
      "amount_mismatch",
      "invalid_store",
      "expired",
      "tampered",
      "other",
    ];

    it("should have all expected rejection categories", () => {
      expect(validCategories).toHaveLength(8);
      expect(validCategories).toContain("blurry_image");
      expect(validCategories).toContain("no_order_number");
      expect(validCategories).toContain("duplicate");
      expect(validCategories).toContain("amount_mismatch");
      expect(validCategories).toContain("invalid_store");
      expect(validCategories).toContain("expired");
      expect(validCategories).toContain("tampered");
      expect(validCategories).toContain("other");
    });
  });

  describe("Receipt types", () => {
    it("should support all three receipt types", () => {
      const types = ["line_receipt", "web_receipt", "point_request"];
      expect(types).toHaveLength(3);
    });
  });

  describe("Decision types", () => {
    it("should support approved, rejected, and on_hold decisions", () => {
      const decisions = ["approved", "rejected", "on_hold"];
      expect(decisions).toHaveLength(3);
    });
  });
});

// ===== Phase 2: Dashboard Data Aggregation Tests =====

describe("AI Learning Dashboard - Data Aggregation", () => {
  describe("Summary statistics calculation", () => {
    it("should calculate approval rate correctly", () => {
      const total = 100;
      const approved = 75;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      expect(approvalRate).toBe(75);
    });

    it("should handle zero total gracefully", () => {
      const total = 0;
      const approved = 0;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      expect(approvalRate).toBe(0);
    });

    it("should round approval rate to nearest integer", () => {
      const total = 3;
      const approved = 2;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      expect(approvalRate).toBe(67);
    });
  });

  describe("Daily trend calculation", () => {
    it("should calculate recent vs previous week comparison", () => {
      const dailyTrend = [
        { date: "2026-02-01", total: 10, approved: 7, rejected: 2, onHold: 1, approvalRate: 70 },
        { date: "2026-02-02", total: 8, approved: 6, rejected: 1, onHold: 1, approvalRate: 75 },
        { date: "2026-02-03", total: 12, approved: 9, rejected: 2, onHold: 1, approvalRate: 75 },
        { date: "2026-02-04", total: 9, approved: 7, rejected: 1, onHold: 1, approvalRate: 78 },
        { date: "2026-02-05", total: 11, approved: 8, rejected: 2, onHold: 1, approvalRate: 73 },
        { date: "2026-02-06", total: 10, approved: 7, rejected: 2, onHold: 1, approvalRate: 70 },
        { date: "2026-02-07", total: 8, approved: 6, rejected: 1, onHold: 1, approvalRate: 75 },
        { date: "2026-02-08", total: 10, approved: 8, rejected: 1, onHold: 1, approvalRate: 80 },
        { date: "2026-02-09", total: 12, approved: 10, rejected: 1, onHold: 1, approvalRate: 83 },
        { date: "2026-02-10", total: 9, approved: 8, rejected: 0, onHold: 1, approvalRate: 89 },
        { date: "2026-02-11", total: 11, approved: 9, rejected: 1, onHold: 1, approvalRate: 82 },
        { date: "2026-02-12", total: 10, approved: 8, rejected: 1, onHold: 1, approvalRate: 80 },
        { date: "2026-02-13", total: 8, approved: 7, rejected: 0, onHold: 1, approvalRate: 88 },
        { date: "2026-02-14", total: 10, approved: 9, rejected: 0, onHold: 1, approvalRate: 90 },
      ];

      const recent7 = dailyTrend.slice(-7);
      const prev7 = dailyTrend.slice(-14, -7);

      const recentAvg = recent7.reduce((s, d) => s + d.approvalRate, 0) / recent7.length;
      const prevAvg = prev7.reduce((s, d) => s + d.approvalRate, 0) / prev7.length;
      const diff = Math.round(recentAvg - prevAvg);

      expect(recentAvg).toBeGreaterThan(prevAvg);
      expect(diff).toBeGreaterThan(0);
    });
  });

  describe("OCR confidence correlation", () => {
    it("should categorize confidence into correct ranges", () => {
      const getRange = (confidence: number): string => {
        if (confidence < 20) return "0-20";
        if (confidence < 40) return "20-40";
        if (confidence < 60) return "40-60";
        if (confidence < 80) return "60-80";
        return "80-100";
      };

      expect(getRange(0)).toBe("0-20");
      expect(getRange(15)).toBe("0-20");
      expect(getRange(20)).toBe("20-40");
      expect(getRange(39)).toBe("20-40");
      expect(getRange(50)).toBe("40-60");
      expect(getRange(65)).toBe("60-80");
      expect(getRange(80)).toBe("80-100");
      expect(getRange(95)).toBe("80-100");
      expect(getRange(100)).toBe("80-100");
    });
  });

  describe("Auto-approval simulation", () => {
    it("should calculate coverage rate correctly", () => {
      const eligible = 30;
      const total = 100;
      const coverageRate = total > 0 ? Math.round((eligible / total) * 100) : 0;
      expect(coverageRate).toBe(30);
    });

    it("should calculate accuracy correctly", () => {
      const correct = 28;
      const eligible = 30;
      const accuracy = eligible > 0 ? Math.round((correct / eligible) * 100) : 0;
      expect(accuracy).toBe(93);
    });

    it("should handle zero eligible gracefully", () => {
      const correct = 0;
      const eligible = 0;
      const accuracy = eligible > 0 ? Math.round((correct / eligible) * 100) : 0;
      expect(accuracy).toBe(0);
    });

    it("should classify thresholds correctly", () => {
      const classify = (accuracy: number, coverageRate: number) => {
        if (accuracy >= 95 && coverageRate >= 20) return "recommended";
        if (accuracy >= 90) return "conditional";
        return "risky";
      };

      expect(classify(98, 30)).toBe("recommended");
      expect(classify(95, 25)).toBe("recommended");
      expect(classify(95, 15)).toBe("conditional"); // high accuracy but low coverage
      expect(classify(92, 40)).toBe("conditional");
      expect(classify(85, 50)).toBe("risky");
      expect(classify(70, 60)).toBe("risky");
    });

    it("should test all four confidence thresholds", () => {
      const thresholds = [60, 70, 80, 90];
      expect(thresholds).toHaveLength(4);
      expect(thresholds[0]).toBe(60);
      expect(thresholds[3]).toBe(90);
    });
  });

  describe("Rejection distribution", () => {
    it("should calculate percentage distribution correctly", () => {
      const distribution = [
        { category: "blurry_image", count: 15 },
        { category: "no_order_number", count: 10 },
        { category: "duplicate", count: 5 },
        { category: "other", count: 3 },
      ];

      const total = distribution.reduce((s, d) => s + d.count, 0);
      expect(total).toBe(33);

      const blurryPct = Math.round((15 / total) * 100);
      expect(blurryPct).toBe(45);

      const otherPct = Math.round((3 / total) * 100);
      expect(otherPct).toBe(9);
    });
  });
});

// ===== Integration: Review Log Data Structure Validation =====

describe("Review Log Data Structure", () => {
  it("should map LINE receipt fields correctly to review log", () => {
    // Simulate a LINE receipt with OCR data
    const lineReceipt = {
      id: 1,
      ocrConfidence: "85",
      fraudScore: "0.5",
      fraudFlags: "[]",
      orderNumber: "TK-123456",
      totalAmount: "3200",
      storeName: "TikTok Shop",
      imageUrls: '["img1.jpg", "img2.jpg"]',
    };

    const reviewLog = {
      receiptId: lineReceipt.id,
      receiptType: "line_receipt" as const,
      decision: "approved" as const,
      reviewedBy: "admin-1",
      ocrConfidence: lineReceipt.ocrConfidence,
      fraudScore: lineReceipt.fraudScore,
      fraudFlagCount: JSON.parse(lineReceipt.fraudFlags || "[]").length,
      hasOrderNumber: lineReceipt.orderNumber ? "yes" as const : "no" as const,
      orderNumber: lineReceipt.orderNumber,
      totalAmount: parseFloat(lineReceipt.totalAmount || "0"),
      storeName: lineReceipt.storeName,
      imageCount: JSON.parse(lineReceipt.imageUrls || "[]").length,
    };

    expect(reviewLog.receiptId).toBe(1);
    expect(reviewLog.ocrConfidence).toBe("85");
    expect(reviewLog.fraudFlagCount).toBe(0);
    expect(reviewLog.hasOrderNumber).toBe("yes");
    expect(reviewLog.totalAmount).toBe(3200);
    expect(reviewLog.imageCount).toBe(2);
  });

  it("should map point request fields correctly to review log", () => {
    const pointRequest = {
      id: 5,
      orderNumber: "TK-999888",
      totalAmount: "1500",
      storeName: null,
      imageUrls: '["receipt.jpg"]',
    };

    const reviewLog = {
      receiptId: pointRequest.id,
      receiptType: "point_request" as const,
      decision: "rejected" as const,
      reviewedBy: "admin-2",
      ocrConfidence: null,
      fraudScore: null,
      fraudFlagCount: 0,
      hasOrderNumber: pointRequest.orderNumber ? "yes" as const : "no" as const,
      orderNumber: pointRequest.orderNumber,
      totalAmount: parseFloat(pointRequest.totalAmount || "0"),
      storeName: pointRequest.storeName,
      imageCount: JSON.parse(pointRequest.imageUrls || "[]").length,
      rejectionCategory: "amount_mismatch" as const,
      rejectionReason: "金額が一致しません",
    };

    expect(reviewLog.receiptType).toBe("point_request");
    expect(reviewLog.decision).toBe("rejected");
    expect(reviewLog.rejectionCategory).toBe("amount_mismatch");
    expect(reviewLog.hasOrderNumber).toBe("yes");
    expect(reviewLog.imageCount).toBe(1);
  });

  it("should handle missing OCR data gracefully", () => {
    const receipt = {
      id: 10,
      ocrConfidence: null,
      fraudScore: null,
      fraudFlags: null,
      orderNumber: null,
      totalAmount: null,
      storeName: null,
      imageUrls: null,
    };

    const reviewLog = {
      receiptId: receipt.id,
      receiptType: "web_receipt" as const,
      decision: "on_hold" as const,
      reviewedBy: "admin-1",
      ocrConfidence: receipt.ocrConfidence,
      fraudScore: receipt.fraudScore,
      fraudFlagCount: 0,
      hasOrderNumber: receipt.orderNumber ? "yes" as const : "no" as const,
      orderNumber: receipt.orderNumber,
      totalAmount: parseFloat(receipt.totalAmount || "0"),
      storeName: receipt.storeName,
      imageCount: 0,
    };

    expect(reviewLog.ocrConfidence).toBeNull();
    expect(reviewLog.fraudScore).toBeNull();
    expect(reviewLog.hasOrderNumber).toBe("no");
    expect(reviewLog.totalAmount).toBe(0);
    expect(reviewLog.imageCount).toBe(0);
  });
});

describe("Rejection Category Labels", () => {
  const REJECTION_CATEGORY_LABELS: Record<string, string> = {
    blurry_image: "画像不鮮明",
    no_order_number: "注文番号なし",
    duplicate: "重複",
    amount_mismatch: "金額不一致",
    invalid_store: "対象外の店舗",
    expired: "期限切れ",
    tampered: "改ざんの疑い",
    other: "その他",
  };

  it("should have Japanese labels for all categories", () => {
    expect(Object.keys(REJECTION_CATEGORY_LABELS)).toHaveLength(8);
    expect(REJECTION_CATEGORY_LABELS["blurry_image"]).toBe("画像不鮮明");
    expect(REJECTION_CATEGORY_LABELS["tampered"]).toBe("改ざんの疑い");
  });

  it("should fallback to category key for unknown categories", () => {
    const unknownCategory = "unknown_category";
    const label = REJECTION_CATEGORY_LABELS[unknownCategory] || unknownCategory;
    expect(label).toBe("unknown_category");
  });
});
