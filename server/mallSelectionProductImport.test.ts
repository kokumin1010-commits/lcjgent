import { describe, expect, it } from "vitest";
import {
  collectSelectionProductImportVariants,
  parseSelectionProductImages,
  resolveMallBrandId,
  resolveMallCategoryId,
  selectionMoneyToMallYen,
  selectionProductToMallPrefill,
  selectionStockToMallStock,
} from "../shared/mallSelectionProductImport";

describe("selection product to mall prefill", () => {
  it("maps base information while keeping mall-only fields outside the mapping", () => {
    const result = selectionProductToMallPrefill({
      id: 91,
      productName: "  テスト商品  ",
      description: "说明",
      sellingPoints: "卖点",
      brandId: 7,
      categoryName: "スキンケア",
      price: "3980.40",
      stock: "12",
      images: JSON.stringify(["https://example.invalid/a.jpg", "https://example.invalid/a.jpg", { url: "https://example.invalid/b.jpg" }]),
      commissionType: "percentage",
      commissionValue: "12.5",
    }, [
      { id: 2, name: " スキンケア ", isActive: "yes" },
    ], [
      { id: 7 },
    ]);

    expect(result).toEqual({
      selectionProductId: 91,
      name: "テスト商品",
      description: "说明",
      brandId: 7,
      categoryId: 2,
      price: 3980,
      stock: 12,
      images: [
        { url: "https://example.invalid/a.jpg", key: "" },
        { url: "https://example.invalid/b.jpg", key: "" },
      ],
      commissionRate: "12.5",
    });
    expect(result).not.toHaveProperty("pointPrice");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("sortOrder");
  });

  it("falls back to selling points and does not invent invalid ids or fixed commission percentages", () => {
    expect(selectionProductToMallPrefill({
      id: 92,
      productName: "商品B",
      sellingPoints: "核心卖点",
      brandId: 999,
      categoryName: "重複カテゴリ",
      price: null,
      stock: -2,
      images: "invalid-json",
      commissionType: "fixed",
      commissionValue: "500",
    }, [
      { id: 1, name: "重複カテゴリ" },
      { id: 2, name: "重複カテゴリ" },
    ], [{ id: 7 }])).toMatchObject({
      description: "核心卖点",
      brandId: null,
      categoryId: null,
      price: 0,
      stock: 0,
      images: [],
      commissionRate: "",
    });
  });

  it("keeps an empty percentage commission blank instead of inventing zero percent", () => {
    expect(selectionProductToMallPrefill({
      id: 93,
      productName: "商品C",
      commissionType: "percentage",
      commissionValue: null,
    }, [], []).commissionRate).toBe("");
    expect(selectionProductToMallPrefill({
      id: 94,
      productName: "商品D",
      commissionType: "percentage",
      commissionValue: "",
    }, [], []).commissionRate).toBe("");
  });

  it("normalizes money, stock, brand and category boundaries", () => {
    expect(selectionMoneyToMallYen("100.6")).toBe(101);
    expect(selectionMoneyToMallYen("invalid")).toBe(0);
    expect(selectionStockToMallStock("9.9")).toBe(9);
    expect(selectionStockToMallStock(-1)).toBe(0);
    expect(resolveMallBrandId("7", [{ id: 7 }])).toBe(7);
    expect(resolveMallBrandId(9, [{ id: 7 }])).toBeNull();
    expect(resolveMallCategoryId("Ｓｋｉｎ　Ｃａｒｅ", [{ id: 4, name: "skin care" }])).toBe(4);
  });

  it("limits, de-duplicates and validates source image urls without inventing keys", () => {
    const images = parseSelectionProductImages([
      " https://example.invalid/1.jpg ",
      { url: "https://example.invalid/2.jpg" },
      "https://example.invalid/1.jpg",
      null,
      ...Array.from({ length: 20 }, (_, index) => `https://example.invalid/${index + 3}.jpg`),
    ]);
    expect(images).toHaveLength(10);
    expect(images.slice(0, 2)).toEqual(["https://example.invalid/1.jpg", "https://example.invalid/2.jpg"]);
  });
});

describe("selection SKU to mall variant mapping", () => {
  it("maps embedded variants and keeps non-online variants inactive", () => {
    const variants = collectSelectionProductImportVariants({
      id: 1,
      productName: "Parent",
      status: "online",
      skuVariants: [
        { name: "Red", skuCode: "SKU-RED", price: "1200", stock: 3, status: "online" },
        { name: "Blue", price: "1300.4", stock: 0, status: "draft" },
      ],
    });
    expect(variants).toEqual([
      { name: "Red", sku: "SKU-RED", price: 1200, stock: 3, isActive: "yes" },
      { name: "Blue", sku: null, price: 1300, stock: 0, isActive: "no" },
    ]);
  });

  it("falls back to a legacy SKU and appends entity child SKUs", () => {
    const variants = collectSelectionProductImportVariants({
      id: 2,
      productName: "Parent",
      status: "online",
      skuName: "Default",
      skuPrice: "900",
    }, [
      { id: 3, productName: "Large", productId: "SKU-L", price: "1100", stock: 5, status: "online" },
    ]);
    expect(variants).toEqual([
      { name: "Default", sku: null, price: 900, stock: 0, isActive: "yes" },
      { name: "Large", sku: "SKU-L", price: 1100, stock: 5, isActive: "yes" },
    ]);
  });

  it("deduplicates entity and embedded variants by SKU code", () => {
    const variants = collectSelectionProductImportVariants({
      id: 4,
      productName: "Parent",
      skuVariants: [{ name: "A", skuCode: "same-sku", price: "100" }],
    }, [
      { id: 5, productName: "B", productId: " SAME-SKU ", price: "200" },
    ]);
    expect(variants).toHaveLength(1);
    expect(variants[0]?.name).toBe("A");
  });
});
