import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiAutoReviewLogById: vi.fn(),
  getLineReceiptById: vi.fn(),
  updateLineReceiptOcr: vi.fn(),
  overrideAiAutoReviewLog: vi.fn(),
  saveAiReceiptLearningExample: vi.fn(),
  hasLearningExampleForLog: vi.fn(),
  updateLineReceiptStatus: vi.fn(),
  createReceiptReviewLog: vi.fn(),
  approveReceiptFromEvidence: vi.fn(),
  claimReceiptOrderNumber: vi.fn(),
  pushMessage: vi.fn(),
}));

vi.mock("./receiptPass2BatchLock", () => ({
  withHumanLearningReviewLock: async (_logId: number, work: () => Promise<unknown>) => await work(),
}));
vi.mock("./receiptApprovalService", () => ({
  approveReceiptFromEvidence: mocks.approveReceiptFromEvidence,
}));
vi.mock("./receiptOrderNumberGuard", () => ({
  claimReceiptOrderNumber: mocks.claimReceiptOrderNumber,
}));
vi.mock("./line", () => ({ pushMessage: mocks.pushMessage }));
vi.mock("./db", () => ({
  getAiAutoReviewLogById: mocks.getAiAutoReviewLogById,
  getLineReceiptById: mocks.getLineReceiptById,
  updateLineReceiptOcr: mocks.updateLineReceiptOcr,
  overrideAiAutoReviewLog: mocks.overrideAiAutoReviewLog,
  saveAiReceiptLearningExample: mocks.saveAiReceiptLearningExample,
  hasLearningExampleForLog: mocks.hasLearningExampleForLog,
  updateLineReceiptStatus: mocks.updateLineReceiptStatus,
  createReceiptReviewLog: mocks.createReceiptReviewLog,
}));

import { resolveHumanLearningReview } from "./receiptHumanLearningReviewService";

const log = {
  id: 91,
  receiptId: 801,
  aiPass: 2,
  beforeStatus: "on_hold",
  afterStatus: "on_hold",
  aiDecision: "keep_manual",
  humanOverride: null,
  isDryRun: false,
  reasonCode: "HARD_RISK",
  aiReason: "same image risk",
  aiComment: "manual evidence needed",
  aiConfidence: 40,
  orderNumber: "1234567890123456",
  totalAmount: 5000,
  storeName: "TikTok Shop",
  imageUrl: "https://example.invalid/receipt.webp",
};
const receipt = {
  id: 801,
  lineUserId: "local-line-user",
  status: "on_hold",
  orderNumber: "1234567890123456",
  totalAmount: 5000,
  storeName: "TikTok Shop",
  imageUrl: "https://example.invalid/receipt.webp",
  imageUrls: ["https://example.invalid/receipt.webp"],
  ocrConfidence: "42.00",
  fraudFlags: ["same_image_reuse"],
  fraudScore: 90,
  pointsCalculated: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log });
  mocks.getLineReceiptById.mockResolvedValue({ ...receipt });
  mocks.hasLearningExampleForLog.mockResolvedValue(false);
  mocks.overrideAiAutoReviewLog.mockResolvedValue({ ...log, humanOverride: "approved" });
  mocks.approveReceiptFromEvidence.mockResolvedValue({ success: true, pointsAwarded: 50, skipped: false });
  mocks.claimReceiptOrderNumber.mockImplementation(async (input: any) => {
    const result = {
      orderNumber: "1234567890123456",
      decision: { allowed: true, reason: "same_account_unapproved_canonical_selection", blockingClaim: null },
      message: "current receipt selected",
    };
    if (input.onAllowedWhileLocked) await input.onAllowedWhileLocked(result);
    return result;
  });
  mocks.saveAiReceiptLearningExample.mockResolvedValue(undefined);
  mocks.updateLineReceiptOcr.mockResolvedValue(undefined);
  mocks.updateLineReceiptStatus.mockResolvedValue(undefined);
  mocks.createReceiptReviewLog.mockResolvedValue(undefined);
  mocks.pushMessage.mockResolvedValue(undefined);
});

describe("resolveHumanLearningReview", () => {
  it("approves only after corrections, reason and evidence, then saves a dedicated learning case", async () => {
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "核对原图和重复记录后确认该申报有效",
      evidenceKeys: ["order_number", "duplicate_conflict"],
      correctedOrderNumber: "1234567890123456",
      correctedAmount: 6000,
      correctedStoreName: "TikTok Shop Official",
      adminUserId: 7,
      sendNotification: false,
    });

    expect(mocks.updateLineReceiptOcr).toHaveBeenCalledWith(801, expect.objectContaining({
      orderNumber: "1234567890123456",
      totalAmount: 6000,
      pointsCalculated: 60,
      storeName: "TikTok Shop Official",
    }));
    expect(mocks.approveReceiptFromEvidence).toHaveBeenCalledWith(expect.objectContaining({
      receiptId: 801,
      lineUserId: "local-line-user",
      reviewedBy: 7,
      sendNotification: false,
    }));
    expect(mocks.overrideAiAutoReviewLog).toHaveBeenCalledWith(91, expect.objectContaining({ humanOverride: "approved" }));
    expect(mocks.saveAiReceiptLearningExample).toHaveBeenCalledWith(expect.objectContaining({
      reviewLogId: 91,
      receiptId: 801,
      humanDecision: "approved",
      errorType: "manual_resolution_hard_risk",
      correctAmount: 6000,
    }));
    expect(result).toMatchObject({ success: true, removedFromHold: true, learningSaved: true, decision: "approved" });
  });

  it("rechecks an old same-account conflict and allows the current evidence-complete receipt when other claims are unapproved", async () => {
    mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log, reasonCode: "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" });
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "订单号、金额和配送完成证据齐全，确认为同一实物订单",
      evidenceKeys: ["order_number", "total_amount", "delivery_status"],
      correctedOrderNumber: "1234567890123456",
      correctedAmount: 6000,
      correctedStoreName: "TikTok Shop Official",
      adminUserId: 7,
      sendNotification: false,
    });

    expect(mocks.claimReceiptOrderNumber).toHaveBeenCalledWith(expect.objectContaining({
      receiptId: 801,
      allowSameAccountUnapproved: true,
      onAllowedWhileLocked: expect.any(Function),
    }));
    expect(mocks.updateLineReceiptOcr).toHaveBeenCalled();
    expect(mocks.approveReceiptFromEvidence).toHaveBeenCalledWith(expect.objectContaining({
      orderNumberAlreadyClaimed: true,
    }));
    expect(result).toMatchObject({ success: true, decision: "approved", removedFromHold: true });
  });

  it.each([
    ["same_account_active_order_number", /已通过、已发积分或待处理积分申请/],
    ["cross_account_order_number", /其他账户/],
  ])("blocks a live %s conflict before corrections, approval, points or learning writes", async (reason, expected) => {
    mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log, reasonCode: "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" });
    mocks.claimReceiptOrderNumber.mockResolvedValue({
      orderNumber: "1234567890123456",
      decision: { allowed: false, reason, blockingClaim: { id: 2, source: "line_receipt", ownerKey: "line:OTHER", status: "approved" } },
      message: "blocked",
    });
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "订单号、金额和配送状态都已确认",
      evidenceKeys: ["order_number", "total_amount", "delivery_status"],
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(expected);

    expect(mocks.updateLineReceiptOcr).not.toHaveBeenCalled();
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.updateLineReceiptStatus).not.toHaveBeenCalled();
    expect(mocks.overrideAiAutoReviewLog).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("rejects a same-account duplicate, removes it from hold and saves a dedicated learning case", async () => {
    mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log, reasonCode: "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" });
    mocks.overrideAiAutoReviewLog.mockResolvedValue({ ...log, reasonCode: "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT", humanOverride: "rejected" });
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "重复",
      evidenceKeys: ["duplicate_conflict"],
      rejectionCategory: "duplicate",
      adminUserId: 7,
      sendNotification: false,
    });

    expect(mocks.updateLineReceiptStatus).toHaveBeenCalledWith(801, "rejected", 7, expect.stringContaining("重复"));
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).toHaveBeenCalledWith(expect.objectContaining({
      humanDecision: "rejected",
      errorType: "manual_resolution_same_account_active_order_conflict",
    }));
    expect(result).toMatchObject({ success: true, removedFromHold: true, learningSaved: true, decision: "rejected" });
  });

  it("rejects with a mandatory category, audit log and dedicated learning case", async () => {
    mocks.overrideAiAutoReviewLog.mockResolvedValue({ ...log, humanOverride: "rejected" });
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "原图与既有已通过订单完全相同，属于重复申报",
      evidenceKeys: ["duplicate_conflict", "image_authenticity"],
      rejectionCategory: "duplicate",
      adminUserId: 7,
      sendNotification: false,
    });

    expect(mocks.updateLineReceiptStatus).toHaveBeenCalledWith(801, "rejected", 7, expect.stringContaining("重复申报"));
    expect(mocks.createReceiptReviewLog).toHaveBeenCalledWith(expect.objectContaining({ decision: "rejected", rejectionCategory: "duplicate" }));
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).toHaveBeenCalledWith(expect.objectContaining({ humanDecision: "rejected" }));
    expect(result).toMatchObject({ success: true, removedFromHold: true, learningSaved: true, decision: "rejected" });
  });

  it("is idempotent when the AI log was already handled", async () => {
    mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log, humanOverride: "approved" });
    mocks.hasLearningExampleForLog.mockResolvedValue(true);
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "重复请求不应再次处理任何业务副作用",
      evidenceKeys: ["other"],
      adminUserId: 7,
      sendNotification: false,
    });
    expect(result).toMatchObject({ success: true, alreadyProcessed: true, learningSaved: true });
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.updateLineReceiptStatus).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).not.toHaveBeenCalled();
  });

  it("blocks ordinary AI decisions and leaves business data untouched", async () => {
    mocks.getAiAutoReviewLogById.mockResolvedValue({ ...log, aiDecision: "auto_rejected", afterStatus: "rejected" });
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "普通AI已完成订单不允许进入人工学习流程",
      evidenceKeys: ["other"],
      rejectionCategory: "other",
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(/不属于AI无法判断/);
    expect(mocks.updateLineReceiptStatus).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).not.toHaveBeenCalled();
  });

  it("accepts a concise reason but still requires evidence when called without the UI", async () => {
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "重复",
      evidenceKeys: [],
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(/至少选择一项/);
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
  });

  it("rejects a blank reason even when the UI is bypassed", async () => {
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "   ",
      evidenceKeys: ["duplicate_conflict"],
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(/请填写人工审核理由/);
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
  });
});
