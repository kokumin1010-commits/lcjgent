import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before importing
vi.mock("./db", () => ({
  listAutoPostSchedules: vi.fn(),
  getNextUnusedKeyword: vi.fn(),
  createAutoPostLog: vi.fn(),
  updateAutoPostLog: vi.fn(),
  markKeywordUsed: vi.fn(),
  incrementScheduleGenerated: vi.fn(),
  createBlogArticle: vi.fn(),
  getBlogArticleBySlug: vi.fn(),
  updateBlogArticle: vi.fn(),
  updateAutoPostSchedule: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "abc123xyz"),
}));

import {
  listAutoPostSchedules,
  getNextUnusedKeyword,
  createAutoPostLog,
  updateAutoPostLog,
  markKeywordUsed,
  incrementScheduleGenerated,
  createBlogArticle,
  getBlogArticleBySlug,
  updateAutoPostSchedule,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { startAutoPostScheduler, stopAutoPostScheduler } from "./autoPostScheduler";

describe("Auto Post Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutoPostScheduler();
    vi.useRealTimers();
  });

  it("should start and stop the scheduler without errors", () => {
    startAutoPostScheduler();
    // Starting again should not create duplicate
    startAutoPostScheduler();
    stopAutoPostScheduler();
    // Stopping again should be safe
    stopAutoPostScheduler();
  });

  it("should skip when no enabled schedules exist", async () => {
    (listAutoPostSchedules as any).mockResolvedValue([]);

    startAutoPostScheduler();

    // Advance past the initial 5-minute delay
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(listAutoPostSchedules).toHaveBeenCalled();
    expect(createAutoPostLog).not.toHaveBeenCalled();
  });

  it("should skip schedules that are not due yet", async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 1,
        name: "Test Schedule",
        enabled: true,
        intervalDays: 2,
        preferredHour: 10,
        nextRunAt: futureDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      },
    ]);

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(listAutoPostSchedules).toHaveBeenCalled();
    expect(createAutoPostLog).not.toHaveBeenCalled();
  });

  it("should fail gracefully when no keywords are available", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;

    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 1,
        name: "Test Schedule",
        enabled: true,
        intervalDays: 2,
        preferredHour: jstHour,
        nextRunAt: pastDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      },
    ]);

    (createAutoPostLog as any).mockResolvedValue({ id: 1 });
    (getNextUnusedKeyword as any).mockResolvedValue(null);

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(createAutoPostLog).toHaveBeenCalled();
    expect(updateAutoPostLog).toHaveBeenCalledWith(1, {
      status: "failed",
      errorMessage: "No keywords available",
    });
  });

  it("should generate article when schedule is due and keyword is available", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;

    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 1,
        name: "SEO Schedule",
        enabled: true,
        intervalDays: 2,
        preferredHour: jstHour,
        nextRunAt: pastDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      },
    ]);

    (createAutoPostLog as any).mockResolvedValue({ id: 10 });
    (getNextUnusedKeyword as any).mockResolvedValue({ id: 5, keyword: "TikTok Shop 始め方" });
    (getBlogArticleBySlug as any).mockResolvedValue(null);
    (createBlogArticle as any).mockResolvedValue({ id: 42 });
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "TikTok Shopの始め方ガイド",
              slug: "tiktok-shop-guide",
              excerpt: "TikTok Shopの始め方を解説",
              contentHtml: "<h2>はじめに</h2><p>TikTok Shopとは</p>",
              seoTitle: "TikTok Shopの始め方",
              seoDescription: "TikTok Shopの始め方を徹底解説",
              tags: ["TikTok", "EC"],
            }),
          },
        },
      ],
    });

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(invokeLLM).toHaveBeenCalled();
    expect(createBlogArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "TikTok Shopの始め方ガイド",
        slug: "tiktok-shop-guide",
        status: "draft",
      })
    );
    expect(markKeywordUsed).toHaveBeenCalledWith(5);
    expect(incrementScheduleGenerated).toHaveBeenCalledWith(1);
    expect(updateAutoPostLog).toHaveBeenCalledWith(10, expect.objectContaining({ status: "completed" }));
    expect(updateAutoPostSchedule).toHaveBeenCalledWith(1, expect.objectContaining({ nextRunAt: expect.any(Date) }));
  });

  it("should handle LLM errors gracefully", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;

    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 1,
        name: "Error Schedule",
        enabled: true,
        intervalDays: 2,
        preferredHour: jstHour,
        nextRunAt: pastDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      },
    ]);

    (createAutoPostLog as any).mockResolvedValue({ id: 20 });
    (getNextUnusedKeyword as any).mockResolvedValue({ id: 3, keyword: "テストKW" });
    (invokeLLM as any).mockRejectedValue(new Error("LLM API error"));

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(updateAutoPostLog).toHaveBeenCalledWith(20, {
      status: "failed",
      errorMessage: "LLM API error",
    });
  });

  it("should publish and send IndexNow when autoPublish is 'publish'", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;

    process.env.APP_URL = "https://lcjmall.com";

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 2,
        name: "Publish Schedule",
        enabled: true,
        intervalDays: 2,
        preferredHour: jstHour,
        nextRunAt: pastDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "publish",
        categoryId: null,
      },
    ]);

    (createAutoPostLog as any).mockResolvedValue({ id: 30 });
    (getNextUnusedKeyword as any).mockResolvedValue({ id: 7, keyword: "EC運営" });
    (getBlogArticleBySlug as any).mockResolvedValue(null);
    (createBlogArticle as any).mockResolvedValue({ id: 55 });
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "EC運営ガイド",
              slug: "ec-guide",
              excerpt: "EC運営の基本",
              contentHtml: "<h2>EC運営</h2><p>基本を解説</p>",
              seoTitle: "EC運営ガイド",
              seoDescription: "EC運営の基本を解説",
              tags: ["EC"],
            }),
          },
        },
      ],
    });

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    expect(createBlogArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        publishedAt: expect.any(Date),
      })
    );

    // IndexNow should be called for published articles
    expect(mockFetch).toHaveBeenCalledWith(
      "https://lcjmall.com/api/indexnow/submit",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should generate unique slug when slug already exists", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;

    (listAutoPostSchedules as any).mockResolvedValue([
      {
        id: 3,
        name: "Slug Test",
        enabled: true,
        intervalDays: 2,
        preferredHour: jstHour,
        nextRunAt: pastDate.toISOString(),
        articleType: "guide",
        tone: "professional",
        articleLength: "standard",
        language: "ja",
        keywordStrategy: "preset",
        generateImages: false,
        autoPublish: "draft",
        categoryId: null,
      },
    ]);

    (createAutoPostLog as any).mockResolvedValue({ id: 40 });
    (getNextUnusedKeyword as any).mockResolvedValue({ id: 9, keyword: "重複テスト" });
    (getBlogArticleBySlug as any).mockResolvedValue({ id: 100 }); // Slug already exists
    (createBlogArticle as any).mockResolvedValue({ id: 60 });
    (invokeLLM as any).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "重複テスト記事",
              slug: "duplicate-slug",
              excerpt: "テスト",
              contentHtml: "<p>テスト</p>",
              seoTitle: "テスト",
              seoDescription: "テスト",
              tags: [],
            }),
          },
        },
      ],
    });

    startAutoPostScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);

    // Should create article with modified slug
    expect(createBlogArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "duplicate-slug-abc123xyz",
      })
    );
  });

  it("should run periodic checks every hour", async () => {
    (listAutoPostSchedules as any).mockResolvedValue([]);

    startAutoPostScheduler();

    // Initial check after 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    expect(listAutoPostSchedules).toHaveBeenCalledTimes(1);

    // Next check after 1 hour
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(listAutoPostSchedules).toHaveBeenCalledTimes(2);

    // Another hour
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(listAutoPostSchedules).toHaveBeenCalledTimes(3);
  });
});
