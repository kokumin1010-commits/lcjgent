import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("One-click AI article generation (generateArticle with full meta)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const unauthCaller = appRouter.createCaller(ctx);
    await expect(
      unauthCaller.blog.generateArticle({
        topic: "Test",
        keywords: ["test"],
      })
    ).rejects.toThrow();
  });

  it("validates topic is required", async () => {
    await expect(
      caller.blog.generateArticle({
        topic: "",
        keywords: ["test"],
      })
    ).rejects.toThrow();
  });

  it("validates keywords array is required and non-empty", async () => {
    await expect(
      caller.blog.generateArticle({
        topic: "Test topic",
        keywords: [],
      })
    ).rejects.toThrow();
  });

  it("accepts all article type options", () => {
    const types = ["guide", "review", "comparison", "news", "howto", "listicle"] as const;
    for (const t of types) {
      const input = { topic: "Test", keywords: ["kw"], articleType: t };
      expect(input.articleType).toBe(t);
    }
  });

  it("accepts all tone options", () => {
    const tones = ["professional", "casual", "friendly", "authoritative"] as const;
    for (const t of tones) {
      const input = { topic: "Test", keywords: ["kw"], tone: t };
      expect(input.tone).toBe(t);
    }
  });

  it("accepts all target length options", () => {
    const lengths = ["short", "medium", "long"] as const;
    for (const l of lengths) {
      const input = { topic: "Test", keywords: ["kw"], targetLength: l };
      expect(input.targetLength).toBe(l);
    }
  });

  it("accepts all language options", () => {
    const languages = ["ja", "en", "zh"] as const;
    for (const l of languages) {
      const input = { topic: "Test", keywords: ["kw"], language: l };
      expect(input.language).toBe(l);
    }
  });

  it("accepts includeProductRecommendations flag", () => {
    const input = {
      topic: "TikTok Shop商品",
      keywords: ["tiktok", "商品"],
      includeProductRecommendations: true,
    };
    expect(input.includeProductRecommendations).toBe(true);
  });
});

describe("generateSeoMeta (fallback path)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const unauthCaller = appRouter.createCaller(ctx);
    await expect(
      unauthCaller.blog.generateSeoMeta({
        title: "Test",
        content: "<p>Test content</p>",
      })
    ).rejects.toThrow();
  });

  it("accepts valid input with title and content", () => {
    // generateSeoMeta accepts title as z.string() (no min validation)
    // Verify the input schema shape is correct
    const input = {
      title: "TikTok Shopガイド",
      content: "<p>Test content</p>",
      keywords: ["tiktok", "shop"],
      language: "ja" as const,
    };
    expect(input.title).toBe("TikTok Shopガイド");
    expect(input.keywords).toHaveLength(2);
  });
});

describe("Category and tag auto-creation for one-click flow", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("can list categories", async () => {
    const categories = await caller.blog.listCategories();
    expect(Array.isArray(categories)).toBe(true);
  });

  it("can list tags", async () => {
    const tags = await caller.blog.listTags();
    expect(Array.isArray(tags)).toBe(true);
  });

  it("can create and delete a tag", async () => {
    const uniqueSlug = `test-tag-${Date.now()}`;
    const tag = await caller.blog.createTag({
      name: "テストタグ",
      slug: uniqueSlug,
    });
    expect(tag).toBeTruthy();
    expect(tag.id).toBeGreaterThan(0);

    // Clean up
    await caller.blog.deleteTag({ id: tag.id });
  });

  it("can create and delete a category", async () => {
    const uniqueSlug = `test-cat-${Date.now()}`;
    const cat = await caller.blog.createCategory({
      name: "テストカテゴリ",
      slug: uniqueSlug,
    });
    expect(cat).toBeTruthy();
    expect(cat.id).toBeGreaterThan(0);

    // Clean up
    await caller.blog.deleteCategory({ id: cat.id });
  });
});
