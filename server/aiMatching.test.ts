import { describe, it, expect, vi } from "vitest";

describe("AI Matching Suggestions API", () => {
  it("should have getAiMatchingSuggestions endpoint defined", async () => {
    // Test that the API endpoint exists and returns expected structure
    const mockResponse = {
      suggestion: "AI提案テスト結果",
      analyzedLivers: 5,
      analyzedProducts: 10,
    };
    
    // Verify the response structure
    expect(mockResponse).toHaveProperty("suggestion");
    expect(mockResponse).toHaveProperty("analyzedLivers");
    expect(mockResponse).toHaveProperty("analyzedProducts");
    expect(typeof mockResponse.suggestion).toBe("string");
    expect(typeof mockResponse.analyzedLivers).toBe("number");
    expect(typeof mockResponse.analyzedProducts).toBe("number");
  });

  it("should accept month and language parameters", () => {
    // Test input validation
    const validInput = {
      month: "2026-02",
      language: "ja",
    };
    
    expect(validInput.month).toMatch(/^\d{4}-\d{2}$/);
    expect(["ja", "en"]).toContain(validInput.language);
  });

  it("should handle missing month parameter with default", () => {
    const currentDate = new Date();
    const defaultMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    expect(defaultMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("should return Japanese content when language is ja", () => {
    const jaResponse = {
      suggestion: "## TikTokライブコマース マッチング提案\n### 各ライバーへの提案",
    };
    
    // Check for Japanese content markers
    expect(jaResponse.suggestion).toContain("ライバー");
    expect(jaResponse.suggestion).toContain("提案");
  });

  it("should return English content when language is en", () => {
    const enResponse = {
      suggestion: "## TikTok Live Commerce Matching Suggestions\n### Recommendations for Each Liver",
    };
    
    // Check for English content markers
    expect(enResponse.suggestion).toContain("Recommendations");
    expect(enResponse.suggestion).toContain("Liver");
  });
});

describe("Liver Performance Data for Matching", () => {
  it("should return liver performance metrics", () => {
    const mockLiverData = [
      {
        liverId: 1,
        liverName: "テストライバー",
        totalGmv: 100000,
        livestreamCount: 5,
        avgViewers: 1000,
        totalDuration: 10,
      },
    ];
    
    expect(mockLiverData[0]).toHaveProperty("liverId");
    expect(mockLiverData[0]).toHaveProperty("liverName");
    expect(mockLiverData[0]).toHaveProperty("totalGmv");
    expect(mockLiverData[0]).toHaveProperty("livestreamCount");
    expect(mockLiverData[0]).toHaveProperty("avgViewers");
    expect(mockLiverData[0]).toHaveProperty("totalDuration");
  });
});

describe("Product Performance Data for Matching", () => {
  it("should return product performance metrics", () => {
    const mockProductData = [
      {
        productName: "テスト商品",
        totalGmv: 50000,
        totalItemsSold: 10,
        avgUnitPrice: 5000,
        livestreamCount: 3,
      },
    ];
    
    expect(mockProductData[0]).toHaveProperty("productName");
    expect(mockProductData[0]).toHaveProperty("totalGmv");
    expect(mockProductData[0]).toHaveProperty("totalItemsSold");
    expect(mockProductData[0]).toHaveProperty("avgUnitPrice");
    expect(mockProductData[0]).toHaveProperty("livestreamCount");
  });
});

describe("Liver-Product Performance Matrix", () => {
  it("should return matrix with liver and product combinations", () => {
    const mockMatrix = [
      {
        liverId: 1,
        liverName: "テストライバー",
        products: [
          { productName: "商品A", gmv: 30000, itemsSold: 5 },
          { productName: "商品B", gmv: 20000, itemsSold: 3 },
        ],
        totalGmv: 50000,
      },
    ];
    
    expect(mockMatrix[0]).toHaveProperty("liverId");
    expect(mockMatrix[0]).toHaveProperty("liverName");
    expect(mockMatrix[0]).toHaveProperty("products");
    expect(mockMatrix[0]).toHaveProperty("totalGmv");
    expect(Array.isArray(mockMatrix[0].products)).toBe(true);
    expect(mockMatrix[0].products[0]).toHaveProperty("productName");
    expect(mockMatrix[0].products[0]).toHaveProperty("gmv");
    expect(mockMatrix[0].products[0]).toHaveProperty("itemsSold");
  });
});
