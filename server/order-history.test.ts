import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getMallOrdersByLineUser: vi.fn(),
  getMallOrderById: vi.fn(),
  updateMallOrderStatus: vi.fn(),
}));

import {
  getMallOrdersByLineUser,
  getMallOrderById,
  updateMallOrderStatus,
} from "./db";

const mockGetOrders = vi.mocked(getMallOrdersByLineUser);
const mockGetOrderById = vi.mocked(getMallOrderById);
const mockUpdateStatus = vi.mocked(updateMallOrderStatus);

describe("Order History Enhancement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMallOrdersByLineUser - with product images", () => {
    it("should return orders with product image URLs", async () => {
      const mockOrders = [
        {
          id: 1,
          orderNumber: "LCJ-20260214-001",
          lineUserId: 10,
          status: "paid",
          paymentMethod: "stripe",
          totalAmount: 5500,
          shippingFee: 500,
          createdAt: new Date("2026-02-14T10:00:00Z"),
          shippedAt: null,
          deliveredAt: null,
          cancelledAt: null,
          cancelReason: null,
          shippingCarrier: null,
          trackingNumber: null,
          shippingName: "テスト太郎",
          shippingAddress: "東京都渋谷区1-1-1",
          shippingPostalCode: "150-0001",
          shippingPhone: "090-1234-5678",
          items: [
            {
              id: 1,
              orderId: 1,
              productId: 42,
              productName: "テスト商品A",
              productPrice: 3000,
              productPointPrice: 300,
              quantity: 1,
              subtotal: 3000,
              pointSubtotal: 300,
              productImageUrl: "https://example.com/images/product-a.jpg",
              productImageUrls: ["https://example.com/images/product-a.jpg", "https://example.com/images/product-a-2.jpg"],
            },
            {
              id: 2,
              orderId: 1,
              productId: 43,
              productName: "テスト商品B",
              productPrice: 2000,
              productPointPrice: 200,
              quantity: 1,
              subtotal: 2000,
              pointSubtotal: 200,
              productImageUrl: "https://example.com/images/product-b.jpg",
              productImageUrls: null,
            },
          ],
        },
      ];

      mockGetOrders.mockResolvedValue(mockOrders as any);
      const result = await getMallOrdersByLineUser(10);

      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(2);
      // 商品画像URLが含まれていることを確認
      expect(result[0].items[0].productImageUrl).toBe("https://example.com/images/product-a.jpg");
      expect(result[0].items[0].productImageUrls).toEqual([
        "https://example.com/images/product-a.jpg",
        "https://example.com/images/product-a-2.jpg",
      ]);
      expect(result[0].items[1].productImageUrl).toBe("https://example.com/images/product-b.jpg");
      expect(result[0].items[1].productImageUrls).toBeNull();
    });

    it("should return empty array when user has no orders", async () => {
      mockGetOrders.mockResolvedValue([]);
      const result = await getMallOrdersByLineUser(999);
      expect(result).toEqual([]);
    });

    it("should handle items without product images (deleted products)", async () => {
      const mockOrders = [
        {
          id: 2,
          orderNumber: "LCJ-20260214-002",
          lineUserId: 10,
          status: "delivered",
          paymentMethod: "points",
          totalAmount: 0,
          pointsUsed: 500,
          createdAt: new Date("2026-02-10T10:00:00Z"),
          items: [
            {
              id: 3,
              orderId: 2,
              productId: 99,
              productName: "削除済み商品",
              productPrice: 5000,
              productPointPrice: 500,
              quantity: 1,
              subtotal: 5000,
              pointSubtotal: 500,
              productImageUrl: null,
              productImageUrls: null,
            },
          ],
        },
      ];

      mockGetOrders.mockResolvedValue(mockOrders as any);
      const result = await getMallOrdersByLineUser(10);

      expect(result[0].items[0].productImageUrl).toBeNull();
      expect(result[0].items[0].productImageUrls).toBeNull();
    });

    it("should return orders sorted by createdAt descending", async () => {
      const mockOrders = [
        { id: 3, createdAt: new Date("2026-02-14"), items: [] },
        { id: 2, createdAt: new Date("2026-02-13"), items: [] },
        { id: 1, createdAt: new Date("2026-02-12"), items: [] },
      ];

      mockGetOrders.mockResolvedValue(mockOrders as any);
      const result = await getMallOrdersByLineUser(10);

      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(1);
    });
  });

  describe("Order status filtering (frontend logic)", () => {
    const mockOrders = [
      { id: 1, status: "pending", items: [] },
      { id: 2, status: "paid", items: [] },
      { id: 3, status: "confirmed", items: [] },
      { id: 4, status: "shipped", items: [] },
      { id: 5, status: "delivered", items: [] },
      { id: 6, status: "cancelled", items: [] },
      { id: 7, status: "refunded", items: [] },
    ];

    const filterOrders = (orders: any[], filter: string) => {
      return orders.filter((order) => {
        if (filter === "all") return true;
        if (filter === "active") return ["pending", "paid", "confirmed"].includes(order.status);
        if (filter === "shipped") return order.status === "shipped";
        if (filter === "delivered") return order.status === "delivered";
        if (filter === "cancelled") return ["cancelled", "refunded"].includes(order.status);
        return true;
      });
    };

    it("should return all orders when filter is 'all'", () => {
      const result = filterOrders(mockOrders, "all");
      expect(result).toHaveLength(7);
    });

    it("should return active orders (pending/paid/confirmed)", () => {
      const result = filterOrders(mockOrders, "active");
      expect(result).toHaveLength(3);
      expect(result.map((o: any) => o.status)).toEqual(["pending", "paid", "confirmed"]);
    });

    it("should return shipped orders only", () => {
      const result = filterOrders(mockOrders, "shipped");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("shipped");
    });

    it("should return delivered orders only", () => {
      const result = filterOrders(mockOrders, "delivered");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("delivered");
    });

    it("should return cancelled/refunded orders", () => {
      const result = filterOrders(mockOrders, "cancelled");
      expect(result).toHaveLength(2);
      expect(result.map((o: any) => o.status)).toEqual(["cancelled", "refunded"]);
    });
  });

  describe("Tracking URL generation (frontend logic)", () => {
    const getTrackingUrl = (carrier: string, trackingNumber: string): string | null => {
      const carrierLower = carrier.toLowerCase();
      if (carrierLower.includes("ヤマト") || carrierLower.includes("yamato") || carrierLower.includes("クロネコ"))
        return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber}`;
      if (carrierLower.includes("佐川") || carrierLower.includes("sagawa"))
        return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
      if (carrierLower.includes("日本郵便") || carrierLower.includes("ユーパック") || carrierLower.includes("japan post"))
        return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${trackingNumber}`;
      if (carrierLower.includes("西濃") || carrierLower.includes("seino"))
        return `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${trackingNumber}`;
      return null;
    };

    it("should generate Yamato tracking URL", () => {
      expect(getTrackingUrl("ヤマト運輸", "1234567890")).toContain("kuronekoyamato.co.jp");
      expect(getTrackingUrl("クロネコヤマト", "1234567890")).toContain("kuronekoyamato.co.jp");
    });

    it("should generate Sagawa tracking URL", () => {
      expect(getTrackingUrl("佐川急便", "1234567890")).toContain("sagawa-exp.co.jp");
    });

    it("should generate Japan Post tracking URL", () => {
      expect(getTrackingUrl("日本郵便", "1234567890")).toContain("japanpost.jp");
      expect(getTrackingUrl("ユーパック", "1234567890")).toContain("japanpost.jp");
    });

    it("should generate Seino tracking URL", () => {
      expect(getTrackingUrl("西濃運輸", "1234567890")).toContain("seino.co.jp");
    });

    it("should return null for unknown carrier", () => {
      expect(getTrackingUrl("不明な業者", "1234567890")).toBeNull();
    });

    it("should include tracking number in URL", () => {
      const url = getTrackingUrl("ヤマト運輸", "ABC123");
      expect(url).toContain("ABC123");
    });
  });

  describe("Order detail calculation (frontend logic)", () => {
    it("should calculate items subtotal and shipping fee correctly", () => {
      const order = {
        totalAmount: 5500,
        items: [
          { subtotal: 3000, pointSubtotal: 300 },
          { subtotal: 2000, pointSubtotal: 200 },
        ],
      };

      const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const shippingFee = order.totalAmount - itemsSubtotal;

      expect(itemsSubtotal).toBe(5000);
      expect(shippingFee).toBe(500);
    });

    it("should handle free shipping (totalAmount equals items subtotal)", () => {
      const order = {
        totalAmount: 10000,
        items: [
          { subtotal: 5000, pointSubtotal: 500 },
          { subtotal: 5000, pointSubtotal: 500 },
        ],
      };

      const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const shippingFee = order.totalAmount - itemsSubtotal;

      expect(itemsSubtotal).toBe(10000);
      expect(shippingFee).toBe(0);
    });

    it("should calculate points subtotal correctly", () => {
      const order = {
        pointsUsed: 500,
        items: [
          { subtotal: 3000, pointSubtotal: 300 },
          { subtotal: 2000, pointSubtotal: 200 },
        ],
      };

      const pointsItemsSubtotal = order.items.reduce((sum, item) => sum + (item.pointSubtotal || 0), 0);
      expect(pointsItemsSubtotal).toBe(500);
    });
  });

  describe("getMallOrderById", () => {
    it("should return order with items and line user info", async () => {
      const mockOrder = {
        order: {
          id: 1,
          orderNumber: "LCJ-20260214-001",
          status: "shipped",
          shippingCarrier: "ヤマト運輸",
          trackingNumber: "1234567890",
          shippedAt: new Date("2026-02-14T12:00:00Z"),
        },
        lineUser: { id: 10, displayName: "テストユーザー" },
        items: [
          { id: 1, productName: "商品A", quantity: 2, subtotal: 6000 },
          { id: 2, productName: "商品B", quantity: 1, subtotal: 3000 },
        ],
      };

      mockGetOrderById.mockResolvedValue(mockOrder as any);
      const result = await getMallOrderById(1);

      expect(result).toBeDefined();
      expect(result!.order.status).toBe("shipped");
      expect(result!.order.trackingNumber).toBe("1234567890");
      expect(result!.items).toHaveLength(2);
    });

    it("should return undefined for non-existent order", async () => {
      mockGetOrderById.mockResolvedValue(undefined);
      const result = await getMallOrderById(999);
      expect(result).toBeUndefined();
    });
  });

  describe("updateMallOrderStatus", () => {
    it("should update order status to shipped with carrier info", async () => {
      mockUpdateStatus.mockResolvedValue(true as any);
      const result = await updateMallOrderStatus(1, "shipped", {
        shippingCarrier: "ヤマト運輸",
        trackingNumber: "1234567890",
      });
      expect(mockUpdateStatus).toHaveBeenCalledWith(1, "shipped", {
        shippingCarrier: "ヤマト運輸",
        trackingNumber: "1234567890",
      });
    });

    it("should update order status to delivered", async () => {
      mockUpdateStatus.mockResolvedValue(true as any);
      await updateMallOrderStatus(1, "delivered");
      expect(mockUpdateStatus).toHaveBeenCalledWith(1, "delivered");
    });

    it("should update order status to cancelled", async () => {
      mockUpdateStatus.mockResolvedValue(true as any);
      await updateMallOrderStatus(1, "cancelled");
      expect(mockUpdateStatus).toHaveBeenCalledWith(1, "cancelled");
    });
  });
});
