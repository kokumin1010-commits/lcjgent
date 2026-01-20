import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  createReportAiAdvice: vi.fn(),
  getAiAdviceByReportId: vi.fn(),
  getAiAdviceById: vi.fn(),
  createAiAdviceFeedback: vi.fn(),
  getUserFeedbackForAdvice: vi.fn(),
  updateAiAdviceFeedback: vi.fn(),
  upsertAiLearningExample: vi.fn(),
  getGoodLearningExamples: vi.fn(),
  getBadLearningExamples: vi.fn(),
  getAiFeedbackStats: vi.fn(),
  getReportById: vi.fn(),
}));

// Mock the LLM function
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import {
  createReportAiAdvice,
  getAiAdviceByReportId,
  getAiAdviceById,
  createAiAdviceFeedback,
  getUserFeedbackForAdvice,
  updateAiAdviceFeedback,
  upsertAiLearningExample,
  getGoodLearningExamples,
  getBadLearningExamples,
  getAiFeedbackStats,
  getReportById,
} from "./db";

import { invokeLLM } from "./_core/llm";

describe("AI Advice Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createReportAiAdvice", () => {
    it("should create AI advice for a report", async () => {
      const mockAdvice = {
        id: 1,
        reportId: 1,
        adviceText: "新規ライバーへのフォローアップを3日以内に行いましょう。",
        adviceType: "general",
        promptUsed: "test prompt",
        createdAt: new Date(),
      };

      vi.mocked(createReportAiAdvice).mockResolvedValue(mockAdvice);

      const result = await createReportAiAdvice({
        reportId: 1,
        adviceText: "新規ライバーへのフォローアップを3日以内に行いましょう。",
        adviceType: "general",
        promptUsed: "test prompt",
      });

      expect(result).toEqual(mockAdvice);
      expect(createReportAiAdvice).toHaveBeenCalledWith({
        reportId: 1,
        adviceText: "新規ライバーへのフォローアップを3日以内に行いましょう。",
        adviceType: "general",
        promptUsed: "test prompt",
      });
    });
  });

  describe("getAiAdviceByReportId", () => {
    it("should return AI advice for a specific report", async () => {
      const mockAdvices = [
        {
          id: 1,
          reportId: 1,
          adviceText: "アドバイス1",
          adviceType: "general",
          createdAt: new Date(),
        },
        {
          id: 2,
          reportId: 1,
          adviceText: "アドバイス2",
          adviceType: "followup",
          createdAt: new Date(),
        },
      ];

      vi.mocked(getAiAdviceByReportId).mockResolvedValue(mockAdvices);

      const result = await getAiAdviceByReportId(1);

      expect(result).toEqual(mockAdvices);
      expect(result.length).toBe(2);
    });

    it("should return empty array when no advice exists", async () => {
      vi.mocked(getAiAdviceByReportId).mockResolvedValue([]);

      const result = await getAiAdviceByReportId(999);

      expect(result).toEqual([]);
    });
  });

  describe("Feedback Functions", () => {
    it("should create feedback for AI advice", async () => {
      vi.mocked(createAiAdviceFeedback).mockResolvedValue(undefined);

      await createAiAdviceFeedback({
        adviceId: 1,
        userId: 1,
        rating: "good",
        comment: "役に立ちました",
      });

      expect(createAiAdviceFeedback).toHaveBeenCalledWith({
        adviceId: 1,
        userId: 1,
        rating: "good",
        comment: "役に立ちました",
      });
    });

    it("should check if user already gave feedback", async () => {
      const mockFeedback = {
        id: 1,
        adviceId: 1,
        userId: 1,
        rating: "good" as const,
        comment: null,
        createdAt: new Date(),
      };

      vi.mocked(getUserFeedbackForAdvice).mockResolvedValue(mockFeedback);

      const result = await getUserFeedbackForAdvice(1, 1);

      expect(result).toEqual(mockFeedback);
    });

    it("should return undefined when no feedback exists", async () => {
      vi.mocked(getUserFeedbackForAdvice).mockResolvedValue(undefined);

      const result = await getUserFeedbackForAdvice(1, 999);

      expect(result).toBeUndefined();
    });

    it("should update existing feedback", async () => {
      vi.mocked(updateAiAdviceFeedback).mockResolvedValue(undefined);

      await updateAiAdviceFeedback(1, { rating: "bad" });

      expect(updateAiAdviceFeedback).toHaveBeenCalledWith(1, { rating: "bad" });
    });
  });

  describe("Learning Examples Functions", () => {
    it("should upsert learning example", async () => {
      vi.mocked(upsertAiLearningExample).mockResolvedValue(undefined);

      await upsertAiLearningExample({
        reportContent: "イベント準備を行いました",
        adviceText: "イベント後のフォローアップを忘れずに",
        isGoodExample: "yes",
        category: "イベント",
      });

      expect(upsertAiLearningExample).toHaveBeenCalledWith({
        reportContent: "イベント準備を行いました",
        adviceText: "イベント後のフォローアップを忘れずに",
        isGoodExample: "yes",
        category: "イベント",
      });
    });

    it("should get good learning examples", async () => {
      const mockExamples = [
        {
          id: 1,
          reportContent: "日報内容1",
          adviceText: "良いアドバイス1",
          isGoodExample: "yes" as const,
          goodCount: 5,
          badCount: 1,
          feedbackCount: 6,
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(getGoodLearningExamples).mockResolvedValue(mockExamples);

      const result = await getGoodLearningExamples(5);

      expect(result).toEqual(mockExamples);
      expect(result[0].isGoodExample).toBe("yes");
    });

    it("should get bad learning examples to avoid", async () => {
      const mockExamples = [
        {
          id: 2,
          reportContent: "日報内容2",
          adviceText: "悪いアドバイス",
          isGoodExample: "no" as const,
          goodCount: 1,
          badCount: 5,
          feedbackCount: 6,
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(getBadLearningExamples).mockResolvedValue(mockExamples);

      const result = await getBadLearningExamples(3);

      expect(result).toEqual(mockExamples);
      expect(result[0].isGoodExample).toBe("no");
    });
  });

  describe("Feedback Statistics", () => {
    it("should return feedback statistics", async () => {
      const mockStats = {
        totalFeedback: 100,
        goodCount: 75,
        badCount: 25,
      };

      vi.mocked(getAiFeedbackStats).mockResolvedValue(mockStats);

      const result = await getAiFeedbackStats();

      expect(result).toEqual(mockStats);
      expect(result.goodCount).toBeGreaterThan(result.badCount);
    });
  });

  describe("LLM Integration", () => {
    it("should generate advice using LLM", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "新規ライバーへの初回連絡後は、3日以内にフォローアップを行うと契約率が上がります。",
            },
          },
        ],
      };

      vi.mocked(invokeLLM).mockResolvedValue(mockResponse as any);

      const result = await invokeLLM({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "日報に対するアドバイスを生成してください。" },
        ],
      });

      expect(result.choices[0].message.content).toContain("フォローアップ");
    });
  });
});
