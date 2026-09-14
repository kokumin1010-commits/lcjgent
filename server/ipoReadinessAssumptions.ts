export const IPO_TARGET_OPERATING_MARGIN_PCT = 20;

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function buildIpoOperatingPlan(targetOperatingProfitJpy: number | null | undefined) {
  const marginRate = IPO_TARGET_OPERATING_MARGIN_PCT / 100;
  if (targetOperatingProfitJpy == null || !Number.isFinite(targetOperatingProfitJpy)) {
    return {
      targetOperatingMarginPct: IPO_TARGET_OPERATING_MARGIN_PCT,
      targetOperatingCostRatioPct: 100 - IPO_TARGET_OPERATING_MARGIN_PCT,
      requiredRevenueJpy: null,
      operatingCostLimitJpy: null,
    };
  }
  const operatingProfitJpy = round(targetOperatingProfitJpy);
  const requiredRevenueJpy = round(operatingProfitJpy / marginRate);
  return {
    targetOperatingMarginPct: IPO_TARGET_OPERATING_MARGIN_PCT,
    targetOperatingCostRatioPct: 100 - IPO_TARGET_OPERATING_MARGIN_PCT,
    requiredRevenueJpy,
    operatingCostLimitJpy: requiredRevenueJpy - operatingProfitJpy,
  };
}

export const IPO_TAX_FUNDING_POLICY = {
  status: "management_guidance_only" as const,
  reserveRatePct: null,
  reserveJpy: null,
  afterTaxProfitJpy: null,
  basis: "pretax_profit_after_non_operating_and_tax_adjustments" as const,
  descriptionJa: "営業利益20%は法人税等と内部留保の原資です。正式な税額は営業外損益・税務調整後の税引前利益を基準に確定するため、固定税率や税額は自動計上しません。",
};
