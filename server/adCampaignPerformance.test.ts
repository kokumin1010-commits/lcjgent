import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Ad Campaign Performance APIs", () => {
  it("getAdCampaigns returns an array for a valid brandId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaigns({ brandId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAdCampaigns returns empty array for non-existent brand", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaigns({ brandId: 999999 });
    expect(result).toEqual([]);
  });

  it("getAdCampaignStats returns stats object with expected fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaignStats({ brandId: 1 });
    expect(result).toHaveProperty("campaignCount");
    expect(result).toHaveProperty("totalBudget");
    expect(result).toHaveProperty("totalSpend");
    expect(result).toHaveProperty("totalImpressions");
    expect(result).toHaveProperty("totalClicks");
    expect(result).toHaveProperty("totalGmv");
    expect(typeof result.campaignCount).toBe("number");
    expect(typeof result.totalBudget).toBe("number");
  });

  it("getAdCampaignStats returns zeros for non-existent brand", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaignStats({ brandId: 999999 });
    expect(result.campaignCount).toBe(0);
    expect(result.totalBudget).toBe(0);
    expect(result.totalSpend).toBe(0);
    expect(result.totalImpressions).toBe(0);
    expect(result.totalClicks).toBe(0);
    expect(result.totalGmv).toBe(0);
  });

  it("getAdCampaignDetail returns null for non-existent campaign", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaignDetail({ id: 999999 });
    expect(result).toBeNull();
  });

  it("getAdCampaigns includes metrics fields when campaigns exist", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.brand.getAdCampaigns({ brandId: 1 });
    if (result.length > 0) {
      const campaign = result[0];
      // メトリクスフィールドが含まれていることを確認
      expect(campaign).toHaveProperty("impressions");
      expect(campaign).toHaveProperty("clicks");
      expect(campaign).toHaveProperty("gmv");
      expect(campaign).toHaveProperty("adSpendActual");
      expect(campaign).toHaveProperty("roas");
      expect(typeof campaign.impressions).toBe("number");
      expect(typeof campaign.clicks).toBe("number");
      expect(typeof campaign.gmv).toBe("number");
    }
  });
});
