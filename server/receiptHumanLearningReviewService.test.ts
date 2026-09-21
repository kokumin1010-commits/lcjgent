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
vi.mock("./receiptApprovalService", () => ({ approveReceiptFromEvidence: mocks.approveReceiptFromEvidence }));
vi.mock("./receiptOrderNumberGuard", () => ({ claimReceiptOrderNumber: mocks.claimReceiptOrderNumber }));
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
import { LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE } from "./pointLedgerPolicy";

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
  mocks.overrideAiAutoReviewLog.mockResolvedValue({ ...log, humanOverride: "rejected" });
  mocks.saveAiReceiptLearningExample.mockResolvedValue(undefined);
  mocks.updateLineReceiptStatus.mockResolvedValue(undefined);
  mocks.createReceiptReviewLog.mockResolvedValue(undefined);
  mocks.pushMessage.mockResolvedValue(undefined);
});

describe("resolveHumanLearningReview under Beauty Wallet primary-ledger policy", () => {
  it("rejects approval before database, OCR, point, learning, or notification side effects", async () => {
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "approved",
      humanReason: "evidence complete",
      evidenceKeys: ["order_number"],
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE);

    expect(mocks.getAiAutoReviewLogById).not.toHaveBeenCalled();
    expect(mocks.updateLineReceiptOcr).not.toHaveBeenCalled();
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.overrideAiAutoReviewLog).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("still permits a documented rejection without awarding points", async () => {
    const result = await resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "duplicate evidence",
      evidenceKeys: ["duplicate_conflict"],
      rejectionCategory: "duplicate",
      adminUserId: 7,
      sendNotification: false,
    });

    expect(mocks.updateLineReceiptStatus).toHaveBeenCalledWith(801, "rejected", 7, expect.stringContaining("duplicate evidence"));
    expect(mocks.approveReceiptFromEvidence).not.toHaveBeenCalled();
    expect(mocks.saveAiReceiptLearningExample).toHaveBeenCalledWith(expect.objectContaining({ humanDecision: "rejected" }));
    expect(result).toMatchObject({ success: true, decision: "rejected", removedFromHold: true, learningSaved: true });
  });

  it("still validates rejection reason, evidence, and category", async () => {
    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "   ",
      evidenceKeys: ["duplicate_conflict"],
      rejectionCategory: "duplicate",
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(/请填写人工审核理由/);

    await expect(resolveHumanLearningReview({
      logId: 91,
      decision: "rejected",
      humanReason: "duplicate",
      evidenceKeys: [],
      rejectionCategory: "duplicate",
      adminUserId: 7,
      sendNotification: false,
    })).rejects.toThrow(/至少选择一项/);
  });
});
