import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LCM_SAMPLE_TRANSITIONS, LCM_WHOLESALE_TRANSITIONS } from "./lcmRouter";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM marketplace foundation", () => {
  it("defines separate auditable marketplace tables without modifying legacy application tables", () => {
    const schema = read("drizzle/lcmSchema.ts");
    for (const table of ["lcm_memberships", "lcm_brand_profiles", "lcm_brand_members", "lcm_products", "lcm_creator_profiles", "lcm_sample_requests", "lcm_wholesale_inquiries", "lcm_audit_logs"]) {
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
    expect(upgrade).toContain("pre-lcm-marketplace-v2-creator-directory");
    expect(upgrade).toContain("post-lcm-marketplace-v2-creator-directory");
    expect(upgrade).toContain("beforeCounts");
    expect(upgrade).toContain("afterCounts");
    expect(read("server/_core/index.ts")).toContain("await runLcmMarketplaceUpgradeSetup()");
  });

  it("keeps public catalogue fields separate from approved-member wholesale data", () => {
    const router = read("server/lcmRouter.ts");
    const publicFields = router.slice(router.indexOf("const publicProductFields"), router.indexOf("export const lcmRouter"));
    expect(router).toContain("listPublicBrands: publicProcedure");
    expect(router).toContain("listPublicProducts: publicProcedure");
    expect(router).toContain("getPublicProduct: publicProcedure");
    expect(router).toContain("getMemberProduct: lcmMemberProcedure");
    expect(publicFields).toContain("listPrice: lcmProducts.listPrice");
    expect(publicFields).toContain("sampleAvailable: lcmProducts.sampleAvailable");
    expect(publicFields).not.toContain("wholesalePrice");
    expect(publicFields).not.toContain("commissionRate");
    expect(publicFields).not.toContain("sampleInstructions");
    expect(publicFields).not.toContain("stockQuantity");
    expect(router).toContain("wholesalePrice: lcmProducts.wholesalePrice");
    expect(router).toContain("sampleInstructions: lcmProducts.sampleInstructions");
    expect(router).toContain("stockQuantity: lcmProducts.stockQuantity");
    expect(router).toContain("eq(lcmProducts.status, \"published\")");
    expect(router).toContain("eq(lcmBrandProfiles.status, \"published\")");
  });

  it("presents public list prices in a shopping-style catalogue without fake commerce signals", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    const brand = read("client/src/pages/LcmBrand.tsx");
    expect(market).toContain("商品写真と定価は誰でも閲覧できます");
    expect(market).toContain("grid grid-cols-2");
    expect(market).toContain("formatListPrice(item.listPrice, item.taxMode)");
    expect(market).toContain("取引条件は会員限定");
    expect(market).toContain("NEW_PRODUCT_WINDOW_DAYS = 60");
    expect(market).toContain("配信情報あり");
    expect(market).toContain("isNewProduct(item.publishedAt)");
    expect(market).toContain("hasLiveReadyInformation(item)");
    expect(market).toContain("第1回LCF掲載");
    expect(brand).toContain("定価は公開、取引条件は会員限定");
    expect(brand).toContain("formatListPrice(item.listPrice, item.taxMode)");
    expect(market).not.toMatch(/残り\d+|購入者\d+|タイムセール|割引率|レビュー\d+/);
  });

  it("keeps product layouts readable when an image cannot be loaded", () => {
    const image = read("client/src/components/lcm/LcmProductImage.tsx");
    expect(image).toContain('onError={() => setFailed(true)}');
    expect(image).toContain("画像を表示できません");
    for (const page of ["LcmMarket.tsx", "LcmBrand.tsx", "LcmProduct.tsx", "LcmManage.tsx"]) {
      expect(read(`client/src/pages/${page}`)).toContain("LcmProductImage");
    }
  });

  it("uses the common login return path before exposing protected trade actions", () => {
    const product = read("client/src/pages/LcmProduct.tsx");
    expect(product).toContain('buildFestivalLoginUrl(samplePath)');
    expect(product).toContain('buildFestivalLoginUrl(wholesalePath)');
    expect(product).toContain("定価・参考小売価格");
    expect(product).toContain("会員限定の取引条件");
    expect(product).toContain("commissionRate");
    expect(product).toContain("LCM内で注文・決済は確定せず");
  });

  it("requires approved LCF membership and explicit brand ownership for protected actions", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("verifyFestivalUserRequest");
    expect(router).toContain("membership.status !== \"approved\"");
    expect(router).toContain("requireActiveBrandMember");
    expect(router).toContain("このブランドの下書きを編集する権限がありません");
    expect(router).toContain("この操作は運営の正式承認後に利用できます");
    expect(router).toContain("termsAccepted: z.literal(true)");
  });

  it("reuses an existing LCF company account without creating another login while keeping brand claims reviewed", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(router).toContain("getCompanyAccountDefaults");
    expect(router).toContain('notInArray(festivalCompanyApplications.status, ["rejected", "cancelled"])');
    expect(router).toContain('const linkedCompanyAccount = (Boolean(companyDefaults) || ctx.lcmAccount.accountType === "company")');
    expect(router).toContain("requireBrandEligibility");
    expect(router).toContain('"liver_account_activated" : "company_account_activated"');
    expect(router).toContain("claimCatalogBrand: lcmMemberProcedure");
    expect(router).toContain('status: "pending"');
    expect(manage).toContain("LinkedMembershipQuickStart");
    expect(manage).toContain("共通アカウントを確認しました");
    expect(manage).toContain("{workspaceName}マイページを開く");
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
    for (const route of ["/lcm", "/lcm/brands/:slug", "/lcm/products/:slug", "/lcm/creators", "/lcm/creators/:slug", "/lcm/manage", "/lcm/admin"]) {
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
    expect(manage).toContain('const steps = ["写真・基本", "商品の魅力", "販売先", "サンプル", "取引条件"]');
    expect(manage).toContain("定価／参考小売価格（公開必須）");
    expect(manage).toContain("配信で伝えやすいポイント");
    expect(manage).toContain("商品ギャラリー");
    expect(manage).toContain("imageUrls: [...new Set");
    expect(manage).toContain("公開準備 {readiness.completed}/5");
    expect(manage).toContain("この内容は公開カードや検索結果には表示されません");
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
    expect(router).toContain("【LCM】ブランド連携が正式承認されました");
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
    expect(seo.indexOf('app.get(["/lcm/manage", "/lcm/admin"]')).toBeLessThan(seo.indexOf('app.get(["/lcm", "/lcm/brands/:slug", "/lcm/products/:slug", "/lcm/creators", "/lcm/creators/:slug"]'));
    expect(seo).toContain("CollectionPage");
    expect(seo).toContain("BreadcrumbList");
    expect(seo).toContain("@type\": \"Product");
    expect(seo).toContain("lcf2026ExhibitorCatalogPages");
    expect(seo).toContain("catalog-${page.page}");
    expect(seo).not.toContain("aggregateRating");
  });
});
