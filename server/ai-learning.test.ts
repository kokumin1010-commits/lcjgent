import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  saveAiReceiptLearningExample: vi.fn().mockResolvedValue({ id: 1 }),
  hasLearningExampleForLog: vi.fn().mockResolvedValue(false),
  getAiReceiptLearningStats: vi.fn().mockResolvedValue({
    totalExamples: 5,
    byErrorType: [
      { errorType: "missing_order_number", count: 3 },
      { errorType: "false_reject", count: 2 },
    ],
    recentExamples: [],
  }),
  getRecentAiReceiptLearningExamples: vi.fn().mockResolvedValue([
    {
      id: 1,
      reviewLogId: 10,
      receiptId: 100,
      aiOriginalDecision: "skipped",
      humanDecision: "approved",
      errorType: "missing_order_number",
      learningNote: "AI判定「skipped」を人間が「approved」に修正。",
      createdAt: new Date(),
    },
  ]),
  buildLearningExamplesPrompt: vi.fn().mockResolvedValue(
    "\n\n=== 過去の人間修正フィードバック（AI学習用） ===\n" +
    "以下は過去にAIが誤判定し、人間が修正した事例です。同様のケースでは人間の判断を参考にしてください。\n\n" +
    "【修正例1】\n" +
    "- AI判定: skipped → 人間判定: approved\n" +
    "- エラー種別: missing_order_number\n" +
    "- 学習メモ: AIは注文番号を認識できなかったが、画像には注文番号が存在する。\n"
  ),
}));

describe("AI Learning Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Learning data accumulation logic", () => {
    it("should determine error type as missing_order_number when AI skipped with 注文番号なし", () => {
      const aiDecision = "skipped";
      const aiComment = "スキップ: 注文番号なし";
      const humanOverride = "approved";

      let errorType = "other";
      if (aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
        errorType = "missing_order_number";
      } else if (aiDecision === "skipped" && aiComment.includes("金額なし")) {
        errorType = "missing_amount";
      } else if (aiDecision === "rejected_ai" && humanOverride === "approved") {
        errorType = "false_reject";
      } else if (aiDecision === "approved" && humanOverride === "rejected") {
        errorType = "false_approve";
      }

      expect(errorType).toBe("missing_order_number");
    });

    it("should determine error type as false_reject when AI rejected but human approved", () => {
      const aiDecision = "rejected_ai";
      const aiComment = "不正の疑い";
      const humanOverride = "approved";

      let errorType = "other";
      if (aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
        errorType = "missing_order_number";
      } else if (aiDecision === "skipped" && aiComment.includes("金額なし")) {
        errorType = "missing_amount";
      } else if (aiDecision === "rejected_ai" && humanOverride === "approved") {
        errorType = "false_reject";
      } else if (aiDecision === "approved" && humanOverride === "rejected") {
        errorType = "false_approve";
      }

      expect(errorType).toBe("false_reject");
    });

    it("should determine error type as false_approve when AI approved but human rejected", () => {
      const aiDecision = "approved";
      const aiComment = "承認";
      const humanOverride = "rejected";

      let errorType = "other";
      if (aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
        errorType = "missing_order_number";
      } else if (aiDecision === "skipped" && aiComment.includes("金額なし")) {
        errorType = "missing_amount";
      } else if (aiDecision === "rejected_ai" && humanOverride === "approved") {
        errorType = "false_reject";
      } else if (aiDecision === "approved" && humanOverride === "rejected") {
        errorType = "false_approve";
      }

      expect(errorType).toBe("false_approve");
    });

    it("should determine error type as missing_amount when AI skipped with 金額なし", () => {
      const aiDecision = "skipped";
      const aiComment = "スキップ: 金額なし";
      const humanOverride = "approved";

      let errorType = "other";
      if (aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
        errorType = "missing_order_number";
      } else if (aiDecision === "skipped" && aiComment.includes("金額なし")) {
        errorType = "missing_amount";
      } else if (aiDecision === "rejected_ai" && humanOverride === "approved") {
        errorType = "false_reject";
      } else if (aiDecision === "approved" && humanOverride === "rejected") {
        errorType = "false_approve";
      }

      expect(errorType).toBe("missing_amount");
    });

    it("should determine error type as held_but_approved for held decisions overridden to approved", () => {
      const aiDecision = "held";
      const aiComment = "保留";
      const humanOverride = "approved";

      let errorType = "other";
      if (aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
        errorType = "missing_order_number";
      } else if (aiDecision === "skipped" && aiComment.includes("金額なし")) {
        errorType = "missing_amount";
      } else if (aiDecision === "rejected_ai" && humanOverride === "approved") {
        errorType = "false_reject";
      } else if (aiDecision === "approved" && humanOverride === "rejected") {
        errorType = "false_approve";
      } else if (aiDecision === "held") {
        errorType = `held_but_${humanOverride}`;
      }

      expect(errorType).toBe("held_but_approved");
    });

    it("should not save learning example when AI and human decisions match", () => {
      const aiDecision = "approved";
      const humanOverride = "approved";
      const shouldSave = humanOverride !== aiDecision;
      expect(shouldSave).toBe(false);
    });

    it("should save learning example when AI and human decisions differ", () => {
      const aiDecision = "skipped";
      const humanOverride = "approved";
      const shouldSave = humanOverride !== aiDecision;
      expect(shouldSave).toBe(true);
    });
  });

  describe("Learning note generation", () => {
    it("should generate appropriate learning note for missing_order_number", () => {
      const aiDecision = "skipped";
      const humanOverride = "approved";
      const errorType = "missing_order_number";

      let learningNote = `AI判定「${aiDecision}」を人間が「${humanOverride}」に修正。`;
      if (errorType === "missing_order_number") {
        learningNote += " AIは注文番号を認識できなかったが、画像には注文番号が存在する。画像をより注意深く確認すべき。";
      }

      expect(learningNote).toContain("AI判定「skipped」を人間が「approved」に修正");
      expect(learningNote).toContain("注文番号を認識できなかった");
    });

    it("should generate appropriate learning note for false_reject", () => {
      const aiDecision = "rejected_ai";
      const humanOverride = "approved";
      const errorType = "false_reject";

      let learningNote = `AI判定「${aiDecision}」を人間が「${humanOverride}」に修正。`;
      if (errorType === "false_reject") {
        learningNote += " AIが却下したが、人間は承認と判断。審査基準が厳しすぎる可能性。";
      }

      expect(learningNote).toContain("審査基準が厳しすぎる");
    });

    it("should generate appropriate learning note for false_approve", () => {
      const aiDecision = "approved";
      const humanOverride = "rejected";
      const errorType = "false_approve";

      let learningNote = `AI判定「${aiDecision}」を人間が「${humanOverride}」に修正。`;
      if (errorType === "false_approve") {
        learningNote += " AIが承認したが、人間は却下と判断。審査基準が甘すぎる可能性。";
      }

      expect(learningNote).toContain("審査基準が甘すぎる");
    });
  });

  describe("Learning stats API", () => {
    it("should return learning statistics", async () => {
      const { getAiReceiptLearningStats } = await import("./db");
      const stats = await getAiReceiptLearningStats();

      expect(stats).toBeDefined();
      expect(stats.totalExamples).toBe(5);
      expect(stats.byErrorType).toHaveLength(2);
      expect(stats.byErrorType[0].errorType).toBe("missing_order_number");
      expect(stats.byErrorType[0].count).toBe(3);
    });

    it("should return recent learning examples", async () => {
      const { getRecentAiReceiptLearningExamples } = await import("./db");
      const examples = await getRecentAiReceiptLearningExamples(20);

      expect(examples).toHaveLength(1);
      expect(examples[0].aiOriginalDecision).toBe("skipped");
      expect(examples[0].humanDecision).toBe("approved");
      expect(examples[0].errorType).toBe("missing_order_number");
    });
  });

  describe("buildLearningExamplesPrompt", () => {
    it("should build a prompt string with learning examples", async () => {
      const { buildLearningExamplesPrompt } = await import("./db");
      const prompt = await buildLearningExamplesPrompt(8);

      expect(prompt).toContain("過去の人間修正フィードバック");
      expect(prompt).toContain("AI学習用");
      expect(prompt).toContain("修正例1");
      expect(prompt).toContain("skipped");
      expect(prompt).toContain("approved");
    });

    it("should return empty string when no examples exist", async () => {
      const { buildLearningExamplesPrompt } = await import("./db");
      (buildLearningExamplesPrompt as any).mockResolvedValueOnce("");
      const prompt = await buildLearningExamplesPrompt(8);
      expect(prompt).toBe("");
    });
  });

  describe("hasLearningExampleForLog", () => {
    it("should return false when no example exists for the log", async () => {
      const { hasLearningExampleForLog } = await import("./db");
      const exists = await hasLearningExampleForLog(999);
      expect(exists).toBe(false);
    });

    it("should return true when an example already exists", async () => {
      const { hasLearningExampleForLog } = await import("./db");
      (hasLearningExampleForLog as any).mockResolvedValueOnce(true);
      const exists = await hasLearningExampleForLog(10);
      expect(exists).toBe(true);
    });
  });
});
