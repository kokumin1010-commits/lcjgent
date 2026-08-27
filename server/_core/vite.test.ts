import { describe, expect, it } from "vitest";
import { injectPageMeta } from "./vite";

const template = `
  <title>LCJ MALL - TikTok Shopで買う。そのすべてが、価値になる。</title>
  <meta name="description" content="LCJ Mall description" />
  <meta property="og:title" content="LCJ MALL" />
  <meta property="og:description" content="LCJ Mall description" />
  <meta property="og:site_name" content="LCJ MALL" />
  <meta name="twitter:title" content="LCJ MALL" />
  <meta name="twitter:description" content="LCJ Mall description" />
  <link rel="manifest" href="__MANIFEST_URL__" />
  <link rel="canonical" href="__CANONICAL_URL__" />
  <meta property="og:url" content="__OG_URL__" />
`;

describe("injectPageMeta", () => {
  it("keeps the public home page on the public manifest", () => {
    const html = injectPageMeta(template, "/", "https://lcjmall.com");

    expect(html).toContain('href="/site.webmanifest"');
    expect(html).toContain('href="https://lcjmall.com"');
    expect(html).toContain("<title>LCJ MALL");
  });

  it("uses the master manifest for the master entry page", () => {
    const html = injectPageMeta(template, "/master", "https://lcjmall.com");

    expect(html).toContain('href="/master.webmanifest"');
    expect(html).toContain('href="https://lcjmall.com/master"');
  });

  it("uses the master manifest for nested master routes and ignores query parameters", () => {
    const html = injectPageMeta(template, "/master/finance?tab=cashflow", "https://lcjmall.com");

    expect(html).toContain('href="/master.webmanifest"');
    expect(html).toContain('href="https://lcjmall.com/master/finance"');
    expect(html).toContain('content="https://lcjmall.com/master/finance"');
  });

  it("keeps non-master routes on the public manifest", () => {
    const html = injectPageMeta(template, "/mall/products", "https://lcjmall.com");

    expect(html).toContain('href="/site.webmanifest"');
  });

  it("brands the general application page for the festival domain", () => {
    const html = injectPageMeta(
      template,
      "/livecommercefestival/2026/apply/general?source=qr",
      "https://www.livecommercefestival.com",
    );

    expect(html).toContain("<title>Live Commerce Festival 2026｜一般参加お申し込み</title>");
    expect(html).toContain("3ステップで来場予定を登録");
    expect(html).toContain('content="Live Commerce Festival"');
    expect(html).toContain('href="https://www.livecommercefestival.com/livecommercefestival/2026/apply/general"');
    expect(html).toContain('content="https://www.livecommercefestival.com/livecommercefestival/2026/apply/general"');
    expect(html).not.toContain("LCJ Mall description");
  });
});
