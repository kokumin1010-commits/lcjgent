import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTikTokAdsDashboard,
  getTikTokAdsWriteReadiness,
  requestTikTokAuthenticated,
  resetTikTokAdsConnectorCacheForTests,
  TikTokApiOperationError,
} from "./tiktokAdsConnector";

const originalToken = process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
const originalAdvertiserId = process.env.TIKTOK_BUSINESS_ADVERTISER_ID;
const originalWriteEnabled = process.env.TIKTOK_BUSINESS_WRITE_ENABLED;

function response(data: unknown, code = 0) {
  return Promise.resolve(new Response(JSON.stringify({ code, message: code === 0 ? "OK" : "FAILED", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

type ReportTarget = "lifetime" | "campaign" | "daily";

function createPaginationMetadataFetchMock(
  malformedTarget: ReportTarget,
  malformedPageInfo: Record<string, number> | null
) {
  const completeObjectPage = { page: 1, page_size: 1000, total_number: 1, total_page: 1 };
  const completeReportPage = { page: 1, page_size: 1000, total_number: 1, total_page: 1 };
  const withPage = (list: unknown[], target: ReportTarget, complete = completeReportPage) =>
    target === malformedTarget
      ? response(malformedPageInfo === null ? { list } : { list, page_info: malformedPageInfo })
      : response({ list, page_info: complete });
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/advertiser/info/")) {
      return response({ list: [{ advertiser_id: "123456789", name: "LIVE", country: "JP", currency: "JPY", timezone: "Asia/Tokyo", display_timezone: "Asia/Tokyo", status: "STATUS_ENABLE", role: "ROLE_CHILD_ADVERTISER" }] });
    }
    if (url.pathname.endsWith("/campaign/get/")) {
      return response({ list: [{ campaign_id: "c1", campaign_name: "live campaign", operation_status: "ENABLE", secondary_status: "CAMPAIGN_STATUS_ENABLE", objective_type: "TRAFFIC" }], page_info: completeObjectPage });
    }
    if (url.pathname.endsWith("/adgroup/get/") || url.pathname.endsWith("/ad/get/")) {
      return response({ list: [], page_info: { page: 1, page_size: 1000, total_number: 0, total_page: 1 } });
    }
    if (url.pathname.endsWith("/report/integrated/get/")) {
      const dimensions = JSON.parse(url.searchParams.get("dimensions") || "[]") as string[];
      if (dimensions.includes("stat_time_day")) {
        return withPage([{ dimensions: { campaign_id: "c1", stat_time_day: "2026-09-25 00:00:00" }, metrics: { spend: "1" } }], "daily");
      }
      if (url.searchParams.get("data_level") === "AUCTION_CAMPAIGN") {
        return withPage([{ dimensions: { campaign_id: "c1" }, metrics: { spend: "1" } }], "campaign");
      }
      return withPage(
        [{ dimensions: { advertiser_id: "123456789" }, metrics: { spend: "1" } }],
        "lifetime",
        { page: 1, page_size: 1, total_number: 1, total_page: 1 }
      );
    }
    throw new Error(`unexpected URL ${url}`);
  });
}

beforeEach(() => {
  resetTikTokAdsConnectorCacheForTests();
  delete process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
  delete process.env.TIKTOK_BUSINESS_ADVERTISER_ID;
  delete process.env.TIKTOK_BUSINESS_WRITE_ENABLED;
  vi.restoreAllMocks();
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
  else process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = originalToken;
  if (originalAdvertiserId === undefined) delete process.env.TIKTOK_BUSINESS_ADVERTISER_ID;
  else process.env.TIKTOK_BUSINESS_ADVERTISER_ID = originalAdvertiserId;
  if (originalWriteEnabled === undefined) delete process.env.TIKTOK_BUSINESS_WRITE_ENABLED;
  else process.env.TIKTOK_BUSINESS_WRITE_ENABLED = originalWriteEnabled;
  vi.unstubAllGlobals();
});

describe("TikTok Ads connector", () => {
  it("serves the complete verified snapshot when a production token is not configured", async () => {
    const dashboard = await getTikTokAdsDashboard();

    expect(dashboard.source).toBe("snapshot");
    expect(dashboard.liveConfigured).toBe(false);
    expect(dashboard.advertiser).toMatchObject({
      advertiserId: "7578826549592391687",
      name: "LCJ-01",
      currency: "JPY",
      timezone: "Asia/Tokyo",
    });
    expect(dashboard.campaigns).toHaveLength(16);
    expect(dashboard.adgroups).toHaveLength(19);
    expect(dashboard.ads).toHaveLength(48);
    expect(dashboard.campaigns.every(item => item.metrics && item.adgroupCount >= 0 && item.adCount >= 0)).toBe(true);
    expect(dashboard.lifetimeMetrics.spend).toBe("633173.000");
    expect(dashboard.reportingCoverage).toEqual({
      auctionAdvertiserCount: 1,
      auctionServiceType: "AUCTION",
      includesGmvMax: false,
      note: "Auction账户报表与商品短视频GMV广告报告是不同期间、不同口径，禁止直接相加。",
    });
    expect(dashboard.reportedPerformance.totals).toMatchObject({
      baseSpend: 1_850_118,
      additionalSpend: 149_021,
      allInSpend: 1_999_139,
      gmv: 5_937_657,
    });
    expect(JSON.stringify(dashboard)).not.toContain("Access-Token");
  });

  it("switches to server-side live data without returning the access token", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "secret-token-must-never-leak";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    const seenUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      seenUrls.push(url.toString());
      expect(new Headers(init?.headers).get("Access-Token")).toBe("secret-token-must-never-leak");
      expect(url.searchParams.get("advertiser_id") ?? "123456789").toContain("123456789");

      if (url.pathname.endsWith("/advertiser/info/")) {
        return response({ list: [{ advertiser_id: "123456789", name: "LIVE", country: "JP", currency: "JPY", timezone: "Asia/Tokyo", display_timezone: "Asia/Tokyo", status: "STATUS_ENABLE", role: "ROLE_CHILD_ADVERTISER" }] });
      }
      if (url.pathname.endsWith("/campaign/get/")) {
        return response({ list: [{ campaign_id: "c1", campaign_name: "live campaign", operation_status: "ENABLE", secondary_status: "CAMPAIGN_STATUS_ENABLE", objective_type: "TRAFFIC", budget: 1000, budget_mode: "BUDGET_MODE_DAY", create_time: "2026-09-25 00:00:00", modify_time: "2026-09-25 01:00:00" }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
      }
      if (url.pathname.endsWith("/adgroup/get/")) {
        return response({ list: [{ adgroup_id: "g1", adgroup_name: "live group", campaign_id: "c1", campaign_name: "live campaign", operation_status: "ENABLE", secondary_status: "ADGROUP_STATUS_ENABLE", optimization_goal: "CLICK", promotion_type: "WEBSITE", budget: 1000, budget_mode: "BUDGET_MODE_DAY", billing_event: "CPC", placement_type: "PLACEMENT_TYPE_AUTOMATIC", campaign_automation_type: "MANUAL", schedule_type: "SCHEDULE_FROM_NOW", schedule_start_time: "2026-09-25 00:00:00", create_time: "2026-09-25 00:00:00", modify_time: "2026-09-25 01:00:00" }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
      }
      if (url.pathname.endsWith("/ad/get/")) {
        return response({ list: [{ ad_id: "a1", ad_name: "live ad", ad_text: "live copy", campaign_id: "c1", campaign_name: "live campaign", adgroup_id: "g1", adgroup_name: "live group", operation_status: "ENABLE", secondary_status: "AD_STATUS_ENABLE", campaign_automation_type: "MANUAL", create_time: "2026-09-25 00:00:00", modify_time: "2026-09-25 01:00:00" }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
      }
      if (url.pathname.endsWith("/report/integrated/get/")) {
        const dimensions = JSON.parse(url.searchParams.get("dimensions") || "[]") as string[];
        if (dimensions.includes("stat_time_day")) {
          return response({ list: [{ dimensions: { campaign_id: "c1", stat_time_day: "2026-09-25 00:00:00" }, metrics: { spend: "50", impressions: "500", clicks: "50", ctr: "10", cpc: "1", conversion: "5", cost_per_conversion: "10" } }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
        }
        if (url.searchParams.get("data_level") === "AUCTION_CAMPAIGN") {
          return response({ list: [{ dimensions: { campaign_id: "c1" }, metrics: { spend: "50", impressions: "500", clicks: "50", ctr: "10", cpc: "1", conversion: "5", cost_per_conversion: "10" } }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
        }
        return response({ list: [{ dimensions: { advertiser_id: "123456789" }, metrics: { spend: "50", impressions: "500", clicks: "50", ctr: "10", cpc: "1", conversion: "5", cost_per_conversion: "10" } }], page_info: { page: 1, page_size: 1, total_number: 1, total_page: 1 } });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const dashboard = await getTikTokAdsDashboard({ forceLive: true });

    expect(dashboard.source).toBe("live");
    expect(dashboard.liveConfigured).toBe(true);
    expect(dashboard.advertiser.name).toBe("LIVE");
    expect(dashboard.campaigns).toHaveLength(1);
    expect(dashboard.campaigns[0]).toMatchObject({ adgroupCount: 1, adCount: 1 });
    expect(dashboard.dailyMetrics).toHaveLength(1);
    expect(seenUrls).toHaveLength(7);
    expect(JSON.stringify(dashboard)).not.toContain("secret-token-must-never-leak");
  });

  it("fails safely to the verified snapshot and exposes only a sanitized error code", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "another-private-token";
    vi.stubGlobal("fetch", vi.fn(() => response(null, 40105)));

    const dashboard = await getTikTokAdsDashboard({ forceLive: true });

    expect(dashboard.source).toBe("snapshot");
    expect(dashboard.liveConfigured).toBe(true);
    expect(dashboard.liveErrorCode).toBe("TIKTOK_API_40105");
    expect(dashboard.campaigns).toHaveLength(16);
    expect(JSON.stringify(dashboard)).not.toContain("another-private-token");
  });

  it("fails closed to the snapshot when a synchronous report has more than one page", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "pagination-private-token";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/advertiser/info/")) {
        return response({ list: [{ advertiser_id: "123456789", name: "LIVE", country: "JP", currency: "JPY", timezone: "Asia/Tokyo", display_timezone: "Asia/Tokyo", status: "STATUS_ENABLE", role: "ROLE_CHILD_ADVERTISER" }] });
      }
      if (url.pathname.endsWith("/campaign/get/")) {
        return response({ list: [{ campaign_id: "c1", campaign_name: "live campaign", operation_status: "ENABLE", secondary_status: "CAMPAIGN_STATUS_ENABLE", objective_type: "TRAFFIC" }], page_info: { page: 1, page_size: 1000, total_number: 1, total_page: 1 } });
      }
      if (url.pathname.endsWith("/adgroup/get/") || url.pathname.endsWith("/ad/get/")) {
        return response({ list: [], page_info: { page: 1, page_size: 1000, total_number: 0, total_page: 1 } });
      }
      if (url.pathname.endsWith("/report/integrated/get/")) {
        const dimensions = JSON.parse(url.searchParams.get("dimensions") || "[]") as string[];
        if (dimensions.includes("stat_time_day")) return response({ list: [], page_info: { page: 1, page_size: 1000, total_number: 0, total_page: 1 } });
        if (url.searchParams.get("data_level") === "AUCTION_CAMPAIGN") {
          return response({ list: [{ dimensions: { campaign_id: "c1" }, metrics: { spend: "1" } }], page_info: { page: 1, page_size: 1, total_number: 2, total_page: 2 } });
        }
        return response({ list: [{ dimensions: { advertiser_id: "123456789" }, metrics: { spend: "1" } }], page_info: { page: 1, page_size: 1, total_number: 1, total_page: 1 } });
      }
      throw new Error(`unexpected URL ${url}`);
    }));

    const dashboard = await getTikTokAdsDashboard({ forceLive: true });

    expect(dashboard.source).toBe("snapshot");
    expect(dashboard.liveErrorCode).toBe("TIKTOK_REPORT_PAGINATION_EXCEEDED");
    expect(JSON.stringify(dashboard)).not.toContain("pagination-private-token");
  });

  it.each<ReportTarget>(["lifetime", "campaign", "daily"])(
    "fails closed when the %s report omits pagination metadata",
    async reportTarget => {
      process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "pagination-private-token";
      process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
      vi.stubGlobal("fetch", createPaginationMetadataFetchMock(reportTarget, null));

      const dashboard = await getTikTokAdsDashboard({ forceLive: true });

      expect(dashboard.source).toBe("snapshot");
      expect(dashboard.liveErrorCode).toBe("TIKTOK_REPORT_PAGINATION_EXCEEDED");
    }
  );

  it("fails closed when total_number proves the campaign report is incomplete", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "pagination-private-token";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    vi.stubGlobal("fetch", createPaginationMetadataFetchMock("campaign", {
      page: 1,
      page_size: 1000,
      total_number: 2,
    }));

    const dashboard = await getTikTokAdsDashboard({ forceLive: true });

    expect(dashboard.source).toBe("snapshot");
    expect(dashboard.liveErrorCode).toBe("TIKTOK_REPORT_PAGINATION_EXCEEDED");
  });

  it("enables writes only with both credentials and the explicit production switch", () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "private-write-token";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    expect(getTikTokAdsWriteReadiness()).toEqual({ liveConfigured: true, writeEnabled: false });
    process.env.TIKTOK_BUSINESS_WRITE_ENABLED = "true";
    expect(getTikTokAdsWriteReadiness()).toEqual({ liveConfigured: true, writeEnabled: true });
  });

  it("rejects cross-advertiser writes before any network request", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "private-write-token";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTikTokAuthenticated({
      method: "POST",
      path: "campaign/status/update/",
      body: { advertiser_id: "987654321", campaign_ids: ["111111"], operation_status: "DISABLE" },
    })).rejects.toMatchObject({ safeCode: "TIKTOK_ADVERTISER_SCOPE_MISMATCH" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks service errors as outcome-unknown without exposing the token", async () => {
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "never-return-this-token";
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "123456789";
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      code: 50001,
      message: "service error with never-return-this-token",
      request_id: "req-safe-1",
    }), { status: 200 }))));

    const error = await requestTikTokAuthenticated({
      method: "POST",
      path: "campaign/status/update/",
      body: { advertiser_id: "123456789", campaign_ids: ["111111"], operation_status: "DISABLE" },
    }).catch(value => value as TikTokApiOperationError);

    expect(error).toMatchObject({ safeCode: "TIKTOK_API_50001", requestId: "req-safe-1", outcomeUnknown: true });
    expect(JSON.stringify(error)).not.toContain("never-return-this-token");
  });
});
