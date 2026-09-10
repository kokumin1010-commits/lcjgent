import { describe, expect, it } from "vitest";
import { planMallSelectionBulkSync, normalizeMallBulkSyncName } from "@shared/mallSelectionBulkSync";

const source = (id: number, productName: string, extra: Record<string, unknown> = {}) => ({
  id,
  productName,
  productNameCn: null,
  parentProductId: null,
  price: "1000",
  stock: 3,
  images: ["https://example.invalid/product.png"],
  description: "说明",
  brandId: 2,
  categoryName: "护肤",
  skuVariants: [],
  ...extra,
});

describe("planMallSelectionBulkSync", () => {
  it("classifies mapped, mall-name, source-alias and invalid-name records without overlap", () => {
    const plan = planMallSelectionBulkSync([
      source(1, "Already mapped"),
      source(2, "Existing MALL"),
      source(3, "Unique source", { productNameCn: "共同名称" }),
      source(4, "共同名称"),
      source(5, " ", { productNameCn: "" }),
      source(6, "Ready"),
      source(7, "Child", { parentProductId: 6 }),
    ], [
      { id: 50, name: "Other", selectionProductId: 1 },
      { id: 51, name: "existing mall", selectionProductId: null },
    ]);

    expect(plan.sourceParentCount).toBe(6);
    expect(plan.readySourceIds).toEqual([6]);
    expect(plan.counts).toMatchObject({
      ready: 1,
      alreadyMapped: 1,
      mallNameConflict: 1,
      sourceNameConflict: 2,
      invalidName: 1,
    });
    expect(plan.reasonBySourceId.get(1)).toBe("already_mapped");
    expect(plan.reasonBySourceId.get(2)).toBe("mall_name_conflict");
    expect(plan.reasonBySourceId.get(3)).toBe("source_name_conflict");
    expect(plan.reasonBySourceId.get(4)).toBe("source_name_conflict");
    expect(plan.reasonBySourceId.get(5)).toBe("invalid_name");
  });

  it("keeps incomplete products eligible and counts fields to complete later", () => {
    const plan = planMallSelectionBulkSync([
      source(10, "Incomplete", {
        price: null,
        stock: 0,
        images: [],
        description: "",
        sellingPoints: "",
        brandId: null,
        categoryName: null,
        skuVariants: [],
        skuName: "",
      }),
    ], []);

    expect(plan.readySourceIds).toEqual([10]);
    expect(plan.counts).toMatchObject({
      ready: 1,
      missingPositivePrice: 1,
      missingImage: 1,
      missingBrand: 1,
      missingCategory: 1,
      missingDescription: 1,
      zeroStock: 1,
      withSku: 0,
    });
  });

  it("counts embedded and legacy SKU products", () => {
    const plan = planMallSelectionBulkSync([
      source(20, "Embedded", { skuVariants: [{ name: "Red", skuCode: "R-1", stock: 1 }] }),
      source(21, "Legacy", { skuName: "Large", productId: "L-1" }),
      source(22, "No SKU"),
    ], []);
    expect(plan.counts.withSku).toBe(2);
  });

  it("normalizes full-width, spacing and punctuation for duplicate protection", () => {
    expect(normalizeMallBulkSyncName("ＫＹＯＧＯＫＵ　Hair・Mask")).toBe("kyogokuhairmask");
    const plan = planMallSelectionBulkSync([
      source(30, "ＫＹＯＧＯＫＵ　Hair・Mask"),
    ], [{ id: 1, name: "kyogoku hair mask" }]);
    expect(plan.counts.mallNameConflict).toBe(1);
    expect(plan.counts.ready).toBe(0);
  });
});
