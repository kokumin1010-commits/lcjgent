import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { __lineDbTestUtils, type LineOutgoingAuditReservation } from "./db";
import { sortLineMessagesChronologically } from "../shared/lineMessageHistory";

const reservation: LineOutgoingAuditReservation = {
  messageId: "manual:00000000-0000-4000-8000-000000000001",
  sourceType: "group",
  lineGroupId: "C00000000000000000000000000000001",
  senderName: "高橋 悠真",
  content: "配信準備はいかがですか？",
  lineTimestamp: Date.parse("2026-09-21T00:00:00.000Z"),
  pendingSummary: "LINE管理画面からの手動送信準備中",
};

function queryText(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(queryText).join(" ");
  if (!value || typeof value !== "object") return "";
  if (typeof value.value === "string") return value.value;
  if (Array.isArray(value.value)) return value.value.map(queryText).join(" ");
  if (Array.isArray(value.queryChunks)) return value.queryChunks.map(queryText).join(" ");
  return "";
}

function createAuditDb(options?: {
  duplicate?: boolean;
  existing?: Record<string, unknown> | null;
  rateLimitCount?: number;
  conversationRevision?: number;
}) {
  const values = vi.fn(async () => {
    if (options?.duplicate) {
      const error = new Error("duplicate") as Error & { code?: string };
      error.code = "ER_DUP_ENTRY";
      throw error;
    }
    return [{ insertId: 1 }];
  });
  const limit = vi.fn(async () => options?.existing ? [options.existing] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  let executeCount = 0;
  const execute = vi.fn(async (query: any) => {
    executeCount += 1;
    if (queryText(query).includes("SELECT conversationRevision")) {
      return [[{ conversationRevision: options?.conversationRevision ?? 0 }]];
    }
    if (executeCount === 2) return [[{ lineGroupId: reservation.lineGroupId }]];
    if (executeCount === 5 && options?.rateLimitCount != null) {
      return [[{ total: options.rateLimitCount }]];
    }
    return [{ affectedRows: 1 }];
  });
  const insert = vi.fn(() => ({ values }));
  const transaction = vi.fn(async callback => callback({ insert, select, execute }));
  return {
    db: {
      transaction,
    } as any,
    values,
    limit,
    execute,
    transaction,
  };
}

describe("LINE group automatic follow-up grace period", () => {
  it("uses the newest of message, creation, and automation-enabled timestamps", () => {
    expect(__lineDbTestUtils.getLineGroupFollowUpActivityAt({
      createdAt: "2026-09-01T00:00:00.000Z",
      lastMessageAt: "2026-09-10T00:00:00.000Z",
      autoFollowUpEnabledAt: "2026-09-21T08:00:00.000Z",
    }).toISOString()).toBe("2026-09-21T08:00:00.000Z");

    expect(__lineDbTestUtils.getLineGroupFollowUpActivityAt({
      createdAt: "2026-09-01T00:00:00.000Z",
      lastMessageAt: "2026-09-22T00:00:00.000Z",
      autoFollowUpEnabledAt: "2026-09-21T08:00:00.000Z",
    }).toISOString()).toBe("2026-09-22T00:00:00.000Z");

    expect(__lineDbTestUtils.getLineGroupFollowUpActivityAt({
      createdAt: "2026-09-01T00:00:00.000Z",
      lastMessageAt: "2026-09-18T00:00:00.000Z",
      lastConversationActivityAt: "2026-09-23T00:00:00.000Z",
      autoFollowUpEnabledAt: "2026-09-21T08:00:00.000Z",
    }).toISOString()).toBe("2026-09-23T00:00:00.000Z");
  });

  it("waits the full period after a successful reviewed reply", () => {
    const group = {
      createdAt: "2026-08-01T00:00:00.000Z",
      lastMessageAt: "2026-09-18T00:00:00.000Z",
      lastConversationActivityAt: "2026-09-23T08:00:00.000Z",
      autoFollowUpEnabledAt: "2026-09-01T00:00:00.000Z",
      autoFollowUpDays: 2,
      lastAutoFollowUpAt: null,
    };
    expect(__lineDbTestUtils.getLineGroupFollowUpEligibility(
      group,
      new Date("2026-09-25T07:59:59.999Z"),
    ).eligible).toBe(false);
    expect(__lineDbTestUtils.getLineGroupFollowUpEligibility(
      group,
      new Date("2026-09-25T08:00:00.000Z"),
    ).eligible).toBe(true);
  });

  it("waits the full configured period after automatic enablement before becoming eligible", () => {
    const group = {
      createdAt: "2026-08-01T00:00:00.000Z",
      lastMessageAt: "2026-09-01T00:00:00.000Z",
      autoFollowUpEnabledAt: "2026-09-21T08:00:00.000Z",
      autoFollowUpDays: 2,
      lastAutoFollowUpAt: null,
    };
    const before = __lineDbTestUtils.getLineGroupFollowUpEligibility(
      group,
      new Date("2026-09-23T07:59:59.999Z"),
    );
    expect(before.eligible).toBe(false);
    expect(before.lastActivityAt.toISOString()).toBe("2026-09-21T08:00:00.000Z");

    const after = __lineDbTestUtils.getLineGroupFollowUpEligibility(
      group,
      new Date("2026-09-23T08:00:00.000Z"),
    );
    expect(after.eligible).toBe(true);
    expect(after.lastActivityAt.toISOString()).toBe("2026-09-21T08:00:00.000Z");
  });
});

describe("LINE outbound audit reliability", () => {
  it("finalizes only a pending audit row", async () => {
    const updateWhere = vi.fn(async () => [{ affectedRows: 1 }]);
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const select = vi.fn();

    await expect(__lineDbTestUtils.finalizeLineOutgoingAuditWithDb(
      { update, select } as any,
      "manual:pending",
      "sent",
    )).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("treats an already responded audit as an idempotent finalization", async () => {
    const updateWhere = vi.fn(async () => [{ affectedRows: 0 }]);
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const limit = vi.fn(async () => [{ responseStatus: "responded" }]);
    const selectWhere = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));

    await expect(__lineDbTestUtils.finalizeLineOutgoingAuditWithDb(
      { update, select } as any,
      "manual:responded",
      "sent",
    )).resolves.toBeUndefined();
  });

  it.each(["cancelled", "none"])("never overwrites a terminal %s audit during finalization", async responseStatus => {
    const updateWhere = vi.fn(async () => [{ affectedRows: 0 }]);
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const limit = vi.fn(async () => [{ responseStatus }]);
    const selectWhere = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));

    await expect(__lineDbTestUtils.finalizeLineOutgoingAuditWithDb(
      { update, select } as any,
      `manual:${responseStatus}`,
      "sent",
    )).rejects.toMatchObject({ code: "LINE_OUTBOUND_AUDIT_FINALIZE_CONFLICT" });
  });

  it("creates a pending immutable audit before first delivery", async () => {
    const fake = createAuditDb();

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, reservation)).resolves.toEqual({
      created: true,
      status: "pending",
    });
    expect(fake.values).toHaveBeenCalledWith(expect.objectContaining({
      messageId: reservation.messageId,
      lineGroupId: reservation.lineGroupId,
      content: reservation.content,
      direction: "outgoing",
      responseStatus: "pending",
    }));
    expect(fake.execute).toHaveBeenCalledTimes(5);
    expect(fake.execute.mock.invocationCallOrder[1]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.execute.mock.invocationCallOrder[2]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.execute.mock.invocationCallOrder[3]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.values.mock.invocationCallOrder[0]).toBeLessThan(fake.execute.mock.invocationCallOrder[4]);
    expect(fake.transaction).toHaveBeenCalledTimes(1);
  });

  it("reserves a group reply only when the reviewed conversation revision is current", async () => {
    const fake = createAuditDb({ conversationRevision: 42 });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, {
      ...reservation,
      expectedGroupConversationRevision: 42,
    })).resolves.toEqual({ created: true, status: "pending" });
    expect(fake.values).toHaveBeenCalledTimes(1);
  });

  it("can reserve a follow-up intent without advancing the conversation revision", async () => {
    const fake = createAuditDb({ conversationRevision: 42 });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, {
      ...reservation,
      messageId: "auto_followup_00000000-0000-4000-8000-000000000001",
      expectedGroupConversationRevision: 42,
    }, { incrementConversationRevision: false })).resolves.toEqual({ created: true, status: "pending" });
    expect(fake.execute.mock.calls.map(call => queryText(call[0])).join("\n"))
      .not.toContain("conversationRevision = conversationRevision + 1");
  });

  it("rejects a stale reviewed group reply before creating an outbound audit", async () => {
    const fake = createAuditDb({ conversationRevision: 43 });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, {
      ...reservation,
      expectedGroupConversationRevision: 42,
    })).rejects.toMatchObject({ code: "LINE_GROUP_CONVERSATION_CHANGED" });
    expect(fake.values).not.toHaveBeenCalled();
  });

  it("atomically reserves below the configured group-user rate limit", async () => {
    const fake = createAuditDb({ rateLimitCount: 2 });
    const limitedReservation: LineOutgoingAuditReservation = {
      ...reservation,
      lineUserId: "U00000000000000000000000000000001",
      rateLimit: {
        messageIdPrefix: "group-public-question:",
        windowMs: 10 * 60 * 1000,
        maxCount: 3,
        errorCode: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
      },
    };

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, limitedReservation))
      .resolves.toEqual({ created: true, status: "pending" });
    expect(fake.values).toHaveBeenCalledTimes(1);
    expect(fake.execute).toHaveBeenCalledTimes(6);
  });

  it("rejects before insert when the configured group-user rate limit is reached", async () => {
    const fake = createAuditDb({ rateLimitCount: 3 });
    const limitedReservation: LineOutgoingAuditReservation = {
      ...reservation,
      lineUserId: "U00000000000000000000000000000001",
      rateLimit: {
        messageIdPrefix: "group-public-question:",
        windowMs: 10 * 60 * 1000,
        maxCount: 3,
        errorCode: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
      },
    };

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, limitedReservation))
      .rejects.toMatchObject({ code: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED" });
    expect(fake.values).not.toHaveBeenCalled();
    expect(fake.execute).toHaveBeenCalledTimes(5);
  });

  it("rejects an invalid rate-limit configuration before audit insert", async () => {
    const fake = createAuditDb();
    const limitedReservation: LineOutgoingAuditReservation = {
      ...reservation,
      lineUserId: "U00000000000000000000000000000001",
      rateLimit: {
        messageIdPrefix: "group-public-question:",
        windowMs: 0,
        maxCount: 3,
        errorCode: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
      },
    };

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, limitedReservation))
      .rejects.toThrow("LINE_OUTBOUND_RATE_LIMIT_CONFIG_INVALID");
    expect(fake.values).not.toHaveBeenCalled();
    expect(fake.execute).toHaveBeenCalledTimes(4);
  });

  it("accepts an identical response-loss retry and returns its finalized state", async () => {
    const fake = createAuditDb({
      duplicate: true,
      existing: {
        sourceType: reservation.sourceType,
        lineUserId: null,
        lineGroupId: reservation.lineGroupId,
        content: reservation.content,
        direction: "outgoing",
        responseStatus: "responded",
      },
    });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, reservation)).resolves.toEqual({
      created: false,
      status: "responded",
    });
    expect(fake.execute).toHaveBeenCalledTimes(4);
  });

  it("accepts an identical reviewed-group retry after its own audit changed the revision", async () => {
    const fake = createAuditDb({
      duplicate: true,
      conversationRevision: 43,
      existing: {
        sourceType: reservation.sourceType,
        lineUserId: null,
        lineGroupId: reservation.lineGroupId,
        content: reservation.content,
        direction: "outgoing",
        responseStatus: "responded",
      },
    });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, {
      ...reservation,
      expectedGroupConversationRevision: 42,
    })).resolves.toEqual({ created: false, status: "responded" });
    expect(fake.values).toHaveBeenCalledTimes(1);
  });

  it("rejects the same request UUID with different content or target", async () => {
    const fake = createAuditDb({
      duplicate: true,
      existing: {
        sourceType: reservation.sourceType,
        lineUserId: null,
        lineGroupId: reservation.lineGroupId,
        content: "最初に送った本文",
        direction: "outgoing",
        responseStatus: "pending",
      },
    });

    await expect(__lineDbTestUtils.reserveLineOutgoingAuditWithDb(fake.db, reservation)).rejects.toMatchObject({
      code: "LINE_OUTBOUND_IDEMPOTENCY_CONFLICT",
    });
  });
});

describe("LINE message history event ordering", () => {
  it("renders delayed webhook arrivals by LINE event time, not database arrival time", () => {
    const messages = [
      {
        id: 2,
        content: "older event saved later",
        lineTimestamp: Date.parse("2026-09-20T01:00:00.000Z"),
        createdAt: "2026-09-20T03:00:00.000Z",
      },
      {
        id: 1,
        content: "newer event saved first",
        lineTimestamp: Date.parse("2026-09-20T02:00:00.000Z"),
        createdAt: "2026-09-20T02:01:00.000Z",
      },
      {
        id: 3,
        content: "legacy null timestamp",
        lineTimestamp: null,
        createdAt: "2026-09-20T00:30:00.000Z",
      },
    ];

    expect(sortLineMessagesChronologically(messages).map(message => message.content)).toEqual([
      "legacy null timestamp",
      "older event saved later",
      "newer event saved first",
    ]);
    expect(messages[0].content).toBe("older event saved later");
  });

  it("selects the newest bounded window using the same event-time fallback and stable tie-breakers", () => {
    const source = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8");
    const historyBlock = source.slice(
      source.indexOf("export async function getLineMessages"),
      source.indexOf("// Create LINE follow-up"),
    );
    expect(historyBlock).toContain("COALESCE(${lineMessages.lineTimestamp}, UNIX_TIMESTAMP(${lineMessages.createdAt}) * 1000)");
    expect(historyBlock).toContain("desc(lineMessages.createdAt)");
    expect(historyBlock).toContain("desc(lineMessages.id)");
    expect(historyBlock).toContain(".limit(options.limit || 50)");
  });
});

describe("LINE group follow-up pre-delivery claim", () => {
  const baseGroup = {
    lineGroupId: "C00000000000000000000000000000001",
    groupName: "配信相談",
    isActive: 1,
    autoFollowUpEnabled: 1,
    autoFollowUpDays: 2,
    autoFollowUpMessage: "固定文面",
    lastAutoFollowUpAt: null,
    lastMessageAt: "2026-09-18T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    conversationRevision: 7,
  };

  function claimDb(responses: unknown[]) {
    const execute = vi.fn(async () => responses.shift() ?? [[]]);
    const limit = vi.fn(async () => []);
    const whereSelect = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where: whereSelect }));
    const select = vi.fn(() => ({ from }));
    const values = vi.fn(async () => [{ insertId: 88 }]);
    const insert = vi.fn(() => ({ values }));
    const whereUpdate = vi.fn(async () => [{ affectedRows: 1 }]);
    const set = vi.fn(() => ({ where: whereUpdate }));
    const update = vi.fn(() => ({ set }));
    let inTransaction = false;
    const transaction = vi.fn(async callback => {
      inTransaction = true;
      try {
        return await callback({ execute, select, insert, update });
      } finally {
        inTransaction = false;
      }
    });
    return {
      execute,
      db: {
        transaction,
      } as any,
      transaction,
      isInTransaction: () => inTransaction,
      insert,
      update,
      set,
    };
  }

  it("locks, delivers, finalizes, and suppresses inside one transaction", async () => {
    const fake = claimDb([
      [[baseGroup]],
      [[]],
      [[]],
      [[{ analysisEnabled: 0, proactiveAiEnabled: 0 }]],
      [{ affectedRows: 1 }],
    ]);
    const deliver = vi.fn(async context => {
      expect(fake.isInTransaction()).toBe(true);
      await context.finalizeOutgoingAudit("auto_followup_test", "送信済み");
      return "delivered";
    });

    await expect(__lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      now: new Date("2026-09-21T01:00:00.000Z"),
    }, deliver)).resolves.toEqual({ claimed: true, result: "delivered" });

    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      lineGroupId: baseGroup.lineGroupId,
      mode: "fixed",
      daysSinceLastMessage: 3,
      conversationRevision: baseGroup.conversationRevision,
    }));
    expect(fake.update).toHaveBeenCalledTimes(1);
    expect(fake.execute).toHaveBeenCalledTimes(5);
  });

  it.each([
    ["group_inactive_or_opted_out", { ...baseGroup, autoFollowUpEnabled: 0 }, []],
    ["group_activity_changed", { ...baseGroup, lastMessageAt: "2026-09-20T00:00:00.000Z" }, []],
    ["active_reminder_exists", baseGroup, [[{ id: 99 }]]],
  ])("rejects %s without running delivery", async (reason, group, reminderRows) => {
    const fake = claimDb([[[group]], [[]], reminderRows]);
    const deliver = vi.fn();

    const result = await __lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      now: new Date("2026-09-21T01:00:00.000Z"),
    }, deliver);

    expect(result).toEqual({ claimed: false, reason });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("rejects a stale conversation revision before delivery", async () => {
    const fake = claimDb([[[{ ...baseGroup, conversationRevision: 8 }]]]);
    const deliver = vi.fn();

    await expect(__lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      now: new Date("2026-09-21T01:00:00.000Z"),
    }, deliver)).resolves.toEqual({ claimed: false, reason: "group_conversation_changed" });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("rejects while another group outbound delivery is pending", async () => {
    const fake = claimDb([
      [[baseGroup]],
      [[{ messageId: "manual:pending" }]],
    ]);
    const deliver = vi.fn();

    await expect(__lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      now: new Date("2026-09-21T01:00:00.000Z"),
    }, deliver)).resolves.toEqual({ claimed: false, reason: "outbound_delivery_pending" });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("cancels the current pending audit at the retry deadline while holding the group lock", async () => {
    const deadline = new Date("2026-09-21T01:00:00.000Z");
    const fake = claimDb([
      [[baseGroup]],
      [[]],
      [[]],
      [[{ analysisEnabled: 0, proactiveAiEnabled: 0 }]],
    ]);
    const deliver = vi.fn();

    await expect(__lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      retryDeadlineAt: deadline,
      now: deadline,
    }, deliver)).resolves.toEqual({ claimed: false, reason: "retry_window_expired" });
    expect(fake.transaction).toHaveBeenCalledTimes(1);
    expect(fake.update).toHaveBeenCalledTimes(1);
    expect(fake.set).toHaveBeenCalledWith(expect.objectContaining({
      responseStatus: "cancelled",
    }));
    expect(deliver).not.toHaveBeenCalled();
  });

  it("rejects a fixed-message fallback when the locked AI opt-in mode changed", async () => {
    const fake = claimDb([
      [[baseGroup]],
      [[]],
      [[]],
      [[{ analysisEnabled: 1, proactiveAiEnabled: 1 }]],
    ]);
    const deliver = vi.fn();

    await expect(__lineDbTestUtils.withLineGroupFollowUpClaimUsingDb(fake.db, {
      lineGroupId: baseGroup.lineGroupId,
      expectedLastActivityAt: baseGroup.lastMessageAt,
      expectedConversationRevision: baseGroup.conversationRevision,
      expectedMode: "fixed",
      currentAuditMessageId: "auto_followup_test",
      now: new Date("2026-09-21T01:00:00.000Z"),
    }, deliver)).resolves.toEqual({ claimed: false, reason: "follow_up_mode_changed" });
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("LINE group reminder creation lock protocol", () => {
  function createReminderDb(isActive: boolean) {
    const execute = vi.fn(async () => [[{ isActive: isActive ? 1 : 0 }]]);
    const values = vi.fn(async () => [{ insertId: 44 }]);
    const insert = vi.fn(() => ({ values }));
    const transaction = vi.fn(async callback => callback({ execute, insert }));
    return { db: { transaction, insert } as any, execute, values, transaction };
  }

  it("locks the parent group before inserting an active group reminder", async () => {
    const fake = createReminderDb(true);

    await expect(__lineDbTestUtils.createLineFollowUpWithDb(fake.db, {
      targetType: "group",
      lineGroupId: "C00000000000000000000000000000001",
      triggerCondition: "scheduled",
      messageTemplate: "配信確認",
    })).resolves.toMatchObject({ id: 44 });

    expect(fake.transaction).toHaveBeenCalledTimes(1);
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(fake.execute.mock.invocationCallOrder[0]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
  });

  it("does not create a reminder for an inactive group after obtaining the parent lock", async () => {
    const fake = createReminderDb(false);

    await expect(__lineDbTestUtils.createLineFollowUpWithDb(fake.db, {
      targetType: "group",
      lineGroupId: "C00000000000000000000000000000001",
      triggerCondition: "scheduled",
      messageTemplate: "配信確認",
    })).rejects.toThrow("LINE_GROUP_FOLLOW_UP_TARGET_UNAVAILABLE");
    expect(fake.values).not.toHaveBeenCalled();
  });

  it("rejects a group reminder without a group ID instead of bypassing the parent lock", async () => {
    const fake = createReminderDb(true);

    await expect(__lineDbTestUtils.createLineFollowUpWithDb(fake.db, {
      targetType: "group",
      triggerCondition: "scheduled",
      messageTemplate: "配信確認",
    })).rejects.toThrow("LINE_GROUP_FOLLOW_UP_TARGET_REQUIRED");
    expect(fake.transaction).not.toHaveBeenCalled();
    expect(fake.values).not.toHaveBeenCalled();
  });
});

describe("LINE group inbound persistence and activity", () => {
  function inboundDb(options?: { duplicate?: boolean }) {
    const values = vi.fn(async () => {
      if (options?.duplicate) {
        const error = new Error("duplicate") as Error & { code?: string };
        error.code = "ER_DUP_ENTRY";
        throw error;
      }
      return [{ insertId: 77 }];
    });
    const insert = vi.fn(() => ({ values }));
    let executeCount = 0;
    const execute = vi.fn(async () => {
      executeCount += 1;
      return executeCount === 2
        ? [[{ lineGroupId: reservation.lineGroupId }]]
        : [[]];
    });
    const transaction = vi.fn(async callback => callback({ execute, insert }));
    return { db: { transaction } as any, transaction, execute, insert, values };
  }

  it("commits the unique inbound row and monotonic lastMessageAt update together", async () => {
    const fake = inboundDb();
    const data = {
      messageId: "group-inbound-atomic",
      lineUserId: "U00000000000000000000000000000001",
      lineGroupId: "C00000000000000000000000000000001",
      content: "配信の相談です",
      lineTimestamp: Date.parse("2026-09-20T02:00:00.000Z"),
    };

    await expect(__lineDbTestUtils.saveLineGroupInboundMessageAndActivityWithDb(fake.db, data))
      .resolves.toEqual({ id: 77, ...data });
    expect(fake.transaction).toHaveBeenCalledTimes(1);
    expect(fake.execute).toHaveBeenCalledTimes(5);
    expect(fake.execute.mock.invocationCallOrder[1]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.execute.mock.invocationCallOrder[2]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.execute.mock.invocationCallOrder[3]).toBeLessThan(fake.values.mock.invocationCallOrder[0]);
    expect(fake.values.mock.invocationCallOrder[0]).toBeLessThan(fake.execute.mock.invocationCallOrder[4]);
  });

  it("does not move activity for a duplicate webhook message", async () => {
    const fake = inboundDb({ duplicate: true });

    await expect(__lineDbTestUtils.saveLineGroupInboundMessageAndActivityWithDb(fake.db, {
      messageId: "group-inbound-duplicate",
      lineUserId: "U00000000000000000000000000000001",
      lineGroupId: "C00000000000000000000000000000001",
      content: "再配信",
      lineTimestamp: Date.parse("2026-09-20T02:00:00.000Z"),
    })).resolves.toBeNull();
    expect(fake.execute).toHaveBeenCalledTimes(4);
  });
});

describe("LINE group unsend conversation revision", () => {
  function redactionDb(alreadyCancelled = false) {
    let executeCount = 0;
    const execute = vi.fn(async () => {
      executeCount += 1;
      if (executeCount === 1 || executeCount === 2) {
        return [[{ lineGroupId: reservation.lineGroupId }]];
      }
      if (executeCount === 3) {
        return [[{
          lineGroupId: reservation.lineGroupId,
          content: alreadyCancelled ? "[送信取消済み]" : "元の会話",
          responseStatus: alreadyCancelled ? "cancelled" : "none",
        }]];
      }
      return [{ affectedRows: 1 }];
    });
    const updateWhere = vi.fn(async () => [{ affectedRows: 1 }]);
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const transaction = vi.fn(async callback => callback({ execute, update }));
    return { db: { transaction } as any, execute, update, set, updateWhere, transaction };
  }

  it("redacts under the parent lock and advances the revision once", async () => {
    const fake = redactionDb();

    await expect(__lineDbTestUtils.redactLineMessageByMessageIdWithDb(
      fake.db,
      "group-unsend-once",
    )).resolves.toBeUndefined();

    expect(fake.execute).toHaveBeenCalledTimes(5);
    expect(fake.update).toHaveBeenCalledTimes(1);
    expect(fake.execute.mock.invocationCallOrder[1]).toBeLessThan(fake.update.mock.invocationCallOrder[0]);
  });

  it("does not mutate or advance the revision for an already redacted delivery", async () => {
    const fake = redactionDb(true);

    await expect(__lineDbTestUtils.redactLineMessageByMessageIdWithDb(
      fake.db,
      "group-unsend-duplicate",
    )).resolves.toBeUndefined();

    expect(fake.execute).toHaveBeenCalledTimes(3);
    expect(fake.update).not.toHaveBeenCalled();
  });
});
