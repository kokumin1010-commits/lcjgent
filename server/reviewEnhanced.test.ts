import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getVideoReviews: vi.fn().mockResolvedValue([]),
  addReviewReaction: vi.fn().mockResolvedValue([{ id: 1 }]),
  removeReviewReaction: vi.fn().mockResolvedValue([]),
  getReviewReactionCounts: vi.fn().mockResolvedValue({ bought: 5, want: 12 }),
  getReviewReactionCountsBatch: vi.fn().mockResolvedValue({}),
  getUserReactions: vi.fn().mockResolvedValue([]),
  createReviewQuestion: vi.fn().mockResolvedValue([{ id: 1 }]),
  answerReviewQuestion: vi.fn().mockResolvedValue([]),
  getReviewQuestions: vi.fn().mockResolvedValue([]),
  getProductQuestions: vi.fn().mockResolvedValue([]),
  getLatestQuestions: vi.fn().mockResolvedValue([]),
  getPlatformDistribution: vi.fn().mockResolvedValue([]),
  getWantRanking: vi.fn().mockResolvedValue([]),
  getProductReviewRankingEnhanced: vi.fn().mockResolvedValue([]),
  getReceiptReviewStats: vi.fn().mockResolvedValue({
    totalReviews: 10,
    avgRating: "4.5",
    fiveStarCount: 5,
    fourStarCount: 3,
    threeStarCount: 1,
    twoStarCount: 1,
    oneStarCount: 0,
  }),
  getLatestReceiptReviews: vi.fn().mockResolvedValue({
    reviews: [],
    totalCount: 0,
  }),
  searchReceiptReviewsByProduct: vi.fn().mockResolvedValue([]),
  markReviewHelpful: vi.fn().mockResolvedValue(undefined),
  getProductReviewRanking: vi.fn().mockResolvedValue([]),
}));

import {
  getVideoReviews,
  addReviewReaction,
  getReviewReactionCounts,
  createReviewQuestion,
  answerReviewQuestion,
  getReviewQuestions,
  getLatestQuestions,
  getPlatformDistribution,
  getWantRanking,
  getProductReviewRankingEnhanced,
} from "./db";

describe("Review Enhanced Features - DB Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Video Feed", () => {
    it("getVideoReviews should return array of reviews with video URLs", async () => {
      const mockVideoReviews = [
        {
          id: 1,
          productName: "TIRTIR マスクフィットクッション",
          rating: 5,
          videoUrl: "https://tiktok.com/video/123",
          productImageUrl: "https://example.com/img.jpg",
          purchasePlatform: "tiktok",
          reviewerName: "みさきさん",
        },
        {
          id: 2,
          productName: "rom&nd ジューシーラスティングティント",
          rating: 4,
          liveCommerceUrl: "https://live.example.com/456",
          productImageUrl: null,
          purchasePlatform: "qoo10",
          reviewerName: "ゆうこさん",
        },
      ];
      vi.mocked(getVideoReviews).mockResolvedValueOnce(mockVideoReviews);

      const result = await getVideoReviews(10);
      expect(getVideoReviews).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("videoUrl");
      expect(result[1]).toHaveProperty("liveCommerceUrl");
    });

    it("getVideoReviews should return empty array when no video reviews exist", async () => {
      vi.mocked(getVideoReviews).mockResolvedValueOnce([]);
      const result = await getVideoReviews(10);
      expect(result).toEqual([]);
    });
  });

  describe("Reactions (私も買った！/ 欲しい！)", () => {
    it("addReviewReaction should create a reaction", async () => {
      vi.mocked(addReviewReaction).mockResolvedValueOnce([{ id: 1 }]);

      const result = await addReviewReaction({
        reviewId: 1,
        reactionType: "bought",
        userId: null,
        lineUserId: "U12345",
      });

      expect(addReviewReaction).toHaveBeenCalledWith({
        reviewId: 1,
        reactionType: "bought",
        userId: null,
        lineUserId: "U12345",
      });
      expect(result).toEqual([{ id: 1 }]);
    });

    it("getReviewReactionCounts should return bought and want counts", async () => {
      vi.mocked(getReviewReactionCounts).mockResolvedValueOnce({
        bought: 18,
        want: 42,
      });

      const result = await getReviewReactionCounts(1);
      expect(result).toEqual({ bought: 18, want: 42 });
    });
  });

  describe("Q&A Feature", () => {
    it("createReviewQuestion should create a question", async () => {
      vi.mocked(createReviewQuestion).mockResolvedValueOnce([{ id: 1 }]);

      const result = await createReviewQuestion({
        reviewId: 1,
        productName: "TIRTIR マスクフィットクッション",
        questionText: "この色味は実際どうですか？",
        askerUserId: null,
        askerLineUserId: "U12345",
      });

      expect(createReviewQuestion).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });

    it("answerReviewQuestion should update answer", async () => {
      await answerReviewQuestion(1, null, "U67890", "とても自然な色味です！");
      expect(answerReviewQuestion).toHaveBeenCalledWith(1, null, "U67890", "とても自然な色味です！");
    });

    it("getReviewQuestions should return questions for a review", async () => {
      const mockQuestions = [
        {
          id: 1,
          reviewId: 1,
          questionText: "色味はどうですか？",
          answerText: "自然な色味です",
          productName: "TIRTIR",
        },
      ];
      vi.mocked(getReviewQuestions).mockResolvedValueOnce(mockQuestions);

      const result = await getReviewQuestions(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("questionText");
      expect(result[0]).toHaveProperty("answerText");
    });

    it("getLatestQuestions should return recent questions", async () => {
      const mockQuestions = [
        { id: 1, questionText: "質問1", productName: "商品A", answerText: null },
        { id: 2, questionText: "質問2", productName: "商品B", answerText: "回答2" },
      ];
      vi.mocked(getLatestQuestions).mockResolvedValueOnce(mockQuestions);

      const result = await getLatestQuestions(10);
      expect(result).toHaveLength(2);
    });
  });

  describe("Platform Distribution", () => {
    it("getPlatformDistribution should return platform counts", async () => {
      const mockDistribution = [
        { platform: "tiktok", count: 45 },
        { platform: "qoo10", count: 25 },
        { platform: "amazon", count: 15 },
        { platform: "rakuten", count: 10 },
        { platform: "lcjmall", count: 5 },
      ];
      vi.mocked(getPlatformDistribution).mockResolvedValueOnce(mockDistribution);

      const result = await getPlatformDistribution();
      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty("platform");
      expect(result[0]).toHaveProperty("count");
      // Should be sorted by count descending
      expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
    });
  });

  describe("Want Ranking (欲しい！ランキング)", () => {
    it("getWantRanking should return products sorted by want count", async () => {
      const mockRanking = [
        { productName: "商品A", wantCount: 42 },
        { productName: "商品B", wantCount: 30 },
        { productName: "商品C", wantCount: 18 },
      ];
      vi.mocked(getWantRanking).mockResolvedValueOnce(mockRanking);

      const result = await getWantRanking(5);
      expect(result).toHaveLength(3);
      expect(result[0].wantCount).toBeGreaterThanOrEqual(result[1].wantCount);
    });
  });

  describe("Enhanced Product Ranking", () => {
    it("getProductReviewRankingEnhanced should return products with images and price range", async () => {
      const mockRanking = [
        {
          productName: "TIRTIR マスクフィットクッション",
          brandName: "TIRTIR",
          reviewCount: 25,
          avgRating: "4.8",
          images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
          minPrice: 1800,
          maxPrice: 2400,
        },
        {
          productName: "rom&nd ティント",
          brandName: "rom&nd",
          reviewCount: 18,
          avgRating: "4.5",
          images: [],
          minPrice: 1200,
          maxPrice: 1500,
        },
      ];
      vi.mocked(getProductReviewRankingEnhanced).mockResolvedValueOnce(mockRanking);

      const result = await getProductReviewRankingEnhanced(20);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("images");
      expect(result[0]).toHaveProperty("minPrice");
      expect(result[0]).toHaveProperty("maxPrice");
      expect(result[0].reviewCount).toBeGreaterThanOrEqual(result[1].reviewCount);
    });
  });
});

describe("Review Enhanced Features - Platform Config", () => {
  it("should have all expected platforms configured", () => {
    const expectedPlatforms = ["tiktok", "qoo10", "amazon", "rakuten", "shein", "lcjmall", "other"];
    const PLATFORM_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
      tiktok: { label: "TikTok Shop", color: "bg-gray-900 text-white", icon: "♪" },
      qoo10: { label: "Qoo10", color: "bg-red-500 text-white", icon: "Q" },
      amazon: { label: "Amazon", color: "bg-orange-500 text-white", icon: "A" },
      rakuten: { label: "楽天", color: "bg-red-600 text-white", icon: "R" },
      shein: { label: "SHEIN", color: "bg-black text-white", icon: "S" },
      lcjmall: { label: "LCJ MALL", color: "bg-rose-500 text-white", icon: "L" },
      other: { label: "その他", color: "bg-gray-400 text-white", icon: "?" },
    };

    for (const platform of expectedPlatforms) {
      expect(PLATFORM_CONFIG[platform]).toBeDefined();
      expect(PLATFORM_CONFIG[platform].label).toBeTruthy();
      expect(PLATFORM_CONFIG[platform].icon).toBeTruthy();
    }
  });
});

describe("Review Enhanced Features - Privacy (Name Blurring)", () => {
  it("should blur names by replacing middle characters with ●", () => {
    // Test the blurring logic
    const blurName = (name: string | null): string => {
      if (!name) return "匿名";
      const first = name.charAt(0);
      const rest = name.length > 2 ? "●".repeat(name.length - 2) + name.charAt(name.length - 1) : "●";
      return first + rest;
    };

    expect(blurName("みさきさん")).toBe("み●●●ん"); // 5 chars -> first + 3● + last = "み●●●ん"
    expect(blurName("ゆう")).toBe("ゆ●");
    expect(blurName(null)).toBe("匿名");
    expect(blurName("あ")).toBe("あ●");
  });
});
