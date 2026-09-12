import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync("server/_core/index.ts", "utf8");
const report = readFileSync("client/src/pages/Lcf2026Report.tsx", "utf8");
const brandHome = readFileSync("client/src/pages/LiveCommerceFestivalTop.tsx", "utf8");
const edition = readFileSync("client/src/pages/LiveCommerceFestival.tsx", "utf8");
const pageSeo = readFileSync("client/src/lib/pageSeo.ts", "utf8");

describe("LCF public archive SEO", () => {
  it("serves factual post-event metadata for the festival domain root", () => {
    expect(server).toContain("LIVE COMMERCE FESTIVAL｜ライブコマースの祭典・公式サイト");
    expect(server).toContain("第1回LCF 2026の開催レポート、写真ギャラリー、メディア掲載、公式写真798枚");
    expect(server).not.toMatch(/総額1000万円分|参加無料・事前LINE登録制|出展企業80社|来場ライバー300名/);
  });

  it("canonicalizes both legacy event paths to the short permanent year URL", () => {
    expect(server).toContain('app.get(["/2026", "/livecommercefestival/2026"]');
    expect(server).toContain('const FESTIVAL_PUBLIC_ORIGIN = "https://www.livecommercefestival.com"');
    expect(server.match(/const baseUrl = FESTIVAL_PUBLIC_ORIGIN;/g)).toHaveLength(3);
    expect(server).toContain('const pageUrl = `${baseUrl}/2026`');
    expect(server).toContain('eventStatus: "https://schema.org/EventCompleted"');
    expect(edition).toContain("canonicalPath: '/2026'");
  });

  it("prerenders the report with article, image gallery and breadcrumb structured data", () => {
    expect(server).toContain('app.get("/livecommercefestival/2026/report"');
    expect(server).toContain('"@type": "Article"');
    expect(server).toContain('"@type": "ImageGallery"');
    expect(server).toContain('"@type": "BreadcrumbList"');
    expect(report).toContain('canonicalPath: "/livecommercefestival/2026/report"');
    expect(report).toContain('type: "article"');
  });

  it("uses page-level canonical, OGP and JSON-LD in the SPA", () => {
    for (const token of ["og:title", "og:description", "og:url", "og:image", "twitter:card", 'link[rel="canonical"]', "application/ld+json"]) {
      expect(pageSeo).toContain(token);
    }
    expect(brandHome).toContain("applyPageSeo");
    expect(edition).toContain("applyPageSeo");
    expect(report).toContain("applyPageSeo");
  });

  it("publishes an LCF-only sitemap and protects private operational pages from indexing", () => {
    for (const path of ["/2026", "/livecommercefestival/2026/report", "/lcf/guidance", "/lcf/guidance/2026"]) {
      expect(server).toContain(path);
    }
    expect(server).toContain("X-Robots-Tag");
    expect(server).toContain("noindex, nofollow, noarchive");
    expect(server).toContain("Disallow: /lcf/admin");
    expect(server).toContain("Disallow: /lcf/login");
    expect(server).toContain("Disallow: /lcf/mypage");
  });
});
