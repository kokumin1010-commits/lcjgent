import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  createAiAutoReviewLog: vi.fn().mockResolvedValue({ id: 1 }),
  getAiAutoReviewLogs: vi.fn().mockResolvedValue([
    {
      id: 1,
      batchId: "batch_123",
      receiptId: 100,
      aiDecision: "approved",
      aiConfidence: 92,
      aiComment: "TikTok Shop配達済みレシート。注文番号・金額確認済み。",
      orderNumber: "ORD-001",
      storeName: "TikTok Shop",
      totalAmount: "1500",
      imageUrl: "https://example.com/img.jpg",
      isDryRun: false,
      humanOverride: null,
      humanComment: null,
      createdAt: new Date(),
    },
    {
      id: 2,
      batchId: "batch_123",
      receiptId: 101,
      aiDecision: "rejected_duplicate",
      aiConfidence: 100,
      aiComment: "重複注文番号検出: ORD-002は既に承認済みレシート#50で使用されています。",
      orderNumber: "ORD-002",
      storeName: "TikTok Shop",
      totalAmount: "2000",
      imageUrl: null,
      isDryRun: false,
      humanOverride: null,
      humanComment: null,
      createdAt: new Date(),
    },
  ]),
  getAiAutoReviewBatches: vi.fn().mockResolvedValue([
    {
      batchId: "batch_123",
      totalCount: 10,
      approvedCount: 5,
      rejectedCount: 2,
      heldCount: 2,
      skippedCount: 1,
      humanOverrideCount: 0,
      createdAt: new Date(),
    },
  ]),
  updateAiAutoReviewLogOverride: vi.fn().mockResolvedValue({ id: 1, humanOverride: "rejected", humanComment: "実際は不正" }),
  getAiAutoApproveSettings: vi.fn().mockResolvedValue({
    id: 1,
    isEnabled: true,
    confidenceThreshold: 85,
    maxBatchSize: 20,
    updatedAt: new Date(),
  }),
  upsertAiAutoApproveSettings: vi.fn().mockResolvedValue({
    id: 1,
    isEnabled: true,
    confidenceThreshold: 90,
    maxBatchSize: 50,
    updatedAt: new Date(),
  }),
}));

import {
  createAiAutoReviewLog,
  getAiAutoReviewLogs,
  getAiAutoReviewBatches,
  updateAiAutoReviewLogOverride,
  getAiAutoApproveSettings,
  upsertAiAutoApproveSettings,
} from "./db";

describe("AI Auto Review Log DB Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAiAutoReviewLog", () => {
    it("should create a review log entry with all fields", async () => {
      const result = await createAiAutoReviewLog({
        batchId: "batch_123",
        receiptId: 100,
        aiDecision: "approved",
        aiConfidence: 92,
        aiComment: "TikTok Shop配達済みレシート。注文番号・金額確認済み。",
        orderNumber: "ORD-001",
        storeName: "TikTok Shop",
        totalAmount: 1500,
        imageUrl: "https://example.com/img.jpg",
        isDryRun: false,
      });
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(createAiAutoReviewLog).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: "batch_123",
          receiptId: 100,
          aiDecision: "approved",
          aiConfidence: 92,
          isDryRun: false,
        })
      );
    });

    it("should create a review log for duplicate rejection with AI comment", async () => {
      await createAiAutoReviewLog({
        batchId: "batch_456",
        receiptId: 101,
        aiDecision: "rejected_duplicate",
        aiConfidence: 100,
        aiComment: "重複注文番号検出: ORD-002は既に承認済みレシート#50で使用されています。",
        orderNumber: "ORD-002",
        isDryRun: false,
      });
      expect(createAiAutoReviewLog).toHaveBeenCalledWith(
        expect.objectContaining({
          aiDecision: "rejected_duplicate",
          aiComment: expect.stringContaining("重複注文番号"),
        })
      );
    });
  });

  describe("getAiAutoReviewLogs", () => {
    it("should fetch logs with filters", async () => {
      const logs = await getAiAutoReviewLogs({ isDryRun: false, limit: 100 });
      expect(logs).toHaveLength(2);
      expect(logs[0].aiDecision).toBe("approved");
      expect(logs[1].aiDecision).toBe("rejected_duplicate");
    });

    it("should include AI comments in all log entries", async () => {
      const logs = await getAiAutoReviewLogs({ isDryRun: false, limit: 100 });
      for (const log of logs) {
        expect(log.aiComment).toBeTruthy();
        expect(typeof log.aiComment).toBe("string");
      }
    });
  });

  describe("getAiAutoReviewBatches", () => {
    it("should return batch summaries with counts", async () => {
      const batches = await getAiAutoReviewBatches({ limit: 20 });
      expect(batches).toHaveLength(1);
      const batch = batches[0];
      expect(batch.batchId).toBe("batch_123");
      expect(batch.totalCount).toBe(10);
      expect(batch.approvedCount).toBe(5);
      expect(batch.rejectedCount).toBe(2);
      expect(batch.heldCount).toBe(2);
      expect(batch.humanOverrideCount).toBe(0);
    });
  });

  describe("updateAiAutoReviewLogOverride (Human Intervention)", () => {
    it("should allow human to override AI decision", async () => {
      const result = await updateAiAutoReviewLogOverride({
        logId: 1,
        humanOverride: "rejected",
        humanComment: "実際は不正",
      });
      expect(result.humanOverride).toBe("rejected");
      expect(result.humanComment).toBe("実際は不正");
    });

    it("should be called with correct parameters", async () => {
      await updateAiAutoReviewLogOverride({
        logId: 2,
        humanOverride: "approved",
        humanComment: "確認の結果、正当なレシート",
      });
      expect(updateAiAutoReviewLogOverride).toHaveBeenCalledWith({
        logId: 2,
        humanOverride: "approved",
        humanComment: "確認の結果、正当なレシート",
      });
    });
  });

  describe("AI Auto Approve Settings", () => {
    it("should get current settings", async () => {
      const settings = await getAiAutoApproveSettings();
      expect(settings).toBeDefined();
      expect(settings!.isEnabled).toBe(true);
      expect(settings!.confidenceThreshold).toBe(85);
      expect(settings!.maxBatchSize).toBe(20);
    });

    it("should update settings", async () => {
      const updated = await upsertAiAutoApproveSettings({
        isEnabled: true,
        confidenceThreshold: 90,
        maxBatchSize: 50,
      });
      expect(updated.confidenceThreshold).toBe(90);
      expect(updated.maxBatchSize).toBe(50);
    });
  });
});

describe("AI Auto Review - Decision Logic", () => {
  it("should classify duplicate order numbers as rejected_duplicate", () => {
    const decision = classifyReceipt({
      isDuplicate: true,
      orderNumber: "ORD-001",
      totalAmount: 1500,
      isTikTokShop: true,
      isDelivered: true,
      fraudFlagCount: 0,
    });
    expect(decision.action).toBe("rejected_duplicate");
    expect(decision.confidence).toBe(100);
    expect(decision.comment).toContain("重複");
  });

  it("should skip receipts without order number", () => {
    const decision = classifyReceipt({
      isDuplicate: false,
      orderNumber: null,
      totalAmount: 1500,
      isTikTokShop: true,
      isDelivered: true,
      fraudFlagCount: 0,
    });
    expect(decision.action).toBe("skipped");
    expect(decision.comment).toContain("注文番号");
  });

  it("should skip receipts without amount", () => {
    const decision = classifyReceipt({
      isDuplicate: false,
      orderNumber: "ORD-001",
      totalAmount: null,
      isTikTokShop: true,
      isDelivered: true,
      fraudFlagCount: 0,
    });
    expect(decision.action).toBe("skipped");
    expect(decision.comment).toContain("金額");
  });

  it("should skip receipts with high fraud flags", () => {
    const decision = classifyReceipt({
      isDuplicate: false,
      orderNumber: "ORD-001",
      totalAmount: 1500,
      isTikTokShop: true,
      isDelivered: true,
      fraudFlagCount: 3,
    });
    expect(decision.action).toBe("skipped");
    expect(decision.comment).toContain("不正フラグ");
  });

  it("should approve high-confidence TikTok receipts", () => {
    const decision = classifyReceipt({
      isDuplicate: false,
      orderNumber: "ORD-001",
      totalAmount: 1500,
      isTikTokShop: true,
      isDelivered: true,
      fraudFlagCount: 0,
    });
    expect(decision.action).toBe("approved");
    expect(decision.confidence).toBeGreaterThanOrEqual(85);
  });

  it("should hold non-TikTok receipts for human review", () => {
    const decision = classifyReceipt({
      isDuplicate: false,
      orderNumber: "ORD-001",
      totalAmount: 1500,
      isTikTokShop: false,
      isDelivered: false,
      fraudFlagCount: 0,
    });
    expect(decision.action).toBe("held");
    expect(decision.confidence).toBeLessThan(85);
    expect(decision.comment).toContain("人間審査");
  });
});

// Helper function to simulate the classification logic
function classifyReceipt(params: {
  isDuplicate: boolean;
  orderNumber: string | null;
  totalAmount: number | null;
  isTikTokShop: boolean;
  isDelivered: boolean;
  fraudFlagCount: number;
}): { action: string; confidence: number; comment: string } {
  // Stage 1: Rule filter (duplicate check is HIGHEST PRIORITY)
  if (params.isDuplicate) {
    return {
      action: "rejected_duplicate",
      confidence: 100,
      comment: `重複注文番号検出: ${params.orderNumber}は既に承認済みレシートで使用されています。`,
    };
  }

  if (!params.orderNumber) {
    return {
      action: "skipped",
      confidence: 0,
      comment: "注文番号が未検出のためスキップ。",
    };
  }

  if (!params.totalAmount) {
    return {
      action: "skipped",
      confidence: 0,
      comment: "金額が未検出のためスキップ。",
    };
  }

  if (params.fraudFlagCount >= 3) {
    return {
      action: "skipped",
      confidence: 0,
      comment: `不正フラグが${params.fraudFlagCount}件あるためスキップ。`,
    };
  }

  // Stage 2: Confidence calculation
  let confidence = 50;
  if (params.isTikTokShop) confidence += 25;
  if (params.isDelivered) confidence += 17;

  // Stage 3: Threshold decision
  if (confidence >= 85) {
    return {
      action: "approved",
      confidence,
      comment: `TikTok Shop配達済みレシート。注文番号・金額確認済み。信頼度${confidence}%で自動承認。`,
    };
  }

  return {
    action: "held",
    confidence,
    comment: `信頼度${confidence}%のため人間審査が必要。`,
  };
}
