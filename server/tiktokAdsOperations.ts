import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { getDb } from "./db";
import { getDb as loadDb } from "./db";
import {
  getTikTokAdsWriteReadiness,
  invalidateTikTokAdsConnectorCache,
  requestTikTokAuthenticated,
  TikTokApiOperationError,
} from "./tiktokAdsConnector";

export type TikTokAdsEntityType = "campaign" | "adgroup" | "ad";
export type TikTokAdsOperationAction = "status" | "budget";
export type TikTokAdsOperationStatus = "ENABLE" | "DISABLE";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Pick<Database, "execute">;

type OperationIntent = {
  entityType: TikTokAdsEntityType;
  entityId: string;
  action: TikTokAdsOperationAction;
  operationStatus?: TikTokAdsOperationStatus;
  budget?: number;
  reason: string;
};

type OperationRow = {
  operationId: string;
  actorUserId: number | string;
  advertiserId: string;
  entityType: TikTokAdsEntityType;
  entityId: string;
  entityName: string;
  action: TikTokAdsOperationAction;
  requestedStatus: TikTokAdsOperationStatus | null;
  requestedBudget: string | number | null;
  reason: string;
  beforeState: unknown;
  beforeStateHash: string;
  status: string;
  confirmationExpiresAt: Date | string;
  leaseKey: string | null;
  tiktokRequestId: string | null;
  errorCode: string | null;
  afterState: unknown;
  createdAt: Date | string;
  completedAt: Date | string | null;
};

type PageResponse<T> = {
  list?: T[];
  page_info?: { page?: number; page_size?: number; total_number?: number; total_page?: number };
};

export class TikTokAdsOperationError extends Error {
  readonly safeCode: string;
  readonly needsReconciliation: boolean;

  constructor(safeCode: string, needsReconciliation = false) {
    super(safeCode);
    this.name = "TikTokAdsOperationError";
    this.safeCode = safeCode;
    this.needsReconciliation = needsReconciliation;
  }
}

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const LEASE_TTL_SECONDS = 90;
const CONFIRMATION_TEXT = "确认执行";
const SAFE_ID = /^\d{6,32}$/;
const MAX_HISTORY = 100;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function preflightHash(value: Awaited<ReturnType<typeof buildPreflight>>): string {
  const { capturedAt: _capturedAt, ...semanticState } = value;
  return sha256(semanticState);
}

function confirmationSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || "";
  if (secret.length < 32) throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_SECRET_UNAVAILABLE");
  return secret;
}

function signConfirmation(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", confirmationSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyConfirmation(token: string): Record<string, unknown> {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_INVALID");
  const expected = createHmac("sha256", confirmationSecret()).update(encoded).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_INVALID");
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    return payload;
  } catch (error) {
    if (error instanceof TikTokAdsOperationError) throw error;
    throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_INVALID");
  }
}

function safeCode(error: unknown): string {
  if (error instanceof TikTokAdsOperationError) return error.safeCode;
  if (error instanceof TikTokApiOperationError) return error.safeCode;
  return "TIKTOK_OPERATION_FAILED";
}

function isDeletedStatus(value: unknown): boolean {
  return String(value ?? "").toUpperCase().includes("DELETE");
}

function requiredBoolean(value: unknown, errorCode: string): boolean {
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
  if (value === false || value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
  throw new TikTokAdsOperationError(errorCode);
}

function isEnabledStatus(value: unknown): boolean {
  return String(value ?? "").toUpperCase() === "ENABLE";
}

function assertSingle<T>(response: PageResponse<T> | null, expectedId: string, idField: keyof T): T {
  const list = response?.list ?? [];
  const row = list.find(item => String(item[idField] ?? "") === expectedId);
  if (!row || list.length !== 1) throw new TikTokAdsOperationError("TIKTOK_TARGET_NOT_UNIQUE");
  return row;
}

function assertPageComplete<T>(response: PageResponse<T> | null) {
  const info = response?.page_info;
  const list = response?.list ?? [];
  if (
    !info || Number(info.page) !== 1 || Number(info.total_page) !== 1 ||
    Number(info.total_number) !== list.length || list.length > Number(info.page_size)
  ) {
    throw new TikTokAdsOperationError("TIKTOK_PREFLIGHT_PAGINATION_INCOMPLETE");
  }
}

async function readAdvertiser(advertiserId: string) {
  const result = await requestTikTokAuthenticated<PageResponse<Record<string, unknown>>>({
    method: "GET",
    path: "advertiser/info/",
    query: { advertiser_ids: [advertiserId] },
  });
  const row = assertSingle(result.data, advertiserId, "advertiser_id");
  if (String(row.status ?? "") !== "STATUS_ENABLE") {
    throw new TikTokAdsOperationError("TIKTOK_ADVERTISER_NOT_ENABLED");
  }
  if (String(row.currency ?? "") !== "JPY") {
    throw new TikTokAdsOperationError("TIKTOK_ADVERTISER_CURRENCY_UNSUPPORTED");
  }
  return {
    advertiserId: String(row.advertiser_id),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
    currency: String(row.currency ?? ""),
    timezone: String(row.timezone ?? row.display_timezone ?? ""),
    role: String(row.role ?? ""),
  };
}

async function readCampaign(advertiserId: string, campaignId: string) {
  const result = await requestTikTokAuthenticated<PageResponse<Record<string, unknown>>>({
    method: "GET",
    path: "campaign/get/",
    query: {
      advertiser_id: advertiserId,
      filtering: { campaign_ids: [campaignId] },
      fields: [
        "advertiser_id", "app_id", "budget", "budget_mode", "budget_optimize_on",
        "campaign_automation_type", "campaign_id", "campaign_name", "campaign_system_origin",
        "campaign_type", "modify_time", "objective_type", "operation_status",
        "postback_window_mode", "secondary_status",
      ],
      page: 1,
      page_size: 1,
    },
  });
  assertPageComplete(result.data);
  const row = assertSingle(result.data, campaignId, "campaign_id");
  if (isDeletedStatus(row.operation_status) || isDeletedStatus(row.secondary_status)) {
    throw new TikTokAdsOperationError("TIKTOK_TARGET_DELETED");
  }
  return {
    entityType: "campaign" as const,
    entityId: String(row.campaign_id),
    entityName: String(row.campaign_name ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    budget: Number(row.budget ?? 0),
    budgetMode: String(row.budget_mode ?? "UNKNOWN"),
    budgetOptimizeOn: requiredBoolean(row.budget_optimize_on, "TIKTOK_CBO_STATE_UNKNOWN"),
    campaignAutomationType: String(row.campaign_automation_type ?? "UNKNOWN"),
    campaignType: String(row.campaign_type ?? "UNKNOWN"),
    campaignSystemOrigin: String(row.campaign_system_origin ?? "UNKNOWN"),
    postbackWindowMode: row.postback_window_mode == null ? null : String(row.postback_window_mode),
    modifyTime: String(row.modify_time ?? ""),
  };
}

async function readAdgroup(advertiserId: string, adgroupId: string) {
  const result = await requestTikTokAuthenticated<PageResponse<Record<string, unknown>>>({
    method: "GET",
    path: "adgroup/get/",
    query: {
      advertiser_id: advertiserId,
      filtering: { adgroup_ids: [adgroupId] },
      page: 1,
      page_size: 1,
      exclude_field_types_in_response: ["NULL_FIELD"],
    },
  });
  assertPageComplete(result.data);
  const row = assertSingle(result.data, adgroupId, "adgroup_id");
  if (isDeletedStatus(row.operation_status) || isDeletedStatus(row.secondary_status)) {
    throw new TikTokAdsOperationError("TIKTOK_TARGET_DELETED");
  }
  return {
    entityType: "adgroup" as const,
    entityId: String(row.adgroup_id),
    entityName: String(row.adgroup_name ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    budget: Number(row.budget ?? 0),
    budgetMode: String(row.budget_mode ?? "UNKNOWN"),
    campaignAutomationType: String(row.campaign_automation_type ?? "UNKNOWN"),
    modifyTime: String(row.modify_time ?? ""),
  };
}

async function readAd(advertiserId: string, adId: string) {
  const result = await requestTikTokAuthenticated<PageResponse<Record<string, unknown>>>({
    method: "GET",
    path: "ad/get/",
    query: {
      advertiser_id: advertiserId,
      filtering: { ad_ids: [adId] },
      page: 1,
      page_size: 1,
      exclude_field_types_in_response: ["NULL_FIELD"],
    },
  });
  assertPageComplete(result.data);
  const row = assertSingle(result.data, adId, "ad_id");
  if (isDeletedStatus(row.operation_status) || isDeletedStatus(row.secondary_status)) {
    throw new TikTokAdsOperationError("TIKTOK_TARGET_DELETED");
  }
  return {
    entityType: "ad" as const,
    entityId: String(row.ad_id),
    entityName: String(row.ad_name ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    adgroupId: String(row.adgroup_id ?? ""),
    operationStatus: String(row.operation_status ?? "UNKNOWN"),
    secondaryStatus: String(row.secondary_status ?? "UNKNOWN"),
    campaignAutomationType: String(row.campaign_automation_type ?? "UNKNOWN"),
    modifyTime: String(row.modify_time ?? ""),
  };
}

async function readReview(advertiserId: string, entityType: "adgroup" | "ad", entityId: string) {
  const result = await requestTikTokAuthenticated<Record<string, unknown>>({
    method: "GET",
    path: entityType === "adgroup" ? "adgroup/review_info/" : "ad/review_info/",
    query: {
      advertiser_id: advertiserId,
      ...(entityType === "adgroup" ? { adgroup_ids: [entityId] } : { ad_ids: [entityId] }),
      lang: "ja",
    },
  });
  const serialized = stableStringify(result.data).toUpperCase();
  const rejected = /REJECT|UNAVAILABLE|DISAPPROV|NOT_APPROVED|PART_AVAILABLE/.test(serialized);
  const approved = /APPROVED|AVAILABLE|"IS_APPROVED":TRUE/.test(serialized);
  return { approved: approved && !rejected, rejected, summaryHash: sha256(result.data) };
}

async function readSpend(advertiserId: string, entityType: "campaign" | "adgroup", entityId: string) {
  const dimension = entityType === "campaign" ? "campaign_id" : "adgroup_id";
  const result = await requestTikTokAuthenticated<PageResponse<{ metrics?: Record<string, string> }>>({
    method: "GET",
    path: "report/integrated/get/",
    query: {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      service_type: "AUCTION",
      data_level: entityType === "campaign" ? "AUCTION_CAMPAIGN" : "AUCTION_ADGROUP",
      dimensions: [dimension],
      metrics: ["spend"],
      filtering: [{ field_name: dimension, filter_type: "IN", filter_value: JSON.stringify([entityId]) }],
      query_lifetime: true,
      page: 1,
      page_size: 1,
    },
  });
  assertPageComplete(result.data);
  if ((result.data?.list ?? []).length !== 1) throw new TikTokAdsOperationError("TIKTOK_SPEND_REPORT_INCOMPLETE");
  const spend = Number(result.data?.list?.[0]?.metrics?.spend ?? NaN);
  if (!Number.isFinite(spend) || spend < 0) throw new TikTokAdsOperationError("TIKTOK_SPEND_REPORT_INCOMPLETE");
  return spend;
}

function assertRegularManualCampaign(campaign: Awaited<ReturnType<typeof readCampaign>>) {
  const type = campaign.campaignType.toUpperCase();
  const automation = campaign.campaignAutomationType.toUpperCase();
  const origin = campaign.campaignSystemOrigin.toUpperCase();
  if (type.includes("IOS14") || campaign.postbackWindowMode) {
    throw new TikTokAdsOperationError("TIKTOK_DEDICATED_CAMPAIGN_UNSUPPORTED");
  }
  if (automation !== "MANUAL" || (origin && origin !== "UNKNOWN" && origin !== "TT_ADS_PLATFORM")) {
    throw new TikTokAdsOperationError("TIKTOK_AUTOMATED_CAMPAIGN_UNSUPPORTED");
  }
  if (campaign.budgetOptimizeOn) {
    throw new TikTokAdsOperationError("TIKTOK_CBO_CAMPAIGN_UNSUPPORTED");
  }
}

async function buildPreflight(advertiserId: string, intent: OperationIntent) {
  const advertiser = await readAdvertiser(advertiserId);
  const warnings: string[] = [];
  if (intent.entityType === "campaign") {
    const target = await readCampaign(advertiserId, intent.entityId);
    assertRegularManualCampaign(target);
    const spend = intent.action === "budget" ? await readSpend(advertiserId, "campaign", target.entityId) : null;
    if (intent.action === "budget") validateBudget(intent.budget, target.budgetMode, spend);
    if (intent.action === "status" && intent.operationStatus === target.operationStatus) warnings.push("当前状态已与目标一致，执行时将按幂等成功处理");
    return { advertiser, target, parent: null, review: null, spend, warnings, capturedAt: new Date().toISOString() };
  }
  if (intent.entityType === "adgroup") {
    if (intent.action === "budget" && !intent.budget) throw new TikTokAdsOperationError("TIKTOK_BUDGET_REQUIRED");
    const target = await readAdgroup(advertiserId, intent.entityId);
    const parent = await readCampaign(advertiserId, target.campaignId);
    assertRegularManualCampaign(parent);
    if (target.campaignAutomationType.toUpperCase() !== "MANUAL") throw new TikTokAdsOperationError("TIKTOK_AUTOMATED_ADGROUP_UNSUPPORTED");
    if (intent.action === "budget") assertOutsideBudgetLock(advertiser.timezone);
    const review = intent.action === "status" && intent.operationStatus === "ENABLE" ? await readReview(advertiserId, "adgroup", target.entityId) : null;
    if (review && !review.approved) throw new TikTokAdsOperationError("TIKTOK_REVIEW_NOT_APPROVED");
    const spend = intent.action === "budget" ? await readSpend(advertiserId, "adgroup", target.entityId) : null;
    if (intent.action === "budget") validateBudget(intent.budget, target.budgetMode, spend);
    if (intent.action === "status" && intent.operationStatus === target.operationStatus) warnings.push("当前状态已与目标一致，执行时将按幂等成功处理");
    if (intent.operationStatus === "ENABLE" && !isEnabledStatus(parent.operationStatus)) warnings.push("上层Campaign当前未启用，本操作不会立即产生投放");
    return { advertiser, target, parent, review, spend, warnings, capturedAt: new Date().toISOString() };
  }
  if (intent.action === "budget") throw new TikTokAdsOperationError("TIKTOK_AD_BUDGET_NOT_SUPPORTED");
  const target = await readAd(advertiserId, intent.entityId);
  const parentAdgroup = await readAdgroup(advertiserId, target.adgroupId);
  if (parentAdgroup.campaignId !== target.campaignId) throw new TikTokAdsOperationError("TIKTOK_PARENT_SCOPE_MISMATCH");
  const parentCampaign = await readCampaign(advertiserId, target.campaignId);
  assertRegularManualCampaign(parentCampaign);
  if (parentAdgroup.campaignAutomationType.toUpperCase() !== "MANUAL") throw new TikTokAdsOperationError("TIKTOK_AUTOMATED_ADGROUP_UNSUPPORTED");
  if (target.campaignAutomationType.toUpperCase() !== "MANUAL") throw new TikTokAdsOperationError("TIKTOK_AUTOMATED_AD_UNSUPPORTED");
  const review = intent.operationStatus === "ENABLE" ? await readReview(advertiserId, "ad", target.entityId) : null;
  if (review && !review.approved) throw new TikTokAdsOperationError("TIKTOK_REVIEW_NOT_APPROVED");
  if (intent.operationStatus === target.operationStatus) warnings.push("当前状态已与目标一致，执行时将按幂等成功处理");
  if (intent.operationStatus === "ENABLE" && (!isEnabledStatus(parentCampaign.operationStatus) || !isEnabledStatus(parentAdgroup.operationStatus))) {
    warnings.push("上层Campaign或广告组当前未启用，本操作不会立即产生投放");
  }
  return {
    advertiser,
    target,
    parent: { campaign: parentCampaign, adgroup: parentAdgroup },
    review,
    spend: null,
    warnings,
    capturedAt: new Date().toISOString(),
  };
}

function validateBudget(budget: number | undefined, budgetMode: string, spend: number | null) {
  if (!Number.isFinite(budget) || budget === undefined || budget < 1000 || budget > 10_000_000) {
    throw new TikTokAdsOperationError("TIKTOK_BUDGET_OUT_OF_RANGE");
  }
  if (budgetMode !== "BUDGET_MODE_TOTAL") {
    throw new TikTokAdsOperationError("TIKTOK_ONLY_LIFETIME_BUDGET_SUPPORTED");
  }
  if (spend === null || budget + 1e-9 < spend * 1.05) {
    throw new TikTokAdsOperationError("TIKTOK_BUDGET_BELOW_SPEND_GUARD");
  }
}

function assertOutsideBudgetLock(timezone: string, now = new Date()) {
  if (!timezone) throw new TikTokAdsOperationError("TIKTOK_ADVERTISER_TIMEZONE_MISSING");
  let hour: number;
  let minute: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    hour = Number(parts.find(part => part.type === "hour")?.value);
    minute = Number(parts.find(part => part.type === "minute")?.value);
  } catch {
    throw new TikTokAdsOperationError("TIKTOK_ADVERTISER_TIMEZONE_INVALID");
  }
  if ((hour === 23 && minute >= 55) || (hour === 0 && minute === 0) || (hour === 24 && minute === 0)) {
    throw new TikTokAdsOperationError("TIKTOK_ADGROUP_BUDGET_LOCK_WINDOW");
  }
}

async function appendEvent(db: Executor, operationId: string, actorUserId: number, eventType: string, payload: Record<string, unknown>) {
  await db.execute(sql`
    INSERT INTO tiktok_ads_operation_events (operationId, actorUserId, eventType, payloadJson)
    VALUES (${operationId}, ${actorUserId}, ${eventType}, ${JSON.stringify(payload)})
  `);
}

async function loadOperation(db: Executor, operationId: string, lock = false): Promise<OperationRow> {
  const lockClause = lock ? sql` FOR UPDATE` : sql``;
  const result = await db.execute(sql`
    SELECT * FROM tiktok_ads_operations WHERE operationId = ${operationId} LIMIT 1${lockClause}
  `);
  const row = rowsOf<OperationRow>(result)[0];
  if (!row) throw new TikTokAdsOperationError("TIKTOK_OPERATION_NOT_FOUND");
  return row;
}

export async function previewTikTokAdsOperation(input: {
  actorUserId: number;
  actorName: string | null;
  intent: OperationIntent;
}) {
  const readiness = getTikTokAdsWriteReadiness();
  if (!readiness.writeEnabled) throw new TikTokAdsOperationError("TIKTOK_WRITE_NOT_ENABLED");
  if (!SAFE_ID.test(input.intent.entityId)) throw new TikTokAdsOperationError("TIKTOK_TARGET_ID_INVALID");
  if (input.intent.reason.trim().length < 8) throw new TikTokAdsOperationError("TIKTOK_OPERATION_REASON_REQUIRED");
  if (input.intent.action === "status" && !input.intent.operationStatus) throw new TikTokAdsOperationError("TIKTOK_STATUS_REQUIRED");
  if (input.intent.action === "budget" && input.intent.entityType === "ad") throw new TikTokAdsOperationError("TIKTOK_AD_BUDGET_NOT_SUPPORTED");

  const db = await loadDb();
  if (!db) throw new TikTokAdsOperationError("TIKTOK_OPERATION_STORAGE_UNAVAILABLE");
  const advertiserId = process.env.TIKTOK_BUSINESS_ADVERTISER_ID!.trim();
  const beforeState = await buildPreflight(advertiserId, input.intent);
  const beforeStateHash = preflightHash(beforeState);
  const operationId = randomUUID();
  const expiresAt = Date.now() + CONFIRMATION_TTL_MS;
  const requestHash = sha256({ operationId, actorUserId: input.actorUserId, advertiserId, intent: input.intent, beforeStateHash });

  await db.transaction(async transaction => {
    await transaction.execute(sql`
      INSERT INTO tiktok_ads_operations (
        operationId, requestHash, actorUserId, actorName, advertiserId,
        entityType, entityId, entityName, action, requestedStatus, requestedBudget,
        reason, beforeState, beforeStateHash, status, confirmationExpiresAt
      ) VALUES (
        ${operationId}, ${requestHash}, ${input.actorUserId}, ${input.actorName}, ${advertiserId},
        ${input.intent.entityType}, ${input.intent.entityId}, ${beforeState.target.entityName},
        ${input.intent.action}, ${input.intent.operationStatus ?? null}, ${input.intent.budget ?? null},
        ${input.intent.reason.trim()}, ${JSON.stringify(beforeState)}, ${beforeStateHash}, 'prepared',
        ${new Date(expiresAt)}
      )
    `);
    await appendEvent(transaction as Executor, operationId, input.actorUserId, "PREVIEW_CREATED", {
      intent: input.intent,
      beforeStateHash,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  });

  return {
    operationId,
    confirmationToken: signConfirmation({ operationId, actorUserId: input.actorUserId, beforeStateHash, expiresAt }),
    confirmationText: CONFIRMATION_TEXT,
    expiresAt: new Date(expiresAt).toISOString(),
    intent: input.intent,
    beforeState,
  };
}

function intentFromRow(row: OperationRow): OperationIntent {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    operationStatus: row.requestedStatus ?? undefined,
    budget: row.requestedBudget == null ? undefined : Number(row.requestedBudget),
    reason: row.reason,
  };
}

function operationMatches(preflight: Awaited<ReturnType<typeof buildPreflight>>, intent: OperationIntent): boolean {
  if (intent.action === "status") return preflight.target.operationStatus === intent.operationStatus;
  return Math.abs(Number((preflight.target as { budget?: number }).budget) - Number(intent.budget)) < 0.005;
}

async function dispatchOperation(advertiserId: string, intent: OperationIntent) {
  if (intent.action === "status") {
    const path = intent.entityType === "campaign"
      ? "campaign/status/update/"
      : intent.entityType === "adgroup"
        ? "adgroup/status/update/"
        : "ad/status/update/";
    const idKey = intent.entityType === "campaign" ? "campaign_ids" : intent.entityType === "adgroup" ? "adgroup_ids" : "ad_ids";
    return requestTikTokAuthenticated({
      method: "POST",
      path,
      body: { advertiser_id: advertiserId, [idKey]: [intent.entityId], operation_status: intent.operationStatus },
    });
  }
  if (intent.entityType === "campaign") {
    return requestTikTokAuthenticated({
      method: "POST",
      path: "campaign/update/",
      body: { advertiser_id: advertiserId, campaign_id: intent.entityId, budget: intent.budget },
    });
  }
  return requestTikTokAuthenticated({
    method: "POST",
    path: "adgroup/budget/update/",
    body: { advertiser_id: advertiserId, budget: [{ adgroup_id: intent.entityId, budget: intent.budget }] },
  });
}

async function finishOperation(db: Database, row: OperationRow, status: "succeeded" | "failed" | "needs_reconciliation", data: {
  requestId?: string | null;
  errorCode?: string | null;
  afterState?: unknown;
}) {
  await db.transaction(async transaction => {
    const keepTargetLock = status === "needs_reconciliation";
    const updateResult = await transaction.execute(sql`
      UPDATE tiktok_ads_operations
      SET status = ${status}, tiktokRequestId = ${data.requestId ?? null},
          errorCode = ${data.errorCode ?? null}, afterState = ${data.afterState === undefined ? null : JSON.stringify(data.afterState)},
          completedAt = CURRENT_TIMESTAMP, leaseKey = ${keepTargetLock ? row.leaseKey : null}, leaseUntil = NULL
      WHERE operationId = ${row.operationId} AND status = 'executing' AND leaseKey = ${row.leaseKey}
    `);
    const affectedRows = Number((updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.affectedRows ?? 0);
    if (affectedRows !== 1) throw new TikTokAdsOperationError("TIKTOK_OPERATION_LEASE_LOST", true);
    await appendEvent(transaction as Executor, row.operationId, Number(row.actorUserId), status === "succeeded" ? "VERIFIED_SUCCESS" : status === "failed" ? "FAILED" : "RECONCILIATION_REQUIRED", {
      requestId: data.requestId ?? null,
      errorCode: data.errorCode ?? null,
      afterStateHash: data.afterState === undefined ? null : sha256(data.afterState),
    });
  });
}

async function refreshOperationLease(db: Database, row: OperationRow) {
  const result = await db.execute(sql`
    UPDATE tiktok_ads_operations
    SET leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${LEASE_TTL_SECONDS} SECOND)
    WHERE operationId = ${row.operationId} AND status = 'executing' AND leaseKey = ${row.leaseKey}
  `);
  const affectedRows = Number((result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0);
  if (affectedRows !== 1) throw new TikTokAdsOperationError("TIKTOK_OPERATION_LEASE_LOST", true);
}

export async function executeTikTokAdsOperation(input: {
  actorUserId: number;
  operationId: string;
  confirmationToken: string;
  confirmationText: string;
}) {
  if (input.confirmationText !== CONFIRMATION_TEXT) throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_TEXT_MISMATCH");
  const confirmation = verifyConfirmation(input.confirmationToken);
  if (confirmation.operationId !== input.operationId || Number(confirmation.actorUserId) !== input.actorUserId) {
    throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_ACTOR_MISMATCH");
  }
  const readiness = getTikTokAdsWriteReadiness();
  if (!readiness.writeEnabled) throw new TikTokAdsOperationError("TIKTOK_WRITE_NOT_ENABLED");
  const db = await loadDb();
  if (!db) throw new TikTokAdsOperationError("TIKTOK_OPERATION_STORAGE_UNAVAILABLE");
  let row: OperationRow;

  try {
    row = await db.transaction(async transaction => {
      await transaction.execute(sql`
        UPDATE tiktok_ads_operations
        SET status = 'needs_reconciliation', errorCode = 'TIKTOK_STALE_EXECUTION_REQUIRES_REVIEW',
            completedAt = CURRENT_TIMESTAMP, leaseUntil = NULL
        WHERE status = 'executing' AND leaseUntil < CURRENT_TIMESTAMP
      `);
      const locked = await loadOperation(transaction as Executor, input.operationId, true);
      if (Number(locked.actorUserId) !== input.actorUserId) throw new TikTokAdsOperationError("TIKTOK_OPERATION_ACTOR_MISMATCH");
      if (locked.status === "executing") throw new TikTokAdsOperationError("TIKTOK_OPERATION_ALREADY_EXECUTING");
      if (locked.status !== "prepared") return locked;
      if (
        Number(confirmation.expiresAt || 0) <= Date.now() ||
        new Date(locked.confirmationExpiresAt).getTime() <= Date.now()
      ) {
        await transaction.execute(sql`UPDATE tiktok_ads_operations SET status = 'expired', completedAt = CURRENT_TIMESTAMP WHERE operationId = ${input.operationId}`);
        return { ...locked, status: "expired" };
      }
      if (String(confirmation.beforeStateHash) !== locked.beforeStateHash) throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_INVALID");
      const targetLeaseKey = `tiktok:${locked.advertiserId}:${locked.entityType}:${locked.entityId}`;
      await transaction.execute(sql`
        UPDATE tiktok_ads_operations
        SET status = 'executing', leaseKey = ${targetLeaseKey},
            leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${LEASE_TTL_SECONDS} SECOND), executedAt = CURRENT_TIMESTAMP
        WHERE operationId = ${input.operationId} AND status = 'prepared'
      `);
      await appendEvent(transaction as Executor, input.operationId, input.actorUserId, "EXECUTION_STARTED", {
        leaseKeyHash: sha256(targetLeaseKey),
      });
      return { ...locked, status: "executing", leaseKey: targetLeaseKey };
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") throw new TikTokAdsOperationError("TIKTOK_TARGET_OPERATION_IN_PROGRESS");
    throw error;
  }

  if (row.status === "succeeded") return { ...publicOperation(row), idempotent: true };
  if (row.status === "failed") throw new TikTokAdsOperationError(row.errorCode || "TIKTOK_OPERATION_PREVIOUSLY_FAILED");
  if (row.status === "needs_reconciliation") {
    throw new TikTokAdsOperationError(row.errorCode || "TIKTOK_OPERATION_REQUIRES_RECONCILIATION", true);
  }
  if (row.status === "expired") throw new TikTokAdsOperationError("TIKTOK_CONFIRMATION_EXPIRED");
  if (row.status !== "executing") throw new TikTokAdsOperationError("TIKTOK_OPERATION_NOT_EXECUTABLE");
  const intent = intentFromRow(row);
  const approvedState = parseJson<unknown>(row.beforeState);

  let freshState: Awaited<ReturnType<typeof buildPreflight>>;
  try {
    freshState = await buildPreflight(row.advertiserId, intent);
    if (preflightHash(freshState) !== row.beforeStateHash) {
      await finishOperation(db, row, "failed", { errorCode: "TIKTOK_PREFLIGHT_CHANGED", afterState: freshState });
      throw new TikTokAdsOperationError("TIKTOK_PREFLIGHT_CHANGED");
    }
    if (operationMatches(freshState, intent)) {
      await finishOperation(db, row, "succeeded", { afterState: freshState });
      return { ...publicOperation(row), status: "succeeded", idempotent: true, afterState: freshState };
    }
  } catch (error) {
    if (error instanceof TikTokAdsOperationError && error.safeCode === "TIKTOK_PREFLIGHT_CHANGED") throw error;
    await finishOperation(db, row, "failed", { errorCode: safeCode(error) });
    throw new TikTokAdsOperationError(safeCode(error));
  }

  let requestId: string | null = null;
  try {
    await refreshOperationLease(db, row);
    const result = await dispatchOperation(row.advertiserId, intent);
    requestId = result.requestId;
    invalidateTikTokAdsConnectorCache();
    const afterState = await buildPreflight(row.advertiserId, intent);
    if (!operationMatches(afterState, intent)) {
      await finishOperation(db, row, "needs_reconciliation", {
        requestId,
        errorCode: "TIKTOK_POST_WRITE_VERIFICATION_FAILED",
        afterState,
      });
      throw new TikTokAdsOperationError("TIKTOK_POST_WRITE_VERIFICATION_FAILED", true);
    }
    await finishOperation(db, row, "succeeded", { requestId, afterState });
    return { ...publicOperation(row), status: "succeeded", idempotent: false, requestId, afterState };
  } catch (error) {
    if (error instanceof TikTokAdsOperationError && error.needsReconciliation) throw error;
    const apiError = error instanceof TikTokApiOperationError ? error : null;
    if (apiError?.outcomeUnknown) {
      try {
        const reconciled = await buildPreflight(row.advertiserId, intent);
        if (operationMatches(reconciled, intent)) {
          await finishOperation(db, row, "succeeded", { requestId: apiError.requestId, afterState: reconciled });
          return { ...publicOperation(row), status: "succeeded", idempotent: false, requestId: apiError.requestId, afterState: reconciled };
        }
        await finishOperation(db, row, "needs_reconciliation", {
          requestId: apiError.requestId,
          errorCode: apiError.safeCode,
          afterState: reconciled,
        });
      } catch {
        await finishOperation(db, row, "needs_reconciliation", {
          requestId: apiError.requestId,
          errorCode: apiError.safeCode,
        });
      }
      throw new TikTokAdsOperationError(apiError.safeCode, true);
    }
    await finishOperation(db, row, "failed", { requestId: apiError?.requestId, errorCode: safeCode(error), afterState: approvedState });
    throw new TikTokAdsOperationError(safeCode(error));
  }
}

function publicOperation(row: OperationRow) {
  return {
    operationId: row.operationId,
    entityType: row.entityType,
    entityId: row.entityId,
    entityName: row.entityName,
    action: row.action,
    requestedStatus: row.requestedStatus,
    requestedBudget: row.requestedBudget == null ? null : Number(row.requestedBudget),
    reason: row.reason,
    status: row.status,
    requestId: row.tiktokRequestId,
    errorCode: row.errorCode,
    beforeState: parseJson(row.beforeState),
    afterState: row.afterState == null ? null : parseJson(row.afterState),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export async function listTikTokAdsOperations(limit = 50) {
  const db = await loadDb();
  if (!db) throw new TikTokAdsOperationError("TIKTOK_OPERATION_STORAGE_UNAVAILABLE");
  const safeLimit = Math.min(Math.max(limit, 1), MAX_HISTORY);
  const result = await db.execute(sql`
    SELECT operationId, actorUserId, actorName, advertiserId, entityType, entityId, entityName,
           action, requestedStatus, requestedBudget, reason, status, tiktokRequestId, errorCode,
           createdAt, executedAt, completedAt
    FROM tiktok_ads_operations
    ORDER BY id DESC
    LIMIT ${safeLimit}
  `);
  return rowsOf<{
    operationId: string;
    actorUserId: number | string;
    actorName: string | null;
    advertiserId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    action: string;
    requestedStatus: string | null;
    requestedBudget: number | string | null;
    reason: string;
    status: string;
    tiktokRequestId: string | null;
    errorCode: string | null;
    createdAt: Date | string;
    executedAt: Date | string | null;
    completedAt: Date | string | null;
  }>(result).map(row => ({
    operationId: row.operationId,
    actorUserId: Number(row.actorUserId),
    actorName: row.actorName,
    advertiserId: row.advertiserId,
    entityType: row.entityType,
    entityId: row.entityId,
    entityName: row.entityName,
    action: row.action,
    requestedStatus: row.requestedStatus,
    requestedBudget: row.requestedBudget == null ? null : Number(row.requestedBudget),
    reason: row.reason,
    status: row.status,
    tiktokRequestId: row.tiktokRequestId,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    executedAt: row.executedAt,
    completedAt: row.completedAt,
  }));
}

export function getTikTokAdsOperationConfirmationText() {
  return CONFIRMATION_TEXT;
}
