import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  createOrUpdateLineUser: vi.fn(),
  getLineUserByLineId: vi.fn(),
  updateLineMessageSenderName: vi.fn(),
  updateLineUserLastMessage: vi.fn(),
  saveLineGroupInboundMessageAndActivity: vi.fn(),
  saveLineMessage: vi.fn(),
  canLineAiManagerReplyInGroup: vi.fn(async () => true),
  tryHandleLineAiManagerMessage: vi.fn(async () => false),
  recordLineAiManagerInboundActivity: vi.fn(async () => false),
  scheduleLineGroupInsightRefresh: vi.fn(),
  continueLineGroupOnboarding: vi.fn(async () => false),
  tryHandleLineGroupPublicQuestion: vi.fn(async () => false),
  getGroupMemberProfile: vi.fn(),
  syncLineGroupMetadata: vi.fn(),
  containsReminderKeyword: vi.fn(() => false),
  createReminderFromMessage: vi.fn(),
  getReminderListMessage: vi.fn(),
  getLinePointBalance: vi.fn(),
  getLineReceiptsByUser: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

vi.mock("./lineReminder", () => ({
  containsReminderKeyword: mocks.containsReminderKeyword,
  createReminderFromMessage: mocks.createReminderFromMessage,
  getReminderListMessage: mocks.getReminderListMessage,
}));

vi.mock("./lineAiManager", () => ({
  canLineAiManagerReplyInGroup: mocks.canLineAiManagerReplyInGroup,
  tryHandleLineAiManagerMessage: mocks.tryHandleLineAiManagerMessage,
  recordLineAiManagerInboundActivity: mocks.recordLineAiManagerInboundActivity,
  scheduleLineGroupInsightRefresh: mocks.scheduleLineGroupInsightRefresh,
}));

vi.mock("./lineGroupOnboarding", () => ({
  continueLineGroupOnboarding: mocks.continueLineGroupOnboarding,
}));

vi.mock("./lineGroupPublicQuestion", () => ({
  tryHandleLineGroupPublicQuestion: mocks.tryHandleLineGroupPublicQuestion,
}));

vi.mock("./line", async () => {
  const actual = await vi.importActual<typeof import("./line")>("./line");
  return {
    ...actual,
    getGroupMemberProfile: mocks.getGroupMemberProfile,
  };
});

vi.mock("./lineGroupLifecycle", () => ({
  syncLineGroupMetadata: mocks.syncLineGroupMetadata,
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createOrUpdateLineUser: mocks.createOrUpdateLineUser,
    getLineUserByLineId: mocks.getLineUserByLineId,
    updateLineMessageSenderName: mocks.updateLineMessageSenderName,
    updateLineUserLastMessage: mocks.updateLineUserLastMessage,
    saveLineGroupInboundMessageAndActivity: mocks.saveLineGroupInboundMessageAndActivity,
    saveLineMessage: mocks.saveLineMessage,
    getLinePointBalance: mocks.getLinePointBalance,
    getLineReceiptsByUser: mocks.getLineReceiptsByUser,
  };
});

import { containsExplicitLcjMention, processLineMessage, processReceiptImageMessage, type LineWebhookEvent } from "./lineAgent";

const makeEvent = (): LineWebhookEvent => ({
  type: "message",
  timestamp: 1_789_000_000_000,
  source: {
    type: "user",
    userId: "U00000000000000000000000000000000",
  },
  replyToken: "reply-token-must-not-be-used",
  message: {
    id: "message-ordinary-question",
    type: "text",
    text: "ポイントについて相談したいです",
  },
});

describe("LINE general AI auto-reply runtime behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOrUpdateLineUser.mockResolvedValue(undefined);
    mocks.getLineUserByLineId.mockResolvedValue(null);
    mocks.updateLineMessageSenderName.mockResolvedValue(undefined);
    mocks.updateLineUserLastMessage.mockResolvedValue(undefined);
    mocks.saveLineGroupInboundMessageAndActivity.mockResolvedValue({ id: 1 });
    mocks.saveLineMessage.mockResolvedValue({ id: 1 });
    mocks.canLineAiManagerReplyInGroup.mockResolvedValue(true);
    mocks.tryHandleLineAiManagerMessage.mockResolvedValue(false);
    mocks.tryHandleLineGroupPublicQuestion.mockResolvedValue(false);
    mocks.recordLineAiManagerInboundActivity.mockResolvedValue(false);
    mocks.containsReminderKeyword.mockReturnValue(false);
    mocks.createReminderFromMessage.mockResolvedValue({ message: "created" });
    mocks.getReminderListMessage.mockResolvedValue("list");
    mocks.getLinePointBalance.mockResolvedValue({ balance: 100 });
    mocks.getLineReceiptsByUser.mockResolvedValue([]);
    mocks.getGroupMemberProfile.mockResolvedValue({
      userId: "U-group-liver",
      displayName: "連携ライバー",
    });
    mocks.syncLineGroupMetadata.mockResolvedValue({ updated: true, groupName: "配信相談グループ" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes both visible @LCJ text and LINE's self-mention metadata", () => {
    expect(containsExplicitLcjMention("@LCJ 商品を相談したい")).toBe(true);
    expect(containsExplicitLcjMention("＠LCJ 商品を相談したい")).toBe(true);
    expect(containsExplicitLcjMention("商品を相談したい", {
      mentionees: [{ isSelf: true }],
    })).toBe(true);
    expect(containsExplicitLcjMention("商品を相談したい", {
      mentionees: [{ isSelf: false }],
    })).toBe(false);
    expect(containsExplicitLcjMention("エージェントさん、相談があります")).toBe(false);
    expect(containsExplicitLcjMention("LCJエージェントについて教えて")).toBe(false);
  });

  it("queues an ordinary private message without invoking the LLM or reply API", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/profile/")) {
        return new Response(
          JSON.stringify({ displayName: "テスト顧客", pictureUrl: null }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected outbound request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processLineMessage(makeEvent());

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.saveLineMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-ordinary-question",
        direction: "incoming",
        needsResponse: true,
        responseStatus: "pending",
      })
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/message/reply")
      )
    ).toBe(false);
  });

  it("rethrows a durable AI handoff failure so the webhook can return 5xx", async () => {
    const handoffError = new Error("handoff failed");
    handoffError.name = "LineAiManagerHandoffError";
    mocks.tryHandleLineAiManagerMessage.mockRejectedValueOnce(handoffError);

    await expect(processLineMessage(makeEvent())).rejects.toBe(handoffError);
    expect(mocks.saveLineMessage).not.toHaveBeenCalled();
  });

  it("does not send an automatic fallback even when profile persistence fails", async () => {
    mocks.createOrUpdateLineUser.mockRejectedValueOnce(
      new Error("simulated persistence failure")
    );
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/profile/")) {
        return new Response(JSON.stringify({ displayName: "テスト顧客" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected outbound request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processLineMessage(makeEvent());

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.saveLineMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-ordinary-question",
        needsResponse: true,
      })
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/message/reply")
      )
    ).toBe(false);
  });

  it("delegates an explicit @LCJ group message to the dedicated AI manager", async () => {
    mocks.tryHandleLineAiManagerMessage.mockResolvedValueOnce(true);
    const event: LineWebhookEvent = {
      type: "message",
      timestamp: 1_789_000_000_050,
      source: { type: "group", groupId: "C-group-1", userId: "U-group-liver" },
      replyToken: "group-reply-token",
      message: { id: "group-message-mentioned", type: "text", text: "@LCJ 次の配信商品を相談したい" },
    };

    await processLineMessage(event);

    expect(mocks.getGroupMemberProfile).toHaveBeenCalledWith("C-group-1", "U-group-liver");
    expect(mocks.tryHandleLineAiManagerMessage).toHaveBeenCalledWith(
      event,
      "連携ライバー",
      { isExplicitBotMention: true },
    );
    expect(mocks.saveLineGroupInboundMessageAndActivity).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "group-message-mentioned",
      lineGroupId: "C-group-1",
    }));
  });

  it("lets bounded onboarding consume an explicit mention without also invoking the normal manager", async () => {
    mocks.continueLineGroupOnboarding.mockResolvedValueOnce(true);
    const event: LineWebhookEvent = {
      type: "message",
      timestamp: 1_789_000_000_050,
      source: { type: "group", groupId: "C-onboarding", userId: "U-unlinked" },
      replyToken: "group-onboarding-token",
      message: { id: "group-onboarding-mentioned", type: "text", text: "@LCJ TikTokは@exampleです" },
    };

    await processLineMessage(event);

    expect(mocks.continueLineGroupOnboarding).toHaveBeenCalledWith({
      lineGroupId: "C-onboarding",
      sourceMessageId: "group-onboarding-mentioned",
      lineUserId: "U-unlinked",
      text: "@LCJ TikTokは@exampleです",
      eventTimestamp: 1_789_000_000_050,
      isExplicitMention: true,
    });
    expect(mocks.canLineAiManagerReplyInGroup).not.toHaveBeenCalled();
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
  });

  it("never falls through to a legacy group reply when the dedicated manager declines after eligibility", async () => {
    mocks.tryHandleLineAiManagerMessage.mockResolvedValueOnce(false);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      throw new Error(`Unexpected outbound request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const event: LineWebhookEvent = {
      type: "message",
      timestamp: 1_789_000_000_051,
      source: { type: "group", groupId: "C-group-race", userId: "U-group-liver" },
      replyToken: "group-race-token",
      message: { id: "group-race-message", type: "text", text: "@LCJ 商品を相談したい" },
    };

    await processLineMessage(event);

    expect(mocks.canLineAiManagerReplyInGroup).toHaveBeenCalledWith("C-group-race", "U-group-liver");
    expect(mocks.tryHandleLineAiManagerMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not reply to an explicit group mention from an unlinked/inactive sender or disabled group", async () => {
    mocks.canLineAiManagerReplyInGroup.mockResolvedValueOnce(false);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      throw new Error(`Unexpected outbound request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_052,
      source: { type: "group", groupId: "C-group-ineligible", userId: "U-unlinked" },
      replyToken: "group-ineligible-token",
      message: { id: "group-ineligible-message", type: "text", text: "@LCJ ポイント履歴を見せて" },
    });

    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    expect(mocks.tryHandleLineGroupPublicQuestion).toHaveBeenCalledWith({
      lineGroupId: "C-group-ineligible",
      lineUserId: "U-unlinked",
      sourceMessageId: "group-ineligible-message",
      text: "@LCJ ポイント履歴を見せて",
    });
    expect(mocks.recordLineAiManagerInboundActivity).not.toHaveBeenCalled();
    expect(mocks.scheduleLineGroupInsightRefresh).toHaveBeenCalledWith("C-group-ineligible");
    expect(mocks.getLinePointBalance).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the safe responder answer a bounded sample question from an unlinked participant", async () => {
    mocks.canLineAiManagerReplyInGroup.mockResolvedValueOnce(false);
    mocks.tryHandleLineGroupPublicQuestion.mockResolvedValueOnce(true);
    const event: LineWebhookEvent = {
      type: "message",
      timestamp: 1_789_000_000_052,
      source: { type: "group", groupId: "C-group-sample", userId: "U-unlinked" },
      replyToken: "group-sample-token",
      message: {
        id: "group-sample-message",
        type: "text",
        text: "@LCJ こちらの商品のサンプルを送っていただくことは可能でしょうか？",
      },
    };

    await processLineMessage(event);

    expect(mocks.tryHandleLineGroupPublicQuestion).toHaveBeenCalledWith({
      lineGroupId: "C-group-sample",
      lineUserId: "U-unlinked",
      sourceMessageId: "group-sample-message",
      text: "@LCJ こちらの商品のサンプルを送っていただくことは可能でしょうか？",
    });
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    expect(mocks.recordLineAiManagerInboundActivity).not.toHaveBeenCalled();
  });

  it("propagates a group eligibility settings failure and sends no warning or generic reply", async () => {
    const failure = new Error("LINE AI manager durable handoff failed");
    failure.name = "LineAiManagerHandoffError";
    mocks.canLineAiManagerReplyInGroup.mockRejectedValueOnce(failure);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      throw new Error(`Unexpected outbound request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_053,
      source: { type: "group", groupId: "C-group-db-failure", userId: "U-group-liver" },
      replyToken: "group-db-failure-token",
      message: { id: "group-db-failure-message", type: "text", text: "@LCJ リマインドして" },
    })).rejects.toBe(failure);

    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose point history from an explicitly mentioned group message", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/message/reply")) {
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected outbound request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_055,
      source: { type: "group", groupId: "C-group-1", userId: "U-group-liver" },
      replyToken: "group-private-command-token",
      message: { id: "group-points-command", type: "text", text: "@LCJ ポイント履歴を見せて" },
    });

    expect(mocks.getLinePointBalance).not.toHaveBeenCalled();
    expect(mocks.getLineReceiptsByUser).not.toHaveBeenCalled();
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    const replyCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/message/reply"));
    const replyBody = JSON.parse(String((replyCall?.[1] as RequestInit | undefined)?.body || "{}"));
    expect(replyBody.messages?.[0]?.text).toContain("1対1トーク");
  });

  it("does not create or list reminders from an explicitly mentioned group message", async () => {
    mocks.containsReminderKeyword.mockReturnValue(true);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/message/reply")) {
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected outbound request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_056,
      source: { type: "group", groupId: "C-group-1", userId: "U-group-liver" },
      replyToken: "group-reminder-command-token",
      message: { id: "group-reminder-command", type: "text", text: "@LCJ 明日10時にリマインドして" },
    });

    expect(mocks.createReminderFromMessage).not.toHaveBeenCalled();
    expect(mocks.getReminderListMessage).not.toHaveBeenCalled();
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
  });

  it("stores a non-mention group message before enrichment and offers only the bounded onboarding handoff", async () => {
    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_060,
      source: { type: "group", groupId: "C-group-no-mention", userId: "U-group-liver" },
      replyToken: "unused-group-reply-token",
      message: { id: "group-message-no-mention", type: "text", text: "次の配信どうしようかな" },
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mocks.getGroupMemberProfile).toHaveBeenCalledWith("C-group-no-mention", "U-group-liver");
    expect(mocks.syncLineGroupMetadata).toHaveBeenCalledWith("C-group-no-mention");
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    expect(mocks.createOrUpdateLineUser).toHaveBeenCalledWith(expect.objectContaining({
      lineUserId: "U-group-liver",
      displayName: "連携ライバー",
    }));
    expect(mocks.saveLineGroupInboundMessageAndActivity).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "group-message-no-mention",
      lineGroupId: "C-group-no-mention",
    }));
    expect(mocks.scheduleLineGroupInsightRefresh).toHaveBeenCalledWith("C-group-no-mention");
    expect(mocks.continueLineGroupOnboarding).toHaveBeenCalledWith({
      lineGroupId: "C-group-no-mention",
      sourceMessageId: "group-message-no-mention",
      lineUserId: "U-group-liver",
      text: "次の配信どうしようかな",
      eventTimestamp: 1_789_000_000_060,
    });
    expect(mocks.updateLineMessageSenderName).toHaveBeenCalledWith(
      "group-message-no-mention",
      "U-group-liver",
      "連携ライバー",
    );
    expect(mocks.saveLineGroupInboundMessageAndActivity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getGroupMemberProfile.mock.invocationCallOrder[0],
    );
  });

  it("does not repeat external enrichment for a duplicate non-mention webhook", async () => {
    mocks.saveLineGroupInboundMessageAndActivity.mockResolvedValueOnce(null);
    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_061,
      source: { type: "group", groupId: "C-group-duplicate", userId: "U-group-liver" },
      replyToken: "unused-duplicate-token",
      message: { id: "group-message-duplicate", type: "text", text: "再配信された通常投稿" },
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mocks.getGroupMemberProfile).not.toHaveBeenCalled();
    expect(mocks.syncLineGroupMetadata).not.toHaveBeenCalled();
    expect(mocks.scheduleLineGroupInsightRefresh).not.toHaveBeenCalled();
    expect(mocks.continueLineGroupOnboarding).toHaveBeenCalledWith({
      lineGroupId: "C-group-duplicate",
      sourceMessageId: "group-message-duplicate",
      lineUserId: "U-group-liver",
      text: "再配信された通常投稿",
      eventTimestamp: 1_789_000_000_061,
    });
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
  });

  it("stores LINE receipt images as history and replies with a token-free migration notice", async () => {
    const lineUserId = "U11111111111111111111111111111111";
    mocks.createOrUpdateLineUser.mockResolvedValueOnce({ id: 77, lineUserId });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/profile/")) {
        return new Response(
          JSON.stringify({ displayName: "申請テスト顧客", pictureUrl: null }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/message/reply")) {
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected outbound request: ${url} ${String(init?.method || "GET")}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await processReceiptImageMessage({
      type: "message",
      timestamp: 1_789_000_000_100,
      source: { type: "user", userId: lineUserId },
      replyToken: "receipt-image-reply-token",
      message: { id: "receipt-image-message", type: "image" },
    });

    expect(mocks.saveLineMessage).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "receipt-image-message",
      messageType: "image",
      content: expect.stringContaining("申請停止中"),
      needsResponse: false,
      responseStatus: "responded",
    }));

    const replyCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/message/reply"));
    expect(replyCall).toBeDefined();
    const replyBody = JSON.parse(String((replyCall?.[1] as RequestInit | undefined)?.body || "{}"));
    const replyText = String(replyBody.messages?.[0]?.text || "");
    expect(replyText).toContain("新しいLCJレシートポイント申請は停止中です");
    expect(replyText).toContain("/beauty-wallet");
    expect(replyText).not.toContain("receipt-upload?token=");
    expect(replyText).not.toContain("受付番号");
  });
});
