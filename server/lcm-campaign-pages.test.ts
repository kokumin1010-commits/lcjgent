import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { __lcmCampaignTestUtils } from "./lcmRouter";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const validCampaign = {
  title: "新商品ライブ販売パートナー募集",
  summary: "公開用の募集概要",
  description: "ブランド公式キャンペーンの説明",
  heroImageUrl: "https://example.com/campaign.webp",
  commissionRateMin: 15,
  commissionRateMax: 25,
  discountRateMin: 5,
  discountRateMax: 10,
  rewardNotes: "消費税・送料を除く確定売上を対象とし、返品・取消分は対象外です。",
  trackingMethod: "coupon" as const,
  settlementTerms: "月末締め、返品確定後に翌月末支払です。",
  eligibility: "承認済みLCM会員で、配信前にブランドと日程確認できる方。",
  creativeGuidance: "使用場面と質感を実演してください。",
  prohibitedClaims: "未確認の効果効能を断定しないでください。",
  sampleAvailable: true,
  samplePolicy: "審査後、1名1点まで提供します。",
  applicationNotes: "希望媒体と配信予定日を連絡してください。",
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: new Date("2026-10-31T23:59:59.000Z"),
  productIds: [11, 12],
};

describe("LCM brand campaign pages", () => {
  it("validates percentage ranges, period order, samples, and product identifiers", () => {
    expect(__lcmCampaignTestUtils.campaignInput.safeParse(validCampaign).success).toBe(true);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, commissionRateMin: 30, commissionRateMax: 20 }).success).toBe(false);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, discountRateMax: 101 }).success).toBe(false);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, endsAt: validCampaign.startsAt }).success).toBe(false);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, samplePolicy: null }).success).toBe(false);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, productIds: [11, 0] }).success).toBe(false);
    expect(__lcmCampaignTestUtils.campaignInput.safeParse({ ...validCampaign, productIds: [11, 11] }).success).toBe(false);
  });

  it("requires complete commercial and creative conditions before publication", () => {
    expect(() => __lcmCampaignTestUtils.assertCampaignPublishable(validCampaign, 2)).not.toThrow();
    expect(() => __lcmCampaignTestUtils.assertCampaignPublishable({ ...validCampaign, settlementTerms: null }, 2)).toThrow("報酬条件、計測・確定条件、対象者、制作ガイド、NG表現");
    expect(() => __lcmCampaignTestUtils.assertCampaignPublishable(validCampaign, 0)).toThrow("公開中の商品を1つ以上");
  });

  it("classifies campaign periods deterministically", () => {
    const start = "2026-10-10T00:00:00.000Z";
    const end = "2026-10-20T00:00:00.000Z";
    expect(__lcmCampaignTestUtils.campaignPeriodState(start, end, Date.parse("2026-10-01T00:00:00.000Z"))).toBe("upcoming");
    expect(__lcmCampaignTestUtils.campaignPeriodState(start, end, Date.parse("2026-10-15T00:00:00.000Z"))).toBe("active");
    expect(__lcmCampaignTestUtils.campaignPeriodState(start, end, Date.parse("2026-10-21T00:00:00.000Z"))).toBe("ended");
    expect(__lcmCampaignTestUtils.campaignPeriodState(null, end)).toBe("undated");
  });

  it("keeps exact rates and settlement details out of anonymous public fields", () => {
    const router = read("server/lcmRouter.ts");
    const featureFlags = read("shared/lcmFeatureFlags.ts");
    const publicFields = router.slice(router.indexOf("const publicCampaignFields"), router.indexOf("async function getPublicCampaignProducts"));
    expect(featureFlags).toContain("LCM_CAMPAIGNS_ENABLED = false");
    expect(router).toContain("listPublicCampaigns: publicProcedure");
    expect(router).toContain("getPublicCampaign: publicProcedure");
    expect(router).toContain("getMemberCampaign: lcmMemberProcedure");
    expect(router).toContain("const campaigns = LCM_CAMPAIGNS_ENABLED");
    expect(router).toContain("? await db.select().from(lcmCampaigns)");
    expect(router).toContain("EXISTS (SELECT 1 FROM lcm_campaign_products cp INNER JOIN lcm_products p");
    expect(publicFields).toContain("startsAt: lcmCampaigns.startsAt");
    expect(__lcmCampaignTestUtils.campaignPublicFieldNames).toEqual([
      "id", "slug", "title", "summary", "description", "heroImageUrl", "startsAt", "endsAt",
      "publishedAt", "brandId", "brandSlug", "brandName", "brandLogoUrl",
    ]);
    expect(publicFields).not.toContain("sampleAvailable: lcmCampaigns.sampleAvailable");
    expect(publicFields).not.toContain("commissionRateMin");
    expect(publicFields).not.toContain("discountRateMin");
    expect(publicFields).not.toContain("settlementTerms");
    expect(publicFields).not.toContain("eligibility");
    expect(router).toContain("commissionRateMin: campaign.commissionRateMin");
    expect(router).toContain("settlementTerms: campaign.settlementTerms");
    expect(router).toContain("campaign.productCount > 0");
    expect(router).toContain("公開中の対象商品がありません");
  });

  it("returns only minimal shopping-card fields for products embedded in anonymous campaign payloads", () => {
    expect(__lcmCampaignTestUtils.campaignPublicProductFieldNames).toEqual([
      "id", "slug", "name", "category", "listPrice", "currency", "taxMode", "sampleAvailable",
      "primaryImageUrl", "brandId", "brandSlug", "brandName", "brandLogoUrl",
    ]);
    for (const sensitive of ["description", "highlights", "thirtySecondPitch", "demoInstructions", "targetAudience", "prohibitedClaims", "commissionRate", "wholesalePrice", "sampleInstructions", "stockQuantity"]) {
      expect(__lcmCampaignTestUtils.campaignPublicProductFieldNames).not.toContain(sensitive);
    }
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("getPublicCampaignProducts(db, campaign.id, campaign.brandId)");
    expect(router).not.toContain("getCampaignProducts(db, campaign.id, campaign.brandId, true)");
  });

  it("scopes campaign writes to active brand owners and same-brand products", () => {
    const router = read("server/lcmRouter.ts");
    for (const procedure of ["createCampaign", "updateCampaign", "publishCampaign", "unpublishCampaign"]) expect(router).toContain(`${procedure}: lcmMemberProcedure`);
    expect(router).toContain("await requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId)");
    expect(router).toContain("await requireActiveBrandMember(ctx.lcmAccount.accountId, before.brandProfileId)");
    expect(router).toContain("eq(lcmProducts.brandProfileId, brandProfileId)");
    expect(router).toContain("選択した商品を確認できません");
    expect(router).toContain("公開中のキャンペーンには公開中の商品だけを選択してください");
    expect(router).toContain("キャンペーンには公開中の商品だけを選択してください");
    expect(router).toContain("productIds: beforeProducts.map");
    expect(router).toContain("productIds: input.data.productIds");
    expect(router).toContain("campaignAuditSnapshot(before)");
    expect(router).toContain("commissionRateMin: campaign.commissionRateMin");
  });

  it("preserves dormant moderation code while the OFF switch hides and blocks administrator campaign access", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain('action: "self_published"');
    expect(router).toContain('action: "self_unpublished"');
    expect(router).toContain('reviewCampaign: lcmAdminProcedure');
    const reviewCampaign = router.slice(router.indexOf("reviewCampaign:"), router.indexOf("reviewCompanyBrandClaims:"));
    expect(reviewCampaign).toContain("assertLcmCampaignsEnabled()");
    expect(router).toContain("const campaigns = LCM_CAMPAIGNS_ENABLED");
    expect(router).toContain("公開停止理由を入力してください");
    expect(router).toContain("運営により停止されたキャンペーンは、運営が再開するまで公開できません");
    expect(router).toContain("suspendedCampaignCount");
    expect(router).toContain("affectedRows(result) !== 1");
    expect(router).toContain("公開状態が変更されました。画面を更新して確認してください");
    expect(router).toContain("eq(lcmBrandProfiles.status, before.status)");
    expect(router).toContain("affectedRows(brandResult) !== 1");
    expect(router).toContain("ブランドの公開状態が変更されました。画面を更新して確認してください");
    expect(router).toContain("eq(lcmCreatorProfiles.status, before.status)");
    expect(router).toContain("プロフィールの公開状態が変更されました。画面を更新して確認してください");
    expect(router).toContain("eq(lcmProducts.status, before.status)");
    expect(router).toContain("商品の公開状態が変更されました。画面を更新して確認してください");
    expect(router).toContain('.limit(1).for("update")');
    expect(router).toContain('eq(lcmBrandMembers.status, "pending")');
    expect(router).toContain("affectedRows(selectedResult) !== 1");
    expect(router).toContain("ブランド管理申請の状態が変更されました。画面を更新して確認してください");
    expect(admin).toContain('...(LCM_CAMPAIGNS_ENABLED ? [{ key: "campaigns" as Tab');
    expect(admin).toContain('{LCM_CAMPAIGNS_ENABLED && tab === "campaigns"');
    expect(admin).toContain("キャンペーン公開・停止管理");
  });

  it("keeps the campaign implementation behind the temporary privacy switch", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    const market = read("client/src/pages/LcmMarket.tsx");
    const brand = read("client/src/pages/LcmBrand.tsx");
    const layout = read("client/src/components/lcm/LcmPublicLayout.tsx");
    const directory = read("client/src/pages/LcmCampaigns.tsx");
    const detail = read("client/src/pages/LcmCampaign.tsx");
    expect(manage).toContain("{LCM_CAMPAIGNS_ENABLED && <>");
    expect(market).not.toContain("listPublicCampaigns.useQuery");
    expect(market).not.toContain("liveCampaigns");
    expect(market).not.toContain("キャンペーンを見る");
    expect(brand).toContain("{LCM_CAMPAIGNS_ENABLED && (brand.campaigns || [])");
    expect(layout).not.toContain('<Link href="/lcm/campaigns">キャンペーンを探す</Link>');
    expect(manage).toContain('const steps = ["概要・期間", "報酬・割引", "計測・対象", "配信ガイド", "対象商品"]');
    expect(manage).toContain("キャンペーンを作成");
    expect(manage).toContain("すべて公開中である必要があります");
    expect(directory).toContain("条件を比べて、");
    expect(directory).toContain("報酬・割引率は会員限定");
    expect(detail).toContain("成果報酬率");
    expect(detail).toContain("購入者向け割引率");
    expect(directory).toContain("LCMが成果報酬・値引きを自動計算、支払、保証する機能ではありません");
    expect(detail).toContain("閲覧や商品選択だけで成果報酬・割引・サンプル提供が確定することはありません");
  });

  it("keeps campaign storage while returning 404 and removing campaign URLs from the active sitemap", () => {
    const schema = read("drizzle/lcmSchema.ts");
    const migration = read("drizzle/0152_lcm_campaign_pages.sql");
    const migrations = read("run-migrations.mjs");
    const upgrade = read("server/lcmMarketplaceUpgrade.ts");
    const seo = read("server/lcmSeo.ts");
    const app = read("client/src/App.tsx");
    expect(schema).toContain('mysqlTable("lcm_campaigns"');
    expect(schema).toContain('mysqlTable("lcm_campaign_products"');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `lcm_campaigns`");
    expect(migrations).toContain("0152_lcm_campaign_pages.sql");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS lcm_campaigns");
    expect(seo).toContain('app.get(["/lcm/campaigns", "/lcm/campaigns/:slug"]');
    expect(seo).toContain('return res.status(404).type("text/plain").send("Not Found")');
    expect(seo).toContain('if (LCM_CAMPAIGNS_ENABLED) publicLcmRoutes.push("/lcm/campaigns", "/lcm/campaigns/:slug")');
    expect(seo).toContain("...(LCM_CAMPAIGNS_ENABLED ? [");
    expect(seo).toContain('"@type": "Event"');
    expect(seo).toContain("/lcm/campaigns/${encodeURIComponent(campaign.slug)}");
    expect(app).toContain('{LCM_CAMPAIGNS_ENABLED && <Route path="/lcm/campaigns/:slug" component={LcmCampaign} />}');
    expect(app).toContain('{LCM_CAMPAIGNS_ENABLED && <Route path="/lcm/campaigns" component={LcmCampaigns} />}');
  });
});
