import { createHash } from "node:crypto";
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
    expect(portal).toContain("ALL BRAND DAY ITEMS · 残り8商品");
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

  it("uses the user-approved second visual for Cell Peel Crystal with a cache-busting path", () => {
    const portal = read("client/src/pages/BrandDayPortal.tsx");
    const image = readFileSync(new URL("../client/public/brand-day/drkozu/cell-peel-crystal-v2.webp", import.meta.url));

    expect(portal).toContain('image: "/brand-day/drkozu/cell-peel-crystal-v2.webp"');
    expect(image.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(image.length).toBe(133_664);
    expect(createHash("sha256").update(image).digest("hex")).toBe("cd965cf8b10cb4006a09de5097bfdeb5bba296b9d00c0c455787044c3e54ff47");
  });

  it("prioritizes the four creator pick-up items while keeping the full catalogue available", () => {
    const portal = read("client/src/pages/BrandDayPortal.tsx");
    const pickUpNames = ["ヴァンパイアマスク", "セルピール #クリスタル", "リペアセラム", "リペアフェイシャルマスク"];

    let previousIndex = -1;
    for (const name of pickUpNames) {
      const index = portal.indexOf(`"${name}"`, portal.indexOf("const pickUpNames"));
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(portal).toContain("const [showAllProducts, setShowAllProducts]");
    expect(portal).toContain('data-testid="drkozu-pick-up-products"');
    expect(portal).toContain('aria-controls="drkozu-all-products"');
    expect(portal).toContain("すべての商品を見る");
    expect(portal).toContain('data-testid="drkozu-all-products-grid"');
  });

  it("uses a rank-led creator conversion journey and keeps detailed conditions collapsed", () => {
    const portal = read("client/src/pages/BrandDayPortal.tsx");

    expect(portal).not.toContain("GMV達成者に、最大10万円。");
    expect(portal).toContain("GMVランキング TOP3に賞金！");
    expect(portal).toContain("LIVE SALES PK CHALLENGE 同時開催");
    expect(portal).toContain("賞金総額");
    expect(portal).toContain("最大18万円");
    expect(portal).toContain("BRAND DAYだけの特別なチャンス");
    expect(portal).toContain("商品サンプル・販売素材・商品情報など");
    expect(portal.match(/BRAND DAYに参加する/g)?.length).toBeGreaterThanOrEqual(2);
    expect(portal).toMatch(/<details\s+className="drkozu-rules-disclosure"/);
    expect(portal).not.toMatch(/<details\s+open\s+className="drkozu-rules-disclosure"/);
    expect(portal).toContain("GMV ¥{tier.minimumGmv.toLocaleString");
    expect(portal).toContain("賞金の受取には所定のGMV条件があります");

    const order = [
      'id="top"',
      'id="challenge"',
      'id="benefits"',
      'id="products"',
      'id="brand"',
      'id="flow"',
      'id="rules"',
      'className="drkozu-final"',
    ].map(marker => portal.indexOf(marker));
    expect(order.every(index => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
