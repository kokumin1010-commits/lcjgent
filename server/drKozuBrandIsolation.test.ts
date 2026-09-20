import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  brandDrKozuSpaHtml,
  DRKOZU_BRAND_DAY_DESCRIPTION,
  DRKOZU_BRAND_DAY_TITLE,
  isDrKozuBrandDayPath,
} from "./drKozuBrandDaySeo";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Dr.Kozu Brand Day independent branding", () => {
  it("removes host branding from the complete Dr.Kozu landing-page component", () => {
    const source = read("client/src/pages/BrandDayPortal.tsx");
    const start = source.indexOf("function DrKozuPortal");
    const end = source.indexOf("function DrKozuSection");
    const drKozuPortal = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(drKozuPortal).not.toMatch(/LCJ/i);
    expect(drKozuPortal).toContain("Dr.Kozu · BRAND DAY 2026");
    expect(drKozuPortal).toContain("商品を選び、ライブや動画で魅力を届け");
    expect(drKozuPortal).toContain("売上データ提出について");
    expect(drKozuPortal).toContain("© 2026 Dr.Kozu · BRAND DAY");
  });

  it("brands the first HTML response, metadata, boot shell, and favicon before React loads", () => {
    const source = read("client/index.html");
    const branded = brandDrKozuSpaHtml(source, "https://example.com", "/brand-day/kozuday");

    expect(branded).toContain(`<title>${DRKOZU_BRAND_DAY_TITLE}</title>`);
    expect(branded).toContain(DRKOZU_BRAND_DAY_DESCRIPTION);
    expect(branded).toContain('content="Dr.Kozu BRAND DAY"');
    expect(branded).toContain('content="#a20d21"');
    expect(branded).toContain("Dr.Kozu BRAND DAYを読み込んでいます");
    expect(branded).toContain('id="app-boot-mark" aria-label="Dr.Kozu"');
    expect(branded).toContain(">DR</div>");
    expect(branded).toContain('/brand-day/drkozu/drkozu-logo.webp');
    expect(branded).toContain('sizes="32x32"');
    expect(branded).toContain('sizes="16x16"');
    expect(branded).toContain('rel="manifest" href="/site.webmanifest"');
    expect(branded).not.toContain("__MANIFEST_URL__");
    expect(branded).not.toContain("__CANONICAL_URL__");
    expect(branded).not.toContain("__OG_URL__");
    expect(branded).not.toMatch(/LCJ/i);
  });

  it("keeps every Dr.Kozu participant route inside the dedicated HTML response", () => {
    expect(isDrKozuBrandDayPath("/brand-day/kozuday")).toBe(true);
    expect(isDrKozuBrandDayPath("/brand-day/kozuday/")).toBe(true);
    expect(isDrKozuBrandDayPath("/brand-day/kozuday/entry")).toBe(true);
    expect(isDrKozuBrandDayPath("/brand-day/kozuday/creator/login")).toBe(true);
    expect(isDrKozuBrandDayPath("/brand-day/kozuday/ranking")).toBe(true);
    expect(isDrKozuBrandDayPath("/brand-day/kgday-2026")).toBe(false);
  });

  it("uses dedicated metadata and host-free copy across entry, login, ranking, and creator pages", () => {
    const entry = read("client/src/pages/BrandDayEntry.tsx");
    const login = read("client/src/pages/BrandDayCreatorLogin.tsx");
    const ranking = read("client/src/pages/BrandDayRanking.tsx");
    const dashboard = read("client/src/pages/BrandDayCreatorDashboard.tsx");
    const metadataHook = read("client/src/lib/drKozuBrandDaySeo.ts");
    const serverEntry = read("server/_core/index.ts");

    for (const source of [entry, login, ranking, dashboard]) {
      expect(source).toContain("useDrKozuBrandDaySeo");
    }
    expect(entry).toContain("Dr.Kozu BRAND DAYの出場者ページだけで使用します");
    expect(login).toContain("一般の管理者・スタッフログインは不要です");
    expect(metadataHook).toContain("applyDrKozuBranding(false)");
    expect(metadataHook).toContain("DEFAULT_META_VALUES");
    expect(metadataHook).toContain('meta[data-drkozu-brand-day="true"]');
    expect(metadataHook).not.toContain("previousTitle");
    expect(serverEntry).toContain("registerDrKozuBrandDaySeoRoutes(app)");
  });
});
