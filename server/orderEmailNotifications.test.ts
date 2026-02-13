import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  getMallOrderById: vi.fn(),
}));

vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

vi.mock("./emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { getMallOrderById } from "./db";
import { pushMessage } from "./line";
import { sendEmail } from "./emailService";
import {
  sendOrderConfirmationNotification,
  sendShippedNotification,
  sendDeliveredNotification,
  sendCancelledNotification,
} from "./orderNotifications";
import {
  buildOrderConfirmationHtml,
  buildShippedHtml,
  buildDeliveredHtml,
  buildCancelledHtml,
} from "./orderEmailTemplates";

const mockGetOrderById = vi.mocked(getMallOrderById);
const mockPushMessage = vi.mocked(pushMessage);
const mockSendEmail = vi.mocked(sendEmail);

function createMockOrderDetail(overrides: Record<string, any> = {}) {
  return {
    order: {
      id: 1,
      orderNumber: "ORD-20260214-001",
      status: "paid",
      totalAmount: 5500,
      pointsUsed: 0,
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
      cancelReason: null,
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

describe("Order Email Templates (HTML)", () => {
  describe("buildOrderConfirmationHtml", () => {
    it("should generate valid HTML with order details", () => {
      const html = buildOrderConfirmationHtml("田中太郎", {
        orderNumber: "ORD-001",
        totalAmount: 5500,
        pointsUsed: 0,
        shippingFee: 500,
        paymentMethod: "stripe",
        shippingName: "田中太郎",
        shippingPostalCode: "100-0001",
        shippingAddress: "東京都千代田区千代田1-1",
      }, [
        { productName: "Tシャツ", quantity: 2, unitPrice: 2000, subtotal: 4000 },
        { productName: "コーヒー", quantity: 1, unitPrice: 1000, subtotal: 1000 },
      ]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-001");
      expect(html).toContain("田中太郎");
      expect(html).toContain("Tシャツ");
      expect(html).toContain("コーヒー");
      expect(html).toContain("5,500");
    });

    it("should include points info when points were used", () => {
      const html = buildOrderConfirmationHtml("テスト", {
        orderNumber: "ORD-002",
        totalAmount: 3000,
        pointsUsed: 500,
        paymentMethod: "points",
      }, [{ productName: "商品A", quantity: 1, unitPrice: 3000, subtotal: 3000 }]);

      expect(html).toContain("500");
      expect(html).toContain("ポイント");
    });

    it("should include shipping address when provided", () => {
      const html = buildOrderConfirmationHtml("テスト", {
        orderNumber: "ORD-003",
        totalAmount: 1000,
        shippingName: "山田花子",
        shippingPostalCode: "150-0001",
        shippingAddress: "東京都渋谷区神宮前1-1",
      }, [{ productName: "商品B", quantity: 1 }]);

      expect(html).toContain("山田花子");
      expect(html).toContain("150-0001");
      expect(html).toContain("渋谷区神宮前");
    });
  });

  describe("buildShippedHtml", () => {
    it("should generate HTML with tracking info", () => {
      const html = buildShippedHtml("田中太郎", {
        orderNumber: "ORD-001",
        totalAmount: 5500,
      }, [
        { productName: "Tシャツ", quantity: 2 },
      ], "ヤマト運輸", "1234-5678-9012");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-001");
      expect(html).toContain("Tシャツ");
      expect(html).toContain("ヤマト運輸");
      expect(html).toContain("1234-5678-9012");
      expect(html).toContain("kuronekoyamato.co.jp");
    });

    it("should generate HTML for Sagawa tracking", () => {
      const html = buildShippedHtml("テスト", {
        orderNumber: "ORD-002",
        totalAmount: 3000,
      }, [{ productName: "商品A", quantity: 1 }], "佐川急便", "9876543210");

      expect(html).toContain("佐川急便");
      expect(html).toContain("sagawa-exp.co.jp");
    });

    it("should handle missing tracking info gracefully", () => {
      const html = buildShippedHtml("テスト", {
        orderNumber: "ORD-003",
        totalAmount: 1000,
      }, [{ productName: "商品B", quantity: 1 }]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-003");
    });
  });

  describe("buildDeliveredHtml", () => {
    it("should generate HTML with delivery confirmation", () => {
      const html = buildDeliveredHtml("田中太郎", {
        orderNumber: "ORD-001",
        totalAmount: 5500,
      }, [
        { productName: "Tシャツ", quantity: 2 },
        { productName: "コーヒー", quantity: 1 },
      ]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-001");
      expect(html).toContain("Tシャツ");
      expect(html).toContain("コーヒー");
      expect(html).toContain("配達");
    });
  });

  describe("buildCancelledHtml", () => {
    it("should generate HTML with cancellation details", () => {
      const html = buildCancelledHtml("田中太郎", {
        orderNumber: "ORD-001",
        totalAmount: 5500,
        paymentMethod: "stripe",
      }, [
        { productName: "Tシャツ", quantity: 2 },
      ], "在庫切れのため");

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-001");
      expect(html).toContain("在庫切れのため");
      expect(html).toContain("返金");
    });

    it("should include points refund info for points payments", () => {
      const html = buildCancelledHtml("テスト", {
        orderNumber: "ORD-002",
        totalAmount: 3000,
        paymentMethod: "points",
      }, [{ productName: "商品A", quantity: 1 }]);

      expect(html).toContain("ポイント");
    });

    it("should handle missing reason gracefully", () => {
      const html = buildCancelledHtml("テスト", {
        orderNumber: "ORD-003",
        totalAmount: 1000,
        paymentMethod: "stripe",
      }, [{ productName: "商品B", quantity: 1 }]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ORD-003");
    });
  });
});

describe("Order Notifications - HTML Email Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendOrderConfirmationNotification - email", () => {
    it("should send HTML email when user has email", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["tanaka@example.com"],
          subject: expect.stringContaining("ご注文確認"),
          html: expect.stringContaining("<!DOCTYPE html>"),
        })
      );
    });

    it("should include order number in HTML email", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain("ORD-20260214-001");
    });

    it("should include product names in HTML email", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain("プレミアムTシャツ");
      expect(emailCall.html).toContain("オーガニックコーヒー");
    });

    it("should not send email when user has no email", async () => {
      const mockOrder = createMockOrderDetail({
        lineUser: { email: null },
      });
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should send both LINE and email when both are available", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      expect(mockPushMessage).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("should include plaintext fallback in email", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendOrderConfirmationNotification(1);

      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.content).toBeTruthy();
      expect(emailCall.content).toContain("ご注文ありがとうございます");
    });
  });

  describe("sendShippedNotification - email", () => {
    it("should send HTML email with tracking info", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendShippedNotification(1, "ヤマト運輸", "1234-5678-9012");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["tanaka@example.com"],
          subject: expect.stringContaining("商品発送"),
          html: expect.stringContaining("<!DOCTYPE html>"),
        })
      );

      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain("ヤマト運輸");
      expect(emailCall.html).toContain("1234-5678-9012");
    });
  });

  describe("sendDeliveredNotification - email", () => {
    it("should send HTML email on delivery", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendDeliveredNotification(1);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["tanaka@example.com"],
          subject: expect.stringContaining("配達完了"),
          html: expect.stringContaining("<!DOCTYPE html>"),
        })
      );
    });
  });

  describe("sendCancelledNotification - email", () => {
    it("should send HTML email on cancellation", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);

      await sendCancelledNotification(1, "在庫切れ");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["tanaka@example.com"],
          subject: expect.stringContaining("キャンセル"),
          html: expect.stringContaining("<!DOCTYPE html>"),
        })
      );

      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.html).toContain("在庫切れ");
    });
  });

  describe("Email error handling", () => {
    it("should not throw when email sending fails", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);
      mockSendEmail.mockRejectedValue(new Error("SMTP error"));

      await expect(sendOrderConfirmationNotification(1)).resolves.not.toThrow();
    });

    it("should still send LINE even if email fails", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(true);
      mockSendEmail.mockRejectedValue(new Error("SMTP error"));

      await sendShippedNotification(1, "ヤマト運輸", "1234");

      expect(mockPushMessage).toHaveBeenCalled();
    });

    it("should still send email even if LINE fails", async () => {
      const mockOrder = createMockOrderDetail();
      mockGetOrderById.mockResolvedValue(mockOrder as any);
      mockPushMessage.mockResolvedValue(false);

      await sendDeliveredNotification(1);

      expect(mockSendEmail).toHaveBeenCalled();
    });
  });
});
