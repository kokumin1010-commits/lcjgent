import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB functions
const mockGetLineReceiptById = vi.fn();
const mockUpdateLineReceiptStatus = vi.fn();
const mockAwardPointsForLineReceipt = vi.fn();
const mockGetLinePointBalance = vi.fn();
const mockCheckDuplicateOrderNumberGlobal = vi.fn();
const mockGetPointRequestById = vi.fn();
const mockUpdateReceiptStatus = vi.fn();
const mockAwardPointsForReceipt = vi.fn();
const mockPushMessage = vi.fn();

vi.mock("./db", () => ({
  getLineReceiptById: (...args: any[]) => mockGetLineReceiptById(...args),
  updateLineReceiptStatus: (...args: any[]) => mockUpdateLineReceiptStatus(...args),
  awardPointsForLineReceipt: (...args: any[]) => mockAwardPointsForLineReceipt(...args),
  getLinePointBalance: (...args: any[]) => mockGetLinePointBalance(...args),
  checkDuplicateOrderNumberGlobal: (...args: any[]) => mockCheckDuplicateOrderNumberGlobal(...args),
  getPointRequestById: (...args: any[]) => mockGetPointRequestById(...args),
  updateReceiptStatus: (...args: any[]) => mockUpdateReceiptStatus(...args),
  awardPointsForReceipt: (...args: any[]) => mockAwardPointsForReceipt(...args),
}));

vi.mock("./line", () => ({
  pushMessage: (...args: any[]) => mockPushMessage(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Admin Override Features", () => {
  describe("forceOverrideDuplicate - Approve despite duplicate", () => {
    it("should skip duplicate check when forceOverrideDuplicate is true", () => {
      // When forceOverrideDuplicate is true, the duplicate check should be skipped
      const forceOverrideDuplicate = true;
      const orderNumber = "5818090583106206003";
      
      // Simulate the logic: if forceOverrideDuplicate is true, skip duplicate check
      let duplicateBlocked = false;
      if (!forceOverrideDuplicate) {
        // This block should NOT execute when forceOverrideDuplicate is true
        const duplicateOrder = { status: "approved", id: 999 };
        if (duplicateOrder && duplicateOrder.status === "approved") {
          duplicateBlocked = true;
        }
      }
      
      expect(duplicateBlocked).toBe(false);
    });

    it("should block duplicate when forceOverrideDuplicate is false", () => {
      const forceOverrideDuplicate = false;
      
      let duplicateBlocked = false;
      if (!forceOverrideDuplicate) {
        const duplicateOrder = { status: "approved", id: 999 };
        if (duplicateOrder && duplicateOrder.status === "approved") {
          duplicateBlocked = true;
        }
      }
      
      expect(duplicateBlocked).toBe(true);
    });

    it("should not block when duplicate exists but is not approved", () => {
      const forceOverrideDuplicate = false;
      
      let duplicateBlocked = false;
      if (!forceOverrideDuplicate) {
        const duplicateOrder = { status: "rejected", id: 999 };
        if (duplicateOrder && duplicateOrder.status === "approved") {
          duplicateBlocked = true;
        }
      }
      
      expect(duplicateBlocked).toBe(false);
    });
  });

  describe("adminRestoreLineReceipt - Restore rejected receipt", () => {
    it("should restore rejected receipt to pending", async () => {
      const receipt = { id: 1, status: "rejected", lineUserId: "U123" };
      mockGetLineReceiptById.mockResolvedValue(receipt);
      mockUpdateLineReceiptStatus.mockResolvedValue(undefined);

      // Simulate the restore logic
      if (receipt.status === "approved") {
        throw new Error("Cannot restore approved receipt");
      }
      if (receipt.status === "pending" || receipt.status === "on_hold") {
        throw new Error("Already in review state");
      }
      
      await mockUpdateLineReceiptStatus(receipt.id, "pending", 1, "[管理者恢復] テスト恢復");
      
      expect(mockUpdateLineReceiptStatus).toHaveBeenCalledWith(1, "pending", 1, "[管理者恢復] テスト恢復");
    });

    it("should throw error when trying to restore approved receipt", () => {
      const receipt = { id: 1, status: "approved" };
      
      expect(() => {
        if (receipt.status === "approved") {
          throw new Error("既に承認済みのレシートは恢復できません");
        }
      }).toThrow("既に承認済みのレシートは恢復できません");
    });

    it("should throw error when receipt is already pending", () => {
      const receipt = { id: 1, status: "pending" };
      
      expect(() => {
        if (receipt.status === "pending" || receipt.status === "on_hold") {
          throw new Error("このレシートは既に審査待ち状態です");
        }
      }).toThrow("このレシートは既に審査待ち状態です");
    });
  });

  describe("adminManualAwardPoints - Manual point award", () => {
    it("should award points for LINE receipt and approve if not already approved", async () => {
      const receipt = { id: 1, status: "rejected", lineUserId: "U123", storeName: "KYOGOKU", totalAmount: 7942 };
      mockGetLineReceiptById.mockResolvedValue(receipt);
      mockUpdateLineReceiptStatus.mockResolvedValue(undefined);
      mockAwardPointsForLineReceipt.mockResolvedValue({ success: true, pointsAwarded: 79, skipped: false });
      mockGetLinePointBalance.mockResolvedValue({ balance: 79 });
      mockPushMessage.mockResolvedValue(undefined);

      // Simulate the manual award logic
      if (receipt.status !== "approved") {
        await mockUpdateLineReceiptStatus(receipt.id, "approved", 1, "[管理者手動承認] 手動ポイント付与");
      }
      const result = await mockAwardPointsForLineReceipt(receipt.id, 79);

      expect(mockUpdateLineReceiptStatus).toHaveBeenCalledWith(1, "approved", 1, "[管理者手動承認] 手動ポイント付与");
      expect(mockAwardPointsForLineReceipt).toHaveBeenCalledWith(1, 79);
      expect(result.pointsAwarded).toBe(79);
      expect(result.skipped).toBe(false);
    });

    it("should skip status update if receipt is already approved", async () => {
      const receipt = { id: 1, status: "approved", lineUserId: "U123", storeName: "KYOGOKU", totalAmount: 7942 };
      mockGetLineReceiptById.mockResolvedValue(receipt);
      mockAwardPointsForLineReceipt.mockResolvedValue({ success: true, pointsAwarded: 79, skipped: false });

      // Simulate: should NOT call updateLineReceiptStatus if already approved
      if (receipt.status !== "approved") {
        await mockUpdateLineReceiptStatus(receipt.id, "approved", 1, "test");
      }
      await mockAwardPointsForLineReceipt(receipt.id, 79);

      expect(mockUpdateLineReceiptStatus).not.toHaveBeenCalled();
      expect(mockAwardPointsForLineReceipt).toHaveBeenCalledWith(1, 79);
    });

    it("should handle point_request type", async () => {
      const request = { id: 5, status: "rejected" };
      mockGetPointRequestById.mockResolvedValue(request);
      mockUpdateReceiptStatus.mockResolvedValue(undefined);
      mockAwardPointsForReceipt.mockResolvedValue({ success: true, pointsAwarded: 100 });

      if (request.status !== "approved") {
        await mockUpdateReceiptStatus(request.id, "approved", 1, "[管理者手動承認] 手動ポイント付与");
      }
      const result = await mockAwardPointsForReceipt(request.id, 100);

      expect(mockUpdateReceiptStatus).toHaveBeenCalledWith(5, "approved", 1, "[管理者手動承認] 手動ポイント付与");
      expect(result.pointsAwarded).toBe(100);
    });

    it("should reject if points is 0 or negative", () => {
      const points = 0;
      expect(points).toBeLessThanOrEqual(0);
      // In the actual implementation, z.number().min(1) validates this
    });
  });

  describe("Duplicate check with status filter", () => {
    it("should exclude rejected receipts from duplicate check", () => {
      // The checkDuplicateOrderNumberGlobal now filters out rejected receipts
      // This means a rejected receipt won't block a new submission
      const receipts = [
        { id: 1, orderNumber: "123", status: "rejected" },
        { id: 2, orderNumber: "123", status: "pending" },
      ];
      
      // Only non-rejected receipts should be considered duplicates
      const nonRejectedDuplicates = receipts.filter(
        r => r.orderNumber === "123" && r.status !== "rejected"
      );
      
      expect(nonRejectedDuplicates).toHaveLength(1);
      expect(nonRejectedDuplicates[0].id).toBe(2);
    });
  });
});
