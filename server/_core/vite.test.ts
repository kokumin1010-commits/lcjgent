import { describe, expect, it } from "vitest";
import { injectPageMeta } from "./vite";

const template = `
  <link rel="manifest" href="__MANIFEST_URL__" />
  <link rel="canonical" href="__CANONICAL_URL__" />
  <meta property="og:url" content="__OG_URL__" />
`;

describe("injectPageMeta", () => {
  it("keeps the public home page on the public manifest", () => {
    const html = injectPageMeta(template, "/", "https://lcjmall.com");

    expect(html).toContain('href="/site.webmanifest"');
    expect(html).toContain('href="https://lcjmall.com"');
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
});
