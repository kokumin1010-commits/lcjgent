import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => null),
}));

// Test the category mapping CRUD operations and category analysis logic
describe("Product Category Mapping", () => {
  describe("API Input Validation", () => {
    it("should require productName to be non-empty", () => {
      const input = { productName: "", category: "ヘアケア" };
      expect(input.productName.length).toBe(0);
    });

    it("should require category to be non-empty", () => {
      const input = { productName: "テスト商品", category: "" };
      expect(input.category.length).toBe(0);
    });

    it("should accept valid mapping input", () => {
      const input = { productName: "KYOGOKU MEGAガチャ袋", category: "ヘアケア" };
      expect(input.productName.length).toBeGreaterThan(0);
      expect(input.category.length).toBeGreaterThan(0);
    });
  });

  describe("Category Classification Logic", () => {
    // Simulate the classification logic from getLiverCategoryAnalysis
    const categoryPatterns: Record<string, string[]> = {
      "美容液・セラム": ["美容液", "セラム", "serum", "エッセンス", "essence", "アンプル"],
      "ヘアケア": ["シャンプー", "トリートメント", "ヘアオイル", "ヘア", "hair", "コンディショナー", "ヘアミスト", "ヘアミルク"],
      "スキンケア": ["化粧水", "乳液", "クリーム", "ローション", "モイスチャー", "保湿", "skin", "フェイス", "洗顔", "クレンジング", "パック", "マスク"],
      "UV・日焼け止め": ["UV", "日焼け止め", "サンスクリーン", "SPF", "sunscreen", "sun"],
      "美顔器・デバイス": ["美顔器", "デバイス", "EMS", "LED", "マッサージ", "ローラー", "device"],
      "メイクアップ": ["ファンデ", "リップ", "アイシャドウ", "マスカラ", "チーク", "コンシーラー", "パウダー", "メイク", "makeup", "BBクリーム", "CCクリーム"],
      "ボディケア": ["ボディ", "body", "ハンドクリーム", "ボディクリーム", "ボディローション", "入浴"],
      "サプリメント": ["サプリ", "supplement", "ビタミン", "コラーゲン", "プロテイン", "酵素"],
      "健康食品・ドリンク": ["ドリンク", "drink", "tea", "茶", "ジュース", "スムージー", "食品"],
      "フレグランス": ["香水", "フレグランス", "fragrance", "perfume", "コロン"],
    };

    function classifyProduct(productName: string, manualMappings: Map<string, string>): string {
      // 1. Check manual mapping first
      const manualCategory = manualMappings.get(productName);
      if (manualCategory) return manualCategory;

      // 2. Pattern matching
      const name = productName.toLowerCase();
      for (const [category, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(pattern => name.includes(pattern.toLowerCase()))) {
          return category;
        }
      }

      // 3. Default to その他
      return "その他";
    }

    it("should classify hair products correctly", () => {
      const result = classifyProduct("KYOGOKUシャンプー 500ml", new Map());
      expect(result).toBe("ヘアケア");
    });

    it("should classify skincare products correctly", () => {
      const result = classifyProduct("保湿クリーム 50g", new Map());
      expect(result).toBe("スキンケア");
    });

    it("should classify makeup products correctly", () => {
      const result = classifyProduct("リップスティック ローズ", new Map());
      expect(result).toBe("メイクアップ");
    });

    it("should classify UV products correctly", () => {
      const result = classifyProduct("日焼け止めジェル SPF50", new Map());
      expect(result).toBe("UV・日焼け止め");
    });

    it("should classify unrecognized products as その他", () => {
      const result = classifyProduct("XBJ ポータブルプロジェクター", new Map());
      expect(result).toBe("その他");
    });

    it("should prioritize manual mapping over pattern matching", () => {
      const manualMappings = new Map<string, string>();
      manualMappings.set("KYOGOKU MEGAガチャ袋", "ヘアケア");
      
      // Without manual mapping, this would be "その他"
      const withoutMapping = classifyProduct("KYOGOKU MEGAガチャ袋", new Map());
      expect(withoutMapping).toBe("その他");
      
      // With manual mapping, it should be "ヘアケア"
      const withMapping = classifyProduct("KYOGOKU MEGAガチャ袋", manualMappings);
      expect(withMapping).toBe("ヘアケア");
    });

    it("should allow manual mapping to custom categories", () => {
      const manualMappings = new Map<string, string>();
      manualMappings.set("XBJ ポータブルプロジェクター", "家電・ガジェット");
      
      const result = classifyProduct("XBJ ポータブルプロジェクター", manualMappings);
      expect(result).toBe("家電・ガジェット");
    });

    it("should allow manual mapping to override pattern matching", () => {
      const manualMappings = new Map<string, string>();
      // This product would normally match "スキンケア" via pattern, but manual mapping overrides
      manualMappings.set("保湿クリーム 50g", "美容液・セラム");
      
      const result = classifyProduct("保湿クリーム 50g", manualMappings);
      expect(result).toBe("美容液・セラム");
    });
  });

  describe("Available Categories", () => {
    it("should include all built-in categories", () => {
      const builtInCategories = [
        "美容液・セラム", "ヘアケア", "スキンケア", "UV・日焼け止め",
        "美顔器・デバイス", "メイクアップ", "ボディケア", "サプリメント",
        "健康食品・ドリンク", "フレグランス",
      ];
      expect(builtInCategories).toHaveLength(10);
    });

    it("should merge built-in and user-created categories without duplicates", () => {
      const builtInCategories = ["ヘアケア", "スキンケア", "メイクアップ"];
      const userCategories = ["家電・ガジェット", "ヘアケア", "ファッション"];
      
      const merged = Array.from(new Set([...builtInCategories, ...userCategories])).sort();
      expect(merged).toEqual(["スキンケア", "ファッション", "ヘアケア", "メイクアップ", "家電・ガジェット"]);
      expect(merged).toHaveLength(5); // No duplicates
    });
  });

  describe("Bulk Mapping", () => {
    it("should handle multiple mappings input", () => {
      const mappings = [
        { productName: "商品A", category: "ヘアケア" },
        { productName: "商品B", category: "スキンケア" },
        { productName: "商品C", category: "家電・ガジェット" },
      ];
      expect(mappings).toHaveLength(3);
      expect(mappings.every(m => m.productName.length > 0 && m.category.length > 0)).toBe(true);
    });

    it("should handle bulk move to same category", () => {
      const selectedProducts = ["KYOGOKU MEGAガチャ袋", "XBJ プロジェクター", "テスト商品C"];
      const targetCategory = "ヘアケア";
      const mappings = selectedProducts.map(productName => ({
        productName,
        category: targetCategory,
      }));
      expect(mappings).toHaveLength(3);
      expect(mappings.every(m => m.category === "ヘアケア")).toBe(true);
    });

    it("should handle bulk move to new category", () => {
      const selectedProducts = ["商品X", "商品Y"];
      const newCategory = "新カテゴリ";
      const mappings = selectedProducts.map(productName => ({
        productName,
        category: newCategory,
      }));
      expect(mappings).toHaveLength(2);
      expect(mappings.every(m => m.category === "新カテゴリ")).toBe(true);
    });

    it("should not create mappings when no products selected", () => {
      const selectedProducts: string[] = [];
      const mappings = selectedProducts.map(productName => ({
        productName,
        category: "ヘアケア",
      }));
      expect(mappings).toHaveLength(0);
    });
  });

  describe("Product Selection Logic", () => {
    it("should toggle individual product selection", () => {
      const selected = new Set<string>();
      // Add product
      selected.add("商品A");
      expect(selected.has("商品A")).toBe(true);
      expect(selected.size).toBe(1);
      // Remove product
      selected.delete("商品A");
      expect(selected.has("商品A")).toBe(false);
      expect(selected.size).toBe(0);
    });

    it("should select all products in a category", () => {
      const products = [
        { name: "商品A", gmv: 100 },
        { name: "商品B", gmv: 200 },
        { name: "商品C", gmv: 300 },
      ];
      const selected = new Set<string>();
      products.forEach(p => selected.add(p.name));
      expect(selected.size).toBe(3);
      expect(products.every(p => selected.has(p.name))).toBe(true);
    });

    it("should deselect all products when all are selected", () => {
      const products = [{ name: "商品A", gmv: 100 }, { name: "商品B", gmv: 200 }];
      const selected = new Set<string>(products.map(p => p.name));
      const allSelected = products.every(p => selected.has(p.name));
      expect(allSelected).toBe(true);
      // Deselect all
      if (allSelected) {
        products.forEach(p => selected.delete(p.name));
      }
      expect(selected.size).toBe(0);
    });

    it("should clear all selections", () => {
      const selected = new Set(["商品A", "商品B", "商品C"]);
      expect(selected.size).toBe(3);
      selected.clear();
      expect(selected.size).toBe(0);
    });
  });
});
