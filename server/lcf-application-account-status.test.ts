import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFestivalApplicationAccountStatusIndex,
  type FestivalApplicationAccountStatus,
} from "./festivalRouter";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const account = (
  id: number,
  email: string,
  isActive: boolean,
  accountType: FestivalApplicationAccountStatus["accountType"] = "general",
): FestivalApplicationAccountStatus => ({
  id,
  email,
  accountType,
  isActive,
  lastLoginAt: null,
});

describe("LCF application account status", () => {
  it("matches account emails case-insensitively after trimming whitespace", () => {
    const index = buildFestivalApplicationAccountStatusIndex([
      account(10, "  USER@Example.COM  ", true, "liver"),
    ]);

    expect(index.get("user@example.com")).toMatchObject({
      id: 10,
      email: "user@example.com",
      accountType: "liver",
      isActive: true,
    });
  });

  it("prefers an active duplicate and otherwise keeps the newest account", () => {
    const index = buildFestivalApplicationAccountStatusIndex([
      account(20, "duplicate@example.com", false),
      account(18, "DUPLICATE@example.com", true, "company"),
      account(21, "duplicate@example.com", false, "liver"),
      account(30, "inactive@example.com", false),
      account(31, "INACTIVE@example.com", false, "company"),
    ]);

    expect(index.get("duplicate@example.com")).toMatchObject({ id: 18, isActive: true, accountType: "company" });
    expect(index.get("inactive@example.com")).toMatchObject({ id: 31, isActive: false, accountType: "company" });
  });

  it("ignores blank identifiers instead of treating them as one account", () => {
    const index = buildFestivalApplicationAccountStatusIndex([
      account(1, "", true),
      account(2, "   ", false),
    ]);

    expect(index.size).toBe(0);
  });

  it("uses one admin-only account index for company, liver and general application rows", () => {
    const router = read("server/festivalRouter.ts");
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(router).toContain("applicationAccountStatuses: festivalAdminProcedure.query");
    expect(router).toContain("buildFestivalApplicationAccountStatusIndex(accounts)");
    expect(admin).toContain("trpc.festival.applicationAccountStatuses.useQuery()");
    expect(admin.match(/<ApplicationAccountBadge/g)).toHaveLength(3);
    expect(admin).toContain('value="active">アカウントあり');
    expect(admin).toContain('value="inactive">アカウント停止中');
    expect(admin).toContain('value="missing">未作成');
  });

  it("exports and details the account state without modifying application or account data", () => {
    const router = read("server/festivalRouter.ts");
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(admin.match(/"ログインアカウント"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(admin).toContain("applicationAccountLabel: getApplicationAccountDisplayLabel(item.email)");
    expect(admin).toContain("disabled={accountStatusesLoading || accountStatusesFailed}");
    const endpointStart = router.indexOf("applicationAccountStatuses: festivalAdminProcedure.query");
    const endpointEnd = router.indexOf("// 企業申込み一覧", endpointStart);
    const endpoint = router.slice(endpointStart, endpointEnd);
    expect(endpoint).toContain(".from(festivalAccounts)");
    expect(endpoint).not.toMatch(/\.(insert|update|delete)\(/);
  });

  it("opens the matching account from an active or inactive badge and keeps missing accounts non-interactive", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");

    expect(admin).toContain('onOpenAccount(account.email)');
    expect(admin).toContain('setMainTab("accounts")');
    expect(admin).toContain('<AccountsPanel focusedEmail={focusedAccountEmail}');
    expect(admin).toContain('String(account.email || "").trim().toLowerCase() === normalizedFocusedEmail');
    expect(admin).toContain('全件表示に戻す');
    expect(admin).toContain('ring-cyan-400/40');
    expect(admin).toContain('aria-label={`${getApplicationAccountLabel(account)}：${account.email}のアカウント管理を開く`}');

    const missingStart = admin.indexOf('if (!account) return <Badge');
    const missingEnd = admin.indexOf('return (', missingStart);
    expect(admin.slice(missingStart, missingEnd)).not.toContain('<button');
  });
});
