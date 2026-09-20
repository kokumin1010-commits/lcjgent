import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  createOrUpdateLineUser: vi.fn(),
  updateLineUserLastMessage: vi.fn(),
  saveLineMessage: vi.fn(),
  tryHandleLineAiManagerMessage: vi.fn(async () => false),
  recordLineAiManagerInboundActivity: vi.fn(async () => false),
  getGroupMemberProfile: vi.fn(),
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
  tryHandleLineAiManagerMessage: mocks.tryHandleLineAiManagerMessage,
  recordLineAiManagerInboundActivity: mocks.recordLineAiManagerInboundActivity,
}));

vi.mock("./line", async () => {
  const actual = await vi.importActual<typeof import("./line")>("./line");
  return {
    ...actual,
    getGroupMemberProfile: mocks.getGroupMemberProfile,
  };
});

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createOrUpdateLineUser: mocks.createOrUpdateLineUser,
    updateLineUserLastMessage: mocks.updateLineUserLastMessage,
    saveLineMessage: mocks.saveLineMessage,
    getLinePointBalance: mocks.getLinePointBalance,
    getLineReceiptsByUser: mocks.getLineReceiptsByUser,
  };
});

import { containsExplicitLcjMention, processLineMessage, processReceiptImageMessage, type LineWebhookEvent } from "./lineAgent";
import { verifyLineMemberSessionToken } from "./lineMemberSession";

const TEST_SECRET = "line-receipt-handoff-test-secret-at-least-32-chars";
const previousJwtSecret = process.env.JWT_SECRET;

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
    process.env.JWT_SECRET = TEST_SECRET;
    vi.clearAllMocks();
    mocks.createOrUpdateLineUser.mockResolvedValue(undefined);
    mocks.updateLineUserLastMessage.mockResolvedValue(undefined);
    mocks.saveLineMessage.mockResolvedValue({ id: 1 });
    mocks.tryHandleLineAiManagerMessage.mockResolvedValue(false);
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
  });

  afterEach(() => {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
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
    expect(mocks.saveLineMessage).not.toHaveBeenCalled();
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

  it("ignores a group message completely when @LCJ is absent", async () => {
    await processLineMessage({
      type: "message",
      timestamp: 1_789_000_000_060,
      source: { type: "group", groupId: "C-group-1", userId: "U-group-liver" },
      replyToken: "unused-group-reply-token",
      message: { id: "group-message-no-mention", type: "text", text: "次の配信どうしようかな" },
    });

    expect(mocks.getGroupMemberProfile).not.toHaveBeenCalled();
    expect(mocks.tryHandleLineAiManagerMessage).not.toHaveBeenCalled();
    expect(mocks.createOrUpdateLineUser).not.toHaveBeenCalled();
    expect(mocks.saveLineMessage).not.toHaveBeenCalled();
  });

  it("hands LINE receipt images to the Web form with a valid signed session and an explicit incomplete warning", async () => {
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
      content: expect.stringContaining("申請未完了"),
      needsResponse: false,
      responseStatus: "responded",
    }));

    const replyCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/message/reply"));
    expect(replyCall).toBeDefined();
    const replyBody = JSON.parse(String((replyCall?.[1] as RequestInit | undefined)?.body || "{}"));
    const replyText = String(replyBody.messages?.[0]?.text || "");
    expect(replyText).toContain("ポイント申請はまだ完了していません");
    expect(replyText).toContain("受付番号を保存");
    expect(replyText).not.toContain("レシート画像を受け取りました！");

    const tokenMatch = replyText.match(/receipt-upload\?token=([^\s]+)/);
    expect(tokenMatch).not.toBeNull();
    const session = await verifyLineMemberSessionToken(decodeURIComponent(tokenMatch![1]));
    expect(session?.lineUserId).toBe(lineUserId);
    expect(session?.userId).toBe(77);
  });
});
