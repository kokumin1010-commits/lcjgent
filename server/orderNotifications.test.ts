import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  getMallOrderById: vi.fn(),
}));

vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

vi.mock("./emailService", () => ({
  sendEmail: vi.fn(),
}));

import { getMallOrderById } from "./db";
import { pushMessage } from "./line";
import {
  sendOrderConfirmationNotification,
  sendShippedNotification,
  sendDeliveredNotification,
  sendCancelledNotification,
} from "./orderNotifications";

const mockGetOrderById = vi.mocked(getMallOrderById);
const mockPushMessage = vi.mocked(pushMessage);

// Helper to create mock order data
function createMockOrderDetail(overrides: Record<string, any> = {}) {
  return {
    order: {
      id: 1,
      orderNumber: "ORD-20260214-001",
      status: "paid",
      totalAmount: 5500,
      pointsUsed: 0,
      shippingFee: 500,
      paymentMethod: "stripe",
      shippingName: "田中太郎",
      shippingPhone: "090-1234-5678",
      shippingPostalCode: "100-0001",
      shippingAddress: "東京都千代田区千代田1-1",
      shippingCarrier: null,
      trackingNumber: null,
      adminNotes: null,
      createdAt: new Date("2026-02-14"),
      shippedAt: null,
      deliveredAt: null,
      ...overrides.order,
    },
    lineUser: {
      id: 1,
      lineUserId: "U1234567890abcdef",
      displayName: "田中太郎",
      email: "tanaka@example.com",
      ...overrides.lineUser,
    },
    items: overrides.items || [
      {
        id: 1,
        orderId: 1,
        productId: 10,
        productName: "プレミアムTシャツ",
        quantity: 2,
        unitPrice: 2000,
        pointPrice: 200,
        subtotal: 4000,
      },
      {
        id: 2,
        orderId: 1,
        productId: 11,
        productName: "オーガニックコーヒー",
        quantity: 1,
        unitPrice: 1000,
        pointPrice: 100,
        subtotal: 1000,
      },
    ],
  };
}

describe("Order Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendOrderConfirmationNotification", () => {
    it("should send LINE notification on order confirmation", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      expect(mockGetOrderById).toHaveBeenCalledWith(1);
      expect(mockPushMessage).toHaveBeenCalledWith(
        "U1234567890abcdef",
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("ご注文ありがとうございます"),
          }),
        ])
      );
    });

    it("should include order number in notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ORD-20260214-001");
    });

    it("should include item details in notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("プレミアムTシャツ");
      expect((sentMessage as any).text).toContain("オーガニックコーヒー");
    });

    it("should include total amount in notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("5,500");
    });

    it("should include shipping address in notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("田中太郎");
      expect((sentMessage as any).text).toContain("東京都千代田区千代田1-1");
    });

    it("should include points info when points were used", async () => {
      const mockOrder = createMockOrderDetail({
        order: { pointsUsed: 500 },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ポイント利用");
      expect((sentMessage as any).text).toContain("500");
    });

    it("should not send LINE notification for email-only users", async () => {
      const mockOrder = createMockOrderDetail({
        lineUser: { lineUserId: "email_123", email: "test@example.com" },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);

      await sendOrderConfirmationNotification(1);

      expect(mockPushMessage).not.toHaveBeenCalled();
    });

    it("should handle missing order gracefully", async () => {
      mockGetOrderById.mockResolvedValue(null as any);

      await sendOrderConfirmationNotification(999);

      expect(mockPushMessage).not.toHaveBeenCalled();
    });

    it("should handle missing lineUser gracefully", async () => {
      mockGetOrderById.mockResolvedValue({
        order: { orderNumber: "ORD-001" },
        lineUser: null,
        items: [],
      } as any);

      await sendOrderConfirmationNotification(1);

      expect(mockPushMessage).not.toHaveBeenCalled();
    });
  });

  describe("sendShippedNotification", () => {
    it("should send LINE notification with tracking info on shipment", async () => {
      const mockOrder = createMockOrderDetail({
        order: {
          status: "shipped",
          shippingCarrier: "ヤマト運輸",
          trackingNumber: "1234-5678-9012",
        },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "ヤマト運輸", "1234-5678-9012");

      expect(mockPushMessage).toHaveBeenCalledWith(
        "U1234567890abcdef",
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("商品を発送しました"),
          }),
        ])
      );
    });

    it("should include carrier and tracking number in notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "ヤマト運輸", "1234-5678-9012");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ヤマト運輸");
      expect((sentMessage as any).text).toContain("1234-5678-9012");
    });

    it("should include tracking URL for Yamato", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "ヤマト運輸", "1234-5678-9012");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("kuronekoyamato.co.jp");
    });

    it("should include tracking URL for Sagawa", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "佐川急便", "9876543210");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("sagawa-exp.co.jp");
    });

    it("should include tracking URL for Japan Post", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "日本郵便", "JP1234567890");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("japanpost.jp");
    });

    it("should include item names in shipped notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "ヤマト運輸", "1234");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("プレミアムTシャツ");
      expect((sentMessage as any).text).toContain("オーガニックコーヒー");
    });

    it("should use order's existing shipping info when not provided as params", async () => {
      const mockOrder = createMockOrderDetail({
        order: {
          shippingCarrier: "佐川急便",
          trackingNumber: "SAGAWA-001",
        },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("佐川急便");
      expect((sentMessage as any).text).toContain("SAGAWA-001");
    });
  });

  describe("sendDeliveredNotification", () => {
    it("should send LINE notification on delivery completion", async () => {
      const mockOrder = createMockOrderDetail({
        order: { status: "delivered" },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendDeliveredNotification(1);

      expect(mockPushMessage).toHaveBeenCalledWith(
        "U1234567890abcdef",
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("商品が配達されました"),
          }),
        ])
      );
    });

    it("should include order number in delivered notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendDeliveredNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ORD-20260214-001");
    });

    it("should include thank you message in delivered notification", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendDeliveredNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ご利用ありがとうございました");
    });
  });

  describe("sendCancelledNotification", () => {
    it("should send LINE notification on order cancellation", async () => {
      const mockOrder = createMockOrderDetail({
        order: { status: "cancelled" },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendCancelledNotification(1, "お客様のご要望");

      expect(mockPushMessage).toHaveBeenCalledWith(
        "U1234567890abcdef",
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("注文がキャンセルされました"),
          }),
        ])
      );
    });

    it("should include cancellation reason when provided", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendCancelledNotification(1, "在庫切れのため");

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("在庫切れのため");
    });

    it("should include refund info for stripe payments", async () => {
      const mockOrder = createMockOrderDetail({
        order: { paymentMethod: "stripe" },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendCancelledNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("クレジットカード");
      expect((sentMessage as any).text).toContain("返金");
    });

    it("should include points refund info for points payments", async () => {
      const mockOrder = createMockOrderDetail({
        order: { paymentMethod: "points" },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendCancelledNotification(1);

      const sentMessage = mockPushMessage.mock.calls[0][1][0];
      expect((sentMessage as any).text).toContain("ポイント");
      expect((sentMessage as any).text).toContain("返還");
    });
  });

  describe("Error handling", () => {
    it("should not throw when pushMessage fails", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(false);

      await expect(sendOrderConfirmationNotification(1)).resolves.not.toThrow();
    });

    it("should not throw when getMallOrderById throws", async () => {
      mockGetOrderById.mockRejectedValue(new Error("DB error"));

      await expect(sendShippedNotification(1)).resolves.not.toThrow();
    });

    it("should not throw when getMallOrderById returns null for shipped", async () => {
      mockGetOrderById.mockResolvedValue(null as any);

      await expect(sendShippedNotification(1)).resolves.not.toThrow();
      expect(mockPushMessage).not.toHaveBeenCalled();
    });

    it("should not throw when getMallOrderById returns null for delivered", async () => {
      mockGetOrderById.mockResolvedValue(null as any);

      await expect(sendDeliveredNotification(1)).resolves.not.toThrow();
      expect(mockPushMessage).not.toHaveBeenCalled();
    });

    it("should not throw when getMallOrderById returns null for cancelled", async () => {
      mockGetOrderById.mockResolvedValue(null as any);

      await expect(sendCancelledNotification(1)).resolves.not.toThrow();
      expect(mockPushMessage).not.toHaveBeenCalled();
    });
  });
});
