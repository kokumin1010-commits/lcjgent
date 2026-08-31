import { describe, expect, it, vi } from "vitest";
import {
  getShortVideoDailyUpgradeHealth,
  SHORT_VIDEO_DAILY_POST_BACKUP_REASON,
  SHORT_VIDEO_DAILY_PRE_BACKUP_REASON,
} from "./shortVideoDailyUpgrade";

const entryColumns = [
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

const salesColumns = [
  "id",
  "reportDate",
  "accountId",
  "accountName",
  "activeKey",
  "responsibleStaffId",
  "responsibleName",
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

function healthyPool(missingTable?: string, omitSalesUniqueIndex = false) {
  return {
    query: vi.fn(async (sqlValue: string, params?: unknown[]) => {
      const sql = String(sqlValue);
      const table = String(params?.[0] || "");
      if (sql.includes("information_schema.TABLES")) {
        return [[{ count: table === missingTable ? 0 : 1 }], []];
      }
      if (sql.includes("information_schema.COLUMNS")) {
        if (table === missingTable) return [[], []];
        const columns =
          table === "short_video_account_daily_sales"
            ? salesColumns
            : entryColumns;
        return [columns.map(columnName => ({ columnName })), []];
      }
      if (sql.includes("information_schema.STATISTICS")) {
        return [
          omitSalesUniqueIndex
            ? [{ indexName: "PRIMARY" }]
            : [
                { indexName: "PRIMARY" },
                { indexName: "uq_short_video_account_sales_active_day" },
              ],
          [],
        ];
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
      if (sql.includes("FROM short_video_account_daily_sales")) {
        return [[{ rowCount: 0, maxId: 0, totalOrders: 0, totalGmv: 0 }], []];
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

describe("short video daily v2 schema health", () => {
  it("keeps backup reasons within the database column limit", () => {
    expect(SHORT_VIDEO_DAILY_PRE_BACKUP_REASON.length).toBeLessThanOrEqual(32);
    expect(SHORT_VIDEO_DAILY_POST_BACKUP_REASON.length).toBeLessThanOrEqual(32);
  });

  it("is healthy only with both data areas, audits and completed v2 run", async () => {
    const health = await getShortVideoDailyUpgradeHealth(healthyPool());
    expect(health.healthy).toBe(true);
    expect(health.missingTables).toEqual([]);
    expect(health.missingEntryColumns).toEqual([]);
    expect(health.missingSalesColumns).toEqual([]);
    expect(health.missingSalesUniqueIndexes).toEqual([]);
    expect(health.businessSnapshot).toEqual({
      video: {
        rowCount: 0,
        maxId: 0,
        totalViews: 0,
        totalOrders: 0,
        totalGmv: 0,
      },
      accountSales: {
        rowCount: 0,
        maxId: 0,
        totalOrders: 0,
        totalGmv: 0,
      },
    });
    expect(health.run?.details).toEqual({ businessRowsModified: 0 });
  });

  it("fails closed when the original video table is missing", async () => {
    const health = await getShortVideoDailyUpgradeHealth(
      healthyPool("short_video_daily_entries")
    );
    expect(health.healthy).toBe(false);
    expect(health.missingTables).toContain("short_video_daily_entries");
    expect(health.missingEntryColumns).toContain("reportDate");
  });

  it("fails closed when the account daily sales table is missing", async () => {
    const health = await getShortVideoDailyUpgradeHealth(
      healthyPool("short_video_account_daily_sales")
    );
    expect(health.healthy).toBe(false);
    expect(health.missingTables).toContain("short_video_account_daily_sales");
    expect(health.missingSalesColumns).toContain("orders");
    expect(health.missingSalesUniqueIndexes).toContain(
      "uq_short_video_account_sales_active_day"
    );
  });

  it("fails closed when the account-day uniqueness index is missing", async () => {
    const health = await getShortVideoDailyUpgradeHealth(
      healthyPool(undefined, true)
    );
    expect(health.healthy).toBe(false);
    expect(health.missingTables).toEqual([]);
    expect(health.missingSalesColumns).toEqual([]);
    expect(health.missingSalesUniqueIndexes).toEqual([
      "uq_short_video_account_sales_active_day",
    ]);
  });
});
