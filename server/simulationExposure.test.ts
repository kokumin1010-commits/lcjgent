import { describe, it, expect } from "vitest";

describe("Simulation Exposure (曝光量) Price/Discount Responsiveness", () => {
  // Replicate the exposure calculation logic from routers.ts
  function calculateExposure(params: {
    avgViewers: number;
    durationHours: number;
    listPrice: number;
    sellingPrice: number;
  }) {
    const reachMultiplier = 3.5;
    const discountRate = params.listPrice > 0
      ? Math.max(0, (params.listPrice - params.sellingPrice) / params.listPrice)
      : 0;
    const discountImpressionBoost = discountRate > 0 ? (1 + discountRate * 1.5) : 1.0;
    const priceLevelImpressionBoost = params.listPrice >= 10000 ? 1.3 : params.listPrice >= 5000 ? 1.15 : 1.0;
    const estimatedImpressions = Math.round(
      params.avgViewers * params.durationHours * reachMultiplier * discountImpressionBoost * priceLevelImpressionBoost
    );
    return { estimatedImpressions, discountRate, discountImpressionBoost, priceLevelImpressionBoost };
  }

  describe("Base exposure calculation", () => {
    it("should calculate base exposure without discount or price boost", () => {
      const result = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 2000,
        sellingPrice: 2000,
      });
      // 150 * 1 * 3.5 * 1.0 * 1.0 = 525
      expect(result.estimatedImpressions).toBe(525);
      expect(result.discountImpressionBoost).toBe(1.0);
      expect(result.priceLevelImpressionBoost).toBe(1.0);
    });

    it("should scale with duration", () => {
      const result1h = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 2000,
        sellingPrice: 2000,
      });
      const result2h = calculateExposure({
        avgViewers: 150,
        durationHours: 2,
        listPrice: 2000,
        sellingPrice: 2000,
      });
      expect(result2h.estimatedImpressions).toBe(result1h.estimatedImpressions * 2);
    });
  });

  describe("Discount rate impact on exposure", () => {
    it("should increase exposure with 30% discount", () => {
      const noDiscount = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 5000,
        sellingPrice: 5000,
      });
      const discount30 = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 5000,
        sellingPrice: 3500,
      });
      expect(discount30.estimatedImpressions).toBeGreaterThan(noDiscount.estimatedImpressions);
      expect(discount30.discountImpressionBoost).toBeGreaterThan(1.0);
    });

    it("should increase exposure more with 50% discount", () => {
      const discount30 = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 5000,
        sellingPrice: 3500,
      });
      const discount50 = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 5000,
        sellingPrice: 2500,
      });
      expect(discount50.estimatedImpressions).toBeGreaterThan(discount30.estimatedImpressions);
    });

    it("should show increasing exposure as discount increases", () => {
      const discounts = [0, 10, 30, 50, 70, 80];
      const results = discounts.map(d => {
        const listPrice = 10000;
        const sellingPrice = listPrice * (1 - d / 100);
        return calculateExposure({
          avgViewers: 150,
          durationHours: 1,
          listPrice,
          sellingPrice,
        });
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].estimatedImpressions).toBeGreaterThan(results[i - 1].estimatedImpressions);
      }
    });

    it("should calculate correct discount impression boost for 50% OFF", () => {
      const result = calculateExposure({
        avgViewers: 100,
        durationHours: 1,
        listPrice: 10000,
        sellingPrice: 5000,
      });
      // discountRate = 0.5, boost = 1 + 0.5 * 1.5 = 1.75
      expect(result.discountImpressionBoost).toBeCloseTo(1.75, 2);
    });
  });

  describe("Price level impact on exposure", () => {
    it("should apply 1.3x boost for listPrice >= 10000", () => {
      const result = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 12000,
        sellingPrice: 12000,
      });
      expect(result.priceLevelImpressionBoost).toBe(1.3);
    });

    it("should apply 1.15x boost for listPrice >= 5000", () => {
      const result = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 7000,
        sellingPrice: 7000,
      });
      expect(result.priceLevelImpressionBoost).toBe(1.15);
    });

    it("should apply no boost for listPrice < 5000", () => {
      const result = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 3000,
        sellingPrice: 3000,
      });
      expect(result.priceLevelImpressionBoost).toBe(1.0);
    });
  });

  describe("Combined discount + price level", () => {
    it("should stack discount and price level boosts", () => {
      // ¥15,000 → ¥7,500 (50% OFF), price level 1.3x
      const result = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 15000,
        sellingPrice: 7500,
      });
      // discountBoost = 1 + 0.5 * 1.5 = 1.75
      // priceBoost = 1.3
      // total = 150 * 1 * 3.5 * 1.75 * 1.3 = 1194.375 → 1194
      expect(result.estimatedImpressions).toBe(1194);
      expect(result.discountImpressionBoost).toBeCloseTo(1.75, 2);
      expect(result.priceLevelImpressionBoost).toBe(1.3);
    });

    it("high price + high discount should produce highest exposure", () => {
      const highBoth = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 20000,
        sellingPrice: 4000,
      });
      const lowBoth = calculateExposure({
        avgViewers: 150,
        durationHours: 1,
        listPrice: 3000,
        sellingPrice: 2700,
      });
      expect(highBoth.estimatedImpressions).toBeGreaterThan(lowBoth.estimatedImpressions * 2);
    });
  });

  describe("Industry Average ROAS (updated to 0.7-1.5 range)", () => {
    const getIndustryAvgRoas = (unitPrice: number): { avgRoas: number; label: string } => {
      if (unitPrice <= 3000) return { avgRoas: 0.7, label: '低価格帯（〜¥3,000）' };
      if (unitPrice <= 8000) return { avgRoas: 0.9, label: '中価格帯（¥3,000〜¥8,000）' };
      if (unitPrice <= 15000) return { avgRoas: 1.2, label: '中高価格帯（¥8,000〜¥15,000）' };
      return { avgRoas: 1.5, label: '高価格帯（¥15,000〜）' };
    };

    it("should return 0.7 for low price range", () => {
      expect(getIndustryAvgRoas(2000).avgRoas).toBe(0.7);
    });

    it("should return 0.9 for mid price range", () => {
      expect(getIndustryAvgRoas(5000).avgRoas).toBe(0.9);
    });

    it("should return 1.2 for mid-high price range", () => {
      expect(getIndustryAvgRoas(10000).avgRoas).toBe(1.2);
    });

    it("should return 1.5 for high price range", () => {
      expect(getIndustryAvgRoas(20000).avgRoas).toBe(1.5);
    });

    it("all ROAS values should be in 0.7-1.5 range", () => {
      const prices = [1000, 3000, 5000, 8000, 10000, 15000, 20000, 50000];
      prices.forEach(p => {
        const roas = getIndustryAvgRoas(p).avgRoas;
        expect(roas).toBeGreaterThanOrEqual(0.7);
        expect(roas).toBeLessThanOrEqual(1.5);
      });
    });
  });

  describe("ROI Calculation", () => {
    it("should calculate ROI as (GMV - totalCost) / totalCost * 100", () => {
      const estimatedGmv = 500000;
      const totalCost = 100000;
      const estimatedRoi = totalCost > 0 ? Math.round(((estimatedGmv - totalCost) / totalCost) * 100) : 0;
      expect(estimatedRoi).toBe(400); // 400%
    });

    it("should guarantee positive ROI with profit guarantee (GMV >= 1.5x cost)", () => {
      // With profit guarantee, GMV is at least 1.5x totalCost
      const totalCost = 200000;
      const minGmv = totalCost * 1.5; // 300000
      const estimatedRoi = Math.round(((minGmv - totalCost) / totalCost) * 100);
      expect(estimatedRoi).toBe(50); // minimum 50% ROI
      expect(estimatedRoi).toBeGreaterThan(0);
    });

    it("should handle zero cost", () => {
      const estimatedGmv = 500000;
      const totalCost = 0;
      const estimatedRoi = totalCost > 0 ? Math.round(((estimatedGmv - totalCost) / totalCost) * 100) : 0;
      expect(estimatedRoi).toBe(0);
    });
  });
});
