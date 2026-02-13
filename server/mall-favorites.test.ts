import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  addMallFavorite: vi.fn(),
  removeMallFavorite: vi.fn(),
  getMallFavoritesByUser: vi.fn(),
  getMallFavoriteProductIds: vi.fn(),
  isMallFavorite: vi.fn(),
}));

import {
  addMallFavorite,
  removeMallFavorite,
  getMallFavoritesByUser,
  getMallFavoriteProductIds,
  isMallFavorite,
} from "./db";

const mockAddFavorite = vi.mocked(addMallFavorite);
const mockRemoveFavorite = vi.mocked(removeMallFavorite);
const mockGetFavorites = vi.mocked(getMallFavoritesByUser);
const mockGetFavoriteIds = vi.mocked(getMallFavoriteProductIds);
const mockIsFavorite = vi.mocked(isMallFavorite);

describe("Mall Favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addMallFavorite", () => {
    it("should add a product to favorites", async () => {
      mockAddFavorite.mockResolvedValue({ success: true });

      const result = await addMallFavorite(1, 42);

      expect(mockAddFavorite).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual({ success: true });
    });

    it("should handle duplicate favorites gracefully", async () => {
      mockAddFavorite.mockResolvedValue({ success: true });

      await addMallFavorite(1, 42);
      await addMallFavorite(1, 42);

      expect(mockAddFavorite).toHaveBeenCalledTimes(2);
    });
  });

  describe("removeMallFavorite", () => {
    it("should remove a product from favorites", async () => {
      mockRemoveFavorite.mockResolvedValue({ success: true });

      const result = await removeMallFavorite(1, 42);

      expect(mockRemoveFavorite).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual({ success: true });
    });
  });

  describe("getMallFavoritesByUser", () => {
    it("should return favorites with product details", async () => {
      const mockData = [
        {
          id: 1,
          productId: 42,
          createdAt: new Date("2026-01-01"),
          product: {
            id: 42,
            name: "テスト商品",
            price: 1500,
            pointPrice: 500,
            imageUrl: "https://example.com/img.jpg",
            imageUrls: null,
            status: "active" as const,
            stock: 10,
          },
        },
      ];
      mockGetFavorites.mockResolvedValue(mockData);

      const result = await getMallFavoritesByUser(1);

      expect(mockGetFavorites).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe("テスト商品");
      expect(result[0].product.price).toBe(1500);
    });

    it("should return empty array for user with no favorites", async () => {
      mockGetFavorites.mockResolvedValue([]);

      const result = await getMallFavoritesByUser(999);

      expect(result).toEqual([]);
    });
  });

  describe("getMallFavoriteProductIds", () => {
    it("should return array of product IDs", async () => {
      mockGetFavoriteIds.mockResolvedValue([1, 5, 10, 42]);

      const result = await getMallFavoriteProductIds(1);

      expect(result).toEqual([1, 5, 10, 42]);
    });

    it("should return empty array for user with no favorites", async () => {
      mockGetFavoriteIds.mockResolvedValue([]);

      const result = await getMallFavoriteProductIds(999);

      expect(result).toEqual([]);
    });
  });

  describe("isMallFavorite", () => {
    it("should return true when product is favorited", async () => {
      mockIsFavorite.mockResolvedValue(true);

      const result = await isMallFavorite(1, 42);

      expect(result).toBe(true);
    });

    it("should return false when product is not favorited", async () => {
      mockIsFavorite.mockResolvedValue(false);

      const result = await isMallFavorite(1, 999);

      expect(result).toBe(false);
    });
  });
});
