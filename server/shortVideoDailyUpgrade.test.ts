import { describe, expect, it, vi } from "vitest";
import { getShortVideoDailyUpgradeHealth } from "./shortVideoDailyUpgrade";

const requiredColumns = [
  "id",
  "reportDate",
  "accountId",
  "accountName",
  "videoUrl",
  "videoUrlHash",
  "activeKey",
  "producerStaffId",
  "producerName",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "productClicks",
  "orders",
  "gmv",
  "currency",
  "notes",
  "createdById",
  "createdByName",
  "updatedById",
  "updatedByName",
  "deletedAt",
  "deletedById",
  "createdAt",
  "updatedAt",
];

function healthyPool() {
  return {
    query: vi.fn(async (sqlValue: string, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("information_schema.TABLES"))
        return [[{ count: 1 }], []];
      if (sql.includes("information_schema.COLUMNS")) {
        return [requiredColumns.map(columnName => ({ columnName })), []];
      }
      if (sql.startsWith("SELECT status FROM short_video_daily_upgrade_runs")) {
        return [[{ status: "success" }], []];
      }
      if (sql.includes("SELECT status,completedAt,details,errorMessage")) {
        return [
          [
            {
              status: "success",
              completedAt: "2026-08-31T00:00:00Z",
              details: { businessRowsModified: 0 },
              errorMessage: null,
            },
          ],
          [],
        ];
      }
      if (sql.includes("FROM short_video_daily_entries")) {
        return [
          [
            {
              rowCount: 0,
              maxId: 0,
              totalViews: 0,
              totalOrders: 0,
              totalGmv: 0,
            },
          ],
          [],
        ];
      }
      throw new Error(
        `unexpected query: ${sql} ${JSON.stringify(params || [])}`
      );
    }),
  } as any;
}

describe("short video daily schema health", () => {
  it("reports healthy only when every table, column and completed run exists", async () => {
    const pool = healthyPool();
    const health = await getShortVideoDailyUpgradeHealth(pool);
    expect(health.healthy).toBe(true);
    expect(health.missingTables).toEqual([]);
    expect(health.missingEntryColumns).toEqual([]);
    expect(health.entrySnapshot).toEqual({
      rowCount: 0,
      maxId: 0,
      totalViews: 0,
      totalOrders: 0,
      totalGmv: 0,
    });
    expect(health.run?.details).toEqual({ businessRowsModified: 0 });
  });

  it("fails closed when the entry table is missing", async () => {
    const pool = healthyPool();
    pool.query.mockImplementation(
      async (sqlValue: string, params?: unknown[]) => {
        const sql = String(sqlValue);
        if (sql.includes("information_schema.TABLES"))
          return [
            [{ count: params?.[0] === "short_video_daily_entries" ? 0 : 1 }],
            [],
          ];
        if (sql.startsWith("SELECT status FROM short_video_daily_upgrade_runs"))
          return [[{ status: "success" }], []];
        if (sql.includes("SELECT status,completedAt,details,errorMessage"))
          return [[{ status: "success" }], []];
        throw new Error(`unexpected query: ${sql}`);
      }
    );
    const health = await getShortVideoDailyUpgradeHealth(pool);
    expect(health.healthy).toBe(false);
    expect(health.missingTables).toContain("short_video_daily_entries");
    expect(health.missingEntryColumns).toContain("reportDate");
  });
});
