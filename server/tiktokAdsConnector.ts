import { TIKTOK_ADS_BOOTSTRAP_SNAPSHOT } from "./tiktokAdsSnapshot";

const TIKTOK_API_ORIGIN = "https://business-api.tiktok.com";
const TIKTOK_API_VERSION = "v1.3";
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

export type TikTokAdsSource = "live" | "snapshot";

type TikTokApiEnvelope<T> = {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export type TikTokApiWriteResult<T = Record<string, unknown>> = {
  data: T | null;
  requestId: string | null;
};

export class TikTokApiOperationError extends Error {
  readonly safeCode: string;
  readonly requestId: string | null;
  readonly outcomeUnknown: boolean;

  constructor(safeCode: string, options?: { requestId?: string | null; outcomeUnknown?: boolean }) {
    super(safeCode);
    this.name = "TikTokApiOperationError";
    this.safeCode = safeCode;
    this.requestId = options?.requestId ?? null;
    this.outcomeUnknown = options?.outcomeUnknown === true;
  }
}

type PageResponse<T> = {
  list: T[];
  page_info?: {
    page?: number;
    page_size?: number;
    total_number?: number;
    total_page?: number;
  };
};

type MetricRow = {
  dimensions: Record<string, string>;
  metrics: Record<string, string>;
};

type MetricValues = ReturnType<typeof mapMetrics>;
type LiveSnapshot = {
  readonly schemaVersion: number;
  readonly capturedAt: string;
  readonly captureMethod: string;
  readonly sourceFingerprints: Readonly<Record<string, string>>;
  readonly advertiser: {
    readonly advertiserId: string;
    readonly name: string;
    readonly country: string;
    readonly currency: string;
    readonly timezone: string;
    readonly displayTimezone: string;
    readonly status: string;
    readonly role: string;
  };
  readonly lifetimeMetrics: MetricValues;
  readonly campaigns: readonly ReturnType<typeof mapCampaign>[];
  readonly campaignMetrics: readonly ({ readonly campaignId: string } & MetricValues)[];
  readonly adgroups: readonly ReturnType<typeof mapAdgroup>[];
  readonly ads: readonly ReturnType<typeof mapAd>[];
  readonly recentDailyCampaignMetrics: readonly ({
    readonly campaignId: string;
    readonly statTimeDay: string;
  } & MetricValues)[];
};

let cachedLiveDashboard: { expiresAt: number; value: TikTokAdsDashboard } | null = null;

function stringifyQueryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

async function requestTikTok<T>(
  token: string,
  path: string,
  query: Record<string, unknown>
): Promise<T> {
  const url = new URL(`/open_api/${TIKTOK_API_VERSION}/${path}`, TIKTOK_API_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, stringifyQueryValue(value));
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Access-Token": token,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = (await response.json()) as TikTokApiEnvelope<T>;
    if (payload.code !== 0 || !payload.data) {
      throw new Error(`API_${String(payload.code)}`);
    }
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

function requireTikTokCredentials() {
  const token = process.env.TIKTOK_BUSINESS_ACCESS_TOKEN?.trim();
  const advertiserId = process.env.TIKTOK_BUSINESS_ADVERTISER_ID?.trim();
  if (!token || !advertiserId) {
    throw new TikTokApiOperationError("TIKTOK_WRITE_CREDENTIALS_MISSING");
  }
  return { token, advertiserId };
}

export function getTikTokAdsWriteReadiness() {
  const liveConfigured = Boolean(
    process.env.TIKTOK_BUSINESS_ACCESS_TOKEN?.trim() &&
    process.env.TIKTOK_BUSINESS_ADVERTISER_ID?.trim()
  );
  return {
    liveConfigured,
    writeEnabled: liveConfigured && process.env.TIKTOK_BUSINESS_WRITE_ENABLED === "true",
  };
}

export async function requestTikTokAuthenticated<T>(input: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): Promise<TikTokApiWriteResult<T>> {
  const { token, advertiserId } = requireTikTokCredentials();
  const query = { ...input.query };
  const body = { ...input.body };
  const advertiserIds = Array.isArray(query.advertiser_ids)
    ? query.advertiser_ids.map(value => String(value))
    : [];
  const suppliedAdvertiser = query.advertiser_id ?? body.advertiser_id;
  if (
    (suppliedAdvertiser !== undefined && String(suppliedAdvertiser) !== advertiserId) ||
    (advertiserIds.length > 0 && (advertiserIds.length !== 1 || advertiserIds[0] !== advertiserId))
  ) {
    throw new TikTokApiOperationError("TIKTOK_ADVERTISER_SCOPE_MISMATCH");
  }
  if (suppliedAdvertiser === undefined && advertiserIds.length === 0) {
    throw new TikTokApiOperationError("TIKTOK_ADVERTISER_SCOPE_REQUIRED");
  }

  const url = new URL(`/open_api/${TIKTOK_API_VERSION}/${input.path}`, TIKTOK_API_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, stringifyQueryValue(value));
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: input.method,
      headers: {
        "Access-Token": token,
        Accept: "application/json",
        ...(input.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: input.method === "POST" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new TikTokApiOperationError(`TIKTOK_HTTP_${response.status}`, {
        outcomeUnknown: response.status >= 500,
      });
    }
    const payload = (await response.json()) as TikTokApiEnvelope<T>;
    if (payload.code !== 0) {
      throw new TikTokApiOperationError(`TIKTOK_API_${String(payload.code)}`, {
        requestId: payload.request_id ?? null,
        outcomeUnknown: payload.code >= 50000,
      });
    }
    return { data: payload.data ?? null, requestId: payload.request_id ?? null };
  } catch (error) {
    if (error instanceof TikTokApiOperationError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TikTokApiOperationError("TIKTOK_API_TIMEOUT", { outcomeUnknown: true });
    }
    throw new TikTokApiOperationError("TIKTOK_API_NETWORK_ERROR", { outcomeUnknown: true });
  } finally {
    clearTimeout(timeout);
  }
}

function toSafeErrorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "TIKTOK_API_TIMEOUT";
  const message = error instanceof Error ? error.message : String(error);
  if (/^HTTP_\d{3}$/.test(message)) return `TIKTOK_${message}`;
  if (/^API_-?\d+$/.test(message)) return `TIKTOK_${message}`;
  if (/^TIKTOK_(OBJECT|REPORT)_PAGINATION_EXCEEDED$/.test(message)) return message;
  if (/^TIKTOK_(ADVERTISER|CAMPAIGN_METRICS)_INCOMPLETE$/.test(message)) return message;
  return "TIKTOK_API_UNAVAILABLE";
}

function assertSinglePage<T>(response: PageResponse<T>, errorCode: "TIKTOK_OBJECT_PAGINATION_EXCEEDED" | "TIKTOK_REPORT_PAGINATION_EXCEEDED"): void {
  const page = Number(response.page_info?.page);
  const pageSize = Number(response.page_info?.page_size);
  const totalNumber = Number(response.page_info?.total_number);
  const totalPage = Number(response.page_info?.total_page);
  const metadataComplete =
    Number.isInteger(page) && page === 1 &&
    Number.isInteger(pageSize) && pageSize > 0 &&
    Number.isInteger(totalNumber) && totalNumber >= 0 &&
    Number.isInteger(totalPage) && totalPage === 1;
  if (!metadataComplete || totalNumber !== response.list.length || response.list.length > pageSize) {
    throw new Error(errorCode);
  }
}

function dateInTokyo(offsetDays: number): string {
  const value = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function mapMetrics(metrics: Record<string, string>) {
  return {
    spend: String(metrics.spend ?? "0"),
    impressions: String(metrics.impressions ?? "0"),
    clicks: String(metrics.clicks ?? "0"),
    ctr: String(metrics.ctr ?? "0"),
    cpc: String(metrics.cpc ?? "0"),
    conversion: String(metrics.conversion ?? "0"),
    costPerConversion: String(metrics.cost_per_conversion ?? "0"),
  };
}

function mapCampaign(row: Record<string, unknown>) {
  return {
    campaignId: String(row.campaign_id ?? ""),
    campaignName: String(row.campaign_name ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    objectiveType: String(row.objective_type ?? "UNKNOWN"),
    budget: Number(row.budget ?? 0),
    budgetMode: String(row.budget_mode ?? "UNKNOWN"),
    createTime: String(row.create_time ?? ""),
    modifyTime: String(row.modify_time ?? ""),
  };
}

function mapAdgroup(row: Record<string, unknown>) {
  return {
    adgroupId: String(row.adgroup_id ?? ""),
    adgroupName: String(row.adgroup_name ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    campaignName: String(row.campaign_name ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    optimizationGoal: String(row.optimization_goal ?? "UNKNOWN"),
    optimizationEvent: row.optimization_event == null ? null : String(row.optimization_event),
    promotionType: String(row.promotion_type ?? "UNKNOWN"),
    budget: Number(row.budget ?? 0),
    budgetMode: String(row.budget_mode ?? "UNKNOWN"),
    billingEvent: String(row.billing_event ?? "UNKNOWN"),
    placementType: String(row.placement_type ?? "UNKNOWN"),
    campaignAutomationType: String(row.campaign_automation_type ?? "UNKNOWN"),
    scheduleType: String(row.schedule_type ?? "UNKNOWN"),
    scheduleStartTime: String(row.schedule_start_time ?? ""),
    scheduleEndTime: String(row.schedule_end_time ?? ""),
    createTime: String(row.create_time ?? ""),
    modifyTime: String(row.modify_time ?? ""),
  };
}

function mapAd(row: Record<string, unknown>) {
  return {
    adId: String(row.ad_id ?? ""),
    adName: String(row.ad_name ?? ""),
    adText: row.ad_text == null ? null : String(row.ad_text),
    adFormat: row.ad_format == null ? null : String(row.ad_format),
    campaignId: String(row.campaign_id ?? ""),
    campaignName: String(row.campaign_name ?? ""),
    adgroupId: String(row.adgroup_id ?? ""),
    adgroupName: String(row.adgroup_name ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    campaignAutomationType: String(row.campaign_automation_type ?? "UNKNOWN"),
    identityType: row.identity_type == null ? null : String(row.identity_type),
    displayName: row.display_name == null ? null : String(row.display_name),
    tiktokItemId: row.tiktok_item_id == null ? null : String(row.tiktok_item_id),
    landingPageUrl: row.landing_page_url == null ? null : String(row.landing_page_url),
    callToAction: row.call_to_action == null ? null : String(row.call_to_action),
    createTime: String(row.create_time ?? ""),
    modifyTime: String(row.modify_time ?? ""),
  };
}

function withSource(
  snapshot: LiveSnapshot,
  source: TikTokAdsSource,
  options?: { liveErrorCode?: string }
) {
  const campaignMetrics = new Map(snapshot.campaignMetrics.map(row => [row.campaignId, row]));
  const adgroupCounts = new Map<string, number>();
  const adCounts = new Map<string, number>();
  for (const row of snapshot.adgroups) {
    adgroupCounts.set(row.campaignId, (adgroupCounts.get(row.campaignId) ?? 0) + 1);
  }
  for (const row of snapshot.ads) {
    adCounts.set(row.campaignId, (adCounts.get(row.campaignId) ?? 0) + 1);
  }
  const campaigns = snapshot.campaigns
    .map(row => ({
      ...row,
      metrics: campaignMetrics.get(row.campaignId) ?? mapMetrics({}),
      adgroupCount: adgroupCounts.get(row.campaignId) ?? 0,
      adCount: adCounts.get(row.campaignId) ?? 0,
    }))
    .sort((a, b) => Number(b.metrics.spend) - Number(a.metrics.spend));
  const dailyMap = new Map<string, ReturnType<typeof mapMetrics>>();
  for (const row of snapshot.recentDailyCampaignMetrics) {
    const day = row.statTimeDay.slice(0, 10);
    const current = dailyMap.get(day) ?? mapMetrics({});
    dailyMap.set(day, {
      spend: String(Number(current.spend) + Number(row.spend)),
      impressions: String(Number(current.impressions) + Number(row.impressions)),
      clicks: String(Number(current.clicks) + Number(row.clicks)),
      ctr: "0",
      cpc: "0",
      conversion: String(Number(current.conversion) + Number(row.conversion)),
      costPerConversion: "0",
    });
  }
  const dailyMetrics = [...dailyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, metrics]) => {
      const impressions = Number(metrics.impressions);
      const clicks = Number(metrics.clicks);
      const spend = Number(metrics.spend);
      const conversion = Number(metrics.conversion);
      return {
        date,
        ...metrics,
        ctr: impressions > 0 ? String((clicks / impressions) * 100) : "0",
        cpc: clicks > 0 ? String(spend / clicks) : "0",
        costPerConversion: conversion > 0 ? String(spend / conversion) : "0",
      };
    });
  return {
    source,
    sourceLabel: source === "live" ? "TikTok Marketing API 实时Auction数据" : "LCJ-01 Auction已验证快照",
    liveConfigured: Boolean(process.env.TIKTOK_BUSINESS_ACCESS_TOKEN),
    liveErrorCode: options?.liveErrorCode ?? null,
    lastSyncedAt: snapshot.capturedAt,
    snapshotCapturedAt: TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.capturedAt,
    advertiser: snapshot.advertiser,
    lifetimeMetrics: snapshot.lifetimeMetrics,
    reportingCoverage: {
      auctionAdvertiserCount: 1,
      auctionServiceType: "AUCTION" as const,
      includesGmvMax: false,
      note: "当前只显示单一广告账户的Auction API数据；尚未接入GMV Max商品广告数据。",
    },
    campaigns,
    adgroups: [...snapshot.adgroups].sort((a, b) => b.createTime.localeCompare(a.createTime)),
    ads: [...snapshot.ads].sort((a, b) => b.createTime.localeCompare(a.createTime)),
    dailyMetrics,
    capabilities: {
      availableNow: [
        "广告账户状态、币种与时区",
        "Campaign、广告组、广告/素材完整层级",
        "花费、曝光、点击、CTR、CPC、转化与转化成本",
        "预算、投放状态、目标、排期与优化方式",
      ],
      availableWithWriteApproval: [
        "创建和编辑Campaign、广告组与广告",
        "启用、暂停、批量调预算",
        "上传素材、管理受众、目录与自动规则",
        "按表现触发预警和优化建议",
      ],
    },
  };
}

export type TikTokAdsDashboard = ReturnType<typeof withSource>;

async function fetchLiveSnapshot(token: string, advertiserId: string): Promise<LiveSnapshot> {
  const reportBase = {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    service_type: "AUCTION",
    dimensions: ["campaign_id"],
    metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "conversion", "cost_per_conversion"],
    page: 1,
    page_size: 1000,
  };
  const [advertiser, campaigns, adgroups, ads, lifetime, campaignMetrics, recentDaily] = await Promise.all([
    requestTikTok<PageResponse<Record<string, unknown>>>(token, "advertiser/info/", {
      advertiser_ids: [advertiserId],
    }),
    requestTikTok<PageResponse<Record<string, unknown>>>(token, "campaign/get/", {
      advertiser_id: advertiserId,
      page: 1,
      page_size: 1000,
    }),
    requestTikTok<PageResponse<Record<string, unknown>>>(token, "adgroup/get/", {
      advertiser_id: advertiserId,
      page: 1,
      page_size: 1000,
      exclude_field_types_in_response: ["NULL_FIELD"],
    }),
    requestTikTok<PageResponse<Record<string, unknown>>>(token, "ad/get/", {
      advertiser_id: advertiserId,
      page: 1,
      page_size: 1000,
      exclude_field_types_in_response: ["NULL_FIELD"],
    }),
    requestTikTok<PageResponse<MetricRow>>(token, "report/integrated/get/", {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      service_type: "AUCTION",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["advertiser_id"],
      metrics: reportBase.metrics,
      query_lifetime: true,
      page: 1,
      page_size: 1,
    }),
    requestTikTok<PageResponse<MetricRow>>(token, "report/integrated/get/", {
      ...reportBase,
      data_level: "AUCTION_CAMPAIGN",
      query_lifetime: true,
      order_field: "spend",
      order_type: "DESC",
    }),
    requestTikTok<PageResponse<MetricRow>>(token, "report/integrated/get/", {
      ...reportBase,
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id", "stat_time_day"],
      start_date: dateInTokyo(-29),
      end_date: dateInTokyo(0),
      order_field: "spend",
      order_type: "DESC",
    }),
  ]);

  if (advertiser.list.length !== 1) throw new Error("TIKTOK_ADVERTISER_INCOMPLETE");
  const account = advertiser.list[0];
  if (String(account.advertiser_id ?? "") !== advertiserId) throw new Error("TIKTOK_ADVERTISER_INCOMPLETE");
  for (const response of [campaigns, adgroups, ads]) assertSinglePage(response, "TIKTOK_OBJECT_PAGINATION_EXCEEDED");
  for (const response of [lifetime, campaignMetrics, recentDaily]) assertSinglePage(response, "TIKTOK_REPORT_PAGINATION_EXCEEDED");
  if (lifetime.list.length !== 1) throw new Error("TIKTOK_ADVERTISER_INCOMPLETE");
  const campaignIds = new Set(campaigns.list.map(row => String(row.campaign_id ?? "")));
  const metricCounts = new Map<string, number>();
  for (const row of campaignMetrics.list) {
    const campaignId = String(row.dimensions.campaign_id ?? "");
    metricCounts.set(campaignId, (metricCounts.get(campaignId) ?? 0) + 1);
  }
  if ([...campaignIds].some(campaignId => metricCounts.get(campaignId) !== 1) || [...metricCounts.keys()].some(campaignId => !campaignIds.has(campaignId))) {
    throw new Error("TIKTOK_CAMPAIGN_METRICS_INCOMPLETE");
  }

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    captureMethod: "TikTok Marketing API server-side live read",
    sourceFingerprints: {},
    advertiser: {
      advertiserId: String(account.advertiser_id ?? ""),
      name: String(account.name ?? ""),
      country: String(account.country ?? ""),
      currency: String(account.currency ?? ""),
      timezone: String(account.timezone ?? ""),
      displayTimezone: String(account.display_timezone ?? ""),
      status: String(account.status ?? "UNKNOWN"),
      role: String(account.role ?? "UNKNOWN"),
    },
    lifetimeMetrics: mapMetrics(lifetime.list[0]?.metrics ?? {}),
    campaigns: campaigns.list.map(mapCampaign),
    campaignMetrics: campaignMetrics.list.map(row => ({
      campaignId: String(row.dimensions.campaign_id ?? ""),
      ...mapMetrics(row.metrics),
    })),
    adgroups: adgroups.list.map(mapAdgroup),
    ads: ads.list.map(mapAd),
    recentDailyCampaignMetrics: recentDaily.list.map(row => ({
      campaignId: String(row.dimensions.campaign_id ?? ""),
      statTimeDay: String(row.dimensions.stat_time_day ?? ""),
      ...mapMetrics(row.metrics),
    })),
  } as LiveSnapshot;
}

export async function getTikTokAdsDashboard(options?: { forceLive?: boolean }): Promise<TikTokAdsDashboard> {
  const token = process.env.TIKTOK_BUSINESS_ACCESS_TOKEN?.trim();
  const advertiserId = process.env.TIKTOK_BUSINESS_ADVERTISER_ID?.trim() || TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.advertiser.advertiserId;
  if (!token) return withSource(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT, "snapshot");

  if (!options?.forceLive && cachedLiveDashboard && cachedLiveDashboard.expiresAt > Date.now()) {
    return cachedLiveDashboard.value;
  }

  try {
    const liveSnapshot = await fetchLiveSnapshot(token, advertiserId);
    const dashboard = withSource(liveSnapshot, "live");
    cachedLiveDashboard = { value: dashboard, expiresAt: Date.now() + LIVE_CACHE_TTL_MS };
    return dashboard;
  } catch (error) {
    return withSource(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT, "snapshot", {
      liveErrorCode: toSafeErrorCode(error),
    });
  }
}

export function resetTikTokAdsConnectorCacheForTests() {
  cachedLiveDashboard = null;
}

export function invalidateTikTokAdsConnectorCache() {
  cachedLiveDashboard = null;
}
