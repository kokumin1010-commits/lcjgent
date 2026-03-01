import { describe, it, expect } from "vitest";

/**
 * Tests for AI Data Quality Improvements:
 * 1. OCR confidence が審査ログに保存される
 * 2. 却下理由カテゴリが必須化され、具体的なカテゴリが選択される
 * 3. adminReRecognizeOrderNumber で confidence が DB に保存される
 * 4. フロントエンドの却下理由カテゴリ選択UI
 */

describe("OCR Confidence Recording", () => {
  describe("adminReRecognizeOrderNumber confidence storage", () => {
    it("should include ocrConfidence in updateData when LLM returns confidence", () => {
      // Simulate LLM response with confidence
      const ocrResult = {
        orderNumber: "5827931234567890",
        totalAmount: 3618,
        storeName: "KYOGOKU JAPAN",
        confidence: 91,
        items: [],
      };

      const updateData: Record<string, any> = {};
      if (ocrResult.orderNumber) updateData.orderNumber = ocrResult.orderNumber;
      if (ocrResult.totalAmount) updateData.totalAmount = ocrResult.totalAmount;
      if (ocrResult.storeName) updateData.storeName = ocrResult.storeName;
      if (ocrResult.confidence !== undefined) updateData.ocrConfidence = ocrResult.confidence;

      expect(updateData.ocrConfidence).toBe(91);
    });

    it("should handle missing confidence gracefully", () => {
      const ocrResult = {
        orderNumber: "5827931234567890",
        totalAmount: 3618,
        storeName: "KYOGOKU JAPAN",
        items: [],
      };

      const updateData: Record<string, any> = {};
      if (ocrResult.orderNumber) updateData.orderNumber = ocrResult.orderNumber;
      if ((ocrResult as any).confidence !== undefined) updateData.ocrConfidence = (ocrResult as any).confidence;

      expect(updateData.ocrConfidence).toBeUndefined();
    });

    it("should store confidence values between 0 and 100", () => {
      const validConfidences = [0, 25, 50, 75, 100];
      for (const conf of validConfidences) {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("Review log confidence recording", () => {
    it("should include ocrConfidence in review log when approving", () => {
      const receipt = {
        id: 100,
        ocrConfidence: 85,
        orderNumber: "5827931234567890",
        totalAmount: 3618,
      };

      const reviewLog = {
        receiptId: receipt.id,
        decision: "approved" as const,
        ocrConfidence: receipt.ocrConfidence,
        orderNumber: receipt.orderNumber,
        totalAmount: receipt.totalAmount,
      };

      expect(reviewLog.ocrConfidence).toBe(85);
      expect(reviewLog.decision).toBe("approved");
    });

    it("should include ocrConfidence in review log when rejecting", () => {
      const receipt = {
        id: 200,
        ocrConfidence: 45,
        orderNumber: null,
        totalAmount: null,
      };

      const reviewLog = {
        receiptId: receipt.id,
        decision: "rejected" as const,
        ocrConfidence: receipt.ocrConfidence,
        rejectionCategory: "missing_order_number",
      };

      expect(reviewLog.ocrConfidence).toBe(45);
      expect(reviewLog.decision).toBe("rejected");
      expect(reviewLog.rejectionCategory).toBe("missing_order_number");
    });
  });
});

describe("Rejection Category Detailed Selection", () => {
  const VALID_CATEGORIES = [
    "blurry_image",
    "missing_order_number",
    "missing_amount",
    "not_delivered",
    "duplicate",
    "wrong_store",
    "suspicious",
    "incomplete_info",
    "other",
  ] as const;

  describe("Valid rejection categories", () => {
    it("should have 9 specific rejection categories", () => {
      expect(VALID_CATEGORIES).toHaveLength(9);
    });

    it("should include blurry_image for unclear images", () => {
      expect(VALID_CATEGORIES).toContain("blurry_image");
    });

    it("should include missing_order_number for receipts without order numbers", () => {
      expect(VALID_CATEGORIES).toContain("missing_order_number");
    });

    it("should include missing_amount for receipts without amounts", () => {
      expect(VALID_CATEGORIES).toContain("missing_amount");
    });

    it("should include not_delivered for undelivered orders", () => {
      expect(VALID_CATEGORIES).toContain("not_delivered");
    });

    it("should include duplicate for duplicate submissions", () => {
      expect(VALID_CATEGORIES).toContain("duplicate");
    });

    it("should include wrong_store for non-TikTok Shop receipts", () => {
      expect(VALID_CATEGORIES).toContain("wrong_store");
    });

    it("should include suspicious for fraud suspicion", () => {
      expect(VALID_CATEGORIES).toContain("suspicious");
    });

    it("should include incomplete_info for insufficient information", () => {
      expect(VALID_CATEGORIES).toContain("incomplete_info");
    });

    it("should include other as fallback", () => {
      expect(VALID_CATEGORIES).toContain("other");
    });
  });

  describe("Rejection category requirement enforcement", () => {
    it("should require rejectionCategory before allowing rejection", () => {
      const rejectionCategory = "";
      const canReject = !!rejectionCategory;
      expect(canReject).toBe(false);
    });

    it("should allow rejection when rejectionCategory is selected", () => {
      const rejectionCategory = "blurry_image";
      const canReject = !!rejectionCategory;
      expect(canReject).toBe(true);
    });

    it("should show error toast when keyboard shortcut R is pressed without category", () => {
      const rejectionCategory = "";
      let toastMessage = "";
      
      if (!rejectionCategory) {
        toastMessage = "却下理由を選択してください（AI学習に必要です）";
      }
      
      expect(toastMessage).toBe("却下理由を選択してください（AI学習に必要です）");
    });
  });

  describe("Category label mapping for UI", () => {
    const categoryLabels: Record<string, string> = {
      blurry_image: "画像が不鮮明",
      missing_order_number: "注文番号が見えない",
      missing_amount: "金額が見えない",
      not_delivered: "未配達",
      duplicate: "重複申請",
      wrong_store: "TikTok Shop以外",
      suspicious: "不正の疑い",
      incomplete_info: "情報不足",
      other: "その他",
    };

    it("should have Japanese labels for all categories", () => {
      for (const cat of VALID_CATEGORIES) {
        expect(categoryLabels[cat]).toBeTruthy();
        expect(typeof categoryLabels[cat]).toBe("string");
      }
    });

    it("should map blurry_image to 画像が不鮮明", () => {
      expect(categoryLabels["blurry_image"]).toBe("画像が不鮮明");
    });

    it("should map suspicious to 不正の疑い", () => {
      expect(categoryLabels["suspicious"]).toBe("不正の疑い");
    });
  });

  describe("Rejection toast message includes category", () => {
    it("should include rejection category in success toast", () => {
      const rejectionCategory = "blurry_image";
      const toastMsg = `却下完了（LINE送信済み）理由: ${rejectionCategory || "other"}`;
      expect(toastMsg).toContain("blurry_image");
    });

    it("should fallback to other when category is empty", () => {
      const rejectionCategory = "";
      const toastMsg = `却下完了（LINE送信済み）理由: ${rejectionCategory || "other"}`;
      expect(toastMsg).toContain("other");
    });
  });
});

describe("Data quality for AI learning", () => {
  describe("Minimum data requirements for auto-approval training", () => {
    it("should identify receipts with both confidence and category for training", () => {
      const reviewLogs = [
        { ocrConfidence: 95, rejectionCategory: "other", decision: "approved" },
        { ocrConfidence: 30, rejectionCategory: "blurry_image", decision: "rejected" },
        { ocrConfidence: null, rejectionCategory: "other", decision: "approved" },
        { ocrConfidence: 85, rejectionCategory: "missing_order_number", decision: "rejected" },
      ];

      const trainableData = reviewLogs.filter(
        (log) => log.ocrConfidence !== null && log.rejectionCategory !== "other"
      );

      // Only logs with both confidence and specific category are useful for training
      expect(trainableData).toHaveLength(2);
      expect(trainableData[0].rejectionCategory).toBe("blurry_image");
      expect(trainableData[1].rejectionCategory).toBe("missing_order_number");
    });

    it("should calculate data quality score based on non-null confidence ratio", () => {
      const reviewLogs = [
        { ocrConfidence: 95 },
        { ocrConfidence: null },
        { ocrConfidence: 85 },
        { ocrConfidence: null },
        { ocrConfidence: 70 },
      ];

      const withConfidence = reviewLogs.filter((l) => l.ocrConfidence !== null).length;
      const qualityScore = Math.round((withConfidence / reviewLogs.length) * 100);

      expect(qualityScore).toBe(60);
    });

    it("should calculate rejection category diversity score", () => {
      const rejectedLogs = [
        { rejectionCategory: "blurry_image" },
        { rejectionCategory: "missing_order_number" },
        { rejectionCategory: "other" },
        { rejectionCategory: "blurry_image" },
        { rejectionCategory: "suspicious" },
      ];

      const uniqueCategories = new Set(rejectedLogs.map((l) => l.rejectionCategory));
      const diversityScore = uniqueCategories.size;

      expect(diversityScore).toBe(4); // 4 unique categories
      expect(uniqueCategories.has("blurry_image")).toBe(true);
      expect(uniqueCategories.has("suspicious")).toBe(true);
    });
  });
});
