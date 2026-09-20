import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { issueCreatorSession } from "./brandDayPublicRouter";

describe("Brand Day creator registration auto-login", () => {
  it("stores only a hashed creator token and updates the last sign-in time", async () => {
    const query = vi.fn(async () => [[], []]);
    const before = Date.now();

    const session = await issueCreatorSession({ query }, { eventId: 12, accountId: 34 });

    expect(session.token.length).toBeGreaterThan(20);
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 12 * 60 * 60 * 1000 - 1_000);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("INSERT INTO brand_day_creator_sessions");
    expect(query.mock.calls[0][1]).toEqual([
      12,
      34,
      createHash("sha256").update(session.token).digest("hex"),
      session.expiresAt,
    ]);
    expect(query.mock.calls[0][1]?.[2]).not.toBe(session.token);
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining("last_signed_in_at = NOW()"),
      [34],
    ]);
  });

  it("creates the account and creator session in the same entry transaction before setting the cookie", () => {
    const source = readFileSync(new URL("./brandDayPublicRouter.ts", import.meta.url), "utf8");
    const enterStart = source.indexOf("enter: publicProcedure");
    const creatorRouterStart = source.indexOf("export const brandDayCreatorRouter");
    const enterSource = source.slice(enterStart, creatorRouterStart);

    expect(enterSource).toContain("mutation(async ({ input, ctx })");
    expect(enterSource).toContain("await connection.beginTransaction()");
    expect(enterSource).toContain("const session = await issueCreatorSession(connection");
    expect(enterSource).toContain("await connection.commit()");
    expect(enterSource).toContain("await connection.rollback()");
    expect(enterSource.indexOf("issueCreatorSession(connection")).toBeLessThan(enterSource.indexOf("connection.commit()"));
    expect(enterSource.indexOf("connection.commit()" )).toBeLessThan(enterSource.indexOf("setCreatorSessionCookie(ctx"));
    expect(enterSource).toContain("authenticated: true as const");
  });

  it("navigates directly to the creator dashboard and skips a redundant login screen for an active session", () => {
    const entry = readFileSync(new URL("../client/src/pages/BrandDayEntry.tsx", import.meta.url), "utf8");
    const login = readFileSync(new URL("../client/src/pages/BrandDayCreatorLogin.tsx", import.meta.url), "utf8");
    const dashboard = readFileSync(new URL("../client/src/pages/BrandDayCreatorDashboard.tsx", import.meta.url), "utf8");

    expect(entry).toContain('onSuccess: () => navigate(`/brand-day/${slug}/creator`, { replace: true })');
    expect(entry).toContain("エントリーして出場者ページへ");
    expect(entry).not.toContain("setComplete");
    expect(entry).not.toContain("独立した出場者ログインへ");

    expect(login).toContain("creatorPortal.me.useQuery");
    expect(login).toContain('staleTime: 0, refetchOnMount: "always"');
    expect(login).toContain("utils.brandDay.creatorPortal.me.setData({ slug }, account)");
    expect(login).toContain('if (!me.isFetching && me.data) navigate(`/brand-day/${slug}/creator`, { replace: true })');
    expect(login).toContain("if (event.isLoading || me.isLoading || me.isFetching || me.data) return <PortalLoading />");

    expect(dashboard).toContain("creatorPortal.me.setData({ slug }, null)");
    expect(dashboard).toContain('navigate(`/brand-day/${slug}/creator/login`, { replace: true })');
  });

  it("waits for server-side session deletion and clears the browser cookie on failure", () => {
    const source = readFileSync(new URL("./brandDayPublicRouter.ts", import.meta.url), "utf8");
    const logoutStart = source.indexOf("logout: publicProcedure");
    const dashboardStart = source.indexOf("dashboard: publicProcedure", logoutStart);
    const logoutSource = source.slice(logoutStart, dashboardStart);

    expect(logoutSource).toContain('await (await getBrandDayPool()).query(');
    expect(logoutSource).toContain('"DELETE FROM brand_day_creator_sessions WHERE token_hash = ?"');
    expect(logoutSource.match(/ctx\.res\.clearCookie\(CREATOR_COOKIE/g)).toHaveLength(2);
    expect(logoutSource).not.toContain(".catch(() => undefined)");
  });
});
