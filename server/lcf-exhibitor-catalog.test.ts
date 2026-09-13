import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("client/src/App.tsx", "utf8");
const data = readFileSync("client/src/data/lcf2026ExhibitorCatalog.ts", "utf8");
const page = readFileSync("client/src/pages/Lcf2026Exhibitors.tsx", "utf8");
const top = readFileSync("client/src/pages/LiveCommerceFestivalTop.tsx", "utf8");
const server = readFileSync("server/_core/index.ts", "utf8");

describe("LCF 2026 exhibitor catalogue archive", () => {
  it("preserves every supplied catalogue page in thumbnail, high-resolution and text forms", () => {
    expect(data.match(/^    "page":/gm)).toHaveLength(32);
    expect(data.match(/"thumbnailUrl": "https:\/\/files\.manuscdn\.com\//g)).toHaveLength(32);
    expect(data.match(/"imageUrl": "https:\/\/files\.manuscdn\.com\//g)).toHaveLength(32);
    expect(data.match(/"sourceText":/g)).toHaveLength(32);
    for (const source of ["株式会社Qvou", "株式会社シンビシン", "Naturecan", "La Bella株式会社", "KYOGOKU JAPAN", "株式会社チュチュル"]) {
      expect(data).toContain(source);
    }
  });

  it("does not activate known placeholder or temporary source URLs as official links", () => {
    expect(data).not.toContain('"officialUrl": "https://example.com');
    expect(data).not.toContain('"officialUrl": "https://hairreprolp2omyjrkk.manus.space');
  });

  it("provides search, responsive page cards, full-text access and an accessible lightbox", () => {
    expect(page).toContain("企業名・商品名・キーワードで検索");
    expect(page).toContain("page.sourceText");
    expect(page).toContain('role="dialog"');
    expect(page).toContain("高解像度で開く");
    expect(page).toContain("全32ページ");
  });

  it("links the archive from the festival TOP and registers its public route", () => {
    expect(app).toContain('<Route path="/livecommercefestival/2026/exhibitors" component={Lcf2026Exhibitors} />');
    expect(top).toContain('id="exhibitors"');
    expect(top).toContain("第1回 出展企業実績");
    expect(top).toContain('href="/livecommercefestival/2026/exhibitors"');
  });

  it("publishes crawlable metadata, structured data, sitemap and robots entries", () => {
    expect(server).toContain('app.get("/livecommercefestival/2026/exhibitors"');
    expect(server).toContain('const pageUrl = `${baseUrl}/livecommercefestival/2026/exhibitors`');
    expect(server).toContain('"@type": "CollectionPage"');
    expect(server).toContain("numberOfItems: 32");
    expect(server).toContain("Allow: /livecommercefestival/2026/exhibitors");
  });
});
