import { describe, it, expect } from "vitest";

// Test the brand list sorting logic
describe("Brand List Sorting", () => {
  // Sample brand data
  const sampleBrands = [
    { id: 1, name: "Brand A", totalGmv: 100000, totalAdBudget: 50000 },
    { id: 2, name: "Brand B", totalGmv: 500000, totalAdBudget: 30000 },
    { id: 3, name: "Brand C", totalGmv: 200000, totalAdBudget: 100000 },
    { id: 4, name: "Brand D", totalGmv: 0, totalAdBudget: 0 },
    { id: 5, name: "Brand E", totalGmv: 300000, totalAdBudget: 20000 },
  ];

  // Sorting function (same logic as in BrandList.tsx)
  const sortBrands = (brands: typeof sampleBrands, sortBy: string) => {
    return [...brands].sort((a, b) => {
      if (sortBy === "gmv") {
        const gmvA = a.totalGmv || 0;
        const gmvB = b.totalGmv || 0;
        return gmvB - gmvA; // 降順
      } else if (sortBy === "adBudget") {
        const adA = a.totalAdBudget || 0;
        const adB = b.totalAdBudget || 0;
        return adB - adA; // 降順
      } else {
        // 名前順（昇順）
        return (a.name || "").localeCompare(b.name || "", "ja");
      }
    });
  };

  it("should sort brands by GMV in descending order", () => {
    const sorted = sortBrands(sampleBrands, "gmv");
    
    expect(sorted[0].name).toBe("Brand B"); // 500000
    expect(sorted[1].name).toBe("Brand E"); // 300000
    expect(sorted[2].name).toBe("Brand C"); // 200000
    expect(sorted[3].name).toBe("Brand A"); // 100000
    expect(sorted[4].name).toBe("Brand D"); // 0
  });

  it("should sort brands by ad budget in descending order", () => {
    const sorted = sortBrands(sampleBrands, "adBudget");
    
    expect(sorted[0].name).toBe("Brand C"); // 100000
    expect(sorted[1].name).toBe("Brand A"); // 50000
    expect(sorted[2].name).toBe("Brand B"); // 30000
    expect(sorted[3].name).toBe("Brand E"); // 20000
    expect(sorted[4].name).toBe("Brand D"); // 0
  });

  it("should sort brands by name in ascending order", () => {
    const sorted = sortBrands(sampleBrands, "name");
    
    expect(sorted[0].name).toBe("Brand A");
    expect(sorted[1].name).toBe("Brand B");
    expect(sorted[2].name).toBe("Brand C");
    expect(sorted[3].name).toBe("Brand D");
    expect(sorted[4].name).toBe("Brand E");
  });

  it("should handle brands with null/undefined GMV", () => {
    const brandsWithNull = [
      { id: 1, name: "Brand A", totalGmv: null as any, totalAdBudget: 50000 },
      { id: 2, name: "Brand B", totalGmv: 500000, totalAdBudget: 30000 },
      { id: 3, name: "Brand C", totalGmv: undefined as any, totalAdBudget: 100000 },
    ];
    
    const sorted = sortBrands(brandsWithNull, "gmv");
    
    expect(sorted[0].name).toBe("Brand B"); // 500000
    // null and undefined should be treated as 0
    expect(sorted[1].totalGmv || 0).toBe(0);
    expect(sorted[2].totalGmv || 0).toBe(0);
  });

  it("should handle empty brand list", () => {
    const sorted = sortBrands([], "gmv");
    expect(sorted).toEqual([]);
  });

  it("should handle single brand", () => {
    const singleBrand = [{ id: 1, name: "Brand A", totalGmv: 100000, totalAdBudget: 50000 }];
    const sorted = sortBrands(singleBrand, "gmv");
    
    expect(sorted.length).toBe(1);
    expect(sorted[0].name).toBe("Brand A");
  });

  it("should handle brands with same GMV", () => {
    const sameBrands = [
      { id: 1, name: "Brand A", totalGmv: 100000, totalAdBudget: 50000 },
      { id: 2, name: "Brand B", totalGmv: 100000, totalAdBudget: 30000 },
    ];
    
    const sorted = sortBrands(sameBrands, "gmv");
    
    // Both have same GMV, order should be stable
    expect(sorted.length).toBe(2);
    expect(sorted[0].totalGmv).toBe(100000);
    expect(sorted[1].totalGmv).toBe(100000);
  });

  it("should default to GMV sort when sortBy is gmv", () => {
    const sorted = sortBrands(sampleBrands, "gmv");
    
    // First brand should have highest GMV
    expect(sorted[0].totalGmv).toBe(500000);
  });
});

// Test Japanese name sorting
describe("Japanese Name Sorting", () => {
  const japaneseBrands = [
    { id: 1, name: "あいうえお", totalGmv: 100000, totalAdBudget: 50000 },
    { id: 2, name: "かきくけこ", totalGmv: 500000, totalAdBudget: 30000 },
    { id: 3, name: "さしすせそ", totalGmv: 200000, totalAdBudget: 100000 },
  ];

  const sortBrands = (brands: typeof japaneseBrands, sortBy: string) => {
    return [...brands].sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "", "ja");
      }
      return 0;
    });
  };

  it("should sort Japanese names correctly", () => {
    const sorted = sortBrands(japaneseBrands, "name");
    
    expect(sorted[0].name).toBe("あいうえお");
    expect(sorted[1].name).toBe("かきくけこ");
    expect(sorted[2].name).toBe("さしすせそ");
  });
});
