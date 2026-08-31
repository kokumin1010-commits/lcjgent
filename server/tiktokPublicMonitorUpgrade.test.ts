import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTikTokPublicMonitorHealth } from "./tiktokPublicMonitorUpgrade";

const accountColumns = [
  "monitorEnabled",
  "publicProvider",
  "tiktokUserId",
  "secUid",
  "followingCount",
  "totalLikes",
  "publicVideoCount",
  "lastPublicSyncAt",
  "nextPublicSyncAt",
  "publicSyncStatus",
  "publicSyncError",
];
const requiredTables = new Set([
  "tiktok_public_videos",
  "tiktok_public_account_snapshots",
  "tiktok_public_video_snapshots",
  "tiktok_public_sync_runs",
  "tiktok_public_monitor_upgrade_runs",
]);

function healthPool(
  options: { missingTable?: string; missingColumn?: string } = {}
) {
  return {
    query: vi.fn(async (sqlValue: string, params?: unknown[]) => {
      const sql = String(sqlValue);
      const table = String(params?.[0] || "");
      if (sql.includes("information_schema.TABLES")) {
        const exists = table === "svm_accounts" || requiredTables.has(table);
        return [
          [{ count: exists && table !== options.missingTable ? 1 : 0 }],
          [],
        ];
      }
      if (sql.includes("information_schema.COLUMNS")) {
        return [
          accountColumns
            .filter(name => name !== options.missingColumn)
            .map(columnName => ({ columnName })),
          [],
        ];
      }
      throw new Error(`unexpected query: ${sql}`);
    }),
  } as any;
}

describe("TikTok public monitor schema health", () => {
  it("requires every account column and monitoring table", async () => {
    await expect(getTikTokPublicMonitorHealth(healthPool())).resolves.toEqual({
      healthy: true,
      missingColumns: [],
      missingTables: [],
    });
    const missingColumn = await getTikTokPublicMonitorHealth(
      healthPool({ missingColumn: "secUid" })
    );
    expect(missingColumn.healthy).toBe(false);
    expect(missingColumn.missingColumns).toContain("secUid");
    const missingTable = await getTikTokPublicMonitorHealth(
      healthPool({ missingTable: "tiktok_public_video_snapshots" })
    );
    expect(missingTable.healthy).toBe(false);
    expect(missingTable.missingTables).toContain(
      "tiktok_public_video_snapshots"
    );
  });

  it("keeps the verified pre-backup before all schema changes", () => {
    const source = readFileSync(
      new URL("./tiktokPublicMonitorUpgrade.ts", import.meta.url),
      "utf8"
    );
    const setup = source.slice(
      source.indexOf("export async function runTikTokPublicMonitorUpgradeSetup")
    );
    const preBackup = setup.indexOf("verifiedBackup(pool, PRE_REASON)");
    expect(preBackup).toBeGreaterThan(0);
    expect(preBackup).toBeLessThan(setup.indexOf("createTables(pool)"));
    expect(preBackup).toBeLessThan(setup.indexOf("pool.query(sql)"));
  });

  it("uses account-scoped video uniqueness and does not create sales fields", () => {
    const source = readFileSync(
      new URL("./tiktokPublicMonitorUpgrade.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain(
      "UNIQUE KEY uq_tiktok_public_video_account_external (accountId,externalVideoId)"
    );
    expect(source).not.toMatch(/\bGMV\b|productClick|orderCount/i);
  });
});

describe("TikTok public monitor dashboard contract", () => {
  it("returns access explicitly and reads it with a null-safe guard", () => {
    const routerSource = readFileSync(
      new URL("./tiktokPublicMonitorRouter.ts", import.meta.url),
      "utf8"
    );
    const uiSource = readFileSync(
      new URL("../client/src/components/TikTokPublicMonitor.tsx", import.meta.url),
      "utf8"
    );
    expect(routerSource).toContain(
      "return { ...(await getTikTokPublicDashboard(input.month)), access }"
    );
    expect(uiSource).toContain("data?.access?.canEdit === true");
    expect(uiSource).not.toContain("data?.access.canEdit === true");
  });
});

describe("TikTok public monitor synchronization contract", () => {
  it("fetches externally before acquiring a transaction connection and avoids video N+1 selects", () => {
    const source = readFileSync(
      new URL("./tiktokPublicMonitorService.ts", import.meta.url),
      "utf8"
    );
    const save = source.slice(
      source.indexOf("async function saveSuccessfulSync"),
      source.indexOf("export async function syncTikTokPublicAccount")
    );
    expect(save.indexOf("fetchPublicTikTokAccount(username)")).toBeLessThan(
      save.indexOf("const connection = await pool().getConnection()")
    );
    expect(save).toContain("id=LAST_INSERT_ID(id)");
    expect(save).not.toContain("SELECT id FROM tiktok_public_videos");
  });

  it("never writes public metrics into manual sales or daily-entry tables", () => {
    const source = readFileSync(
      new URL("./tiktokPublicMonitorService.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toContain("short_video_account_daily_sales");
    expect(source).not.toContain("short_video_daily_entries");
    expect(source).not.toMatch(/\bGMV\b|productClick|orderCount/i);
  });
});
