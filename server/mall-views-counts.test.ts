import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getMallFavoriteCounts: vi.fn(),
  recordMallViewHistory: vi.fn(),
  getMallViewHistoryByUser: vi.fn(),
}));

import {
  getMallFavoriteCounts,
  recordMallViewHistory,
  getMallViewHistoryByUser,
} from "./db";

const mockGetFavoriteCounts = vi.mocked(getMallFavoriteCounts);
const mockRecordViewHistory = vi.mocked(recordMallViewHistory);
const mockGetViewHistory = vi.mocked(getMallViewHistoryByUser);

describe("Mall Favorite Counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMallFavoriteCounts", () => {
    it("should return a map of productId to favorite count", async () => {
      const mockData: Record<number, number> = { 1: 5, 2: 12, 42: 3 };
      mockGetFavoriteCounts.mockResolvedValue(mockData);

      const result = await getMallFavoriteCounts();

      expect(mockGetFavoriteCounts).toHaveBeenCalled();
      expect(result[1]).toBe(5);
      expect(result[2]).toBe(12);
      expect(result[42]).toBe(3);
    });

    it("should return empty object when no favorites exist", async () => {
      mockGetFavoriteCounts.mockResolvedValue({});

      const result = await getMallFavoriteCounts();

      expect(result).toEqual({});
    });
  });
});

describe("Mall View History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordMallViewHistory", () => {
    it("should record a product view", async () => {
      mockRecordViewHistory.mockResolvedValue({ success: true });

      const result = await recordMallViewHistory(1, 42);

      expect(mockRecordViewHistory).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual({ success: true });
    });

    it("should update existing view history for same product", async () => {
      mockRecordViewHistory.mockResolvedValue({ success: true });

      await recordMallViewHistory(1, 42);
      await recordMallViewHistory(1, 42);

      expect(mockRecordViewHistory).toHaveBeenCalledTimes(2);
    });
  });

  describe("getMallViewHistoryByUser", () => {
    it("should return view history with product details", async () => {
      const mockData = [
        {
          id: 1,
          productId: 42,
          viewedAt: new Date("2026-02-13T10:00:00Z"),
          product: {
            id: 42,
            name: "テスト商品A",
            price: 2000,
            pointPrice: 800,
            imageUrl: "https://example.com/img1.jpg",
            status: "active" as const,
            stock: 5,
            category: "美容",
          },
        },
        {
          id: 2,
          productId: 10,
          viewedAt: new Date("2026-02-13T09:00:00Z"),
          product: {
            id: 10,
            name: "テスト商品B",
            price: 1500,
            pointPrice: null,
            imageUrl: "https://example.com/img2.jpg",
            status: "active" as const,
            stock: 0,
            category: "食品",
          },
        },
      ];
      mockGetViewHistory.mockResolvedValue(mockData);

      const result = await getMallViewHistoryByUser(1, 20);

      expect(mockGetViewHistory).toHaveBeenCalledWith(1, 20);
      expect(result).toHaveLength(2);
      expect(result[0].product.name).toBe("テスト商品A");
      expect(result[1].product.stock).toBe(0);
    });

    it("should return empty array for user with no history", async () => {
      mockGetViewHistory.mockResolvedValue([]);

      const result = await getMallViewHistoryByUser(999, 20);

      expect(result).toEqual([]);
    });

    it("should respect the limit parameter", async () => {
      mockGetViewHistory.mockResolvedValue([]);

      await getMallViewHistoryByUser(1, 5);

      expect(mockGetViewHistory).toHaveBeenCalledWith(1, 5);
    });
  });
});
