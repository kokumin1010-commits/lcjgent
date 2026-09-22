import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  messageIds: new Set<string>(),
  eventKeys: new Set<string>(),
  nextEventId: 1,
  failEventInsert: false,
  affectedRows: [] as number[],
  lastLineMessage: null as any,
  updateCalls: 0,
  saveLineMessage: vi.fn(),
}));

const fakeDb = vi.hoisted(() => {
  const makeInsert = (table: any, targetState: typeof state) => ({
    values: async (value: any) => {
      const tableName = table?.[Symbol.for("drizzle:Name")] || table?._.name || table?.name;
      if (tableName === "line_messages") {
        if (targetState.messageIds.has(value.messageId)) {
          const error: any = new Error("duplicate message");
          error.code = "ER_DUP_ENTRY";
          throw error;
        }
        targetState.lastLineMessage = value;
        targetState.messageIds.add(value.messageId);
        return [{ insertId: targetState.messageIds.size }];
      }
      if (tableName === "line_ai_manager_events") {
        if (targetState.failEventInsert) {
          const error: any = new Error("temporary event insert failure");
          error.code = "ER_LOCK_DEADLOCK";
          throw error;
        }
        if (targetState.eventKeys.has(value.eventKey)) {
          const error: any = new Error("duplicate event");
          error.code = "ER_DUP_ENTRY";
          throw error;
        }
        targetState.eventKeys.add(value.eventKey);
        return [{ insertId: targetState.nextEventId++ }];
      }
      return [{ insertId: 1 }];
    },
  });
  const updateResult = () => {
    state.updateCalls += 1;
    const affectedRows = state.affectedRows.length ? state.affectedRows.shift()! : 1;
    return { set: () => ({ where: async () => [{ affectedRows }] }) };
  };
  return {
    insert: (table: any) => makeInsert(table, state),
    update: () => updateResult(),
    transaction: async (callback: (tx: any) => Promise<any>) => {
      const messageSnapshot = new Set(state.messageIds);
      const eventSnapshot = new Set(state.eventKeys);
      const eventIdSnapshot = state.nextEventId;
      try {
        return await callback({
          insert: (table: any) => makeInsert(table, state),
          update: () => updateResult(),
        });
      } catch (error) {
        state.messageIds = messageSnapshot;
        state.eventKeys = eventSnapshot;
        state.nextEventId = eventIdSnapshot;
        throw error;
      }
    },
  };
});

vi.mock("./db", () => ({
  bumpLineGroupConversationRevisionUsingExecutor: vi.fn(async () => undefined),
  getDb: vi.fn(async () => fakeDb),
  getLineMessages: vi.fn(async () => []),
  getLiverInteractionSummary: vi.fn(async () => null),
  lockLineGroupConversationUsingExecutor: vi.fn(async () => undefined),
  saveLineMessage: state.saveLineMessage,
}));
vi.mock("./line", () => ({
  pushMessage: vi.fn(async () => true),
  replyMessage: vi.fn(async () => true),
}));
vi.mock("./_core/dataApi", () => ({ callDataApi: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { __lineAiManagerTestUtils } from "./lineAiManager";

const target = {
  lineUserId: "U-test-liver",
  lineDisplayName: "Test Liver",
  liverId: 42,
  liverName: "Test Liver",
  liverBio: null,
  tiktokAccount: null,
  language: "ja",
  replyEnabled: true,
  proactiveEnabled: false,
  tiktokAnalysisEnabled: false,
  inactivityDays: 3,
  maxProactivePerCycle: 2,
  tone: "warm" as const,
  lastInboundAt: null,
  lastReplyAt: null,
  lastProactiveAt: null,
  consecutiveProactiveCount: 0,
  lastIntent: null,
  nextAction: null,
  lastResponsePreview: null,
  tiktokInsight: null,
  tiktokInsightUpdatedAt: null,
};

describe("LINE AI manager durable handoff and lease fencing", () => {
  beforeEach(() => {
    state.messageIds = new Set();
    state.eventKeys = new Set();
    state.nextEventId = 1;
    state.failEventInsert = false;
    state.affectedRows = [];
    state.lastLineMessage = null;
    state.updateCalls = 0;
    state.saveLineMessage.mockReset();
    state.saveLineMessage.mockResolvedValue({ id: 1 });
  });

  it("rolls back the inbound message when event insertion fails", async () => {
    state.failEventInsert = true;
    await expect(__lineAiManagerTestUtils.persistInboundAndMaybeEnqueue({
      target,
      sourceMessageId: "msg-rollback",
      incomingText: "配信相談です",
      eventTimestamp: Date.now(),
      enqueueReply: true,
    })).rejects.toThrow("temporary event insert failure");
    expect(state.messageIds.has("msg-rollback")).toBe(false);
    expect(state.eventKeys.size).toBe(0);
  });

  it("reconstructs a missing event when LINE redelivers an already-saved message", async () => {
    state.messageIds.add("msg-redelivery");
    const result = await __lineAiManagerTestUtils.persistInboundAndMaybeEnqueue({
      target,
      sourceMessageId: "msg-redelivery",
      incomingText: "もう一度お願いします",
      eventTimestamp: Date.now(),
      enqueueReply: true,
    });
    expect(result.stored).toBe(false);
    expect(result.eventId).toBe(1);
    expect(state.eventKeys.has("reply:msg-redelivery")).toBe(true);
  });

  it("persists a stop command with a durable deterministic response event", async () => {
    const result = await __lineAiManagerTestUtils.persistInboundAndMaybeEnqueue({
      target,
      sourceMessageId: "msg-stop",
      incomingText: "AI停止",
      eventTimestamp: Date.now(),
      enqueueReply: false,
      preferenceCommand: "ai停止",
      preferenceResponse: "自動返信と継続フォローを停止しました。",
    });
    expect(result).toEqual({ stored: true, eventId: 1 });
    expect(state.messageIds.has("msg-stop")).toBe(true);
    expect(state.eventKeys.has("preference:msg-stop")).toBe(true);
  });

  it("persists a linked person's group mention with the group identity", async () => {
    const result = await __lineAiManagerTestUtils.persistInboundAndMaybeEnqueue({
      target,
      sourceMessageId: "msg-group-mention",
      incomingText: "@LCJ 商品相談です",
      lineGroupId: "C-group-history",
      senderName: "Test Liver",
      eventTimestamp: Date.now(),
      enqueueReply: true,
    });
    expect(result).toEqual({ stored: true, eventId: 1 });
    expect(state.lastLineMessage).toEqual(expect.objectContaining({
      messageId: "msg-group-mention",
      sourceType: "group",
      lineUserId: "U-test-liver",
      lineGroupId: "C-group-history",
    }));
  });

  it("returns a lease token only to the winning worker and rejects stale transitions", async () => {
    state.affectedRows = [1, 0, 0, 0];
    const token = await __lineAiManagerTestUtils.acquireAiManagerEventLease(1, ["queued"], "processing");
    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    const competingToken = await __lineAiManagerTestUtils.acquireAiManagerEventLease(1, ["queued"], "processing");
    expect(competingToken).toBeNull();
    await expect(__lineAiManagerTestUtils.markAiManagerEventReady(1, {
      responseText: "reply",
      intent: "test",
      nextAction: "none",
    }, token!)).resolves.toBe(false);
    await expect(__lineAiManagerTestUtils.finishAiManagerEvent(1, {
      status: "sent",
    }, { status: "sending", leaseToken: token! })).resolves.toBe(false);
  });

  it("persists a pending outbound audit intent before LINE delivery", async () => {
    const event = {
      id: 76,
      eventKey: "reply:msg-audit-intent",
      sourceMessageId: null,
      lineUserId: target.lineUserId,
      liverId: target.liverId,
      triggerType: "reply" as const,
      status: "sending" as const,
      model: "gpt-5-mini",
      attemptCount: 1,
      leaseToken: "audit-intent-lease",
      leaseExpiresAt: new Date(Date.now() + 60_000),
      lastAttemptAt: new Date(),
      intent: "配信相談",
      nextAction: "希望商品を確認する",
      responseText: "一緒に整理しましょう。\n\n— 高橋 悠真",
      errorCode: "outbound_audit_intent_pending",
      promptTokens: 10,
      completionTokens: 20,
      createdAt: new Date(),
      completedAt: null,
    };

    await expect(__lineAiManagerTestUtils.persistOutboundAuditIntent(event)).resolves.toBe(true);
    expect(state.saveLineMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      messageId: "ai-manager:76",
      lineUserId: target.lineUserId,
      senderName: "高橋 悠真",
      content: "一緒に整理しましょう。",
      direction: "outgoing",
      responseStatus: "pending",
    }));
  });

  it("does not finalize sent until the outbound communication audit is durable", async () => {
    const event = {
      id: 77,
      eventKey: "reply:msg-audit-retry",
      sourceMessageId: null,
      lineUserId: target.lineUserId,
      liverId: target.liverId,
      triggerType: "reply" as const,
      status: "sending" as const,
      model: "gpt-5-mini",
      attemptCount: 1,
      leaseToken: "audit-lease-token",
      leaseExpiresAt: new Date(Date.now() + 60_000),
      lastAttemptAt: new Date(),
      intent: "配信相談",
      nextAction: "希望商品を確認する",
      responseText: "一緒に整理しましょう。\n\n— 高橋 悠真",
      errorCode: "outbound_audit_pending",
      promptTokens: 10,
      completionTokens: 20,
      createdAt: new Date(),
      completedAt: null,
    };

    state.saveLineMessage.mockRejectedValueOnce(new Error("temporary audit failure"));
    await expect(__lineAiManagerTestUtils.persistOutboundAuditAndFinalize(
      event,
      "audit-lease-token",
      target,
    )).rejects.toThrow("temporary audit failure");
    expect(state.updateCalls).toBe(0);

    state.affectedRows = [1, 1];
    await expect(__lineAiManagerTestUtils.persistOutboundAuditAndFinalize(
      event,
      "audit-lease-token",
      target,
    )).resolves.toBe(true);
    expect(state.saveLineMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      messageId: "ai-manager:77",
      lineUserId: target.lineUserId,
      direction: "outgoing",
    }));
    expect(state.updateCalls).toBe(3);
  });
});
