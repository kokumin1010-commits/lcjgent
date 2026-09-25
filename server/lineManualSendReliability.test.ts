import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  reserveLineOutgoingAudit: vi.fn(),
  finalizeLineOutgoingAudit: vi.fn(),
  getLineGroupByLineId: vi.fn(),
  markMessageResponded: vi.fn(),
  pushMessage: vi.fn(),
  createLineRetryKey: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    reserveLineOutgoingAudit: state.reserveLineOutgoingAudit,
    finalizeLineOutgoingAudit: state.finalizeLineOutgoingAudit,
    getLineGroupByLineId: state.getLineGroupByLineId,
    markMessageResponded: state.markMessageResponded,
  };
});

vi.mock("./line", async importOriginal => {
  const actual = await importOriginal<typeof import("./line")>();
  return {
    ...actual,
    pushMessage: state.pushMessage,
  };
});

vi.mock("./lineRetryKey", () => ({
  createLineRetryKey: state.createLineRetryKey,
}));

import { appRouter } from "./routers";

const requestId = "00000000-0000-4000-8000-000000000001";
const groupId = "C00000000000000000000000000000001";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "line-admin",
      email: "admin@example.com",
      name: "LINE Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("LINE management manual send reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getLineGroupByLineId.mockResolvedValue({ lineGroupId: groupId, isActive: true });
    state.reserveLineOutgoingAudit.mockResolvedValue({ created: true, status: "pending" });
    state.finalizeLineOutgoingAudit.mockResolvedValue(undefined);
    state.markMessageResponded.mockResolvedValue(undefined);
    state.pushMessage.mockResolvedValue(true);
  });

  it("requires a client-stable UUID at the API boundary", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect((caller.line.sendMessage as any)({
      to: groupId,
      message: "送信IDなし",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("requires a reviewed conversation revision for every group delivery", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.sendMessage({
      to: groupId,
      message: "会話版なし",
      requestId,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("LINE_GROUP_CONVERSATION_REVISION_REQUIRED"),
    });
    expect(state.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("reserves the exact target and body before LINE delivery, then finalizes history", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.line.sendMessage({
      to: groupId,
      message: "配信準備で困っている点はありますか？",
      requestId,
      expectedGroupConversationRevision: 42,
    });

    expect(result).toEqual({ success: true, deduplicated: false });
    expect(state.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      messageId: `manual:${requestId}`,
      sourceType: "group",
      lineGroupId: groupId,
      senderName: "高橋 悠真",
      content: "配信準備で困っている点はありますか？",
    }));
    expect(state.reserveLineOutgoingAudit.mock.invocationCallOrder[0]).toBeLessThan(
      state.pushMessage.mock.invocationCallOrder[0],
    );
    expect(state.finalizeLineOutgoingAudit).toHaveBeenCalledWith(
      `manual:${requestId}`,
      "LINE管理画面からの手動送信",
    );
  });

  it("passes the reviewed group conversation revision into the durable reservation", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await caller.line.sendMessage({
      to: groupId,
      message: "確認済み文案です",
      requestId,
      expectedGroupConversationRevision: 42,
    });

    expect(state.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      expectedGroupConversationRevision: 42,
    }));
  });

  it("rejects a stale reviewed group draft before LINE delivery", async () => {
    const stale = new Error("LINE_GROUP_CONVERSATION_CHANGED") as Error & { code?: string };
    stale.code = "LINE_GROUP_CONVERSATION_CHANGED";
    state.reserveLineOutgoingAudit.mockRejectedValue(stale);
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.sendMessage({
      to: groupId,
      message: "古い文案です",
      requestId,
      expectedGroupConversationRevision: 42,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("LINE_GROUP_CONVERSATION_CHANGED"),
    });
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("removes a trailing public signature before both audit and LINE delivery", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await caller.line.sendMessage({
      to: groupId,
      message: "サンプルの可否を確認します。\n\n— 高橋 悠真",
      requestId,
      expectedGroupConversationRevision: 42,
    });

    expect(state.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      content: "サンプルの可否を確認します。",
      senderName: "高橋 悠真",
    }));
    expect(state.pushMessage).toHaveBeenCalledWith(
      groupId,
      [{ type: "text", text: "サンプルの可否を確認します。" }],
      expect.any(String),
    );
  });

  it("rejects a message that contains only a removable signature", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.line.sendMessage({
      to: groupId,
      message: "— 高橋 悠真",
      requestId,
      expectedGroupConversationRevision: 42,
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("LINE_MESSAGE_EMPTY_AFTER_SIGNATURE_REMOVAL"),
    });
    expect(state.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("rejects a reused UUID whose immutable target or body conflicts", async () => {
    const conflict = new Error("LINE_OUTBOUND_IDEMPOTENCY_CONFLICT") as Error & { code?: string };
    conflict.code = "LINE_OUTBOUND_IDEMPOTENCY_CONFLICT";
    state.reserveLineOutgoingAudit.mockRejectedValue(conflict);
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.sendMessage({
      to: groupId,
      message: "変更された本文",
      requestId,
      expectedGroupConversationRevision: 42,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("LINE_OUTBOUND_IDEMPOTENCY_CONFLICT"),
    });
    expect(state.pushMessage).not.toHaveBeenCalled();
    expect(state.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
  });

  it("reconciles a finalized response-loss retry without a second LINE request", async () => {
    state.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status: "responded" });
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.sendMessage({
      to: groupId,
      message: "同じ本文",
      requestId,
      expectedGroupConversationRevision: 42,
    })).resolves.toEqual({ success: true, deduplicated: true });
    expect(state.pushMessage).not.toHaveBeenCalled();
    expect(state.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
    expect(state.markMessageResponded).toHaveBeenCalledWith(groupId, "admin@example.com");
  });

  it("recovers an audit-finalization failure with the same LINE retry key", async () => {
    state.finalizeLineOutgoingAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    const caller = appRouter.createCaller(createAdminContext());
    const payload = {
      to: groupId,
      message: "同じ送信を安全に復旧",
      requestId,
      expectedGroupConversationRevision: 42,
    };

    await expect(caller.line.sendMessage(payload)).rejects.toThrow("audit unavailable");
    expect(state.pushMessage).toHaveBeenCalledTimes(1);
    expect(state.markMessageResponded).not.toHaveBeenCalled();

    state.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status: "pending" });
    await expect(caller.line.sendMessage(payload)).resolves.toEqual({
      success: true,
      deduplicated: false,
    });
    expect(state.pushMessage).toHaveBeenCalledTimes(2);
    expect(state.pushMessage.mock.calls[0][2]).toBe(state.pushMessage.mock.calls[1][2]);
    expect(state.createLineRetryKey).toHaveBeenCalledWith(
      `line-management-manual:${groupId}:${requestId}`,
    );
    expect(state.markMessageResponded).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "none"] as const)("never replays a terminal %s audit", async status => {
    state.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status });
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.sendMessage({
      to: groupId,
      message: "再送してはいけない本文",
      requestId,
      expectedGroupConversationRevision: 42,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining(`LINE_OUTBOUND_AUDIT_TERMINAL_${status.toUpperCase()}`),
    });
    expect(state.pushMessage).not.toHaveBeenCalled();
    expect(state.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
    expect(state.markMessageResponded).not.toHaveBeenCalled();
  });
});
