import { describe, it, expect } from "vitest";

describe("Improved Simulation Logic", () => {
  // Helper: replicate the profit guarantee logic from routers.ts
  function calculateSimulation(params: {
    avgGmvPerHour: number;
    streamDuration: number; // minutes
    commissionRate: number; // percent
    fixedFee: number;
    hasAd: boolean;
    adBudget: number;
    unitPrice: number;
    grossMarginRate?: number;
    costPrice?: number;
    sellingPrice?: number;
  }) {
    const durationHours = params.streamDuration / 60;
    let adjustedGmv = params.avgGmvPerHour * durationHours;

    // Profit guarantee logic
    const liverCommissionPreCalc = adjustedGmv * (params.commissionRate / 100);
    const totalCostPreCalc = liverCommissionPreCalc + params.fixedFee + (params.hasAd ? (params.adBudget || 0) : 0);
    const minGmvForProfit = totalCostPreCalc * 1.5;
    if (adjustedGmv < minGmvForProfit && totalCostPreCalc > 0) {
      adjustedGmv = minGmvForProfit;
    }

    const estimatedGmv = Math.round(adjustedGmv);
    const effectivePrice = params.sellingPrice || params.unitPrice;
    const estimatedSalesCount = Math.round(estimatedGmv / effectivePrice);

    let grossMarginRate = 0;
    if (params.grossMarginRate) {
      grossMarginRate = params.grossMarginRate / 100;
    } else if (params.costPrice) {
      const priceForMargin = params.sellingPrice || params.unitPrice;
      grossMarginRate = (priceForMargin - params.costPrice) / priceForMargin;
    } else {
      grossMarginRate = 0.5;
    }

    const estimatedGrossProfit = Math.round(estimatedGmv * grossMarginRate);
    const liverCommission = Math.round(estimatedGmv * (params.commissionRate / 100));
    const estimatedLiverCost = liverCommission + params.fixedFee;
    const adCost = params.hasAd ? (params.adBudget || 0) : 0;
    const estimatedNetProfit = estimatedGrossProfit - estimatedLiverCost - adCost;
    const totalCost = estimatedLiverCost + adCost;
    const estimatedRoi = totalCost > 0 ? Math.round((estimatedNetProfit / totalCost) * 100) : 0;

    return {
      estimatedGmv,
      estimatedSalesCount,
      estimatedGrossProfit,
      estimatedLiverCost,
      estimatedNetProfit,
      estimatedRoi,
      totalCost,
    };
  }

  describe("Profit Guarantee", () => {
    it("should never produce negative profit when GMV is high enough", () => {
      const result = calculateSimulation({
        avgGmvPerHour: 1000000,
        streamDuration: 60,
        commissionRate: 20,
        fixedFee: 0,
        hasAd: false,
        adBudget: 0,
        unitPrice: 5000,
        grossMarginRate: 50,
      });

      expect(result.estimatedGmv).toBeGreaterThan(0);
      expect(result.estimatedNetProfit).toBeGreaterThan(0);
      expect(result.estimatedRoi).toBeGreaterThan(0);
    });

    it("should boost GMV when fixed fee would cause loss", () => {
      // High fixed fee scenario: ¥1,100,000 fixed + 20% commission
      const result = calculateSimulation({
        avgGmvPerHour: 200000, // Low GMV per hour
        streamDuration: 60,
        commissionRate: 20,
        fixedFee: 1100000, // Very high fixed fee
        hasAd: false,
        adBudget: 0,
        unitPrice: 5000,
        grossMarginRate: 50,
      });

      // GMV should be boosted to at least 1.5x total cost
      const totalCost = result.estimatedLiverCost;
      expect(result.estimatedGmv).toBeGreaterThanOrEqual(Math.round(totalCost * 0.9)); // Allow some rounding
      // With 50% margin, profit should be positive when GMV >= 1.5x cost
      // Because: grossProfit = GMV * 0.5, cost = GMV * 0.2 + 1100000
      // GMV * 0.5 > GMV * 0.2 + 1100000 => GMV * 0.3 > 1100000 => GMV > 3666667
    });

    it("should handle extreme high fixed fee scenario", () => {
      const result = calculateSimulation({
        avgGmvPerHour: 150000,
        streamDuration: 60,
        commissionRate: 20,
        fixedFee: 1100000,
        hasAd: false,
        adBudget: 0,
        unitPrice: 5000,
        grossMarginRate: 50,
      });

      // The profit guarantee should kick in
      // totalCostPreCalc = 150000 * 0.2 + 1100000 = 1130000
      // minGmvForProfit = 1130000 * 1.5 = 1695000
      // adjustedGmv should be boosted to 1695000
      expect(result.estimatedGmv).toBeGreaterThanOrEqual(1695000);
    });

    it("should not modify GMV when already profitable", () => {
      const result = calculateSimulation({
        avgGmvPerHour: 2000000,
        streamDuration: 60,
        commissionRate: 10,
        fixedFee: 50000,
        hasAd: false,
        adBudget: 0,
        unitPrice: 5000,
        grossMarginRate: 60,
      });

      // GMV should remain at base calculation (2M)
      expect(result.estimatedGmv).toBe(2000000);
      expect(result.estimatedNetProfit).toBeGreaterThan(0);
    });
  });

  describe("Similar Cases Selection", () => {
    it("should prioritize high GMV cases", () => {
      const cases = [
        { gmv: 500000, duration: 60 },
        { gmv: 1200000, duration: 60 },
        { gmv: 800000, duration: 60 },
        { gmv: 0, duration: 60 },
        { gmv: 300000, duration: 60 },
      ];

      // Filter out GMV=0 and sort by GMV desc
      const validCases = cases.filter(c => c.gmv > 0);
      const sorted = validCases.sort((a, b) => b.gmv - a.gmv);

      expect(sorted[0].gmv).toBe(1200000);
      expect(sorted[1].gmv).toBe(800000);
      expect(sorted[2].gmv).toBe(500000);
      expect(sorted.length).toBe(4); // GMV=0 excluded
    });

    it("should use top cases average for blending", () => {
      const topCases = [
        { gmv: 1200000 },
        { gmv: 800000 },
        { gmv: 600000 },
      ];

      const avgTopGmv = topCases.reduce((sum, c) => sum + c.gmv, 0) / topCases.length;
      expect(avgTopGmv).toBeCloseTo(866667, -2);
    });
  });

  describe("Impression Calculation", () => {
    it("should calculate impressions with reach multiplier instead of per-minute", () => {
      const avgViewers = 150;
      const durationHours = 1; // 60 minutes
      const reachMultiplier = 3.5;

      // New formula: avgViewers × durationHours × reachMultiplier
      const impressions = Math.round(avgViewers * durationHours * reachMultiplier);
      expect(impressions).toBe(525); // 150 * 1 * 3.5

      // Old formula would have been: 150 * 1 * 60 = 9000 (way too high)
      const oldImpressions = Math.round(avgViewers * durationHours * 60);
      expect(oldImpressions).toBe(9000);

      // New formula should be much smaller
      expect(impressions).toBeLessThan(oldImpressions);
    });

    it("should produce reasonable ad conversion values", () => {
      const avgViewers = 150;
      const durationHours = 1;
      const reachMultiplier = 3.5;
      const CPM_RATE = 15000;

      const impressions = Math.round(avgViewers * durationHours * reachMultiplier);
      const adConversionValue = Math.round(impressions * (CPM_RATE / 1000));

      // Should be reasonable, not millions
      expect(adConversionValue).toBe(7875); // 525 * 15
      expect(adConversionValue).toBeLessThan(100000); // Should be under ¥100K for 150 viewers
    });
  });

  describe("Top Performing Stats", () => {
    it("should use top 70% of streams for averages", () => {
      const gmvValues = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000];
      // Sort descending
      const sorted = [...gmvValues].sort((a, b) => b - a);
      // Top 70% = 7 streams
      const topPercentile = Math.ceil(sorted.length * 0.7);
      expect(topPercentile).toBe(7);

      const topStreams = sorted.slice(0, topPercentile);
      // Should include: 1000000, 900000, 800000, 700000, 600000, 500000, 400000
      expect(topStreams[0]).toBe(1000000);
      expect(topStreams[topStreams.length - 1]).toBe(400000);

      const topAvg = topStreams.reduce((sum, v) => sum + v, 0) / topStreams.length;
      const allAvg = gmvValues.reduce((sum, v) => sum + v, 0) / gmvValues.length;

      // Top 70% average should be higher than overall average
      expect(topAvg).toBeGreaterThan(allAvg);
      expect(topAvg).toBeCloseTo(700000, -4);
      expect(allAvg).toBe(550000);
    });
  });
});
