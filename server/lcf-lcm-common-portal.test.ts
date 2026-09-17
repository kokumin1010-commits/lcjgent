import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFestivalLoginUrl,
  consumeFestivalAdminLcmReturn,
  getRequestedFestivalWorkspace,
  getSafeFestivalReturn,
  getSafeLcmAdminReturn,
  rememberFestivalAdminLcmReturn,
} from "../client/src/lib/festivalPortal";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("LCF / LCM common login and role workspaces", () => {
  it("accepts only same-site relative return paths", () => {
    expect(getSafeFestivalReturn("/lcm/manage?workspace=creator")).toBe("/lcm/manage?workspace=creator");
    expect(getSafeFestivalReturn("/lcf/mypage#tickets")).toBe("/lcf/mypage#tickets");
    expect(getSafeFestivalReturn("https://evil.example/path")).toBeNull();
    expect(getSafeFestivalReturn("//evil.example/path")).toBeNull();
    expect(getSafeFestivalReturn("/\\evil.example/path")).toBeNull();
    expect(getSafeFestivalReturn("/%5cevil.example/path")).toBeNull();
    expect(getSafeFestivalReturn("/%0d%0aLocation:%20https://evil.example")).toBeNull();
  });

  it("builds the single LCF login URL and parses only supported workspaces", () => {
    expect(buildFestivalLoginUrl("/lcm/manage?workspace=brand")).toBe("/lcf/login?return=%2Flcm%2Fmanage%3Fworkspace%3Dbrand");
    expect(buildFestivalLoginUrl("https://evil.example")).toBe("/lcf/login");
    expect(getRequestedFestivalWorkspace("event")).toBe("event");
    expect(getRequestedFestivalWorkspace("brand")).toBe("brand");
    expect(getRequestedFestivalWorkspace("creator")).toBe("creator");
    expect(getRequestedFestivalWorkspace("admin")).toBeNull();
  });

  it("recovers only the LCF administrator LCM route without exposing the internal login", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    expect(getSafeLcmAdminReturn("/lcm/admin?tab=claims")).toBe("/lcm/admin?tab=claims");
    expect(getSafeLcmAdminReturn("/lcm/manage?workspace=brand")).toBeNull();
    expect(getSafeLcmAdminReturn("//evil.example/lcm/admin")).toBeNull();
    expect(rememberFestivalAdminLcmReturn(storage, "/lcm/admin?tab=claims")).toBe(true);
    expect(consumeFestivalAdminLcmReturn(storage)).toBe("/lcm/admin?tab=claims");
    expect(consumeFestivalAdminLcmReturn(storage)).toBeNull();

    const lcfAdmin = read("client/src/pages/LcfAdmin.tsx");
    const lcmAdmin = read("client/src/pages/LcmAdmin.tsx");
    const internalLogin = read("client/src/pages/Login.tsx");
    expect(lcfAdmin).toContain("rememberFestivalAdminLcmReturn(window.sessionStorage, returnTo)");
    expect(lcfAdmin).toContain("'/lcm/admin?tab=claims'");
    expect(lcmAdmin).toContain("trpc.festivalAuth.me.useQuery");
    expect(lcmAdmin).toContain("enabled: isFestivalAdmin");
    expect(lcmAdmin).toContain("buildFestivalLoginUrl(returnTo)");
    expect(lcmAdmin).toContain("社内スタッフ用ログインは使用しません");
    expect(lcmAdmin).not.toContain('Link href="/login');
    expect(internalLogin).toContain("consumeFestivalAdminLcmReturn(window.sessionStorage)");
    expect(internalLogin).toContain("LCF管理者ログインへ移動しています");
  });

  it("keeps normal workspaces available while an administrator session is active", () => {
    const login = read("client/src/pages/LcfLogin.tsx");
    const auth = read("server/festivalAuthRouter.ts");
    const app = read("client/src/App.tsx");
    expect(login).toContain("data.portal?.defaultPath || '/lcf/mypage'");
    expect(auth).not.toContain('defaultPath: "/lcf/admin"');
    expect(app).toContain('<Route path="/lcf/mypage" component={LcfMypage} />');
    expect(app).toContain('<Route path="/lcm/manage" component={LcmManage} />');
    expect(app).toContain('<Route path="/lcf/admin" component={LcfAdmin} />');
    expect(app).toContain('<Route path="/lcm/admin" component={LcmAdmin} />');
  });

  it("opens product main images in an accessible modal preview", () => {
    const marketPage = read("client/src/pages/LcmManage.tsx");
    expect(marketPage).toContain("ProductImagePreview");
    expect(marketPage).toContain("メイン写真を拡大表示");
    expect(marketPage).toContain("DialogContent showCloseButton={false}");
    expect(marketPage).toContain("DialogClose");
    expect(marketPage).toContain("拡大メイン写真");
    expect(marketPage).toContain("画像を読み込めませんでした。");
    expect(marketPage).toContain("max-h-[calc(100dvh-10rem)]");
  });

  it("presents LCF and LCM as one account instead of a second login", () => {
    const login = read("client/src/pages/LcfLogin.tsx");
    const bootstrap = read("client/src/main.tsx");
    const lcmLayout = read("client/src/components/lcm/LcmPublicLayout.tsx");
    expect(login).toContain("LCF・LCM 共通ログイン");
    expect(login).toContain("1つのアカウントで、イベント・ブランド・ライブコマーサー");
    expect(login).toContain("新規登録");
    expect(bootstrap).toContain("buildFestivalLoginUrl(window.location.pathname + window.location.search)");
    expect(lcmLayout).toContain("マイページ");
    expect(lcmLayout).toContain("ログイン");
    expect(lcmLayout).not.toContain("マイLCM");
    expect(lcmLayout).not.toContain("共通マイページ");
    expect(lcmLayout).toContain('me.data.portal?.defaultPath || "/lcf/mypage"');
  });

  it("derives brand and creator roles independently without rewriting the primary account type", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("const companyAccountDefaults = await getCompanyAccountDefaults");
    expect(router).toContain("const liverAccountDefaults = await getLiverAccountDefaults");
    expect(router).toContain('notInArray(festivalCompanyApplications.status, ["rejected", "cancelled"])');
    expect(router).toContain("roles: {");
    expect(router).toContain('brand: Boolean(ctx.lcmAccount.accountType === "company" || companyAccountDefaults');
    expect(router).toContain('creator: Boolean(ctx.lcmAccount.accountType === "liver" || liverAccountDefaults');
    expect(router).toContain("requireBrandEligibility");
    expect(router).toContain("requireCreatorEligibility");
    expect(router).not.toContain('set({ accountType: "company"');
    expect(router).not.toContain('set({ accountType: "liver"');
  });

  it("keeps event, brand and creator pages visually separate and switchable", () => {
    const navigation = read("client/src/components/lcf/FestivalWorkspaceNav.tsx");
    const eventPage = read("client/src/pages/LcfMypage.tsx");
    const marketPage = read("client/src/pages/LcmManage.tsx");
    expect(navigation).toContain("マイページメニュー");
    expect(navigation).toContain("LCF参加・QR");
    expect(navigation).toContain('label: "LCMブランド・商品"');
    expect(navigation).toContain("LCM配信者プロフィール");
    expect(eventPage).toContain('active="event"');
    expect(eventPage).toContain("見る展示会から、売る展示会へ。");
    expect(eventPage).toContain("東京都立産業貿易センター浜松町館 2階展示室");
    expect(eventPage).not.toContain("CountdownTimer");
    expect(marketPage).toContain('requestedWorkspace === "creator"');
    expect(marketPage).toContain('requestedWorkspace === "brand"');
    expect(marketPage).toContain("企業・ブランドとライブコマーサーの両方を利用できます");
    expect(navigation).not.toContain('shortLabel: "ライバー"');
  });
});
