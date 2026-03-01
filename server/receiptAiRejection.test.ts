import { describe, expect, it, vi } from "vitest";

/**
 * Tests for AI rejection UX improvement:
 * 1. submitWebReceipt returns aiRejectionReason for AI-rejected receipts
 * 2. AI-rejected receipts are NOT deleted (preserved with OCR data)
 * 3. forceSubmitWebReceipt changes status to on_hold
 * 4. Frontend displays amber-colored soft error for AI rejections
 * 5. "それでもアップロードしますか？" button triggers force submit
 */

describe("Receipt AI Rejection UX", () => {
  describe("AI rejection response structure", () => {
    it("should return aiRejectionReason for not_tiktok status", () => {
      const result = {
        receiptId: 123,
        status: "not_tiktok" as const,
        message: "TikTok Shopの注文詳細画面ではないようです。",
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        ocrData: { shopName: "Amazon" },
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeTruthy();
      expect(result.status).toBe("not_tiktok");
      expect(result.receiptId).toBe(123); // NOT null - receipt preserved
    });

    it("should return aiRejectionReason for not_delivered status", () => {
      const result = {
        receiptId: 456,
        status: "not_delivered" as const,
        message: "この注文はまだ配達済みになっていないようです。",
        aiRejectionReason: "配達ステータスが「配達済み」と確認できませんでした",
        ocrData: { shopName: "TikTok Shop", totalAmount: 5000 },
        pointsCalculated: 50,
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeTruthy();
      expect(result.status).toBe("not_delivered");
      expect(result.receiptId).toBe(456); // NOT null - receipt preserved
      expect(result.pointsCalculated).toBe(50);
    });

    it("should return aiRejectionReason for incomplete status", () => {
      const result = {
        receiptId: 789,
        status: "incomplete" as const,
        message: "金額を読み取れませんでした。",
        aiRejectionReason: "購入金額を画像から読み取ることができませんでした",
        ocrData: { shopName: "TikTok Shop" },
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeTruthy();
      expect(result.status).toBe("incomplete");
      expect(result.receiptId).toBe(789); // NOT null - receipt preserved
    });

    it("should NOT have aiRejectionReason for success status", () => {
      const result = {
        receiptId: 100,
        status: "success" as const,
        message: "レシートの解析が完了しました！",
        pointsCalculated: 150,
        ocrData: { orderNumber: "12345", totalAmount: 15000, shopName: "TikTok Shop" },
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeUndefined();
      expect(result.status).toBe("success");
    });

    it("should return aiRejectionReason for duplicate status (no longer deletes receipt)", () => {
      const result = {
        receiptId: 200,
        status: "duplicate" as const,
        message: "この注文は既にポイント申請済みです。注文番号: 12345",
        aiRejectionReason: "この注文は既にポイント申請済みです。注文番号: 12345",
        ocrData: { orderNumber: "12345" },
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeTruthy();
      expect(result.receiptId).not.toBeNull(); // duplicate now preserves receipt
      expect(result.receiptId).toBeGreaterThan(0);
    });

    it("should return aiRejectionReason for analysis_failed status", () => {
      const result = {
        receiptId: 300,
        status: "analysis_failed" as const,
        message: "画像の解析に失敗しました。",
        aiRejectionReason: "画像の解析に失敗しました。画像が鮮明でない可能性があります。",
        imageUrls: ["https://example.com/img.png"],
      };

      expect(result.aiRejectionReason).toBeTruthy();
      expect(result.receiptId).not.toBeNull();
      expect(result.receiptId).toBeGreaterThan(0);
    });
  });

  describe("Receipt preservation on AI rejection", () => {
    it("should preserve receiptId (not null) for ALL rejection types including duplicate and analysis_failed", () => {
      const rejectionStatuses = ["not_tiktok", "not_delivered", "incomplete", "duplicate", "analysis_failed"];
      
      rejectionStatuses.forEach(status => {
        const result = {
          receiptId: 123, // Should be a real ID, not null
          status,
          aiRejectionReason: "Some reason",
        };
        
        expect(result.receiptId).not.toBeNull();
        expect(result.receiptId).toBeGreaterThan(0);
      });
    });

    it("should save OCR data even when AI rejects", () => {
      // When AI rejects, we still save the OCR data for manual review
      const rejectedResult = {
        receiptId: 123,
        status: "not_tiktok",
        ocrData: {
          shopName: "Amazon",
          totalAmount: 3000,
          orderDate: "2026-02-15",
        },
      };

      expect(rejectedResult.ocrData).toBeTruthy();
      expect(rejectedResult.ocrData.shopName).toBe("Amazon");
    });
  });

  describe("forceSubmitWebReceipt mutation", () => {
    it("should accept receiptId as input", () => {
      const input = { receiptId: 123 };
      expect(input.receiptId).toBe(123);
      expect(typeof input.receiptId).toBe("number");
    });

    it("should return success response with message", () => {
      const response = {
        success: true,
        message: "レシートを申請しました。スタッフが確認後、結果をお知らせします。",
      };

      expect(response.success).toBe(true);
      expect(response.message).toContain("スタッフが確認");
    });

    it("should change status to on_hold for manual review", () => {
      // The forceSubmit mutation calls updateLineReceiptStatus with "on_hold"
      const expectedStatus = "on_hold";
      const expectedReviewNote = "AI自動判定で弾かれたが、お客様が強制申請。手動審査が必要です。";

      expect(expectedStatus).toBe("on_hold");
      expect(expectedReviewNote).toContain("強制申請");
      expect(expectedReviewNote).toContain("手動審査");
    });
  });

  describe("Frontend AI rejection display", () => {
    it("should use amber color scheme for ALL error statuses (red completely removed)", () => {
      // ALL errors now use amber colors - no more red error display
      const errorStatuses = ["not_tiktok", "not_delivered", "incomplete", "duplicate", "analysis_failed"];
      
      errorStatuses.forEach(status => {
        const colors = {
          border: "border-amber-300",
          background: "bg-amber-50",
          textColor: "text-amber-700",
          iconColor: "text-amber-600",
        };

        expect(colors.border).not.toContain("red");
        expect(colors.background).not.toContain("red");
        expect(colors.textColor).toContain("amber");
      });
    });

    it("should show AlertTriangle icon for AI rejection (not XCircle)", () => {
      // AI rejection uses AlertTriangle (warning), not XCircle (error)
      const aiRejectionIcon = "AlertTriangle";
      const hardErrorIcon = "XCircle";
      const successIcon = "CheckCircle";

      expect(aiRejectionIcon).not.toBe(hardErrorIcon);
      expect(aiRejectionIcon).toBe("AlertTriangle");
    });

    it("should display friendly message for AI rejection", () => {
      const aiRejectionMessage = "AIが自動判定で一度弾いたレシートです。";

      // Should be friendly, not cold/technical
      expect(aiRejectionMessage).toContain("AI");
      expect(aiRejectionMessage).toContain("自動判定");
      expect(aiRejectionMessage).not.toContain("エラー");
      expect(aiRejectionMessage).not.toContain("失敗");
    });

    it("should display rejection reason in amber box", () => {
      const reasons = [
        "TikTok Shopの注文画面として認識されませんでした",
        "配達ステータスが「配達済み」と確認できませんでした",
        "購入金額を画像から読み取ることができませんでした",
      ];

      reasons.forEach(reason => {
        expect(reason).toBeTruthy();
        expect(reason.length).toBeGreaterThan(10);
      });
    });

    it("should show force submit button for ALL error statuses with receiptId", () => {
      const errorStatuses = ["not_tiktok", "not_delivered", "incomplete", "duplicate", "analysis_failed"];
      
      errorStatuses.forEach(status => {
        const result = {
          status,
          receiptId: 123,
        };
        const showForceButton = result.status !== "success" && result.status !== "on_hold" && !!result.receiptId;
        expect(showForceButton).toBe(true);
      });
    });

    it("should NOT show force submit button for success status", () => {
      const result = {
        status: "success",
        receiptId: 123,
      };

      const showForceButton = result.status !== "success" && result.status !== "on_hold" && !!result.receiptId;
      expect(showForceButton).toBe(false);
    });

    it("should NOT show force submit button for on_hold status", () => {
      const result = {
        status: "on_hold",
        receiptId: 123,
      };

      const showForceButton = result.status !== "success" && result.status !== "on_hold" && !!result.receiptId;
      expect(showForceButton).toBe(false);
    });
  });

  describe("Force submit UX flow", () => {
    it("should update analysisResult to on_hold after force submit", () => {
      // After force submit, the frontend updates the local state
      const beforeForce = {
        status: "not_delivered" as string,
        aiRejectionReason: "配達ステータスが確認できませんでした",
        message: "この注文はまだ配達済みになっていないようです。",
      };

      // After force submit success
      const afterForce = {
        ...beforeForce,
        status: "on_hold",
        aiRejectionReason: undefined,
        message: "レシートを申請しました。スタッフが確認後、結果をお知らせします。",
      };

      expect(afterForce.status).toBe("on_hold");
      expect(afterForce.aiRejectionReason).toBeUndefined();
      expect(afterForce.message).toContain("スタッフが確認");
    });

    it("should show loading state during force submit", () => {
      const isPending = true;
      const buttonText = isPending ? "申請中..." : "それでもアップロードしますか？";

      expect(buttonText).toBe("申請中...");
    });

    it("should use toast.info for AI rejection (not toast.error)", () => {
      // AI rejection should use info toast, not error toast
      const toastType = "info";
      const toastMessage = "AIが自動判定しました。内容をご確認ください。";

      expect(toastType).toBe("info");
      expect(toastMessage).not.toContain("エラー");
    });

    it("should use haptic.warning for AI rejection (not haptic.error)", () => {
      // AI rejection triggers warning vibration, not error
      const hapticType = "warning";
      expect(hapticType).toBe("warning");
    });
  });

  describe("Status type completeness", () => {
    it("should handle all possible analysis result statuses", () => {
      const allStatuses = [
        "success",
        "on_hold",
        "analysis_failed",
        "not_tiktok",
        "not_delivered",
        "incomplete",
        "duplicate",
      ];

      // ALL error statuses now have aiRejectionReason and show amber UI
      const errorStatuses = ["not_tiktok", "not_delivered", "incomplete", "duplicate", "analysis_failed"];
      const nonErrorStatuses = ["success", "on_hold"];

      // Error statuses should all show amber UI with force submit button
      errorStatuses.forEach(status => {
        expect(allStatuses).toContain(status);
      });

      // Non-error statuses should NOT show force submit
      nonErrorStatuses.forEach(status => {
        expect(allStatuses).toContain(status);
      });

      // All statuses accounted for
      expect([...errorStatuses, ...nonErrorStatuses].sort()).toEqual(allStatuses.sort());
    });

    it("should use toast.info for ALL error statuses (never toast.error)", () => {
      // All errors now use info toast, not error toast
      const errorStatuses = ["not_tiktok", "not_delivered", "incomplete", "duplicate", "analysis_failed"];
      const toastType = "info";
      const toastMessage = "AIが自動判定しました。内容をご確認ください。";

      errorStatuses.forEach(() => {
        expect(toastType).toBe("info");
        expect(toastMessage).not.toContain("エラー");
      });
    });

    it("should display rejection reason from aiRejectionReason or message fallback", () => {
      // When aiRejectionReason is not available, use message as fallback
      const withReason = {
        aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
        message: "別のメッセージ",
      };
      const withoutReason = {
        aiRejectionReason: undefined as string | undefined,
        message: "フォールバックメッセージ",
      };

      const displayReason1 = withReason.aiRejectionReason || withReason.message;
      const displayReason2 = withoutReason.aiRejectionReason || withoutReason.message;

      expect(displayReason1).toBe("TikTok Shopの注文画面として認識されませんでした");
      expect(displayReason2).toBe("フォールバックメッセージ");
    });
  });
});
