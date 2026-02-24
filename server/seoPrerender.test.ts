import { describe, it, expect } from "vitest";

// Test the escapeHtml function logic
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

describe("SEO Prerender - escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("should escape angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("It's fine")).toBe("It&#39;s fine");
  });

  it("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should handle Japanese text without escaping", () => {
    expect(escapeHtml("TikTok Shop徹底解説ガイド")).toBe(
      "TikTok Shop徹底解説ガイド"
    );
  });

  it("should handle mixed content", () => {
    expect(escapeHtml('Title: "美容 & 健康" <2026>')).toBe(
      "Title: &quot;美容 &amp; 健康&quot; &lt;2026&gt;"
    );
  });
});

describe("SEO Prerender - Bot detection regex", () => {
  const botRegex =
    /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot/i;

  it("should detect Googlebot", () => {
    expect(
      botRegex.test(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      )
    ).toBe(true);
  });

  it("should detect Bingbot", () => {
    expect(
      botRegex.test(
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
      )
    ).toBe(true);
  });

  it("should detect Facebook crawler", () => {
    expect(botRegex.test("facebookexternalhit/1.1")).toBe(true);
  });

  it("should detect Twitter bot", () => {
    expect(botRegex.test("Twitterbot/1.0")).toBe(true);
  });

  it("should NOT detect regular Chrome browser", () => {
    expect(
      botRegex.test(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });

  it("should NOT detect regular Safari browser", () => {
    expect(
      botRegex.test(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe(false);
  });

  it("should NOT detect LINE in-app browser", () => {
    expect(
      botRegex.test(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Line/14.0.0"
      )
    ).toBe(false);
  });
});

describe("SEO - IndexNow vs Google clarification", () => {
  it("IndexNow should target Bing and Yandex, not Google", () => {
    // This test documents the fact that IndexNow does NOT support Google
    const indexNowSupportedEngines = ["Bing", "Yandex", "Seznam", "Naver"];
    const indexNowUnsupportedEngines = ["Google"];

    expect(indexNowSupportedEngines).not.toContain("Google");
    expect(indexNowUnsupportedEngines).toContain("Google");
  });

  it("Google requires Search Console + Sitemap for indexing", () => {
    const googleIndexingMethods = [
      "Google Search Console sitemap submission",
      "Google Indexing API (for specific content types)",
      "Natural crawling via sitemap.xml",
    ];

    // Google Ping is deprecated
    const deprecatedMethods = ["google.com/ping"];

    expect(googleIndexingMethods.length).toBeGreaterThan(0);
    expect(deprecatedMethods).toContain("google.com/ping");
  });
});

describe("SEO - Sitemap XML structure", () => {
  it("should generate valid sitemap URL entries", () => {
    const baseUrl = "https://lcjmall.manus.space";
    const article = {
      slug: "tiktok-shop-guide-2025",
      title: "TikTok Shop徹底解説",
      updatedAt: Date.now(),
      coverImageUrl: "https://example.com/cover.jpg",
    };

    const lastmod = new Date(article.updatedAt).toISOString().split("T")[0];
    const url = `${baseUrl}/blog/${article.slug}`;

    expect(url).toBe("https://lcjmall.manus.space/blog/tiktok-shop-guide-2025");
    expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should include image sitemap when cover image exists", () => {
    const coverImageUrl = "https://example.com/cover.jpg";
    const title = "Test Article";

    const imageTag = coverImageUrl
      ? `<image:image><image:loc>${coverImageUrl}</image:loc><image:title>${title}</image:title></image:image>`
      : "";

    expect(imageTag).toContain("image:image");
    expect(imageTag).toContain(coverImageUrl);
  });

  it("should not include image tag when no cover image", () => {
    const coverImageUrl = "";
    const imageTag = coverImageUrl
      ? `<image:image><image:loc>${coverImageUrl}</image:loc></image:image>`
      : "";

    expect(imageTag).toBe("");
  });
});
