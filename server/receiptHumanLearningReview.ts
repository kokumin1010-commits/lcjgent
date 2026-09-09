import { PASS2_RULESET_VERSION } from "./receiptPass2V2Policy";

export const HUMAN_LEARNING_REVIEW_VERSION = "receipt-human-learning-v1.0.0" as const;
export const SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT = "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" as const;

export function isHumanLearningApprovalBlocked(reasonCode: unknown): boolean {
  return String(reasonCode || "").trim().toUpperCase() === SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT;
}

export const HUMAN_LEARNING_EVIDENCE_KEYS = [
  "order_number",
  "total_amount",
  "delivery_status",
  "platform",
  "duplicate_conflict",
  "image_authenticity",
  "other",
] as const;
export type HumanLearningEvidenceKey = (typeof HUMAN_LEARNING_EVIDENCE_KEYS)[number];

export const HUMAN_LEARNING_REJECTION_CATEGORIES = [
  "blurry_image",
  "missing_order_number",
  "missing_amount",
  "not_delivered",
  "duplicate",
  "wrong_store",
  "suspicious",
  "incomplete_info",
  "not_order_detail",
  "not_tiktok_shop",
  "partial_screenshot",
  "other",
] as const;
export type HumanLearningRejectionCategory = (typeof HUMAN_LEARNING_REJECTION_CATEGORIES)[number];

export type HumanLearningCandidateInput = {
  aiPass: unknown;
  beforeStatus: unknown;
  afterStatus: unknown;
  aiDecision: unknown;
  humanOverride: unknown;
  isDryRun: unknown;
  receiptStatus: unknown;
};

export function isHumanLearningCandidate(input: HumanLearningCandidateInput): boolean {
  return (
    Number(input.aiPass) === 2 &&
    input.beforeStatus === "on_hold" &&
    input.afterStatus === "on_hold" &&
    (input.aiDecision === "keep_manual" || input.aiDecision === "held") &&
    (input.humanOverride === null || input.humanOverride === undefined || input.humanOverride === "") &&
    input.isDryRun === false &&
    input.receiptStatus === "on_hold"
  );
}

export function buildHumanLearningProblemPoints(input: {
  reasonCode?: string | null;
  aiReason?: string | null;
  aiComment?: string | null;
}): string[] {
  const reasonCode = String(input.reasonCode || "").trim().toUpperCase();
  const points: string[] = [];

  if (reasonCode === "CROSS_ACCOUNT_ORDER_CONFLICT") {
    points.push("不同账户出现相同订单号：请确认哪一份申报拥有有效、完整的订单证据。");
  } else if (reasonCode === "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT") {
    points.push("同一账户存在活动中的相同订单号：请确认是否属于重复申报。");
  } else if (reasonCode === "HARD_RISK") {
    points.push("AI检测到订单号或图片重复硬风险：请核对重复来源及图片真实性。");
  } else {
    points.push("AI无法独立作出可靠结论：请根据原图和订单证据给出人工最终判断。");
  }

  const explanation = String(input.aiReason || input.aiComment || "").trim();
  if (explanation) points.push(`AI说明：${explanation.slice(0, 600)}`);
  points.push("请写明通过或拒绝的具体依据；该理由将用于学习相似疑难订单的人工处理方法。");
  return points;
}

export function normalizeHumanLearningReason(value: unknown): string {
  const reason = String(value || "").trim().replace(/\s+/g, " ");
  if (!reason) throw new Error("请填写人工审核理由");
  if (reason.length > 2000) throw new Error("人工审核理由不能超过2000个字符");
  return reason;
}

export function normalizeHumanLearningEvidenceKeys(value: unknown): HumanLearningEvidenceKey[] {
  const incoming = Array.isArray(value) ? value : [];
  const allowed = new Set<string>(HUMAN_LEARNING_EVIDENCE_KEYS);
  const normalized = [...new Set(incoming.map(item => String(item)).filter(item => allowed.has(item)))] as HumanLearningEvidenceKey[];
  if (normalized.length < 1) throw new Error("请至少选择一项人工判断依据");
  return normalized;
}

export function buildHumanLearningErrorType(reasonCode?: string | null): string {
  const safe = String(reasonCode || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
  return `manual_resolution_${safe}`.slice(0, 100);
}

export function buildHumanLearningNote(input: {
  reasonCode?: string | null;
  problemPoints: string[];
  evidenceKeys: HumanLearningEvidenceKey[];
  humanDecision: "approved" | "rejected";
  humanReason: string;
}): string {
  return [
    `source=${HUMAN_LEARNING_REVIEW_VERSION}`,
    `ruleset=${PASS2_RULESET_VERSION}`,
    `reasonCode=${String(input.reasonCode || "unknown")}`,
    `humanDecision=${input.humanDecision}`,
    `evidence=${input.evidenceKeys.join(",")}`,
    `problems=${input.problemPoints.join(" | ")}`,
    `humanMethod=${input.humanReason}`,
  ].join("\n");
}
