export type PersonalTaskStatisticsRow = {
  staffId: number;
  name: string;
  department: string | null;
  position: string | null;
  avatarUrl: string | null;
  taskId: number | null;
  taskStatus: string | null;
  feedbackStatus: string | null;
  deadline: Date | null;
};

export function resolvePersonalTaskStatus(taskStatus: string | null, feedbackStatus: string | null) {
  if (taskStatus === "cancelled") return "cancelled";
  if (feedbackStatus) return feedbackStatus;
  return taskStatus === "completed" ? "completed" : "pending";
}

export function summarizePersonalTaskRows(rows: PersonalTaskStatisticsRow[], now = new Date()) {
  const grouped = new Map<number, ReturnType<typeof makeSummary>>();
  for (const row of rows) {
    let summary = grouped.get(row.staffId);
    if (!summary) {
      summary = makeSummary(row);
      grouped.set(row.staffId, summary);
    }
    if (row.taskId == null) continue;
    const status = resolvePersonalTaskStatus(row.taskStatus, row.feedbackStatus);
    if (["cancelled", "completed"].includes(status)) continue;
    summary.inProgressCount += 1;
    if (row.deadline && row.deadline.getTime() < now.getTime()) summary.overdueCount += 1;
  }
  return [...grouped.values()];
}

function makeSummary(row: PersonalTaskStatisticsRow) {
  return {
    id: row.staffId,
    name: row.name,
    department: row.department,
    position: row.position,
    avatarUrl: row.avatarUrl,
    inProgressCount: 0,
    overdueCount: 0,
  };
}
