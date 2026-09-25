import { afterEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "./db";
import { lcmRouter } from "./lcmRouter";
import { LCM_CAMPAIGNS_ENABLED } from "../shared/lcmFeatureFlags";

describe("LCM campaign temporary privacy switch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns no public campaigns and rejects direct detail access without touching the database", async () => {
    expect(LCM_CAMPAIGNS_ENABLED).toBe(false);
    const getDb = vi.spyOn(dbModule, "getDb").mockRejectedValue(new Error("campaign privacy guard must run first"));
    const caller = lcmRouter.createCaller({ req: {}, res: {} } as any);

    await expect(caller.listPublicCampaigns({ limit: 6 })).resolves.toEqual([]);
    await expect(caller.getPublicCampaign({ slug: "hidden-campaign" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "キャンペーン機能は現在非公開です",
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects administrator campaign moderation before touching the database while campaigns are private", async () => {
    expect(LCM_CAMPAIGNS_ENABLED).toBe(false);
    const getDb = vi.spyOn(dbModule, "getDb").mockRejectedValue(new Error("campaign privacy guard must run first"));
    const caller = lcmRouter.createCaller({
      req: {},
      res: {},
      user: { id: 1, email: "admin@example.invalid", role: "admin" },
    } as any);

    await expect(caller.reviewCampaign({ id: 1, status: "published", reason: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "キャンペーン機能は現在非公開です",
    });
    expect(getDb).not.toHaveBeenCalled();
  });
});
