import { describe, it, expect } from "vitest";

// ROAS計算ロジックのテスト
describe("ROAS Calculation with Fixed Fee", () => {
  const INDUSTRY_AVG_ROAS = 0.8;

  // ROAS計算関数（クライアント側のロジックを再現）
  function calculateRoas(
    totalGmv: number,
    totalImpressions: number,
    fixedFee: number
  ) {
    const adValue = totalImpressions * 15; // CPM ¥15,000
    const totalInvestment = adValue + fixedFee;
    const roas = totalInvestment > 0 ? totalGmv / totalInvestment : 0;
    const vsIndustry = roas / INDUSTRY_AVG_ROAS;
    return { adValue, totalInvestment, roas, vsIndustry };
  }

  it("should calculate ROAS including fixed fee", () => {
    // スクリーンショットからのデータ:
    // GMV: ¥1,159,431
    // 曝光: 18,889
    // 固定費: ¥1,000,000
    const result = calculateRoas(1159431, 18889, 1000000);

    // 広告換算費用 = 18,889 × 15 = ¥283,335
    expect(result.adValue).toBe(283335);

    // 総投資額 = ¥283,335 + ¥1,000,000 = ¥1,283,335
    expect(result.totalInvestment).toBe(1283335);

    // ROAS = ¥1,159,431 ÷ ¥1,283,335 ≈ 0.90
    expect(result.roas).toBeCloseTo(0.90, 1);

    // 業界平均比 = 0.90 ÷ 0.8 ≈ 1.13
    expect(result.vsIndustry).toBeCloseTo(1.13, 1);
  });

  it("should calculate ROAS without fixed fee (old behavior)", () => {
    // 固定費なしの場合（旧計算方法）
    const result = calculateRoas(1159431, 18889, 0);

    // 広告換算費用 = 18,889 × 15 = ¥283,335
    expect(result.adValue).toBe(283335);

    // 総投資額 = ¥283,335 + ¥0 = ¥283,335
    expect(result.totalInvestment).toBe(283335);

    // ROAS = ¥1,159,431 ÷ ¥283,335 ≈ 4.09
    expect(result.roas).toBeCloseTo(4.09, 1);
  });

  it("should handle zero impressions", () => {
    const result = calculateRoas(1000000, 0, 500000);

    expect(result.adValue).toBe(0);
    expect(result.totalInvestment).toBe(500000);
    expect(result.roas).toBeCloseTo(2.0, 1);
  });

  it("should handle zero total investment", () => {
    const result = calculateRoas(1000000, 0, 0);

    expect(result.adValue).toBe(0);
    expect(result.totalInvestment).toBe(0);
    expect(result.roas).toBe(0);
  });

  it("should calculate correct ROAS for the screenshot example", () => {
    // スクリーンショットの例:
    // GMV合計: ¥1,133,514
    // 曝光: 20,732
    // 固定費: ¥1,000,000
    const result = calculateRoas(1133514, 20732, 1000000);

    // 広告換算費用 = 20,732 × 15 = ¥310,980
    expect(result.adValue).toBe(310980);

    // 総投資額 = ¥310,980 + ¥1,000,000 = ¥1,310,980
    expect(result.totalInvestment).toBe(1310980);

    // ROAS = ¥1,133,514 ÷ ¥1,310,980 ≈ 0.86
    expect(result.roas).toBeCloseTo(0.86, 1);

    // 旧計算（固定費なし）だと 3.64倍 になっていた
    const oldResult = calculateRoas(1133514, 20732, 0);
    expect(oldResult.roas).toBeCloseTo(3.64, 1);
  });
});
