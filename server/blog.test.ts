import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-blog-user",
    email: "blog-test@example.com",
    name: "Blog Test User",
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

describe("blog", () => {
  const authCaller = appRouter.createCaller(createAuthContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  let createdCategoryId: number;
  let createdTagId: number;
  let createdArticleId: number;
  const testSlug = `test-article-${Date.now()}`;
  const testCategorySlug = `test-cat-${Date.now()}`;
  const testTagSlug = `test-tag-${Date.now()}`;

  // --- Category Tests ---
  describe("categories", () => {
    it("should list categories (initially may be empty or have existing)", async () => {
      const categories = await publicCaller.blog.listCategories();
      expect(Array.isArray(categories)).toBe(true);
    });

    it("should create a category", async () => {
      const result = await authCaller.blog.createCategory({
        name: "テストカテゴリ",
        slug: testCategorySlug,
        description: "テスト用カテゴリ",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdCategoryId = result.id;
    });

    it("should update a category", async () => {
      const result = await authCaller.blog.updateCategory({
        id: createdCategoryId,
        name: "テストカテゴリ更新",
        slug: testCategorySlug,
        description: "更新された説明",
      });
      expect(result).toEqual({ success: true });
    });

    it("should list categories including the created one", async () => {
      const categories = await publicCaller.blog.listCategories();
      const found = categories.find((c: any) => c.id === createdCategoryId);
      expect(found).toBeDefined();
      expect(found?.name).toBe("テストカテゴリ更新");
    });
  });

  // --- Tag Tests ---
  describe("tags", () => {
    it("should list tags", async () => {
      const tags = await publicCaller.blog.listTags();
      expect(Array.isArray(tags)).toBe(true);
    });

    it("should create a tag", async () => {
      const result = await authCaller.blog.createTag({
        name: "テストタグ",
        slug: testTagSlug,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdTagId = result.id;
    });
  });

  // --- Article Tests ---
  describe("articles", () => {
    it("should create an article", async () => {
      const result = await authCaller.blog.create({
        title: "テスト記事タイトル",
        slug: testSlug,
        excerpt: "これはテスト記事の抜粋です",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "テスト記事の本文です。" }],
            },
          ],
        },
        contentHtml: "<p>テスト記事の本文です。</p>",
        categoryId: createdCategoryId,
        status: "draft",
        seoTitle: "テスト記事 | LCJ MALL",
        seoDescription: "テスト記事のメタディスクリプション",
        tagIds: [createdTagId],
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdArticleId = result.id;
    });

    it("should get article by id", async () => {
      const article = await authCaller.blog.getById({ id: createdArticleId });
      expect(article).toBeDefined();
      expect(article.title).toBe("テスト記事タイトル");
      expect(article.slug).toBe(testSlug);
      expect(article.status).toBe("draft");
      expect(article.tagIds).toContain(createdTagId);
    });

    it("should list articles (protected)", async () => {
      const result = await authCaller.blog.list();
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      const found = result.articles.find((a: any) => a.id === createdArticleId);
      expect(found).toBeDefined();
    });

    it("should update an article", async () => {
      const result = await authCaller.blog.update({
        id: createdArticleId,
        title: "更新されたテスト記事",
        excerpt: "更新された抜粋",
      });
      expect(result).toEqual({ success: true });

      const updated = await authCaller.blog.getById({ id: createdArticleId });
      expect(updated.title).toBe("更新されたテスト記事");
    });

    it("should toggle publish status", async () => {
      // Publish
      const result1 = await authCaller.blog.togglePublish({ id: createdArticleId });
      expect(result1.status).toBe("published");

      // Verify it's published
      const published = await authCaller.blog.getById({ id: createdArticleId });
      expect(published.status).toBe("published");
      expect(published.publishedAt).toBeDefined();

      // Unpublish
      const result2 = await authCaller.blog.togglePublish({ id: createdArticleId });
      expect(result2.status).toBe("draft");
    });

    it("should get article by slug (public)", async () => {
      // First publish the article
      await authCaller.blog.togglePublish({ id: createdArticleId });

      const article = await publicCaller.blog.getBySlug({ slug: testSlug });
      expect(article).toBeDefined();
      expect(article.title).toBe("更新されたテスト記事");
    });

    it("should list published articles (public)", async () => {
      const result = await publicCaller.blog.listPublished();
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();
      const found = result.articles.find((a: any) => a.id === createdArticleId);
      expect(found).toBeDefined();
    });

    it("should get sitemap data", async () => {
      const data = await publicCaller.blog.sitemapData();
      expect(Array.isArray(data)).toBe(true);
      const found = data.find((d: any) => d.slug === testSlug);
      expect(found).toBeDefined();
    });
  });

  // --- AI Generation Tests ---
  describe("AI generation", () => {
    it("should generate an article with SEO/GEO optimization", async () => {
      const result = await authCaller.blog.generateArticle({
        topic: "TikTok Shopでの購入方法",
        keywords: ["TikTok Shop", "購入方法", "使い方"],
        language: "ja",
        tone: "friendly",
        articleType: "howto",
        includeProductRecommendations: false,
        targetLength: "short",
      });
      expect(result).toBeDefined();
      expect(result.html).toBeDefined();
      expect(typeof result.html).toBe("string");
      expect(result.html.length).toBeGreaterThan(100);
      expect(result.keywords).toEqual(["TikTok Shop", "購入方法", "使い方"]);
    }, 60000);

    it("should generate SEO meta information from article content", async () => {
      const result = await authCaller.blog.generateSeoMeta({
        title: "TikTok Shopの使い方完全ガイド",
        content: "<p>TikTok Shopは、TikTokアプリ内で商品を購入できるECプラットフォームです。ライブ配信中に気になった商品をそのまま購入できる便利な機能があります。</p>",
        keywords: ["TikTok Shop", "使い方"],
        language: "ja",
      });
      expect(result).toBeDefined();
      expect(result.seoTitle).toBeDefined();
      expect(typeof result.seoTitle).toBe("string");
      expect(result.seoDescription).toBeDefined();
      expect(typeof result.seoDescription).toBe("string");
      expect(result.slug).toBeDefined();
      expect(typeof result.slug).toBe("string");
    }, 60000);

    it("should suggest keywords for a topic", async () => {
      const result = await authCaller.blog.suggestKeywords({
        topic: "TikTok Shop ライブコマース",
        language: "ja",
      });
      expect(result).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(result.keywords.length).toBeGreaterThan(0);
      const firstKeyword = result.keywords[0];
      expect(firstKeyword.keyword).toBeDefined();
      expect(firstKeyword.searchIntent).toBeDefined();
      expect(firstKeyword.difficulty).toBeDefined();
      expect(firstKeyword.category).toBeDefined();
    }, 60000);
  });

  // --- Cleanup ---
  describe("cleanup", () => {
    it("should delete the test article", async () => {
      const result = await authCaller.blog.delete({ id: createdArticleId });
      expect(result).toEqual({ success: true });
    });

    it("should delete the test tag", async () => {
      const result = await authCaller.blog.deleteTag({ id: createdTagId });
      expect(result).toEqual({ success: true });
    });

    it("should delete the test category", async () => {
      const result = await authCaller.blog.deleteCategory({ id: createdCategoryId });
      expect(result).toEqual({ success: true });
    });
  });
});
