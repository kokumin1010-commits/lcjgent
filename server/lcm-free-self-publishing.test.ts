import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM free self-publishing with post-publication moderation", () => {
  it("starts a new membership immediately after terms acceptance while preserving administrator blocks", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain('const status = "approved" as const');
    expect(router).toContain('action: linkedExistingAccount ? (memberType === "liver" ? "liver_account_activated" : "company_account_activated") : "self_activated"');
    expect(router).toContain('existing?.status === "suspended" || existing?.status === "rejected"');
    expect(router).toContain("本人登録・利用条件同意により即時利用開始");
    expect(router).toContain("【LCM】無料利用を開始しました");
    expect(router).toContain("【LCM】会員利用を開始しました");
    expect(router).toContain("公開商品の検索、会員限定取引条件の確認");
  });

  it("self-publishes complete brands and products without a submitted review state", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("assertBrandPublishable(brand)");
    expect(router).toContain("assertProductPublishable(product)");
    expect(router).toContain('set({ status: "published", submittedAt: new Date(), publishedAt');
    expect(router).toContain('action: "self_published"');
    expect(router).toContain("先にブランドページを公開してください");
    expect(router).toContain("運営が再開するまで公開できません");
    expect(router).toContain('status: before.status, rejectionReason: before.status === "published" ? null');
  });

  it("lets confirmed brand owners unpublish products without deleting their data", () => {
    const router = read("server/lcmRouter.ts");
    const manage = read("client/src/pages/LcmManage.tsx");
    const procedure = router.slice(router.indexOf("unpublishProduct:"), router.indexOf("uploadImage:"));
    expect(procedure).toContain("requireActiveBrandMember");
    expect(procedure).toContain('product.status !== "published"');
    expect(procedure).toContain('.set({ status: "draft" })');
    expect(procedure).toContain('eq(lcmProducts.status, "published")');
    expect(procedure).toContain('action: "self_unpublished"');
    expect(procedure).toContain("db.transaction(async");
    expect(manage).toContain("公開を停止");
    expect(manage).toContain("商品データは削除せず、下書きとして保持します");
    expect(manage).toContain("utils.lcm.listPublicProducts.invalidate()");
    expect(manage).toContain("utils.lcm.getPublicProduct.invalidate()");
    expect(manage).toContain("utils.lcm.getPublicBrand.invalidate()");
    expect(manage).toContain("utils.lcm.publicStats.invalidate()");
  });

  it("keeps catalogue brand claims reviewed to prevent ownership takeover", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("lcmCatalogIdentities.find");
    expect(router).toContain("第1回LCF掲載済みです。本人のブランド検索から管理権限連携を行ってください");
    expect(router).toContain('claimStatus: "pending"');
    expect(router).toContain('status: "pending"');
    expect(router).toContain("既に管理されています");
    expect(router).toContain("第三者による権限取得を防ぐ運営確認が完了するまで");
  });

  it("routes new brands through LINE while keeping admin creation limits and duplicate protection", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("MAX_BRANDS_PER_ACCOUNT = 50");
    expect(router).toContain("MAX_PRODUCTS_PER_BRAND = 500");
    expect(router).toContain("新しいブランドの登録はLCJ公式LINEで申請してください");
    expect(router).toContain("createBrandForMember: lcmAdminProcedure");
    expect(router).toContain("同じ名前のLCMブランドがすでに存在します");
    expect(router).toContain("このアカウントはブランド登録上限に達しています");
    expect(router).toContain("1ブランドで登録できる商品数の上限");
  });

  it("supports reason-required suspension, admin restoration, cascading brand suspension, and audit logs", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain("非公開・停止理由を入力してください");
    expect(router).toContain('eq(lcmProducts.status, "published")');
    expect(router).toContain('action: input.status === "published" ? "republished_by_admin" : "suspended_by_admin"');
    expect(router).toContain("suspendedProductCount");
    expect(admin).toContain("会員をブロック");
    expect(admin).toContain("ブランドと公開商品を停止");
    expect(admin).toContain("運営として再公開");
    expect(admin).toContain("監査履歴");
  });

  it("states the free scope precisely and does not weaken creator or review verification", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    const manage = read("client/src/pages/LcmManage.tsx");
    const router = read("server/lcmRouter.ts");
    const seo = read("server/lcmSeo.ts");
    expect(market).toContain("ブランド・商品登録は当面無料です");
    expect(market).toContain("商品掲載を申し込む");
    expect(manage).toContain("ブランド・商品登録は当面無料");
    expect(seo).toContain("新規ブランドは公式LINEから申請できます");
    expect(router).toContain("本人の公開同意と運営確認後に行われます");
    expect(router).toContain("moderateProductReview: lcmAdminProcedure");
    expect(market).not.toMatch(/卸商談無料|サンプル配送無料|決済無料|永年無料/);
  });
});
