import { describe, expect, it } from "vitest";
import {
  buildIpoOperatingPlan,
  IPO_TAX_FUNDING_POLICY,
  IPO_TARGET_OPERATING_MARGIN_PCT,
} from "./ipoReadinessAssumptions";

describe("IPO operating plan assumptions", () => {
  it("uses the fixed company operating margin of 20 percent", () => {
    expect(IPO_TARGET_OPERATING_MARGIN_PCT).toBe(20);
    expect(buildIpoOperatingPlan(100_000_000)).toEqual({
      targetOperatingMarginPct: 20,
      targetOperatingCostRatioPct: 80,
      requiredRevenueJpy: 500_000_000,
      operatingCostLimitJpy: 400_000_000,
    });
    expect(buildIpoOperatingPlan(200_000_000)).toMatchObject({
      requiredRevenueJpy: 1_000_000_000,
      operatingCostLimitJpy: 800_000_000,
    });
    expect(buildIpoOperatingPlan(500_000_000)).toMatchObject({
      requiredRevenueJpy: 2_500_000_000,
      operatingCostLimitJpy: 2_000_000_000,
    });
  });

  it("does not fabricate a tax rate, tax amount, or after-tax forecast", () => {
    expect(IPO_TAX_FUNDING_POLICY).toMatchObject({
      basis: "pretax_profit_after_non_operating_and_tax_adjustments",
      reserveRatePct: null,
      reserveJpy: null,
      afterTaxProfitJpy: null,
    });
    expect(IPO_TAX_FUNDING_POLICY.descriptionJa).toContain("固定税率や税額は自動計上しません");
  });
});
