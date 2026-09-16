import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFestivalPortalDefaultPath } from "./festivalAuthRouter";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("LCF / LCM common account registration and routing", () => {
  it("allows account registration without creating an event application or ticket", () => {
    const auth = read("server/festivalAuthRouter.ts");
    const registerBlock = auth.slice(auth.indexOf("register: publicProcedure"), auth.indexOf("login: publicProcedure"));
    expect(auth).toContain("register: publicProcedure");
    expect(auth).toContain('purpose: z.enum(["company", "creator", "event"])');
    expect(auth).toContain("termsAccepted: z.literal(true)");
    expect(registerBlock).toContain('min(6, "パスワードは6文字以上で入力してください")');
    expect(auth).toContain("applicationId: null");
    expect(auth).toContain('action: "self_registered"');
    expect(auth).toContain("applicationCreated: false");
    expect(registerBlock).toContain("await db.transaction(async (tx: any) =>");
    expect(registerBlock).toContain("await tx.insert(lcmMemberships).values({");
    expect(registerBlock).toContain('status: "approved"');
    expect(registerBlock).not.toMatch(/festivalCompanyApplications|festivalLiverApplications|festivalGeneralApplications|lcfTickets/);
  });

  it("keeps account types compatible while presenting user-facing purposes", () => {
    const auth = read("server/festivalAuthRouter.ts");
    expect(auth).toContain('input.purpose === "company" ? "company"');
    expect(auth).toContain('input.purpose === "creator" ? "liver"');
    expect(auth).toContain('throw new TRPCError({ code: "CONFLICT", message: "このメールアドレスは登録済みです。ログインしてください。" })');
    expect(auth).toContain("hashPassword(input.password)");
  });

  it("routes one role directly and multiple roles to the common mypage", () => {
    const auth = read("server/festivalAuthRouter.ts");
    const login = read("client/src/pages/LcfLogin.tsx");
    expect(auth).toContain('roles.brand && roles.creator');
    expect(auth).toContain('? "/lcf/mypage"');
    expect(auth).toContain('? "/lcm/manage?workspace=brand"');
    expect(auth).toContain('? "/lcm/manage?workspace=creator"');
    expect(login).toContain("data.portal?.defaultPath");
    expect(login).toContain("data.portal.defaultPath");
    expect(resolveFestivalPortalDefaultPath({ event: true, brand: true, creator: false })).toBe("/lcm/manage?workspace=brand");
    expect(resolveFestivalPortalDefaultPath({ event: true, brand: false, creator: true })).toBe("/lcm/manage?workspace=creator");
    expect(resolveFestivalPortalDefaultPath({ event: true, brand: true, creator: true })).toBe("/lcf/mypage");
    expect(resolveFestivalPortalDefaultPath({ event: true, brand: false, creator: false })).toBe("/lcf/mypage");
  });

  it("offers all three registration purposes on the common login page", () => {
    const login = read("client/src/pages/LcfLogin.tsx");
    expect(login).toContain("企業・ブランド");
    expect(login).toContain("ライブコマーサー");
    expect(login).toContain("イベント参加・情報閲覧");
    expect(login).toContain("イベント申込・QRは自動作成されません");
    expect(login).toContain("共通アカウントを作成");
    expect(login).toContain("英字と数字を含む6文字以上");
    expect(login).toContain("searchParams.get('mode') === 'register'");
  });

  it("shows login before authentication and mypage after authentication", () => {
    const secondEdition = read("client/src/pages/LcfSecondEdition.tsx");
    const layout = read("client/src/components/lcm/LcmPublicLayout.tsx");
    expect(secondEdition).toContain('const memberLabel = me.data ? "マイページ" : "ログイン"');
    expect(layout).toContain('<LogIn className="mr-1.5 h-4 w-4" />ログイン');
  });

  it("redirects protected pages directly to the common login", () => {
    const eventMypage = read("client/src/pages/LcfMypage.tsx");
    const lcmManage = read("client/src/pages/LcmManage.tsx");
    expect(eventMypage).toContain("window.location.replace('/lcf/login?return=%2Flcf%2Fmypage')");
    expect(lcmManage).toContain("window.location.replace(buildFestivalLoginUrl(window.location.pathname + window.location.search))");
    expect(lcmManage).not.toContain("LCFログインが必要です");
  });
});
