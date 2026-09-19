export const BRAND_BD_STAGE_VALUES = [
  "new_lead",
  "slot_fee",
  "guaranteed_roi",
  "pure_commission",
  "contracted",
  "on_hold",
  "lost",
] as const;

export type BrandBdStage = (typeof BRAND_BD_STAGE_VALUES)[number];

export const BRAND_DEAL_MODEL_VALUES = [
  "slot_fee",
  "guaranteed_roi",
  "pure_commission",
] as const;

export type BrandDealModel = (typeof BRAND_DEAL_MODEL_VALUES)[number];

export const BRAND_BD_STAGE_LABELS: Record<BrandBdStage, string> = {
  new_lead: "新規ブランド・未接触",
  slot_fee: "① 坑位費を提案中",
  guaranteed_roi: "② ROI保証 1:2 を提案中",
  pure_commission: "③ 完全成果報酬を提案中",
  contracted: "契約成立",
  on_hold: "保留",
  lost: "見送り",
};

export const BRAND_BD_STAGE_LABELS_ZH: Record<BrandBdStage, string> = {
  new_lead: "新品牌・未接触",
  slot_fee: "① 正在提案坑位费",
  guaranteed_roi: "② 正在提案ROI保证 1:2",
  pure_commission: "③ 正在提案纯佣",
  contracted: "已签约",
  on_hold: "暂缓",
  lost: "不再跟进",
};

export const BRAND_DEAL_MODEL_LABELS: Record<BrandDealModel, string> = {
  slot_fee: "坑位費",
  guaranteed_roi: "ROI保証 1:2",
  pure_commission: "完全成果報酬",
};

export const BRAND_DEAL_MODEL_LABELS_ZH: Record<BrandDealModel, string> = {
  slot_fee: "坑位费",
  guaranteed_roi: "ROI保证 1:2",
  pure_commission: "纯佣",
};

export function isBrandBdStage(value: unknown): value is BrandBdStage {
  return BRAND_BD_STAGE_VALUES.includes(value as BrandBdStage);
}

export function isBrandDealModel(value: unknown): value is BrandDealModel {
  return BRAND_DEAL_MODEL_VALUES.includes(value as BrandDealModel);
}

const BRAND_BD_TRANSITIONS: Record<BrandBdStage, readonly BrandBdStage[]> = {
  new_lead: ["new_lead", "slot_fee", "on_hold", "lost"],
  slot_fee: ["slot_fee", "guaranteed_roi", "contracted", "on_hold", "lost"],
  guaranteed_roi: ["guaranteed_roi", "pure_commission", "contracted", "on_hold", "lost"],
  pure_commission: ["pure_commission", "contracted", "on_hold", "lost"],
  contracted: ["contracted"],
  on_hold: ["on_hold", "slot_fee", "lost"],
  lost: ["lost", "new_lead"],
};

export function canTransitionBrandBdStage(from: BrandBdStage, to: BrandBdStage): boolean {
  return BRAND_BD_TRANSITIONS[from].includes(to);
}

export function businessMonthKey(date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find(part => part.type === "year")?.value || 0);
  const month = Number(parts.find(part => part.type === "month")?.value || 0);
  return { year, month };
}

export function businessMonthValue(value: { year: number; month: number }): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}

export function parseBusinessMonthValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function shiftBusinessMonth(
  value: { year: number; month: number },
  offset: number,
): { year: number; month: number } {
  const absoluteMonth = value.year * 12 + (value.month - 1) + Math.trunc(offset);
  return {
    year: Math.floor(absoluteMonth / 12),
    month: ((absoluteMonth % 12) + 12) % 12 + 1,
  };
}

export function compareBusinessMonth(
  left: { year: number; month: number },
  right: { year: number; month: number },
): -1 | 0 | 1 {
  const difference = left.year * 12 + left.month - (right.year * 12 + right.month);
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

export function businessMonthUtcRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1) - 9 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000);
  return { start, end };
}

export function progressPercent(actual: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  return Math.round((Math.max(0, actual) / target) * 100);
}
