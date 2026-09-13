import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LCM_SAMPLE_TRANSITIONS, LCM_WHOLESALE_TRANSITIONS } from "./lcmRouter";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM marketplace foundation", () => {
  it("defines separate auditable marketplace tables without modifying legacy application tables", () => {
    const schema = read("drizzle/lcmSchema.ts");
    for (const table of ["lcm_memberships", "lcm_brand_profiles", "lcm_brand_members", "lcm_products", "lcm_sample_requests", "lcm_wholesale_inquiries", "lcm_audit_logs"]) {
      expect(schema).toContain(`"${table}"`);
    }
    expect(schema).toContain('wholesalePrice: decimal("wholesalePrice"');
    expect(schema).toContain('wholesaleMinQuantity: int("wholesaleMinQuantity"');
    expect(schema).toContain('sampleMonthlyLimit: int("sampleMonthlyLimit"');
    expect(schema).toContain('agreedAt: timestamp("agreedAt"');
  });

  it("creates the schema through the guarded idempotent startup upgrade", () => {
    const upgrade = read("server/lcmMarketplaceUpgrade.ts");
    expect(upgrade).toContain("lcm_marketplace_upgrade_runs");
    expect(upgrade).toContain("GET_LOCK");
    expect(upgrade).toContain("RELEASE_LOCK");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS");
    expect(upgrade).toContain("runVerifiedBackup");
    expect(upgrade).toContain("pre-lcm-marketplace-v1");
    expect(upgrade).toContain("post-lcm-marketplace-v1");
    expect(upgrade).toContain("beforeCounts");
    expect(upgrade).toContain("afterCounts");
    expect(read("server/_core/index.ts")).toContain("await runLcmMarketplaceUpgradeSetup()");
  });

  it("keeps public catalogue fields separate from approved-member wholesale data", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("listPublicBrands: publicProcedure");
    expect(router).toContain("listPublicProducts: publicProcedure");
    expect(router).toContain("getPublicProduct: publicProcedure");
    expect(router).toContain("getMemberProduct: lcmMemberProcedure");
    expect(router).toContain("wholesalePrice: lcmProducts.wholesalePrice");
    expect(router).toContain("eq(lcmProducts.status, \"published\")");
    expect(router).toContain("eq(lcmBrandProfiles.status, \"published\")");
  });

  it("requires approved LCF membership and explicit brand ownership for protected actions", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("verifyFestivalUserRequest");
    expect(router).toContain("membership.status !== \"approved\"");
    expect(router).toContain("requireActiveBrandMember");
    expect(router).toContain("このブランドを編集する権限がありません");
    expect(router).toContain("termsAccepted: z.literal(true)");
  });

  it("reuses an existing LCF company account without creating another login while keeping brand claims reviewed", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(router).toContain('ctx.lcmAccount.accountType === "company"');
    expect(router).toContain("getCompanyAccountDefaults");
    expect(router).toContain('status === "approved" ? "company_account_activated"');
    expect(router).toContain("claimCatalogBrand: lcmMemberProcedure");
    expect(router).toContain('status: "pending"');
    expect(manage).toContain("同じアカウントでLCMを始める");
    expect(manage).toContain("LCF企業アカウント連携済み");
    expect(manage).toContain("LCMを利用開始する");
  });

  it("enforces the complete sample and wholesale state machines", () => {
    expect(LCM_SAMPLE_TRANSITIONS.pending).toEqual(["approved", "rejected"]);
    expect(LCM_SAMPLE_TRANSITIONS.approved).toEqual(["preparing"]);
    expect(LCM_SAMPLE_TRANSITIONS.preparing).toEqual(["shipped"]);
    expect(LCM_SAMPLE_TRANSITIONS.shipped).toEqual(["delivered"]);
    expect(LCM_SAMPLE_TRANSITIONS.delivered).toEqual(["live_scheduled", "completed"]);
    expect(LCM_SAMPLE_TRANSITIONS.completed).toEqual([]);
    expect(LCM_WHOLESALE_TRANSITIONS.requested).toEqual(["reviewing", "accepted", "declined"]);
    expect(LCM_WHOLESALE_TRANSITIONS.accepted).toEqual(["negotiating", "completed"]);
    expect(LCM_WHOLESALE_TRANSITIONS.completed).toEqual([]);
  });

  it("limits duplicate samples, monthly allocation and cancellation timing", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("この商品には処理中の申請があります");
    expect(router).toContain("今月のサンプル受付上限に達しました");
    expect(router).toContain("審査開始後は取消できません");
    expect(router).toContain("最小発注数は");
  });

  it("validates uploaded image bytes, size and rate limits before storage", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("MAX_IMAGE_BYTES = 5 * 1024 * 1024");
    expect(router).toContain("assertUploadRateLimit");
    expect(router).toContain("imageMatchesMime");
    expect(router).toContain("JPEG・PNG・WebPだけアップロードできます");
  });

  it("provides public market, brand, product, member and operations routes", () => {
    const app = read("client/src/App.tsx");
    for (const route of ["/lcm", "/lcm/brands/:slug", "/lcm/products/:slug", "/lcm/manage", "/lcm/admin"]) {
      expect(app).toContain(`path="${route}"`);
    }
    expect(read("client/src/pages/LiveCommerceFestivalTop.tsx")).toContain("LCMで商品を探す");
    expect(read("client/src/pages/LcfAdmin.tsx")).toContain("LCM運営");
  });

  it("keeps the imported catalogue free from confirmed extraction artefacts", () => {
    const catalogue = read("client/src/data/lcf2026ExhibitorCatalog.ts");
    expect(catalogue).toContain('"name": "KYOGOKU JAPAN"');
    expect(catalogue).toContain('"price": "¥15,950（税込）"');
    expect(catalogue).not.toContain("KYOGOKU JAPANJP");
    expect(catalogue).not.toContain("¥1,5950");
  });

  it("implements self-managed brand and product publishing with explicit review", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(manage).toContain("ブランド情報を編集");
    expect(manage).toContain("商品を追加");
    expect(manage).toContain("運営確認へ提出");
    expect(manage).toContain("会員限定卸価格");
    expect(manage).toContain("月間サンプル上限");
    expect(manage).toContain("uploadImage");
  });

  it("implements sample and wholesale requests without collecting TikTok credentials", () => {
    const manage = read("client/src/pages/LcmManage.tsx");
    const router = read("server/lcmRouter.ts");
    expect(manage).toContain("サンプルを申請する");
    expect(manage).toContain("卸商談を申し込む");
    expect(manage).toContain("申請・商談履歴");
    expect(manage).toContain("サンプル・卸商談管理");
    expect(router).toContain("createSampleRequest");
    expect(router).toContain("createWholesaleInquiry");
    expect(router).not.toMatch(/tiktok.{0,30}(password|token|secret)/i);
  });

  it("sends workflow notifications and records delivery outcomes without email addresses in audit payloads", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("notifyLcm");
    expect(router).toContain("email_notification");
    expect(router).toContain("recipientCount: recipients.length");
    expect(router).not.toContain("after: { recipients");
    expect(router).toContain("【LCM】会員登録が承認されました");
    expect(router).toContain("ブランドページの作成・商品登録");
    expect(router).toContain("【LCM】ブランド管理申請が承認されました");
    expect(router).toContain("【LCM】ブランド審査結果");
    expect(router).toContain("【LCM】商品審査結果");
    expect(router).toContain("resendMembershipApprovalEmail: lcmAdminProcedure");
    expect(router).toContain("approval_email_resent");
    expect(read("client/src/pages/LcmAdmin.tsx")).toContain("対象者へメール通知しました");
    expect(read("client/src/pages/LcmAdmin.tsx")).toContain("承認メール再送");
    expect(read("client/src/pages/LcmManage.tsx")).toContain("LCMの利用を開始し、確認メールを送信しました");
  });

  it("keeps management private while publishing crawlable market SEO", () => {
    const server = read("server/_core/index.ts");
    const seo = read("server/lcmSeo.ts");
    expect(server).toContain("registerLcmSeoRoutes(app)");
    expect(server).toContain("getLcmSitemapEntries(baseUrl, lastmod)");
    expect(server).toContain("Disallow: /lcm/manage");
    expect(server).toContain("Disallow: /lcm/admin");
    expect(server).toContain("req.path.startsWith('/lcm/manage')");
    expect(seo).toContain('app.get(["/lcm/manage", "/lcm/admin"]');
    expect(seo).toContain('"X-Robots-Tag", "noindex, nofollow, noarchive"');
    expect(seo).toContain('robots: "noindex, nofollow, noarchive"');
    expect(seo.indexOf('app.get(["/lcm/manage", "/lcm/admin"]')).toBeLessThan(seo.indexOf('app.get(["/lcm", "/lcm/brands/:slug", "/lcm/products/:slug"]'));
    expect(seo).toContain("CollectionPage");
    expect(seo).toContain("BreadcrumbList");
    expect(seo).toContain("@type\": \"Product");
    expect(seo).toContain("lcf2026ExhibitorCatalogPages");
    expect(seo).toContain("catalog-${page.page}");
    expect(seo).not.toContain("aggregateRating");
  });
});
