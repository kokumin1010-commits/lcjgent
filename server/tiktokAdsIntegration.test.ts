import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIKTOK_ADS_BOOTSTRAP_SNAPSHOT } from "./tiktokAdsSnapshot";

const appSource = readFileSync("client/src/App.tsx", "utf8");
const menuSource = readFileSync("client/src/lib/adminMenuConfig.ts", "utf8");
const pageSource = readFileSync("client/src/pages/TikTokAdsIntegration.tsx", "utf8");
const storeSource = readFileSync("client/src/pages/StoreManagement.tsx", "utf8");
const routerSource = readFileSync("server/tiktokAdsRouter.ts", "utf8");
const connectorSource = readFileSync("server/tiktokAdsConnector.ts", "utf8");
const snapshotSource = readFileSync("server/tiktokAdsSnapshot.ts", "utf8");

describe("TikTok Ads independent integration page", () => {
  it("registers a dedicated page instead of replacing the existing ad dashboard", () => {
    expect(appSource).toContain('path="/master/tiktok-ads"');
    expect(appSource).toContain('<TikTokAdsIntegration />');
    expect(appSource).toContain('path="/master/ad-dashboard"');
    expect(menuSource).toContain('path: "/master/tiktok-ads"');
    expect(menuSource).toContain('labelZh: "TikTok广告连携"');
    expect(storeSource).toContain("setLocation('/master/tiktok-ads')");
  });

  it("keeps the initial API surface read-only and authenticated", () => {
    expect(routerSource).toContain("protectedProcedure.query");
    expect(routerSource).toContain("requireTikTokAdsPageAccess(ctx.user)");
    expect(routerSource).not.toContain(".mutation(");
    expect(pageSource).toContain('path: "/master/tiktok-ads"');
    expect(pageSource).toContain("enabled: canViewPage");
    expect(pageSource).toContain("只读安全模式");
    expect(pageSource).toContain("写入会直接影响预算和广告投放");
  });

  it("never exposes the token and uses the official server-side API origin", () => {
    expect(connectorSource).toContain('const TIKTOK_API_ORIGIN = "https://business-api.tiktok.com"');
    expect(connectorSource).toContain('"Access-Token": token');
    expect(pageSource).not.toContain("TIKTOK_BUSINESS_ACCESS_TOKEN");
    expect(pageSource).not.toContain("dashboard.error?.message");
    expect(snapshotSource).not.toMatch(/access[_-]?token/i);
    expect(snapshotSource).not.toMatch(/app[_-]?secret/i);
  });

  it("contains every verified LCJ-01 object in the bootstrap snapshot", () => {
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.campaigns).toHaveLength(16);
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.campaignMetrics).toHaveLength(16);
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.adgroups).toHaveLength(19);
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.ads).toHaveLength(48);
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.advertiser.name).toBe("LCJ-01");
    expect(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.lifetimeMetrics.spend).toBe("633173.000");
    const campaignTotals = TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.campaignMetrics.reduce((totals, item) => ({
      spend: totals.spend + Number(item.spend),
      impressions: totals.impressions + Number(item.impressions),
      clicks: totals.clicks + Number(item.clicks),
      conversion: totals.conversion + Number(item.conversion),
    }), { spend: 0, impressions: 0, clicks: 0, conversion: 0 });
    expect(campaignTotals.spend).toBe(Number(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.lifetimeMetrics.spend));
    expect(campaignTotals.clicks).toBe(Number(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.lifetimeMetrics.clicks));
    expect(campaignTotals.conversion).toBe(Number(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.lifetimeMetrics.conversion));
    // TikTok advertiser-level and campaign-level reports differ by one impression in the source response.
    expect(Math.abs(campaignTotals.impressions - Number(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.lifetimeMetrics.impressions))).toBeLessThanOrEqual(1);
  });
});
