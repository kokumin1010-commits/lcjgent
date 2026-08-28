import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STORE_PRODUCT_IMAGE_MAX_BYTES,
  extractClipboardImageFiles,
  validateStoreProductImageFiles,
} from "../client/src/lib/storeProductImageClipboard";
import { calculatePromotion } from "./storeProductRouter";

function imageFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

describe("store product clipboard images", () => {
  it("extracts pasted image files and ignores non-image clipboard entries", () => {
    const image = imageFile("clipboard.png", "image/png", 128);
    const text = new File(["hello"], "note.txt", {
      type: "text/plain",
      lastModified: 1,
    });
    const result = extractClipboardImageFiles({
      items: [
        { kind: "file", type: image.type, getAsFile: () => image },
        { kind: "file", type: text.type, getAsFile: () => text },
      ] as unknown as DataTransferItemList,
      files: [] as unknown as FileList,
    });

    expect(result).toEqual([image]);
  });

  it("accepts valid JPEG/PNG/WebP images and enforces remaining slots", () => {
    const files = [
      imageFile("one.jpg", "image/jpeg", 100),
      imageFile("two.png", "image/png", 100),
      imageFile("three.webp", "image/webp", 100),
    ];
    const result = validateStoreProductImageFiles(files, 2);

    expect(result.accepted.map(file => file.name)).toEqual([
      "one.jpg",
      "two.png",
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toBe("limit_exceeded");
  });

  it("rejects unsupported and oversized pasted files", () => {
    const result = validateStoreProductImageFiles(
      [
        imageFile("animated.gif", "image/gif", 100),
        imageFile("huge.png", "image/png", STORE_PRODUCT_IMAGE_MAX_BYTES + 1),
      ],
      8
    );

    expect(result.accepted).toEqual([]);
    expect(result.rejected.map(item => item.reason)).toEqual([
      "unsupported_type",
      "too_large",
    ]);
  });
});

describe("store product SKU promotion API contract", () => {
  const routerSource = readFileSync(
    new URL("./storeProductRouter.ts", import.meta.url),
    "utf8"
  );

  it("accepts a SKU target and only pauses other promotions in the same SKU scope", () => {
    expect(routerSource).toContain(
      "skuId: z.number().int().positive().nullable().optional()"
    );
    expect(routerSource).toContain(
      "((skuId IS NULL AND ? IS NULL) OR skuId=?)"
    );
    expect(routerSource).toContain("推广记录与当前SKU不一致");
  });

  it("provides an audited transactional migration for legacy product-level promotions", () => {
    expect(routerSource).toContain("migrateLegacyPromotions: adminProcedure");
    expect(routerSource).toContain("promotion_migrated_to_sku");
    expect(routerSource).toContain("legacy_product_promotion_archived");
    expect(routerSource).toContain("await conn.beginTransaction()");
  });
});

describe("store product SKU promotions", () => {
  it("calculates the same percentage discount independently from each SKU price", () => {
    const premiumSku = calculatePromotion({
      basePrice: 27_448,
      discountType: "percentage",
      discountValue: 15,
      isEnabled: true,
    });
    const accessorySku = calculatePromotion({
      basePrice: 1_100,
      discountType: "percentage",
      discountValue: 15,
      isEnabled: true,
    });

    expect(premiumSku.promotionPrice).toBe(23_331);
    expect(accessorySku.promotionPrice).toBe(935);
    expect(premiumSku.status).toBe("active");
    expect(accessorySku.status).toBe("active");
  });

  it("keeps a disabled SKU promotion as paused without changing its price formula", () => {
    const result = calculatePromotion({
      basePrice: 5_000,
      discountType: "fixed_amount",
      discountValue: 1_000,
      isEnabled: false,
    });

    expect(result).toEqual({ promotionPrice: 4_000, status: "paused" });
  });

  it("rejects invalid discounts for the individual SKU base price", () => {
    expect(() =>
      calculatePromotion({
        basePrice: 1_000,
        discountType: "fixed_amount",
        discountValue: 1_001,
        isEnabled: true,
      })
    ).toThrow("固定优惠必须大于0且不能超过正常售价");
  });
});
