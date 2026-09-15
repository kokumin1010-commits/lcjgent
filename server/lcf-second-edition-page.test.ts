import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("client/src/pages/LcfSecondEdition.tsx");
const top = read("client/src/pages/LiveCommerceFestivalTop.tsx");
const app = read("client/src/App.tsx");
const server = read("server/_core/index.ts");

describe("LCF second-edition concept page", () => {
  it("registers canonical and short routes without changing the first-edition archive", () => {
    expect(app).toContain('const LcfSecondEdition = lazy(() => import("./pages/LcfSecondEdition"))');
    expect(app).toContain('<Route path="/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/livecommercefestival/2nd" component={LcfSecondEdition} />');
    expect(app).toContain('<Route path="/2026" component={LiveCommerceFestival} />');
    expect(app).toContain('<Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />');
  });

  it("shows the exact planning scale and a 70-booth breakdown", () => {
    expect(page).toContain("約1,500㎡に70のライブコマースブース");
    expect(page).toContain("count: 48");
    expect(page).toContain("count: 14");
    expect(page).toContain("count: 8");
    expect(page).toContain("Array.from({ length: 70 }");
    expect(page).toContain("全70ブース共通の上部サイン");
  });

  it("uses the generated venue and standard-booth visuals plus the official LCF logo", () => {
    expect(page).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MfIYFaLDAkuwUWQv.webp");
    expect(page).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fsPhxYJUIWgseBfW.webp");
    expect(page).toContain('src="/lcf-logo.png"');
  });

  it("does not invent a date, venue, registration opening, or confirmed exhibitor count", () => {
    expect(page).toContain("開催日・会場・募集要項は現在調整中");
    expect(page).toContain("計画70ブース");
    expect(page).not.toMatch(/2027|申込受付中|出展確定70社|会場決定/);
  });

  it("makes the second edition the top-page primary route while preserving proof links", () => {
    expect(top.match(/href="\/2nd"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(top).toContain("第2回開催構想を見る");
    expect(top).toContain('href="/livecommercefestival/2026/report"');
    expect(top).toContain('href="/2026"');
  });

  it("publishes server SEO, sitemap and robots discovery for the canonical page", () => {
    expect(server).toContain('app.get(["/2nd", "/livecommercefestival/2nd"]');
    expect(server).toContain('const pageUrl = `${baseUrl}/livecommercefestival/2nd`');
    expect(server).toContain("第2回 LIVE COMMERCE FESTIVAL｜1,500㎡・70ブース開催構想");
    expect(server).toContain("<loc>${baseUrl}/livecommercefestival/2nd</loc>");
    expect(server).toContain("Allow: /livecommercefestival/2nd");
  });
});
