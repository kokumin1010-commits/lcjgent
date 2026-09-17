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

export function shouldRequireSecondReview(points: number): boolean {
  return Math.abs(points) > 5;
}

export function canAutoApplyPerformancePoints(points: number): boolean {
  return points === 0;
}
