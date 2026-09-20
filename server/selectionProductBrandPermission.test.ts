import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeSelectionProductBrandPermissions,
  selectionProductBrandPermissionLabel,
} from "../shared/selectionProductPersistence";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("selection product brand permission information", () => {
  it("normalizes multilingual presets, custom values, duplicates, and empty input", () => {
    expect(normalizeSelectionProductBrandPermissions([
      "子账号控制",
      "サブアカウント管理",
      "达人秒杀",
      "商品折扣",
      " 广告账户管理 ",
    ])).toEqual([
      "subaccount_control",
      "creator_flash_sale",
      "product_discount",
      "广告账户管理",
    ]);
    expect(normalizeSelectionProductBrandPermissions(null)).toEqual([]);
    expect(selectionProductBrandPermissionLabel("product_discount", "zh-CN")).toBe("商品折扣");
    expect(selectionProductBrandPermissionLabel("product_discount", "ja")).toBe("商品割引");
    expect(selectionProductBrandPermissionLabel("广告账户管理", "ja")).toBe("广告账户管理");
  });

  it("persists a JSON array through schema, API, form submit, list display, and CSV export", () => {
    const persistence = read("server/selectionProductPersistence.ts");
    const router = read("server/selectionCenterRouter.ts");
    const page = read("client/src/pages/SelectionCenter.tsx");

    expect(persistence).toContain("ADD COLUMN brandPermissionInfo JSON DEFAULT NULL AFTER supplierContact");
    expect(persistence).toContain('"brandPermissionInfo"');
    expect(router).toContain("brandPermissionInfo: z.union([z.array(z.string()), z.string()])");
    expect(page).toContain("品牌权限信息");
    expect(page).toContain("ブランド権限情報");
    expect(page).toContain("SELECTION_PRODUCT_BRAND_PERMISSION_PRESETS.map");
    expect(page).toContain("brandPermissionInfo,");
    expect(page).toContain("safeSelectionProductBrandPermissions(p.brandPermissionInfo)");
    expect(page).toContain("ブランド権限情報");
  });

  it("keeps internal brand permissions out of the unauthenticated liver product response", () => {
    const router = read("server/selectionCenterRouter.ts");
    const publicStart = router.indexOf("getLiverAvailableProducts: publicProcedure");
    const internalStart = router.indexOf("getLiverAvailableProductsInternal: protectedProcedure");
    const publicRoute = router.slice(publicStart, internalStart);

    expect(publicStart).toBeGreaterThan(0);
    expect(internalStart).toBeGreaterThan(publicStart);
    expect(publicRoute).toContain("queryLiverAvailableProducts(getPool(), input.search, false)");
    expect(router).toContain("queryLiverAvailableProducts(getPool(), input.search, true)");
    expect(router).toContain("sp.commissionValue, sp.images, sp.productLink, sp.sellingPoints");
    expect(router).not.toContain("sp.brandPermissionInfo, sp.productName");
    expect(read("client/src/pages/SelectionCenter.tsx")).toContain("getLiverAvailableProductsInternal.useQuery");
    expect(read("client/src/pages/LiverSelectionCenter.tsx")).toContain("getLiverAvailableProducts.useQuery");
  });
});
