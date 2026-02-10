import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getMallOrderById: vi.fn(),
  getMallOrderByStripeSessionId: vi.fn(),
  updateMallOrderStripeInfo: vi.fn(),
  getLineUserById: vi.fn(),
}));

// Mock the line module
vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

import { sendOrderConfirmationLine } from "./stripeWebhook";
import { getMallOrderById } from "./db";
import { pushMessage } from "./line";

describe("LINE Order Confirmation Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send LINE message with order details on payment completion", async () => {
    const mockOrderDetail = {
      order: {
        id: 1,
        orderNumber: "LCJ202602105TEST",
        lineUserId: 100,
        status: "paid",
        totalAmount: 1463,
        pointsUsed: 0,
        cashAmount: 1463,
        paymentMethod: "stripe",
      },
      lineUser: {
        id: 100,
        lineUserId: "U1234567890abcdef",
        displayName: "テストユーザー",
      },
      items: [
        {
          id: 1,
          orderId: 1,
          productId: 10,
          productName: "テスト商品A",
          productPrice: 980,
          quantity: 1,
          subtotal: 980,
        },
        {
          id: 2,
          orderId: 1,
          productId: 11,
          productName: "テスト商品B",
          productPrice: 483,
          quantity: 1,
          subtotal: 483,
        },
      ],
    };

    (getMallOrderById as any).mockResolvedValue(mockOrderDetail);
    (pushMessage as any).mockResolvedValue(true);

    await sendOrderConfirmationLine(1);

    // pushMessage が正しいLINE User IDで呼ばれたか
    expect(pushMessage).toHaveBeenCalledTimes(1);
    expect(pushMessage).toHaveBeenCalledWith(
      "U1234567890abcdef",
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("LCJ202602105TEST"),
        }),
      ])
    );

    // メッセージに注文情報が含まれているか
    const sentMessage = (pushMessage as any).mock.calls[0][1][0].text;
    expect(sentMessage).toContain("ご注文ありがとうございます");
    expect(sentMessage).toContain("LCJ202602105TEST");
    expect(sentMessage).toContain("テスト商品A");
    expect(sentMessage).toContain("テスト商品B");
    expect(sentMessage).toContain("1,463");
  }, 10000);

  it("should include points info when points are used", async () => {
    const mockOrderDetail = {
      order: {
        id: 2,
        orderNumber: "LCJ202602106POINT",
        lineUserId: 101,
        status: "paid",
        totalAmount: 500,
        pointsUsed: 200,
        cashAmount: 300,
        paymentMethod: "stripe",
      },
      lineUser: {
        id: 101,
        lineUserId: "U9876543210abcdef",
        displayName: "ポイントユーザー",
      },
      items: [
        {
          id: 3,
          orderId: 2,
          productId: 12,
          productName: "ポイント併用商品",
          productPrice: 500,
          quantity: 1,
          subtotal: 500,
        },
      ],
    };

    (getMallOrderById as any).mockResolvedValue(mockOrderDetail);
    (pushMessage as any).mockResolvedValue(true);

    await sendOrderConfirmationLine(2);

    const sentMessage = (pushMessage as any).mock.calls[0][1][0].text;
    expect(sentMessage).toContain("ポイント利用: 200pt");
  }, 10000);

  it("should not send LINE message if order not found", async () => {
    (getMallOrderById as any).mockResolvedValue(undefined);

    await sendOrderConfirmationLine(999);

    expect(pushMessage).not.toHaveBeenCalled();
  }, 10000);

  it("should not send LINE message if lineUser has no lineUserId", async () => {
    const mockOrderDetail = {
      order: {
        id: 3,
        orderNumber: "LCJ202602107NOLINE",
        lineUserId: 102,
        status: "paid",
        totalAmount: 1000,
        pointsUsed: 0,
        cashAmount: 1000,
        paymentMethod: "stripe",
      },
      lineUser: {
        id: 102,
        lineUserId: null, // メールのみのユーザー
        displayName: "メールユーザー",
      },
      items: [
        {
          id: 4,
          orderId: 3,
          productId: 13,
          productName: "テスト商品C",
          productPrice: 1000,
          quantity: 1,
          subtotal: 1000,
        },
      ],
    };

    (getMallOrderById as any).mockResolvedValue(mockOrderDetail);

    await sendOrderConfirmationLine(3);

    expect(pushMessage).not.toHaveBeenCalled();
  }, 10000);

  it("should handle pushMessage failure gracefully", async () => {
    const mockOrderDetail = {
      order: {
        id: 4,
        orderNumber: "LCJ202602108FAIL",
        lineUserId: 103,
        status: "paid",
        totalAmount: 2000,
        pointsUsed: 0,
        cashAmount: 2000,
        paymentMethod: "stripe",
      },
      lineUser: {
        id: 103,
        lineUserId: "Ufailtest123",
        displayName: "失敗テストユーザー",
      },
      items: [
        {
          id: 5,
          orderId: 4,
          productId: 14,
          productName: "テスト商品D",
          productPrice: 2000,
          quantity: 1,
          subtotal: 2000,
        },
      ],
    };

    (getMallOrderById as any).mockResolvedValue(mockOrderDetail);
    (pushMessage as any).mockResolvedValue(false);

    // Should not throw even if pushMessage fails
    await expect(sendOrderConfirmationLine(4)).resolves.not.toThrow();
    expect(pushMessage).toHaveBeenCalledTimes(1);
  }, 10000);
});
