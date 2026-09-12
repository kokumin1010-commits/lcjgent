import { describe, expect, it } from "vitest";
import { buildIpoReadinessCommandCenter } from "./ipoReadinessCommandCenter";
import {
  buildIpoBoardReportSummary,
  buildIpoCashExpenseDrivers,
  buildIpoCloseQuality,
  buildIpoMonthlyTrend,
  buildIpoPerformanceVariance,
  buildIpoProfitBridge,
  buildIpoRiskRegister,
  buildIpoScenarios,
  buildIpoTargetReverse,
  buildIpoTaskReadiness,
} from "./ipoReadinessPlanning";

const cash = (month: string, net: number) => ({
  month,
  operatingIncomeJpy: net > 0 ? net : 0,
  operatingIncomeCny: 0,
  operatingIncomeReferenceJpy: net > 0 ? net : 0,
  operatingIncomeCount: net > 0 ? 1 : 0,
  operatingExpenseJpy: net < 0 ? Math.abs(net) : 0,
  operatingExpenseCny: 0,
  operatingExpenseReferenceJpy: net < 0 ? Math.abs(net) : 0,
  operatingExpenseCount: net < 0 ? 1 : 0,
  internalTransferIncomeJpy: 0,
  internalTransferIncomeCny: 0,
  internalTransferIncomeReferenceJpy: 0,
  internalTransferIncomeCount: 0,
  internalTransferExpenseJpy: 0,
  internalTransferExpenseCny: 0,
  internalTransferExpenseReferenceJpy: 0,
  internalTransferExpenseCount: 0,
  operatingNetReferenceJpy: net,
  bankNetReferenceJpy: net,
  duplicateCandidateGroupCount: 0,
  duplicateCandidateRowCount: 0,
  linkedTransferCount: 0,
});

const settings = {
  targetOperatingMarginPct: 20,
  downsideFactor: 0.8,
  baseFactor: 1,
  upsideFactor: 1.2,
  monthlyCloseDueDay: 10,
};

function coreWithFormal() {
  return buildIpoReadinessCommandCenter({
    monthlyPnl: [{ month: "2026-08", revenueJpy: 100_000_000, grossProfitJpy: 40_000_000, operatingProfitJpy: 20_000_000, netProfitJpy: 14_000_000, status: "closed" }],
    cashReferenceMonths: [cash("2026-08", 1_716_851.56)],
    now: "2026-09-12",
  });
}

describe("IPO readiness V2 planning", () => {
  it("allocates the stage target exactly and never substitutes cash for formal profit", () => {
    const core = buildIpoReadinessCommandCenter({ monthlyPnl: [], cashReferenceMonths: [cash("2026-08", 1_716_851.56)], now: "2026-09-12" });
    const trend = buildIpoMonthlyTrend({ core, monthlyPlans: [] });
    expect(trend).toHaveLength(6);
    expect(trend.reduce((sum, row) => sum + Number(row.planOperatingProfitJpy || 0), 0)).toBe(100_000_000);
    expect(trend[0].formalOperatingProfitJpy).toBeNull();
    expect(trend[0].cashOperatingNetReferenceJpy).toBe(1_716_852);
    expect(trend[0].formalVarianceJpy).toBeNull();
    expect(trend[0].planSource).toBe("equal_company_plan");
  });

  it("redistributes the remaining company target after a monthly override", () => {
    const core = coreWithFormal();
    const trend = buildIpoMonthlyTrend({ core, monthlyPlans: [
      { month: "2026-08", revenueTargetJpy: 90_000_000, grossProfitTargetJpy: 35_000_000, operatingProfitTargetJpy: null },
      { month: "2026-09", revenueTargetJpy: 120_000_000, grossProfitTargetJpy: 48_000_000, operatingProfitTargetJpy: 25_000_000 },
    ] });
    expect(trend.find((row) => row.month === "2026-09")).toMatchObject({
      revenueTargetJpy: 120_000_000,
      grossProfitTargetJpy: 48_000_000,
      planOperatingProfitJpy: 25_000_000,
      planSource: "monthly_override",
    });
    expect(trend.find((row) => row.month === "2026-10")?.planSource).toBe("equal_company_plan");
    expect(trend.reduce((sum, row) => sum + Number(row.planOperatingProfitJpy || 0), 0)).toBe(100_000_000);
    expect(trend.find((row) => row.month === "2026-08")?.planOperatingProfitJpy).toBe(15_000_000);
    const variance = buildIpoPerformanceVariance(trend);
    expect(variance.revenue).toMatchObject({ ready: true, targetJpy: 90_000_000, actualJpy: 100_000_000, varianceJpy: 10_000_000 });
    expect(variance.grossProfit).toMatchObject({ ready: true, targetJpy: 35_000_000, actualJpy: 40_000_000, varianceJpy: 5_000_000 });
    expect(variance.operatingProfit).toMatchObject({ ready: true, targetJpy: 15_000_000, actualJpy: 20_000_000, varianceJpy: 5_000_000 });
  });

  it("back-solves required revenue only from an explicitly configured operating margin", () => {
    const core = coreWithFormal();
    const ready = buildIpoTargetReverse({ core, settings });
    expect(ready.remainingOperatingProfitJpy).toBe(80_000_000);
    expect(ready.requiredRemainingRevenueJpy).toBe(400_000_000);
    expect(ready.requiredMonthlyRevenueJpy).toBe(80_000_000);
    expect(buildIpoTargetReverse({ core, settings: { ...settings, targetOperatingMarginPct: null } }).ready).toBe(false);
  });

  it("keeps formal scenario output unavailable without finalized P/L and labels cash scenarios separately", () => {
    const missingCore = buildIpoReadinessCommandCenter({ monthlyPnl: [], cashReferenceMonths: [cash("2026-08", 2_000_000)], now: "2026-09-12" });
    const missing = buildIpoScenarios({ core: missingCore, settings });
    expect(missing.formalReady).toBe(false);
    expect(missing.scenarios.every((row) => row.formalProjectedOperatingProfitJpy == null)).toBe(true);
    expect(missing.scenarios.map((row) => row.cashReferenceProjectedJpy)).toEqual([10_000_000, 12_000_000, 14_000_000]);
    const formal = buildIpoScenarios({ core: coreWithFormal(), settings });
    expect(formal.scenarios.map((row) => row.formalProjectedOperatingProfitJpy)).toEqual([100_000_000, 120_000_000, 140_000_000]);
  });

  it("builds a formal P&L bridge and flags overdue monthly close", () => {
    const core = coreWithFormal();
    const bridge = buildIpoProfitBridge(core);
    expect(bridge).toMatchObject({ revenueJpy: 100_000_000, costOfSalesJpy: 60_000_000, grossProfitJpy: 40_000_000, operatingExpensesJpy: 20_000_000, operatingProfitJpy: 20_000_000 });
    expect(bridge.grossMarginPct).toBe(40);
    expect(bridge.operatingMarginPct).toBe(20);
    const missingCore = buildIpoReadinessCommandCenter({ monthlyPnl: [], cashReferenceMonths: [], now: "2026-09-12" });
    const quality = buildIpoCloseQuality({ core: missingCore, monthlyCloseDueDay: 10 });
    expect(quality.overdueMonths).toEqual(["2026-08"]);
    expect(quality.closeCompletionRate).toBe(0);
  });

  it("aggregates cash expense categories and calculates task and evidence readiness", () => {
    const drivers = buildIpoCashExpenseDrivers([
      { category: "广告", currency: "CNY", amount: 100, referenceJpy: 2050, recordCount: 1 },
      { category: "广告", currency: "CNY", amount: 200, referenceJpy: 4100, recordCount: 2 },
      { category: "物流", currency: "JPY", amount: 3000, referenceJpy: 3000, recordCount: 1 },
    ]);
    expect(drivers.totalReferenceJpy).toBe(9150);
    expect(drivers.rows[0]).toMatchObject({ category: "广告", amount: 300, referenceJpy: 6150, recordCount: 3 });
    const tasks = [
      { id: 1, workstream: "audit", title: "A", priority: "critical", status: "done", progress: 100, evidence: [] },
      { id: 2, workstream: "audit", title: "B", priority: "high", status: "blocked", progress: 20, dueDate: "2026-09-01", blocker: "资料不足", evidence: [{ label: "资料", url: "https://example.com/a" }] },
    ];
    const readiness = buildIpoTaskReadiness({ tasks, asOf: "2026-09-12" });
    expect(readiness).toMatchObject({ totalCount: 2, completedCount: 1, blockedCount: 1, overdueCount: 1, completedWithoutEvidenceCount: 1, evidenceCoverageRate: 0.5 });
    const core = coreWithFormal();
    const closeQuality = buildIpoCloseQuality({ core, monthlyCloseDueDay: 10 });
    const risks = buildIpoRiskRegister({ core, closeQuality, taskReadiness: readiness });
    expect(risks.map((risk) => risk.key)).toEqual(expect.arrayContaining(["blocked_tasks", "overdue_tasks", "completed_without_evidence", "task_governance_missing"]));
  });

  it("freezes all bases and disclaimers into the board report snapshot", () => {
    const core = coreWithFormal();
    const trend = buildIpoMonthlyTrend({ core, monthlyPlans: [] });
    const targetReverse = buildIpoTargetReverse({ core, settings });
    const performanceVariance = buildIpoPerformanceVariance(trend);
    const scenarios = buildIpoScenarios({ core, settings });
    const profitBridge = buildIpoProfitBridge(core);
    const closeQuality = buildIpoCloseQuality({ core, monthlyCloseDueDay: 10 });
    const taskReadiness = buildIpoTaskReadiness({ tasks: [], asOf: core.asOf });
    const cashExpenseDrivers = buildIpoCashExpenseDrivers([]);
    const risks = buildIpoRiskRegister({ core, closeQuality, taskReadiness });
    const report = buildIpoBoardReportSummary({ core, trend, targetReverse, performanceVariance, scenarios, profitBridge, closeQuality, taskReadiness, risks, cashExpenseDrivers });
    expect(report.schemaVersion).toBe(1);
    expect(report.formalPerformance.operatingProfitJpy).toBe(20_000_000);
    expect(report.cashReference.completedOperatingNetReferenceJpy).toBe(1_716_852);
    expect(report.performanceVariance.operatingProfit.ready).toBe(true);
    expect(report.disclaimers.join(" ")).toContain("不等于会计利润");
  });
});
