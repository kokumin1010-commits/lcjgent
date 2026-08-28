export const DAILY_REPORT_TEMPLATE = {
  workContent: `【✅ 今日已完成】
1. 【品牌/店铺｜工作事项】完成……（写明结果或数据）
2. 【品牌/店铺｜工作事项】完成……（写明结果或数据）
3. 【品牌/店铺｜工作事项】完成……（写明结果或数据）`,
  issues: `【⏳ 待跟进事项】
1. 【品牌/店铺｜工作事项】下一步具体动作、负责人/排期（如有）
2. 【品牌/店铺｜工作事项】下一步具体动作、负责人/排期（如有）

【📝 问题/备注（需要协调）】
无（如有卡点，请写明问题、影响及需要谁协助）`,
  remarks: `【🎯 明日优先工作】
1. 优先事项……
2. 优先事项……
3. 优先事项……

【📎 附件】
无（如有请上传 LINE / Lark 截图）`,
} as const;

const TEMPLATE_PLACEHOLDERS = [
  "【品牌/店铺｜工作事项】",
  "完成……",
  "下一步具体动作",
  "优先事项……",
] as const;

export function hasUnfilledDailyReportPlaceholder(value: string): boolean {
  return TEMPLATE_PLACEHOLDERS.some(placeholder => value.includes(placeholder));
}

export function isDefaultDailyReportTemplate(
  field: keyof typeof DAILY_REPORT_TEMPLATE,
  value: string
): boolean {
  return value.trim() === DAILY_REPORT_TEMPLATE[field].trim();
}
