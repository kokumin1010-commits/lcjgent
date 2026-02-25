import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getReviewProductList: vi.fn(),
  bulkUpdateProductSourceUrls: vi.fn(),
}));

import { getReviewProductList, bulkUpdateProductSourceUrls } from "./db";

describe("getReviewProductList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated product list with default parameters", async () => {
    const mockResult = {
      products: [
        {
          productName: "テスト商品A",
          brandName: "ブランドA",
          category: "スキンケア",
          reviewCount: 10,
          avgRating: 4.5,
          latestReviewDate: "2025-01-01",
          imageCount: 3,
          latestImageUrl: "https://example.com/img.jpg",
          productMasterId: 1,
          masterCanonicalName: "テスト商品A",
          masterImageUrl: null,
          masterImageStatus: "none",
          masterSourceUrl: null,
        },
      ],
      totalCount: 100,
      page: 1,
      totalPages: 4,
    };

    (getReviewProductList as any).mockResolvedValue(mockResult);

    const result = await getReviewProductList({
      page: 1,
      limit: 30,
      sortBy: "reviewCount",
      imageFilter: "all",
    });

    expect(result).toEqual(mockResult);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].productName).toBe("テスト商品A");
    expect(result.totalCount).toBe(100);
    expect(result.page).toBe(1);
  });

  it("should support search query filtering", async () => {
    const mockResult = {
      products: [
        {
          productName: "KYOGOKU MEGAガチャ袋",
          brandName: "KYOGOKU",
          category: "ヘアケア",
          reviewCount: 5,
          avgRating: 4.2,
          latestReviewDate: "2025-02-01",
          imageCount: 1,
          latestImageUrl: null,
          productMasterId: null,
          masterCanonicalName: null,
          masterImageUrl: null,
          masterImageStatus: null,
          masterSourceUrl: null,
        },
      ],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    };

    (getReviewProductList as any).mockResolvedValue(mockResult);

    const result = await getReviewProductList({
      query: "KYOGOKU",
      page: 1,
      limit: 30,
      sortBy: "reviewCount",
      imageFilter: "all",
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].productName).toContain("KYOGOKU");
  });

  it("should support image filter", async () => {
    const mockResult = {
      products: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
    };

    (getReviewProductList as any).mockResolvedValue(mockResult);

    const result = await getReviewProductList({
      page: 1,
      limit: 30,
      sortBy: "reviewCount",
      imageFilter: "without_image",
    });

    expect(result.products).toHaveLength(0);
  });

  it("should support different sort options", async () => {
    const mockResult = {
      products: [
        {
          productName: "A商品",
          brandName: null,
          category: null,
          reviewCount: 1,
          avgRating: 5.0,
          latestReviewDate: "2025-01-01",
          imageCount: 0,
          latestImageUrl: null,
          productMasterId: null,
          masterCanonicalName: null,
          masterImageUrl: null,
          masterImageStatus: null,
          masterSourceUrl: null,
        },
      ],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    };

    (getReviewProductList as any).mockResolvedValue(mockResult);

    const result = await getReviewProductList({
      page: 1,
      limit: 30,
      sortBy: "avgRating",
      imageFilter: "all",
    });

    expect(result.products[0].avgRating).toBe(5.0);
  });
});

describe("bulkUpdateProductSourceUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process bulk URL updates", async () => {
    const mockResult = [
      { productName: "商品A", success: true, productMasterId: 1 },
      { productName: "商品B", success: true, productMasterId: 2 },
    ];

    (bulkUpdateProductSourceUrls as any).mockResolvedValue(mockResult);

    const result = await bulkUpdateProductSourceUrls([
      { productName: "商品A", sourceUrl: "https://example.com/a" },
      { productName: "商品B", sourceUrl: "https://example.com/b" },
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((r: any) => r.success)).toBe(true);
  });

  it("should handle partial failures", async () => {
    const mockResult = [
      { productName: "商品A", success: true, productMasterId: 1 },
      { productName: "商品B", success: false, error: "Database error" },
    ];

    (bulkUpdateProductSourceUrls as any).mockResolvedValue(mockResult);

    const result = await bulkUpdateProductSourceUrls([
      { productName: "商品A", sourceUrl: "https://example.com/a" },
      { productName: "商品B", sourceUrl: "https://example.com/b" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].success).toBe(true);
    expect(result[1].success).toBe(false);
    expect(result[1].error).toBe("Database error");
  });
});
