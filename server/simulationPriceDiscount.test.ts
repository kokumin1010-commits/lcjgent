import { describe, it, expect } from "vitest";

describe("Simulation Price & Discount Adjustments", () => {
  // Replicate the discount + price adjustment logic from routers.ts
  function calculateWithPriceAdjustment(params: {
    listPrice: number;
    sellingPrice: number;
    baseGmv: number; // avgGmvPerHour * durationHours
  }) {
    let adjustedGmv = params.baseGmv;
    const adjustmentFactors: Record<string, number> = {};

    // Discount rate calculation
    const sellingPrice = params.sellingPrice;
    const listPrice = params.listPrice;
    const discountRate = listPrice > 0 ? Math.max(0, (listPrice - sellingPrice) / listPrice) : 0;

    if (discountRate > 0) {
      // 指数的に跳ね上がるカーブ: 割引が大きいほど爆発的に売れる
      const discountBoost = 1 + Math.pow(discountRate, 0.7) * 3.0;
      adjustmentFactors['discountRate'] = discountBoost;
      adjustmentFactors['discountPercentage'] = Math.round(discountRate * 100);
      adjustedGmv *= discountBoost;
    }

    // Price level adjustment (based on listPrice, not sellingPrice)
    const priceForLevel = listPrice;
    const priceAdjust = priceForLevel >= 15000 ? 1.5
      : priceForLevel >= 10000 ? 1.35
      : priceForLevel >= 5000 ? 1.2
      : priceForLevel >= 3000 ? 1.1
      : 1.0;
    if (priceAdjust > 1.0) {
      adjustmentFactors['priceLevel'] = priceAdjust;
      adjustedGmv *= priceAdjust;
    }

    return { adjustedGmv: Math.round(adjustedGmv), adjustmentFactors, discountRate };
  }

  describe("Discount Rate Impact on GMV", () => {
    const baseGmv = 500000; // ¥500,000 base

    it("should not change GMV when no discount (listPrice = sellingPrice)", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 5000,
        sellingPrice: 5000,
        baseGmv,
      });
      // Only price level adjustment (listPrice 5000 \u2192 1.2)
      expect(result.adjustedGmv).toBe(600000); // 500000 * 1.2
      expect(result.discountRate).toBe(0);
    });

    it("should boost GMV for 30% discount", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 5000,
        sellingPrice: 3500,
        baseGmv,
      });
      expect(result.discountRate).toBeCloseTo(0.3, 1);
      expect(result.adjustedGmv).toBeGreaterThan(600000); // More than no-discount scenario
    });

    it("should boost GMV significantly for 50% discount", () => {
      const result50 = calculateWithPriceAdjustment({
        listPrice: 5000,
        sellingPrice: 2500,
        baseGmv,
      });
      const result30 = calculateWithPriceAdjustment({
        listPrice: 5000,
        sellingPrice: 3500,
        baseGmv,
      });
      expect(result50.adjustedGmv).toBeGreaterThan(result30.adjustedGmv);
    });

    it("should boost GMV dramatically for 70% discount", () => {
      const result70 = calculateWithPriceAdjustment({
        listPrice: 10000,
        sellingPrice: 3000,
        baseGmv,
      });
      const result30 = calculateWithPriceAdjustment({
        listPrice: 10000,
        sellingPrice: 7000,
        baseGmv,
      });
      // 70% OFF should produce much higher GMV than 30% OFF
      expect(result70.adjustedGmv).toBeGreaterThan(result30.adjustedGmv * 1.3);
    });

    it("should show increasing GMV as discount increases", () => {
      const discounts = [0, 10, 30, 50, 70, 80];
      const results = discounts.map(d => {
        const listPrice = 10000;
        const sellingPrice = listPrice * (1 - d / 100);
        return calculateWithPriceAdjustment({ listPrice, sellingPrice, baseGmv });
      });

      // Each higher discount should produce higher GMV
      for (let i = 1; i < results.length; i++) {
        expect(results[i].adjustedGmv).toBeGreaterThan(results[i - 1].adjustedGmv);
      }
    });
  });

  describe("Price Level Impact (based on listPrice)", () => {
    const baseGmv = 500000;

    it("should apply 1.5x for listPrice \u00a515,000+ products", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 20000,
        sellingPrice: 20000,
        baseGmv,
      });
      expect(result.adjustedGmv).toBe(750000); // 500000 * 1.5
    });

    it("should apply 1.35x for listPrice \u00a510,000-14,999 products", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 12000,
        sellingPrice: 12000,
        baseGmv,
      });
      expect(result.adjustedGmv).toBe(675000); // 500000 * 1.35
    });

    it("should apply 1.2x for listPrice \u00a55,000-9,999 products", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 7000,
        sellingPrice: 7000,
        baseGmv,
      });
      expect(result.adjustedGmv).toBe(600000); // 500000 * 1.2
    });

    it("should apply no boost for listPrice under \u00a53,000", () => {
      const result = calculateWithPriceAdjustment({
        listPrice: 2000,
        sellingPrice: 2000,
        baseGmv,
      });
      expect(result.adjustedGmv).toBe(500000); // No boost
    });

    it("should use listPrice not sellingPrice for price level (discount doesn't reduce price level)", () => {
      // listPrice ¥10,000 → sellingPrice ¥2,000 (80% OFF)
      // Price level should still be 1.35 (based on listPrice ¥10,000)
      const result = calculateWithPriceAdjustment({
        listPrice: 10000,
        sellingPrice: 2000,
        baseGmv,
      });
      expect(result.adjustmentFactors['priceLevel']).toBe(1.35);
    });
  });

  describe("Combined Discount + Price Level", () => {
    const baseGmv = 500000;

    it("should stack discount and price level adjustments", () => {
      // \u00a57,000 \u2192 \u00a52,000 (71% OFF) with listPrice \u00a57,000 (1.2x price level)
      const result = calculateWithPriceAdjustment({
        listPrice: 7000,
        sellingPrice: 2000,
        baseGmv,
      });
      // discountRate \u2248 0.714
      // discountBoost = 1 + 0.714^0.7 * 3.0 \u2248 3.32
      // priceAdjust = 1.2 (listPrice \u00a57,000)
      // adjustedGmv \u2248 500000 * 3.32 * 1.2 \u2248 1,993,xxx
      expect(result.adjustedGmv).toBeGreaterThan(1900000);
      expect(result.adjustmentFactors['discountPercentage']).toBeCloseTo(71, 0);
    });

    it("high price + high discount should produce the highest GMV", () => {
      // ¥20,000 → ¥5,000 (75% OFF) with sellingPrice ¥5,000 (1.2x price boost)
      const highBoth = calculateWithPriceAdjustment({
        listPrice: 20000,
        sellingPrice: 5000,
        baseGmv,
      });
      // Low discount, low price
      const lowBoth = calculateWithPriceAdjustment({
        listPrice: 3000,
        sellingPrice: 2500,
        baseGmv,
      });
      expect(highBoth.adjustedGmv).toBeGreaterThan(lowBoth.adjustedGmv * 2);
    });
  });
});
