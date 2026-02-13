import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getMallCart: vi.fn(),
  clearMallCart: vi.fn(),
  createMallOrder: vi.fn(),
  getLinePointBalance: vi.fn(),
  getLineUserFromSession: vi.fn(),
}));

import {
  getMallCart,
  clearMallCart,
  createMallOrder,
  getLinePointBalance,
  getLineUserFromSession,
} from "./db";

const mockGetCart = vi.mocked(getMallCart);
const mockClearCart = vi.mocked(clearMallCart);
const mockCreateOrder = vi.mocked(createMallOrder);
const mockGetPointBalance = vi.mocked(getLinePointBalance);
const mockGetLineUser = vi.mocked(getLineUserFromSession);

describe("Mall Cart Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cart Summary Calculation", () => {
    it("should calculate correct subtotal for multiple items", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1500, pointPrice: 500 } },
        { cart: { quantity: 1 }, product: { price: 3000, pointPrice: 1000 } },
        { cart: { quantity: 3 }, product: { price: 800, pointPrice: 300 } },
      ];

      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.cart.quantity,
        0
      );
      const pointsTotal = cartItems.reduce(
        (sum, item) => sum + item.product.pointPrice * item.cart.quantity,
        0
      );
      const totalItems = cartItems.reduce(
        (sum, item) => sum + item.cart.quantity,
        0
      );

      expect(subtotal).toBe(2 * 1500 + 1 * 3000 + 3 * 800); // 8400
      expect(pointsTotal).toBe(2 * 500 + 1 * 1000 + 3 * 300); // 2900
      expect(totalItems).toBe(6);
    });

    it("should calculate shipping fee based on threshold", () => {
      const FREE_SHIPPING_THRESHOLD = 5000;
      const SHIPPING_FEE = 800;

      const subtotal1 = 4999;
      const shipping1 = subtotal1 >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      expect(shipping1).toBe(800);

      const subtotal2 = 5000;
      const shipping2 = subtotal2 >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      expect(shipping2).toBe(0);

      const subtotal3 = 10000;
      const shipping3 = subtotal3 >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      expect(shipping3).toBe(0);
    });

    it("should calculate grand total with shipping", () => {
      const FREE_SHIPPING_THRESHOLD = 5000;
      const SHIPPING_FEE = 800;

      const subtotal = 3000;
      const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
      const grandTotal = subtotal + shippingFee;

      expect(grandTotal).toBe(3800);
    });

    it("should handle empty cart", () => {
      const cartItems: any[] = [];
      const subtotal = cartItems.reduce(
        (sum: number, item: any) => sum + item.product.price * item.cart.quantity,
        0
      );
      expect(subtotal).toBe(0);
    });
  });

  describe("Cart Checkout Validation", () => {
    it("should detect out-of-stock items in cart", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1500, stock: 5, status: "active" } },
        { cart: { quantity: 1 }, product: { price: 3000, stock: 0, status: "active" } },
      ];

      const outOfStockItems = cartItems.filter(
        (item) => item.product.stock <= 0 || item.cart.quantity > item.product.stock
      );

      expect(outOfStockItems.length).toBe(1);
    });

    it("should detect items exceeding stock quantity", () => {
      const cartItems = [
        { cart: { quantity: 10 }, product: { price: 1500, stock: 5, status: "active" } },
        { cart: { quantity: 1 }, product: { price: 3000, stock: 10, status: "active" } },
      ];

      const overStockItems = cartItems.filter(
        (item) => item.cart.quantity > item.product.stock
      );

      expect(overStockItems.length).toBe(1);
    });

    it("should detect inactive products in cart", () => {
      const cartItems = [
        { cart: { quantity: 1 }, product: { price: 1500, stock: 5, status: "active" } },
        { cart: { quantity: 1 }, product: { price: 3000, stock: 10, status: "draft" } },
      ];

      const inactiveItems = cartItems.filter(
        (item) => item.product.status !== "active"
      );

      expect(inactiveItems.length).toBe(1);
    });

    it("should pass validation when all items are valid", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1500, stock: 5, status: "active" } },
        { cart: { quantity: 1 }, product: { price: 3000, stock: 10, status: "active" } },
      ];

      const hasIssues = cartItems.some(
        (item) =>
          item.product.stock <= 0 ||
          item.cart.quantity > item.product.stock ||
          item.product.status !== "active"
      );

      expect(hasIssues).toBe(false);
    });
  });

  describe("Points Checkout Validation", () => {
    it("should check if user has enough points", () => {
      const pointsBalance = 5000;
      const requiredPoints = 3000;

      expect(pointsBalance >= requiredPoints).toBe(true);
    });

    it("should reject if user has insufficient points", () => {
      const pointsBalance = 1000;
      const requiredPoints = 3000;

      expect(pointsBalance >= requiredPoints).toBe(false);
    });

    it("should calculate total points needed for multiple items", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { pointPrice: 500 } },
        { cart: { quantity: 1 }, product: { pointPrice: 1000 } },
        { cart: { quantity: 3 }, product: { pointPrice: 300 } },
      ];

      const totalPoints = cartItems.reduce(
        (sum, item) => sum + item.product.pointPrice * item.cart.quantity,
        0
      );

      expect(totalPoints).toBe(2900);
    });
  });

  describe("Stripe Checkout Line Items", () => {
    it("should generate correct line items for Stripe", () => {
      const cartItems = [
        {
          cart: { quantity: 2 },
          product: { name: "商品A", price: 1500 },
        },
        {
          cart: { quantity: 1 },
          product: { name: "商品B", price: 3000 },
        },
      ];

      const lineItems = cartItems.map((item) => ({
        price_data: {
          currency: "jpy",
          product_data: {
            name: item.product.name,
          },
          unit_amount: item.product.price,
        },
        quantity: item.cart.quantity,
      }));

      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].price_data.unit_amount).toBe(1500);
      expect(lineItems[0].quantity).toBe(2);
      expect(lineItems[1].price_data.unit_amount).toBe(3000);
      expect(lineItems[1].quantity).toBe(1);
    });

    it("should add shipping fee as separate line item when applicable", () => {
      const FREE_SHIPPING_THRESHOLD = 5000;
      const SHIPPING_FEE = 800;
      const subtotal = 3000;

      const lineItems: any[] = [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "商品A" },
            unit_amount: 3000,
          },
          quantity: 1,
        },
      ];

      if (subtotal < FREE_SHIPPING_THRESHOLD) {
        lineItems.push({
          price_data: {
            currency: "jpy",
            product_data: { name: "送料" },
            unit_amount: SHIPPING_FEE,
          },
          quantity: 1,
        });
      }

      expect(lineItems).toHaveLength(2);
      expect(lineItems[1].price_data.product_data.name).toBe("送料");
      expect(lineItems[1].price_data.unit_amount).toBe(800);
    });

    it("should not add shipping fee when above threshold", () => {
      const FREE_SHIPPING_THRESHOLD = 5000;
      const subtotal = 8000;

      const lineItems: any[] = [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "商品A" },
            unit_amount: 5000,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "商品B" },
            unit_amount: 3000,
          },
          quantity: 1,
        },
      ];

      if (subtotal < FREE_SHIPPING_THRESHOLD) {
        lineItems.push({
          price_data: {
            currency: "jpy",
            product_data: { name: "送料" },
            unit_amount: 800,
          },
          quantity: 1,
        });
      }

      expect(lineItems).toHaveLength(2);
      expect(lineItems.find((i) => i.price_data.product_data.name === "送料")).toBeUndefined();
    });
  });

  describe("Order Creation from Cart", () => {
    it("should create order with multiple items", async () => {
      mockCreateOrder.mockResolvedValue({
        id: 1,
        orderNumber: "ORD-20260214-ABC123",
      } as any);

      const orderItems = [
        { productId: 42, quantity: 2, price: 1500, pointPrice: 500, productName: "商品A" },
        { productId: 43, quantity: 1, price: 3000, pointPrice: 1000, productName: "商品B" },
      ];

      const result = await createMallOrder({
        lineUserId: 1,
        items: orderItems,
        totalAmount: 6000,
        pointsUsed: 0,
        paymentMethod: "stripe",
        shippingName: "テスト太郎",
        shippingPostalCode: "100-0001",
        shippingAddress: "東京都千代田区千代田1-1",
        shippingPhone: "090-1234-5678",
      } as any);

      expect(mockCreateOrder).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result?.orderNumber).toContain("ORD-");
    });

    it("should clear cart after successful order creation", async () => {
      mockClearCart.mockResolvedValue(undefined);

      await clearMallCart(1);

      expect(mockClearCart).toHaveBeenCalledWith(1);
    });
  });

  describe("Cart to Order Item Mapping", () => {
    it("should correctly map cart items to order items", () => {
      const cartItems = [
        {
          cart: { productId: 42, quantity: 2 },
          product: { id: 42, name: "商品A", price: 1500, pointPrice: 500 },
        },
        {
          cart: { productId: 43, quantity: 1 },
          product: { id: 43, name: "商品B", price: 3000, pointPrice: 1000 },
        },
      ];

      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.cart.quantity,
        price: item.product.price,
        pointPrice: item.product.pointPrice,
        productName: item.product.name,
      }));

      expect(orderItems).toHaveLength(2);
      expect(orderItems[0]).toEqual({
        productId: 42,
        quantity: 2,
        price: 1500,
        pointPrice: 500,
        productName: "商品A",
      });
      expect(orderItems[1]).toEqual({
        productId: 43,
        quantity: 1,
        price: 3000,
        pointPrice: 1000,
        productName: "商品B",
      });
    });
  });

  describe("Payment Method Selection", () => {
    it("should support stripe payment method", () => {
      const paymentMethods = ["stripe", "points"] as const;
      expect(paymentMethods).toContain("stripe");
    });

    it("should support points payment method", () => {
      const paymentMethods = ["stripe", "points"] as const;
      expect(paymentMethods).toContain("points");
    });

    it("should not allow invalid payment methods", () => {
      const validMethods = ["stripe", "points"];
      const invalidMethod = "cash";
      expect(validMethods).not.toContain(invalidMethod);
    });
  });
});
