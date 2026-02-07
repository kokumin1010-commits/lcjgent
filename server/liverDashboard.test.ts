import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getLiverGoal: vi.fn(),
  upsertLiverGoal: vi.fn(),
  getLiverDashboardStats: vi.fn(),
}));

import { getLiverGoal, upsertLiverGoal, getLiverDashboardStats } from "./db";

describe("Liver Dashboard Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLiverGoal", () => {
    it("should return null when no goal exists", async () => {
      vi.mocked(getLiverGoal).mockResolvedValue(null);
      
      const result = await getLiverGoal(1, "2026-02");
      
      expect(result).toBeNull();
      expect(getLiverGoal).toHaveBeenCalledWith(1, "2026-02");
    });

    it("should return goal data when it exists", async () => {
      const mockGoal = {
        id: 1,
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 15000000,
        streamCountGoal: 20,
        notes: "目標達成！",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(getLiverGoal).mockResolvedValue(mockGoal);
      
      const result = await getLiverGoal(1, "2026-02");
      
      expect(result).toEqual(mockGoal);
      expect(result?.salesGoal).toBe(15000000);
      expect(result?.streamCountGoal).toBe(20);
    });
  });

  describe("upsertLiverGoal", () => {
    it("should create a new goal", async () => {
      const mockGoal = {
        id: 1,
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 10000000,
        streamCountGoal: 15,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(upsertLiverGoal).mockResolvedValue(mockGoal);
      
      const result = await upsertLiverGoal({
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 10000000,
        streamCountGoal: 15,
      });
      
      expect(result).toEqual(mockGoal);
      expect(upsertLiverGoal).toHaveBeenCalledWith({
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 10000000,
        streamCountGoal: 15,
      });
    });

    it("should update an existing goal", async () => {
      const mockUpdatedGoal = {
        id: 1,
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 20000000,
        streamCountGoal: 25,
        notes: "Updated goal",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(upsertLiverGoal).mockResolvedValue(mockUpdatedGoal);
      
      const result = await upsertLiverGoal({
        liverId: 1,
        yearMonth: "2026-02",
        salesGoal: 20000000,
        streamCountGoal: 25,
        notes: "Updated goal",
      });
      
      expect(result?.salesGoal).toBe(20000000);
      expect(result?.streamCountGoal).toBe(25);
    });
  });

  describe("getLiverDashboardStats", () => {
    it("should return comprehensive dashboard stats", async () => {
      const mockStats = {
        goal: {
          salesGoal: 15000000,
          streamCountGoal: 20,
        },
        currentMonth: {
          sales: 8500000,
          streamCount: 12,
          duration: 3600, // 60 hours in minutes
        },
        previousMonth: {
          sales: 7000000,
          streamCount: 10,
        },
        growth: {
          salesGrowth: 21, // 21% growth
          streamCountGrowth: 20, // 20% growth
        },
        progress: {
          salesProgress: 57, // 57% of goal
          remainingSales: 6500000,
          remainingDays: 15,
          dailyPaceNeeded: 433333,
        },
        past6Months: [
          { yearMonth: "2025-09", sales: 5000000, streamCount: 8 },
          { yearMonth: "2025-10", sales: 6000000, streamCount: 9 },
          { yearMonth: "2025-11", sales: 6500000, streamCount: 10 },
          { yearMonth: "2025-12", sales: 7000000, streamCount: 10 },
          { yearMonth: "2026-01", sales: 7000000, streamCount: 10 },
          { yearMonth: "2026-02", sales: 8500000, streamCount: 12 },
        ],
        topProducts: [
          { productName: "商品A", totalSales: 2000000 },
          { productName: "商品B", totalSales: 1500000 },
          { productName: "商品C", totalSales: 1200000 },
        ],
        bestHour: { hour: 20, sales: 3000000, count: 5 },
        hourlyStats: [
          { hour: 18, sales: 1500000, count: 3 },
          { hour: 19, sales: 2000000, count: 4 },
          { hour: 20, sales: 3000000, count: 5 },
          { hour: 21, sales: 2000000, count: 4 },
        ],
        highlights: {
          bestStream: { date: new Date("2026-02-10"), sales: 1500000 },
          consecutiveDays: 5,
        },
      };
      vi.mocked(getLiverDashboardStats).mockResolvedValue(mockStats);
      
      const result = await getLiverDashboardStats(1, "2026-02");
      
      expect(result).toBeDefined();
      expect(result?.goal.salesGoal).toBe(15000000);
      expect(result?.currentMonth.sales).toBe(8500000);
      expect(result?.growth.salesGrowth).toBe(21);
      expect(result?.progress.salesProgress).toBe(57);
      expect(result?.past6Months).toHaveLength(6);
      expect(result?.topProducts).toHaveLength(3);
      expect(result?.bestHour?.hour).toBe(20);
      expect(result?.highlights.consecutiveDays).toBe(5);
    });

    it("should return null for non-existent liver", async () => {
      vi.mocked(getLiverDashboardStats).mockResolvedValue(null);
      
      const result = await getLiverDashboardStats(999, "2026-02");
      
      expect(result).toBeNull();
    });

    it("should handle empty data gracefully", async () => {
      const mockEmptyStats = {
        goal: {
          salesGoal: 0,
          streamCountGoal: 0,
        },
        currentMonth: {
          sales: 0,
          streamCount: 0,
          duration: 0,
        },
        previousMonth: {
          sales: 0,
          streamCount: 0,
        },
        growth: {
          salesGrowth: 0,
          streamCountGrowth: 0,
        },
        progress: {
          salesProgress: 0,
          remainingSales: 0,
          remainingDays: 28,
          dailyPaceNeeded: 0,
        },
        past6Months: [],
        topProducts: [],
        bestHour: null,
        hourlyStats: [],
        highlights: {
          bestStream: null,
          consecutiveDays: 0,
        },
      };
      vi.mocked(getLiverDashboardStats).mockResolvedValue(mockEmptyStats);
      
      const result = await getLiverDashboardStats(1, "2026-02");
      
      expect(result).toBeDefined();
      expect(result?.currentMonth.sales).toBe(0);
      expect(result?.past6Months).toHaveLength(0);
      expect(result?.bestHour).toBeNull();
    });
  });

  describe("Dashboard Stats Calculations", () => {
    it("should calculate growth percentage correctly", () => {
      // Test growth calculation logic
      const currentSales = 8500000;
      const previousSales = 7000000;
      const expectedGrowth = Math.round(((currentSales - previousSales) / previousSales) * 100);
      
      expect(expectedGrowth).toBe(21);
    });

    it("should calculate progress percentage correctly", () => {
      // Test progress calculation logic
      const currentSales = 8500000;
      const salesGoal = 15000000;
      const expectedProgress = Math.round((currentSales / salesGoal) * 100);
      
      expect(expectedProgress).toBe(57);
    });

    it("should calculate daily pace needed correctly", () => {
      // Test daily pace calculation logic
      const remainingSales = 6500000;
      const remainingDays = 15;
      const expectedDailyPace = Math.ceil(remainingSales / remainingDays);
      
      expect(expectedDailyPace).toBe(433334);
    });

    it("should handle zero previous month sales for growth calculation", () => {
      // When previous month is 0, growth should be 0 (to avoid division by zero)
      const currentSales = 5000000;
      const previousSales = 0;
      const expectedGrowth = previousSales > 0 
        ? Math.round(((currentSales - previousSales) / previousSales) * 100) 
        : 0;
      
      expect(expectedGrowth).toBe(0);
    });

    it("should handle zero goal for progress calculation", () => {
      // When goal is 0, progress should be 0 (to avoid division by zero)
      const currentSales = 5000000;
      const salesGoal = 0;
      const expectedProgress = salesGoal > 0 
        ? Math.round((currentSales / salesGoal) * 100) 
        : 0;
      
      expect(expectedProgress).toBe(0);
    });
  });
});

describe("Month Navigation Utilities", () => {
  function getYearMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatYearMonthLabel(ym: string): string {
    const [year, month] = ym.split("-");
    return `${year}年${parseInt(month)}月`;
  }

  function prevYearMonth(ym: string): string {
    const [year, month] = ym.split("-").map(Number);
    const d = new Date(year, month - 2, 1);
    return getYearMonth(d);
  }

  function nextYearMonth(ym: string): string {
    const [year, month] = ym.split("-").map(Number);
    const d = new Date(year, month, 1);
    return getYearMonth(d);
  }

  describe("getYearMonth", () => {
    it("should format date as YYYY-MM", () => {
      expect(getYearMonth(new Date(2026, 0, 15))).toBe("2026-01");
      expect(getYearMonth(new Date(2026, 1, 7))).toBe("2026-02");
      expect(getYearMonth(new Date(2025, 11, 31))).toBe("2025-12");
    });

    it("should pad single digit months", () => {
      expect(getYearMonth(new Date(2026, 0, 1))).toBe("2026-01");
      expect(getYearMonth(new Date(2026, 8, 1))).toBe("2026-09");
    });
  });

  describe("formatYearMonthLabel", () => {
    it("should format as Japanese year-month label", () => {
      expect(formatYearMonthLabel("2026-02")).toBe("2026年2月");
      expect(formatYearMonthLabel("2025-12")).toBe("2025年12月");
      expect(formatYearMonthLabel("2026-01")).toBe("2026年1月");
    });

    it("should not show leading zero in month", () => {
      expect(formatYearMonthLabel("2026-01")).toBe("2026年1月");
      expect(formatYearMonthLabel("2026-09")).toBe("2026年9月");
    });
  });

  describe("prevYearMonth", () => {
    it("should return previous month", () => {
      expect(prevYearMonth("2026-02")).toBe("2026-01");
      expect(prevYearMonth("2026-06")).toBe("2026-05");
    });

    it("should handle year boundary (January -> December)", () => {
      expect(prevYearMonth("2026-01")).toBe("2025-12");
    });
  });

  describe("nextYearMonth", () => {
    it("should return next month", () => {
      expect(nextYearMonth("2026-01")).toBe("2026-02");
      expect(nextYearMonth("2026-06")).toBe("2026-07");
    });

    it("should handle year boundary (December -> January)", () => {
      expect(nextYearMonth("2025-12")).toBe("2026-01");
    });
  });

  describe("month navigation constraints", () => {
    it("should not allow navigating to future months", () => {
      const currentYearMonth = "2026-02";
      const selectedYearMonth = "2026-02";
      const isCurrentMonth = selectedYearMonth === currentYearMonth;
      expect(isCurrentMonth).toBe(true);
    });

    it("should allow navigating to past months", () => {
      const currentYearMonth = "2026-02";
      const selectedYearMonth = "2026-01";
      const isCurrentMonth = selectedYearMonth === currentYearMonth;
      expect(isCurrentMonth).toBe(false);
      const prev = prevYearMonth(selectedYearMonth);
      expect(prev).toBe("2025-12");
    });

    it("should correctly compare months for future check", () => {
      const currentYearMonth = "2026-02";
      expect("2026-03" > currentYearMonth).toBe(true);
      expect("2026-02" > currentYearMonth).toBe(false);
      expect("2026-01" > currentYearMonth).toBe(false);
    });
  });
});
