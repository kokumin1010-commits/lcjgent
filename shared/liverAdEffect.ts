export type LiverAdStatus = "unknown" | "none" | "paid";

export interface LinkedAdInvestmentInput {
  adType: "live" | "clip" | "mixed";
  totalBudget: unknown;
  liveBudget: unknown;
}

export interface LiverAdEffectInput {
  id: number;
  livestreamDate: Date | string;
  brandName?: string | null;
  nativeAdCost: unknown;
  linkedAds?: LinkedAdInvestmentInput[];
  salesAmount: unknown;
  manualSalesAmount?: unknown;
  gmv?: unknown;
  orderCount?: unknown;
  itemsSold?: unknown;
  productItemsSold?: unknown;
  viewerCount?: unknown;
  durationMinutes?: unknown;
}

export interface LiverAdEffectRecord {
  id: number;
  livestreamDate: string;
  brandName: string | null;
  adStatus: LiverAdStatus;
  adCost: number | null;
  adCostSource: "native" | "linked" | "missing";
  adCostConflict: boolean;
  linkedAdCost: number | null;
  gmv: number | null;
  orderCount: number | null;
  itemsSold: number | null;
  viewerCount: number | null;
  durationMinutes: number | null;
  viewerConversionRate: number | null;
  gmvPerHour: number | null;
  roas: number | null;
  adCostPerOrder: number | null;
  adAdjustedSalesContribution: number | null;
}

export interface MetricAverage {
  value: number | null;
  sampleCount: number;
}

export interface LiverAdEffectGroup {
  status: "paid" | "none";
  streamCount: number;
  sampleSufficient: boolean;
  totalAdCost: number;
  averageGmv: MetricAverage;
  averageOrders: MetricAverage;
  averageItemsSold: MetricAverage;
  averageViewers: MetricAverage;
  averageViewerConversionRate: MetricAverage;
  averageGmvPerHour: MetricAverage;
  averageRoas: MetricAverage;
  averageAdCostPerOrder: MetricAverage;
  averageAdAdjustedSalesContribution: MetricAverage;
}

export interface MetricDifference {
  paid: number | null;
  none: number | null;
  absolute: number | null;
  percent: number | null;
}

export interface LiverAdEffectDashboard {
  records: LiverAdEffectRecord[];
  paid: LiverAdEffectGroup;
  none: LiverAdEffectGroup;
  unknownCount: number;
  comparable: boolean;
  differences: {
    averageGmv: MetricDifference;
    averageOrders: MetricDifference;
    averageItemsSold: MetricDifference;
    averageViewers: MetricDifference;
    averageViewerConversionRate: MetricDifference;
    averageGmvPerHour: MetricDifference;
  };
}

export class LiverAdEffectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiverAdEffectValidationError";
  }
}

function toNullableNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return numberValue;
}

function firstKnownNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNonNegativeNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

export function normalizeAdCostInput(status: LiverAdStatus, value: unknown): number | null {
  if (status === "unknown") return null;
  if (status === "none") return 0;

  const parsed = toNullableNonNegativeNumber(value);
  if (parsed === null || parsed <= 0) {
    throw new LiverAdEffectValidationError("広告ありを選択した場合、0より大きい広告費を入力してください / 选择有广告时，请输入大于0的广告费");
  }
  if (!Number.isSafeInteger(parsed)) {
    throw new LiverAdEffectValidationError("広告費は1円単位の整数で入力してください / 广告费请输入整数日元");
  }
  return parsed;
}

export function resolveLinkedLiveAdCost(records: LinkedAdInvestmentInput[] = []): number | null {
  let found = false;
  let total = 0;

  for (const record of records) {
    if (record.adType === "clip") continue;
    const liveBudget = toNullableNonNegativeNumber(record.liveBudget);
    if (liveBudget !== null && liveBudget > 0) {
      total += liveBudget;
      found = true;
      continue;
    }
    if (record.adType === "live") {
      const totalBudget = toNullableNonNegativeNumber(record.totalBudget);
      if (totalBudget !== null) {
        total += totalBudget;
        found = true;
      }
    }
  }

  return found ? total : null;
}

export function buildLiverAdEffectRecord(input: LiverAdEffectInput): LiverAdEffectRecord {
  const nativeAdCost = toNullableNonNegativeNumber(input.nativeAdCost);
  const linkedAdCost = resolveLinkedLiveAdCost(input.linkedAds);
  const adCost = nativeAdCost ?? linkedAdCost;
  const adCostSource = nativeAdCost !== null ? "native" : linkedAdCost !== null ? "linked" : "missing";
  const adStatus: LiverAdStatus = adCost === null ? "unknown" : adCost > 0 ? "paid" : "none";
  const adCostConflict = nativeAdCost !== null && linkedAdCost !== null && nativeAdCost !== linkedAdCost;

  const gmv = firstKnownNumber(input.manualSalesAmount, input.gmv, input.salesAmount);
  const orderCount = toNullableNonNegativeNumber(input.orderCount);
  const itemsSold = firstKnownNumber(input.itemsSold, input.productItemsSold);
  const viewerCount = toNullableNonNegativeNumber(input.viewerCount);
  const durationMinutes = toNullableNonNegativeNumber(input.durationMinutes);

  const viewerConversionRate = orderCount !== null && viewerCount !== null && viewerCount > 0
    ? round((orderCount / viewerCount) * 100)
    : null;
  const gmvPerHour = gmv !== null && durationMinutes !== null && durationMinutes > 0
    ? round((gmv / durationMinutes) * 60)
    : null;
  const roas = adCost !== null && adCost > 0 && gmv !== null
    ? round(gmv / adCost)
    : null;
  const adCostPerOrder = adCost !== null && adCost > 0 && orderCount !== null && orderCount > 0
    ? round(adCost / orderCount)
    : null;
  const adAdjustedSalesContribution = adCost !== null && gmv !== null
    ? round(gmv - adCost)
    : null;

  return {
    id: input.id,
    livestreamDate: normalizeDate(input.livestreamDate),
    brandName: input.brandName ?? null,
    adStatus,
    adCost,
    adCostSource,
    adCostConflict,
    linkedAdCost,
    gmv,
    orderCount,
    itemsSold,
    viewerCount,
    durationMinutes,
    viewerConversionRate,
    gmvPerHour,
    roas,
    adCostPerOrder,
    adAdjustedSalesContribution,
  };
}

function average(records: LiverAdEffectRecord[], selector: (record: LiverAdEffectRecord) => number | null): MetricAverage {
  const values = records.map(selector).filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return { value: null, sampleCount: 0 };
  return {
    value: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    sampleCount: values.length,
  };
}

function buildGroup(records: LiverAdEffectRecord[], status: "paid" | "none"): LiverAdEffectGroup {
  const groupRecords = records.filter((record) => record.adStatus === status);
  return {
    status,
    streamCount: groupRecords.length,
    sampleSufficient: groupRecords.length >= 2,
    totalAdCost: groupRecords.reduce((sum, record) => sum + (record.adCost ?? 0), 0),
    averageGmv: average(groupRecords, (record) => record.gmv),
    averageOrders: average(groupRecords, (record) => record.orderCount),
    averageItemsSold: average(groupRecords, (record) => record.itemsSold),
    averageViewers: average(groupRecords, (record) => record.viewerCount),
    averageViewerConversionRate: average(groupRecords, (record) => record.viewerConversionRate),
    averageGmvPerHour: average(groupRecords, (record) => record.gmvPerHour),
    averageRoas: average(groupRecords, (record) => record.roas),
    averageAdCostPerOrder: average(groupRecords, (record) => record.adCostPerOrder),
    averageAdAdjustedSalesContribution: average(groupRecords, (record) => record.adAdjustedSalesContribution),
  };
}

function difference(paid: MetricAverage, none: MetricAverage): MetricDifference {
  if (paid.value === null || none.value === null) {
    return { paid: paid.value, none: none.value, absolute: null, percent: null };
  }
  const absolute = round(paid.value - none.value);
  const percent = none.value !== 0 ? round((absolute / none.value) * 100) : null;
  return { paid: paid.value, none: none.value, absolute, percent };
}

export function buildLiverAdEffectDashboard(inputs: LiverAdEffectInput[]): LiverAdEffectDashboard {
  const records = inputs.map(buildLiverAdEffectRecord).sort((a, b) => b.livestreamDate.localeCompare(a.livestreamDate));
  const paid = buildGroup(records, "paid");
  const none = buildGroup(records, "none");

  return {
    records,
    paid,
    none,
    unknownCount: records.filter((record) => record.adStatus === "unknown").length,
    comparable: paid.streamCount > 0 && none.streamCount > 0,
    differences: {
      averageGmv: difference(paid.averageGmv, none.averageGmv),
      averageOrders: difference(paid.averageOrders, none.averageOrders),
      averageItemsSold: difference(paid.averageItemsSold, none.averageItemsSold),
      averageViewers: difference(paid.averageViewers, none.averageViewers),
      averageViewerConversionRate: difference(paid.averageViewerConversionRate, none.averageViewerConversionRate),
      averageGmvPerHour: difference(paid.averageGmvPerHour, none.averageGmvPerHour),
    },
  };
}
