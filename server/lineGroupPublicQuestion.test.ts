import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getLineUserByLineId: vi.fn(),
  reserveLineOutgoingAudit: vi.fn(),
  finalizeLineOutgoingAudit: vi.fn(),
  pushMessage: vi.fn(),
  isLineAiManagerRuntimeEnabled: vi.fn(),
  canDeliverLineAiManagerGroupReply: vi.fn(),
  createLineRetryKey: vi.fn(() => "00000000-0000-4000-8000-000000000123"),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getLineUserByLineId: mocks.getLineUserByLineId,
  reserveLineOutgoingAudit: mocks.reserveLineOutgoingAudit,
  finalizeLineOutgoingAudit: mocks.finalizeLineOutgoingAudit,
}));
vi.mock("./line", () => ({ pushMessage: mocks.pushMessage }));
vi.mock("./lineAiManager", () => ({
  isLineAiManagerRuntimeEnabled: mocks.isLineAiManagerRuntimeEnabled,
  canDeliverLineAiManagerGroupReply: mocks.canDeliverLineAiManagerGroupReply,
}));
vi.mock("./lineRetryKey", () => ({ createLineRetryKey: mocks.createLineRetryKey }));

import {
  classifyLineGroupPublicQuestion,
  composeLineGroupPublicQuestionReply,
  tryHandleLineGroupPublicQuestion,
} from "./lineGroupPublicQuestion";

const params = {
  lineGroupId: "C00000000000000000000000000000001",
  lineUserId: "U00000000000000000000000000000001",
  sourceMessageId: "message-public-question-1",
  text: "@LCJ こちらは私のアカウントです。サンプルを送っていただくことは可能でしょうか？",
};

describe("LINE group public question responder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
    mocks.getLineUserByLineId.mockResolvedValue(null);
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: true, status: "pending" });
    mocks.finalizeLineOutgoingAudit.mockResolvedValue(undefined);
    mocks.pushMessage.mockResolvedValue(true);
    mocks.isLineAiManagerRuntimeEnabled.mockReturnValue(true);
    mocks.canDeliverLineAiManagerGroupReply.mockResolvedValue(true);
  });

  it("classifies only bounded commercial or automation questions", () => {
    expect(classifyLineGroupPublicQuestion(params.text)).toBe("sample_request");
    expect(classifyLineGroupPublicQuestion("@LCJ 成果報酬の条件を教えてください")).toBe("commercial_terms");
    expect(classifyLineGroupPublicQuestion("@LCJ これはAIの自動返信ですか？")).toBe("automation_identity");
    expect(classifyLineGroupPublicQuestion("@LCJ 今日の天気は？")).toBeNull();
  });

  it("answers sample requests without signature, shipment promise, or personal-data collection", () => {
    const reply = composeLineGroupPublicQuestionReply("sample_request", params.text);
    expect(reply).toContain("アカウントの共有ありがとうございます");
    expect(reply).toContain("サンプル提供の可否を確認します");
    expect(reply).toContain("商品名");
    expect(reply).toContain("個人情報は、このグループには送らないでください");
    expect(reply).not.toContain("— 高橋 悠真");
    expect(reply).not.toMatch(/必ず発送|発送します|提供できます/);
  });

  it("honestly answers an automation question without adding a signature", () => {
    const reply = composeLineGroupPublicQuestionReply("automation_identity", "@LCJ これはAIですか？");
    expect(reply).toContain("自動サポートを利用しています");
    expect(reply).not.toContain("— 高橋 悠真");
  });

  it("reserves an immutable audit before idempotent LINE push and finalizes it", async () => {
    await expect(tryHandleLineGroupPublicQuestion(params)).resolves.toBe(true);

    const expectedText = composeLineGroupPublicQuestionReply("sample_request", params.text);
    expect(mocks.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      messageId: `group-public-question:${params.sourceMessageId}`,
      sourceType: "group",
      lineGroupId: params.lineGroupId,
      lineUserId: params.lineUserId,
      senderName: "高橋 悠真",
      content: expectedText,
      rateLimit: {
        messageIdPrefix: "group-public-question:",
        windowMs: 10 * 60 * 1000,
        maxCount: 3,
        errorCode: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
      },
    }));
    expect(mocks.reserveLineOutgoingAudit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.pushMessage.mock.invocationCallOrder[0],
    );
    expect(mocks.createLineRetryKey).toHaveBeenCalledWith(
      `line-group-public-question:${params.lineGroupId}:${params.sourceMessageId}`,
    );
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      params.lineGroupId,
      [{ type: "text", text: expectedText }],
      "00000000-0000-4000-8000-000000000123",
    );
    expect(mocks.finalizeLineOutgoingAudit).toHaveBeenCalledWith(
      `group-public-question:${params.sourceMessageId}`,
      "明示メンション付きsample_request定型回答",
    );
  });

  it("reconciles a responded audit without a second LINE request", async () => {
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status: "responded" });
    await expect(tryHandleLineGroupPublicQuestion(params)).resolves.toBe(true);
    expect(mocks.pushMessage).not.toHaveBeenCalled();
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
  });

  it("treats a repeated-question rate limit as handled without another LINE request", async () => {
    const rateLimitError = new Error("LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED") as Error & { code?: string };
    rateLimitError.code = "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED";
    mocks.reserveLineOutgoingAudit.mockRejectedValue(rateLimitError);

    await expect(tryHandleLineGroupPublicQuestion(params)).resolves.toBe(true);
    expect(mocks.pushMessage).not.toHaveBeenCalled();
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
  });

  it.each([
    { user: { isBlocked: true, userType: "unknown", liverId: null }, label: "blocked" },
    { user: { isBlocked: false, userType: "staff", liverId: null }, label: "staff" },
    { user: { isBlocked: false, userType: "liver", liverId: 9 }, label: "linked or opted-out liver" },
  ])("does not bypass $label participant safeguards", async ({ user }) => {
    mocks.getLineUserByLineId.mockResolvedValue(user);
    await expect(tryHandleLineGroupPublicQuestion(params)).resolves.toBe(false);
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("does not reply when the group setting or lifecycle is disabled", async () => {
    mocks.canDeliverLineAiManagerGroupReply.mockResolvedValue(false);
    await expect(tryHandleLineGroupPublicQuestion(params)).resolves.toBe(false);
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
  });

  it("fails for webhook redelivery when LINE delivery is unconfirmed", async () => {
    mocks.pushMessage.mockResolvedValue(false);
    await expect(tryHandleLineGroupPublicQuestion(params))
      .rejects.toThrow("LINE_GROUP_PUBLIC_QUESTION_DELIVERY_UNCONFIRMED");
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
  });
});
