import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFestivalLoginUrl, getRequestedFestivalWorkspace, getSafeFestivalReturn } from "../client/src/lib/festivalPortal";

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

  it("presents LCF and LCM as one account instead of a second login", () => {
    const login = read("client/src/pages/LcfLogin.tsx");
    const bootstrap = read("client/src/main.tsx");
    const lcmLayout = read("client/src/components/lcm/LcmPublicLayout.tsx");
    expect(login).toContain("LCF・LCM 共通ログイン");
    expect(login).toContain("LCFで登録した同じメールアドレスとパスワード");
    expect(bootstrap).toContain("buildFestivalLoginUrl(window.location.pathname + window.location.search)");
    expect(lcmLayout).toContain("マイページ");
    expect(lcmLayout).not.toContain("マイLCM");
    expect(lcmLayout).not.toContain("共通マイページ");
    expect(lcmLayout).not.toContain("共通ログイン");
    expect(lcmLayout).toContain('href="/lcf/mypage"');
  });

  it("derives brand and creator roles independently without rewriting the primary account type", () => {
    const router = read("server/lcmRouter.ts");
    expect(router).toContain("const companyAccountDefaults = await getCompanyAccountDefaults");
    expect(router).toContain("const liverAccountDefaults = await getLiverAccountDefaults");
    expect(router).toContain('notInArray(festivalCompanyApplications.status, ["rejected", "cancelled"])');
    expect(router).toContain("roles: {");
    expect(router).toContain("brand: Boolean(companyAccountDefaults");
    expect(router).toContain("creator: Boolean(liverAccountDefaults");
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
    expect(navigation).toContain("イベント・QR");
    expect(navigation).toContain('label: "ブランド"');
    expect(navigation).toContain("ライブコマーサー");
    expect(eventPage).toContain('active="event"');
    expect(eventPage).toContain("見る展示会から、売る展示会へ。");
    expect(eventPage).toContain("東京都立産業貿易センター浜松町館 2階展示室");
    expect(eventPage).not.toContain("CountdownTimer");
    expect(marketPage).toContain('requestedWorkspace === "creator"');
    expect(marketPage).toContain('requestedWorkspace === "brand"');
    expect(marketPage).toContain("LCFの企業申込とライバー申込を確認しました");
  });
});
