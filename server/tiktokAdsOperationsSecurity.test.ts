import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operations = readFileSync("server/tiktokAdsOperations.ts", "utf8");
const connector = readFileSync("server/tiktokAdsConnector.ts", "utf8");
const upgrade = readFileSync("server/tiktokAdsOperationsUpgrade.ts", "utf8");
const router = readFileSync("server/tiktokAdsRouter.ts", "utf8");
const access = readFileSync("server/tiktokAdsAccess.ts", "utf8");
const page = readFileSync("client/src/pages/TikTokAdsIntegration.tsx", "utf8");
const startup = readFileSync("server/_core/index.ts", "utf8");

describe("TikTok Ads command center security contracts", () => {
  it("only exposes reviewed single-object status and lifetime-budget endpoints", () => {
    expect(operations).toContain('"campaign/status/update/"');
    expect(operations).toContain('"adgroup/status/update/"');
    expect(operations).toContain('"ad/status/update/"');
    expect(operations).toContain('path: "campaign/update/"');
    expect(operations).toContain('path: "adgroup/budget/update/"');
    expect(operations).not.toContain('operation_status: "DELETE"');
    expect(operations).not.toContain('path: "ad/update/"');
    expect(operations).not.toContain('path: "adgroup/update/"');
    expect(router).toContain('entityType: z.enum(["campaign", "adgroup"])');
  });

  it("requires exact server write enablement, signed actor-bound confirmation and a fresh preflight", () => {
    expect(connector).toContain('process.env.TIKTOK_BUSINESS_WRITE_ENABLED === "true"');
    expect(operations).toContain('const CONFIRMATION_TTL_MS = 5 * 60 * 1000');
    expect(operations).toContain('const CONFIRMATION_TEXT = "确认执行"');
    expect(operations).toContain('createHmac("sha256", confirmationSecret())');
    expect(operations).toContain("timingSafeEqual");
    expect(operations).toContain('confirmation.operationId !== input.operationId');
    expect(operations).toContain('Number(confirmation.actorUserId) !== input.actorUserId');
    expect(operations).toContain('preflightHash(freshState) !== row.beforeStateHash');
  });

  it("serializes each target, never blindly retries and records post-write verification", () => {
    expect(upgrade).toContain("UNIQUE KEY uk_tiktok_ads_operation_lease (leaseKey)");
    expect(operations).toContain("TIKTOK_OPERATION_ALREADY_EXECUTING");
    expect(operations).toContain("TIKTOK_TARGET_OPERATION_IN_PROGRESS");
    expect(operations).toContain("TIKTOK_STALE_EXECUTION_REQUIRES_REVIEW");
    expect(operations).toContain("TIKTOK_POST_WRITE_VERIFICATION_FAILED");
    expect(operations).toContain("RECONCILIATION_REQUIRED");
    expect(operations).toContain("leaseKey = ${keepTargetLock ? row.leaseKey : null}");
    expect(operations).toContain("AND leaseKey = ${row.leaseKey}");
    expect(operations).toContain("await refreshOperationLease(db, row)");
    expect(operations.indexOf("await refreshOperationLease(db, row)")).toBeLessThan(operations.indexOf("const result = await dispatchOperation"));
    expect(operations).not.toContain("completedAt = CURRENT_TIMESTAMP, leaseKey = NULL, leaseUntil = NULL\n        WHERE status = 'executing'");
    expect(operations).not.toMatch(/setTimeout\([^)]*dispatchOperation/);
  });

  it("requires a dedicated edit grant for live operations and rejects all CBO campaign writes", () => {
    expect(access).toContain("isDedicatedTikTokAdsPermissionKey(permission.pageKey) && enabled(permission.canEdit)");
    expect(operations).toContain('throw new TikTokAdsOperationError("TIKTOK_CBO_CAMPAIGN_UNSUPPORTED")');
    expect(router).toContain("await requireTikTokAdsOperateAccess(ctx.user)");
    expect(router).not.toMatch(/operationHistory[\s\S]{0,260}requireTikTokAdsPageAccess/);
  });

  it("creates audit tables only after a verified backup and exposes a no-store health endpoint", () => {
    expect(upgrade).toContain("runDatabaseBackup(BACKUP_REASON");
    expect(upgrade).toContain("tiktok_ads_operations");
    expect(upgrade).toContain("tiktok_ads_operation_events");
    expect(upgrade).toContain("existingRowsModified: 0");
    expect(upgrade).toContain("INFORMATION_SCHEMA.COLUMNS");
    expect(upgrade).toContain("REQUIRED_COLUMNS");
    expect(startup).toContain('/api/health/tiktok-ads-operations');
    expect(startup).toContain("startTikTokAdsOperationsUpgradeSetup()");
  });

  it("keeps secrets server-only and presents explicit preview, confirmation, audit and delete prohibition", () => {
    expect(page).not.toContain("TIKTOK_BUSINESS_ACCESS_TOKEN");
    expect(page).toContain("生成确认预览");
    expect(page).toContain("执行并实时复核");
    expect(page).toContain("TikTok操作记录");
    expect(page).toContain("删除永不提供");
    expect(connector).not.toContain("console.log(token");
    expect(connector).not.toContain("console.error(token");
  });
});
