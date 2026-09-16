import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildStoreBrandSearchValue,
  getStoreServiceBrandLabel,
  matchesStoreBrandSearch,
  normalizeStoreBrandSearch,
} from "../client/src/lib/storeBrandSearch";

const page = readFileSync(fileURLToPath(new URL("../client/src/pages/StoreManagement.tsx", import.meta.url)), "utf8");
const router = readFileSync(fileURLToPath(new URL("./storeManagementRouter.ts", import.meta.url)), "utf8");

describe("store service brand search", () => {
  const brand = {
    id: 88,
    name: "KYOGOKU PROFESSIONAL",
    nameJa: "KYOGOKU JAPAN",
    companyName: "株式会社 Kyogoku",
    materialCategory: "美容・ヘアケア",
  };

  it("normalizes full-width and mixed-case input", () => {
    expect(normalizeStoreBrandSearch(" ＫＹＯＧＯＫＵ　Japan ")).toBe("kyogoku japan");
  });

  it("searches across brand names, company, category and id", () => {
    const value = buildStoreBrandSearchValue(brand);
    expect(matchesStoreBrandSearch(value, "kyogoku")).toBe(true);
    expect(matchesStoreBrandSearch(value, "株式会社")).toBe(true);
    expect(matchesStoreBrandSearch(value, "ヘア")).toBe(true);
    expect(matchesStoreBrandSearch(value, "88")).toBe(true);
    expect(matchesStoreBrandSearch(value, "unrelated")).toBe(false);
  });

  it("prefers the Japanese display name without losing alternate names from search", () => {
    expect(getStoreServiceBrandLabel(brand)).toBe("KYOGOKU JAPAN");
    expect(buildStoreBrandSearchValue(brand)).toContain("kyogoku professional");
  });

  it("renders a searchable selector while preserving bind and unbind values", () => {
    expect(page).toContain('role="combobox"');
    expect(page).toContain('placeholder="输入品牌名、公司名或类别搜索..."');
    expect(page).toContain("没有找到匹配品牌。");
    expect(page).toContain("前往品牌管理新增");
    expect(page).toContain("setForm(current => ({ ...current, brandId: 0 }))");
    expect(page).toContain("setForm(current => ({ ...current, brandId: Number(brand.id) }))");
    expect(page).toContain("brandId: form.brandId || null");
  });

  it("returns every safe search field from the protected service-brand API", () => {
    expect(router).toContain("serviceBrands: protectedProcedure");
    expect(router).toContain("SELECT id, name, nameJa, companyName, materialCategory, status");
    expect(router).toContain("WHERE deletedAt IS NULL");
  });
});
