import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const topPage = readProjectFile("client/src/pages/LiveCommerceFestivalTop.tsx");
const heroSection = topPage.slice(topPage.indexOf("function HeroSection()"), topPage.indexOf("function TopPortalSection()"));

describe("LCFトップから第2回ページへの導線", () => {
  it("イベントbanner直下に第2回の黄色主CTAと第1回archive導線を表示する", () => {
    const secondEditionCta = heroSection.match(/<a href="\/2nd" className="([^"]+)">\s*第2回開催情報を見る/);
    const firstEditionLink = heroSection.match(/<a href="\/2026" className="([^"]+)">\s*第1回イベントページを見る/);
    expect(secondEditionCta?.[1]).toContain("bg-[#f2cb3c]");
    expect(secondEditionCta?.[1]).toContain("text-black");
    expect(firstEditionLink?.[1]).toContain("mt-5");
    expect(firstEditionLink?.[1]).toContain("text-black/55");
    expect(heroSection.indexOf('href="/2nd"')).toBeLessThan(heroSection.indexOf('href="/2026"'));
    expect(topPage).not.toContain('href="#next"');
  });

  it("手描き案どおり大banner、申込・news・2つのメリット、右側4導線をまとめる", () => {
    expect(heroSection).toContain("topHeroSlides");
    expect(heroSection).toContain("前のイベントバナー");
    expect(heroSection).toContain("次のイベントバナー");
    expect(heroSection).toContain("イベントバナー選択");
    expect(heroSection).toContain("aria-pressed={index === activeSlide}");
    expect(heroSection).toContain("min-h-8 min-w-8");
    expect(heroSection).toContain("rounded-[1.4rem]");

    const portal = topPage.slice(topPage.indexOf("function TopPortalSection()"), topPage.indexOf("export default function"));
    expect(portal).toContain("第2回 お申し込み受付中");
    expect(portal).toContain("新着ニュース");
    expect(portal).toContain("出展企業のメリット");
    expect(portal).toContain("ライブコマーサーのメリット");
    expect(portal).toContain("LCF公式TikTok");
    expect(portal).toContain("第1回 公式動画");
    expect(portal).toContain("第1回 開催レポート");
    expect(portal).toContain("LCMで商品を探す");
    expect(portal).toContain("href={secondEdition.applicationCompanyPath}");
    expect(portal).toContain("href={secondEdition.applicationLiverPath}");
    expect(portal).toContain('href="/2nd#official-movie"');
    expect(portal).toContain('href={lcfOfficialTiktok} target="_blank" rel="noreferrer"');
    expect(portal).toContain('target="_blank" rel="noreferrer"');
    expect(portal).toContain("grid gap-2 sm:grid-cols-2");
    expect(portal).toContain("grid gap-5 md:grid-cols-2");
    expect(portal).toContain('lg:grid-cols-[minmax(0,1fr)_320px]');
    expect(portal).toContain("sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1");
    expect(topPage).toContain("<TopPortalSection />");
  });

  it("指定されたPROVEN IMPACT以降をTOPから完全に削除する", () => {
    for (const removed of [
      "function ImpactSection()",
      "function PhotoMosaic()",
      "function ExhibitorArchiveSection()",
      "function PlatformSection()",
      "function ArchiveSection()",
      "function MediaSection()",
      "function NextChapterSection()",
      "01 / PROVEN IMPACT",
      "第1回から、",
    ]) {
      expect(topPage).not.toContain(removed);
    }
    expect(topPage).toContain("<main>\n        <HeroSection />\n        <TopPortalSection />\n      </main>");
  });
});
