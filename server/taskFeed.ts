import type {
  Report,
  ReportFollowup,
  ReportStaff,
  Task,
} from "../drizzle/schema";

export type UnifiedTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type UnifiedTaskFeedItem = {
  key: string;
  source: "manual" | "daily_report";
  id: number;
  title: string;
  status: UnifiedTaskStatus;
  staff: {
    id: number;
    name: string;
    department: string | null;
  } | null;
  assignees: Array<{
    id: number;
    personKey: string;
    name: string;
    department: string | null;
    status: UnifiedTaskStatus | "blocked";
    executionStatus?: UnifiedTaskStatus | "blocked";
    completionVersion?: number | null;
    reviewDecision?: "accepted" | "returned" | null;
    reviewNote?: string | null;
    canReviewCompletion?: boolean;
  }>;
  createdAt: Date;
  startDate: number;
  deadline: Date | null;
  href: string;
  category: string | null;
  reportId: number | null;
  reportDate: Date | null;
  canEdit: boolean;
  canSubmitFeedback: boolean;
  executionSummary: {
    assignedCount: number;
    completedCount: number;
    acceptedCount?: number;
    pendingReviewCount?: number;
    blockedCount: number;
    ownStatus: string | null;
    ownReviewDecision?: "accepted" | "returned" | null;
  } | null;
};

type LegacyTaskRow = {
  task: Omit<Task, "completionToken" | "screenshotKey" | "screenshotKeys" | "requestId">;
  staff: { id: number; name: string; department: string | null } | null;
  assignees?: Array<{
    id: number;
    personKey: string;
    name: string;
    department: string | null;
    status: UnifiedTaskStatus | "blocked";
    executionStatus?: UnifiedTaskStatus | "blocked";
    feedbackId?: number | null;
    reviewDecision?: "accepted" | "returned" | null;
    reviewNote?: string | null;
    canReviewCompletion?: boolean;
  }>;
  displayStatus?: UnifiedTaskStatus;
  canEdit?: boolean;
  canSubmitFeedback?: boolean;
  executionSummary?: {
    assignedCount: number;
    completedCount: number;
    acceptedCount?: number;
    pendingReviewCount?: number;
    blockedCount: number;
    ownStatus: string | null;
    ownReviewDecision?: "accepted" | "returned" | null;
  };
};

type ReportFollowupRow = {
  followup: ReportFollowup;
  staff: ReportStaff | null;
  report: Report | null;
  canEdit: boolean;
  canSubmitFeedback: boolean;
  reviewDecision: "accepted" | "returned" | null;
  reviewNote: string | null;
  canReviewCompletion: boolean;
};

function toMillis(value: Date | number | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

export function buildUnifiedTaskFeed(
  legacyRows: LegacyTaskRow[],
  reportRows: ReportFollowupRow[]
): UnifiedTaskFeedItem[] {
  const manualItems: UnifiedTaskFeedItem[] = legacyRows.map(({ task, staff, assignees, displayStatus, canEdit, canSubmitFeedback, executionSummary }) => ({
    key: `manual:${task.id}`,
    source: "manual",
    id: task.id,
    title: task.taskDetail,
    status: displayStatus || task.status,
    staff: staff
      ? {
          id: staff.id,
          name: staff.name,
          department: staff.department || null,
        }
      : null,
    assignees: assignees?.length
      ? assignees.map(assignee => ({
          ...assignee,
          completionVersion: assignee.feedbackId || null,
        }))
      : staff
        ? [{
            id: staff.id,
            personKey: `staff:${staff.id}`,
            name: staff.name,
            department: staff.department || null,
            status: displayStatus || task.status,
          }]
        : [],
    createdAt: task.createdAt,
    startDate: task.startDate,
    deadline: task.deadline || null,
    href: `/master/tasks/${task.id}`,
    category: null,
    reportId: null,
    reportDate: null,
    canEdit: Boolean(canEdit),
    canSubmitFeedback: Boolean(canSubmitFeedback),
    executionSummary: executionSummary || null,
  }));

  const reportItems: UnifiedTaskFeedItem[] = reportRows.map(
    ({ followup, staff, report, canEdit, canSubmitFeedback, reviewDecision, reviewNote, canReviewCompletion }) => ({
      key: `daily-report:${followup.id}`,
      source: "daily_report",
      id: followup.id,
      title: followup.extractedItem,
      status: followup.status === "completed"
        && followup.requiresAcceptance
        && reviewDecision !== "accepted"
        ? "in_progress"
        : followup.status === "pending" ? "in_progress" : followup.status,
      staff: staff
        ? {
            id: staff.id,
            name: staff.name,
            department: null,
          }
        : null,
      assignees: staff
        ? [{
            id: staff.id,
            personKey: staff.linkedStaffId
              ? `staff:${staff.linkedStaffId}`
              : `report-staff:${staff.id}`,
            name: staff.name,
            department: null,
            status: followup.status === "completed"
              && followup.requiresAcceptance
              && reviewDecision !== "accepted"
              ? "in_progress"
              : followup.status === "pending" ? "in_progress" : followup.status,
            executionStatus: followup.status,
            completionVersion: followup.completionRevision || null,
            reviewDecision,
            reviewNote,
            canReviewCompletion,
          }]
        : [],
      createdAt: followup.createdAt,
      startDate: report?.reportDate
        ? report.reportDate.getTime()
        : followup.createdAt.getTime(),
      deadline: followup.dueDate || null,
      href: `/master/reports?reportId=${followup.reportId}`,
      category: followup.category,
      reportId: followup.reportId,
      reportDate: report?.reportDate || null,
      canEdit,
      canSubmitFeedback,
      executionSummary: {
        assignedCount: 1,
        completedCount: followup.status === "completed"
          && (!followup.requiresAcceptance || reviewDecision === "accepted") ? 1 : 0,
        acceptedCount: reviewDecision === "accepted" ? 1 : 0,
        pendingReviewCount: followup.status === "completed"
          && followup.requiresAcceptance
          && reviewDecision == null ? 1 : 0,
        blockedCount: 0,
        ownStatus: canSubmitFeedback ? followup.status : null,
        ownReviewDecision: canSubmitFeedback ? reviewDecision : null,
      },
    })
  );

  return [...manualItems, ...reportItems].sort(
    (left, right) =>
      toMillis(right.createdAt) - toMillis(left.createdAt) ||
      right.id - left.id
  );
}

export function filterUnifiedTaskFeed(
  items: UnifiedTaskFeedItem[],
  searchTerm: string,
  status: string
) {
  const normalized = searchTerm.trim().toLocaleLowerCase();
  return items.filter(item => {
    if (status !== "all" && item.status !== status) return false;
    if (!normalized) return true;
    return [
      item.title,
      item.staff?.name,
      item.staff?.department,
      ...item.assignees.flatMap(assignee => [assignee.name, assignee.department]),
      item.category,
    ].some(value => value?.toLocaleLowerCase().includes(normalized));
  });
}

type StatusCounts = Record<"all" | UnifiedTaskStatus, number>;

export function countUnifiedTaskStatuses(
  items: UnifiedTaskFeedItem[]
): StatusCounts {
  return items.reduce<StatusCounts>(
    (counts, item) => {
      counts.all += 1;
      counts[item.status] += 1;
      return counts;
    },
    { all: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 }
  );
}
