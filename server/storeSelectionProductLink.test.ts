import { describe, expect, it } from "vitest";
import {
  mergeStoreSelectionSkuPrefills,
  normalizeStoreSelectionIdentity,
  selectionProductToStorePrefill,
  type StoreSelectionSkuPrefill,
} from "../shared/storeSelectionProductLink";

describe("store selection product link mapping", () => {
  it("maps parent fields, images, embedded SKUs and entity child SKUs", () => {
    const source = {
      id: 31,
      productName: "Source Product",
      productNameCn: "源商品",
      productId: "P-31",
      barcode: "BAR-31",
      brandName: "Brand",
      categoryName: "Category",
      productLink: "https://example.invalid/product",
      price: "4280",
      stock: 5,
      images: JSON.stringify(["https://example.invalid/a.jpg", "https://example.invalid/b.webp"]),
      description: "Description",
      sellingPoints: "Selling point",
      status: "online",
      skuVariants: JSON.stringify([{ name: "Small", skuCode: "SKU-S", price: "3900", stock: 2, status: "online" }]),
      skuName: null,
      skuPrice: null,
      skuLowestPrice: null,
      skuDiscountRate: null,
      promotionType: null,
      commissionType: null,
      commissionValue: null,
    };
    const child = {
      ...source,
      id: 32,
      parentProductId: 31,
      productName: "Large",
      productId: "SKU-L",
      barcode: "",
      price: "4500",
      stock: 3,
      images: null,
      skuVariants: null,
      skuName: "Large",
      skuPrice: "4500",
      status: "online",
    };

    const result = selectionProductToStorePrefill(source as any, [child as any]);
    expect(result).toMatchObject({
      selectionProductId: 31,
      externalProductId: "P-31",
      productName: "Source Product",
      brandName: "Brand",
      category: "Category",
      productUrl: "https://example.invalid/product",
      basePrice: 4280,
      stock: 5,
      sourceStatus: "online",
    });
    expect(result.imageUrls).toEqual(["https://example.invalid/a.jpg", "https://example.invalid/b.webp"]);
    expect(result.skus).toEqual(expect.arrayContaining([
      expect.objectContaining({ skuCode: "SKU-S", platformSkuId: "SKU-S", variantName: "Small", salePrice: 3900, stock: 2 }),
      expect.objectContaining({ skuCode: "SKU-L", platformSkuId: "SKU-L", variantName: "Large", salePrice: 4500, stock: 3 }),
    ]));
  });

  it("normalizes full-width and whitespace identities", () => {
    expect(normalizeStoreSelectionIdentity("  ＳＫＵ－１２３  ")).toBe("sku-123");
  });

  it("appends source SKUs without duplicating existing code or name", () => {
    const current = [{ skuCode: "SKU-S", platformSkuId: "", barcode: "", variantName: "Small", marker: "kept" }];
    const incoming: StoreSelectionSkuPrefill[] = [
      { skuCode: "ＳＫＵ－Ｓ", platformSkuId: "SKU-S", barcode: "", variantName: "Small duplicate", salePrice: 3900, stock: 2, status: "active" },
      { skuCode: "SKU-L", platformSkuId: "SKU-L", barcode: "", variantName: "Large", salePrice: 4500, stock: 3, status: "active" },
    ];
    const result = mergeStoreSelectionSkuPrefills(current, incoming, (sku) => ({ ...sku, marker: "added" }));
    expect(result).toHaveLength(2);
    expect(result[0].marker).toBe("kept");
    expect(result[1]).toMatchObject({ skuCode: "SKU-L", marker: "added" });
  });
});
