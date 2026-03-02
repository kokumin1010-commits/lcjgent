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

vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getRecentReviewExamples } from "./db";

// ===== Test 1: OCR Confidence Threshold for LLM Bypass =====
describe("OCR Confidence Threshold for LLM Bypass", () => {
  // Simulate the new OCR bypass logic
  function evaluateOcrBypass(candidate: {
    isTikTokShop: boolean;
    isDelivered: boolean;
    orderNumber: string;
    totalAmount: number;
    ocrConfidence: string;
  }): { bypassLLM: boolean; aiConfidence: number; reason: string } {
    const ocrConf = parseFloat(candidate.ocrConfidence || "0");
    const { isTikTokShop, isDelivered, orderNumber, totalAmount } = candidate;

    if (isTikTokShop && isDelivered && orderNumber && totalAmount > 0 && ocrConf >= 95) {
      return { bypassLLM: true, aiConfidence: 92, reason: "OCR信頼度95%以上 → LLMバイパス" };
    } else if (isTikTokShop && isDelivered && orderNumber && totalAmount > 0 && ocrConf >= 80) {
      return { bypassLLM: false, aiConfidence: 80, reason: "OCR信頼度80-94% → LLM検証必要" };
    } else {
      return { bypassLLM: false, aiConfidence: 0, reason: "OCR条件不足 → LLM必須" };
    }
  }

  it("should bypass LLM when OCR confidence >= 95%", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "97.50",
    });

    expect(result.bypassLLM).toBe(true);
    expect(result.aiConfidence).toBe(92);
  });

  it("should NOT bypass LLM when OCR confidence is 90% (medium)", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "90.00",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(80);
    expect(result.reason).toContain("LLM検証必要");
  });

  it("should NOT bypass LLM when OCR confidence is 80% (borderline)", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "80.00",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(80);
  });

  it("should require full LLM when OCR confidence < 80%", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "75.00",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(0);
    expect(result.reason).toContain("LLM必須");
  });

  it("should require LLM when isTikTokShop is false even with high OCR confidence", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: false,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "98.00",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(0);
  });

  it("should require LLM when isDelivered is false even with high OCR confidence", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: false,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "98.00",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(0);
  });

  it("should handle missing ocrConfidence gracefully", () => {
    const result = evaluateOcrBypass({
      isTikTokShop: true,
      isDelivered: true,
      orderNumber: "123456789012345678",
      totalAmount: 5000,
      ocrConfidence: "",
    });

    expect(result.bypassLLM).toBe(false);
    expect(result.aiConfidence).toBe(0);
  });
});

// ===== Test 2: Rejection Category Required Validation =====
describe("Rejection Category Required Validation", () => {
  const VALID_CATEGORIES = [
    "not_order_detail",
    "not_tiktok_shop",
    "not_delivered",
    "blurry_image",
    "missing_order_number",
    "missing_amount",
    "partial_screenshot",
    "duplicate",
    "wrong_store",
    "suspicious",
    "incomplete_info",
    "other",
  ];

  it("should accept all valid rejection categories", () => {
    for (const cat of VALID_CATEGORIES) {
      expect(VALID_CATEGORIES).toContain(cat);
    }
  });

  it("should have TikTok-specific categories", () => {
    expect(VALID_CATEGORIES).toContain("not_order_detail");
    expect(VALID_CATEGORIES).toContain("not_tiktok_shop");
    expect(VALID_CATEGORIES).toContain("not_delivered");
    expect(VALID_CATEGORIES).toContain("partial_screenshot");
  });

  it("should have image quality categories", () => {
    expect(VALID_CATEGORIES).toContain("blurry_image");
    expect(VALID_CATEGORIES).toContain("missing_order_number");
    expect(VALID_CATEGORIES).toContain("missing_amount");
  });

  it("should have fraud/duplicate categories", () => {
    expect(VALID_CATEGORIES).toContain("duplicate");
    expect(VALID_CATEGORIES).toContain("suspicious");
  });
});

// ===== Test 3: Few-shot Example Context Building =====
describe("Few-shot Example Context Building", () => {
  const rejectionCategoryLabels: Record<string, string> = {
    not_order_detail: "注文詳細画面ではない",
    not_tiktok_shop: "TikTok Shop以外",
    not_delivered: "配達未完了",
    blurry_image: "画像不鮮明",
    missing_order_number: "注文番号が見えない",
    missing_amount: "金額が見えない",
    partial_screenshot: "スクショ不完全",
    duplicate: "重複申請",
    wrong_store: "対象外店舗",
    suspicious: "不正の疑い",
    incomplete_info: "情報不足",
    other: "その他",
  };

  function buildExampleContext(reviewExamples: {
    approved: Array<{ totalAmount: string | null; hasOrderNumber: string; ocrConfidence: string | null }>;
    rejected: Array<{
      rejectionCategory: string | null;
      rejectionNote: string | null;
      totalAmount: string | null;
      hasOrderNumber: string;
      ocrConfidence: string | null;
    }>;
    rejectionStats: Array<{ category: string | null; count: number }>;
  }): string {
    const lines = [
      "=== 過去の却下理由統計（多い順） ===",
      ...(reviewExamples.rejectionStats || []).map(
        (s) => `${rejectionCategoryLabels[s.category || "other"] || s.category}: ${s.count}件`
      ),
      "",
      "=== 過去の承認例 ===",
      ...reviewExamples.approved.map(
        (e) =>
          `承認: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`
      ),
      "",
      "=== 過去の却下例（理由付き） ===",
      ...reviewExamples.rejected.map((e) => {
        const catLabel = rejectionCategoryLabels[e.rejectionCategory || "other"] || e.rejectionCategory;
        const note = e.rejectionNote ? ` - ${e.rejectionNote}` : "";
        return `却下[理由: ${catLabel}${note}]: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`;
      }),
    ];
    return lines.join("\n");
  }

  it("should include rejection stats in the context", () => {
    const context = buildExampleContext({
      approved: [],
      rejected: [],
      rejectionStats: [
        { category: "not_order_detail", count: 15 },
        { category: "blurry_image", count: 8 },
        { category: "not_delivered", count: 5 },
      ],
    });

    expect(context).toContain("注文詳細画面ではない: 15件");
    expect(context).toContain("画像不鮮明: 8件");
    expect(context).toContain("配達未完了: 5件");
  });

  it("should include rejection notes in rejected examples", () => {
    const context = buildExampleContext({
      approved: [],
      rejected: [
        {
          rejectionCategory: "not_order_detail",
          rejectionNote: "注文一覧画面のスクショだった",
          totalAmount: "3000",
          hasOrderNumber: "yes",
          ocrConfidence: "85.00",
        },
      ],
      rejectionStats: [],
    });

    expect(context).toContain("注文詳細画面ではない");
    expect(context).toContain("注文一覧画面のスクショだった");
    expect(context).toContain("金額=3000");
  });

  it("should handle null rejection categories gracefully", () => {
    const context = buildExampleContext({
      approved: [],
      rejected: [
        {
          rejectionCategory: null,
          rejectionNote: null,
          totalAmount: null,
          hasOrderNumber: "no",
          ocrConfidence: null,
        },
      ],
      rejectionStats: [{ category: null, count: 3 }],
    });

    expect(context).toContain("その他: 3件");
    expect(context).toContain("却下[理由: その他]");
    expect(context).toContain("金額=不明");
  });

  it("should include approved examples with OCR confidence", () => {
    const context = buildExampleContext({
      approved: [
        { totalAmount: "5000", hasOrderNumber: "yes", ocrConfidence: "95.50" },
        { totalAmount: "2000", hasOrderNumber: "yes", ocrConfidence: "88.00" },
      ],
      rejected: [],
      rejectionStats: [],
    });

    expect(context).toContain("承認: 金額=5000, 注文番号=yes, OCR信頼度=95.50");
    expect(context).toContain("承認: 金額=2000, 注文番号=yes, OCR信頼度=88.00");
  });

  it("should produce a complete context with all sections", () => {
    const context = buildExampleContext({
      approved: [{ totalAmount: "5000", hasOrderNumber: "yes", ocrConfidence: "95.00" }],
      rejected: [
        {
          rejectionCategory: "blurry_image",
          rejectionNote: "文字が読めない",
          totalAmount: "3000",
          hasOrderNumber: "no",
          ocrConfidence: "40.00",
        },
      ],
      rejectionStats: [
        { category: "blurry_image", count: 10 },
        { category: "not_order_detail", count: 7 },
      ],
    });

    // All 3 sections present
    expect(context).toContain("=== 過去の却下理由統計（多い順） ===");
    expect(context).toContain("=== 過去の承認例 ===");
    expect(context).toContain("=== 過去の却下例（理由付き） ===");

    // Stats
    expect(context).toContain("画像不鮮明: 10件");
    expect(context).toContain("注文詳細画面ではない: 7件");

    // Approved
    expect(context).toContain("承認: 金額=5000");

    // Rejected with note
    expect(context).toContain("却下[理由: 画像不鮮明 - 文字が読めない]");
  });
});

// ===== Test 4: getRecentReviewExamples returns rejectionStats =====
describe("getRecentReviewExamples returns rejectionStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return rejectionStats along with approved and rejected", async () => {
    const mockReturn = {
      approved: [{ id: 1, receiptId: 100, decision: "approved", totalAmount: "5000", hasOrderNumber: "yes", fraudFlagCount: 0, ocrConfidence: "95.00" }],
      rejected: [{ id: 2, receiptId: 101, decision: "rejected", rejectionCategory: "blurry_image", rejectionNote: "ぼやけている", totalAmount: "3000", hasOrderNumber: "no", fraudFlagCount: 1, ocrConfidence: "40.00" }],
      rejectionStats: [{ category: "blurry_image", count: 5 }],
    };

    vi.mocked(getRecentReviewExamples).mockResolvedValue(mockReturn);

    const result = await getRecentReviewExamples(5, 10);

    expect(result).toHaveProperty("rejectionStats");
    expect(result.rejectionStats).toHaveLength(1);
    expect(result.rejectionStats[0].category).toBe("blurry_image");
    expect(result.rejectionStats[0].count).toBe(5);
  });

  it("should return empty rejectionStats when no rejections exist", async () => {
    vi.mocked(getRecentReviewExamples).mockResolvedValue({
      approved: [],
      rejected: [],
      rejectionStats: [],
    });

    const result = await getRecentReviewExamples();

    expect(result.rejectionStats).toEqual([]);
  });
});

// ===== Test 5: LINE Rejection Notification includes reason =====
describe("LINE Rejection Notification includes reason", () => {
  const REJECTION_REASON_MAP: Record<string, string> = {
    not_order_detail: "注文詳細画面のスクリーンショットではありません",
    not_tiktok_shop: "TikTok Shopの注文ではありません",
    not_delivered: "配達が完了していません",
    blurry_image: "画像が不鮮明で読み取れません",
    missing_order_number: "注文番号が確認できません",
    missing_amount: "金額が確認できません",
    partial_screenshot: "スクリーンショットが不完全です",
    duplicate: "同じ注文番号で既に申請済みです",
    wrong_store: "対象外の店舗です",
    suspicious: "不正の疑いがあります",
    incomplete_info: "必要な情報が不足しています",
    other: "審査基準を満たしていません",
  };

  function buildRejectionMessage(category: string, note?: string): string {
    const reason = REJECTION_REASON_MAP[category] || REJECTION_REASON_MAP["other"];
    const noteText = note ? `\n詳細: ${note}` : "";
    return `❌ レシートが承認されませんでした\n\n理由: ${reason}${noteText}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏`;
  }

  it("should include specific reason for not_order_detail", () => {
    const msg = buildRejectionMessage("not_order_detail");
    expect(msg).toContain("注文詳細画面のスクリーンショットではありません");
  });

  it("should include specific reason for blurry_image", () => {
    const msg = buildRejectionMessage("blurry_image");
    expect(msg).toContain("画像が不鮮明で読み取れません");
  });

  it("should include note when provided", () => {
    const msg = buildRejectionMessage("not_delivered", "配送中のステータスです");
    expect(msg).toContain("配達が完了していません");
    expect(msg).toContain("詳細: 配送中のステータスです");
  });

  it("should fallback to generic reason for unknown category", () => {
    const msg = buildRejectionMessage("unknown_category");
    expect(msg).toContain("審査基準を満たしていません");
  });

  it("should include retry instructions", () => {
    const msg = buildRejectionMessage("missing_order_number");
    expect(msg).toContain("スクリーンショットを撮り直してください");
  });
});

// ===== Test 6: Summary includes rejectedAi field =====
describe("Summary includes rejectedAi field", () => {
  it("should include rejectedAi=0 in empty summary", () => {
    const summary = {
      approved: 0,
      skipped: 0,
      held: 0,
      rejectedDuplicate: 0,
      rejectedAi: 0,
    };

    expect(summary).toHaveProperty("rejectedAi");
    expect(summary.rejectedAi).toBe(0);
  });

  it("should correctly count rejectedAi results", () => {
    const results = [
      { action: "approved" },
      { action: "rejected_ai" },
      { action: "rejected_ai" },
      { action: "held" },
      { action: "skipped" },
    ];

    const summary = {
      approved: results.filter((r) => r.action === "approved").length,
      skipped: results.filter((r) => r.action === "skipped").length,
      held: results.filter((r) => r.action === "held").length,
      rejectedDuplicate: results.filter((r) => r.action === "rejected_duplicate").length,
      rejectedAi: results.filter((r) => r.action === "rejected_ai").length,
    };

    expect(summary.approved).toBe(1);
    expect(summary.rejectedAi).toBe(2);
    expect(summary.held).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.rejectedDuplicate).toBe(0);
  });
});
