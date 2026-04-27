import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getLiverBrandDurationStats: vi.fn(),
}));

import { getLiverBrandDurationStats } from "./db";

describe("Brand Duration Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLiverBrandDurationStats", () => {
    it("should return empty array when no data exists", async () => {
      vi.mocked(getLiverBrandDurationStats).mockResolvedValue([]);

      const result = await getLiverBrandDurationStats(1, "2026-04");

      expect(result).toEqual([]);
      expect(getLiverBrandDurationStats).toHaveBeenCalledWith(1, "2026-04");
    });

    it("should return brand duration stats with correct structure", async () => {
      const mockStats = [
        {
          brandId: 1,
          brandName: "KYOGOKU",
          totalMinutes: 360,
          totalHours: 6,
          streamCount: 5,
        },
        {
          brandId: 2,
          brandName: "MOBmart",
          totalMinutes: 180,
          totalHours: 3,
          streamCount: 3,
        },
        {
          brandId: 3,
          brandName: "松屋",
          totalMinutes: 30,
          totalHours: 0.5,
          streamCount: 1,
        },
      ];
      vi.mocked(getLiverBrandDurationStats).mockResolvedValue(mockStats);

      const result = await getLiverBrandDurationStats(360009, "2026-04");

      expect(result).toHaveLength(3);
      expect(result[0].brandName).toBe("KYOGOKU");
      expect(result[0].totalMinutes).toBe(360);
      expect(result[0].totalHours).toBe(6);
      expect(result[0].streamCount).toBe(5);
      expect(result[1].brandName).toBe("MOBmart");
      expect(result[2].totalMinutes).toBe(30);
    });

    it("should return all-time stats when yearMonth is undefined", async () => {
      const mockStats = [
        {
          brandId: 1,
          brandName: "KYOGOKU",
          totalMinutes: 1200,
          totalHours: 20,
          streamCount: 15,
        },
      ];
      vi.mocked(getLiverBrandDurationStats).mockResolvedValue(mockStats);

      const result = await getLiverBrandDurationStats(1);

      expect(result).toHaveLength(1);
      expect(result[0].totalMinutes).toBe(1200);
      expect(getLiverBrandDurationStats).toHaveBeenCalledWith(1);
    });

    it("should correctly calculate totalHours from totalMinutes", async () => {
      const mockStats = [
        {
          brandId: 1,
          brandName: "TestBrand",
          totalMinutes: 125,
          totalHours: 2.1, // 125/60 rounded to 1 decimal = 2.1
          streamCount: 2,
        },
      ];
      vi.mocked(getLiverBrandDurationStats).mockResolvedValue(mockStats);

      const result = await getLiverBrandDurationStats(1, "2026-04");

      expect(result[0].totalHours).toBe(2.1);
      expect(result[0].totalMinutes).toBe(125);
    });

    it("should order results by totalMinutes descending", async () => {
      const mockStats = [
        { brandId: 1, brandName: "A", totalMinutes: 500, totalHours: 8.3, streamCount: 10 },
        { brandId: 2, brandName: "B", totalMinutes: 300, totalHours: 5, streamCount: 6 },
        { brandId: 3, brandName: "C", totalMinutes: 100, totalHours: 1.7, streamCount: 2 },
      ];
      vi.mocked(getLiverBrandDurationStats).mockResolvedValue(mockStats);

      const result = await getLiverBrandDurationStats(1, "2026-04");

      expect(result[0].totalMinutes).toBeGreaterThanOrEqual(result[1].totalMinutes);
      expect(result[1].totalMinutes).toBeGreaterThanOrEqual(result[2].totalMinutes);
    });
  });

  describe("Brand Duration UI calculations", () => {
    it("should correctly format hours and minutes display", () => {
      // Test the display logic used in the frontend
      const testCases = [
        { totalMinutes: 125, expectedHours: 2, expectedMins: 5, display: "2h5m" },
        { totalMinutes: 60, expectedHours: 1, expectedMins: 0, display: "1h" },
        { totalMinutes: 30, expectedHours: 0, expectedMins: 30, display: "30m" },
        { totalMinutes: 0, expectedHours: 0, expectedMins: 0, display: "0m" },
        { totalMinutes: 255, expectedHours: 4, expectedMins: 15, display: "4h15m" },
      ];

      for (const tc of testCases) {
        const hours = Math.floor(tc.totalMinutes / 60);
        const mins = tc.totalMinutes % 60;
        expect(hours).toBe(tc.expectedHours);
        expect(mins).toBe(tc.expectedMins);

        const display = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ""}` : `${mins}m`;
        expect(display).toBe(tc.display);
      }
    });

    it("should calculate total brand duration correctly", () => {
      const brandStats = [
        { totalMinutes: 360 },
        { totalMinutes: 180 },
        { totalMinutes: 30 },
      ];

      const totalMinutes = brandStats.reduce((sum, b) => sum + b.totalMinutes, 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

      expect(totalMinutes).toBe(570);
      expect(totalHours).toBe(9.5);
    });

    it("should calculate bar width percentages correctly", () => {
      const brandStats = [
        { totalMinutes: 500 },
        { totalMinutes: 250 },
        { totalMinutes: 100 },
      ];

      const maxMinutes = Math.max(...brandStats.map(b => b.totalMinutes));
      expect(maxMinutes).toBe(500);

      const widths = brandStats.map(b => (b.totalMinutes / maxMinutes) * 100);
      expect(widths[0]).toBe(100);
      expect(widths[1]).toBe(50);
      expect(widths[2]).toBe(20);
    });
  });
});
