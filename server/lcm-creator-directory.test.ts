import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM creator official pages and public directory", () => {
  it("stores creator public profiles separately from private Festival applications", () => {
    const schema = read("drizzle/lcmSchema.ts");
    const upgrade = read("server/lcmMarketplaceUpgrade.ts");
    expect(schema).toContain('"lcm_creator_profiles"');
    expect(schema).toContain('festivalAccountId: int("festivalAccountId")');
    expect(schema).toContain('publicConsentAt: timestamp("publicConsentAt")');
    expect(schema).toContain('metricsVerification: mysqlEnum("metricsVerification", ["not_submitted", "self_reported", "evidence_submitted", "verified"])');
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS lcm_creator_profiles");
    expect(upgrade).toContain("UNIQUE KEY uq_lcm_creator_account (festivalAccountId)");
    expect(upgrade).toContain("creatorOnlyUpgrade");
    expect(upgrade).toContain('backupSkippedReason: "additive empty table only"');
    expect(upgrade).toContain("lcm_creator_profiles was not created empty");
  });

  it("reuses an eligible LCF liver account but keeps public submission explicit", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(router).toContain("getLiverAccountDefaults");
    expect(router).toContain('input.memberType === "liver"');
    expect(router).toContain('"liver_account_activated"');
    expect(router).toContain("publicConsent: z.literal(true)");
    expect(router).toContain("本人の公開同意を確認できません");
    expect(manage).toContain("LCFライバーアカウント連携済み");
    expect(manage).toContain("公式プロフィールの作成とサンプル申請");
  });

  it("publishes only approved and consented fields without private contact data", () => {
    const router = read("server/lcmRouter.ts");
    const publicBlock = router.slice(router.indexOf("const publicCreatorFields"), router.indexOf("const publicProductFields"));
    expect(router).toContain("listPublicCreators: publicProcedure");
    expect(router).toContain("getPublicCreator: publicProcedure");
    expect(router).toContain('eq(lcmCreatorProfiles.status, "published")');
    expect(router).toContain("isNotNull(lcmCreatorProfiles.publicConsentAt)");
    expect(publicBlock).not.toMatch(/email|phone|address|postal/i);
  });

  it("provides self-editing, image upload and explicit review submission", () => {
    const router = read("server/lcmRouter.ts");
    const workspace = read("client/src/components/lcm/LcmCreatorWorkspace.tsx");
    expect(router).toContain("saveCreatorProfile: lcmMemberProcedure");
    expect(router).toContain("submitCreatorProfile: lcmMemberProcedure");
    expect(router).toContain("uploadCreatorImage: lcmMemberProcedure");
    expect(router).toContain("imageMatchesMime");
    expect(router).toContain('nullablePlatformUrl("TikTok", ["tiktok.com"])');
    expect(workspace).toContain("本人が管理します");
    expect(workspace).toContain("公開審査へ提出");
    expect(workspace).toContain("メール、電話、住所、申込原文は公開されません");
  });

  it("lets operations review, suspend and notify the creator with audit history", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain("reviewCreatorProfile: lcmAdminProcedure");
    expect(router).toContain('["submitted", "rejected", "published", "suspended"].includes(before.status)');
    expect(router).toContain('entityType: "creator_profile"');
    expect(router).toContain("【LCM】ライバー公式ページ審査結果");
    expect(admin).toContain('key: "creators"');
    expect(admin).toContain("ライバー公式ページ審査");
    expect(admin).toContain("実績確認＋公開");
    expect(admin).toContain("公開停止");
  });

  it("provides crawlable directory and Person SEO only for public profiles", () => {
    const app = read("client/src/App.tsx");
    const seo = read("server/lcmSeo.ts");
    const directory = read("client/src/pages/LcmCreatorDirectory.tsx");
    const profile = read("client/src/pages/LcmCreatorProfile.tsx");
    expect(app).toContain('path="/lcm/creators"');
    expect(app).toContain('path="/lcm/creators/:slug"');
    expect(read("client/src/pages/LcmMarket.tsx")).toContain("ライバーを公式ページから探す");
    expect(seo).toContain('"/lcm/creators"');
    expect(seo).toContain("lcmCreatorProfiles.publicConsentAt");
    expect(seo).toContain('"@type": "Person"');
    expect(seo).toContain("/lcm/creators/${encodeURIComponent(creator.slug)}");
    expect(directory).toContain("本人同意＋運営確認後に公開");
    expect(directory).toContain("公開プロフィールが0件という意味ではありません");
    expect(profile).toContain("本人公開同意済み");
    expect(profile).not.toContain("aggregateRating");
  });
});
