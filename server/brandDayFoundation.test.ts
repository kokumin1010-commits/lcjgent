import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRAND_DAY_PAGE_KEY, brandDayEventUpdateInput, validateBrandDayWindow } from "./brandDayRouter";
import { assertSchemaOnlyMigration } from "./brandDaySchemaUpgrade";
import { countEventDaysInJst } from "./brandDayPublicRouter";
import {
  brandDayPrizeForRank,
  DRKOZU_BRAND_DAY_PROFILE,
  resolveBrandDayPrizeAwards,
  resolveBrandDayKeywords,
  sortBrandDaySalesRanking,
} from "../shared/brandDayCampaign";

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

  it("does not inject create defaults into partial event updates", () => {
    expect(brandDayEventUpdateInput.parse({
      eventId: 2,
      eventStartAt: Date.parse("2026-10-04T15:00:00.000Z"),
      eventEndAt: Date.parse("2026-10-12T15:00:00.000Z"),
    })).toEqual({
      eventId: 2,
      eventStartAt: Date.parse("2026-10-04T15:00:00.000Z"),
      eventEndAt: Date.parse("2026-10-12T15:00:00.000Z"),
    });
    expect(brandDayEventUpdateInput.parse({ eventId: 2 })).not.toHaveProperty("status");
    expect(brandDayEventUpdateInput.parse({ eventId: 2 })).not.toHaveProperty("timezone");
    expect(brandDayEventUpdateInput.parse({ eventId: 2 })).not.toHaveProperty("minimumStreamMinutes");
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

  it("defines Dr.Kozu ranking prizes and recognition aliases centrally", () => {
    expect(DRKOZU_BRAND_DAY_PROFILE.discountLabel).toBe("50% OFF");
    expect(DRKOZU_BRAND_DAY_PROFILE.prizes).toEqual([100_000, 50_000, 30_000]);
    expect(DRKOZU_BRAND_DAY_PROFILE.prizeTiers).toEqual([
      { minimumGmv: 1_000_000, prize: 100_000 },
      { minimumGmv: 500_000, prize: 50_000 },
      { minimumGmv: 300_000, prize: 30_000 },
    ]);
    expect(brandDayPrizeForRank("kozuday", 0)).toBe(100_000);
    expect(brandDayPrizeForRank("kozuday", 2)).toBe(30_000);
    expect(brandDayPrizeForRank("kgday-2026", 0)).toBeNull();
    expect(resolveBrandDayKeywords({
      slug: "kozuday",
      title: "kozu day",
      shortName: "kozu day",
      configuredKeywords: ["kozu day"],
    })).toEqual(expect.arrayContaining(["Dr.Kozu", "ヴァンパイアマスク", "セルピール", "ビューティソイプロテイン"]));
  });

  it("awards the highest available achieved tier in GMV ranking order", () => {
    expect(resolveBrandDayPrizeAwards("kozuday", [
      { brandGmv: 550_000 },
      { brandGmv: 450_000 },
      { brandGmv: 350_000 },
    ])).toEqual([50_000, 30_000, null]);
    expect(resolveBrandDayPrizeAwards("kozuday", [
      { brandGmv: 1_200_000 },
      { brandGmv: 900_000 },
      { brandGmv: 300_000 },
    ])).toEqual([100_000, 50_000, 30_000]);
    expect(resolveBrandDayPrizeAwards("kgday-2026", [{ brandGmv: 9_999_999 }])).toEqual([null]);
  });

  it("breaks equal GMV by valid stream time and then earlier achievement", () => {
    const ranked = sortBrandDaySalesRanking([
      { tiktokId: "late", brandGmv: 500_000, streamMinutes: 180, reachedAt: "2026-10-10T12:00:00.000Z" },
      { tiktokId: "more-time", brandGmv: 500_000, streamMinutes: 240, reachedAt: "2026-10-11T12:00:00.000Z" },
      { tiktokId: "early", brandGmv: 500_000, streamMinutes: 180, reachedAt: "2026-10-09T12:00:00.000Z" },
      { tiktokId: "lower-gmv", brandGmv: 300_000, streamMinutes: 999, reachedAt: "2026-10-05T12:00:00.000Z" },
    ]);
    expect(ranked.map(row => row.tiktokId)).toEqual(["more-time", "early", "late", "lower-gmv"]);
  });

  it("ships a dedicated Dr.Kozu page while preserving the KGDAY entry and upload flow", () => {
    const portalSource = readFileSync(new URL("../client/src/pages/BrandDayPortal.tsx", import.meta.url), "utf8");
    const cssSource = readFileSync(new URL("../client/src/pages/brand-day-portal.css", import.meta.url), "utf8");
    const entrySource = readFileSync(new URL("../client/src/pages/BrandDayEntry.tsx", import.meta.url), "utf8");
    const loginSource = readFileSync(new URL("../client/src/pages/BrandDayCreatorLogin.tsx", import.meta.url), "utf8");
    const dashboardSource = readFileSync(new URL("../client/src/pages/BrandDayCreatorDashboard.tsx", import.meta.url), "utf8");
    const rankingSource = readFileSync(new URL("../client/src/pages/BrandDayRanking.tsx", import.meta.url), "utf8");
    const publicRouterSource = readFileSync(new URL("./brandDayPublicRouter.ts", import.meta.url), "utf8");
    const adminRouterSource = readFileSync(new URL("./brandDayRouter.ts", import.meta.url), "utf8");

    expect(portalSource).toContain("<DrKozuPortal info={info} />");
    expect(portalSource).toContain("MAX 50% OFF");
    expect(portalSource).toContain("GMVランキング TOP3に賞金！");
    expect(portalSource).toContain('/brand-day/drkozu/drkozu-hero.webp');
    expect(portalSource).toContain('data-testid="drkozu-gmv-challenge-rules"');
    expect(portalSource).toContain("GMVランキング 公式ルール");
    expect(portalSource).toContain("2026年10月5日 00:00から");
    expect(portalSource).toContain("10月12日 23:59まで（日本時間）");
    expect(portalSource).toContain("各賞金枠の受賞者も1名のみ");
    expect(portalSource).toContain("1回のライブ配信が60分以上");
    expect(portalSource).toContain('href={`${base}/entry`}');
    expect(portalSource).toContain('href={`${base}/creator/login`}');
    expect(cssSource).toContain(".drkozu-page");
    expect(cssSource).toContain("--kozu-red:#a20d21");
    expect(entrySource).toContain("DRKOZU_BRAND_DAY_SLUG");
    expect(loginSource).toContain("DRKOZU_BRAND_DAY_SLUG");
    expect(dashboardSource).toContain("drkozu-creator-page");
    expect(dashboardSource).toContain("beginScreenshot.useMutation");
    expect(dashboardSource).toContain("confirmScreenshot.useMutation");
    expect(rankingSource).toContain("resolveBrandDayPrizeAwards");
    expect(rankingSource).toContain("主順位は累計有効GMVで決定");
    expect(rankingSource).toContain("対象期間内・1回60分以上・Dr.Kozu販売実績ありの全条件");
    expect(publicRouterSource.match(/resolveBrandDayKeywords/g)?.length).toBeGreaterThanOrEqual(3);
    expect(publicRouterSource).toContain("sortBrandDaySalesRanking(normalized)");
    expect(publicRouterSource).toContain("AND p.stream_minutes >= ?");
    expect(publicRouterSource).toContain("AND p.force_include_outside_window = 0");
    expect(publicRouterSource).not.toContain("OR p.force_include_outside_window = 1");
    expect(publicRouterSource).toContain("AND p.brand_gmv > 0");
    expect(adminRouterSource).toContain("p.stream_minutes >= e.minimum_stream_minutes");
    expect(adminRouterSource).toContain("AND p.force_include_outside_window = 0");
    expect(adminRouterSource).not.toContain("OR p.force_include_outside_window = 1");
    expect(adminRouterSource).toContain("AND p.brand_gmv > 0");
  });

  it("keeps the requested Dr.Kozu product order and links every product to TikTok Shop", () => {
    const portalSource = readFileSync(new URL("../client/src/pages/BrandDayPortal.tsx", import.meta.url), "utf8");
    expect(portalSource).toContain('const pickUpNames = ["ヴァンパイアマスク", "セルピール #クリスタル", "リペアセラム", "リペアクレンジング"]');
    expect(portalSource).toContain('const otherProductNames = ["リペアクリアウォッシュ", "ビューティソイプロテイン", "リペアフェイシャルマスク", "リペアリップセラム", "シンデレラマスク", "リジュショット", "バランスジェル", "フェイシャルネット"]');
    expect(portalSource).toContain('name: "ヴァンパイアマスク", meta: "6回分 · ¥15,950", copy: "パウダーとセラムを混ぜ、20分。自宅で楽しむサロン発想の集中ケア。", href: "https://vt.tiktok.com/ZS9AMbqhP7TG9-jpkVe/"');
    expect(portalSource).toContain('name: "セルピール #クリスタル", meta: "4回分 · ¥13,200", copy: "角質をやさしく整え、なめらかな触り心地と透明感のある印象へ。", href: "https://vt.tiktok.com/ZS9AMbCLVfyea-obQ1N/"');
    expect(portalSource).toContain('name: "リペアクリアウォッシュ", meta: "洗浄ケア", copy: "濃密な泡で摩擦を抑えながら、毎日の洗浄を心地よい美容習慣へ。", href: "https://vt.tiktok.com/ZS9AMbT2ysWqs-2Ucsi/"');
    expect(portalSource).toContain('name: "ビューティソイプロテイン", meta: "500g · ¥8,856", copy: "美容と健康を支えるたんぱく質を、おいしく続けやすい一杯に。", href: "https://vt.tiktok.com/ZS9AMb7Ns6CcM-JEj8s/"');
    expect(portalSource.match(/https:\/\/vt\.tiktok\.com\//g)).toHaveLength(12);
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

  it("counts the Dr.Kozu October 5 through October 12 campaign as eight JST days", () => {
    expect(countEventDaysInJst(
      Date.parse("2026-10-04T15:00:00.000Z"),
      Date.parse("2026-10-12T15:00:00.000Z"),
    )).toBe(8);
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
