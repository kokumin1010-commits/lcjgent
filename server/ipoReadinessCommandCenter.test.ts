import { describe, expect, it } from "vitest";
import { buildIpoReadinessCommandCenter, IPO_READINESS_ROADMAP } from "./ipoReadinessCommandCenter";

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

const pnl = (month: string, operatingProfitJpy: number, status: "draft" | "closed" | "audited" = "closed") => ({
  month,
  revenueJpy: 100_000_000,
  grossProfitJpy: 40_000_000,
  operatingProfitJpy,
  netProfitJpy: operatingProfitJpy * 0.7,
  status,
});

describe("buildIpoReadinessCommandCenter", () => {
  it("uses a July fiscal year and the user-defined N-2 H1 target", () => {
    const result = buildIpoReadinessCommandCenter({ monthlyPnl: [], cashReferenceMonths: [], now: "2026-09-12" });
    expect(result.fiscalYearEndMonth).toBe(7);
    expect(result.fiscalYearLabel).toBe("2027年7月期");
    expect(result.currentStage.key).toBe("n2_h1");
    expect(result.pace.targetOperatingProfitJpy).toBe(100_000_000);
    expect(result.actual.dataStatus).toBe("missing");
    expect(result.actual.missingCloseMonths).toEqual(["2026-08"]);
    expect(result.pace.progressRate).toBeNull();
    expect(result.actualBasis).toBe("not_available");
  });

  it("counts only closed or audited profit toward target and keeps draft separate", () => {
    const result = buildIpoReadinessCommandCenter({
      monthlyPnl: [pnl("2026-08", 20_000_000, "closed"), pnl("2026-09", 30_000_000, "draft")],
      cashReferenceMonths: [],
      now: "2026-10-15",
    });
    expect(result.actual.formalOperatingProfitJpy).toBe(20_000_000);
    expect(result.actual.draftOperatingProfitJpy).toBe(30_000_000);
    expect(result.actual.missingCloseMonths).toEqual(["2026-09"]);
    expect(result.pace.targetGapJpy).toBe(80_000_000);
    expect(result.pace.remainingMonths).toBe(5);
    expect(result.pace.requiredMonthlyOperatingProfitJpy).toBe(16_000_000);
    expect(result.pace.projectedOperatingProfitJpy).toBe(120_000_000);
    expect(result.pace.progressRate).toBe(0.2);
  });

  it("switches to the N-2 full-year target after January without resetting August profit", () => {
    const months = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
    const result = buildIpoReadinessCommandCenter({
      monthlyPnl: months.map((month) => pnl(month, 10_000_000)),
      cashReferenceMonths: [],
      now: "2027-02-01",
    });
    expect(result.currentStage.key).toBe("n2_full");
    expect(result.pace.targetOperatingProfitJpy).toBe(200_000_000);
    expect(result.actual.formalOperatingProfitJpy).toBe(60_000_000);
    expect(result.pace.remainingMonths).toBe(6);
    expect(result.pace.requiredMonthlyOperatingProfitJpy).toBe(23_333_333);
  });

  it("uses 500 million yen for N-1 and for the listing-preparation half year", () => {
    expect(IPO_READINESS_ROADMAP.find((stage) => stage.key === "n1_full")?.targetOperatingProfitJpy).toBe(500_000_000);
    expect(IPO_READINESS_ROADMAP.find((stage) => stage.key === "listing_h1")?.targetOperatingProfitJpy).toBe(500_000_000);
    expect(IPO_READINESS_ROADMAP.find((stage) => stage.key === "listing")?.periodLabel).toBe("2029年中旬");
  });

  it("keeps bank cash reference separate from formal accounting profit", () => {
    const result = buildIpoReadinessCommandCenter({
      monthlyPnl: [pnl("2026-08", 15_000_000)],
      cashReferenceMonths: [cash("2026-08", -3_000_000), cash("2026-09", 1_000_000)],
      now: "2026-09-12",
    });
    expect(result.actual.formalOperatingProfitJpy).toBe(15_000_000);
    expect(result.cashReference.operatingNetReferenceJpy).toBe(-2_000_000);
    expect(result.cashReference.monthly.map((row) => row.month)).toEqual(["2026-08", "2026-09"]);
    expect(result.cashReference.latestCompletedMonth?.month).toBe("2026-08");
    expect(result.cashReference.basis).toBe("bank_cashflow_reference");
    expect(result.actions.some((action) => action.key === "cash_reference_negative")).toBe(true);
    expect(result.disclaimers.join(" ")).toContain("不等于会计利润");
  });

  it("exposes original currencies, internal transfers, and duplicate candidates without treating them as profit", () => {
    const august = {
      ...cash("2026-08", 1_716_851.56),
      operatingIncomeJpy: 40_944_647,
      operatingIncomeCny: 26_224,
      operatingIncomeReferenceJpy: 41_482_239,
      operatingIncomeCount: 36,
      operatingExpenseJpy: 26_987_285,
      operatingExpenseCny: 623_322.07,
      operatingExpenseReferenceJpy: 39_765_387.44,
      operatingExpenseCount: 126,
      internalTransferIncomeCny: 591_822,
      internalTransferIncomeReferenceJpy: 12_132_351,
      internalTransferIncomeCount: 1,
      internalTransferExpenseJpy: 14_014_000,
      internalTransferExpenseReferenceJpy: 14_014_000,
      internalTransferExpenseCount: 1,
      bankNetReferenceJpy: -164_797.44,
      duplicateCandidateGroupCount: 4,
      duplicateCandidateRowCount: 18,
      linkedTransferCount: 1,
    };
    const result = buildIpoReadinessCommandCenter({ monthlyPnl: [], cashReferenceMonths: [august], now: "2026-09-12" });
    expect(result.cashReference.latestCompletedMonth).toMatchObject({
      month: "2026-08",
      operatingIncomeCny: 26_224,
      internalTransferIncomeCny: 591_822,
      duplicateCandidateGroupCount: 4,
      linkedTransferCount: 1,
    });
    expect(result.cashReference.completedOperatingNetReferenceJpy).toBe(1_716_852);
    expect(result.cashReference.completedMonthCount).toBe(1);
    expect(result.cashReference.targetGapReferenceJpy).toBe(98_283_148);
    expect(result.cashReference.requiredMonthlyReferenceJpy).toBe(19_656_630);
    expect(result.cashReference.remainingMonths).toBe(5);
    expect(result.actual.formalOperatingProfitJpy).toBe(0);
    expect(result.actualBasis).toBe("not_available");
  });

  it("generates actionable gaps when the projected pace is below target", () => {
    const result = buildIpoReadinessCommandCenter({
      monthlyPnl: [pnl("2026-08", 5_000_000), pnl("2026-09", 5_000_000)],
      cashReferenceMonths: [],
      now: "2026-10-10",
    });
    expect(result.pace.projectedOperatingProfitJpy).toBe(30_000_000);
    expect(result.actions.some((action) => action.key === "projection_below_target")).toBe(true);
    expect(result.actions.some((action) => action.key === "monthly_pace_below_required")).toBe(true);
  });
});
