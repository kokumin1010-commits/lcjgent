import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const requestedProducts = [
  { name: "リペアクレンジング", url: "https://vt.tiktok.com/ZS9AMLM6LaX6j-oHoqn/", asset: "utynVskylwoRpqzb.webp" },
  { name: "リペアリップセラム", url: "https://vt.tiktok.com/ZS9AMLkb7LBng-Ti5bv/", asset: "sUHnEWIRkWMdcdrK.webp" },
  { name: "シンデレラマスク", url: "https://vt.tiktok.com/ZS9AMLAuWeow3-oTDqC/", asset: "KFUMrwftZKCtYEhw.webp" },
  { name: "リジュショット", url: "https://vt.tiktok.com/ZS9AMLUCmAUcY-tfWfa/", asset: "ODXaOknYhRUCdhEB.webp" },
  { name: "リペアセラム", url: "https://vt.tiktok.com/ZS9AMLjNWmap7-oP3fd/", asset: "ojoXvjjJSIiUfgtL.webp" },
  { name: "バランスジェル", url: "https://vt.tiktok.com/ZS9AMLHdJsLop-0JiYy/", asset: "MmzGjxCHQigUjoOc.webp" },
  { name: "リペアフェイシャルマスク", url: "https://vt.tiktok.com/ZS9AMLbALsjMQ-SJR7D/", asset: "lAcZrJNcvLegjNYC.webp" },
  { name: "フェイシャルネット", url: "https://vt.tiktok.com/ZS9AMLT3FMwjL-s46ye/", asset: "qGwYHqckZshhETkF.webp" },
] as const;

describe("Dr.Kozu Brand Day TikTok Shop products", () => {
  it("adds all eight requested products with their exact source links and uploaded official images", () => {
    const portal = read("client/src/pages/BrandDayPortal.tsx");

    for (const product of requestedProducts) {
      expect(portal).toContain(`name: "${product.name}"`);
      expect(portal).toContain(`href: "${product.url}"`);
      expect(portal).toContain(product.asset);
    }
    expect(portal.match(/badge: "TIKTOK SHOP"/g)).toHaveLength(8);
    expect(portal).toContain("Brand Dayで紹介できる12商品を掲載");
  });

  it("renders safe, accessible and lazy-loaded external product cards", () => {
    const portal = read("client/src/pages/BrandDayPortal.tsx");
    const css = read("client/src/pages/brand-day-portal.css");

    expect(portal).toContain('loading="lazy"');
    expect(portal).toContain('target="_blank"');
    expect(portal).toContain('rel="noopener noreferrer"');
    expect(portal).toContain('aria-label={`${product.name}をTikTok Shopで見る`}');
    expect(portal).toContain('String(index + 1).padStart(2, "0")');
    expect(css).toContain(".drkozu-product-clickable:focus-visible");
    expect(css).toContain(".drkozu-product-link svg");
  });
});
