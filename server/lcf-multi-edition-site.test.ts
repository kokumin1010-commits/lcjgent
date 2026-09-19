import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("client/src/App.tsx", "utf8");
const brandHome = readFileSync("client/src/pages/LiveCommerceFestivalTop.tsx", "utf8");
const report = readFileSync("client/src/pages/Lcf2026Report.tsx", "utf8");
const secondEdition = readFileSync("client/src/pages/LcfSecondEdition.tsx", "utf8");
const data = readFileSync("client/src/data/lcfEditions.ts", "utf8");
const mediaArchive = readFileSync("client/src/components/LcfMediaArchiveSection.tsx", "utf8");
const mediaArchiveData = readFileSync("client/src/data/lcf2026MediaArchive.generated.json", "utf8");

describe("LCF multi-edition brand site", () => {
  it("uses the multi-edition home on the festival domain and keeps the 2026 event page", () => {
    expect(app).toContain('const LiveCommerceFestivalTop = lazy(() => import("./pages/LiveCommerceFestivalTop"))');
    expect(app).toContain('window.location.hostname.includes("livecommercefestival") ? <LiveCommerceFestivalTop /> : <MallHome />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
    expect(app).toContain('<Route path="/livecommercefestival/2nd" component={LcfSecondEdition} />');
  });

  it("registers a permanent first-edition report route", () => {
    expect(app).toContain('const Lcf2026Report = lazy(() => import("./pages/Lcf2026Report"))');
    expect(app).toContain('<Route path="/livecommercefestival/2026/report" component={Lcf2026Report} />');
    expect(report).toContain("第1回LCF 2026開催レポート");
    expect(report).toContain("PHOTO ARCHIVE / 48 SELECTED");
  });

  it("keeps event operations on their existing routes", () => {
    for (const route of [
      "/lcf/login",
      "/lcf/mypage",
      "/lcf/admin",
      "/lcf/booth-reservation",
      "/lcf/booth-checkin",
      "/lcf/guidance",
    ]) {
      expect(app).toContain(`path="${route}"`);
    }
  });

  it("links back to the official LCJ site from both the header and footer", () => {
    expect(brandHome).toContain('const lcjOfficialSite = "https://livecommercejapan.jp/"');
    expect(brandHome.match(/href=\{lcjOfficialSite\}/g)).toHaveLength(2);
    expect(brandHome.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(brandHome).toContain("LCJ公式サイト");
  });

  it("uses exactly 48 selected, optimized and uniquely hosted event photos", () => {
    expect(data.match(/photo\("/g)).toHaveLength(48);
    const webUrls = [...data.matchAll(/"(https:\/\/files\.manuscdn\.com\/[^\"]+\.webp)"/g)].map((match) => match[1]);
    expect(webUrls).toHaveLength(48);
    expect(new Set(webUrls).size).toBe(48);
    expect(data.match(/photo\("[^"]+", "day1"/g)?.length).toBeGreaterThan(0);
    expect(data.match(/photo\("[^"]+", "awards"/g)?.length).toBeGreaterThan(0);
    expect(data.match(/photo\("[^"]+", "day2"/g)?.length).toBeGreaterThan(0);
  });

  it("preserves verified first-edition outcomes and publishes confirmed second-edition facts", () => {
    for (const fact of ["750+", "50", "8,000万円", "23,958点", "193", "満席", "八芳園", "2026.09.08 — 09.09"]) {
      expect(data).toContain(fact);
    }
    expect(data).toContain('note: "第1回開催実績"');
    expect(brandHome).toContain("第1回開催実績（主催者集計）");
    expect(brandHome).toContain("第2回 LIVE COMMERCE FESTIVAL 開催決定");
    expect(secondEdition).toContain("2026年12月8日（火）");
    expect(secondEdition).toContain("浜松町館 2階展示室");
    expect(secondEdition).not.toMatch(/70ブース|70 BOOTHS|1,500㎡/);
  });

  it("publishes a verifiable media index and avoids fabricated testimonials", () => {
    for (const outlet of ["PR TIMES", "日刊スポーツ", "スポーツ報知", "デイリースポーツ", "モデルプレス", "ORICON NEWS", "Pop'n'Roll", "LIVE TIMES", "WWSチャンネル"]) {
      expect(data).toContain(outlet);
    }
    expect(data.match(/summary:/g)).toHaveLength(10);
    expect(mediaArchive).toContain("メディアが捉えた、");
    expect(mediaArchive).toContain("保存プレビュー");
    expect(mediaArchive).toContain("独自取材・インタビュー");
    expect(mediaArchiveData).toContain('"publicationPageCount": 77');
    expect(mediaArchiveData).toContain('"outletCount": 40');
    expect(mediaArchive).toContain("折りたたまず全件表示");
    expect(report).toContain('href="/2nd"');
    expect(report).toContain("第2回イベントページを見る");
    expect(brandHome).not.toMatch(/お客様の声|参加者の声|testimonial/i);
    expect(report).not.toMatch(/お客様の声|参加者の声|testimonial/i);
  });

  it("keeps the photo experience entirely on LCF-owned pages and storage", () => {
    expect(report).toContain("公式写真798枚をダウンロード");
    expect(report).toContain("galleryFilters");
    expect(report).toContain("高解像度で開く");
    expect(report).not.toMatch(/alltuu\.cc|m\.alltuu\.com|公式フォトアルバムを見る/);
  });
});
