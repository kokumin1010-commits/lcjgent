export const DAILY_REPORT_REQUIRED_ANSWER_COUNT = 3;

export function isDailyReportConversationIntent(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  return /(?:写|填写|提交|创建|做|書|記入|作成|提出).{0,8}(?:日报|日報)|(?:日报|日報).{0,8}(?:写|填写|提交|创建|做|書|記入|作成|提出)/i.test(
    normalized
  );
}

export function getJstDayRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) -
      9 * 60 * 60 * 1000
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
