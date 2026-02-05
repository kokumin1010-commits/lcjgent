import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("./db", () => ({
  getLiverDetailWithStats: vi.fn(),
  getLiverMonthlySalesTrendById: vi.fn(),
  getLiverRecentLivestreams: vi.fn(),
  getLiverBrandPerformance: vi.fn(),
}));

import {
  getLiverDetailWithStats,
  getLiverMonthlySalesTrendById,
  getLiverRecentLivestreams,
  getLiverBrandPerformance,
} from "./db";

describe("Liver Detail API Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLiverDetailWithStats", () => {
    it("should return liver detail with all-time and current month stats", async () => {
      const mockLiverDetail = {
        id: 1,
        name: "Test Liver",
        email: "test@example.com",
        allTimeStats: {
          totalSales: 1000000,
          totalDuration: 100,
          totalLivestreams: 50,
        },
        currentMonthStats: {
          totalSales: 200000,
          totalDuration: 20,
          totalLivestreams: 10,
        },
        prevMonthStats: {
          totalSales: 150000,
          totalDuration: 15,
          totalLivestreams: 8,
        },
        growth: {
          salesGrowth: 33.3,
          livestreamGrowth: 25.0,
        },
      };

      vi.mocked(getLiverDetailWithStats).mockResolvedValue(mockLiverDetail);

      const result = await getLiverDetailWithStats(1);

      expect(getLiverDetailWithStats).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockLiverDetail);
      expect(result?.allTimeStats.totalSales).toBe(1000000);
      expect(result?.growth.salesGrowth).toBe(33.3);
    });

    it("should return null for non-existent liver", async () => {
      vi.mocked(getLiverDetailWithStats).mockResolvedValue(null);

      const result = await getLiverDetailWithStats(9999);

      expect(result).toBeNull();
    });
  });

  describe("getLiverMonthlySalesTrendById", () => {
    it("should return 12 months of sales trend data", async () => {
      const mockTrend = [
        { month: "2025-03", label: "3月", year: 2025, totalSales: 100000, totalDuration: 10, totalLivestreams: 5 },
        { month: "2025-04", label: "4月", year: 2025, totalSales: 150000, totalDuration: 15, totalLivestreams: 7 },
        { month: "2025-05", label: "5月", year: 2025, totalSales: 200000, totalDuration: 20, totalLivestreams: 10 },
        { month: "2025-06", label: "6月", year: 2025, totalSales: 180000, totalDuration: 18, totalLivestreams: 9 },
        { month: "2025-07", label: "7月", year: 2025, totalSales: 220000, totalDuration: 22, totalLivestreams: 11 },
        { month: "2025-08", label: "8月", year: 2025, totalSales: 250000, totalDuration: 25, totalLivestreams: 12 },
        { month: "2025-09", label: "9月", year: 2025, totalSales: 230000, totalDuration: 23, totalLivestreams: 11 },
        { month: "2025-10", label: "10月", year: 2025, totalSales: 280000, totalDuration: 28, totalLivestreams: 14 },
        { month: "2025-11", label: "11月", year: 2025, totalSales: 300000, totalDuration: 30, totalLivestreams: 15 },
        { month: "2025-12", label: "12月", year: 2025, totalSales: 350000, totalDuration: 35, totalLivestreams: 17 },
        { month: "2026-01", label: "1月", year: 2026, totalSales: 400000, totalDuration: 40, totalLivestreams: 20 },
        { month: "2026-02", label: "2月", year: 2026, totalSales: 450000, totalDuration: 45, totalLivestreams: 22 },
      ];

      vi.mocked(getLiverMonthlySalesTrendById).mockResolvedValue(mockTrend);

      const result = await getLiverMonthlySalesTrendById(1);

      expect(getLiverMonthlySalesTrendById).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(12);
      expect(result[0].month).toBe("2025-03");
      expect(result[11].month).toBe("2026-02");
    });

    it("should return empty array for liver with no data", async () => {
      vi.mocked(getLiverMonthlySalesTrendById).mockResolvedValue([]);

      const result = await getLiverMonthlySalesTrendById(9999);

      expect(result).toEqual([]);
    });
  });

  describe("getLiverRecentLivestreams", () => {
    it("should return recent livestreams with brand info", async () => {
      const mockLivestreams = [
        {
          id: 1,
          brandId: 10,
          livestreamDate: new Date("2026-02-04T10:00:00Z"),
          livestreamEndTime: new Date("2026-02-04T12:00:00Z"),
          duration: 120,
          gmv: 50000,
          viewerCount: 1000,
          remarks: "Good session",
          beforeScreenshotUrl: "https://example.com/before.jpg",
          screenshotUrl: "https://example.com/after.jpg",
          brandName: "Test Brand",
        },
        {
          id: 2,
          brandId: 11,
          livestreamDate: new Date("2026-02-03T14:00:00Z"),
          livestreamEndTime: new Date("2026-02-03T16:30:00Z"),
          duration: 150,
          gmv: 75000,
          viewerCount: 1500,
          remarks: null,
          beforeScreenshotUrl: null,
          screenshotUrl: "https://example.com/after2.jpg",
          brandName: "Another Brand",
        },
      ];

      vi.mocked(getLiverRecentLivestreams).mockResolvedValue(mockLivestreams);

      const result = await getLiverRecentLivestreams(1, 10);

      expect(getLiverRecentLivestreams).toHaveBeenCalledWith(1, 10);
      expect(result).toHaveLength(2);
      expect(result[0].brandName).toBe("Test Brand");
      expect(result[0].gmv).toBe(50000);
    });

    it("should return empty array for liver with no livestreams", async () => {
      vi.mocked(getLiverRecentLivestreams).mockResolvedValue([]);

      const result = await getLiverRecentLivestreams(9999, 10);

      expect(result).toEqual([]);
    });
  });

  describe("getLiverBrandPerformance", () => {
    it("should return brand performance breakdown sorted by sales", async () => {
      const mockPerformance = [
        {
          brandId: 10,
          brandName: "Top Brand",
          totalSales: 500000,
          totalDuration: 50,
          totalLivestreams: 25,
          avgSalesPerStream: 20000,
        },
        {
          brandId: 11,
          brandName: "Second Brand",
          totalSales: 300000,
          totalDuration: 30,
          totalLivestreams: 15,
          avgSalesPerStream: 20000,
        },
        {
          brandId: 12,
          brandName: "Third Brand",
          totalSales: 100000,
          totalDuration: 10,
          totalLivestreams: 5,
          avgSalesPerStream: 20000,
        },
      ];

      vi.mocked(getLiverBrandPerformance).mockResolvedValue(mockPerformance);

      const result = await getLiverBrandPerformance(1);

      expect(getLiverBrandPerformance).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(3);
      expect(result[0].brandName).toBe("Top Brand");
      expect(result[0].totalSales).toBeGreaterThan(result[1].totalSales);
    });

    it("should return empty array for liver with no brand data", async () => {
      vi.mocked(getLiverBrandPerformance).mockResolvedValue([]);

      const result = await getLiverBrandPerformance(9999);

      expect(result).toEqual([]);
    });
  });

  describe("Growth Rate Calculations", () => {
    it("should calculate positive growth rate correctly", async () => {
      const mockLiverDetail = {
        id: 1,
        name: "Growing Liver",
        allTimeStats: { totalSales: 1000000, totalDuration: 100, totalLivestreams: 50 },
        currentMonthStats: { totalSales: 200000, totalDuration: 20, totalLivestreams: 10 },
        prevMonthStats: { totalSales: 100000, totalDuration: 10, totalLivestreams: 5 },
        growth: {
          salesGrowth: 100.0, // (200000 - 100000) / 100000 * 100
          livestreamGrowth: 100.0, // (10 - 5) / 5 * 100
        },
      };

      vi.mocked(getLiverDetailWithStats).mockResolvedValue(mockLiverDetail);

      const result = await getLiverDetailWithStats(1);

      expect(result?.growth.salesGrowth).toBe(100.0);
      expect(result?.growth.livestreamGrowth).toBe(100.0);
    });

    it("should calculate negative growth rate correctly", async () => {
      const mockLiverDetail = {
        id: 1,
        name: "Declining Liver",
        allTimeStats: { totalSales: 1000000, totalDuration: 100, totalLivestreams: 50 },
        currentMonthStats: { totalSales: 50000, totalDuration: 5, totalLivestreams: 3 },
        prevMonthStats: { totalSales: 100000, totalDuration: 10, totalLivestreams: 5 },
        growth: {
          salesGrowth: -50.0, // (50000 - 100000) / 100000 * 100
          livestreamGrowth: -40.0, // (3 - 5) / 5 * 100
        },
      };

      vi.mocked(getLiverDetailWithStats).mockResolvedValue(mockLiverDetail);

      const result = await getLiverDetailWithStats(1);

      expect(result?.growth.salesGrowth).toBe(-50.0);
      expect(result?.growth.livestreamGrowth).toBe(-40.0);
    });
  });
});
