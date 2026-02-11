import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getAllLiversSetAnalysis: vi.fn(),
    getLiverSetAnalysis: vi.fn(),
  };
});

import { getAllLiversSetAnalysis, getLiverSetAnalysis } from "./db";

describe("Set Analysis API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllLiversSetAnalysis", () => {
    it("should return an array of liver set analysis data", async () => {
      const mockData = [
        {
          liverId: 1,
          streamerName: "テストライバー1",
          totalSets: "3",
          totalSetRevenue: "150000",
          totalQuantitySold: "15",
          avgDiscountRate: "35.5",
        },
        {
          liverId: 2,
          streamerName: "テストライバー2",
          totalSets: "1",
          totalSetRevenue: "30000",
          totalQuantitySold: "5",
          avgDiscountRate: "40.0",
        },
      ];

      vi.mocked(getAllLiversSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getAllLiversSetAnalysis();
      expect(result).toHaveLength(2);
      expect(result[0].streamerName).toBe("テストライバー1");
      expect(Number(result[0].totalSets)).toBe(3);
      expect(Number(result[0].totalSetRevenue)).toBe(150000);
    });

    it("should return empty array when no sets exist", async () => {
      vi.mocked(getAllLiversSetAnalysis).mockResolvedValue([]);

      const result = await getAllLiversSetAnalysis();
      expect(result).toHaveLength(0);
    });

    it("should sort by totalSetRevenue descending", async () => {
      const mockData = [
        {
          liverId: 1,
          streamerName: "高売上ライバー",
          totalSets: "5",
          totalSetRevenue: "500000",
          totalQuantitySold: "50",
          avgDiscountRate: "30.0",
        },
        {
          liverId: 2,
          streamerName: "低売上ライバー",
          totalSets: "2",
          totalSetRevenue: "30000",
          totalQuantitySold: "5",
          avgDiscountRate: "40.0",
        },
      ];

      vi.mocked(getAllLiversSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getAllLiversSetAnalysis();
      expect(Number(result[0].totalSetRevenue)).toBeGreaterThan(Number(result[1].totalSetRevenue));
    });
  });

  describe("getLiverSetAnalysis", () => {
    it("should return summary and sets for a specific liver", async () => {
      const mockData = {
        summary: {
          totalSets: 2,
          totalSetRevenue: 109923,
          totalQuantitySold: 15,
          avgDiscountRate: 40,
          avgQuantityPerSet: 7.5,
          bestSetId: 1,
          mostPopularSetId: 2,
        },
        sets: [
          {
            id: 1,
            setName: "2.5NANAやらかし2",
            setPrice: 9900,
            quantitySold: 8,
            totalRevenue: 79200,
            discountRate: 40,
            livestreamId: 10,
            livestreamDate: new Date("2025-02-10"),
            streamerName: "テストライバー",
            items: [
              { id: 1, setId: 1, productName: "モーニングマスク", originalPrice: 1463, sortOrder: 1, createdAt: new Date() },
              { id: 2, setId: 1, productName: "フェイシャルオイル", originalPrice: 9680, sortOrder: 2, createdAt: new Date() },
            ],
          },
          {
            id: 2,
            setName: "2/9モーニングマスク5枚セット",
            setPrice: 4389,
            quantitySold: 7,
            totalRevenue: 30723,
            discountRate: 40,
            livestreamId: 9,
            livestreamDate: new Date("2025-02-09"),
            streamerName: "テストライバー",
            items: [
              { id: 3, setId: 2, productName: "モーニングマスク 5枚", originalPrice: 7315, sortOrder: 1, createdAt: new Date() },
            ],
          },
        ],
      };

      vi.mocked(getLiverSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getLiverSetAnalysis(1);

      // Summary checks
      expect(result.summary).toBeDefined();
      expect(result.summary.totalSets).toBe(2);
      expect(result.summary.totalSetRevenue).toBe(109923);
      expect(result.summary.avgDiscountRate).toBe(40);
      expect(result.summary.avgQuantityPerSet).toBe(7.5);

      // Sets checks
      expect(result.sets).toHaveLength(2);
      expect(result.sets[0].setName).toBe("2.5NANAやらかし2");
      expect(result.sets[0].items).toHaveLength(2);
      expect(result.sets[1].items).toHaveLength(1);
    });

    it("should return empty summary when liver has no sets", async () => {
      const mockData = {
        summary: {
          totalSets: 0,
          totalSetRevenue: 0,
          totalQuantitySold: 0,
          avgDiscountRate: 0,
          avgQuantityPerSet: 0,
          bestSetId: null,
          mostPopularSetId: null,
        },
        sets: [],
      };

      vi.mocked(getLiverSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getLiverSetAnalysis(999);
      expect(result.summary.totalSets).toBe(0);
      expect(result.sets).toHaveLength(0);
    });

    it("should include items with originalPrice for each set", async () => {
      const mockData = {
        summary: {
          totalSets: 1,
          totalSetRevenue: 79200,
          totalQuantitySold: 8,
          avgDiscountRate: 40,
          avgQuantityPerSet: 8,
          bestSetId: 1,
          mostPopularSetId: 1,
        },
        sets: [
          {
            id: 1,
            setName: "テストセット",
            setPrice: 9900,
            quantitySold: 8,
            totalRevenue: 79200,
            discountRate: 40,
            livestreamId: 10,
            livestreamDate: new Date("2025-02-10"),
            streamerName: "テストライバー",
            items: [
              { id: 1, setId: 1, productName: "商品A", originalPrice: 5000, sortOrder: 1, createdAt: new Date() },
              { id: 2, setId: 1, productName: "商品B", originalPrice: 3000, sortOrder: 2, createdAt: new Date() },
              { id: 3, setId: 1, productName: "商品C", originalPrice: 8456, sortOrder: 3, createdAt: new Date() },
            ],
          },
        ],
      };

      vi.mocked(getLiverSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getLiverSetAnalysis(1);
      const items = result.sets[0].items;
      expect(items).toHaveLength(3);

      // Calculate original total
      const originalTotal = items.reduce((sum: number, item: any) => sum + item.originalPrice, 0);
      expect(originalTotal).toBe(16456);

      // Verify discount: originalTotal > setPrice
      expect(originalTotal).toBeGreaterThan(result.sets[0].setPrice);
    });

    it("should identify best set and most popular set", async () => {
      const mockData = {
        summary: {
          totalSets: 2,
          totalSetRevenue: 109923,
          totalQuantitySold: 15,
          avgDiscountRate: 40,
          avgQuantityPerSet: 7.5,
          bestSetId: 1,
          mostPopularSetId: 2,
        },
        sets: [
          {
            id: 1,
            setName: "高売上セット",
            setPrice: 9900,
            quantitySold: 5,
            totalRevenue: 79200,
            discountRate: 40,
            livestreamId: 10,
            livestreamDate: new Date(),
            streamerName: "ライバー",
            items: [],
          },
          {
            id: 2,
            setName: "人気セット",
            setPrice: 4389,
            quantitySold: 10,
            totalRevenue: 30723,
            discountRate: 40,
            livestreamId: 9,
            livestreamDate: new Date(),
            streamerName: "ライバー",
            items: [],
          },
        ],
      };

      vi.mocked(getLiverSetAnalysis).mockResolvedValue(mockData as any);

      const result = await getLiverSetAnalysis(1);
      expect(result.summary.bestSetId).toBe(1);
      expect(result.summary.mostPopularSetId).toBe(2);
    });
  });
});
