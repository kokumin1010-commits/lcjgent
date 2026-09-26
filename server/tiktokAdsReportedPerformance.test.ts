import { describe, expect, it } from "vitest";
import {
  buildTikTokAdsReportedPerformance,
  TIKTOK_ADS_REPORTED_PERFORMANCE,
} from "./tiktokAdsReportedPerformance";

describe("TikTok Ads operator-reported brand performance", () => {
  it("preserves the September report totals without mixing in the Auction lifetime snapshot", () => {
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.periodStart).toBe("2026-09-01");
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.periodEnd).toBe("2026-09-24");
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.brands).toHaveLength(3);
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.totals).toMatchObject({
      baseSpend: 1_850_118,
      additionalSpend: 149_021,
      allInSpend: 1_999_139,
      gmv: 5_937_657,
    });
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.totals.reportedRoi).toBeCloseTo(3.2093, 4);
    expect(TIKTOK_ADS_REPORTED_PERFORMANCE.totals.allInRoi).toBeCloseTo(2.9701, 4);
  });

  it("keeps reported ROI and all-in ROI distinct when an extra heating cost exists", () => {
    const kyogoku = TIKTOK_ADS_REPORTED_PERFORMANCE.brands.find(row => row.brandName === "KYOGOKU JAPAN");
    expect(kyogoku).toMatchObject({
      baseSpend: 1_686_011,
      additionalSpend: 149_021,
      allInSpend: 1_835_032,
      gmv: 5_305_682,
    });
    expect(kyogoku?.reportedRoi).toBeCloseTo(3.1469, 4);
    expect(kyogoku?.allInRoi).toBeCloseTo(2.8913, 4);
  });

  it("fails safely to zero ROI for an empty cost row", () => {
    const report = buildTikTokAdsReportedPerformance([
      { brandName: "EMPTY", baseSpend: 0, additionalSpend: 0, gmv: 0 },
    ]);
    expect(report.brands[0]?.reportedRoi).toBe(0);
    expect(report.brands[0]?.allInRoi).toBe(0);
    expect(report.totals.reportedRoi).toBe(0);
    expect(report.totals.allInRoi).toBe(0);
  });
});
