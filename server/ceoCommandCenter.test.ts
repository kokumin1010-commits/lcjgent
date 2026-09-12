import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildCeoCommandCenterOverview,
  type CeoCommandCenterRawData,
} from "./ceoCommandCenter";
import { CEO_READ_ONLY_TOOL_NAMES } from "./ceoCommandCenterRouter";

const root = path.resolve(import.meta.dirname, "..");

function raw(overrides: Partial<CeoCommandCenterRawData> = {}): CeoCommandCenterRawData {
  return {
    today: "2026-09-13",
    generatedAt: new Date("2026-09-13T10:00:00.000Z"), // 19:00 JST
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
    current30Gmv: 12_000_000,
    previous30Gmv: 10_000_000,
    current30Orders: 420,
    current30AdCost: 800_000,
    current30SessionCount: 12,
    previous30SessionCount: 10,
    trendRows: [
      { date: "2026-09-12", gmv: 500_000, orders: 20, sessionCount: 1 },
      { date: "2026-09-13", gmv: 600_000, orders: 24, sessionCount: 2 },
    ],
    ...overrides,
  };
}

describe("CEO command center overview", () => {
  it("builds verified KPI values and keeps missing trend dates as null instead of zero", () => {
    const result = buildCeoCommandCenterOverview(raw());

    expect(result.readOnly).toBe(true);
    expect(result.kpis.reportRate).toBe(92.9);
    expect(result.kpis.registeredGmv30d).toBe(12_000_000);
    expect(result.kpis.gmvChangePercent).toBe(20);
    expect(result.trend).toHaveLength(14);
    expect(result.trend.find((point) => point.date === "2026-09-11")).toMatchObject({
      gmv: null,
      orders: null,
      hasData: false,
    });
    expect(result.trend.find((point) => point.date === "2026-09-13")).toMatchObject({
      gmv: 600_000,
      orders: 24,
      hasData: true,
    });
    expect(result.departments.find((item) => item.id === "finance")?.status).toBe("restricted");
  });

  it("treats missing livestream registration as unknown rather than zero performance", () => {
    const result = buildCeoCommandCenterOverview(raw({
      current30Gmv: 0,
      current30Orders: 0,
      current30AdCost: 0,
      current30SessionCount: 0,
      trendRows: [],
    }));

    expect(result.kpis.registeredGmv30d).toBeNull();
    expect(result.kpis.registeredOrders30d).toBeNull();
    expect(result.alerts.find((item) => item.id === "livestream-no-data")?.detail).toContain("登録済みライブデータがない");
  });

  it("keeps a just-after-midnight report gap informational instead of treating hour 24 as after-hours", () => {
    const result = buildCeoCommandCenterOverview(raw({
      generatedAt: new Date("2026-09-12T15:05:00.000Z"), // 00:05 JST
      activeReportProfiles: 28,
      submittedReportProfiles: 20,
    }));

    expect(result.alerts.find((item) => item.id === "daily-report-progress")?.severity).toBe("info");
  });

  it("raises a high-priority report alert after business hours and preserves the auditable missing count", () => {
    const result = buildCeoCommandCenterOverview(raw({
      activeReportProfiles: 28,
      submittedReportProfiles: 20,
      missingReportNames: ["テスト担当A", "テスト担当B"],
    }));

    const alert = result.alerts.find((item) => item.id === "daily-report-progress");
    expect(alert).toMatchObject({ severity: "high", count: 8, href: "/master/reports" });
    expect(result.reports.missingNames).toEqual(["テスト担当A", "テスト担当B"]);
    expect(result.reports.missingNamesTruncated).toBe(true);
  });

  it("keeps morning meeting failures out of completed health and points to the retained record", () => {
    const result = buildCeoCommandCenterOverview(raw({
      morningTotal: 2,
      morningCompleted: 1,
      morningFailed: 1,
    }));

    expect(result.kpis.morningStatus).toBe("failed");
    expect(result.alerts.find((item) => item.id === "morning-failed")).toMatchObject({
      severity: "high",
      href: "/master/morning-meeting",
    });
    expect(result.departments.find((item) => item.id === "morning")?.status).toBe("critical");
  });

  it("marks configured Lark sync as stale after eight hours without calling a mutation", () => {
    const result = buildCeoCommandCenterOverview(raw({
      larkLatestSyncedAt: new Date("2026-09-12T23:00:00.000Z"),
    }));

    expect(result.lark.configured).toBe(true);
    expect(result.lark.healthy).toBe(false);
    expect(result.alerts.find((item) => item.id === "lark-stale")?.severity).toBe("medium");
  });
});

describe("CEO command center security and UI contracts", () => {
  const routerSource = readFileSync(path.join(root, "server/ceoCommandCenterRouter.ts"), "utf8");
  const serviceSource = readFileSync(path.join(root, "server/ceoCommandCenter.ts"), "utf8");
  const dashboardSource = readFileSync(path.join(root, "client/src/pages/Dashboard.tsx"), "utf8");
  const uiSource = readFileSync(path.join(root, "client/src/components/CeoCommandCenter.tsx"), "utf8");

  it("exposes overview and chat through adminProcedure only", () => {
    expect(routerSource).toContain("overview: adminProcedure.query");
    expect(routerSource).toContain("ask: adminProcedure");
    expect(routerSource).not.toMatch(/overview:\s*protectedProcedure/);
    expect(routerSource).not.toMatch(/ask:\s*protectedProcedure/);
  });

  it("allows only read tools and excludes document generation or arbitrary writes", () => {
    expect(CEO_READ_ONLY_TOOL_NAMES).toContain("get_tasks_and_reports");
    expect(CEO_READ_ONLY_TOOL_NAMES).toContain("get_livestream_stats");
    expect([...CEO_READ_ONLY_TOOL_NAMES]).not.toContain("generate_ppt");
    expect([...CEO_READ_ONLY_TOOL_NAMES]).not.toContain("generate_document");
    expect(routerSource).toContain("readOnlyToolNameSet.has(name)");
    expect(routerSource).toContain("すべて参照データです");
    expect(routerSource).toContain("round < 4");
  });

  it("keeps all snapshot SQL read-only and preserves the finance secondary lock", () => {
    expect(serviceSource).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i);
    expect(serviceSource).toContain("二次認証で保護");
    expect(serviceSource).toContain("未登録日は0ではなくnull");
    expect(serviceSource).toContain("COALESCE(NULLIF(salesAmount, 0), NULLIF(gmv, 0), 0)");
  });

  it("shows the command center only to admins and leaves the staff dashboard intact", () => {
    expect(dashboardSource).toContain('user?.role === "admin"');
    expect(dashboardSource).toContain("return <CeoCommandCenter />");
    expect(dashboardSource).toContain("return <StaffDashboard />");
  });

  it("shows Lark evidence without exposing a sync mutation on the CEO screen", () => {
    expect(uiSource).toContain("Lark / Feishu");
    expect(uiSource).toContain("未登録≠0");
    expect(uiSource).toContain("回答の根拠");
    expect(uiSource).not.toContain("syncLark");
    expect(uiSource).not.toContain("[...messages, nextUserMessage]");
    expect(uiSource).not.toContain("自動実行します");
  });
});
