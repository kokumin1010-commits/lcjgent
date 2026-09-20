import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  dbAvailable: true,
  getLineGroupByLineId: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => {
      if (!state.dbAvailable) return null;
      return { transaction: state.transaction };
    }),
    getLineGroupByLineId: state.getLineGroupByLineId,
  };
});

import { appRouter } from "./routers";

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

describe("LINE group settings reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.dbAvailable = true;
    state.getLineGroupByLineId.mockResolvedValue({
      lineGroupId: groupId,
      isActive: true,
      autoFollowUpEnabled: false,
    });
    state.execute.mockResolvedValue([[]]);
    state.where.mockResolvedValue(undefined);
    state.set.mockReturnValue({ where: state.where });
    state.update.mockReturnValue({ set: state.set });
    state.transaction.mockImplementation(async callback => callback({
      execute: state.execute,
      update: state.update,
    }));
  });

  it("fails explicitly instead of reporting success when the settings DB is unavailable", async () => {
    state.dbAvailable = false;
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.updateGroupAutoFollowUp({
      lineGroupId: groupId,
      autoFollowUpEnabled: true,
      analysisEnabled: true,
      proactiveAiEnabled: true,
    })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringContaining("LINE_GROUP_SETTINGS_DB_UNAVAILABLE"),
    });
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it("writes AI settings and the group scheduler switch in one transaction", async () => {
    state.execute
      .mockResolvedValueOnce([[{ isActive: 1, autoFollowUpEnabled: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ analysisEnabled: false, proactiveAiEnabled: false }]])
      .mockResolvedValue([[]]);
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.updateGroupAutoFollowUp({
      lineGroupId: groupId,
      autoFollowUpEnabled: true,
      autoFollowUpDays: 3,
      autoFollowUpMessage: "",
      autoReplyEnabled: true,
      analysisEnabled: true,
      proactiveAiEnabled: true,
      relationshipObjective: "安心して配信相談できる関係をつくる",
    })).resolves.toEqual({ success: true });

    expect(state.transaction).toHaveBeenCalledTimes(1);
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.set).toHaveBeenCalledWith(expect.objectContaining({
      autoFollowUpEnabled: true,
      autoFollowUpDays: 3,
      autoFollowUpMessage: "",
    }));
    expect(state.where).toHaveBeenCalledTimes(1);
  });

  it("does not write the group scheduler switch if an AI setting statement fails", async () => {
    state.execute
      .mockResolvedValueOnce([[{ isActive: 1, autoFollowUpEnabled: 0 }]])
      .mockRejectedValueOnce(new Error("settings write failed"));
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.updateGroupAutoFollowUp({
      lineGroupId: groupId,
      autoFollowUpEnabled: true,
      analysisEnabled: true,
      proactiveAiEnabled: true,
    })).rejects.toThrow("settings write failed");
    expect(state.update).not.toHaveBeenCalled();
  });

  it("rejects a group deactivated after the initial API lookup but before the transaction lock", async () => {
    state.execute.mockResolvedValueOnce([[{ isActive: 0, autoFollowUpEnabled: 1 }]]);
    const caller = appRouter.createCaller(createAdminContext());

    await expect(caller.line.updateGroupAutoFollowUp({
      lineGroupId: groupId,
      autoFollowUpEnabled: true,
      analysisEnabled: true,
      proactiveAiEnabled: true,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.update).not.toHaveBeenCalled();
  });
});
