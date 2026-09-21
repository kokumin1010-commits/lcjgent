import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  execute: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  leftJoin: vi.fn(),
  innerJoin: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
}));

vi.mock("./db", () => ({
  bumpLineGroupConversationRevisionUsingExecutor: vi.fn(),
  getDb: vi.fn(async () => ({
    execute: state.execute,
    select: state.select,
    transaction: vi.fn(async callback => callback({ execute: state.execute, select: state.select })),
  })),
  getLineMessages: vi.fn(async () => []),
  getLiverInteractionSummary: vi.fn(async () => null),
  lockLineGroupConversationUsingExecutor: vi.fn(),
  saveLineMessage: vi.fn(),
}));
vi.mock("./line", () => ({ pushMessage: vi.fn() }));
vi.mock("./_core/dataApi", () => ({ callDataApi: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import {
  canDeliverLineAiManagerGroupReply,
  canLineAiManagerReplyInGroup,
} from "./lineAiManager";

const groupId = "C00000000000000000000000000000001";
const lineUserId = "U00000000000000000000000000000001";

function installTargetRows(rows: unknown[]) {
  state.limit.mockResolvedValue(rows);
  state.where.mockReturnValue({ limit: state.limit });
  state.leftJoin.mockReturnValue({ where: state.where });
  state.innerJoin.mockReturnValue({ leftJoin: state.leftJoin });
  state.from.mockReturnValue({ innerJoin: state.innerJoin });
  state.select.mockReturnValue({ from: state.from });
}

describe("LINE group reply eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.execute.mockResolvedValue([[{ isActive: 1, lifecycleIsActive: 1, autoReplyEnabled: 1 }]]);
    installTargetRows([]);
  });

  it("returns false before target lookup when @LCJ replies are disabled for the group", async () => {
    state.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ isActive: 1, lifecycleIsActive: 1, autoReplyEnabled: 0 }]]);

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).resolves.toBe(false);
    expect(state.select).not.toHaveBeenCalled();
  });

  it("returns false before target lookup when lifecycle has a leave tombstone", async () => {
    state.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ isActive: 1, lifecycleIsActive: 0, autoReplyEnabled: 1 }]]);

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).resolves.toBe(false);
    expect(state.select).not.toHaveBeenCalled();
  });

  it("returns false for an unlinked, blocked, or inactive live-commer target", async () => {
    installTargetRows([]);

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).resolves.toBe(false);
    expect(state.select).toHaveBeenCalledTimes(1);
  });

  it("returns false when the linked target has disabled personal AI replies", async () => {
    installTargetRows([{
      lineUserId,
      liverId: 7,
      liverName: "配信者",
      lineDisplayName: "配信者",
      replyEnabled: 0,
    }]);

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).resolves.toBe(false);
  });

  it("allows only an active linked target with both reply gates enabled", async () => {
    installTargetRows([{
      lineUserId,
      liverId: 7,
      liverName: "配信者",
      lineDisplayName: "配信者",
      replyEnabled: 1,
    }]);

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).resolves.toBe(true);
  });

  it("propagates a settings read failure as a durable handoff error", async () => {
    state.execute.mockRejectedValueOnce(new Error("settings unavailable"));

    await expect(canLineAiManagerReplyInGroup(groupId, lineUserId)).rejects.toMatchObject({
      name: "LineAiManagerHandoffError",
    });
    expect(state.select).not.toHaveBeenCalled();
  });

  it("revalidates active group state and explicit group opt-out before queued delivery", async () => {
    state.execute.mockResolvedValueOnce([[{ isActive: 1, lifecycleIsActive: 1, autoReplyEnabled: 0 }]]);
    await expect(canDeliverLineAiManagerGroupReply(groupId)).resolves.toBe(false);

    state.execute.mockResolvedValueOnce([[{ isActive: 0, lifecycleIsActive: 1, autoReplyEnabled: 1 }]]);
    await expect(canDeliverLineAiManagerGroupReply(groupId)).resolves.toBe(false);

    state.execute.mockResolvedValueOnce([[{ isActive: 1, lifecycleIsActive: 1, autoReplyEnabled: null }]]);
    await expect(canDeliverLineAiManagerGroupReply(groupId)).resolves.toBe(false);

    state.execute.mockResolvedValueOnce([[{ isActive: 1, lifecycleIsActive: 0, autoReplyEnabled: 1 }]]);
    await expect(canDeliverLineAiManagerGroupReply(groupId)).resolves.toBe(false);
  });

  it("fails closed when queued group delivery cannot re-read current settings", async () => {
    state.execute.mockRejectedValueOnce(new Error("delivery settings unavailable"));

    await expect(canDeliverLineAiManagerGroupReply(groupId)).rejects.toThrow(
      "LINE_GROUP_AI_DELIVERY_SETTINGS_UNAVAILABLE",
    );
  });
});
