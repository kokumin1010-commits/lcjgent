export const BRAND_BD_INTERACTION_TYPES = [
  "call",
  "meeting",
  "email",
  "message",
  "proposal",
  "other",
] as const;

export type BrandBdInteractionType =
  (typeof BRAND_BD_INTERACTION_TYPES)[number];

export const BRAND_BD_AI_ANALYSIS_TYPES = [
  "brand_summary",
  "next_strategy",
  "meeting_brief",
  "risk_check",
  "followup_draft",
  "executive_summary",
] as const;

export type BrandBdAiAnalysisType = (typeof BRAND_BD_AI_ANALYSIS_TYPES)[number];

export const BRAND_BD_AI_ANALYSIS_LABELS_ZH: Record<
  BrandBdAiAnalysisType,
  string
> = {
  brand_summary: "品牌信息总结",
  next_strategy: "下一轮洽谈策略",
  meeting_brief: "会议前简报",
  risk_check: "风险与缺失信息",
  followup_draft: "跟进消息草稿",
  executive_summary: "老板视角总结",
};

export const BRAND_BD_AI_ANALYSIS_LABELS_JA: Record<
  BrandBdAiAnalysisType,
  string
> = {
  brand_summary: "ブランド情報要約",
  next_strategy: "次回商談戦略",
  meeting_brief: "商談前ブリーフ",
  risk_check: "リスク・不足情報",
  followup_draft: "フォロー文面案",
  executive_summary: "経営者向け要約",
};

export function toJstDateKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function isBrandBdAiDraftType(
  value: unknown
): value is BrandBdAiAnalysisType {
  return BRAND_BD_AI_ANALYSIS_TYPES.includes(value as BrandBdAiAnalysisType);
}
