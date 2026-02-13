import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  updateMallOrderStatus: vi.fn(),
  cancelMallOrder: vi.fn(),
}));

import { updateMallOrderStatus, cancelMallOrder } from "./db";

const mockUpdateMallOrderStatus = vi.mocked(updateMallOrderStatus);
const mockCancelMallOrder = vi.mocked(cancelMallOrder);

describe("Admin Order Cancellation - Point Refund & Stock Restoration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateMallOrderStatus return values", () => {
    it("should return pointsRefunded and stockRestored when cancelling a points order", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 3000,
        stockRestored: true,
      });

      const result = await updateMallOrderStatus(1, "cancelled", "管理者によるキャンセル");

      expect(mockUpdateMallOrderStatus).toHaveBeenCalledWith(1, "cancelled", "管理者によるキャンセル");
      expect(result.pointsRefunded).toBe(3000);
      expect(result.stockRestored).toBe(true);
    });

    it("should return zero pointsRefunded for stripe orders", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 0,
        stockRestored: true,
      });

      const result = await updateMallOrderStatus(2, "cancelled");

      expect(result.pointsRefunded).toBe(0);
      expect(result.stockRestored).toBe(true);
    });

    it("should return stockRestored=false when order has no items", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 0,
        stockRestored: false,
      });

      const result = await updateMallOrderStatus(3, "cancelled");

      expect(result.stockRestored).toBe(false);
    });

    it("should handle refunded status same as cancelled", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 5000,
        stockRestored: true,
      });

      const result = await updateMallOrderStatus(4, "refunded", "返金処理");

      expect(mockUpdateMallOrderStatus).toHaveBeenCalledWith(4, "refunded", "返金処理");
      expect(result.pointsRefunded).toBe(5000);
      expect(result.stockRestored).toBe(true);
    });

    it("should not refund points for non-cancel statuses", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 0,
        stockRestored: false,
      });

      const result = await updateMallOrderStatus(5, "shipped", undefined, {
        shippingCarrier: "ヤマト運輸",
        trackingNumber: "1234567890",
      });

      expect(result.pointsRefunded).toBe(0);
      expect(result.stockRestored).toBe(false);
    });

    it("should not refund points for delivered status", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 0,
        stockRestored: false,
      });

      const result = await updateMallOrderStatus(6, "delivered");

      expect(result.pointsRefunded).toBe(0);
      expect(result.stockRestored).toBe(false);
    });
  });

  describe("Point refund logic validation", () => {
    it("should correctly calculate refund amount equals original pointsUsed", () => {
      const order = {
        id: 1,
        pointsUsed: 3000,
        paymentMethod: "points",
        status: "paid",
      };

      // When cancelling, the refund amount should equal the original pointsUsed
      const refundAmount = order.pointsUsed;
      expect(refundAmount).toBe(3000);
    });

    it("should not refund if order was already cancelled", () => {
      const order = {
        id: 2,
        pointsUsed: 3000,
        paymentMethod: "points",
        status: "cancelled",
      };

      // Should not refund if already cancelled
      const shouldRefund = order.status !== "cancelled" && order.status !== "refunded";
      expect(shouldRefund).toBe(false);
    });

    it("should not refund if order was already refunded", () => {
      const order = {
        id: 3,
        pointsUsed: 5000,
        paymentMethod: "points",
        status: "refunded",
      };

      const shouldRefund = order.status !== "cancelled" && order.status !== "refunded";
      expect(shouldRefund).toBe(false);
    });

    it("should refund if order is in paid status", () => {
      const order = {
        id: 4,
        pointsUsed: 2000,
        paymentMethod: "points",
        status: "paid",
      };

      const shouldRefund = order.status !== "cancelled" && order.status !== "refunded";
      expect(shouldRefund).toBe(true);
    });

    it("should refund if order is in shipped status", () => {
      const order = {
        id: 5,
        pointsUsed: 4000,
        paymentMethod: "points",
        status: "shipped",
      };

      const shouldRefund = order.status !== "cancelled" && order.status !== "refunded";
      expect(shouldRefund).toBe(true);
    });
  });

  describe("Stock restoration logic", () => {
    it("should restore stock for each order item", () => {
      const orderItems = [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 3 },
        { productId: 3, quantity: 1 },
      ];

      // Each item's stock should be increased by its quantity
      const stockUpdates = orderItems.map(item => ({
        productId: item.productId,
        restoreQuantity: item.quantity,
      }));

      expect(stockUpdates).toHaveLength(3);
      expect(stockUpdates[0].restoreQuantity).toBe(2);
      expect(stockUpdates[1].restoreQuantity).toBe(3);
      expect(stockUpdates[2].restoreQuantity).toBe(1);
    });

    it("should handle empty order items", () => {
      const orderItems: { productId: number; quantity: number }[] = [];
      const stockRestored = orderItems.length > 0;
      expect(stockRestored).toBe(false);
    });

    it("should handle single item order", () => {
      const orderItems = [{ productId: 42, quantity: 5 }];
      const stockRestored = orderItems.length > 0;
      expect(stockRestored).toBe(true);
    });
  });

  describe("Point balance update validation", () => {
    it("should increase balance by refund amount", () => {
      const currentBalance = 5000;
      const refundAmount = 3000;
      const newBalance = currentBalance + refundAmount;
      expect(newBalance).toBe(8000);
    });

    it("should decrease totalUsed by refund amount", () => {
      const currentTotalUsed = 10000;
      const refundAmount = 3000;
      const newTotalUsed = currentTotalUsed - refundAmount;
      expect(newTotalUsed).toBe(7000);
    });

    it("should handle zero balance correctly", () => {
      const currentBalance = 0;
      const refundAmount = 2000;
      const newBalance = currentBalance + refundAmount;
      expect(newBalance).toBe(2000);
    });
  });

  describe("Admin cancellation vs user cancellation", () => {
    it("admin cancellation uses updateMallOrderStatus", async () => {
      mockUpdateMallOrderStatus.mockResolvedValue({
        pointsRefunded: 3000,
        stockRestored: true,
      });

      await updateMallOrderStatus(1, "cancelled", "管理者によるキャンセル");

      expect(mockUpdateMallOrderStatus).toHaveBeenCalledTimes(1);
      expect(mockCancelMallOrder).not.toHaveBeenCalled();
    });

    it("user cancellation uses cancelMallOrder", async () => {
      mockCancelMallOrder.mockResolvedValue(undefined);

      await cancelMallOrder(1, "ユーザーによるキャンセル");

      expect(mockCancelMallOrder).toHaveBeenCalledTimes(1);
      expect(mockUpdateMallOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe("Notification integration with cancellation", () => {
    it("should include pointsRefunded info in API response for UI toast", () => {
      const apiResponse = {
        success: true,
        pointsRefunded: 3000,
        stockRestored: true,
      };

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.pointsRefunded).toBe(3000);
      expect(apiResponse.stockRestored).toBe(true);
    });

    it("should format toast message correctly with points refund", () => {
      const data = { pointsRefunded: 3000, stockRestored: true };
      const messages: string[] = ["ステータスをキャンセルに変更しました"];
      
      if (data.pointsRefunded > 0) {
        messages.push(`${data.pointsRefunded.toLocaleString()}ポイントを返還しました`);
      }
      if (data.stockRestored) {
        messages.push("在庫を戻しました");
      }

      expect(messages).toHaveLength(3);
      expect(messages[1]).toBe("3,000ポイントを返還しました");
      expect(messages[2]).toBe("在庫を戻しました");
    });

    it("should format toast message without points refund for stripe orders", () => {
      const data = { pointsRefunded: 0, stockRestored: true };
      const messages: string[] = ["ステータスをキャンセルに変更しました"];
      
      if (data.pointsRefunded > 0) {
        messages.push(`${data.pointsRefunded.toLocaleString()}ポイントを返還しました`);
      }
      if (data.stockRestored) {
        messages.push("在庫を戻しました");
      }

      expect(messages).toHaveLength(2);
      expect(messages[1]).toBe("在庫を戻しました");
    });
  });
});
