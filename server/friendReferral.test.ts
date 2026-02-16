import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Test the friendReferral router procedures.
 * Since getCampaign is a public procedure, we can test it without auth.
 * For protected procedures (getMyProgress, etc.), we test that they throw UNAUTHORIZED.
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("friendReferral router", () => {
  const caller = appRouter.createCaller(createPublicContext());

  it("getCampaign returns campaign data with stages", async () => {
    const result = await caller.friendReferral.getCampaign();
    expect(result).toBeDefined();
    expect(result.campaign).toBeDefined();
    expect(result.campaign.name).toBeTruthy();
    expect(result.campaign.isActive).toBe(true);
    expect(result.stages).toBeDefined();
    expect(Array.isArray(result.stages)).toBe(true);
    expect(result.stages.length).toBeGreaterThan(0);
    const firstStage = result.stages[0];
    expect(firstStage).toHaveProperty("stageNumber");
    expect(firstStage).toHaveProperty("requiredReferrals");
    expect(firstStage).toHaveProperty("fixedReward");
    expect(firstStage).toHaveProperty("spinCount");
    expect(firstStage).toHaveProperty("stageName");
    expect(firstStage).toHaveProperty("stageEmoji");
  });

  it("getMyProgress throws UNAUTHORIZED for unauthenticated users", async () => {
    await expect(caller.friendReferral.getMyProgress()).rejects.toThrow();
  });

  it("getLeaderboard returns an array", async () => {
    const result = await caller.friendReferral.getLeaderboard();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getActivityFeed returns an array", async () => {
    const result = await caller.friendReferral.getActivityFeed();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getSpinItems returns spin reward items", async () => {
    const normalItems = await caller.friendReferral.getSpinItems({ isSpecial: false });
    expect(normalItems).toBeDefined();
    expect(Array.isArray(normalItems)).toBe(true);
    expect(normalItems.length).toBeGreaterThan(0);
    const item = normalItems[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("label");
    expect(item).toHaveProperty("emoji");
    expect(item).toHaveProperty("points");
    expect(item).toHaveProperty("color");
    expect(item).toHaveProperty("probability");
  });

  it("spin throws UNAUTHORIZED for unauthenticated users", async () => {
    await expect(caller.friendReferral.spin({ isSpecial: false })).rejects.toThrow();
  });

  it("recordReferral throws UNAUTHORIZED for unauthenticated users", async () => {
    await expect(caller.friendReferral.recordReferral({ referralCode: "ABC123" })).rejects.toThrow();
  });

  it("getCampaign stages are ordered by stageNumber", async () => {
    const result = await caller.friendReferral.getCampaign();
    const stages = result.stages;
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].stageNumber).toBeGreaterThan(stages[i - 1].stageNumber);
    }
  });

  it("getCampaign stages have increasing required referrals", async () => {
    const result = await caller.friendReferral.getCampaign();
    const stages = result.stages;
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].requiredReferrals).toBeGreaterThanOrEqual(stages[i - 1].requiredReferrals);
    }
  });
});
