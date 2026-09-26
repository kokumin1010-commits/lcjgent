type ReportedBrandPerformanceSeed = {
  brandName: string;
  baseSpend: number;
  additionalSpend: number;
  gmv: number;
};

const REPORTED_BRAND_ROWS: readonly ReportedBrandPerformanceSeed[] = [
  {
    brandName: "KYOGOKU JAPAN",
    baseSpend: 1_686_011,
    additionalSpend: 149_021,
    gmv: 5_305_682,
  },
  {
    brandName: "MIAVIE",
    baseSpend: 123_947,
    additionalSpend: 0,
    gmv: 486_643,
  },
  {
    brandName: "TAKUMA",
    baseSpend: 40_160,
    additionalSpend: 0,
    gmv: 145_332,
  },
] as const;

function divideOrZero(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function buildTikTokAdsReportedPerformance(
  rows: readonly ReportedBrandPerformanceSeed[] = REPORTED_BRAND_ROWS,
) {
  const brands = rows.map(row => {
    const allInSpend = row.baseSpend + row.additionalSpend;
    return {
      ...row,
      allInSpend,
      reportedRoi: divideOrZero(row.gmv, row.baseSpend),
      allInRoi: divideOrZero(row.gmv, allInSpend),
    };
  });
  const baseSpend = brands.reduce((sum, row) => sum + row.baseSpend, 0);
  const additionalSpend = brands.reduce((sum, row) => sum + row.additionalSpend, 0);
  const allInSpend = baseSpend + additionalSpend;
  const gmv = brands.reduce((sum, row) => sum + row.gmv, 0);

  return {
    source: "operator_report" as const,
    sourceLabel: "运营确认报告",
    reportedAt: "2026-09-26",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-24",
    currency: "JPY",
    scope: "商品短视频GMV广告",
    brands,
    totals: {
      baseSpend,
      additionalSpend,
      allInSpend,
      gmv,
      reportedRoi: divideOrZero(gmv, baseSpend),
      allInRoi: divideOrZero(gmv, allInSpend),
    },
  };
}

export const TIKTOK_ADS_REPORTED_PERFORMANCE = buildTikTokAdsReportedPerformance();
