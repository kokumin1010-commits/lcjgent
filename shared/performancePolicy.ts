export const PERFORMANCE_MODE = "shadow" as const;
export const PERFORMANCE_DIMENSION_CAPS = {
  completion: 30,
  timeliness: 20,
  quality: 20,
  accuracy_closure: 10,
  initiative: 10,
  manager_evaluation: 10,
} as const;

export type PerformanceDimension = keyof typeof PERFORMANCE_DIMENSION_CAPS;
export type PerformanceItemStatus =
  | "pending"
  | "first_reminder"
  | "yellow"
  | "orange_review"
  | "red_review"
  | "completed"
  | "exception"
  | "cancelled"
  | "source_error";

export const PERFORMANCE_DIMENSION_LABELS: Record<PerformanceDimension, string> = {
  completion: "系统事项完成度",
  timeliness: "及时性与连续性",
  quality: "内容质量",
  accuracy_closure: "准确与问题闭环",
  initiative: "积极度",
  manager_evaluation: "管理员评价",
};

export const AUTO_NEGATIVE_SCORE_ALLOWED = false;

export const PERFORMANCE_SAFE_DEFAULTS = {
  mode: PERFORMANCE_MODE,
  aiCandidatesEnabled: false,
  externalNotificationsEnabled: false,
  impactsBonus: false,
  impactsLcjCoin: false,
  retrospectiveScoringEnabled: false,
} as const;

export function normalizePerformanceDimension(value: unknown): PerformanceDimension {
  const text = String(value || "").toLowerCase();
  if (/及时/.test(text)) return "timeliness";
  if (/质量/.test(text)) return "quality";
  if (/准确|闭环/.test(text)) return "accuracy_closure";
  if (/积极/.test(text)) return "initiative";
  if (/管理员|评价/.test(text)) return "manager_evaluation";
  return "completion";
}

export function buildPerformanceEvidenceKey(input: {
  templateCode: string;
  staffId: number;
  sourceType: string;
  sourceId: string | number;
}): string {
  return [
    input.templateCode.trim(),
    String(input.staffId),
    input.sourceType.trim(),
    String(input.sourceId).trim(),
  ].join(":");
}

const PERFORMANCE_DAILY_SINGLETON_SOURCES = new Set(["daily_report", "morning_meeting"]);

export function performanceItemLogicalKey(item: {
  id?: unknown;
  evidenceKey?: unknown;
  templateCode?: unknown;
  staffId?: unknown;
  sourceType?: unknown;
  businessDate?: unknown;
}): string {
  const sourceType = String(item.sourceType || "");
  const businessDate = String(item.businessDate || "").slice(0, 10);
  if (PERFORMANCE_DAILY_SINGLETON_SOURCES.has(sourceType) && businessDate) {
    return [String(item.templateCode || ""), String(item.staffId || ""), sourceType, businessDate].join(":");
  }
  return String(item.evidenceKey || item.id || "");
}

export function canonicalizePerformanceItems<T extends {
  id?: unknown;
  evidenceKey?: unknown;
  templateCode?: unknown;
  staffId?: unknown;
  sourceType?: unknown;
  businessDate?: unknown;
  status?: unknown;
  dataQuality?: unknown;
  completionRate?: unknown;
}>(items: T[]): T[] {
  const statusRank: Record<string, number> = {
    completed: 6,
    exception: 5,
    cancelled: 4,
    red_review: 3,
    orange_review: 3,
    yellow: 3,
    first_reminder: 3,
    pending: 2,
    source_error: 1,
  };
  const selected = new Map<string, T>();
  for (const item of items) {
    const key = performanceItemLogicalKey(item);
    const current = selected.get(key);
    if (!current) {
      selected.set(key, item);
      continue;
    }
    const itemRank = statusRank[String(item.status)] || 0;
    const currentRank = statusRank[String(current.status)] || 0;
    const itemCompletion = Number(item.completionRate || 0);
    const currentCompletion = Number(current.completionRate || 0);
    const itemQuality = String(item.dataQuality) === "verified" ? 1 : 0;
    const currentQuality = String(current.dataQuality) === "verified" ? 1 : 0;
    const itemStableIdentity = String(item.evidenceKey || "").endsWith(`:${String(item.businessDate || "").slice(0, 10)}`) ? 1 : 0;
    const currentStableIdentity = String(current.evidenceKey || "").endsWith(`:${String(current.businessDate || "").slice(0, 10)}`) ? 1 : 0;
    if (
      itemRank > currentRank
      || (itemRank === currentRank && itemCompletion > currentCompletion)
      || (itemRank === currentRank && itemCompletion === currentCompletion && itemQuality > currentQuality)
      || (itemRank === currentRank && itemCompletion === currentCompletion && itemQuality === currentQuality
        && itemStableIdentity > currentStableIdentity)
      || (itemRank === currentRank && itemCompletion === currentCompletion && itemQuality === currentQuality
        && itemStableIdentity === currentStableIdentity
        && Number(item.id || 0) > Number(current.id || 0))
    ) {
      selected.set(key, item);
    }
  }
  return [...selected.values()];
}

export function reminderLevelForItem(input: {
  status: string;
  dueAt: Date | null;
  now?: Date;
  reminderCount?: number;
}): PerformanceItemStatus {
  if (["completed", "exception", "cancelled", "source_error"].includes(input.status)) {
    return input.status as PerformanceItemStatus;
  }
  if (!input.dueAt) return "pending";
  const now = input.now || new Date();
  const overdueMs = now.getTime() - input.dueAt.getTime();
  const hour = 60 * 60 * 1000;
  if (overdueMs < 2 * hour) return "pending";
  if (overdueMs < 6 * hour) return "first_reminder";
  if (overdueMs < 24 * hour) return "yellow";
  if (overdueMs < 48 * hour) return "orange_review";
  return "red_review";
}

export function calculateFactDimensionScore(input: {
  dimension: "completion" | "timeliness" | "accuracy_closure";
  applicableCount: number;
  achievedCount: number;
}): number | null {
  if (input.applicableCount <= 0) return null;
  const cap = PERFORMANCE_DIMENSION_CAPS[input.dimension];
  const ratio = Math.min(1, Math.max(0, input.achievedCount / input.applicableCount));
  return Math.round(cap * ratio * 10) / 10;
}

export function calculateCompletionRate(input: {
  numerator: number;
  denominator: number;
  applicable?: boolean;
}): number | null {
  if (input.applicable === false || !Number.isFinite(input.denominator) || input.denominator <= 0) return null;
  const numerator = Number.isFinite(input.numerator) ? input.numerator : 0;
  return Math.round(Math.min(1, Math.max(0, numerator / input.denominator)) * 10_000) / 10_000;
}

export type PerformanceResponseStatus = "pending" | "responded" | "closed" | "excluded";
export type PerformanceResponseSpeedBand = "within_2h" | "within_8h" | "within_24h" | "over_24h" | "na";

export function responseSpeedBand(responseMinutes: number | null, applicable = true): PerformanceResponseSpeedBand {
  if (!applicable || responseMinutes == null || !Number.isFinite(responseMinutes) || responseMinutes < 0) return "na";
  if (responseMinutes <= 120) return "within_2h";
  if (responseMinutes <= 480) return "within_8h";
  if (responseMinutes <= 1_440) return "within_24h";
  return "over_24h";
}

export function shouldRequireMonthlyReviewSecondApproval(input: {
  aiNormalizedScore: number | null;
  managerNormalizedScore: number;
  maximumDimensionDeltaRatio: number;
}): boolean {
  const totalDelta = input.aiNormalizedScore == null
    ? 0
    : Math.abs(input.managerNormalizedScore - input.aiNormalizedScore);
  return totalDelta >= 10 || input.maximumDimensionDeltaRatio > 0.5;
}

export function shouldRequireManagerDifferenceReason(input: {
  aiNormalizedScore: number | null;
  managerNormalizedScore: number;
  maximumDimensionDelta: number;
}): boolean {
  const totalDelta = input.aiNormalizedScore == null
    ? 0
    : Math.abs(input.managerNormalizedScore - input.aiNormalizedScore);
  return totalDelta >= 5 || input.maximumDimensionDelta >= 2;
}

export function shouldRequireSecondReview(points: number): boolean {
  return Math.abs(points) > 5;
}

export function canAutoApplyPerformancePoints(points: number): boolean {
  return points === 0;
}
