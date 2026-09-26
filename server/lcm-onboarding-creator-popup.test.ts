import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM self-onboarding and creator quick view", () => {
  it("shows the two main role cards with the existing workspace URLs and public product discovery", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    expect(market).toContain("届けたい商品と、");
    expect(market).toContain("伝えるライバー");
    expect(market).toContain("メーカー・ブランドの方");
    expect(market).toContain("ライブコマーサー・クリエイターの方");
    expect(market).toContain('href="/lcm/manage?workspace=brand"');
    expect(market).toContain('href="/lcm/manage?workspace=creator"');
    expect(market).toContain('document.getElementById("products")');
    expect(market).toContain("商品掲載を申し込む");
    expect(market).toContain("商品を探す");
    expect(market).toContain("ライブコマーサーを見る");
    expect(market).not.toContain("LCMで何をしますか？");
    expect(market).not.toContain("START WITH YOUR ROLE");
  });

  it("keeps the free-registration promise and routes brand provisioning to the existing protected flow", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    const manage = read("client/src/pages/LcmManage.tsx");
    expect(market).toContain("ブランド・商品登録は当面無料です");
    expect(market).toContain('href="/lcm/manage?workspace=brand"');
    expect(manage).toContain("新しいブランドは公式LINEから申請");
    expect(manage).toContain("LCJ公式LINEを開く");
    expect(manage).toContain("商品名・カテゴリ・概要・定価・メイン写真が揃うと、事前審査なしで公開できます");
  });

  it("opens public creator profiles in a reusable accessible dialog", () => {
    const quickView = read("client/src/components/lcm/LcmCreatorQuickViewDialog.tsx");
    expect(quickView).toContain("<Dialog open={open} onOpenChange={onOpenChange}>");
    expect(quickView).toContain("onEscapeKeyDown={() => onOpenChange(false)}");
    expect(quickView).toContain("本人の公開同意とLCM運営確認が完了した情報だけを表示します");
    expect(quickView).toContain("listPublicCreators.useQuery");
    expect(quickView).toContain("getPublicCreator.useQuery");
    expect(quickView).toContain("前の人");
    expect(quickView).toContain("次の人");
    expect(quickView).toContain('target="_blank"');
    expect(quickView).not.toMatch(/email|phone|postal|address/i);
  });

  it("keeps directory filters while replacing the card navigation with a dialog trigger", () => {
    const directory = read("client/src/pages/LcmCreatorDirectory.tsx");
    expect(directory).toContain("setQuickViewSlug(creator.slug)");
    expect(directory).toContain("プロフィールをポップアップで見る");
    expect(directory).toContain("<LcmCreatorQuickViewDialog");
    expect(directory).toContain("query: query.trim() || undefined");
    expect(directory).toContain("category: category === \"すべて\" ? undefined : category");
    expect(directory).not.toContain('<Link href={`/lcm/creators/${creator.slug}`}');
  });

  it("continues to return only published and consented public fields", () => {
    const router = read("server/lcmRouter.ts");
    const publicBlock = router.slice(router.indexOf("const publicCreatorFields"), router.indexOf("const publicProductFields"));
    expect(router).toContain('eq(lcmCreatorProfiles.status, "published")');
    expect(router).toContain("isNotNull(lcmCreatorProfiles.publicConsentAt)");
    expect(publicBlock).not.toMatch(/email|phone|address|postal/i);
  });
});
