import { describe, expect, it } from "vitest";
import {
  buildUnifiedTaskFeed,
  countUnifiedTaskStatuses,
  filterUnifiedTaskFeed,
} from "./taskFeed";

const legacyTask = {
  id: 7,
  taskId: "TASK-LEGACY",
  status: "pending" as const,
  staffId: 3,
  taskDetail: "契約書を確認する",
  extractedContext: null,
  deadline: new Date("2026-09-25T00:00:00.000Z"),
  screenshotUrl: null,
  screenshotKey: null,
  screenshotUrls: null,
  screenshotKeys: null,
  completionToken: null,
  notes: null,
  startDate: Date.parse("2026-09-19T00:00:00.000Z"),
  completedAt: null,
  lastReminderAt: null,
  createdBy: 1,
  createdAt: new Date("2026-09-19T00:00:00.000Z"),
  updatedAt: new Date("2026-09-19T00:00:00.000Z"),
};

const reportFollowup = {
  id: 11,
  reportId: 42,
  reportStaffId: 5,
  extractedItem: "客户へ見積を送付する",
  category: "確認" as const,
  status: "pending" as const,
  dueDate: new Date("2026-09-23T14:59:59.999Z"),
  resultCategory: null,
  resultNote: null,
  completedAt: null,
  requiresAcceptance: true,
  completionRevision: 0,
  completionRequestId: null,
  completedNote: null,
  nextActionId: null,
  createdAt: new Date("2026-09-20T00:00:00.000Z"),
  updatedAt: new Date("2026-09-20T00:00:00.000Z"),
};

describe("unified task feed", () => {
  const feed = buildUnifiedTaskFeed(
    [{
      task: legacyTask,
      staff: {
        id: 3,
        email: "staff@example.invalid",
        name: "担当者A",
        country: "日本",
        department: "営業",
        role: "staff" as const,
        joinDate: null,
        isActive: true,
        lineUserId: null,
        tier: null,
        evaluationScore: null,
        salary: null,
        salaryCurrency: "JPY",
        position: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      assignees: [
        { id: 3, personKey: "staff:3", name: "担当者A", department: "営業", status: "completed" },
        { id: 8, personKey: "staff:8", name: "共同担当C", department: "運営", status: "blocked" },
      ],
    }],
    [{
      followup: reportFollowup,
      staff: {
        id: 5,
        name: "担当者B",
        country: "中国",
        linkedStaffId: null,
        isActive: "active" as const,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        manualRevisionAt: null,
        manualRevisionBy: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      report: {
        id: 42,
        reportStaffId: 5,
        reportDate: new Date("2026-09-20T00:00:00.000Z"),
        workContent: "",
        issues: null,
        remarks: null,
        createdBy: 1,
        createdAt: new Date("2026-09-20T00:00:00.000Z"),
        updatedAt: new Date("2026-09-20T00:00:00.000Z"),
      },
      canEdit: true,
      canSubmitFeedback: false,
      reviewDecision: null,
      reviewNote: null,
      canReviewCompletion: false,
    }]
  );

  it("merges both stores without changing their identifiers", () => {
    expect(feed.map(item => item.key)).toEqual([
      "daily-report:11",
      "manual:7",
    ]);
    expect(feed[0]).toMatchObject({
      source: "daily_report",
      status: "in_progress",
      href: "/master/reports?reportId=42",
      canEdit: true,
      canSubmitFeedback: false,
      assignees: [{ id: 5, personKey: "report-staff:5" }],
    });
    expect(feed[1]).toMatchObject({
      source: "manual",
      status: "pending",
      href: "/master/tasks/7",
      assignees: [
        { id: 3, personKey: "staff:3", name: "担当者A", department: "営業", status: "completed" },
        { id: 8, personKey: "staff:8", name: "共同担当C", department: "運営", status: "blocked" },
      ],
    });
  });

  it("searches task text, assignee and category across both sources", () => {
    expect(filterUnifiedTaskFeed(feed, "客户", "all")).toHaveLength(1);
    expect(filterUnifiedTaskFeed(feed, "担当者A", "all")).toHaveLength(1);
    expect(filterUnifiedTaskFeed(feed, "共同担当C", "all")).toHaveLength(1);
    expect(filterUnifiedTaskFeed(feed, "運営", "all")).toHaveLength(1);
    expect(filterUnifiedTaskFeed(feed, "確認", "all")[0].source).toBe("daily_report");
  });

  it("filters normalized status and reports complete tab counts", () => {
    expect(filterUnifiedTaskFeed(feed, "", "in_progress")).toHaveLength(1);
    expect(countUnifiedTaskStatuses(feed)).toEqual({
      all: 2,
      pending: 1,
      in_progress: 1,
      completed: 0,
      cancelled: 0,
    });
  });

  it("keeps a completed report submission in progress until a manager accepts it", () => {
    const pendingReview = buildUnifiedTaskFeed([], [{
      followup: {
        ...reportFollowup,
        status: "completed" as const,
        completedAt: new Date("2026-09-20T03:00:00.000Z"),
        completionRevision: 1,
      },
      staff: null,
      report: null,
      canEdit: true,
      canSubmitFeedback: false,
      reviewDecision: null,
      reviewNote: null,
      canReviewCompletion: true,
    }]);
    expect(pendingReview[0]).toMatchObject({
      status: "in_progress",
      executionSummary: { completedCount: 0, pendingReviewCount: 1 },
    });

    const accepted = buildUnifiedTaskFeed([], [{
      followup: {
        ...reportFollowup,
        status: "completed" as const,
        completedAt: new Date("2026-09-20T03:00:00.000Z"),
        completionRevision: 1,
      },
      staff: null,
      report: null,
      canEdit: true,
      canSubmitFeedback: false,
      reviewDecision: "accepted",
      reviewNote: "ok",
      canReviewCompletion: false,
    }]);
    expect(accepted[0]).toMatchObject({
      status: "completed",
      executionSummary: { completedCount: 1, pendingReviewCount: 0 },
    });
  });
});
