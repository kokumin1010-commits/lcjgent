import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8");

const topPage = readProjectFile("client/src/pages/LiveCommerceFestivalTop.tsx");
const heroSection = topPage.slice(topPage.indexOf("function HeroSection()"), topPage.indexOf("function ImpactSection()"));

describe("LCFトップから第2回ページへの導線", () => {
  it("第2回開催情報を黄色の主CTA、第1回イベントページをその下に表示する", () => {
    const secondEditionCta = heroSection.match(/<a href="\/2nd" className="([^"]+)">\s*第2回開催情報を見る/);
    const firstEditionLink = heroSection.match(/<a href="\/2026" className="([^"]+)">\s*第1回イベントページを見る/);
    expect(secondEditionCta?.[1]).toContain("bg-[#f2cb3c]");
    expect(secondEditionCta?.[1]).toContain("text-black");
    expect(firstEditionLink?.[1]).toContain("mt-5");
    expect(firstEditionLink?.[1]).toContain("text-white/65");
    expect(heroSection.indexOf('href="/2nd"')).toBeLessThan(heroSection.indexOf('href="/2026"'));
    expect(topPage).not.toContain('href="#next"');
  });
});
