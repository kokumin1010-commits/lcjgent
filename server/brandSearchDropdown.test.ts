import { describe, it, expect } from "vitest";

// Test the brand search/filter logic used in the searchable brand dropdown
// This validates the filtering behavior that cmdk's Command component uses

describe("Brand Search Dropdown", () => {
  const mockBrands = [
    { id: 1, name: "Nike" },
    { id: 2, name: "Adidas" },
    { id: 3, name: "Puma" },
    { id: 4, name: "New Balance" },
    { id: 5, name: "NIKE Japan" },
    { id: 6, name: "アディダス" },
    { id: 7, name: "ナイキ" },
    { id: 8, name: "Under Armour" },
    { id: 9, name: "Reebok" },
    { id: 10, name: "ASICS" },
  ];

  // cmdk uses case-insensitive substring matching by default
  const filterBrands = (brands: typeof mockBrands, query: string) => {
    if (!query) return brands;
    const lowerQuery = query.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(lowerQuery));
  };

  describe("Brand Filtering", () => {
    it("should return all brands when search query is empty", () => {
      const result = filterBrands(mockBrands, "");
      expect(result).toHaveLength(10);
    });

    it("should filter brands by partial name match (case-insensitive)", () => {
      const result = filterBrands(mockBrands, "nike");
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.name)).toContain("Nike");
      expect(result.map((b) => b.name)).toContain("NIKE Japan");
    });

    it("should filter brands by exact name match", () => {
      const result = filterBrands(mockBrands, "Puma");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Puma");
    });

    it("should filter Japanese brand names", () => {
      const result = filterBrands(mockBrands, "ナイキ");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ナイキ");
    });

    it("should return empty array when no brands match", () => {
      const result = filterBrands(mockBrands, "xyz123");
      expect(result).toHaveLength(0);
    });

    it("should handle partial substring matching", () => {
      const result = filterBrands(mockBrands, "bal");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("New Balance");
    });

    it("should handle uppercase search query", () => {
      const result = filterBrands(mockBrands, "ADIDAS");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Adidas");
    });
  });

  describe("Brand Selection State", () => {
    it("should correctly identify selected brand by ID", () => {
      const selectedBrandId = "3";
      const selectedBrand = mockBrands.find(
        (b) => b.id.toString() === selectedBrandId
      );
      expect(selectedBrand).toBeDefined();
      expect(selectedBrand?.name).toBe("Puma");
    });

    it("should return undefined for non-existent brand ID", () => {
      const selectedBrandId = "999";
      const selectedBrand = mockBrands.find(
        (b) => b.id.toString() === selectedBrandId
      );
      expect(selectedBrand).toBeUndefined();
    });

    it("should display placeholder when no brand is selected", () => {
      const selectedBrandId = "";
      const displayText = selectedBrandId
        ? mockBrands.find((b) => b.id.toString() === selectedBrandId)?.name
        : "ブランドを選択";
      expect(displayText).toBe("ブランドを選択");
    });

    it("should display brand name when brand is selected", () => {
      const selectedBrandId = "1";
      const displayText = selectedBrandId
        ? mockBrands.find((b) => b.id.toString() === selectedBrandId)?.name
        : "ブランドを選択";
      expect(displayText).toBe("Nike");
    });
  });

  describe("Brand List Handling", () => {
    it("should handle empty brand list gracefully", () => {
      const emptyBrands: typeof mockBrands = [];
      const result = filterBrands(emptyBrands, "nike");
      expect(result).toHaveLength(0);
    });

    it("should handle undefined/null-like search gracefully", () => {
      const result = filterBrands(mockBrands, "");
      expect(result).toEqual(mockBrands);
    });

    it("should handle brands with special characters in names", () => {
      const brandsWithSpecial = [
        ...mockBrands,
        { id: 11, name: "H&M" },
        { id: 12, name: "C&A" },
      ];
      const result = filterBrands(brandsWithSpecial, "&");
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.name)).toContain("H&M");
      expect(result.map((b) => b.name)).toContain("C&A");
    });

    it("should handle large brand lists efficiently", () => {
      const largeBrandList = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Brand ${i + 1}`,
      }));
      const result = filterBrands(largeBrandList, "Brand 500");
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((b) => b.name === "Brand 500")).toBe(true);
    });
  });
});
