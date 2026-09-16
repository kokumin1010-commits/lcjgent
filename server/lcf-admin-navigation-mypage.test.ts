import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF admin navigation and second-edition mypage entry", () => {
  it("keeps every admin tab addressable, reloadable and shareable by URL", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(admin).toContain('const MAIN_TAB_KEYS: MainTab[] = ["dashboard", "applications", "event", "sponsors", "accounts", "activity", "checkin", "booth", "gmv"]');
    expect(admin).toContain('const params = new URLSearchParams(window.location.search)');
    expect(admin).toContain('href={`/lcf/admin?tab=${tab.key}`}');
    expect(admin).toContain('window.addEventListener("popstate", syncFromUrl)');
    expect(admin).toContain('window.history.replaceState(window.history.state, "", "/lcf/admin?tab=dashboard")');
    expect(admin).toContain('setLocation(`/lcf/admin?tab=accounts&email=${encodeURIComponent(focusedEmail)}`)');
    expect(admin).toContain('key: "gmv" as MainTab');
  });

  it("sorts the full visible account collection with stable missing-login handling", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(admin).toContain('type AccountSort = "created_desc" | "created_asc" | "login_desc" | "login_asc" | "account_type"');
    expect(admin).toContain('const [accountSort, setAccountSort] = useState<AccountSort>("created_desc")');
    expect(admin).toContain('const filtered = normalizedFocusedEmail');
    expect(admin).toContain('return filtered.sort((a: any, b: any) => {');
    expect(admin).toContain('if (left === null) return 1');
    expect(admin).toContain('<SelectItem value="created_desc">新規登録順</SelectItem>');
    expect(admin).toContain('<SelectItem value="login_desc">最終ログインが新しい順</SelectItem>');
    expect(admin).toContain('<SelectItem value="account_type">会員種別順</SelectItem>');
  });

  it("offers the correct second-edition application from mypage without a duplicate CTA", () => {
    const mypage = read("client/src/pages/LcfMypage.tsx");
    const router = read("server/festivalRouter.ts");

    expect(mypage).toContain("history.eventYear === '2026-02'");
    expect(mypage).toContain("item.applicantType === 'company'");
    expect(mypage).toContain("item.applicantType === 'liver'");
    expect(mypage).toContain('href="/lcf/apply/company?edition=2"');
    expect(mypage).toContain('href="/lcf/apply/liver?edition=2"');
    expect(mypage).toContain('企業・ブランド申込済み');
    expect(mypage).toContain('ライブコマーサー申込済み');
    expect(mypage).toContain('secondCompanyApplication ? (');
    expect(mypage).toContain('secondLiverApplication ? (');
    expect(router).toContain("WHERE LOWER(email) = ?");
    expect(router).toContain("ORDER BY eventYear DESC, appliedAt ASC, applicationId ASC");
  });

  it("keeps first-edition history and existing QR data untouched", () => {
    const mypage = read("client/src/pages/LcfMypage.tsx");
    const router = read("server/festivalRouter.ts");

    expect(mypage).toContain('<QRCodeSVG value={ticket.ticketId}');
    expect(mypage).toContain('参加した回ごとに、申込・票券・受付・LIVE配信ブース予約の記録を保存します。');
    expect(router).toContain("COALESCE(applications.eventYear, '2026') AS eventYear");
    expect(router).toContain("FROM lcf_tickets tickets");
    expect(router).toContain("FROM lcf_booth_reservations");
  });
});
