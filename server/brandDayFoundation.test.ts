import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRAND_DAY_PAGE_KEY, validateBrandDayWindow } from "./brandDayRouter";
import { assertSchemaOnlyMigration } from "./brandDaySchemaUpgrade";
import { countEventDaysInJst } from "./brandDayPublicRouter";

describe("brand day native foundation", () => {
  it("uses the LCJ page permission key and registers the router", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const menuSource = readFileSync(new URL("../client/src/lib/adminMenuConfig.ts", import.meta.url), "utf8");
    expect(BRAND_DAY_PAGE_KEY).toBe("/master/brand-days");
    expect(routerSource).toContain("brandDay: brandDayRouter");
    expect(menuSource).toContain('path: "/master/brand-days"');
  });

  it("links the admin event hero to its native public brand day page", () => {
    const detailSource = readFileSync(new URL("../client/src/pages/BrandDayDetail.tsx", import.meta.url), "utf8");
    expect(detailSource).toContain('href={`/brand-day/${info.slug}`}');
    expect(detailSource).toContain('data-testid="brand-day-public-link"');
    expect(detailSource).toContain('公開ページを開く');
  });

  it("lets authorized operators change the event status from the detail page", () => {
    const detailSource = readFileSync(new URL("../client/src/pages/BrandDayDetail.tsx", import.meta.url), "utf8");
    expect(detailSource).toContain('data-testid="brand-day-status-editor"');
    expect(detailSource).toContain('id="brand-day-event-status"');
    expect(detailSource).toContain('{ value: "registration", label: "申込受付中" }');
    expect(detailSource).toContain('trpc.brandDay.updateEvent.useMutation');
    expect(detailSource).toContain('updateEventMutation.mutate({ eventId, status: selectedStatus })');
    expect(detailSource).toContain('保存すると公開エントリーフォームから実際の申込を受け付けます');
    expect(detailSource).toContain('href={`/brand-day/${info.slug}/entry`}');
  });

  it("keeps status updates permissioned, audited and aligned with public entry gates", () => {
    const adminRouterSource = readFileSync(new URL("./brandDayRouter.ts", import.meta.url), "utf8");
    const publicRouterSource = readFileSync(new URL("./brandDayPublicRouter.ts", import.meta.url), "utf8");
    expect(adminRouterSource).toContain('updateEvent: protectedProcedure');
    expect(adminRouterSource).toContain('await requireBrandDayPermission(ctx, "edit")');
    expect(adminRouterSource).toContain('action: "event_updated"');
    expect(publicRouterSource).toContain('event.status !== "registration" && event.status !== "active"');
    expect(publicRouterSource).toContain('registration_open_at');
    expect(publicRouterSource).toContain('registration_close_at');
  });

  it("keeps entrants completely outside the LCJ MALL admin authentication flow", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const entrySource = readFileSync(new URL("../client/src/pages/BrandDayEntry.tsx", import.meta.url), "utf8");
    const loginSource = readFileSync(new URL("../client/src/pages/BrandDayCreatorLogin.tsx", import.meta.url), "utf8");
    const detailSource = readFileSync(new URL("../client/src/pages/BrandDayDetail.tsx", import.meta.url), "utf8");
    const mainSource = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
    const publicRouterSource = readFileSync(new URL("./brandDayPublicRouter.ts", import.meta.url), "utf8");

    expect(appSource).toContain('<Route path="/brand-day/:slug/entry" component={BrandDayEntry} />');
    expect(appSource).toContain('<Route path="/brand-day/:slug/creator/login" component={BrandDayCreatorLogin} />');
    expect(appSource).toContain('<Route path="/brand-day/:slug/creator" component={BrandDayCreatorDashboard} />');
    expect(entrySource).toContain('data-testid="brand-day-public-account-notice"');
    expect(entrySource).toContain('管理者・スタッフアカウントは不要です');
    expect(loginSource).toContain('data-testid="brand-day-creator-login-notice"');
    expect(loginSource).toContain('data-testid="brand-day-creator-login-error"');
    expect(loginSource).toContain('role="alert"');
    expect(loginSource).not.toContain('toast.error(error.message)');
    expect(detailSource).toContain('data-testid="brand-day-external-access"');
    expect(detailSource).toContain('当前的 <code className="rounded bg-white/70 px-1 py-0.5">/master</code> 页面仅供管理员使用');
    expect(publicRouterSource).toContain('const CREATOR_COOKIE = "lcj_brand_day_creator_session"');
    expect(publicRouterSource).toContain('enter: publicProcedure');
    expect(publicRouterSource).toContain('login: publicProcedure');
    expect(publicRouterSource).toContain('ctx.res.cookie(CREATOR_COOKIE');
    expect(publicRouterSource).toContain('INSERT INTO brand_day_creator_accounts');
    expect(mainSource).toContain('const isPublicBrandDayPath');
    expect(mainSource).toContain('currentPath === "/s" || isPublicBrandDayPath(currentPath)');
    expect(mainSource).toContain('if (isBrandDayPublicPage)');
    expect(mainSource).toContain('headers.delete("Authorization")');
    expect(mainSource).toContain('headers.delete("X-LCJ-Finance-Session")');
  });

  it("rejects an event window whose end is not later than its start", () => {
    expect(() => validateBrandDayWindow({ eventStartAt: 2000, eventEndAt: 1000 })).toThrow(
      "終了日時は開始日時より後",
    );
  });

  it("accepts the KGDAY JST window stored as UTC timestamps", () => {
    expect(() => validateBrandDayWindow({
      eventStartAt: Date.parse("2026-09-08T00:00:00.000Z"),
      eventEndAt: Date.parse("2026-09-10T14:59:59.999Z"),
    })).not.toThrow();
  });

  it("does not create an empty DAY when the exclusive end is midnight", () => {
    expect(countEventDaysInJst(
      Date.parse("2026-09-08T00:00:00.000Z"),
      Date.parse("2026-09-10T15:00:00.000Z"),
    )).toBe(3);
  });

  it("defines every required native table in the migration", () => {
    const migration = readFileSync(new URL("../drizzle/0139_brand_day_native.sql", import.meta.url), "utf8");
    for (const table of [
      "brand_day_events",
      "brand_day_entries",
      "brand_day_creator_accounts",
      "brand_day_creator_sessions",
      "brand_day_performances",
      "brand_day_performance_products",
      "brand_day_audit_logs",
      "brand_day_migration_runs",
    ]) {
      expect(migration).toContain(`\`${table}\``);
    }
  });

  it("allows only CREATE-only startup schema migrations", () => {
    expect(() => assertSchemaOnlyMigration("CREATE TABLE IF NOT EXISTS safe_table (id INT);"))
      .not.toThrow();
    expect(() => assertSchemaOnlyMigration("DROP TABLE safe_table"))
      .toThrow("CREATE-only");
    expect(() => assertSchemaOnlyMigration("ALTER TABLE safe_table ADD COLUMN name TEXT"))
      .toThrow("CREATE-only");
    expect(() => assertSchemaOnlyMigration("CREATE TABLE IF NOT EXISTS safe_table (parent_id INT, updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE)"))
      .not.toThrow();
  });
});
