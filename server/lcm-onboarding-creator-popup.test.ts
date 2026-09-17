import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM self-onboarding and creator quick view", () => {
  it("shows three role-first entry points with the existing workspace URLs", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    expect(market).toContain("LCMで何をしますか？");
    expect(market).toContain("まずブランドを検索。");
    expect(market).toContain("そのまま商品登録へ。");
    expect(market).toContain('href="/lcm/manage?workspace=brand"');
    expect(market).toContain('href="/lcm/manage?workspace=creator"');
    expect(market).toContain('document.getElementById("products")');
    expect(market).toContain("ブランドを検索・申請する");
  });

  it("explains the free brand search, LINE request, and product self-publication path", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    for (const text of ["ブランドさんが、", "無料で参加できます。", "共通アカウント", "ブランドを検索", "連携またはLINE申請", "ブランドを完成", "商品を登録・公開"]) {
      expect(market).toContain(text);
    }
    expect(market).toContain("すでに管理ブランドがある方");
    expect(market).toContain("検索結果からブランドを選ぶと、すぐに商品登録へ進めます");
    expect(market).toContain("新規ブランドは公式LINEから申請します");
    expect(market).not.toContain("初回の会員確認後");
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
