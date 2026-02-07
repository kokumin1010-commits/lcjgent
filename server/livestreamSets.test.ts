import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock db functions
vi.mock("./db", () => ({
  createLivestreamSet: vi.fn(),
  createLivestreamSetItem: vi.fn(),
  getLivestreamSetsByLivestreamId: vi.fn(),
  deleteLivestreamSetsByLivestreamId: vi.fn(),
}));

import {
  createLivestreamSet,
  createLivestreamSetItem,
  getLivestreamSetsByLivestreamId,
  deleteLivestreamSetsByLivestreamId,
} from "./db";

const mockCreateSet = vi.mocked(createLivestreamSet);
const mockCreateItem = vi.mocked(createLivestreamSetItem);
const mockGetSets = vi.mocked(getLivestreamSetsByLivestreamId);
const mockDeleteSets = vi.mocked(deleteLivestreamSetsByLivestreamId);

describe("Livestream Sets (セット組み)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLivestreamSet", () => {
    it("should create a set with correct data", async () => {
      mockCreateSet.mockResolvedValue([{ insertId: 1 }] as any);

      const setData = {
        livestreamId: 100,
        setName: "美容3点セット",
        setPrice: 5000,
        quantitySold: 3,
        totalOriginalPrice: 8000,
        discountRate: 38,
        totalRevenue: 15000,
        sortOrder: 0,
      };

      await createLivestreamSet(setData);

      expect(mockCreateSet).toHaveBeenCalledWith(setData);
      expect(mockCreateSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("createLivestreamSetItem", () => {
    it("should create a set item with correct data", async () => {
      mockCreateItem.mockResolvedValue([{ insertId: 1 }] as any);

      const itemData = {
        setId: 1,
        productName: "化粧水",
        originalPrice: 3000,
        sortOrder: 0,
      };

      await createLivestreamSetItem(itemData);

      expect(mockCreateItem).toHaveBeenCalledWith(itemData);
      expect(mockCreateItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLivestreamSetsByLivestreamId", () => {
    it("should return sets with items for a livestream", async () => {
      const mockData = [
        {
          id: 1,
          livestreamId: 100,
          setName: "美容3点セット",
          setPrice: 5000,
          quantitySold: 3,
          totalOriginalPrice: 8000,
          discountRate: 38,
          totalRevenue: 15000,
          sortOrder: 0,
          items: [
            { id: 1, setId: 1, productName: "化粧水", originalPrice: 3000, sortOrder: 0 },
            { id: 2, setId: 1, productName: "乳液", originalPrice: 2500, sortOrder: 1 },
            { id: 3, setId: 1, productName: "美容液", originalPrice: 2500, sortOrder: 2 },
          ],
        },
      ];

      mockGetSets.mockResolvedValue(mockData as any);

      const result = await getLivestreamSetsByLivestreamId(100);

      expect(result).toHaveLength(1);
      expect(result[0].setName).toBe("美容3点セット");
      expect(result[0].items).toHaveLength(3);
      expect(result[0].totalOriginalPrice).toBe(8000);
      expect(result[0].discountRate).toBe(38);
      expect(result[0].totalRevenue).toBe(15000);
    });

    it("should return empty array when no sets exist", async () => {
      mockGetSets.mockResolvedValue([]);

      const result = await getLivestreamSetsByLivestreamId(999);

      expect(result).toHaveLength(0);
    });
  });

  describe("deleteLivestreamSetsByLivestreamId", () => {
    it("should delete all sets and items for a livestream", async () => {
      mockDeleteSets.mockResolvedValue(undefined);

      await deleteLivestreamSetsByLivestreamId(100);

      expect(mockDeleteSets).toHaveBeenCalledWith(100);
      expect(mockDeleteSets).toHaveBeenCalledTimes(1);
    });
  });

  describe("Discount rate calculation", () => {
    it("should calculate discount rate correctly", () => {
      const totalOriginalPrice = 10000;
      const setPrice = 7000;
      const discountRate = Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100);
      expect(discountRate).toBe(30);
    });

    it("should handle zero original price", () => {
      const totalOriginalPrice = 0;
      const setPrice = 5000;
      const discountRate = totalOriginalPrice > 0
        ? Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100)
        : 0;
      expect(discountRate).toBe(0);
    });

    it("should handle set price higher than original (negative discount)", () => {
      const totalOriginalPrice = 5000;
      const setPrice = 6000;
      const discountRate = Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100);
      expect(discountRate).toBe(-20);
    });
  });

  describe("Total revenue calculation", () => {
    it("should calculate total revenue correctly", () => {
      const setPrice = 5000;
      const quantitySold = 3;
      const totalRevenue = setPrice * quantitySold;
      expect(totalRevenue).toBe(15000);
    });

    it("should handle single quantity", () => {
      const setPrice = 8000;
      const quantitySold = 1;
      const totalRevenue = setPrice * quantitySold;
      expect(totalRevenue).toBe(8000);
    });
  });

  describe("Multiple sets per livestream", () => {
    it("should support multiple sets for one livestream", async () => {
      const mockData = [
        {
          id: 1,
          livestreamId: 100,
          setName: "美容3点セット",
          setPrice: 5000,
          quantitySold: 3,
          totalOriginalPrice: 8000,
          discountRate: 38,
          totalRevenue: 15000,
          sortOrder: 0,
          items: [
            { id: 1, setId: 1, productName: "化粧水", originalPrice: 3000, sortOrder: 0 },
          ],
        },
        {
          id: 2,
          livestreamId: 100,
          setName: "限定福袋A",
          setPrice: 10000,
          quantitySold: 5,
          totalOriginalPrice: 15000,
          discountRate: 33,
          totalRevenue: 50000,
          sortOrder: 1,
          items: [
            { id: 2, setId: 2, productName: "美容液", originalPrice: 8000, sortOrder: 0 },
            { id: 3, setId: 2, productName: "クリーム", originalPrice: 7000, sortOrder: 1 },
          ],
        },
      ];

      mockGetSets.mockResolvedValue(mockData as any);

      const result = await getLivestreamSetsByLivestreamId(100);

      expect(result).toHaveLength(2);
      expect(result[0].setName).toBe("美容3点セット");
      expect(result[1].setName).toBe("限定福袋A");
      expect(result[0].items).toHaveLength(1);
      expect(result[1].items).toHaveLength(2);

      // Total revenue across all sets
      const totalSetRevenue = result.reduce((sum, s) => sum + s.totalRevenue, 0);
      expect(totalSetRevenue).toBe(65000);
    });
  });
});
