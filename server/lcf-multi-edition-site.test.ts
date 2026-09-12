import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("client/src/App.tsx", "utf8");
const brandHome = readFileSync("client/src/pages/LiveCommerceFestivalTop.tsx", "utf8");
const report = readFileSync("client/src/pages/Lcf2026Report.tsx", "utf8");
const data = readFileSync("client/src/data/lcfEditions.ts", "utf8");

describe("LCF multi-edition brand site", () => {
  it("uses the multi-edition home on the festival domain and keeps the 2026 event page", () => {
    expect(app).toContain('const LiveCommerceFestivalTop = lazy(() => import("./pages/LiveCommerceFestivalTop"))');
    expect(app).toContain('window.location.hostname.includes("livecommercefestival") ? <LiveCommerceFestivalTop /> : <MallHome />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
  });

  it("registers a permanent first-edition report route", () => {
    expect(app).toContain('const Lcf2026Report = lazy(() => import("./pages/Lcf2026Report"))');
    expect(app).toContain('<Route path="/livecommercefestival/2026/report" component={Lcf2026Report} />');
    expect(report).toContain("第1回開催レポート");
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

  it("uses exactly 48 selected, optimized and uniquely hosted event photos", () => {
    expect(data.match(/photo\("/g)).toHaveLength(48);
    const webUrls = [...data.matchAll(/"(https:\/\/files\.manuscdn\.com\/[^\"]+\.webp)"/g)].map((match) => match[1]);
    expect(webUrls).toHaveLength(48);
    expect(new Set(webUrls).size).toBe(48);
    expect(data.match(/photo\("[^"]+", "day1"/g)?.length).toBeGreaterThan(0);
    expect(data.match(/photo\("[^"]+", "awards"/g)?.length).toBeGreaterThan(0);
    expect(data.match(/photo\("[^"]+", "day2"/g)?.length).toBeGreaterThan(0);
  });

  it("presents verified first-edition outcomes without inventing future event details", () => {
    for (const fact of ["750+", "50", "193", "満席", "八芳園", "2026.09.08 — 09.09"]) {
      expect(data).toContain(fact);
    }
    expect(brandHome).toContain("次回開催に向けて準備中");
    expect(brandHome).toContain("開催日・会場・募集開始日は、決定次第");
    expect(brandHome).not.toMatch(/第2回.{0,20}20\d{2}[.年/-]/s);
  });

  it("publishes a verifiable media index and avoids fabricated testimonials", () => {
    for (const outlet of ["PR TIMES", "日刊スポーツ", "スポーツ報知", "デイリースポーツ", "モデルプレス", "Pop'n'Roll", "LIVE TIMES"]) {
      expect(data).toContain(outlet);
    }
    expect(brandHome).not.toMatch(/お客様の声|参加者の声|testimonial/i);
    expect(report).not.toMatch(/お客様の声|参加者の声|testimonial/i);
  });

  it("keeps the full official album available from the curated report", () => {
    expect(report).toContain("https://alltuu.cc/album/e977fc4e6ef93a44477c4294546fadb8/");
    expect(report).toContain("公式フォトアルバムを見る");
    expect(report).toContain("高解像度で開く");
  });
});
