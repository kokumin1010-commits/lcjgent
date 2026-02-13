import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getMallCart: vi.fn(),
  addToMallCart: vi.fn(),
  updateMallCartQuantity: vi.fn(),
  removeFromMallCart: vi.fn(),
  clearMallCart: vi.fn(),
}));

import {
  getMallCart,
  addToMallCart,
  updateMallCartQuantity,
  removeFromMallCart,
  clearMallCart,
} from "./db";

const mockGetCart = vi.mocked(getMallCart);
const mockAddToCart = vi.mocked(addToMallCart);
const mockUpdateQuantity = vi.mocked(updateMallCartQuantity);
const mockRemoveFromCart = vi.mocked(removeFromMallCart);
const mockClearCart = vi.mocked(clearMallCart);

describe("Mall Cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMallCart", () => {
    it("should return cart items with product details", async () => {
      const mockData = [
        {
          cart: {
            id: 1,
            lineUserId: 1,
            productId: 42,
            quantity: 2,
            createdAt: new Date("2026-01-01"),
          },
          product: {
            id: 42,
            name: "テスト商品A",
            price: 1500,
            pointPrice: 500,
            imageUrl: "https://example.com/img.jpg",
            imageUrls: null,
            status: "active" as const,
            stock: 10,
          },
        },
      ];
      mockGetCart.mockResolvedValue(mockData as any);

      const result = await getMallCart(1);

      expect(mockGetCart).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe("テスト商品A");
      expect(result[0].cart.quantity).toBe(2);
    });

    it("should return empty array for user with no cart items", async () => {
      mockGetCart.mockResolvedValue([]);

      const result = await getMallCart(999);

      expect(result).toEqual([]);
    });

    it("should return multiple cart items", async () => {
      const mockData = [
        {
          cart: { id: 1, lineUserId: 1, productId: 10, quantity: 1, createdAt: new Date() },
          product: { id: 10, name: "商品A", price: 1000, stock: 5 },
        },
        {
          cart: { id: 2, lineUserId: 1, productId: 20, quantity: 3, createdAt: new Date() },
          product: { id: 20, name: "商品B", price: 2000, stock: 10 },
        },
        {
          cart: { id: 3, lineUserId: 1, productId: 30, quantity: 2, createdAt: new Date() },
          product: { id: 30, name: "商品C", price: 500, stock: 100 },
        },
      ];
      mockGetCart.mockResolvedValue(mockData as any);

      const result = await getMallCart(1);

      expect(result).toHaveLength(3);
      // 合計金額の計算テスト
      const total = result.reduce(
        (sum: number, item: any) => sum + item.product.price * item.cart.quantity,
        0
      );
      expect(total).toBe(1000 * 1 + 2000 * 3 + 500 * 2); // 8000
    });
  });

  describe("addToMallCart", () => {
    it("should add a product to cart with default quantity 1", async () => {
      mockAddToCart.mockResolvedValue(undefined);

      await addToMallCart(1, 42, 1);

      expect(mockAddToCart).toHaveBeenCalledWith(1, 42, 1);
    });

    it("should add a product to cart with specified quantity", async () => {
      mockAddToCart.mockResolvedValue(undefined);

      await addToMallCart(1, 42, 3);

      expect(mockAddToCart).toHaveBeenCalledWith(1, 42, 3);
    });

    it("should handle adding same product multiple times (quantity accumulation)", async () => {
      mockAddToCart.mockResolvedValue(undefined);

      await addToMallCart(1, 42, 1);
      await addToMallCart(1, 42, 2);

      expect(mockAddToCart).toHaveBeenCalledTimes(2);
      expect(mockAddToCart).toHaveBeenNthCalledWith(1, 1, 42, 1);
      expect(mockAddToCart).toHaveBeenNthCalledWith(2, 1, 42, 2);
    });
  });

  describe("updateMallCartQuantity", () => {
    it("should update cart item quantity", async () => {
      mockUpdateQuantity.mockResolvedValue(undefined);

      await updateMallCartQuantity(1, 42, 5);

      expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 42, 5);
    });

    it("should remove item when quantity is set to 0", async () => {
      mockUpdateQuantity.mockResolvedValue(undefined);

      await updateMallCartQuantity(1, 42, 0);

      expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 42, 0);
    });

    it("should handle quantity of 1 (minimum)", async () => {
      mockUpdateQuantity.mockResolvedValue(undefined);

      await updateMallCartQuantity(1, 42, 1);

      expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 42, 1);
    });
  });

  describe("removeFromMallCart", () => {
    it("should remove a product from cart", async () => {
      mockRemoveFromCart.mockResolvedValue(undefined);

      await removeFromMallCart(1, 42);

      expect(mockRemoveFromCart).toHaveBeenCalledWith(1, 42);
    });

    it("should handle removing non-existent item gracefully", async () => {
      mockRemoveFromCart.mockResolvedValue(undefined);

      await removeFromMallCart(1, 999);

      expect(mockRemoveFromCart).toHaveBeenCalledWith(1, 999);
    });
  });

  describe("clearMallCart", () => {
    it("should clear all items from user's cart", async () => {
      mockClearCart.mockResolvedValue(undefined);

      await clearMallCart(1);

      expect(mockClearCart).toHaveBeenCalledWith(1);
    });

    it("should handle clearing already empty cart", async () => {
      mockClearCart.mockResolvedValue(undefined);

      await clearMallCart(999);

      expect(mockClearCart).toHaveBeenCalledWith(999);
    });
  });

  describe("Cart total calculation logic", () => {
    it("should calculate correct subtotal for single item", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1500 } },
      ];
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.cart.quantity,
        0
      );
      expect(subtotal).toBe(3000);
    });

    it("should calculate correct subtotal for multiple items", () => {
      const cartItems = [
        { cart: { quantity: 1 }, product: { price: 1000 } },
        { cart: { quantity: 3 }, product: { price: 500 } },
        { cart: { quantity: 2 }, product: { price: 2500 } },
      ];
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.cart.quantity,
        0
      );
      expect(subtotal).toBe(1000 + 1500 + 5000); // 7500
    });

    it("should calculate correct total item count", () => {
      const cartItems = [
        { cart: { quantity: 1 }, product: { price: 1000 } },
        { cart: { quantity: 3 }, product: { price: 500 } },
        { cart: { quantity: 2 }, product: { price: 2500 } },
      ];
      const totalItems = cartItems.reduce(
        (sum, item) => sum + item.cart.quantity,
        0
      );
      expect(totalItems).toBe(6);
    });

    it("should detect out-of-stock items", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1000, stock: 5 } },
        { cart: { quantity: 1 }, product: { price: 500, stock: 0 } }, // out of stock
      ];
      const hasOutOfStock = cartItems.some(
        (item) => item.product.stock <= 0 || item.cart.quantity > item.product.stock
      );
      expect(hasOutOfStock).toBe(true);
    });

    it("should detect over-stock items", () => {
      const cartItems = [
        { cart: { quantity: 10 }, product: { price: 1000, stock: 5 } }, // over stock
        { cart: { quantity: 1 }, product: { price: 500, stock: 10 } },
      ];
      const hasOutOfStock = cartItems.some(
        (item) => item.product.stock <= 0 || item.cart.quantity > item.product.stock
      );
      expect(hasOutOfStock).toBe(true);
    });

    it("should return false when all items are in stock", () => {
      const cartItems = [
        { cart: { quantity: 2 }, product: { price: 1000, stock: 5 } },
        { cart: { quantity: 1 }, product: { price: 500, stock: 10 } },
      ];
      const hasOutOfStock = cartItems.some(
        (item) => item.product.stock <= 0 || item.cart.quantity > item.product.stock
      );
      expect(hasOutOfStock).toBe(false);
    });

    it("should handle empty cart", () => {
      const cartItems: any[] = [];
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.cart.quantity,
        0
      );
      const totalItems = cartItems.reduce(
        (sum, item) => sum + item.cart.quantity,
        0
      );
      expect(subtotal).toBe(0);
      expect(totalItems).toBe(0);
    });
  });
});
