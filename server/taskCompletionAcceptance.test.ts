import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0163_task_completion_acceptance.sql", "utf8");
const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
const upgrade = readFileSync("server/taskExecutionUpgrade.ts", "utf8");
const service = readFileSync("server/taskExecutionService.ts", "utf8");
const router = readFileSync("server/routers.ts", "utf8");
const database = readFileSync("server/db.ts", "utf8");
const feed = readFileSync("server/taskFeed.ts", "utf8");
const taskList = readFileSync("client/src/pages/TaskList.tsx", "utf8");
const taskDetail = readFileSync("client/src/pages/TaskDetail.tsx", "utf8");
const performance = readFileSync("server/performanceReconciliationService.ts", "utf8");
const brandBdCommand = readFileSync("server/brandBdCommandService.ts", "utf8");
const dailyReview = readFileSync("server/dailyReportTaskReview.ts", "utf8");
const startupMigration = readFileSync("run-required-startup-migrations.mjs", "utf8");

describe("task completion acceptance", () => {
  it("ships a forward migration and append-only review events", () => {
    expect(journal).toContain('"tag": "0163_task_completion_acceptance"');
    expect(migration).toContain("ADD COLUMN `requiresAcceptance`");
    expect(migration).toContain("DEFAULT TRUE");
    expect(migration).toContain("UPDATE `tasks`\nSET `requiresAcceptance` = FALSE\nWHERE `status` = 'completed'");
    expect(migration).toContain("UPDATE `report_followups`\nSET `requiresAcceptance` = FALSE\nWHERE `status` = 'completed'");
    expect(migration).toContain("`completionRequestId` VARCHAR(128)");
    expect(migration).not.toContain("DROP TRIGGER");
    expect(migration).toContain("ADD COLUMN `completionRevision`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `task_completion_review_events`");
    expect(migration).toContain("UNIQUE KEY `uq_task_completion_review_version`");
    expect(migration).toContain("BEFORE UPDATE ON `task_completion_review_events`");
    expect(migration).toContain("BEFORE DELETE ON `task_completion_review_events`");
    expect(schema).toContain('mysqlTable("task_completion_review_events"');
    expect(upgrade).toContain("trg_task_completion_review_no_update");
    expect(upgrade).toContain("trg_task_completion_review_no_delete");
    expect(startupMigration).toContain('"0163_task_completion_acceptance"');
    expect(startupMigration).toContain("uq_task_completion_review_version");
    expect(startupMigration).toContain("if (ledgerState.alreadyRecorded) continue");
    expect(startupMigration).toContain("ER_TRG_ALREADY_EXISTS");
  });

  it("allows only the creator, responsible manager or super admin to review", () => {
    expect(service).toContain("canReviewTaskCompletion");
    expect(service).toContain("task.createdBy === access.userId");
    expect(service).toContain("access.reviewableStaffIds.includes(subjectStaffId)");
    expect(service).toContain("无权验收该执行人的任务");
    expect(service).toContain("无权验收该日报任务");
    expect(router).toContain("reviewCompletion: protectedProcedure");
    expect(router).toContain("assertLcjBrainLinkedTaskMutationAllowed(input.id, \"update\")");
  });

  it("keeps completion pending until accepted and permits a returned resubmission", () => {
    expect(service).toContain('row.reviewDecision === "accepted"');
    expect(service).toContain("completionVersion: input.feedbackId");
    expect(service).toContain('input.decision === "returned"');
    expect(database).toContain("updateData.completionRevision = Number(before.completionRevision || 0) + 1");
    expect(database).toContain("before.completionRequestId === completionRequestId");
    expect(database).toContain("normalizedTaskData.requiresAcceptance = true");
    expect(feed).toContain("pendingReviewCount");
    expect(taskList).toContain('data-testid="task-accept-completion"');
    expect(taskList).toContain('data-testid="task-return-completion"');
    expect(taskList).toContain("完成申报已提交，等待负责人确认");
    expect(taskList).toContain("completionRequestIdsRef.current.get(item.key)");
    expect(taskList).toContain("reviewAttemptsRef.current.get(operationKey)");
    expect(taskDetail).toContain("申报完成（待负责人确认）");
    expect(taskDetail).toContain("reviewAttemptsRef.current.get(operationKey)");
  });

  it("counts only accepted work in performance while retaining submitted completion time", () => {
    expect(performance).toContain("review.decision = 'accepted'");
    expect(performance).toContain("t.status = 'completed' AND COALESCE(t.requiresAcceptance, FALSE) = FALSE");
    expect(brandBdCommand).not.toContain("UPDATE tasks SET status='completed'");
    expect(brandBdCommand).toContain("UPDATE tasks SET status='in_progress',completedAt=NULL WHERE id=? AND status='pending'");
    expect(performance).toContain("THEN feedback.completedAt");
    expect(dailyReview).toContain("ai_next_report_completion_submitted");
    expect(dailyReview).toContain("requiresAcceptance = TRUE");
    expect(dailyReview).toContain("task_completion_review_events review");
  });
});
