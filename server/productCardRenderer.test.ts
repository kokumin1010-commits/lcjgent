import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db functions before importing
vi.mock("./db", () => ({
  getMallProductById: vi.fn(),
  getAllProductReviewStats: vi.fn(),
  getAllMallProductBuyerCounts: vi.fn(),
  getMallProductSalesRanking: vi.fn(),
  findRelatedProductsForArticle: vi.fn(),
}));

import {
  renderProductRankingHtml,
  renderProductGrid,
  renderProductComparisonTable,
  replaceProductCardPlaceholders,
  buildProductDataForLLMPrompt,
  postProcessArticleHtml,
  fetchEnrichedProductData,
  type ProductCardData,
} from "./productCardRenderer";

import {
  getMallProductById,
  getAllProductReviewStats,
  getAllMallProductBuyerCounts,
  getMallProductSalesRanking,
  findRelatedProductsForArticle,
} from "./db";

const mockProduct: ProductCardData = {
  id: 1,
  name: "テスト美容液",
  price: 3980,
  pointPrice: 2980,
  imageUrl: "https://example.com/product1.jpg",
  brandName: "テストブランド",
  categoryName: "スキンケア",
  avgRating: 4.5,
  totalReviews: 120,
  buyerCount: 350,
  orderCount: 500,
};

const mockProduct2: ProductCardData = {
  id: 2,
  name: "テストシャンプー",
  price: 2500,
  pointPrice: null,
  imageUrl: "https://example.com/product2.jpg",
  brandName: "ヘアブランド",
  categoryName: "ヘアケア",
  avgRating: 3.8,
  totalReviews: 45,
  buyerCount: 100,
};

const mockProduct3: ProductCardData = {
  id: 3,
  name: "テストクリーム",
  price: 5500,
  imageUrl: null,
  brandName: null,
  avgRating: undefined,
  totalReviews: 0,
  buyerCount: 0,
};

describe("productCardRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("renderProductRankingHtml", () => {
    it("returns empty string for empty array", () => {
      expect(renderProductRankingHtml([])).toBe("");
    });

    it("renders ranking with product images and data", () => {
      const html = renderProductRankingHtml([mockProduct, mockProduct2], "テストランキング");
      
      // Should contain title
      expect(html).toContain("テストランキング");
      
      // Should contain product names
      expect(html).toContain("テスト美容液");
      expect(html).toContain("テストシャンプー");
      
      // Should contain product images
      expect(html).toContain("https://example.com/product1.jpg");
      expect(html).toContain("https://example.com/product2.jpg");
      
      // Should contain prices
      expect(html).toContain("¥3,980");
      expect(html).toContain("¥2,500");
      
      // Should contain ratings
      expect(html).toContain("★4.5");
      expect(html).toContain("★3.8");
      
      // Should contain buyer counts
      expect(html).toContain("350人が購入");
      expect(html).toContain("100人が購入");
      
      // Should contain brand names
      expect(html).toContain("テストブランド");
      expect(html).toContain("ヘアブランド");
      
      // Should contain links to product pages
      expect(html).toContain("/mall/products/1");
      expect(html).toContain("/mall/products/2");
      
      // Should have ranking class
      expect(html).toContain('class="product-ranking"');
    });

    it("handles products without images gracefully", () => {
      const html = renderProductRankingHtml([mockProduct3]);
      expect(html).toContain("No Image");
      expect(html).toContain("テストクリーム");
    });
  });

  describe("renderProductGrid", () => {
    it("returns empty string for empty array", () => {
      expect(renderProductGrid([])).toBe("");
    });

    it("renders product grid with cards", () => {
      const html = renderProductGrid([mockProduct, mockProduct2]);
      
      expect(html).toContain('class="product-grid"');
      expect(html).toContain('class="product-card"');
      expect(html).toContain("テスト美容液");
      expect(html).toContain("テストシャンプー");
      expect(html).toContain("https://example.com/product1.jpg");
    });
  });

  describe("renderProductComparisonTable", () => {
    it("returns empty string for empty array", () => {
      expect(renderProductComparisonTable([])).toBe("");
    });

    it("renders comparison table with product data", () => {
      const html = renderProductComparisonTable([mockProduct, mockProduct2]);
      
      expect(html).toContain("<table");
      expect(html).toContain("テスト美容液");
      expect(html).toContain("テストシャンプー");
      expect(html).toContain("¥3,980");
      expect(html).toContain("¥2,500");
      expect(html).toContain("★4.5");
      expect(html).toContain("350人");
      expect(html).toContain("テストブランド");
      expect(html).toContain("詳細を見る");
    });
  });

  describe("fetchEnrichedProductData", () => {
    it("fetches and enriches product data with reviews and buyer counts", async () => {
      (getMallProductById as any).mockResolvedValueOnce({
        id: 1, name: "テスト美容液", price: 3980, pointPrice: 2980, imageUrl: "https://example.com/product1.jpg",
      });
      (getAllProductReviewStats as any).mockResolvedValue({
        1: { avgRating: 4.5, totalReviews: 120 },
      });
      (getAllMallProductBuyerCounts as any).mockResolvedValue({
        1: 350,
      });

      const result = await fetchEnrichedProductData([1]);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe("テスト美容液");
      expect(result[0].avgRating).toBe(4.5);
      expect(result[0].totalReviews).toBe(120);
      expect(result[0].buyerCount).toBe(350);
    });

    it("skips products that don't exist", async () => {
      (getMallProductById as any).mockResolvedValueOnce(null);
      (getAllProductReviewStats as any).mockResolvedValue({});
      (getAllMallProductBuyerCounts as any).mockResolvedValue({});

      const result = await fetchEnrichedProductData([999]);
      expect(result).toHaveLength(0);
    });
  });

  describe("replaceProductCardPlaceholders", () => {
    it("returns unchanged HTML when no placeholders exist", async () => {
      const html = "<p>Hello world</p>";
      const result = await replaceProductCardPlaceholders(html);
      expect(result).toBe(html);
    });

    it("replaces product-card placeholders with rich cards", async () => {
      (getMallProductById as any).mockResolvedValueOnce({
        id: 1, name: "テスト美容液", price: 3980, pointPrice: null, imageUrl: "https://example.com/product1.jpg",
      });
      (getAllProductReviewStats as any).mockResolvedValue({
        1: { avgRating: 4.5, totalReviews: 120 },
      });
      (getAllMallProductBuyerCounts as any).mockResolvedValue({ 1: 350 });

      const html = '<p>おすすめ商品:</p><div data-type="product-card" data-product-id="1"></div><p>以上です</p>';
      const result = await replaceProductCardPlaceholders(html);
      
      // Placeholder should be replaced
      expect(result).not.toContain('data-type="product-card"');
      
      // Should contain product card HTML
      expect(result).toContain('class="product-card"');
      expect(result).toContain("テスト美容液");
      expect(result).toContain("https://example.com/product1.jpg");
      expect(result).toContain("¥3,980");
      
      // Surrounding HTML should be preserved
      expect(result).toContain("おすすめ商品:");
      expect(result).toContain("以上です");
    });
  });

  describe("buildProductDataForLLMPrompt", () => {
    it("builds context with product data including image URLs", async () => {
      (getMallProductSalesRanking as any).mockResolvedValue([
        { id: 1, name: "テスト美容液", price: 3980, pointPrice: 2980, imageUrl: "https://example.com/product1.jpg", brandName: "テストブランド", categoryName: "スキンケア", orderCount: 500 },
      ]);
      (getAllMallProductBuyerCounts as any).mockResolvedValue({ 1: 350 });
      (getAllProductReviewStats as any).mockResolvedValue({
        1: { avgRating: 4.5, totalReviews: 120 },
      });
      (findRelatedProductsForArticle as any).mockResolvedValue([
        { id: 2, name: "テストシャンプー", price: 2500, pointPrice: null, imageUrl: "https://example.com/product2.jpg", brandName: "ヘアブランド" },
      ]);

      const result = await buildProductDataForLLMPrompt("美容液", 10);
      
      // Context should contain product data
      expect(result.context).toContain("テスト美容液");
      expect(result.context).toContain("商品ID: 1");
      expect(result.context).toContain("https://example.com/product1.jpg");
      expect(result.context).toContain("¥3,980");
      expect(result.context).toContain("★4.5");
      expect(result.context).toContain("350人");
      
      // Context should contain placeholder instructions
      expect(result.context).toContain('data-type="product-card"');
      expect(result.context).toContain('data-product-id="1"');
      
      // Should return enriched data arrays
      expect(result.salesRanking).toHaveLength(1);
      expect(result.salesRanking[0].imageUrl).toBe("https://example.com/product1.jpg");
      expect(result.relatedProducts).toHaveLength(1);
      expect(result.relatedProducts[0].imageUrl).toBe("https://example.com/product2.jpg");
    });
  });

  describe("postProcessArticleHtml", () => {
    it("adds ranking section when no product cards exist in HTML", async () => {
      (getMallProductById as any).mockResolvedValue(null);
      (getAllProductReviewStats as any).mockResolvedValue({});
      (getAllMallProductBuyerCounts as any).mockResolvedValue({});

      const html = "<p>記事本文です</p>";
      const result = await postProcessArticleHtml(html, [mockProduct, mockProduct2], []);
      
      // Should add ranking section
      expect(result).toContain('class="product-ranking"');
      expect(result).toContain("テスト美容液");
      expect(result).toContain("テストシャンプー");
    });

    it("adds related product grid when available", async () => {
      (getMallProductById as any).mockResolvedValue(null);
      (getAllProductReviewStats as any).mockResolvedValue({});
      (getAllMallProductBuyerCounts as any).mockResolvedValue({});

      const html = "<p>記事本文です</p>";
      const result = await postProcessArticleHtml(html, [], [mockProduct, mockProduct2]);
      
      // Should add product grid
      expect(result).toContain('class="product-grid"');
      expect(result).toContain("関連するおすすめ商品");
    });

    it("preserves existing product cards and does not add duplicates", async () => {
      (getAllProductReviewStats as any).mockResolvedValue({});
      (getAllMallProductBuyerCounts as any).mockResolvedValue({});

      const html = '<p>記事本文です</p><div class="product-card">既存カード</div>';
      const result = await postProcessArticleHtml(html, [mockProduct], []);
      
      // Should NOT add ranking section since product cards already exist
      expect(result).not.toContain("売れ筋ランキング");
    });
  });
});
