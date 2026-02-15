import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getReceiptAnalyticsOverview: vi.fn(),
  getShopRanking: vi.fn(),
  getProductRanking: vi.fn(),
  getReceiptMonthlyTrend: vi.fn(),
  getRepeaterAnalysis: vi.fn(),
  getRegionAnalysis: vi.fn(),
  getAiConfidenceAnalysis: vi.fn(),
  getTimeAnalysis: vi.fn(),
}));

import {
  getReceiptAnalyticsOverview,
  getShopRanking,
  getProductRanking,
  getReceiptMonthlyTrend,
  getRepeaterAnalysis,
  getRegionAnalysis,
  getAiConfidenceAnalysis,
  getTimeAnalysis,
} from "./db";

describe("Receipt Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReceiptAnalyticsOverview", () => {
    it("should return overview with tiktok and line receipt stats", async () => {
      const mockOverview = {
        tiktokOrders: {
          totalCount: 26354,
          totalAmount: 150000000,
          uniqueShops: 45,
          uniqueProducts: 320,
        },
        lineReceipts: {
          totalCount: 1914,
          approvedCount: 1200,
          pendingCount: 500,
          rejectedCount: 214,
          totalApprovedAmount: 8500000,
          uniqueUsers: 350,
        },
      };
      (getReceiptAnalyticsOverview as any).mockResolvedValue(mockOverview);

      const result = await getReceiptAnalyticsOverview();

      expect(result).toBeDefined();
      expect(result.tiktokOrders.totalCount).toBe(26354);
      expect(result.tiktokOrders.uniqueShops).toBe(45);
      expect(result.lineReceipts.totalCount).toBe(1914);
      expect(result.lineReceipts.approvedCount).toBe(1200);
      expect(result.lineReceipts.uniqueUsers).toBe(350);
    });
  });

  describe("getShopRanking", () => {
    it("should return shops sorted by total amount", async () => {
      const mockShops = [
        { shopName: "KYOGOKU JAPAN", orderCount: 5000, totalAmount: 25000000, lineCount: 200, tiktokCount: 4800 },
        { shopName: "モーキス Mooekiss Official", orderCount: 3000, totalAmount: 15000000, lineCount: 100, tiktokCount: 2900 },
        { shopName: "funnyElves", orderCount: 2000, totalAmount: 10000000, lineCount: 50, tiktokCount: 1950 },
      ];
      (getShopRanking as any).mockResolvedValue(mockShops);

      const result = await getShopRanking(20);

      expect(result).toHaveLength(3);
      expect(result[0].shopName).toBe("KYOGOKU JAPAN");
      expect(result[0].totalAmount).toBeGreaterThan(result[1].totalAmount);
      expect(result[0].lineCount).toBeDefined();
      expect(result[0].tiktokCount).toBeDefined();
    });

    it("should respect limit parameter", async () => {
      (getShopRanking as any).mockResolvedValue([
        { shopName: "Shop A", orderCount: 100, totalAmount: 500000, lineCount: 10, tiktokCount: 90 },
      ]);

      const result = await getShopRanking(1);

      expect(result).toHaveLength(1);
    });
  });

  describe("getProductRanking", () => {
    it("should return products with shop name and quantities", async () => {
      const mockProducts = [
        { productName: "KYOGOKU クリスタルブライト", shopName: "KYOGOKU JAPAN", orderCount: 1500, totalQuantity: 2000, avgPrice: 3715, totalAmount: 7430000 },
        { productName: "Mooekiss モーキス", shopName: "モーキス Official", orderCount: 800, totalQuantity: 1200, avgPrice: 2864, totalAmount: 3436800 },
      ];
      (getProductRanking as any).mockResolvedValue(mockProducts);

      const result = await getProductRanking(30);

      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe("KYOGOKU クリスタルブライト");
      expect(result[0].shopName).toBeDefined();
      expect(result[0].avgPrice).toBeGreaterThan(0);
      expect(result[0].totalQuantity).toBeGreaterThanOrEqual(result[0].orderCount);
    });
  });

  describe("getReceiptMonthlyTrend", () => {
    it("should return monthly data with both tiktok and line amounts", async () => {
      const mockMonthly = [
        { month: "2025-12", tiktokCount: 3000, tiktokAmount: 15000000, lineCount: 200, lineApproved: 150, lineAmount: 1200000 },
        { month: "2026-01", tiktokCount: 4000, tiktokAmount: 20000000, lineCount: 300, lineApproved: 250, lineAmount: 2000000 },
        { month: "2026-02", tiktokCount: 2000, tiktokAmount: 10000000, lineCount: 150, lineApproved: 100, lineAmount: 800000 },
      ];
      (getReceiptMonthlyTrend as any).mockResolvedValue(mockMonthly);

      const result = await getReceiptMonthlyTrend();

      expect(result).toHaveLength(3);
      expect(result[0].month).toBe("2025-12");
      expect(result[1].tiktokAmount).toBeGreaterThan(result[0].tiktokAmount);
      expect(result[0].lineApproved).toBeLessThanOrEqual(result[0].lineCount);
    });
  });

  describe("getRepeaterAnalysis", () => {
    it("should return distribution, repeat rate, and top repeaters", async () => {
      const mockRepeater = {
        distribution: [
          { label: "1回", count: 250 },
          { label: "2回", count: 60 },
          { label: "3回", count: 25 },
          { label: "4回", count: 10 },
          { label: "5回以上", count: 5 },
        ],
        topRepeaters: [
          { lineUserId: "U123", receiptCount: 12, totalAmount: 45000, approvedCount: 10, firstSubmission: "2025-12-01", lastSubmission: "2026-02-10", avgInterval: 6 },
          { lineUserId: "U456", receiptCount: 8, totalAmount: 30000, approvedCount: 7, firstSubmission: "2025-12-15", lastSubmission: "2026-02-05", avgInterval: 7 },
        ],
        totalUsers: 350,
        repeatRate: 29,
        avgPurchaseCount: 1.6,
      };
      (getRepeaterAnalysis as any).mockResolvedValue(mockRepeater);

      const result = await getRepeaterAnalysis();

      expect(result.totalUsers).toBe(350);
      expect(result.repeatRate).toBe(29);
      expect(result.avgPurchaseCount).toBe(1.6);
      expect(result.distribution).toHaveLength(5);
      expect(result.distribution[0].label).toBe("1回");
      expect(result.topRepeaters[0].receiptCount).toBeGreaterThan(result.topRepeaters[1].receiptCount);
      expect(result.topRepeaters[0].avgInterval).toBeDefined();
    });
  });

  describe("getRegionAnalysis", () => {
    it("should return prefecture-level data sorted by count", async () => {
      const mockRegions = [
        { prefecture: "東京都", count: 50, totalAmount: 250000 },
        { prefecture: "大阪府", count: 30, totalAmount: 150000 },
        { prefecture: "佐賀県", count: 20, totalAmount: 100000 },
      ];
      (getRegionAnalysis as any).mockResolvedValue(mockRegions);

      const result = await getRegionAnalysis();

      expect(result).toHaveLength(3);
      expect(result[0].prefecture).toBe("東京都");
      expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
    });

    it("should return empty array when no OCR data available", async () => {
      (getRegionAnalysis as any).mockResolvedValue([]);

      const result = await getRegionAnalysis();

      expect(result).toEqual([]);
    });
  });

  describe("getAiConfidenceAnalysis", () => {
    it("should return confidence bands with approval rates", async () => {
      const mockAi = {
        byConfidenceBand: [
          { label: "0-50%", total: 10, approved: 2, rejected: 8, approvalRate: 20 },
          { label: "50-70%", total: 20, approved: 10, rejected: 10, approvalRate: 50 },
          { label: "70-85%", total: 50, approved: 35, rejected: 15, approvalRate: 70 },
          { label: "85-95%", total: 100, approved: 85, rejected: 15, approvalRate: 85 },
          { label: "95-100%", total: 200, approved: 190, rejected: 10, approvalRate: 95 },
        ],
        totalReviewed: 380,
      };
      (getAiConfidenceAnalysis as any).mockResolvedValue(mockAi);

      const result = await getAiConfidenceAnalysis();

      expect(result.totalReviewed).toBe(380);
      expect(result.byConfidenceBand).toHaveLength(5);
      // Higher confidence should have higher approval rate
      const rates = result.byConfidenceBand.map((b: any) => b.approvalRate);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
      }
    });
  });

  describe("getTimeAnalysis", () => {
    it("should return day-of-week and hour data", async () => {
      const mockTime = {
        byDayOfWeek: [
          { day: "日", count: 100, totalAmount: 500000 },
          { day: "月", count: 200, totalAmount: 1000000 },
          { day: "火", count: 180, totalAmount: 900000 },
          { day: "水", count: 190, totalAmount: 950000 },
          { day: "木", count: 170, totalAmount: 850000 },
          { day: "金", count: 220, totalAmount: 1100000 },
          { day: "土", count: 150, totalAmount: 750000 },
        ],
        byHour: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          count: Math.floor(Math.random() * 50) + 10,
          totalAmount: Math.floor(Math.random() * 250000) + 50000,
        })),
      };
      (getTimeAnalysis as any).mockResolvedValue(mockTime);

      const result = await getTimeAnalysis();

      expect(result.byDayOfWeek).toHaveLength(7);
      expect(result.byDayOfWeek[0].day).toBe("日");
      expect(result.byHour).toHaveLength(24);
      expect(result.byHour[0].hour).toBe(0);
      expect(result.byHour[23].hour).toBe(23);
    });
  });
});
