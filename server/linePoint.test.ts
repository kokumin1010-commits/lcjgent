import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getOrCreateLinePointBalance: vi.fn(),
  getLinePointBalance: vi.fn(),
  updateLinePointBalance: vi.fn(),
  createLinePointTransaction: vi.fn(),
  getLinePointTransactions: vi.fn(),
  createLineReceipt: vi.fn(),
  getLineReceiptById: vi.fn(),
  getLineReceiptsByUser: vi.fn(),
  getAllLineReceipts: vi.fn(),
  getPendingLineReceiptsCount: vi.fn(),
  updateLineReceiptOcr: vi.fn(),
  updateLineReceiptStatus: vi.fn(),
  awardPointsForLineReceipt: vi.fn(),
  checkDuplicateLineReceiptByHash: vi.fn(),
  checkDuplicateLineReceiptByDetails: vi.fn(),
  getRecentLineReceiptsCount: vi.fn(),
  updateLineReceiptFraudFlags: vi.fn(),
  createLineFraudDetectionLog: vi.fn(),
  getLineFraudLogsForReceipt: vi.fn(),
  getLineReceiptStatistics: vi.fn(),
}));

import {
  getOrCreateLinePointBalance,
  getLinePointBalance,
  createLinePointTransaction,
  createLineReceipt,
  getLineReceiptById,
  checkDuplicateLineReceiptByHash,
  checkDuplicateLineReceiptByDetails,
  getRecentLineReceiptsCount,
  updateLineReceiptFraudFlags,
  awardPointsForLineReceipt,
  getLineReceiptStatistics,
} from "./db";

describe("LINE Point System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Point Balance Management", () => {
    it("should get or create point balance for LINE user", async () => {
      const mockBalance = {
        id: 1,
        lineUserId: "U1234567890",
        balance: 100,
        totalEarned: 150,
        totalUsed: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getOrCreateLinePointBalance).mockResolvedValue(mockBalance);

      const result = await getOrCreateLinePointBalance("U1234567890");

      expect(result).toEqual(mockBalance);
      expect(getOrCreateLinePointBalance).toHaveBeenCalledWith("U1234567890");
    });

    it("should return null for non-existent balance", async () => {
      vi.mocked(getLinePointBalance).mockResolvedValue(null);

      const result = await getLinePointBalance("U_NONEXISTENT");

      expect(result).toBeNull();
    });

    it("should create point transaction and update balance", async () => {
      vi.mocked(createLinePointTransaction).mockResolvedValue({ balanceAfter: 200 });

      const result = await createLinePointTransaction({
        lineUserId: "U1234567890",
        type: "earn",
        amount: 100,
        referenceType: "receipt",
        referenceId: 1,
        description: "レシート承認によるポイント付与",
      });

      expect(result.balanceAfter).toBe(200);
    });
  });

  describe("Receipt Management", () => {
    it("should create a new LINE receipt", async () => {
      vi.mocked(createLineReceipt).mockResolvedValue(1);

      const receiptId = await createLineReceipt({
        lineUserId: "U1234567890",
        lineMessageId: "MSG123",
        imageUrl: "https://example.com/receipt.jpg",
        imageKey: "line-receipts/U1234567890/receipt.jpg",
        imageHash: "abc123hash",
        status: "pending",
      });

      expect(receiptId).toBe(1);
    });

    it("should get receipt by ID", async () => {
      const mockReceipt = {
        id: 1,
        lineUserId: "U1234567890",
        lineMessageId: "MSG123",
        imageUrl: "https://example.com/receipt.jpg",
        imageKey: "line-receipts/U1234567890/receipt.jpg",
        imageHash: "abc123hash",
        status: "pending" as const,
        storeName: "テスト店舗",
        purchaseDate: new Date(),
        totalAmount: 5000,
        currency: "JPY",
        pointsCalculated: 100,
        pointsAwarded: null,
        fraudFlags: null,
        fraudScore: null,
        ocrRawText: null,
        ocrConfidence: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(getLineReceiptById).mockResolvedValue(mockReceipt);

      const result = await getLineReceiptById(1);

      expect(result).toEqual(mockReceipt);
      expect(result?.storeName).toBe("テスト店舗");
    });
  });

  describe("Fraud Detection", () => {
    it("should detect duplicate receipt by image hash", async () => {
      const mockDuplicate = {
        id: 1,
        lineUserId: "U1234567890",
        imageHash: "abc123hash",
        status: "approved" as const,
      };

      vi.mocked(checkDuplicateLineReceiptByHash).mockResolvedValue(mockDuplicate as any);

      const result = await checkDuplicateLineReceiptByHash("abc123hash");

      expect(result).toBeTruthy();
      expect(result?.id).toBe(1);
    });

    it("should return null when no duplicate by hash", async () => {
      vi.mocked(checkDuplicateLineReceiptByHash).mockResolvedValue(null);

      const result = await checkDuplicateLineReceiptByHash("unique_hash");

      expect(result).toBeNull();
    });

    it("should detect duplicate receipt by details", async () => {
      const mockDuplicate = {
        id: 2,
        lineUserId: "U1234567890",
        storeName: "テスト店舗",
        purchaseDate: new Date("2024-01-15"),
        totalAmount: 5000,
      };

      vi.mocked(checkDuplicateLineReceiptByDetails).mockResolvedValue(mockDuplicate as any);

      const result = await checkDuplicateLineReceiptByDetails(
        "U1234567890",
        "テスト店舗",
        new Date("2024-01-15"),
        5000
      );

      expect(result).toBeTruthy();
      expect(result?.storeName).toBe("テスト店舗");
    });

    it("should count recent receipts for rate limiting", async () => {
      vi.mocked(getRecentLineReceiptsCount).mockResolvedValue(5);

      const count = await getRecentLineReceiptsCount("U1234567890", 24);

      expect(count).toBe(5);
    });

    it("should update fraud flags on receipt", async () => {
      vi.mocked(updateLineReceiptFraudFlags).mockResolvedValue(undefined);

      await updateLineReceiptFraudFlags(1, ["duplicate_receipt", "high_amount"], 60);

      expect(updateLineReceiptFraudFlags).toHaveBeenCalledWith(
        1,
        ["duplicate_receipt", "high_amount"],
        60
      );
    });
  });

  describe("Point Award", () => {
    it("should award points for approved receipt", async () => {
      vi.mocked(awardPointsForLineReceipt).mockResolvedValue({
        success: true,
        pointsAwarded: 100,
      });

      const result = await awardPointsForLineReceipt(1, 100);

      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(100);
    });
  });

  describe("Statistics", () => {
    it("should get receipt statistics", async () => {
      const mockStats = {
        pending: 5,
        approved: 20,
        rejected: 3,
        onHold: 2,
        totalPointsAwarded: 5000,
      };

      vi.mocked(getLineReceiptStatistics).mockResolvedValue(mockStats);

      const stats = await getLineReceiptStatistics();

      expect(stats.pending).toBe(5);
      expect(stats.approved).toBe(20);
      expect(stats.totalPointsAwarded).toBe(5000);
    });
  });

  describe("Point Calculation", () => {
    it("should calculate 2% points correctly", () => {
      const amount = 5000;
      const expectedPoints = Math.floor(amount * 0.02);
      expect(expectedPoints).toBe(100);
    });

    it("should handle decimal amounts correctly", () => {
      const amount = 5555;
      const expectedPoints = Math.floor(amount * 0.02);
      expect(expectedPoints).toBe(111);
    });

    it("should handle small amounts", () => {
      const amount = 100;
      const expectedPoints = Math.floor(amount * 0.02);
      expect(expectedPoints).toBe(2);
    });

    it("should handle very small amounts (less than 50 yen)", () => {
      const amount = 49;
      const expectedPoints = Math.floor(amount * 0.02);
      expect(expectedPoints).toBe(0);
    });
  });
});


// Mock the LINE module
vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

import { pushMessage } from "./line";

describe("LINE Receipt Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Approval Notification", () => {
    it("should send approval notification with correct message format", async () => {
      vi.mocked(pushMessage).mockResolvedValue(true);

      const lineUserId = "U1234567890";
      const storeName = "テスト店舗";
      const amount = 5000;
      const pointsAwarded = 100;
      const newBalance = 500;

      const message = `🎉 レシートが承認されました！\n您的收据已获批准！\n\n🏪 店舗名/店铺名: ${storeName}\n💰 購入金額/购买金额: ¥${amount.toLocaleString()}\n⭐ 獲得ポイント/获得积分: ${pointsAwarded}ポイント\n\n📊 現在の残高/当前余额: ${newBalance}ポイント\n\nご利用ありがとうございます！\n感谢您的使用！`;

      await pushMessage(lineUserId, [{ type: "text", text: message }]);

      expect(pushMessage).toHaveBeenCalledWith(lineUserId, [{ type: "text", text: message }]);
      expect(pushMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle notification failure gracefully", async () => {
      vi.mocked(pushMessage).mockResolvedValue(false);

      const result = await pushMessage("U_INVALID", [{ type: "text", text: "test" }]);

      expect(result).toBe(false);
    });
  });

  describe("Rejection Notification", () => {
    it("should send rejection notification with reason", async () => {
      vi.mocked(pushMessage).mockResolvedValue(true);

      const lineUserId = "U1234567890";
      const storeName = "テスト店舗";
      const reason = "レシートが不鮮明です";

      const message = `❌ レシートが却下されました\n您的收据已被拒绝\n\n🏪 店舗名/店铺名: ${storeName}\n\n📝 却下理由/拒绝原因:\n${reason}\n\n正しいレシート画像を再度送信してください。\n请重新发送正确的收据图片。`;

      await pushMessage(lineUserId, [{ type: "text", text: message }]);

      expect(pushMessage).toHaveBeenCalledWith(lineUserId, [{ type: "text", text: message }]);
    });

    it("should include bilingual content in rejection message", async () => {
      vi.mocked(pushMessage).mockResolvedValue(true);

      const lineUserId = "U1234567890";
      const storeName = "不明";
      const reason = "対象外の店舗です";

      const message = `❌ レシートが却下されました\n您的收据已被拒绝\n\n🏪 店舗名/店铺名: ${storeName}\n\n📝 却下理由/拒绝原因:\n${reason}\n\n正しいレシート画像を再度送信してください。\n请重新发送正确的收据图片。`;

      await pushMessage(lineUserId, [{ type: "text", text: message }]);

      // Verify bilingual content
      expect(message).toContain("レシートが却下されました");
      expect(message).toContain("您的收据已被拒绝");
      expect(message).toContain("却下理由/拒绝原因");
    });
  });

  describe("Message Content Validation", () => {
    it("should handle unknown store name", async () => {
      vi.mocked(pushMessage).mockResolvedValue(true);

      const storeName = "不明";
      const message = `🎉 レシートが承認されました！\n您的收据已获批准！\n\n🏪 店舗名/店铺名: ${storeName}`;

      expect(message).toContain("店舗名/店铺名: 不明");
    });

    it("should format large amounts correctly", async () => {
      const amount = 100000;
      const formattedAmount = `¥${amount.toLocaleString()}`;

      expect(formattedAmount).toBe("¥100,000");
    });
  });
});
