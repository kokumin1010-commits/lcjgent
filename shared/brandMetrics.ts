export const BRAND_GMV_SOURCE_VALUES = [
  "allocated_brand_gmv",
  "manual_sales_amount",
  "sales_amount",
  "livestream_gmv",
  "product_gmv",
  "none",
] as const;

export type BrandGmvSource = (typeof BRAND_GMV_SOURCE_VALUES)[number];

export type BrandGmvInput = {
  allocatedBrandGmv?: unknown;
  manualSalesAmount?: unknown;
  salesAmount?: unknown;
  gmv?: unknown;
  productGmvTotal?: unknown;
};

export type BrandGmvResolution = {
  value: number;
  source: BrandGmvSource;
  hasConflict: boolean;
  conflictSources: BrandGmvSource[];
  observedSources: BrandGmvSource[];
};

export type LarkNumericFactLike = {
  sourceField?: unknown;
  value?: unknown;
};

export type LarkHistoricalGmvResolution = {
  value: number | null;
  sourceFields: string[];
  hasConflict: boolean;
};

export type BrandTotalGmvBreakdown = {
  total: number;
  livestreamTotal: number;
  historicalTotal: number;
};

type Candidate = {
  source: Exclude<BrandGmvSource, "none">;
  value: number | null;
};

export function normalizeBrandMetricNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return numberValue;
}

/**
 * Compose the all-time brand GMV shown on the brand detail page.
 *
 * Livestream rows have already been de-duplicated per stream by
 * resolveBrandLivestreamGmv. Historical GMV is a separate, canonical ledger
 * baseline, so it is added once at brand-summary level and never copied into
 * an individual livestream.
 */
export function combineBrandTotalGmv(input: {
  livestreamTotal?: unknown;
  historicalTotal?: unknown;
}): BrandTotalGmvBreakdown {
  const livestreamTotal = normalizeBrandMetricNumber(input.livestreamTotal) ?? 0;
  const historicalTotal = normalizeBrandMetricNumber(input.historicalTotal) ?? 0;
  return {
    total: livestreamTotal + historicalTotal,
    livestreamTotal,
    historicalTotal,
  };
}

/**
 * Resolve one livestream's brand-scoped GMV without adding overlapping facts.
 *
 * Priority is evidence based:
 * 1. a per-brand allocation from livestream_brands;
 * 2. a deliberate manual correction;
 * 3. the legacy salesAmount field;
 * 4. the legacy gmv field;
 * 5. the sum of product-level GMV rows.
 *
 * Positive values win over zero placeholders. When every present source is zero,
 * the highest-priority zero is retained as an explicit fact rather than treated as missing.
 */
export function resolveBrandLivestreamGmv(input: BrandGmvInput): BrandGmvResolution {
  const candidates: Candidate[] = [
    { source: "allocated_brand_gmv", value: normalizeBrandMetricNumber(input.allocatedBrandGmv) },
    { source: "manual_sales_amount", value: normalizeBrandMetricNumber(input.manualSalesAmount) },
    { source: "sales_amount", value: normalizeBrandMetricNumber(input.salesAmount) },
    { source: "livestream_gmv", value: normalizeBrandMetricNumber(input.gmv) },
    { source: "product_gmv", value: normalizeBrandMetricNumber(input.productGmvTotal) },
  ];
  const observed = candidates.filter((candidate) => candidate.value !== null);
  const selected = observed.find((candidate) => Number(candidate.value) > 0) || observed[0];
  if (!selected || selected.value === null) {
    return {
      value: 0,
      source: "none",
      hasConflict: false,
      conflictSources: [],
      observedSources: [],
    };
  }

  const positive = observed.filter((candidate) => Number(candidate.value) > 0);
  const distinctPositiveValues = new Set(positive.map((candidate) => Number(candidate.value)));
  const hasConflict = distinctPositiveValues.size > 1;
  return {
    value: Number(selected.value),
    source: selected.source,
    hasConflict,
    conflictSources: hasConflict ? positive.map((candidate) => candidate.source) : [],
    observedSources: observed.map((candidate) => candidate.source),
  };
}

export function resolveExplicitBrandAllocations(values: unknown[]): BrandGmvResolution {
  if (values.length === 0) {
    return { value: 0, source: "none", hasConflict: false, conflictSources: [], observedSources: [] };
  }
  const normalized = values.map(normalizeBrandMetricNumber).filter((value): value is number => value !== null);
  const positiveValues = [...new Set(normalized.filter(value => value > 0))];
  if (positiveValues.length > 1) {
    return {
      value: 0,
      source: "none",
      hasConflict: true,
      conflictSources: ["allocated_brand_gmv"],
      observedSources: ["allocated_brand_gmv"],
    };
  }
  return {
    value: positiveValues[0] ?? 0,
    source: "allocated_brand_gmv",
    hasConflict: false,
    conflictSources: [],
    observedSources: ["allocated_brand_gmv"],
  };
}

export function resolveLivestreamProductGmv(input: {
  directGmv?: unknown;
  gmv?: unknown;
  grossRevenue?: unknown;
}): number {
  const values = [input.directGmv, input.gmv, input.grossRevenue]
    .map(normalizeBrandMetricNumber);
  const positive = values.find((value) => value !== null && value > 0);
  if (typeof positive === "number") return positive;
  return values.find((value) => value !== null) ?? 0;
}

/**
 * Resolve a Lark-reported historical GMV baseline independently from live facts.
 * It may contribute once to the all-time brand total, but must never be copied
 * into individual livestream GMV or mixed with conflicting source baselines.
 */
export function resolveLarkHistoricalGmv(input: {
  reportedGmv?: unknown;
  numericFacts?: LarkNumericFactLike[] | null;
}): LarkHistoricalGmvResolution {
  const candidates: Array<{ sourceField: string; value: number }> = [];
  const reported = normalizeBrandMetricNumber(input.reportedGmv);
  if (reported !== null) candidates.push({ sourceField: "reportedGmv", value: reported });

  for (const fact of input.numericFacts || []) {
    const sourceField = String(fact?.sourceField || "").trim();
    if (!/gmv/i.test(sourceField)) continue;
    const value = normalizeBrandMetricNumber(fact?.value);
    if (value !== null) candidates.push({ sourceField, value });
  }

  if (candidates.length === 0) return { value: null, sourceFields: [], hasConflict: false };
  const distinctValues = [...new Set(candidates.map(candidate => candidate.value))];
  if (distinctValues.length > 1) {
    return { value: null, sourceFields: candidates.map(candidate => candidate.sourceField), hasConflict: true };
  }
  const selectedValue = distinctValues[0];
  return {
    value: selectedValue,
    sourceFields: candidates.filter(candidate => candidate.value === selectedValue).map(candidate => candidate.sourceField),
    hasConflict: false,
  };
}

export function effectiveGmvFromLivestream(value: BrandGmvInput & { effectiveGmv?: unknown }): number {
  const effective = normalizeBrandMetricNumber(value.effectiveGmv);
  if (effective !== null) return effective;
  return resolveBrandLivestreamGmv(value).value;
}
