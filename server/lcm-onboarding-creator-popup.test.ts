import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM self-onboarding and creator quick view", () => {
  it("shows three role-first entry points with the existing workspace URLs", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    expect(market).toContain("LCMで何をしますか？");
    expect(market).toContain("ブランドと商品を");
    expect(market).toContain("自分で登録する。");
    expect(market).toContain('href="/lcm/manage?workspace=brand"');
    expect(market).toContain('href="/lcm/manage?workspace=creator"');
    expect(market).toContain('document.getElementById("products")');
    expect(market).toContain("無料でブランド登録を始める");
  });

  it("explains the free brand self-registration and self-publication path", () => {
    const market = read("client/src/pages/LcmMarket.tsx");
    for (const text of ["ブランドさんが、", "無料でブランドを登録する", "共通アカウント", "ブランド下書き", "商品を登録", "ブランドを公開", "商品を公開"]) {
      expect(market).toContain(text);
    }
    expect(market).toContain("会社名や氏名を再入力せず");
    expect(market).toContain("利用条件へ同意するとすぐに");
    expect(market).toContain("事前審査を待たずに自分で公開");
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
