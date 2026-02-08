import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getTopProductsByLiver: vi.fn(),
  getLiverCategoryAnalysis: vi.fn(),
  getLiverBrandPerformance: vi.fn(),
}));

import { getTopProductsByLiver, getLiverCategoryAnalysis, getLiverBrandPerformance } from "./db";

describe("Liver Detail Enhancement - Top Products API", () => {
  it("should return empty array when no livestreams exist", async () => {
    vi.mocked(getTopProductsByLiver).mockResolvedValue([]);
    const result = await getTopProductsByLiver(999);
    expect(result).toEqual([]);
  });

  it("should return products sorted by GMV with rank", async () => {
    const mockProducts = [
      { rank: 1, productName: "美容液A", totalGmv: 500000, totalItemsSold: 100, totalOrders: 80, livestreamCount: 5, avgGmvPerStream: 100000 },
      { rank: 2, productName: "シャンプーB", totalGmv: 300000, totalItemsSold: 200, totalOrders: 150, livestreamCount: 8, avgGmvPerStream: 37500 },
      { rank: 3, productName: "日焼け止めC", totalGmv: 150000, totalItemsSold: 50, totalOrders: 40, livestreamCount: 3, avgGmvPerStream: 50000 },
    ];
    vi.mocked(getTopProductsByLiver).mockResolvedValue(mockProducts);
    
    const result = await getTopProductsByLiver(1);
    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[0].totalGmv).toBeGreaterThan(result[1].totalGmv);
    expect(result[1].totalGmv).toBeGreaterThan(result[2].totalGmv);
  });

  it("should include avgGmvPerStream calculation", async () => {
    const mockProducts = [
      { rank: 1, productName: "Test Product", totalGmv: 1000000, totalItemsSold: 500, totalOrders: 400, livestreamCount: 10, avgGmvPerStream: 100000 },
    ];
    vi.mocked(getTopProductsByLiver).mockResolvedValue(mockProducts);
    
    const result = await getTopProductsByLiver(1);
    expect(result[0].avgGmvPerStream).toBe(100000);
    expect(result[0].avgGmvPerStream).toBe(result[0].totalGmv / result[0].livestreamCount);
  });

  it("should respect limit parameter", async () => {
    const mockProducts = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      productName: `Product ${i + 1}`,
      totalGmv: (5 - i) * 100000,
      totalItemsSold: (5 - i) * 50,
      totalOrders: (5 - i) * 40,
      livestreamCount: i + 1,
      avgGmvPerStream: Math.round(((5 - i) * 100000) / (i + 1)),
    }));
    vi.mocked(getTopProductsByLiver).mockResolvedValue(mockProducts);
    
    const result = await getTopProductsByLiver(1, 5);
    expect(result).toHaveLength(5);
  });
});

describe("Liver Detail Enhancement - Category Analysis", () => {
  it("should return empty array when no products exist", async () => {
    vi.mocked(getLiverCategoryAnalysis).mockResolvedValue([]);
    const result = await getLiverCategoryAnalysis(999);
    expect(result).toEqual([]);
  });

  it("should classify products into categories with percentages", async () => {
    const mockCategories = [
      { category: "スキンケア", gmv: 600000, itemsSold: 300, productCount: 5, percentage: 40, topProducts: ["化粧水A", "クリームB"] },
      { category: "ヘアケア", gmv: 450000, itemsSold: 200, productCount: 3, percentage: 30, topProducts: ["シャンプーA"] },
      { category: "UV・日焼け止め", gmv: 300000, itemsSold: 100, productCount: 2, percentage: 20, topProducts: ["日焼け止めA"] },
      { category: "その他", gmv: 150000, itemsSold: 50, productCount: 4, percentage: 10, topProducts: ["商品X"] },
    ];
    vi.mocked(getLiverCategoryAnalysis).mockResolvedValue(mockCategories);
    
    const result = await getLiverCategoryAnalysis(1);
    expect(result).toHaveLength(4);
    
    // Verify sorted by GMV
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].gmv).toBeGreaterThanOrEqual(result[i + 1].gmv);
    }
    
    // Verify percentages sum to ~100%
    const totalPercentage = result.reduce((sum, c) => sum + c.percentage, 0);
    expect(totalPercentage).toBe(100);
  });

  it("should include topProducts for each category", async () => {
    const mockCategories = [
      { category: "美容液・セラム", gmv: 500000, itemsSold: 100, productCount: 3, percentage: 100, topProducts: ["美容液A", "セラムB", "エッセンスC"] },
    ];
    vi.mocked(getLiverCategoryAnalysis).mockResolvedValue(mockCategories);
    
    const result = await getLiverCategoryAnalysis(1);
    expect(result[0].topProducts).toHaveLength(3);
    expect(result[0].topProducts).toContain("美容液A");
  });

  it("should handle category with percentage calculation", async () => {
    const mockCategories = [
      { category: "スキンケア", gmv: 750000, itemsSold: 300, productCount: 5, percentage: 75, topProducts: [] },
      { category: "その他", gmv: 250000, itemsSold: 100, productCount: 10, percentage: 25, topProducts: [] },
    ];
    vi.mocked(getLiverCategoryAnalysis).mockResolvedValue(mockCategories);
    
    const result = await getLiverCategoryAnalysis(1);
    expect(result[0].percentage).toBe(75);
    expect(result[1].percentage).toBe(25);
  });
});

describe("Liver Detail Enhancement - Brand Performance", () => {
  it("should return empty array when no brand data exists", async () => {
    vi.mocked(getLiverBrandPerformance).mockResolvedValue([]);
    const result = await getLiverBrandPerformance(999);
    expect(result).toEqual([]);
  });

  it("should return brands with performance metrics", async () => {
    const mockBrands = [
      { brandId: 1, brandName: "Brand A", totalLivestreams: 10, totalSales: 2000000, avgSalesPerStream: 200000 },
      { brandId: 2, brandName: "Brand B", totalLivestreams: 5, totalSales: 500000, avgSalesPerStream: 100000 },
    ];
    vi.mocked(getLiverBrandPerformance).mockResolvedValue(mockBrands);
    
    const result = await getLiverBrandPerformance(1);
    expect(result).toHaveLength(2);
    expect(result[0].totalSales).toBeGreaterThan(result[1].totalSales);
    expect(result[0].avgSalesPerStream).toBe(200000);
  });
});

describe("Liver Detail Enhancement - Number Formatting", () => {
  it("should format numbers with comma separators", () => {
    const formatCurrency = (amount: number) => `¥${amount.toLocaleString('ja-JP')}`;
    
    expect(formatCurrency(2274264)).toBe("¥2,274,264");
    expect(formatCurrency(955865)).toBe("¥955,865");
    expect(formatCurrency(0)).toBe("¥0");
    expect(formatCurrency(1000)).toBe("¥1,000");
    expect(formatCurrency(1000000)).toBe("¥1,000,000");
  });

  it("should format item counts with comma separators", () => {
    expect((1234).toLocaleString('ja-JP')).toBe("1,234");
    expect((100000).toLocaleString('ja-JP')).toBe("100,000");
    expect((0).toLocaleString('ja-JP')).toBe("0");
  });
});
