export const RUNDOWN_PRODUCT_ATTRIBUTE_VALUES = ["required", "optional"] as const;
export type RundownProductAttribute = (typeof RUNDOWN_PRODUCT_ATTRIBUTE_VALUES)[number];

export const RUNDOWN_PRODUCT_ATTRIBUTE_LABELS: Record<RundownProductAttribute, string> = {
  required: "必播品",
  optional: "可选品",
};

const RUNDOWN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeRundownTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return RUNDOWN_TIME_PATTERN.test(trimmed) ? trimmed : null;
}

export function rundownDurationMinutes(startTime: unknown, endTime: unknown): number | null {
  const start = normalizeRundownTime(startTime);
  const end = normalizeRundownTime(endTime);
  if (!start || !end) return null;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const duration = endTotal > startTotal ? endTotal - startTotal : endTotal + 24 * 60 - startTotal;
  return duration > 0 ? duration : null;
}

export function isValidRundownTimeRange(startTime: unknown, endTime: unknown, maxMinutes = 12 * 60): boolean {
  const duration = rundownDurationMinutes(startTime, endTime);
  return duration !== null && duration <= maxMinutes;
}

export function normalizeRundownProductAttribute(value: unknown): RundownProductAttribute | null {
  return RUNDOWN_PRODUCT_ATTRIBUTE_VALUES.includes(value as RundownProductAttribute)
    ? (value as RundownProductAttribute)
    : null;
}

export function parseRundownDiscountRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") return null;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 100) / 100;
}

export function calculateRundownLiveDiscountRate(listPrice: unknown, livePrice: unknown): number | null {
  const list = Number(listPrice);
  const live = Number(livePrice);
  if (!Number.isFinite(list) || !Number.isFinite(live) || list <= 0 || live < 0 || live > list) return null;
  return Math.round((1 - live / list) * 10_000) / 100;
}

export function resolveRundownLiveDiscountRate(
  explicitRate: unknown,
  listPrice: unknown,
  livePrice: unknown,
): number | null {
  const explicit = parseRundownDiscountRate(explicitRate);
  if (explicit !== null) return explicit;
  return calculateRundownLiveDiscountRate(listPrice, livePrice);
}
