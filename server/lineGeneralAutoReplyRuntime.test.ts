import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  createOrUpdateLineUser: vi.fn(),
  updateLineUserLastMessage: vi.fn(),
  saveLineMessage: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

vi.mock("./lineReminder", () => ({
  containsReminderKeyword: vi.fn(() => false),
  createReminderFromMessage: vi.fn(),
  getReminderListMessage: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createOrUpdateLineUser: mocks.createOrUpdateLineUser,
    updateLineUserLastMessage: mocks.updateLineUserLastMessage,
    saveLineMessage: mocks.saveLineMessage,
  };
});

import { processLineMessage, type LineWebhookEvent } from "./lineAgent";

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
    mocks.updateLineUserLastMessage.mockResolvedValue(undefined);
    mocks.saveLineMessage.mockResolvedValue({ id: 1 });
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
});
