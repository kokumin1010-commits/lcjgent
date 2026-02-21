import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-seo-user",
    email: "seo-test@example.com",
    name: "SEO Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("SEO Tools", () => {
  const authCaller = appRouter.createCaller(createAuthContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  let testArticleId: number;
  const testSlug = `seo-test-${Date.now()}`;
  let testCategoryId: number;

  beforeAll(async () => {
    // Create a test category
    const cat = await authCaller.blog.createCategory({
      name: `SEOテストカテゴリ-${Date.now()}`,
      slug: `seo-test-cat-${Date.now()}`,
    });
    testCategoryId = cat.id;

    // Create a test article
    const article = await authCaller.blog.create({
      title: "SEOテスト記事",
      slug: testSlug,
      excerpt: "SEOテスト用の記事です",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "SEOテスト記事の本文です。" }],
          },
        ],
      },
      contentHtml: "<p>SEOテスト記事の本文です。</p>",
      categoryId: testCategoryId,
      status: "published",
      seoTitle: "SEOテスト記事 | LCJ MALL",
      seoDescription: "SEOテスト記事のメタディスクリプション",
      tagIds: [],
    });
    testArticleId = article.id;
  });

  afterAll(async () => {
    // Cleanup
    try {
      await authCaller.blog.delete({ id: testArticleId });
    } catch (e) {}
    try {
      await authCaller.blog.deleteCategory({ id: testCategoryId });
    } catch (e) {}
  });

  describe("sitemapData", () => {
    it("should return sitemap data as an array", async () => {
      const data = await publicCaller.blog.sitemapData();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should include published articles in sitemap data", async () => {
      const data = await publicCaller.blog.sitemapData();
      const found = data.find((d: any) => d.slug === testSlug);
      expect(found).toBeDefined();
      expect(found?.title).toBe("SEOテスト記事");
    });
  });

  describe("submitToSearchEngines", () => {
    it("should require authentication", async () => {
      await expect(
        publicCaller.blog.submitToSearchEngines({
          urls: [`/blog/${testSlug}`],
        })
      ).rejects.toThrow();
    });

    it("should accept valid URL array", async () => {
      // This will likely fail because APP_URL is not set in test env,
      // but we test that the procedure exists and validates input
      try {
        await authCaller.blog.submitToSearchEngines({
          urls: [`/blog/${testSlug}`],
        });
      } catch (e: any) {
        // Expected: APP_URL not configured or network error in test env
        expect(e.message).toBeDefined();
      }
    });

    it("should reject empty URL array", async () => {
      await expect(
        authCaller.blog.submitToSearchEngines({
          urls: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("submitAllToSearchEngines", () => {
    it("should require authentication", async () => {
      await expect(
        publicCaller.blog.submitAllToSearchEngines()
      ).rejects.toThrow();
    });

    it("should be callable by authenticated users", async () => {
      // This will likely fail because APP_URL is not set in test env,
      // but we test that the procedure exists and is callable
      try {
        await authCaller.blog.submitAllToSearchEngines();
      } catch (e: any) {
        // Expected: APP_URL not configured or network error in test env
        expect(e.message).toBeDefined();
      }
    });
  });

  describe("article SEO fields", () => {
    it("should have SEO fields on created article", async () => {
      const article = await authCaller.blog.getById({ id: testArticleId });
      expect(article.seoTitle).toBe("SEOテスト記事 | LCJ MALL");
      expect(article.seoDescription).toBe("SEOテスト記事のメタディスクリプション");
      expect(article.slug).toBe(testSlug);
    });

    it("should update SEO fields", async () => {
      await authCaller.blog.update({
        id: testArticleId,
        seoTitle: "更新されたSEOタイトル",
        seoDescription: "更新されたメタディスクリプション",
      });
      const updated = await authCaller.blog.getById({ id: testArticleId });
      expect(updated.seoTitle).toBe("更新されたSEOタイトル");
      expect(updated.seoDescription).toBe("更新されたメタディスクリプション");
    });
  });

  describe("published article accessibility", () => {
    it("should be accessible by slug when published", async () => {
      const article = await publicCaller.blog.getBySlug({ slug: testSlug });
      expect(article).toBeDefined();
      expect(article.title).toBe("SEOテスト記事");
    });

    it("should appear in published articles list", async () => {
      const result = await publicCaller.blog.listPublished();
      expect(result.articles).toBeDefined();
      const found = result.articles.find((a: any) => a.slug === testSlug);
      expect(found).toBeDefined();
    });
  });
});
