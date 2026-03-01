import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAutoApprovalCandidates: vi.fn(),
  batchCheckDuplicateOrderNumbers: vi.fn(),
  getRecentReviewExamples: vi.fn(),
  getLineReceiptById: vi.fn(),
  updateLineReceiptStatus: vi.fn(),
  awardPointsForLineReceipt: vi.fn(),
  getLinePointBalance: vi.fn(),
  confirmPendingReferral: vi.fn(),
  getLineUserByLineId: vi.fn(),
  createAutoReviewOnApproval: vi.fn(),
  createReceiptReviewLog: vi.fn(),
  extractSingleReceiptProducts: vi.fn(),
}));

// Mock the line module
vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import {
  getAutoApprovalCandidates,
  batchCheckDuplicateOrderNumbers,
  getRecentReviewExamples,
  updateLineReceiptStatus,
  awardPointsForLineReceipt,
  getLinePointBalance,
  confirmPendingReferral,
  getLineUserByLineId,
  createAutoReviewOnApproval,
  createReceiptReviewLog,
  extractSingleReceiptProducts,
} from "./db";
import { pushMessage } from "./line";
import { invokeLLM } from "./_core/llm";

// Helper to create a mock candidate
function makeMockCandidate(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    lineUserId: "U_test_user",
    imageUrl: "https://example.com/img.jpg",
    imageUrls: ["https://example.com/img.jpg"],
    storeName: "TikTok Shop",
    totalAmount: 5000,
    ocrRawText: JSON.stringify({
      orderNumber: "123456789012345678",
      isTikTokShop: true,
      isDelivered: true,
      shopName: "TikTok Shop",
      totalAmount: 5000,
    }),
    ocrConfidence: "95.00",
    pointsCalculated: 100,
    fraudFlags: [],
    fraudScore: "0",
    isForceSubmitted: false,
    aiRejectionCategory: null,
    submittedAt: new Date(),
    ...overrides,
  };
}

// Helper to simulate the auto-approve logic (extracted from the mutation)
async function simulateAutoApprove(
  candidates: any[],
  dupeMap: Map<string, { id: number; status: string; lineUserId: string }[]>,
  options: { dryRun: boolean; confidenceThreshold: number; userId: number } = { dryRun: true, confidenceThreshold: 85, userId: 1 }
) {
  const results: any[] = [];

  const orderNumberMap = new Map<number, string>();
  for (const c of candidates) {
    if (c.ocrRawText) {
      try {
        const ocr = typeof c.ocrRawText === "string" ? JSON.parse(c.ocrRawText) : c.ocrRawText;
        const orderNum = String(ocr?.orderNumber || "").trim();
        if (orderNum && orderNum !== "null") {
          orderNumberMap.set(c.id, orderNum);
        }
      } catch { /* skip */ }
    }
  }

  for (const candidate of candidates) {
    const orderNumber = orderNumberMap.get(candidate.id);
    let ocrData: any = {};
    try {
      ocrData = candidate.ocrRawText
        ? (typeof candidate.ocrRawText === "string" ? JSON.parse(candidate.ocrRawText) : candidate.ocrRawText)
        : {};
    } catch { ocrData = {}; }

    // Rule 1: Duplicate order number check
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const otherDupes = dupes.filter(d => d.id !== candidate.id);
      const approvedDupe = otherDupes.find(d => d.status === "approved");
      if (approvedDupe) {
        results.push({
          id: candidate.id,
          action: "rejected_duplicate",
          reason: `重複注文番号: ${orderNumber} (承認済み #${approvedDupe.id})`,
          orderNumber,
          amount: candidate.totalAmount ?? undefined,
        });
        continue;
      }
    }

    // Rule 2: Missing order number
    if (!orderNumber) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: "注文番号なし",
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    // Rule 3: Missing amount
    if (!candidate.totalAmount || candidate.totalAmount <= 0) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: "金額なし",
        orderNumber,
      });
      continue;
    }

    // Rule 4: Force-submitted
    if (candidate.isForceSubmitted) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: "AI弾き→強制申請レシート（人間審査必要）",
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    // Rule 5: High fraud flags
    const fraudFlagCount = candidate.fraudFlags?.length ?? 0;
    if (fraudFlagCount >= 3) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: `不正フラグ${fraudFlagCount}件（人間審査必要）`,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    // LLM / OCR check
    const isTikTok = ocrData.isTikTokShop === true;
    const isDelivered = ocrData.isDelivered === true;

    let aiConfidence = 0;
    let aiReason = "";

    if (isTikTok && isDelivered && orderNumber && candidate.totalAmount > 0) {
      aiConfidence = 92;
      aiReason = "OCRデータ良好";
    } else {
      // Simulate LLM call result
      aiConfidence = 50;
      aiReason = "LLM判定: 低信頼度";
    }

    // Confidence threshold
    if (aiConfidence < options.confidenceThreshold) {
      results.push({
        id: candidate.id,
        action: "held",
        reason: `信頼度不足: ${aiConfidence}% < 閾値${options.confidenceThreshold}%`,
        confidence: aiConfidence,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    results.push({
      id: candidate.id,
      action: "approved",
      reason: aiReason,
      confidence: aiConfidence,
      orderNumber,
      amount: candidate.totalAmount ?? undefined,
    });
  }

  const summary = {
    approved: results.filter(r => r.action === "approved").length,
    skipped: results.filter(r => r.action === "skipped").length,
    held: results.filter(r => r.action === "held").length,
    rejectedDuplicate: results.filter(r => r.action === "rejected_duplicate").length,
  };

  return { processed: results.length, results, summary, dryRun: options.dryRun };
}

describe("AI Auto-Approve Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rule 1: Duplicate Order Number Detection (HIGHEST PRIORITY)", () => {
    it("should reject a receipt when the same order number exists in an approved receipt", async () => {
      const candidate = makeMockCandidate({ id: 10, ocrRawText: JSON.stringify({ orderNumber: "111222333444555666" }) });
      const dupeMap = new Map<string, { id: number; status: string; lineUserId: string }[]>();
      dupeMap.set("111222333444555666", [
        { id: 10, status: "pending", lineUserId: "U_test" },
        { id: 5, status: "approved", lineUserId: "U_other" },
      ]);

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.rejectedDuplicate).toBe(1);
      expect(result.results[0].action).toBe("rejected_duplicate");
      expect(result.results[0].reason).toContain("111222333444555666");
      expect(result.results[0].reason).toContain("#5");
    });

    it("should NOT reject when duplicate exists but is also pending (not approved)", async () => {
      const candidate = makeMockCandidate({
        id: 10,
        ocrRawText: JSON.stringify({ orderNumber: "111222333444555666", isTikTokShop: true, isDelivered: true }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map<string, { id: number; status: string; lineUserId: string }[]>();
      dupeMap.set("111222333444555666", [
        { id: 10, status: "pending", lineUserId: "U_test" },
        { id: 11, status: "pending", lineUserId: "U_other" },
      ]);

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.rejectedDuplicate).toBe(0);
      // Should proceed to approval since OCR data is good
      expect(result.results[0].action).toBe("approved");
    });

    it("should reject multiple candidates with the same duplicate order number", async () => {
      const candidates = [
        makeMockCandidate({ id: 10, ocrRawText: JSON.stringify({ orderNumber: "DUPE_ORDER_1" }) }),
        makeMockCandidate({ id: 11, ocrRawText: JSON.stringify({ orderNumber: "DUPE_ORDER_1" }) }),
      ];
      const dupeMap = new Map<string, { id: number; status: string; lineUserId: string }[]>();
      dupeMap.set("DUPE_ORDER_1", [
        { id: 10, status: "pending", lineUserId: "U_test1" },
        { id: 11, status: "pending", lineUserId: "U_test2" },
        { id: 1, status: "approved", lineUserId: "U_original" },
      ]);

      const result = await simulateAutoApprove(candidates, dupeMap);

      expect(result.summary.rejectedDuplicate).toBe(2);
    });
  });

  describe("Rule 2: Missing Essential Data", () => {
    it("should skip receipts without order number", async () => {
      const candidate = makeMockCandidate({
        id: 20,
        ocrRawText: JSON.stringify({ shopName: "Test Shop" }), // no orderNumber
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0].action).toBe("skipped");
      expect(result.results[0].reason).toBe("注文番号なし");
    });

    it("should skip receipts with null OCR data", async () => {
      const candidate = makeMockCandidate({
        id: 21,
        ocrRawText: null,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0].reason).toBe("注文番号なし");
    });

    it("should skip receipts with zero amount", async () => {
      const candidate = makeMockCandidate({
        id: 22,
        totalAmount: 0,
        ocrRawText: JSON.stringify({ orderNumber: "123456789012345678" }),
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0].reason).toBe("金額なし");
    });
  });

  describe("Rule 3: Force-submitted Receipts", () => {
    it("should skip force-submitted receipts for human review", async () => {
      const candidate = makeMockCandidate({
        id: 30,
        isForceSubmitted: true,
        ocrRawText: JSON.stringify({ orderNumber: "123456789012345678", isTikTokShop: true, isDelivered: true }),
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0].reason).toContain("強制申請");
    });
  });

  describe("Rule 4: High Fraud Flags", () => {
    it("should skip receipts with 3+ fraud flags", async () => {
      const candidate = makeMockCandidate({
        id: 40,
        fraudFlags: ["flag1", "flag2", "flag3"],
        ocrRawText: JSON.stringify({ orderNumber: "123456789012345678", isTikTokShop: true, isDelivered: true }),
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.skipped).toBe(1);
      expect(result.results[0].reason).toContain("不正フラグ3件");
    });

    it("should NOT skip receipts with 2 fraud flags", async () => {
      const candidate = makeMockCandidate({
        id: 41,
        fraudFlags: ["flag1", "flag2"],
        ocrRawText: JSON.stringify({ orderNumber: "123456789012345678", isTikTokShop: true, isDelivered: true }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      // Should proceed to approval since OCR data is good
      expect(result.results[0].action).toBe("approved");
    });
  });

  describe("OCR-based Confidence (TikTok + Delivered)", () => {
    it("should auto-approve with high confidence when isTikTokShop=true AND isDelivered=true", async () => {
      const candidate = makeMockCandidate({
        id: 50,
        ocrRawText: JSON.stringify({
          orderNumber: "999888777666555444",
          isTikTokShop: true,
          isDelivered: true,
          totalAmount: 5000,
        }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      expect(result.summary.approved).toBe(1);
      expect(result.results[0].action).toBe("approved");
      expect(result.results[0].confidence).toBe(92);
    });

    it("should hold when isTikTokShop=false (low confidence from LLM simulation)", async () => {
      const candidate = makeMockCandidate({
        id: 51,
        ocrRawText: JSON.stringify({
          orderNumber: "999888777666555444",
          isTikTokShop: false,
          isDelivered: true,
          totalAmount: 5000,
        }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap);

      // LLM simulation returns 50% confidence, below 85% threshold
      expect(result.summary.held).toBe(1);
      expect(result.results[0].action).toBe("held");
    });
  });

  describe("Confidence Threshold", () => {
    it("should hold when confidence is below threshold", async () => {
      const candidate = makeMockCandidate({
        id: 60,
        ocrRawText: JSON.stringify({
          orderNumber: "999888777666555444",
          isTikTokShop: null,
          isDelivered: true,
          totalAmount: 5000,
        }),
        totalAmount: 5000,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap, {
        dryRun: true,
        confidenceThreshold: 85,
        userId: 1,
      });

      expect(result.summary.held).toBe(1);
      expect(result.results[0].reason).toContain("信頼度不足");
    });

    it("should approve when confidence meets a lower threshold", async () => {
      const candidate = makeMockCandidate({
        id: 61,
        ocrRawText: JSON.stringify({
          orderNumber: "999888777666555444",
          isTikTokShop: null,
          isDelivered: true,
          totalAmount: 5000,
        }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map();

      // With threshold of 40%, the simulated LLM confidence of 50% should pass
      const result = await simulateAutoApprove([candidate], dupeMap, {
        dryRun: true,
        confidenceThreshold: 40,
        userId: 1,
      });

      expect(result.summary.approved).toBe(1);
    });
  });

  describe("Mixed Batch Processing", () => {
    it("should correctly categorize a mixed batch of receipts", async () => {
      const candidates = [
        // 1. Duplicate → rejected_duplicate
        makeMockCandidate({ id: 100, ocrRawText: JSON.stringify({ orderNumber: "DUPE_1" }) }),
        // 2. No order number → skipped
        makeMockCandidate({ id: 101, ocrRawText: JSON.stringify({ shopName: "Test" }) }),
        // 3. Force submitted → skipped
        makeMockCandidate({ id: 102, isForceSubmitted: true, ocrRawText: JSON.stringify({ orderNumber: "UNIQUE_1", isTikTokShop: true, isDelivered: true }) }),
        // 4. Good receipt → approved
        makeMockCandidate({
          id: 103,
          ocrRawText: JSON.stringify({ orderNumber: "UNIQUE_2", isTikTokShop: true, isDelivered: true }),
          totalAmount: 3000,
          pointsCalculated: 60,
        }),
        // 5. No TikTok flag → held (LLM low confidence)
        makeMockCandidate({
          id: 104,
          ocrRawText: JSON.stringify({ orderNumber: "UNIQUE_3", isTikTokShop: false, isDelivered: true }),
          totalAmount: 2000,
        }),
      ];

      const dupeMap = new Map<string, { id: number; status: string; lineUserId: string }[]>();
      dupeMap.set("DUPE_1", [
        { id: 100, status: "pending", lineUserId: "U1" },
        { id: 1, status: "approved", lineUserId: "U_original" },
      ]);

      const result = await simulateAutoApprove(candidates, dupeMap);

      expect(result.processed).toBe(5);
      expect(result.summary.rejectedDuplicate).toBe(1);
      expect(result.summary.skipped).toBe(2); // no order number + force submitted
      expect(result.summary.approved).toBe(1);
      expect(result.summary.held).toBe(1);
    });
  });

  describe("Empty Candidates", () => {
    it("should return empty results when no candidates", async () => {
      const result = await simulateAutoApprove([], new Map());

      expect(result.processed).toBe(0);
      expect(result.summary.approved).toBe(0);
      expect(result.summary.skipped).toBe(0);
      expect(result.summary.held).toBe(0);
      expect(result.summary.rejectedDuplicate).toBe(0);
    });
  });

  describe("DryRun Mode", () => {
    it("should return dryRun=true when in dry run mode", async () => {
      const candidate = makeMockCandidate({
        id: 200,
        ocrRawText: JSON.stringify({ orderNumber: "UNIQUE_DRY", isTikTokShop: true, isDelivered: true }),
        totalAmount: 5000,
        pointsCalculated: 100,
      });
      const dupeMap = new Map();

      const result = await simulateAutoApprove([candidate], dupeMap, {
        dryRun: true,
        confidenceThreshold: 85,
        userId: 1,
      });

      expect(result.dryRun).toBe(true);
      expect(result.summary.approved).toBe(1);
    });
  });
});
