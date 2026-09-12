import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("LCF public first-view navigation", () => {
  it("uses a clear first-edition label on the brand top and points it to the permanent alias", () => {
    const source = read("../client/src/pages/LiveCommerceFestivalTop.tsx");

    expect(source).not.toContain("2026 EVENT");
    expect(source.match(/第1回イベントページを見る/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('href="/2026"');
    expect(source).toContain('href="/lcf/mypage"');
    expect(source).toContain('href="/livecommercefestival/2026/report#official-downloads"');
    expect(source).toContain("公式写真798枚");
  });

  it("keeps the historical first-edition hero while making its completed state and archive links visible", () => {
    const source = read("../client/src/pages/LiveCommerceFestival.tsx");

    expect(source).toContain('src={IMAGES.heroBg}');
    expect(source).toContain("第1回 開催終了・大盛況");
    expect(source).toContain("開催レポートを見る");
    expect(source).toContain("公式写真798枚を見る");
    expect(source.match(/href="\/lcf\/mypage"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps mypage visible from the report and both Guidance surfaces", () => {
    const report = read("../client/src/pages/Lcf2026Report.tsx");
    const guidance = read("../client/src/pages/LcfGuidance.tsx");
    const guidanceIndex = read("../client/src/pages/LcfGuidanceIndex.tsx");

    expect(report).toContain("第1回イベントページを見る");
    expect(report).toContain('href="/lcf/mypage"');
    expect(guidance).toContain('href="/lcf/mypage"');
    expect(guidanceIndex).toContain('href="/lcf/mypage"');
    expect(guidanceIndex).toContain("第1回イベントページを見る");
  });
});
