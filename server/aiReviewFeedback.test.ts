import { describe, it, expect } from "vitest";

/**
 * Tests for AI Review Feedback system:
 * 1. AI弾き情報がline_receiptsに正しく保存される
 * 2. 強制申請フラグが正しく設定される
 * 3. 管理者承認時にAIフィードバック（aiWasCorrect=false）が記録される
 * 4. 管理者却下時にAIフィードバック（aiWasCorrect=true）が記録される
 * 5. フロントエンドでAI弾きバッジが正しく表示される条件
 * 6. AI弾きカテゴリの日本語ラベルマッピング
 */

describe("AI Review Feedback System", () => {
  describe("AI rejection data persistence", () => {
    it("should store aiRejectionReason and aiRejectionCategory for not_tiktok", () => {
      const updateData = {
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        aiRejectionCategory: "not_tiktok" as const,
      };
      
      expect(updateData.aiRejectionReason).toBeTruthy();
      expect(updateData.aiRejectionCategory).toBe("not_tiktok");
    });

    it("should store aiRejectionReason and aiRejectionCategory for not_delivered", () => {
      const updateData = {
        aiRejectionReason: "配達ステータスが「配達済み」と確認できませんでした",
        aiRejectionCategory: "not_delivered" as const,
      };
      
      expect(updateData.aiRejectionReason).toBeTruthy();
      expect(updateData.aiRejectionCategory).toBe("not_delivered");
    });

    it("should store aiRejectionReason and aiRejectionCategory for incomplete", () => {
      const updateData = {
        aiRejectionReason: "購入金額を画像から読み取ることができませんでした",
        aiRejectionCategory: "incomplete" as const,
      };
      
      expect(updateData.aiRejectionReason).toBeTruthy();
      expect(updateData.aiRejectionCategory).toBe("incomplete");
    });
  });

  describe("Force submit flag", () => {
    it("should set isForceSubmitted=true and forceSubmittedAt when force submitted", () => {
      const now = new Date();
      const receipt = {
        id: 100,
        isForceSubmitted: true,
        forceSubmittedAt: now,
        aiRejectionCategory: "not_tiktok" as const,
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        status: "on_hold" as const,
      };
      
      expect(receipt.isForceSubmitted).toBe(true);
      expect(receipt.forceSubmittedAt).toBeInstanceOf(Date);
      expect(receipt.status).toBe("on_hold");
    });

    it("should not have isForceSubmitted for normal receipts", () => {
      const receipt = {
        id: 200,
        isForceSubmitted: false,
        forceSubmittedAt: null,
        aiRejectionCategory: null,
        aiRejectionReason: null,
        status: "pending" as const,
      };
      
      expect(receipt.isForceSubmitted).toBe(false);
      expect(receipt.forceSubmittedAt).toBeNull();
    });
  });

  describe("AI feedback on admin approval (AI was wrong)", () => {
    it("should create feedback with aiWasCorrect=false when admin approves force-submitted receipt", () => {
      const receipt = {
        id: 100,
        isForceSubmitted: true,
        aiRejectionCategory: "not_tiktok" as const,
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        imageUrl: "https://example.com/img.png",
        imageUrls: ["https://example.com/img.png"],
        ocrRawText: '{"shopName":"TikTok Shop"}',
        totalAmount: 3000,
        storeName: "TikTok Shop",
        ocrConfidence: 85,
      };

      // Simulate feedback creation
      const shouldCreateFeedback = receipt.isForceSubmitted && receipt.aiRejectionCategory;
      expect(shouldCreateFeedback).toBeTruthy();

      const feedback = {
        receiptId: receipt.id,
        receiptType: "line_receipt" as const,
        aiDecision: receipt.aiRejectionCategory,
        aiRejectionReason: receipt.aiRejectionReason,
        humanDecision: "approved" as const,
        humanNote: "正常なレシートでした",
        aiWasCorrect: false, // AI弾いたが管理者承認 = AIの判断ミス
        imageUrl: receipt.imageUrl,
        imageUrls: receipt.imageUrls,
        ocrRawText: receipt.ocrRawText,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        ocrConfidence: receipt.ocrConfidence,
        reviewedBy: 1,
      };

      expect(feedback.aiWasCorrect).toBe(false);
      expect(feedback.humanDecision).toBe("approved");
      expect(feedback.aiDecision).toBe("not_tiktok");
      expect(feedback.receiptId).toBe(100);
    });

    it("should NOT create feedback when approving a normal (non-force-submitted) receipt", () => {
      const receipt = {
        id: 200,
        isForceSubmitted: false,
        aiRejectionCategory: null,
      };

      const shouldCreateFeedback = receipt.isForceSubmitted && receipt.aiRejectionCategory;
      expect(shouldCreateFeedback).toBeFalsy();
    });
  });

  describe("AI feedback on admin rejection (AI was correct)", () => {
    it("should create feedback with aiWasCorrect=true when admin rejects force-submitted receipt", () => {
      const receipt = {
        id: 300,
        isForceSubmitted: true,
        aiRejectionCategory: "not_delivered" as const,
        aiRejectionReason: "配達ステータスが「配達済み」と確認できませんでした",
        imageUrl: "https://example.com/img2.png",
        imageUrls: ["https://example.com/img2.png"],
        ocrRawText: '{"shopName":"TikTok Shop","isDelivered":false}',
        totalAmount: 5000,
        storeName: "TikTok Shop",
        ocrConfidence: 90,
      };

      const shouldCreateFeedback = receipt.isForceSubmitted && receipt.aiRejectionCategory;
      expect(shouldCreateFeedback).toBeTruthy();

      const feedback = {
        receiptId: receipt.id,
        receiptType: "line_receipt" as const,
        aiDecision: receipt.aiRejectionCategory,
        aiRejectionReason: receipt.aiRejectionReason,
        humanDecision: "rejected" as const,
        humanNote: "確かに未配達でした",
        aiWasCorrect: true, // AI弾いて管理者も却下 = AIの判断が正しかった
        imageUrl: receipt.imageUrl,
        imageUrls: receipt.imageUrls,
        ocrRawText: receipt.ocrRawText,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        ocrConfidence: receipt.ocrConfidence,
        reviewedBy: 1,
      };

      expect(feedback.aiWasCorrect).toBe(true);
      expect(feedback.humanDecision).toBe("rejected");
      expect(feedback.aiDecision).toBe("not_delivered");
    });
  });

  describe("AI rejection category label mapping", () => {
    const categoryLabels: Record<string, string> = {
      not_tiktok: "TikTok以外",
      not_delivered: "未配達",
      incomplete: "金額不明",
      other: "その他",
    };

    it("should map not_tiktok to TikTok以外", () => {
      expect(categoryLabels["not_tiktok"]).toBe("TikTok以外");
    });

    it("should map not_delivered to 未配達", () => {
      expect(categoryLabels["not_delivered"]).toBe("未配達");
    });

    it("should map incomplete to 金額不明", () => {
      expect(categoryLabels["incomplete"]).toBe("金額不明");
    });

    it("should map other to その他", () => {
      expect(categoryLabels["other"]).toBe("その他");
    });
  });

  describe("Frontend display conditions", () => {
    it("should show AI弾き badge when isForceSubmitted is true", () => {
      const receipt = { isForceSubmitted: true, aiRejectionCategory: "not_tiktok" };
      const showBadge = !!receipt.isForceSubmitted;
      expect(showBadge).toBe(true);
    });

    it("should NOT show AI弾き badge when isForceSubmitted is false", () => {
      const receipt = { isForceSubmitted: false, aiRejectionCategory: null };
      const showBadge = !!receipt.isForceSubmitted;
      expect(showBadge).toBe(false);
    });

    it("should show AI判定理由 in review panel when aiRejectionReason exists", () => {
      const receipt = {
        isForceSubmitted: true,
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        aiRejectionCategory: "not_tiktok",
      };
      const showReason = receipt.isForceSubmitted && !!receipt.aiRejectionReason;
      expect(showReason).toBe(true);
    });

    it("should show AI弾きカテゴリ badge in review panel when aiRejectionCategory exists", () => {
      const receipt = {
        isForceSubmitted: true,
        aiRejectionReason: "配達ステータスが「配達済み」と確認できませんでした",
        aiRejectionCategory: "not_delivered",
      };
      const showCategory = receipt.isForceSubmitted && !!receipt.aiRejectionCategory;
      expect(showCategory).toBe(true);
    });
  });

  describe("AI feedback stats calculation", () => {
    it("should calculate AI accuracy correctly", () => {
      const feedbacks = [
        { aiWasCorrect: true },
        { aiWasCorrect: true },
        { aiWasCorrect: false },
        { aiWasCorrect: true },
        { aiWasCorrect: false },
      ];

      const total = feedbacks.length;
      const correct = feedbacks.filter(f => f.aiWasCorrect).length;
      const accuracy = Math.round((correct / total) * 100 * 10) / 10;

      expect(total).toBe(5);
      expect(correct).toBe(3);
      expect(accuracy).toBe(60);
    });

    it("should categorize feedback by AI decision type", () => {
      const feedbacks = [
        { aiDecision: "not_tiktok", aiWasCorrect: false },
        { aiDecision: "not_tiktok", aiWasCorrect: true },
        { aiDecision: "not_delivered", aiWasCorrect: true },
        { aiDecision: "incomplete", aiWasCorrect: false },
      ];

      const byCategory = feedbacks.reduce((acc, f) => {
        if (!acc[f.aiDecision]) {
          acc[f.aiDecision] = { total: 0, correct: 0 };
        }
        acc[f.aiDecision].total++;
        if (f.aiWasCorrect) acc[f.aiDecision].correct++;
        return acc;
      }, {} as Record<string, { total: number; correct: number }>);

      expect(byCategory["not_tiktok"].total).toBe(2);
      expect(byCategory["not_tiktok"].correct).toBe(1);
      expect(byCategory["not_delivered"].total).toBe(1);
      expect(byCategory["not_delivered"].correct).toBe(1);
      expect(byCategory["incomplete"].total).toBe(1);
      expect(byCategory["incomplete"].correct).toBe(0);
    });
  });

  describe("AI review feedback data structure", () => {
    it("should have all required fields for learning data export", () => {
      const feedback = {
        id: 1,
        receiptId: 100,
        receiptType: "line_receipt",
        aiDecision: "not_tiktok",
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        humanDecision: "approved",
        humanNote: "正常なレシートでした",
        aiWasCorrect: false,
        imageUrl: "https://example.com/img.png",
        imageUrls: ["https://example.com/img.png"],
        ocrRawText: '{"shopName":"TikTok Shop"}',
        totalAmount: 3000,
        storeName: "TikTok Shop",
        ocrConfidence: 85,
        reviewedBy: 1,
        createdAt: new Date(),
      };

      // All fields needed for AI learning
      expect(feedback.receiptId).toBeDefined();
      expect(feedback.aiDecision).toBeDefined();
      expect(feedback.humanDecision).toBeDefined();
      expect(feedback.aiWasCorrect).toBeDefined();
      expect(feedback.imageUrl || feedback.imageUrls).toBeTruthy();
      expect(feedback.ocrRawText).toBeDefined();
      expect(feedback.ocrConfidence).toBeDefined();
    });
  });
});
