import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  getLineGroupByLineId: vi.fn(),
  generateLineGroupMessageDraft: vi.fn(),
  pushMessage: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getLineGroupByLineId: state.getLineGroupByLineId,
  };
});

vi.mock("./lineAiManager", async importOriginal => {
  const actual = await importOriginal<typeof import("./lineAiManager")>();
  return {
    ...actual,
    generateLineGroupMessageDraft: state.generateLineGroupMessageDraft,
  };
});

vi.mock("./line", async importOriginal => {
  const actual = await importOriginal<typeof import("./line")>();
  return {
    ...actual,
    pushMessage: state.pushMessage,
  };
});

import { appRouter } from "./routers";

const groupId = "C00000000000000000000000000000001";

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `line-draft-${role}`,
      email: `${role}@example.com`,
      name: role,
      loginMethod: "manus",
      role,
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

describe("LINE group AI draft API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getLineGroupByLineId.mockResolvedValue({ lineGroupId: groupId, isActive: true });
    state.generateLineGroupMessageDraft.mockResolvedValue({
      message: "配信準備で困っていることはありますか？\n\n— LCJ公式AIマネージャー",
      model: "gpt-5-mini",
      sourceMessageCount: 4,
      latestMessageAt: "2026-09-21T00:00:00.000Z",
    });
  });

  it("returns a review-only draft without invoking LINE delivery", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.line.generateGroupMessageDraft({
      lineGroupId: groupId,
      currentDraft: "この文章を自然にしてください",
    });

    expect(result.message).toContain("LCJ公式AIマネージャー");
    expect(state.generateLineGroupMessageDraft).toHaveBeenCalledWith(
      groupId,
      "この文章を自然にしてください",
      "1",
    );
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("rejects inactive groups before invoking the LLM", async () => {
    state.getLineGroupByLineId.mockResolvedValue({ lineGroupId: groupId, isActive: false });
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.line.generateGroupMessageDraft({ lineGroupId: groupId }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.generateLineGroupMessageDraft).not.toHaveBeenCalled();
  });

  it("requires explicit group conversation analysis opt-in", async () => {
    state.generateLineGroupMessageDraft.mockRejectedValue(
      new Error("LINE_GROUP_AI_ANALYSIS_DISABLED"),
    );
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.line.generateGroupMessageDraft({ lineGroupId: groupId }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("グループ会話を分析"),
      });
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("requires analysis refresh after the conversation revision changes", async () => {
    state.generateLineGroupMessageDraft.mockRejectedValue(
      new Error("LINE_GROUP_AI_DRAFT_INSIGHT_STALE"),
    );
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.line.generateGroupMessageDraft({ lineGroupId: groupId }))
      .rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("更新分析"),
      });
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("returns a retryable error when draft generation is rate limited", async () => {
    state.generateLineGroupMessageDraft.mockRejectedValue(
      new Error("LINE_GROUP_AI_DRAFT_RATE_LIMITED"),
    );
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.line.generateGroupMessageDraft({ lineGroupId: groupId }))
      .rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: expect.stringContaining("30秒後"),
      });
    expect(state.pushMessage).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.line.generateGroupMessageDraft({ lineGroupId: groupId }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.getLineGroupByLineId).not.toHaveBeenCalled();
    expect(state.generateLineGroupMessageDraft).not.toHaveBeenCalled();
  });
});
