import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Task } from "../drizzle/schema";
import {
  canManageTaskExecution,
  canReviewTaskCompletion,
  canViewTaskExecution,
  resolveAggregateTaskExecutionStatus,
  toTaskClientRecord,
  type TaskExecutionAccess,
} from "./taskExecutionService";
import { toDate } from "./performanceReconciliationService";
import { isOptionalTriggerUnavailable } from "./taskExecutionUpgrade";

const task = {
  id: 10,
  createdBy: 50,
  status: "in_progress",
} as Task;

const employee = (staffId: number | null, userId = 99): TaskExecutionAccess => ({
  userId,
  staffId,
  staffName: null,
  department: null,
  level: "employee",
  managedDepartment: null,
  isSuperAdmin: false,
  reviewableStaffIds: [],
});

describe("task execution access and scoring contract", () => {
  it("only treats unsupported or denied database triggers as optional", () => {
    expect(isOptionalTriggerUnavailable({ code: "ER_NOT_SUPPORTED_YET" })).toBe(true);
    expect(isOptionalTriggerUnavailable({ code: "ER_TABLEACCESS_DENIED_ERROR" })).toBe(true);
    expect(isOptionalTriggerUnavailable({ errno: 1227 })).toBe(true);
    expect(isOptionalTriggerUnavailable(new Error("TRIGGER command denied to user"))).toBe(true);
    expect(isOptionalTriggerUnavailable({ code: "ER_PARSE_ERROR" })).toBe(false);
  });

  it("never serializes internal task tokens, storage keys, or request ids", () => {
    const safe = toTaskClientRecord({
      id: 1,
      taskId: "TASK-1",
      completionToken: "secret-token",
      screenshotKey: "private/legacy-object-key",
      screenshotKeys: ["private/object-key"],
      requestId: "private-request-id",
    } as any);
    expect(safe).not.toHaveProperty("completionToken");
    expect(safe).not.toHaveProperty("screenshotKey");
    expect(safe).not.toHaveProperty("screenshotKeys");
    expect(safe).not.toHaveProperty("requestId");
    expect(safe).toMatchObject({ id: 1, taskId: "TASK-1" });
  });

  it("allows the creator, assignee and responsible manager but rejects unrelated staff", () => {
    expect(canViewTaskExecution(employee(null, 50), task, [7])).toBe(true);
    expect(canManageTaskExecution(employee(null, 50), task, [7])).toBe(true);
    expect(canViewTaskExecution(employee(7), task, [7])).toBe(true);
    expect(canManageTaskExecution(employee(7), task, [7])).toBe(false);
    expect(canViewTaskExecution(employee(8), task, [7])).toBe(false);

    const manager: TaskExecutionAccess = {
      ...employee(20),
      level: "department_manager",
      reviewableStaffIds: [7],
    };
    expect(canViewTaskExecution(manager, task, [7])).toBe(true);
    expect(canManageTaskExecution(manager, task, [7])).toBe(true);
    expect(canViewTaskExecution(manager, task, [7, 8])).toBe(true);
    expect(canManageTaskExecution(manager, task, [7, 8])).toBe(false);
    expect(canReviewTaskCompletion(manager, task, 7)).toBe(true);
    expect(canReviewTaskCompletion(manager, task, 8)).toBe(false);
    expect(canReviewTaskCompletion(employee(null, 50), task, 8)).toBe(true);
  });

  it("keeps multi-assignee tasks open until every active assignee reports completion", () => {
    expect(resolveAggregateTaskExecutionStatus(task, [
      { status: "completed", feedbackId: 1 },
      { status: "pending", feedbackId: null },
    ])).toBe("in_progress");
    expect(resolveAggregateTaskExecutionStatus(task, [
      { status: "completed", feedbackId: 1 },
      { status: "completed", feedbackId: 2 },
    ])).toBe("completed");
    expect(resolveAggregateTaskExecutionStatus(task, [
      { status: "blocked", feedbackId: 1 },
    ])).toBe("in_progress");
  });

  it("keeps completion submissions open until every required acceptance is recorded", () => {
    const reviewRequiredTask = { ...task, requiresAcceptance: true };
    expect(resolveAggregateTaskExecutionStatus(reviewRequiredTask, [
      { status: "completed", feedbackId: 11, reviewDecision: null },
      { status: "completed", feedbackId: 12, reviewDecision: "accepted" },
    ])).toBe("in_progress");
    expect(resolveAggregateTaskExecutionStatus(reviewRequiredTask, [
      { status: "completed", feedbackId: 11, reviewDecision: "accepted" },
      { status: "completed", feedbackId: 12, reviewDecision: "accepted" },
    ])).toBe("completed");
    expect(resolveAggregateTaskExecutionStatus(reviewRequiredTask, [
      { status: "completed", feedbackId: 13, reviewDecision: "returned" },
    ])).toBe("in_progress");
  });

  it("treats task cancellation as higher priority than historical assignee feedback", () => {
    expect(resolveAggregateTaskExecutionStatus(
      { ...task, status: "cancelled" },
      [
        { status: "completed", feedbackId: 1 },
        { status: "blocked", feedbackId: 2 },
      ]
    )).toBe("cancelled");
  });

  it("parses BIGINT epoch milliseconds and database timestamps for on-time scoring", () => {
    expect(toDate(1789876800000)?.toISOString()).toBe("2026-09-20T04:00:00.000Z");
    expect(toDate("1789876800000")?.toISOString()).toBe("2026-09-20T04:00:00.000Z");
    expect(toDate("2026-09-20T04:00:00.000Z")?.toISOString()).toBe("2026-09-20T04:00:00.000Z");
  });

  it("ships append-only feedback storage and per-assignee performance facts", () => {
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    const upgrade = readFileSync("server/taskExecutionUpgrade.ts", "utf8");
    const reconciliation = readFileSync("server/performanceReconciliationService.ts", "utf8");
    const router = readFileSync("server/routers.ts", "utf8");
    const executionService = readFileSync("server/taskExecutionService.ts", "utf8");
    const serverEntry = readFileSync("server/_core/index.ts", "utf8");
    const completionRouter = readFileSync("server/completion.ts", "utf8");
    const database = readFileSync("server/db.ts", "utf8");
    const detail = readFileSync("client/src/pages/TaskDetail.tsx", "utf8");
    const email = readFileSync("server/emailService.ts", "utf8");
    const identityMerge = readFileSync("server/staffIdentityConsistency.ts", "utf8");

    expect(schema).toContain('mysqlTable("task_execution_feedbacks"');
    expect(schema).toContain('mysqlTable("task_completion_review_events"');
    expect(schema).not.toContain('uniqueIndex("uq_task_execution_task_staff');
    expect(schema).toContain('uniqueIndex("uq_task_execution_feedback_request")');
    expect(schema).toContain('uniqueIndex("uq_task_staff_task_staff")');
    expect(schema).toContain('archivedAt: timestamp("archivedAt")');
    expect(schema).toContain('mysqlTable("task_staff_archive"');
    expect(schema).toContain('deletedAt: timestamp("deletedAt")');
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS task_execution_feedbacks");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS task_completion_review_events");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS task_staff_archive");
    expect(upgrade.indexOf("INSERT IGNORE INTO task_staff_archive")).toBeLessThan(
      upgrade.indexOf("DELETE duplicateAssignment")
    );
    expect(upgrade).toContain("CREATE UNIQUE INDEX uq_task_staff_task_staff");
    expect(serverEntry.indexOf("const initializeTaskExecutionStorage")).toBeLessThan(
      serverEntry.lastIndexOf("server.listen(port")
    );
    const upgradeSuccess = serverEntry.slice(
      serverEntry.indexOf("const initializeTaskExecutionStorage"),
      serverEntry.indexOf("server.listen(port", serverEntry.indexOf("const initializeTaskExecutionStorage"))
    );
    expect(upgradeSuccess).toContain("startPerformanceScheduler()");
    expect(upgradeSuccess).toContain("startReportFollowupRetryScheduler()");
    expect(upgradeSuccess).toContain("startTaskNotificationScheduler()");
    expect(serverEntry.lastIndexOf("startTaskNotificationScheduler()")).toBeLessThan(
      serverEntry.lastIndexOf("server.listen(port")
    );
    expect(upgradeSuccess).toContain("taskExecutionSchedulersStarted");
    expect(upgradeSuccess).toContain("setTimeout(() => initializeTaskExecutionStorage(attempt + 1)");
    expect(serverEntry).toContain('/api/health/task-execution');
    expect(router).toContain("submitExecutionFeedback: taskExecutionProcedure");
    expect(router).toContain("reviewCompletion: taskExecutionProcedure");
    expect(executionService).toContain("仅被指派员工可以提交本人的执行反馈");
    expect(detail).toContain("提交我的执行反馈");
    expect(detail).toContain("每月任务完成率与按期完成率");
    expect(email).toContain("/master/tasks/${taskRecordId}");
    const completionRoute = serverEntry.slice(
      serverEntry.indexOf('app.get("/complete/:token"'),
      serverEntry.indexOf("// LINE Webhook endpoint")
    );
    expect(completionRoute).toContain("/master/tasks/${task.id}");
    expect(completionRoute).not.toContain("updateTask(");
    expect(completionRouter).toContain("requiresLogin: true");
    expect(completionRouter).not.toContain(".update(tasks)");
    expect(completionRouter).not.toContain("taskDetail: task.taskDetail");
    expect(database).not.toContain("db.delete(tasks)");
    expect(database).not.toContain("db.delete(reports)");
    expect(database).not.toContain("db.delete(reportFollowups)");
    expect(database).toContain("INSERT IGNORE INTO task_staff_archive");
    expect(identityMerge).toContain("INSERT IGNORE INTO task_staff_archive");
    expect(identityMerge.indexOf("INSERT IGNORE INTO task_staff_archive")).toBeLessThan(
      identityMerge.indexOf("DELETE source FROM task_staff source")
    );
    expect(database).toContain('archiveReason = "Archived from task management"');
    expect(executionService).toContain("taskNotificationOutbox");
    expect(executionService).toContain("feedback:${insertedFeedback.id}:creator");
    expect(executionService).toContain("const visibleAssignments = canManage");
    expect(executionService).toContain("access.reviewableStaffIds.includes(item.staffId)");
    expect(executionService).toContain("assignees: visibleAssignments.map");
    expect(executionService).toContain("personKey: `staff:${item.staffId}`");
    expect(executionService).toContain("status: item.status");
    expect(router).not.toContain("Creator notification failed");
    expect(reconciliation).toContain("MAX(latest.id)");
    expect(reconciliation).toContain("report_followups followup");
    expect(reconciliation).toContain("CONCAT('daily-report:', followup.id)");
    expect(reconciliation).toContain("CAST(t.id AS CHAR) AS sourceId");
    expect(reconciliation).toContain("review.decision = 'accepted'");
  });
});
