import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  bumpRevision: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    execute: mocks.execute,
    transaction: mocks.transaction,
  })),
  lockLineGroupConversationUsingExecutor: mocks.lock,
  bumpLineGroupConversationRevisionUsingExecutor: mocks.bumpRevision,
}));

import {
  __lineGroupReplyReviewTestUtils,
  classifyLineGroupReplyNeed,
  dismissLineGroupReplyReviewItem,
  getLineGroupReplyReviewQueue,
} from "./lineGroupReplyReview";

function queryText(value: any): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (Array.isArray(value)) return value.map(queryText).join(" ");
  if (Array.isArray(value.queryChunks)) return value.queryChunks.map(queryText).join(" ");
  if (Array.isArray(value.value)) return value.value.map(queryText).join(" ");
  if (typeof value.value === "string") return value.value;
  return "";
}

describe("LINE group reply review queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prioritizes sample, commercial, schedule and explicit-question messages", () => {
    expect(classifyLineGroupReplyNeed("@LCJ サンプルを送っていただくことは可能でしょうか？")).toMatchObject({
      recommendation: "sample_request",
      shouldReply: true,
    });
    expect(classifyLineGroupReplyNeed("報酬条件と発送時期を教えてください")).toMatchObject({
      recommendation: "commercial_terms",
      shouldReply: true,
    });
    expect(classifyLineGroupReplyNeed("次回のライブ配信予定はいつですか？")).toMatchObject({
      recommendation: "schedule",
      shouldReply: true,
    });
    expect(classifyLineGroupReplyNeed("@LCJ こちらで進めても大丈夫でしょうか？")).toMatchObject({
      recommendation: "question",
      shouldReply: true,
    });
  });

  it("keeps acknowledgements below the AI-reply recommendations", () => {
    expect(classifyLineGroupReplyNeed("ありがとうございます！")).toEqual(expect.objectContaining({
      recommendation: "no_reply",
      shouldReply: false,
      suggestedReply: null,
    }));
    expect(classifyLineGroupReplyNeed("ありがとうございます、よろしくお願いします！")).toMatchObject({
      recommendation: "no_reply",
      shouldReply: false,
    });
  });

  it("returns Chinese safe copy for Chinese sample questions", () => {
    const result = classifyLineGroupReplyNeed("请问可以寄样品吗？");
    expect(result).toMatchObject({ recommendation: "sample_request", shouldReply: true });
    expect(result.suggestedReply).toContain("收件地址等个人信息请不要发在群里");
  });

  it("returns only latest unmatched group inbound rows and maps a safe suggestion", async () => {
    mocks.execute.mockImplementation(async (query: any) => {
      const text = queryText(query);
      if (text.includes("ROW_NUMBER() OVER")) {
        expect(text).toContain("contextSender.userType");
        expect(text).toContain("messages.direction = 'outgoing'");
        expect(text).toContain("messages.responseStatus = 'cancelled'");
        expect(text).not.toContain("contextSender.userType = 'staff'");
        return [[
          {
            id: 98,
            lineGroupId: "C123456789",
            messageId: "m-98",
            direction: "incoming",
            lineUserId: "U-CREATOR",
            senderName: "Cindy",
            senderType: "liver",
            isBlocked: 0,
            content: "こちらは私のアカウントです。",
            responseStatus: "none",
            lineTimestamp: Date.now() - 180_000,
            createdAt: new Date(),
            contextMessageCount: 3,
          },
          {
            id: 99,
            lineGroupId: "C123456789",
            messageId: "m-99",
            direction: "incoming",
            lineUserId: "U-STAFF",
            senderName: "京極 琉",
            senderType: "staff",
            isBlocked: 0,
            content: "こちらで確認します。",
            responseStatus: "none",
            lineTimestamp: Date.now() - 120_000,
            createdAt: new Date(),
            contextMessageCount: 3,
          },
          {
            id: 100,
            lineGroupId: "C123456789",
            messageId: "m-100",
            direction: "incoming",
            lineUserId: "U-CREATOR",
            senderName: "Cindy",
            senderType: "liver",
            isBlocked: 0,
            content: "追加でサンプルも可能でしょうか？",
            responseStatus: "none",
            lineTimestamp: Date.now() - 60_000,
            createdAt: new Date(),
            contextMessageCount: 3,
          },
        ], []];
      }
      expect(text).toContain("lifecycle.isActive = TRUE");
      expect(text).toContain("candidate.sourceType = 'group'");
      expect(text).toContain("candidate.direction = 'incoming'");
      expect(text).toContain("outgoing.direction = 'outgoing'");
      expect(text).toContain("incoming.responseStatus NOT IN ('responded', 'cancelled')");
      expect(text).toContain("GROUP_CONCAT");
      expect(text).toContain("previousOutgoing.direction = 'outgoing'");
      expect(text).toContain("previousOutgoing.responseStatus = 'responded'");
      expect(text).toContain("pendingOutgoing.responseStatus = 'pending'");
      expect(text).toContain("outgoing.messageId LIKE 'manual:%'");
      expect(text).toContain("outgoing.messageId LIKE 'ai-manager:%'");
      expect(text).toContain("outgoing.messageId LIKE 'group-public-question:%'");
      expect(text).toContain("outgoing.messageId LIKE 'line:onboard:r:%'");
      expect(text).not.toContain("auto_followup_%");
      expect(text).toContain("COALESCE(sender.isBlocked, FALSE) = FALSE");
      expect(text).toContain("COALESCE(sender.userType, 'unknown') <> 'staff'");
      expect(text).toContain("candidate.responseStatus NOT IN ('responded', 'cancelled')");
      expect(text).toContain("candidateSender.userType");
      expect(text).toContain("recentSender.userType");
      expect(text).toContain("previousOutgoingSender.userType = 'staff'");
      expect(text).toContain("COALESCE(previousOutgoingSender.isBlocked, FALSE) = FALSE");
      expect(text).toContain("outgoingSender.userType = 'staff'");
      expect(text).toContain("COALESCE(outgoingSender.isBlocked, FALSE) = FALSE");
      expect(text).toContain("settings.proactiveAiEnabled");
      expect(text).toContain("g.autoFollowUpEnabled");
      expect(text).toContain("g.autoFollowUpDays");
      return [[{
        lineGroupId: "C123456789",
        groupName: "テストブランド LCJ",
        pictureUrl: null,
        incomingMessageId: "m-100",
        incomingMessageDbId: 100,
        conversationRevision: 42,
        senderLineUserId: "U123456789",
        senderName: "Cindy",
        content: "@高橋 悠真｜LCJタレント担当",
        unansweredContext: "こちらは私のアカウントです。サンプルを送っていただくことは可能でしょうか？\n@高橋 悠真｜LCJタレント担当",
        unansweredMessageCount: 2,
        deliveryPending: 1,
        lineTimestamp: Date.now() - 60_000,
        createdAt: new Date(),
        analysisEnabled: 1,
        autoReplyEnabled: 1,
        proactiveAiEnabled: 1,
        autoFollowUpEnabled: 1,
        autoFollowUpDays: 2,
      }], []];
    });

    const result = await getLineGroupReplyReviewQueue();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      lineGroupId: "C123456789",
      groupName: "テストブランド LCJ",
      senderName: "Cindy",
      recommendation: "sample_request",
      shouldReply: true,
      unansweredMessageCount: 2,
      conversationRevision: 42,
      deliveryPending: true,
      analysisEnabled: true,
      autoReplyEnabled: true,
      proactiveAiEnabled: true,
      autoFollowUpEnabled: true,
      autoFollowUpDays: 2,
    });
    expect(result[0].suggestedReply).toContain("サンプル提供の可否をブランド側へ確認します");
    expect(result[0].suggestedReply).toContain("個人情報はグループに書かず");
    expect(result[0].contextMessageCount).toBe(3);
    expect(result[0].contextTruncated).toBe(false);
    expect(result[0].contextMessages).toHaveLength(3);
    expect(result[0].contextMessages[1]).toMatchObject({
      senderName: "京極 琉",
      senderType: "staff",
      content: "こちらで確認します。",
    });
  });

  it("drops a stale queue candidate when a known staff reply has the same timestamp and a higher DB id", async () => {
    const baseTime = Date.now() - 180_000;
    mocks.execute.mockImplementation(async (query: any) => {
      const text = queryText(query);
      if (text.includes("ROW_NUMBER() OVER")) {
        return [[
          {
            id: 200,
            lineGroupId: "C-RACE",
            messageId: "m-question",
            direction: "incoming",
            lineUserId: "U-CREATOR",
            senderName: "Creator",
            senderType: "liver",
            isBlocked: 0,
            content: "サンプルは可能でしょうか？",
            responseStatus: "none",
            lineTimestamp: baseTime,
            createdAt: new Date(baseTime),
            contextMessageCount: 2,
          },
          {
            id: 201,
            lineGroupId: "C-RACE",
            messageId: "m-staff",
            direction: "incoming",
            lineUserId: "U-STAFF",
            senderName: "LCJ Staff",
            senderType: "staff",
            isBlocked: 0,
            content: "こちらで確認します。",
            responseStatus: "none",
            lineTimestamp: baseTime,
            createdAt: new Date(baseTime),
            contextMessageCount: 2,
          },
        ], []];
      }
      return [[{
        lineGroupId: "C-RACE",
        groupName: "Race Group",
        incomingMessageId: "m-question",
        incomingMessageDbId: 200,
        conversationRevision: 2,
        senderLineUserId: "U-CREATOR",
        senderName: "Creator",
        content: "サンプルは可能でしょうか？",
        unansweredContext: "サンプルは可能でしょうか？",
        unansweredMessageCount: 1,
        deliveryPending: 0,
        lineTimestamp: baseTime,
        createdAt: new Date(baseTime),
        analysisEnabled: 1,
        autoReplyEnabled: 1,
        proactiveAiEnabled: 1,
        autoFollowUpEnabled: 1,
        autoFollowUpDays: 2,
      }], []];
    });

    await expect(getLineGroupReplyReviewQueue()).resolves.toEqual([]);
  });

  it("supports direct execute-row shapes used by test and driver adapters", () => {
    expect(__lineGroupReplyReviewTestUtils.firstExecuteRows([{ lineGroupId: "C1" }])).toEqual([{ lineGroupId: "C1" }]);
  });

  it("dismisses the unanswered segment through the selected inbound under the group parent lock", async () => {
    let executeCount = 0;
    const tx = { execute: vi.fn(async (query: any) => {
      executeCount += 1;
      const text = queryText(query);
      if (executeCount === 1) {
        expect(text).toContain("selected.messageId =");
        expect(text).toContain("target.id <= selected.id");
        expect(text).toContain("replied.responseStatus = 'responded'");
        expect(text).toContain("repliedSender.userType = 'staff'");
        expect(text).toContain("COALESCE(repliedSender.isBlocked, FALSE) = FALSE");
        expect(text).toContain("targetSender.userType");
        return [[{ id: 98 }, { id: 100 }]];
      }
      expect(text).toContain("id IN");
      expect(text).toContain("lineGroupId =");
      expect(text).toContain("sourceType = 'group'");
      expect(text).toContain("direction = 'incoming'");
      expect(text).toContain("respondedBy =");
      expect(text).toContain("admin:42");
      return [{ affectedRows: 1 }];
    }) };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));

    await expect(dismissLineGroupReplyReviewItem({
      lineGroupId: "C123456789",
      incomingMessageId: "m-100",
      dismissedBy: "admin:42",
    })).resolves.toEqual({ dismissed: true });
    expect(mocks.lock).toHaveBeenCalledWith(tx, "C123456789", false);
    expect(mocks.bumpRevision).toHaveBeenCalledWith(tx, "C123456789");
  });
});
