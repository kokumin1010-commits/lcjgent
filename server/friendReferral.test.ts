import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve("server/routers.ts"), "utf8");
const page = readFileSync(resolve("client/src/pages/FriendReferralChallenge.tsx"), "utf8");

describe("friend referral campaign shutdown", () => {
  it("returns no active public campaign, ranking, activity, or spin rewards", () => {
    const start = router.indexOf("friendReferral: router({");
    const end = router.indexOf("// Blog & Auto Post", start);
    const source = router.slice(start, end);
    expect(source).toContain("getCampaign: publicProcedure.query(async () => {\n      return null;");
    expect(source).toContain("getLeaderboard: publicProcedure.query(async () => {\n      return [];");
    expect(source).toContain("getActivityFeed: publicProcedure.query(async () => {\n      return [];");
    expect(source).toContain("getSpinItems: publicProcedure");
  });

  it("rejects referral recording and spins before campaign or reward side effects", () => {
    expect(router).toContain("友達紹介ポイントは停止中です");
    expect(router).toContain("ポイント抽選は停止中です");
  });

  it("renders a Beauty Wallet migration notice instead of a playable campaign", () => {
    expect(page).toContain("Beauty Wallet");
    expect(page).toContain("新規ポイント付与は行いません");
    expect(page).not.toContain("recordReferral.useMutation");
    expect(page).not.toContain("friendReferral.spin.useMutation");
  });
});
