import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  lockLineGroupConversationUsingExecutor: vi.fn(async () => ({ id: 1 })),
  reserveLineOutgoingAudit: vi.fn(),
  finalizeLineOutgoingAudit: vi.fn(),
  pushMessage: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  lockLineGroupConversationUsingExecutor: mocks.lockLineGroupConversationUsingExecutor,
  reserveLineOutgoingAudit: mocks.reserveLineOutgoingAudit,
  finalizeLineOutgoingAudit: mocks.finalizeLineOutgoingAudit,
}));

vi.mock("./line", () => ({
  pushMessage: mocks.pushMessage,
}));

import {
  __lineGroupOnboardingTestUtils,
  beginLineGroupOnboarding,
  composeLineGroupOnboardingGreeting,
  composeLineGroupOnboardingReply,
  continueLineGroupOnboarding,
  normalizeLineGroupBrandName,
  recoverPendingLineGroupOnboardingDeliveries,
} from "./lineGroupOnboarding";

const GROUP_ID = "C1234567890123456789012345678901";
const JOIN_EVENT_ID = "join-event-1";
const JOIN_EVENT_AT = 1_790_000_000_000;
const ACTIVE_ONBOARDING_LIFECYCLE = {
  joinEventId: JOIN_EVENT_ID,
  joinEventAt: JOIN_EVENT_AT,
  lifecycleIsActive: 1,
  lastEventAt: JOIN_EVENT_AT,
  lastEventId: JOIN_EVENT_ID,
  startedAt: new Date(JOIN_EVENT_AT - 1_000),
};

function createDb(options?: {
  currentLifecycleEventId?: string;
  existingPending?: boolean;
  autoReplyEnabled?: boolean;
}) {
  let txCall = 0;
  const execute = vi.fn(async () => {
    txCall += 1;
    if (txCall === 1) {
      return [[{
        isActive: 1,
        autoReplyEnabled: options?.autoReplyEnabled === false ? 0 : 1,
        lifecycleIsActive: 1,
        lastEventAt: JOIN_EVENT_AT,
        lastEventId: options?.currentLifecycleEventId ?? JOIN_EVENT_ID,
      }], []];
    }
    if (txCall === 2) {
      return options?.existingPending
        ? [[{
            joinEventId: JOIN_EVENT_ID,
            status: "pending_intro",
            pendingAuditMessageId: "line:onboard:i:existing",
            pendingReplyText: composeLineGroupOnboardingGreeting("テストブランド"),
            pendingNextStatus: "awaiting_profile",
          }], []]
        : [[], []];
    }
    return [{ affectedRows: 1 }, []];
  });
  const db = {
    execute: vi.fn(async () => [[{
      isActive: 1,
      autoReplyEnabled: 1,
      ...ACTIVE_ONBOARDING_LIFECYCLE,
      pendingAuditMessageId: options?.existingPending
        ? "line:onboard:i:existing"
        : null,
    }], []]),
    transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<unknown>) => callback({ execute })),
  };
  return { db, execute };
}

describe("LINE group onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: true, status: "pending" });
    mocks.finalizeLineOutgoingAudit.mockResolvedValue(undefined);
    mocks.pushMessage.mockResolvedValue(true);
  });

  it("sanitizes the group name and treats it as the first-message brand name", () => {
    expect(normalizeLineGroupBrandName("  Example\nBrand\u0000  ")).toBe("Example Brand");
    expect(normalizeLineGroupBrandName("  ")).toBe("このグループのブランド");

    const greeting = composeLineGroupOnboardingGreeting("Example Brand");
    expect(greeting).toContain("ブランド「Example Brand」");
    expect(greeting).toContain("TikTokのアカウント名／ID");
    expect(greeting).toContain("@LCJを付けずそのまま送っていただけます");
    expect(greeting).toContain("LCJの高橋 悠真です");
    expect(greeting).toContain("初回のご案内と確認には自動サポートを利用しています");
    expect(greeting).toContain("— 高橋 悠真");
    expect(greeting).not.toContain("LCJ公式AIマネージャー");
  });

  it("uses factual limited replies without promising samples, rates, or approval", () => {
    const first = composeLineGroupOnboardingReply(
      "TikTokは@example、名前は花子、美容動画です",
      "awaiting_profile",
    );
    expect(first.nextStatus).toBe("awaiting_preferences");
    expect(first.replyText).toContain("サンプルや興味のある商品");

    const second = composeLineGroupOnboardingReply(
      "サンプルは手元にあり、来週ライブ配信予定です",
      "awaiting_preferences",
    );
    expect(second.nextStatus).toBe("completed");
    expect(second.replyText).toContain("具体的な条件や可否は確認後");
    expect(second.replyText).not.toMatch(/確定|承認済み|必ず送/);

    const closing = composeLineGroupOnboardingReply(
      "サンプルは手元にあります",
      "awaiting_preferences",
    );
    expect(closing.nextStatus).toBe("completed");
    expect(closing.replyText).toContain("@LCJを付けてご連絡ください");
  });

  it.each([
    { userType: "staff", isBlocked: 0, isActive: 1, autoReplyEnabled: 1 },
    { userType: "liver", isBlocked: 1, isActive: 1, autoReplyEnabled: 1 },
    { userType: "liver", isBlocked: 0, isActive: 0, autoReplyEnabled: 1 },
    { userType: "liver", isBlocked: 0, isActive: 1, autoReplyEnabled: 0 },
  ])("does not prepare a non-mention reply for staff, blocked, inactive, or disabled rows", async row => {
    const execute = vi.fn().mockResolvedValue([[{
      status: "awaiting_profile",
      expiresAt: new Date(Date.now() + 60_000),
      autoReplyCount: 0,
      lastInboundMessageId: null,
      pendingSourceMessageId: null,
      pendingAuditMessageId: null,
      pendingReplyText: null,
      pendingNextStatus: null,
      ...ACTIVE_ONBOARDING_LIFECYCLE,
      ...row,
    }], []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };

    await expect(__lineGroupOnboardingTestUtils.prepareReplyUsingDb(db as any, {
      lineGroupId: GROUP_ID,
      sourceMessageId: "message-1",
      lineUserId: "user-1",
      text: "TikTokは@exampleです",
      eventTimestamp: JOIN_EVENT_AT,
    })).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    { expiresAt: new Date(JOIN_EVENT_AT - 1), autoReplyCount: 0 },
    { expiresAt: new Date(Date.now() + 60_000), autoReplyCount: 2 },
  ])("expires instead of replying after the seven-day window or two-reply cap", async limit => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        status: "awaiting_preferences",
        lastInboundMessageId: null,
        pendingSourceMessageId: null,
        pendingAuditMessageId: null,
        pendingReplyText: null,
        pendingNextStatus: null,
        isActive: 1,
        autoReplyEnabled: 1,
        userType: "liver",
        isBlocked: 0,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
        ...limit,
      }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };

    await expect(__lineGroupOnboardingTestUtils.prepareReplyUsingDb(db as any, {
      lineGroupId: GROUP_ID,
      sourceMessageId: "message-over-limit",
      lineUserId: "user-1",
      text: "続きです",
      eventTimestamp: JOIN_EVENT_AT,
    })).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("expires by current wall clock even when the LINE event timestamp is old", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        status: "awaiting_profile",
        expiresAt: new Date(Date.now() - 1),
        autoReplyCount: 0,
        lastInboundMessageId: null,
        pendingSourceMessageId: null,
        pendingAuditMessageId: null,
        pendingReplyText: null,
        pendingNextStatus: null,
        isActive: 1,
        autoReplyEnabled: 1,
        userType: null,
        isBlocked: null,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
      }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };

    await expect(__lineGroupOnboardingTestUtils.prepareReplyUsingDb(db as any, {
      lineGroupId: GROUP_ID,
      sourceMessageId: "delayed-old-event",
      lineUserId: "user-1",
      text: "遅延した回答です",
      eventTimestamp: JOIN_EVENT_AT,
    })).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a different onboarding delivery is still pending", async () => {
    const execute = vi.fn().mockResolvedValue([[{
      status: "awaiting_profile",
      expiresAt: new Date(Date.now() + 60_000),
      autoReplyCount: 0,
      lastInboundMessageId: null,
      pendingSourceMessageId: "message-before-this-one",
      pendingAuditMessageId: "line:onboard:r:pending",
      pendingReplyText: "pending reply",
      pendingNextStatus: "awaiting_preferences",
      isActive: 1,
      autoReplyEnabled: 1,
      userType: "liver",
      isBlocked: 0,
      ...ACTIVE_ONBOARDING_LIFECYCLE,
    }], []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };

    await expect(__lineGroupOnboardingTestUtils.prepareReplyUsingDb(db as any, {
      lineGroupId: GROUP_ID,
      sourceMessageId: "newer-message",
      lineUserId: "user-1",
      text: "続けて回答します",
      eventTimestamp: JOIN_EVENT_AT,
    })).rejects.toThrow("LINE_GROUP_ONBOARDING_PREVIOUS_DELIVERY_PENDING");
  });

  it("marks a completed onboarding message redelivery as already handled", async () => {
    const execute = vi.fn().mockResolvedValue([[{
      status: "completed",
      expiresAt: new Date(Date.now() + 60_000),
      autoReplyCount: 1,
      lastInboundMessageId: "completed-message",
      pendingSourceMessageId: null,
      pendingAuditMessageId: null,
      pendingReplyText: null,
      pendingNextStatus: null,
      isActive: 1,
      autoReplyEnabled: 1,
      userType: null,
      isBlocked: null,
      ...ACTIVE_ONBOARDING_LIFECYCLE,
    }], []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };

    await expect(__lineGroupOnboardingTestUtils.prepareReplyUsingDb(db as any, {
      lineGroupId: GROUP_ID,
      sourceMessageId: "completed-message",
      lineUserId: "user-1",
      text: "同じ回答です",
      eventTimestamp: JOIN_EVENT_AT,
    })).resolves.toBe("already_handled");
  });

  it("reserves immutable history before one deterministic LINE push and then finalizes", async () => {
    const { db } = createDb();
    let auditMessageId = "";
    mocks.getDb.mockResolvedValue(db);
    mocks.reserveLineOutgoingAudit.mockImplementation(async reservation => {
      auditMessageId = reservation.messageId;
      db.execute.mockResolvedValueOnce([[{
        isActive: 1,
        autoReplyEnabled: 1,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
        pendingAuditMessageId: auditMessageId,
      }], []]);
      return { created: true, status: "pending" };
    });

    await expect(beginLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      groupName: "テストブランド",
      joinEventId: JOIN_EVENT_ID,
      joinEventAt: JOIN_EVENT_AT,
    })).resolves.toBe(true);

    expect(mocks.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      messageId: expect.stringMatching(/^line:onboard:i:/),
      sourceType: "group",
      lineGroupId: GROUP_ID,
      senderName: "高橋 悠真",
      content: expect.stringContaining("ブランド「テストブランド」"),
    }));
    expect(mocks.reserveLineOutgoingAudit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.pushMessage.mock.invocationCallOrder[0],
    );
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      GROUP_ID,
      [{ type: "text", text: expect.stringContaining("— 高橋 悠真") }],
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(mocks.finalizeLineOutgoingAudit).toHaveBeenCalledWith(
      auditMessageId,
      "LINEグループ初回案内送信済み",
    );
  });

  it("delivers one non-mention onboarding reply for an unlinked participant inside the active window", async () => {
    let auditMessageId = "";
    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        status: "awaiting_profile",
        expiresAt: new Date(Date.now() + 60_000),
        autoReplyCount: 0,
        lastInboundMessageId: null,
        pendingSourceMessageId: null,
        pendingAuditMessageId: null,
        pendingReplyText: null,
        pendingNextStatus: null,
        isActive: 1,
        autoReplyEnabled: 1,
        userType: null,
        isBlocked: null,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
      }], []])
      .mockResolvedValue([{ affectedRows: 1 }, []]);
    const db = {
      execute: vi.fn(),
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.reserveLineOutgoingAudit.mockImplementation(async reservation => {
      auditMessageId = reservation.messageId;
      db.execute.mockResolvedValueOnce([[{
        isActive: 1,
        autoReplyEnabled: 1,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
        pendingAuditMessageId: auditMessageId,
      }], []]);
      return { created: true, status: "pending" };
    });

    await expect(continueLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      sourceMessageId: "inbound-message-1",
      lineUserId: "unlinked-user-1",
      text: "TikTokは@example、美容系です",
      eventTimestamp: JOIN_EVENT_AT,
    })).resolves.toBe(true);

    expect(mocks.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      messageId: expect.stringMatching(/^line:onboard:r:/),
      sourceType: "group",
      lineGroupId: GROUP_ID,
      content: expect.stringContaining("サンプルや興味のある商品"),
    }));
    expect(mocks.pushMessage).toHaveBeenCalledOnce();
    expect(mocks.finalizeLineOutgoingAudit).toHaveBeenCalledWith(
      auditMessageId,
      "LINEグループ初回会話応答送信済み",
    );
  });

  it.each(["cancelled", "none"] as const)("never sends a terminal %s onboarding audit", async status => {
    const { db } = createDb();
    mocks.getDb.mockResolvedValue(db);
    mocks.reserveLineOutgoingAudit.mockResolvedValue({ created: false, status });

    await expect(beginLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      groupName: "テストブランド",
      joinEventId: JOIN_EVENT_ID,
      joinEventAt: JOIN_EVENT_AT,
    })).resolves.toBe(false);

    expect(mocks.pushMessage).not.toHaveBeenCalled();
    expect(mocks.finalizeLineOutgoingAudit).not.toHaveBeenCalled();
  });

  it("does not start from a stale join after a newer lifecycle event", async () => {
    const { db } = createDb({ currentLifecycleEventId: "newer-leave-event" });
    mocks.getDb.mockResolvedValue(db);

    await expect(beginLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      groupName: "古い招待",
      joinEventId: JOIN_EVENT_ID,
      joinEventAt: JOIN_EVENT_AT,
    })).resolves.toBe(false);

    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("does not start an intro for a join event older than seven wall-clock days", async () => {
    const oldJoinAt = Date.now() - (8 * 24 * 60 * 60 * 1_000);
    const execute = vi.fn().mockResolvedValueOnce([[{
      isActive: 1,
      autoReplyEnabled: 1,
      lifecycleIsActive: 1,
      lastEventAt: oldJoinAt,
      lastEventId: "old-join-event",
    }], []]);
    const db = {
      transaction: vi.fn(async (callback: any) => callback({ execute })),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(beginLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      groupName: "遅延ブランド",
      joinEventId: "old-join-event",
      joinEventAt: oldJoinAt,
    })).resolves.toBe(false);
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("does not start a greeting when an existing group explicitly opted out", async () => {
    const { db } = createDb({ autoReplyEnabled: false });
    mocks.getDb.mockResolvedValue(db);

    await expect(beginLineGroupOnboarding({
      lineGroupId: GROUP_ID,
      groupName: "通知停止ブランド",
      joinEventId: JOIN_EVENT_ID,
      joinEventAt: JOIN_EVENT_AT,
    })).resolves.toBe(false);
    expect(mocks.reserveLineOutgoingAudit).not.toHaveBeenCalled();
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("retries response-loss recovery with the same LINE retry key", async () => {
    const { db } = createDb();
    let auditMessageId = "";
    mocks.getDb.mockResolvedValue(db);
    mocks.reserveLineOutgoingAudit.mockImplementation(async reservation => {
      auditMessageId = reservation.messageId;
      db.execute.mockResolvedValueOnce([[{
        isActive: 1,
        autoReplyEnabled: 1,
        ...ACTIVE_ONBOARDING_LIFECYCLE,
        pendingAuditMessageId: auditMessageId,
      }], []]);
      return { created: false, status: "pending" };
    });
    mocks.finalizeLineOutgoingAudit
      .mockRejectedValueOnce(new Error("audit unavailable"))
      .mockResolvedValueOnce(undefined);

    const payload = {
      lineGroupId: GROUP_ID,
      groupName: "テストブランド",
      joinEventId: JOIN_EVENT_ID,
      joinEventAt: JOIN_EVENT_AT,
    };
    await expect(beginLineGroupOnboarding(payload)).rejects.toThrow("audit unavailable");

    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        isActive: 1,
        autoReplyEnabled: 1,
        lifecycleIsActive: 1,
        lastEventAt: JOIN_EVENT_AT,
        lastEventId: JOIN_EVENT_ID,
      }], []])
      .mockResolvedValueOnce([[{
        joinEventId: JOIN_EVENT_ID,
        status: "pending_intro",
        pendingAuditMessageId: auditMessageId,
        pendingReplyText: composeLineGroupOnboardingGreeting("テストブランド"),
        pendingNextStatus: "awaiting_profile",
      }], []])
      .mockResolvedValue([{ affectedRows: 1 }, []]);
    db.transaction.mockImplementationOnce(async (callback: any) => callback({ execute }));

    await expect(beginLineGroupOnboarding(payload)).resolves.toBe(true);
    expect(mocks.pushMessage).toHaveBeenCalledTimes(2);
    expect(mocks.pushMessage.mock.calls[0][2]).toBe(mocks.pushMessage.mock.calls[1][2]);
  });

  it("autonomously recovers a durable pending onboarding delivery", async () => {
    const txExecute = vi.fn()
      .mockResolvedValueOnce([[{
        pendingSourceMessageId: "pending-source-1",
        pendingAuditMessageId: "line:onboard:r:pending-source-1",
        pendingReplyText: "保存済みの限定onboarding返信",
        pendingNextStatus: "completed",
        expiresAt: new Date(Date.now() + 60_000),
      }], []])
      .mockResolvedValue([{ affectedRows: 1 }, []]);
    const dbExecute = vi.fn()
      .mockResolvedValueOnce([[{ lineGroupId: GROUP_ID }], []])
      .mockResolvedValueOnce([[{
        isActive: 1,
        autoReplyEnabled: 1,
        pendingAuditMessageId: "line:onboard:r:pending-source-1",
        ...ACTIVE_ONBOARDING_LIFECYCLE,
      }], []]);
    const db = {
      execute: dbExecute,
      transaction: vi.fn(async (callback: any) => callback({ execute: txExecute })),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(recoverPendingLineGroupOnboardingDeliveries()).resolves.toEqual({
      inspected: 1,
      recovered: 1,
      failed: 0,
    });
    expect(mocks.reserveLineOutgoingAudit).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "line:onboard:r:pending-source-1",
      lineGroupId: GROUP_ID,
      content: "保存済みの限定onboarding返信",
    }));
    expect(mocks.pushMessage).toHaveBeenCalledOnce();
    expect(mocks.finalizeLineOutgoingAudit).toHaveBeenCalledOnce();
  });
});
