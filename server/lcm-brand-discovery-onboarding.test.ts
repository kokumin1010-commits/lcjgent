import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM brand discovery onboarding", () => {
  it("asks users to search before registering and routes confirmed brands to product creation", () => {
    const page = read("client/src/pages/LcmManage.tsx");
    expect(page).toContain("あなたのブランドは、<br className=\"hidden sm:block\" />すでにLCMにありますか？");
    expect(page).toContain("会社名・ブランド名・商品名で検索");
    expect(page).toContain("管理権限確認済みのブランド");
    expect(page).toContain('entry.member.status === "active"');
    expect(page).toContain("このブランドに商品を追加");
    expect(page).toContain("onAddProduct: (brandId: number) => void");
    expect(page).toContain("setShowProductEditor(true)");
  });

  it("keeps existing catalogue brands behind a management-rights check", () => {
    const page = read("client/src/pages/LcmManage.tsx");
    const router = read("server/lcmRouter.ts");
    expect(page).toContain("第1回LCFなどで掲載済み");
    expect(page).toContain("管理権限を確認して連携");
    expect(page).toContain('onClaim(identity.primaryBrandPage, "brand")');
    expect(router).toContain("claimCatalogSelection: lcmMemberProcedure");
    expect(router).toContain('status: "pending"');
    expect(router).toContain("第三者による権限取得を防ぐ運営確認が完了するまで");
    expect(page).toContain("管理権限が確認されるまで、ブランド情報・商品・公開設定は操作できません");
  });

  it("sends new brands to the official LINE dialog instead of the in-app create form", () => {
    const page = read("client/src/pages/LcmManage.tsx");
    const router = read("server/lcmRouter.ts");
    expect(page).toContain("新しいブランドは公式LINEから申請");
    expect(page).toContain("LCMでブランド登録を希望します");
    expect(page).toContain("LCJ公式LINEを開く");
    expect(page).toContain('const LCM_BRAND_LINE_URL = "https://lin.ee/W2HjMAJ"');
    expect(page).toContain("LINEを使えない場合はメール");
    expect(page).toContain("setShowNewBrandRequest(true)");
    expect(router).toContain("新しいブランドの登録はLCJ公式LINEで申請してください");
  });

  it("lets an LCF administrator issue a draft only to an active company or agency account", () => {
    const router = read("server/lcmRouter.ts");
    const admin = read("client/src/pages/LcmAdmin.tsx");
    expect(router).toContain("createBrandForMember: lcmAdminProcedure");
    expect(router).toContain('membership.status !== "approved"');
    expect(router).toContain("['company', 'agency'].includes(membership.memberType)");
    expect(router).toContain('action: "created_after_line_request"');
    expect(router).toContain('status: "draft"');
    expect(router).toContain('status: "active"');
    expect(router).toContain("同じ名前のLCMブランドがすでに存在します");
    expect(admin).toContain("LINE申請からブランド追加");
    expect(admin).toContain("公式LINEで確認したブランド名を入力してください");
  });

  it("keeps product self-publishing and the free scope after brand provisioning", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    const manage = read("client/src/pages/LcmManage.tsx");
    const router = read("server/lcmRouter.ts");
    const seo = read("server/lcmSeo.ts");
    expect(market).toContain("当面は登録無料");
    expect(market).toContain("ブランドを検索・申請する");
    expect(manage).toContain("商品名・カテゴリ・概要・定価・メイン写真が揃うと、事前審査なしで公開できます");
    expect(router).toContain("assertProductPublishable(product)");
    expect(router).toContain('action: "self_published"');
    expect(seo).toContain("新規ブランドはブランド検索後に公式LINEから申請します");
  });
});
