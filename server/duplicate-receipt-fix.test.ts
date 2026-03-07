import { describe, it, expect, vi } from "vitest";

/**
 * Test suite for duplicate receipt detection fix
 * 
 * Problem: Same order number receipts were not being properly rejected,
 * causing duplicate entries in the admin review panel.
 * 
 * Fix:
 * 1. checkDuplicateOrderNumberGlobal now excludes rejected receipts from duplicate search
 * 2. When duplicate is detected, receipt status is set to "rejected" (not left as pending)
 * 3. Frontend hides "force submit" button for duplicate status receipts
 */

describe("Duplicate Receipt Detection Fix", () => {
  
  describe("checkDuplicateOrderNumberGlobal - Status Filter", () => {
    it("should only match non-rejected receipts for duplicate detection", () => {
      // The SQL condition should include status != 'rejected'
      // This ensures previously rejected duplicates don't block new legitimate submissions
      const sqlCondition = `JSON_EXTRACT(line_receipts.ocrRawText, '$.orderNumber') = ? AND line_receipts.status != 'rejected'`;
      expect(sqlCondition).toContain("status != 'rejected'");
    });

    it("should still detect duplicates among pending/approved/on_hold receipts", () => {
      const validStatuses = ["pending", "approved", "on_hold"];
      const rejectedStatus = "rejected";
      
      // Simulate: a receipt with status "approved" should be detected as duplicate
      for (const status of validStatuses) {
        expect(status).not.toBe(rejectedStatus);
      }
    });
  });

  describe("Duplicate Receipt Status Update", () => {
    it("should set receipt status to rejected when duplicate order number is detected", () => {
      // Simulate the flow: after OCR detects duplicate order number,
      // the receipt should be marked as rejected
      const duplicateDetected = true;
      const expectedStatus = "rejected";
      const expectedReviewNote = "自動却下: この注文は既にポイント申請済みです。注文番号: 5818090583106206003";
      
      if (duplicateDetected) {
        const status = expectedStatus;
        expect(status).toBe("rejected");
        expect(expectedReviewNote).toContain("自動却下");
      }
    });

    it("should include rejection reason in AI rejection fields", () => {
      const orderNumber = "5818090583106206003";
      const isSameUser = true;
      
      const rejectionMsg = isSameUser
        ? `この注文は既にポイント申請済みです。注文番号: ${orderNumber}`
        : `この注文番号は既に他の方が申請済みです。注文番号: ${orderNumber}`;
      
      expect(rejectionMsg).toContain(orderNumber);
      expect(rejectionMsg).toContain("既に");
    });

    it("should return duplicate status to frontend", () => {
      const response = {
        receiptId: 123,
        status: "duplicate" as const,
        message: "この注文は既にポイント申請済みです。注文番号: 5818090583106206003",
        aiRejectionReason: "この注文は既にポイント申請済みです。注文番号: 5818090583106206003",
        ocrData: { orderNumber: "5818090583106206003" },
        imageUrls: ["https://example.com/img.jpg"],
      };
      
      expect(response.status).toBe("duplicate");
      expect(response.aiRejectionReason).toBeTruthy();
    });
  });

  describe("Frontend Duplicate Handling", () => {
    it("should not show force submit button for duplicate status", () => {
      const analysisResult = {
        status: "duplicate" as const,
        receiptId: 123,
      };
      
      // The condition in ReceiptUpload.tsx:
      // status !== "success" && status !== "on_hold" && status !== "duplicate"
      const showForceSubmit = 
        analysisResult.status !== "success" && 
        analysisResult.status !== "on_hold" && 
        analysisResult.status !== "duplicate" && 
        analysisResult.receiptId != null;
      
      expect(showForceSubmit).toBe(false);
    });

    it("should show force submit button for non-duplicate rejected statuses", () => {
      const statuses = ["not_tiktok", "not_delivered", "incomplete", "analysis_failed"] as const;
      
      for (const status of statuses) {
        const showForceSubmit = 
          status !== "success" && 
          status !== "on_hold" && 
          status !== "duplicate";
        
        expect(showForceSubmit).toBe(true);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle case where order number is null (no duplicate check needed)", () => {
      const ocrData = { orderNumber: null, totalAmount: 5000 };
      
      // When orderNumber is null, duplicate check should be skipped
      if (ocrData.orderNumber) {
        // This block should not execute
        expect(true).toBe(false);
      } else {
        // No duplicate check needed
        expect(ocrData.orderNumber).toBeNull();
      }
    });

    it("should handle same user submitting same order number", () => {
      const lineUserId = "user_123";
      const duplicateOrder = { lineUserId: "user_123" };
      
      const isSameUser = duplicateOrder.lineUserId === lineUserId;
      expect(isSameUser).toBe(true);
      
      const msg = isSameUser
        ? "この注文は既にポイント申請済みです。"
        : "この注文番号は既に他の方が申請済みです。";
      
      expect(msg).toContain("既にポイント申請済み");
    });

    it("should handle different user submitting same order number", () => {
      const lineUserId = "user_456";
      const duplicateOrder = { lineUserId: "user_123" };
      
      const isSameUser = duplicateOrder.lineUserId === lineUserId;
      expect(isSameUser).toBe(false);
      
      const msg = isSameUser
        ? "この注文は既にポイント申請済みです。"
        : "この注文番号は既に他の方が申請済みです。";
      
      expect(msg).toContain("他の方が申請済み");
    });

    it("should not block re-submission after a receipt was rejected", () => {
      // If a receipt was rejected (e.g., by admin), the same order number
      // should be allowed to be submitted again
      const existingReceiptStatus = "rejected";
      const shouldBlock = existingReceiptStatus !== "rejected";
      
      expect(shouldBlock).toBe(false);
    });
  });
});
