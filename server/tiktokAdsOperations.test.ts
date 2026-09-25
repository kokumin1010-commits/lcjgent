import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    safeCode: string;
    requestId: string | null;
    outcomeUnknown: boolean;
    constructor(safeCode: string, options?: { requestId?: string | null; outcomeUnknown?: boolean }) {
      super(safeCode);
      this.safeCode = safeCode;
      this.requestId = options?.requestId ?? null;
      this.outcomeUnknown = options?.outcomeUnknown === true;
    }
  }
  return {
    getDb: vi.fn(),
    request: vi.fn(),
    invalidate: vi.fn(),
    readiness: vi.fn(() => ({ liveConfigured: true, writeEnabled: true })),
    ApiError,
  };
});

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./tiktokAdsConnector", () => ({
  getTikTokAdsWriteReadiness: mocks.readiness,
  invalidateTikTokAdsConnectorCache: mocks.invalidate,
  requestTikTokAuthenticated: mocks.request,
  TikTokApiOperationError: mocks.ApiError,
}));

import {
  executeTikTokAdsOperation,
  previewTikTokAdsOperation,
} from "./tiktokAdsOperations";

function queryText(value: unknown): string {
  const chunks = (value as any)?.queryChunks;
  if (!Array.isArray(chunks)) return String(value || "");
  return chunks.map((chunk: any) => {
    if (typeof chunk?.value?.[0] === "string") return chunk.value[0];
    if (chunk?.queryChunks) return queryText(chunk);
    return "?";
  }).join("").replace(/\s+/g, " ").trim();
}

function advertiserResponse() {
  return {
    data: {
      list: [{
        advertiser_id: "7578826549592391687",
        name: "LCJ-01",
        status: "STATUS_ENABLE",
        currency: "JPY",
        timezone: "Asia/Tokyo",
        role: "ROLE_CHILD_ADVERTISER",
      }],
    },
    requestId: "read-advertiser",
  };
}

function campaignResponse(operationStatus: "ENABLE" | "DISABLE", modifyTime = "2026-09-25 08:00:00") {
  return {
    data: {
      list: [{
        advertiser_id: "7578826549592391687",
        campaign_id: "1868240047562818",
        campaign_name: "播放",
        operation_status: operationStatus,
        secondary_status: operationStatus === "ENABLE" ? "CAMPAIGN_STATUS_ENABLE" : "CAMPAIGN_STATUS_DISABLE",
        budget: 0,
        budget_mode: "BUDGET_MODE_INFINITE",
        budget_optimize_on: false,
        campaign_automation_type: "MANUAL",
        campaign_type: "REGULAR_CAMPAIGN",
        campaign_system_origin: "TT_ADS_PLATFORM",
        postback_window_mode: null,
        modify_time: modifyTime,
      }],
      page_info: { page: 1, page_size: 1, total_number: 1, total_page: 1 },
    },
    requestId: "read-campaign",
  };
}

function database(operationRow: () => Record<string, unknown> | null) {
  const execute = vi.fn(async (query: unknown) => {
    const text = queryText(query);
    if (text.startsWith("SELECT * FROM tiktok_ads_operations")) {
      const row = operationRow();
      return [[...(row ? [row] : [])]];
    }
    return [{ affectedRows: 1 }];
  });
  const db = {
    execute,
    transaction: vi.fn(async (callback: (transaction: { execute: typeof execute }) => unknown) => callback({ execute })),
  };
  return db;
}

function rowFromPreview(preview: any, status = "prepared") {
  const payload = JSON.parse(Buffer.from(preview.confirmationToken.split(".")[0], "base64url").toString("utf8"));
  return {
    operationId: preview.operationId,
    actorUserId: 77,
    advertiserId: "7578826549592391687",
    entityType: "campaign",
    entityId: "1868240047562818",
    entityName: "播放",
    action: "status",
    requestedStatus: "ENABLE",
    requestedBudget: null,
    reason: "直播前恢复广告投放",
    beforeState: preview.beforeState,
    beforeStateHash: payload.beforeStateHash,
    status,
    confirmationExpiresAt: new Date(Date.now() + 60_000),
    leaseKey: status === "executing" ? "tiktok:7578826549592391687:campaign:1868240047562818" : null,
    tiktokRequestId: null,
    errorCode: null,
    afterState: null,
    createdAt: new Date(),
    completedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-thirty-two-characters";
  process.env.TIKTOK_BUSINESS_ACCESS_TOKEN = "private-test-token";
  process.env.TIKTOK_BUSINESS_ADVERTISER_ID = "7578826549592391687";
  process.env.TIKTOK_BUSINESS_WRITE_ENABLED = "true";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.JWT_SECRET;
  delete process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
  delete process.env.TIKTOK_BUSINESS_ADVERTISER_ID;
  delete process.env.TIKTOK_BUSINESS_WRITE_ENABLED;
});

describe("TikTok Ads operation state machine", () => {
  it("previews, submits exactly one campaign status command, and verifies the live result", async () => {
    let storedRow: Record<string, unknown> | null = null;
    const db = database(() => storedRow);
    mocks.getDb.mockResolvedValue(db);
    let campaignReads = 0;
    mocks.request.mockImplementation(async (input: { method: string; path: string; body?: Record<string, unknown> }) => {
      if (input.path === "advertiser/info/") return advertiserResponse();
      if (input.path === "campaign/get/") {
        campaignReads += 1;
        return campaignResponse(campaignReads >= 3 ? "ENABLE" : "DISABLE");
      }
      if (input.path === "campaign/status/update/") {
        expect(input.method).toBe("POST");
        expect(input.body).toEqual({
          advertiser_id: "7578826549592391687",
          campaign_ids: ["1868240047562818"],
          operation_status: "ENABLE",
        });
        return { data: {}, requestId: "tiktok-write-request-1" };
      }
      throw new Error(`Unexpected TikTok path ${input.path}`);
    });

    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    storedRow = rowFromPreview(preview);

    const result = await executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    });

    expect(result).toMatchObject({ status: "succeeded", requestId: "tiktok-write-request-1", idempotent: false });
    expect(mocks.request.mock.calls.filter(([input]) => input.path === "campaign/status/update/")).toHaveLength(1);
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    const executedSql = db.execute.mock.calls.map(([query]) => queryText(query)).join("\n");
    expect(executedSql).toContain("INSERT INTO tiktok_ads_operation_events");
    expect(executedSql).toContain("UPDATE tiktok_ads_operations SET status =");
  });

  it("rejects execution without the exact second confirmation phrase", async () => {
    const db = database(() => null);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_CONFIRMATION_TEXT_MISMATCH" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("fails closed before dispatch when the fresh campaign snapshot changed", async () => {
    let storedRow: Record<string, unknown> | null = null;
    const db = database(() => storedRow);
    mocks.getDb.mockResolvedValue(db);
    let campaignReads = 0;
    mocks.request.mockImplementation(async (input: { method: string; path: string }) => {
      if (input.path === "advertiser/info/") return advertiserResponse();
      if (input.path === "campaign/get/") {
        campaignReads += 1;
        return campaignResponse("DISABLE", campaignReads === 1 ? "2026-09-25 08:00:00" : "2026-09-25 08:01:00");
      }
      throw new Error(`Unexpected TikTok path ${input.path}`);
    });
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    storedRow = rowFromPreview(preview);

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_PREFLIGHT_CHANGED" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("persists an expired state and never dispatches an old confirmation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T08:00:00Z"));
    let storedRow: Record<string, unknown> | null = null;
    const db = database(() => storedRow);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    storedRow = rowFromPreview(preview);
    vi.setSystemTime(new Date("2026-09-25T08:06:00Z"));

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_CONFIRMATION_EXPIRED" });
    const executedSql = db.execute.mock.calls.map(([query]) => queryText(query)).join("\n");
    expect(executedSql).toContain("status = 'expired'");
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("rejects a duplicate submission while the same operation is already executing", async () => {
    let storedRow: Record<string, unknown> | null = null;
    const db = database(() => storedRow);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    storedRow = rowFromPreview(preview, "executing");

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_OPERATION_ALREADY_EXECUTING" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("keeps a stale worker target locked so a second real write cannot start", async () => {
    const previewDb = database(() => null);
    mocks.getDb.mockResolvedValue(previewDb);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    const storedRow = rowFromPreview(preview);
    const execute = vi.fn(async (query: unknown) => {
      const text = queryText(query);
      if (text.startsWith("SELECT * FROM tiktok_ads_operations")) return [[storedRow]];
      if (text.includes("SET status = 'executing'")) {
        throw Object.assign(new Error("duplicate target lease"), { code: "ER_DUP_ENTRY" });
      }
      return [{ affectedRows: 1 }];
    });
    mocks.getDb.mockResolvedValue({
      execute,
      transaction: vi.fn(async (callback: (transaction: { execute: typeof execute }) => unknown) => callback({ execute })),
    });

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_TARGET_OPERATION_IN_PROGRESS" });
    const sqlText = execute.mock.calls.map(([query]) => queryText(query)).join("\n");
    expect(sqlText).toContain("TIKTOK_STALE_EXECUTION_REQUIRES_REVIEW");
    expect(sqlText).not.toContain("completedAt = CURRENT_TIMESTAMP, leaseKey = NULL, leaseUntil = NULL");
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("revalidates lease ownership immediately before POST after a slow preflight", async () => {
    const previewDb = database(() => null);
    mocks.getDb.mockResolvedValue(previewDb);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    const storedRow = rowFromPreview(preview);
    const execute = vi.fn(async (query: unknown) => {
      const text = queryText(query);
      if (text.startsWith("SELECT * FROM tiktok_ads_operations")) return [[storedRow]];
      if (text.includes("SET leaseUntil = DATE_ADD")) return [{ affectedRows: 0 }];
      return [{ affectedRows: 1 }];
    });
    mocks.getDb.mockResolvedValue({
      execute,
      transaction: vi.fn(async (callback: (transaction: { execute: typeof execute }) => unknown) => callback({ execute })),
    });

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_OPERATION_LEASE_LOST", needsReconciliation: true });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("rejects replaying a failed terminal operation instead of reporting success", async () => {
    let storedRow: Record<string, unknown> | null = null;
    const db = database(() => storedRow);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => input.path === "advertiser/info/" ? advertiserResponse() : campaignResponse("DISABLE"));
    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    });
    storedRow = { ...rowFromPreview(preview, "failed"), errorCode: "TIKTOK_API_REJECTED" };

    await expect(executeTikTokAdsOperation({
      actorUserId: 77,
      operationId: preview.operationId,
      confirmationToken: preview.confirmationToken,
      confirmationText: "确认执行",
    })).rejects.toMatchObject({ safeCode: "TIKTOK_API_REJECTED" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("rejects every CBO campaign mutation before dispatch", async () => {
    const db = database(() => null);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => {
      if (input.path === "advertiser/info/") return advertiserResponse();
      if (input.path === "campaign/get/") {
        const response = campaignResponse("DISABLE");
        response.data.list[0].budget_optimize_on = true;
        return response;
      }
      throw new Error(`Unexpected TikTok path ${input.path}`);
    });

    await expect(previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    })).rejects.toMatchObject({ safeCode: "TIKTOK_CBO_CAMPAIGN_UNSUPPORTED" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("fails closed when TikTok omits the CBO state", async () => {
    const db = database(() => null);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string }) => {
      if (input.path === "advertiser/info/") return advertiserResponse();
      if (input.path === "campaign/get/") {
        const response = campaignResponse("DISABLE");
        delete (response.data.list[0] as any).budget_optimize_on;
        return response;
      }
      throw new Error(`Unexpected TikTok path ${input.path}`);
    });

    await expect(previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    })).rejects.toMatchObject({ safeCode: "TIKTOK_CBO_STATE_UNKNOWN" });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });

  it("fails before reads when the production write switch is disabled", async () => {
    mocks.readiness.mockReturnValueOnce({ liveConfigured: true, writeEnabled: false });
    await expect(previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "campaign",
        entityId: "1868240047562818",
        action: "status",
        operationStatus: "ENABLE",
        reason: "直播前恢复广告投放",
      },
    })).rejects.toMatchObject({ safeCode: "TIKTOK_WRITE_NOT_ENABLED" });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("previews an ad-group lifetime budget only after an exact lifetime-spend query", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T03:00:00Z"));
    const db = database(() => null);
    mocks.getDb.mockResolvedValue(db);
    mocks.request.mockImplementation(async (input: { path: string; query?: Record<string, any> }) => {
      if (input.path === "advertiser/info/") return advertiserResponse();
      if (input.path === "adgroup/get/") {
        return {
          data: {
            list: [{
              advertiser_id: "7578826549592391687",
              adgroup_id: "1868240047563999",
              adgroup_name: "播放-06.17",
              campaign_id: "1868240047562818",
              operation_status: "DISABLE",
              secondary_status: "ADGROUP_STATUS_DISABLE",
              budget: 300000,
              budget_mode: "BUDGET_MODE_TOTAL",
              campaign_automation_type: "MANUAL",
              modify_time: "2026-09-25 08:00:00",
            }],
            page_info: { page: 1, page_size: 1, total_number: 1, total_page: 1 },
          },
          requestId: "read-adgroup",
        };
      }
      if (input.path === "campaign/get/") return campaignResponse("DISABLE");
      if (input.path === "report/integrated/get/") {
        expect(input.query?.data_level).toBe("AUCTION_ADGROUP");
        expect(input.query?.query_lifetime).toBe(true);
        expect(input.query?.filtering).toEqual([{ field_name: "adgroup_id", filter_type: "IN", filter_value: '["1868240047563999"]' }]);
        return {
          data: {
            list: [{ metrics: { spend: "100000" } }],
            page_info: { page: 1, page_size: 1, total_number: 1, total_page: 1 },
          },
          requestId: "read-spend",
        };
      }
      throw new Error(`Unexpected TikTok path ${input.path}`);
    });

    const preview = await previewTikTokAdsOperation({
      actorUserId: 77,
      actorName: "operator",
      intent: {
        entityType: "adgroup",
        entityId: "1868240047563999",
        action: "budget",
        budget: 120000,
        reason: "缩减直播结束后的总预算",
      },
    });

    expect(preview.beforeState).toMatchObject({ spend: 100000, target: { budgetMode: "BUDGET_MODE_TOTAL" } });
    expect(mocks.request.mock.calls.filter(([input]) => input.method === "POST")).toHaveLength(0);
  });
});
