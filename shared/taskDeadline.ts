const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseTaskDeadlineJst(value: string): Date {
  const trimmed = value.trim();
  let normalized = trimmed;
  const dateOnly = trimmed.match(DATE_ONLY);
  const local = trimmed.match(LOCAL_DATE_TIME);
  if (dateOnly) normalized = `${trimmed}T23:59:59+09:00`;
  else if (local) {
    normalized = `${local[1]}T${local[2]}:${local[3]}:${local[4] || "00"}+09:00`;
  }
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new Error("截止时间格式无效");
  if (dateOnly || local) {
    const shifted = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
    const expected = dateOnly
      ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
      : `${local![1]}T${local![2]}:${local![3]}:${local![4] || "00"}`;
    const actual = dateOnly
      ? shifted.toISOString().slice(0, 10)
      : shifted.toISOString().slice(0, 19);
    if (actual !== expected) throw new Error("截止时间格式无效");
  }
  return parsed;
}

export function taskDeadlineInputToJstRfc3339(value: string): string {
  if (!LOCAL_DATE_TIME.test(value.trim())) throw new Error("截止时间格式无效");
  parseTaskDeadlineJst(value);
  const local = value.trim();
  return `${local.length === 16 ? `${local}:00` : local}+09:00`;
}
