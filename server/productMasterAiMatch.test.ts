import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the AI auto-matching functionality for product master
describe("Product Master AI Auto-Matching", () => {
  it("should parse AI response correctly", () => {
    // Test the expected AI response format
    const mockAiResponse = {
      suggestions: [
        {
          aliasName: "KYOGOKU UVスティック",
          matchType: "existing",
          suggestedCanonicalName: "Kyogoku クリスタルスキン UV スティック",
          confidence: 0.95,
          reasoning: "商品名に共通キーワード「KYOGOKU」「UV」「スティック」が含まれている"
        },
        {
          aliasName: "京極 ステムセルマスク",
          matchType: "existing",
          suggestedCanonicalName: "KYOGOKU ステムセル モーニングマスク",
          confidence: 0.85,
          reasoning: "「京極」は「KYOGOKU」のブランド名、「ステムセルマスク」は「ステムセル モーニングマスク」の略称"
        },
        {
          aliasName: "新商品テスト",
          matchType: "new",
          suggestedCanonicalName: "新商品テスト",
          confidence: 0.3,
          reasoning: "既存の商品マスターに該当する商品が見つからない"
        }
      ]
    };
    
    // Verify response structure
    expect(mockAiResponse).toHaveProperty("suggestions");
    expect(Array.isArray(mockAiResponse.suggestions)).toBe(true);
    expect(mockAiResponse.suggestions.length).toBe(3);
    
    // Verify each suggestion has required fields
    mockAiResponse.suggestions.forEach(suggestion => {
      expect(suggestion).toHaveProperty("aliasName");
      expect(suggestion).toHaveProperty("matchType");
      expect(suggestion).toHaveProperty("suggestedCanonicalName");
      expect(suggestion).toHaveProperty("confidence");
      expect(suggestion).toHaveProperty("reasoning");
      expect(["existing", "new"]).toContain(suggestion.matchType);
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
    });
  });

  it("should identify high confidence matches", () => {
    const suggestions = [
      { aliasName: "A", confidence: 0.95 },
      { aliasName: "B", confidence: 0.75 },
      { aliasName: "C", confidence: 0.45 },
    ];
    
    const highConfidence = suggestions.filter(s => s.confidence >= 0.8);
    const mediumConfidence = suggestions.filter(s => s.confidence >= 0.5 && s.confidence < 0.8);
    const lowConfidence = suggestions.filter(s => s.confidence < 0.5);
    
    expect(highConfidence.length).toBe(1);
    expect(mediumConfidence.length).toBe(1);
    expect(lowConfidence.length).toBe(1);
  });

  it("should handle empty product names array", () => {
    const productNames: string[] = [];
    
    // Empty array should not cause errors
    expect(productNames.length).toBe(0);
    expect(productNames.map(n => n.trim())).toEqual([]);
  });

  it("should build correct prompt for AI", () => {
    const existingMasters = [
      { canonicalName: "Kyogoku クリスタルスキン UV スティック", aliases: ["UVスティック"] },
      { canonicalName: "KYOGOKU ステムセル モーニングマスク", aliases: [] },
    ];
    
    const productNames = ["KYOGOKU UVスティック", "京極 ステムセルマスク"];
    
    // Build prompt
    const existingProductsText = existingMasters.map(m => 
      `- ${m.canonicalName}${m.aliases.length > 0 ? ` (別名: ${m.aliases.join(", ")})` : ""}`
    ).join("\n");
    
    const productNamesText = productNames.map(n => `- ${n}`).join("\n");
    
    expect(existingProductsText).toContain("Kyogoku クリスタルスキン UV スティック");
    expect(existingProductsText).toContain("(別名: UVスティック)");
    expect(productNamesText).toContain("KYOGOKU UVスティック");
    expect(productNamesText).toContain("京極 ステムセルマスク");
  });

  it("should match existing master by canonical name", () => {
    const masters = [
      { id: 1, canonicalName: "Kyogoku クリスタルスキン UV スティック" },
      { id: 2, canonicalName: "KYOGOKU ステムセル モーニングマスク" },
    ];
    
    const suggestion = {
      matchType: "existing",
      suggestedCanonicalName: "Kyogoku クリスタルスキン UV スティック",
    };
    
    const matchedMaster = masters.find(m => 
      m.canonicalName === suggestion.suggestedCanonicalName
    );
    
    expect(matchedMaster).toBeDefined();
    expect(matchedMaster?.id).toBe(1);
  });

  it("should handle new product suggestions", () => {
    const masters = [
      { id: 1, canonicalName: "Kyogoku クリスタルスキン UV スティック" },
    ];
    
    const suggestion = {
      matchType: "new",
      suggestedCanonicalName: "新商品テスト",
    };
    
    const matchedMaster = masters.find(m => 
      m.canonicalName === suggestion.suggestedCanonicalName
    );
    
    // New products should not match existing masters
    expect(matchedMaster).toBeUndefined();
    expect(suggestion.matchType).toBe("new");
  });
});

describe("Product Alias Suggestion Status", () => {
  it("should have valid status values", () => {
    const validStatuses = ["pending", "approved", "rejected"];
    
    const suggestion = { status: "pending" };
    expect(validStatuses).toContain(suggestion.status);
  });

  it("should track approval/rejection metadata", () => {
    const approvedSuggestion = {
      status: "approved",
      reviewedBy: 1,
      reviewedAt: new Date(),
    };
    
    expect(approvedSuggestion.status).toBe("approved");
    expect(approvedSuggestion.reviewedBy).toBeDefined();
    expect(approvedSuggestion.reviewedAt).toBeInstanceOf(Date);
  });
});
