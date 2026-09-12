import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  aggregateStoreRevenueUploads,
  buildCeoCommandCenterOverview,
  type CeoCommandCenterRawData,
} from "./ceoCommandCenter";
import { isCeoPosition } from "./ceoCommandCenterAccess";
import { CEO_READ_ONLY_TOOL_NAMES } from "./ceoCommandCenterRouter";

const root = path.resolve(import.meta.dirname, "..");

function revenuePeriod(overrides: Partial<CeoCommandCenterRawData["currentRevenue"]> = {}) {
  return {
    storeGmv: 20_000_000,
    storeOrders: 800,
    storeSourceRows: 45,
    storeCountWithData: 4,
    storeUpdatedAt: new Date("2026-09-13T05:00:00.000Z"),
    livestreamGmv: 12_000_000,
    livestreamOrders: 420,
    livestreamSessionCount: 12,
    livestreamUpdatedAt: new Date("2026-09-13T04:00:00.000Z"),
    pitFeeJpy: 590_000,
    pitFeeCny: 20_000,
    pitFeeReferenceJpy: 1_000_000,
    pitFeeRecordCount: 3,
    pitFeeUpdatedAt: new Date("2026-09-13T03:00:00.000Z"),
    ...overrides,
  };
}

function raw(overrides: Partial<CeoCommandCenterRawData> = {}): CeoCommandCenterRawData {
  return {
    today: "2026-09-13",
    generatedAt: new Date("2026-09-13T10:00:00.000Z"),
    activeStaff: 30,
    activeReportProfiles: 28,
    submittedReportProfiles: 26,
    missingReportNames: ["テスト担当A", "テスト担当B"],
    taskTotal: 20,
    pendingTasks: 3,
    inProgressTasks: 4,
    completedTasks: 13,
    overdueTasks: 0,
    activeIssues: 2,
    urgentHighIssues: 0,
    overdueIssues: 0,
    topIssues: [],
    morningTotal: 2,
    morningCompleted: 2,
    morningFailed: 0,
    morningProcessing: 0,
    activeBrands: 60,
    larkLinkedBrands: 48,
    larkConfigured: true,
    larkLatestStatus: "success",
    larkLatestSyncedAt: new Date("2026-09-13T06:00:00.000Z"),
    larkLatestTotalRecords: 250,
    larkLatestUpdatedRecords: 30,
    activeStoreCount: 5,
    currentRevenue: revenuePeriod(),
    previousRevenue: revenuePeriod({
      storeGmv: 10_000_000,
      storeOrders: 400,
      storeSourceRows: 40,
      pitFeeJpy: 500_000,
      pitFeeCny: 0,
      pitFeeReferenceJpy: 500_000,
      pitFeeRecordCount: 2,
      livestreamGmv: 10_000_000,
      livestreamOrders: 350,
      livestreamSessionCount: 10,
    }),
    current30AdCost: 800_000,
    revenueTrendRows: [
      { date: "2026-09-12", storeGmv: 900_000, storeOrders: 30, storeSourceRows: 4, livestreamGmv: 500_000, livestreamOrders: 20, livestreamSessionCount: 1, pitFeeReferenceJpy: 0, pitFeeRecordCount: 0 },
      { date: "2026-09-13", storeGmv: 1_100_000, storeOrders: 36, storeSourceRows: 4, livestreamGmv: 600_000, livestreamOrders: 24, livestreamSessionCount: 2, pitFeeReferenceJpy: 100_000, pitFeeRecordCount: 1 },
    ],
    ...overrides,
  };
}

describe("CEO command center revenue overview", () => {
  it("uses store GMV as the primary source, adds pit fee reference value, and does not double-add registered live GMV", () => {
    const result = buildCeoCommandCenterOverview(raw());

    expect(result.readOnly).toBe(true);
    expect(result.revenue.primarySource).toBe("store");
    expect(result.revenue.recognizedRevenueReferenceJpy).toBe(21_000_000);
    expect(result.revenue.store.gmv).toBe(20_000_000);
    expect(result.revenue.livestream.gmv).toBe(12_000_000);
    expect(result.revenue.livestream.possibleStoreOverlap).toBe(true);
    expect(result.revenue.livestream.addedToRecognizedTotal).toBe(false);
    expect(result.revenue.pitFee).toMatchObject({ registered: true, jpy: 590_000, cny: 20_000, referenceJpy: 1_000_000 });
    expect(result.revenue.changePercent).toBe(100);
    expect(result.kpis.registeredGmv30d).toBe(12_000_000);
  });

  it("falls back to registered livestream GMV only when store sales are unregistered", () => {
    const result = buildCeoCommandCenterOverview(raw({
      currentRevenue: revenuePeriod({ storeGmv: 0, storeOrders: 0, storeSourceRows: 0, storeCountWithData: 0 }),
    }));

    expect(result.revenue.primarySource).toBe("livestream_fallback");
    expect(result.revenue.recognizedRevenueReferenceJpy).toBe(13_000_000);
    expect(result.revenue.livestream.addedToRecognizedTotal).toBe(true);
  });

  it("keeps unregistered pit fee and missing trend dates distinct from zero", () => {
    const result = buildCeoCommandCenterOverview(raw({
      currentRevenue: revenuePeriod({ pitFeeJpy: 0, pitFeeCny: 0, pitFeeReferenceJpy: 0, pitFeeRecordCount: 0 }),
      revenueTrendRows: [],
    }));

    expect(result.revenue.pitFee.registered).toBe(false);
    expect(result.revenue.pitFee.referenceJpy).toBeNull();
    expect(result.trend).toHaveLength(14);
    expect(result.trend[0]).toMatchObject({ storeGmv: null, livestreamGmv: null, pitFeeReferenceJpy: null, hasData: false });
  });

  it("keeps source trend values separate and preserves the legacy livestream fields", () => {
    const result = buildCeoCommandCenterOverview(raw());
    expect(result.trend.find((point) => point.date === "2026-09-13")).toMatchObject({
      gmv: 600_000,
      orders: 24,
      storeGmv: 1_100_000,
      livestreamGmv: 600_000,
      pitFeeReferenceJpy: 100_000,
      hasData: true,
    });
  });

  it("raises a coverage alert without treating a missing store as zero sales", () => {
    const result = buildCeoCommandCenterOverview(raw());
    expect(result.revenue.store.coverageComplete).toBe(false);
    expect(result.alerts.find((item) => item.id === "store-sales-coverage")).toMatchObject({
      severity: "medium",
      count: 1,
      href: "/master/store-management",
    });
  });
});

describe("store revenue upload aggregation", () => {
  it("uses dated rows, exact total fields, and ignores summary rows when dated rows exist", () => {
    const result = aggregateStoreRevenueUploads([
      {
        storeId: 1,
        year: 2026,
        month: 9,
        uploadedAt: "2026-09-13T05:00:00.000Z",
        dataJson: JSON.stringify([
          { 日付: "2026-09-12", GMV: { value: "1,200" }, 注文数: 3, "达人直播归因 GMV": 900 },
          { 日付: "2026-09-13", 总成交额: 800, 订单数: 2 },
          { _type: "summary", GMV: { value: 99_999 }, 注文数: 99 },
        ]),
      },
    ], "2026-09-01", "2026-09-13");

    expect(result).toMatchObject({ gmv: 2_000, orders: 5, sourceRows: 2, storeCountWithData: 1 });
    expect(result.daily.get("2026-09-12")).toMatchObject({ gmv: 1_200, orders: 3 });
  });

  it("uses a summary only for a fully covered month and never mistakes a channel GMV for total GMV", () => {
    const uploads = [{
      storeId: 2,
      year: 2026,
      month: 7,
      dataJson: JSON.stringify([{ _type: "summary", GMV: 5_000, "达人直播归因 GMV": 4_000 }]),
    }];

    expect(aggregateStoreRevenueUploads(uploads, "2026-07-01", "2026-07-31")).toMatchObject({ gmv: 5_000, sourceRows: 1 });
    expect(aggregateStoreRevenueUploads(uploads, "2026-07-15", "2026-07-31")).toMatchObject({ gmv: 0, sourceRows: 0 });
    expect(aggregateStoreRevenueUploads([{ ...uploads[0], dataJson: JSON.stringify([{ _type: "summary", "达人直播归因 GMV": 4_000 }]) }], "2026-07-01", "2026-07-31")).toMatchObject({ gmv: 0, sourceRows: 1 });
  });
});

describe("CEO command center existing operational signals", () => {
  it("keeps a just-after-midnight report gap informational instead of treating hour 24 as after-hours", () => {
    const result = buildCeoCommandCenterOverview(raw({ generatedAt: new Date("2026-09-12T15:05:00.000Z"), activeReportProfiles: 28, submittedReportProfiles: 20 }));
    expect(result.alerts.find((item) => item.id === "daily-report-progress")?.severity).toBe("info");
  });

  it("raises a high-priority report alert after business hours and preserves the auditable missing count", () => {
    const result = buildCeoCommandCenterOverview(raw({ activeReportProfiles: 28, submittedReportProfiles: 20, missingReportNames: ["テスト担当A", "テスト担当B"] }));
    expect(result.alerts.find((item) => item.id === "daily-report-progress")).toMatchObject({ severity: "high", count: 8, href: "/master/reports" });
    expect(result.reports.missingNamesTruncated).toBe(true);
  });

  it("keeps morning meeting failures out of completed health", () => {
    const result = buildCeoCommandCenterOverview(raw({ morningTotal: 2, morningCompleted: 1, morningFailed: 1 }));
    expect(result.kpis.morningStatus).toBe("failed");
    expect(result.departments.find((item) => item.id === "morning")?.status).toBe("critical");
  });
});

describe("CEO command center security and UI contracts", () => {
  const routerSource = readFileSync(path.join(root, "server/ceoCommandCenterRouter.ts"), "utf8");
  const serviceSource = readFileSync(path.join(root, "server/ceoCommandCenter.ts"), "utf8");
  const accessSource = readFileSync(path.join(root, "server/ceoCommandCenterAccess.ts"), "utf8");
  const dashboardSource = readFileSync(path.join(root, "client/src/pages/Dashboard.tsx"), "utf8");
  const uiSource = readFileSync(path.join(root, "client/src/components/CeoCommandCenter.tsx"), "utf8");

  it("accepts only an active CEO position label", () => {
    expect(isCeoPosition("CEO")).toBe(true);
    expect(isCeoPosition(" ceo ")).toBe(true);
    expect(isCeoPosition("超级管理员")).toBe(false);
    expect(isCeoPosition("店長")).toBe(false);
  });

  it("gates overview and chat with the CEO procedure while exposing only a boolean access probe", () => {
    expect(routerSource).toContain("access: protectedProcedure.query");
    expect(routerSource).toContain("overview: ceoProcedure.query");
    expect(routerSource).toContain("ask: ceoProcedure");
    expect(accessSource).toContain("user.role !== \"admin\"");
    expect(accessSource).toContain("LOWER(TRIM(email))");
    expect(accessSource).toContain("isActive = 'active'");
    expect(dashboardSource).toContain("ceoCommandCenter.access.useQuery");
    expect(dashboardSource).toContain("ceoAccessQuery.data?.canAccess");
    expect(dashboardSource).toContain("return <StaffDashboard />");
  });

  it("allows only read tools and protects finance details", () => {
    expect(CEO_READ_ONLY_TOOL_NAMES).toContain("get_tasks_and_reports");
    expect(CEO_READ_ONLY_TOOL_NAMES).toContain("get_livestream_stats");
    expect([...CEO_READ_ONLY_TOOL_NAMES]).not.toContain("generate_document");
    expect(routerSource).toContain("readOnlyToolNameSet.has(name)");
    expect(routerSource).toContain("個別取引、給与、その他財務金額を推測・検索せず");
    expect(routerSource).toContain("round < 4");
  });

  it("keeps snapshot SQL read-only and aggregates only the canonical pit fee category", () => {
    expect(serviceSource).not.toMatch(/sql`\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i);
    expect(serviceSource).toContain("dataType = 'shop_stats'");
    expect(serviceSource).not.toContain("dataType = 'ads'");
    expect(serviceSource).toContain("category = '売上高-ライブ枠料収入'");
    expect(serviceSource).not.toContain("SELECT * FROM company_cashflows");
    expect(serviceSource).toContain("CASHFLOW_REFERENCE_CNY_JPY");
  });

  it("shows source breakdown and never labels registered live GMV as an additive total", () => {
    expect(uiSource).toContain("直近30日 全社売上・収入");
    expect(uiSource).toContain("重複計上を防止");
    expect(uiSource).toContain("登録ライブGMV（比較値）");
    expect(uiSource).toContain("坑位费JPY参考額");
    expect(uiSource).not.toContain("[...messages, nextUserMessage]");
    expect(uiSource).not.toContain("syncLark");
  });
});
