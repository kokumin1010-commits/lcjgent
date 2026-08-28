import { describe, expect, it } from "vitest";
import {
  buildLiverAdEffectDashboard,
  buildLiverAdEffectRecord,
  LiverAdEffectValidationError,
  normalizeAdCostInput,
  resolveLinkedLiveAdCost,
} from "../shared/liverAdEffect";

describe("liver ad cost normalization", () => {
  it("keeps unknown, none and paid as three distinct states", () => {
    expect(normalizeAdCostInput("unknown", "999")).toBeNull();
    expect(normalizeAdCostInput("none", "999")).toBe(0);
    expect(normalizeAdCostInput("paid", "1500")).toBe(1500);
  });

  it("rejects paid status without a positive integer yen amount", () => {
    expect(() => normalizeAdCostInput("paid", 0)).toThrow(LiverAdEffectValidationError);
    expect(() => normalizeAdCostInput("paid", -1)).toThrow(LiverAdEffectValidationError);
    expect(() => normalizeAdCostInput("paid", 12.5)).toThrow(LiverAdEffectValidationError);
  });

  it("only attributes explicitly linked live budget", () => {
    expect(resolveLinkedLiveAdCost([
      { adType: "clip", totalBudget: 9000, liveBudget: 0 },
      { adType: "mixed", totalBudget: 6000, liveBudget: 2000 },
      { adType: "live", totalBudget: 3000, liveBudget: 0 },
    ])).toBe(5000);
    expect(resolveLinkedLiveAdCost([
      { adType: "mixed", totalBudget: 6000, liveBudget: 0 },
      { adType: "clip", totalBudget: 9000, liveBudget: 0 },
    ])).toBeNull();
  });
});

describe("liver ad effect records", () => {
  it("does not turn missing ad cost or metrics into zero", () => {
    const record = buildLiverAdEffectRecord({
      id: 1,
      livestreamDate: "2026-08-01T00:00:00.000Z",
      nativeAdCost: null,
      salesAmount: null,
    });
    expect(record.adStatus).toBe("unknown");
    expect(record.adCost).toBeNull();
    expect(record.gmv).toBeNull();
    expect(record.roas).toBeNull();
    expect(record.adAdjustedSalesContribution).toBeNull();
  });

  it("uses native ad cost first and flags a linked amount conflict", () => {
    const record = buildLiverAdEffectRecord({
      id: 2,
      livestreamDate: "2026-08-02T00:00:00.000Z",
      nativeAdCost: 1000,
      linkedAds: [{ adType: "live", totalBudget: 1200, liveBudget: 0 }],
      manualSalesAmount: 12000,
      gmv: 10000,
      salesAmount: 9000,
      orderCount: 4,
      viewerCount: 200,
      durationMinutes: 120,
      productItemsSold: 6,
    });
    expect(record.adCost).toBe(1000);
    expect(record.adCostSource).toBe("native");
    expect(record.adCostConflict).toBe(true);
    expect(record.gmv).toBe(12000);
    expect(record.roas).toBe(12);
    expect(record.adCostPerOrder).toBe(250);
    expect(record.viewerConversionRate).toBe(2);
    expect(record.gmvPerHour).toBe(6000);
    expect(record.adAdjustedSalesContribution).toBe(11000);
    expect(record.itemsSold).toBe(6);
  });

  it("uses linked live budget only when native cost is absent", () => {
    const record = buildLiverAdEffectRecord({
      id: 3,
      livestreamDate: "2026-08-03T00:00:00.000Z",
      nativeAdCost: null,
      linkedAds: [{ adType: "live", totalBudget: 2000, liveBudget: 0 }],
      salesAmount: 10000,
    });
    expect(record.adStatus).toBe("paid");
    expect(record.adCost).toBe(2000);
    expect(record.adCostSource).toBe("linked");
    expect(record.roas).toBe(5);
  });
});

describe("paid versus organic comparison", () => {
  it("compares known paid and none records while excluding unknown records", () => {
    const dashboard = buildLiverAdEffectDashboard([
      { id: 1, livestreamDate: "2026-08-01", nativeAdCost: 1000, salesAmount: 10000, orderCount: 10, itemsSold: 12, viewerCount: 100, durationMinutes: 60 },
      { id: 2, livestreamDate: "2026-08-02", nativeAdCost: 2000, salesAmount: 20000, orderCount: 20, itemsSold: 22, viewerCount: 200, durationMinutes: 120 },
      { id: 3, livestreamDate: "2026-08-03", nativeAdCost: 0, salesAmount: 5000, orderCount: 5, itemsSold: 6, viewerCount: 100, durationMinutes: 60 },
      { id: 4, livestreamDate: "2026-08-04", nativeAdCost: 0, salesAmount: 7000, orderCount: 7, itemsSold: 8, viewerCount: 100, durationMinutes: 60 },
      { id: 5, livestreamDate: "2026-08-05", nativeAdCost: null, salesAmount: 99999, orderCount: 99, itemsSold: 99, viewerCount: 99, durationMinutes: 60 },
    ]);

    expect(dashboard.paid.streamCount).toBe(2);
    expect(dashboard.none.streamCount).toBe(2);
    expect(dashboard.unknownCount).toBe(1);
    expect(dashboard.comparable).toBe(true);
    expect(dashboard.paid.sampleSufficient).toBe(true);
    expect(dashboard.none.sampleSufficient).toBe(true);
    expect(dashboard.paid.averageGmv).toEqual({ value: 15000, sampleCount: 2 });
    expect(dashboard.none.averageGmv).toEqual({ value: 6000, sampleCount: 2 });
    expect(dashboard.differences.averageGmv).toEqual({ paid: 15000, none: 6000, absolute: 9000, percent: 150 });
    expect(dashboard.paid.averageRoas.value).toBe(10);
  });

  it("reports insufficient samples without inventing missing averages", () => {
    const dashboard = buildLiverAdEffectDashboard([
      { id: 1, livestreamDate: "2026-08-01", nativeAdCost: 1000, salesAmount: null },
      { id: 2, livestreamDate: "2026-08-02", nativeAdCost: null, salesAmount: 5000 },
    ]);
    expect(dashboard.paid.sampleSufficient).toBe(false);
    expect(dashboard.none.streamCount).toBe(0);
    expect(dashboard.comparable).toBe(false);
    expect(dashboard.paid.averageGmv).toEqual({ value: null, sampleCount: 0 });
  });
});
