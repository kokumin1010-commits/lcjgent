import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const taskList = readFileSync(
  new URL("../client/src/pages/TaskList.tsx", import.meta.url),
  "utf8"
);
const reports = readFileSync(
  new URL("../client/src/pages/Reports.tsx", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("./taskExecutionUpgrade.ts", import.meta.url), "utf8");
const reconciliation = readFileSync(
  new URL("./performanceReconciliationService.ts", import.meta.url),
  "utf8"
);
const lifecycle = readFileSync(
  new URL("./dailyReportTaskReview.ts", import.meta.url),
  "utf8"
);

describe("daily-report tasks in the master task list", () => {
  it("merges manual tasks with report followups under report visibility rules", () => {
    expect(routers).toContain("feed: protectedProcedure");
    expect(routers).toContain("getAllReportFollowups(buildReportVisibilityFilter(scope))");
    expect(routers).toContain("buildUnifiedTaskFeed");
    expect(database).toContain("export async function getAllReportFollowups");
    expect(database).toContain("buildReportVisibilityCondition(visibility)");
  });

  it("queues form submissions while retaining review lifecycle for retry, chat and batch paths", () => {
    expect(database).toContain("await enqueueReportFollowupExtractionWithExecutor(transaction, created)");
    expect(database).toContain("if (enqueueFollowups)");
    expect(database).toContain("await enqueueReportFollowupExtractionWithExecutor(transaction, after, true)");
    expect(routers).toContain('await updateReport(id, data, ctx.user.id, "update", true)');
    expect(routers).toContain("await processDailyReportTaskLifecycle(report)");
    expect(routers).toContain("await processDailyReportTaskLifecycleBatch(");
    expect(lifecycle).toContain("sourceReport.reportDate <");
    expect(lifecycle).toContain("confidence >= 0.9");
    expect(lifecycle).toContain("ai_next_report_complete");
    expect(lifecycle).toContain("queue.sort((left, right)");
    expect(lifecycle).toContain("TASK_REVIEW_FAILED");
    expect(lifecycle).toContain("creatorStaffId === linkedStaffId");
    expect(lifecycle).toContain("lcj_brain_project_execution_task_links");
    expect(lifecycle).toContain("INNER JOIN staff activeStaff");
    expect(routers).not.toContain("Simple keyword-based extraction for batch processing");
  });

  it("shows source badges, status counts, search and historical sync in the task UI", () => {
    expect(taskList).toContain("trpc.task.feed.useQuery");
    expect(taskList).toContain("日報分析");
    expect(taskList).toContain("手動登録");
    expect(taskList).toContain("過去30日の日報を同期");
    expect(taskList).toContain("utils.task.feed.invalidate()");
    expect(taskList).toContain('data-testid="task-self-complete"');
    expect(taskList).toContain("员工在任务列表中勾选已完成");
    expect(taskList).toContain("任务已完成，已移入完成记录");
    expect(taskList).toContain('item.executionSummary?.ownStatus !== "completed"');
    expect(taskList).toContain("trpc.task.completeOwnReportFollowup.useMutation");
    expect(routers).toContain("completeOwnReportFollowup: protectedProcedure");
    expect(routers).toContain("scope.ownReportStaffIds.includes(followup.reportStaffId)");
    expect(database).toContain("expectedIdentity?: { reportStaffId: number; linkedStaffId: number }");
    expect(database).toContain('if (before.status !== "pending")');
    expect(database).toContain('eq(reportFollowups.status, "pending")');
  });

  it("groups the task list by every visible assignee with compact collapsible sections", () => {
    expect(taskList).toContain('data-testid="task-person-groups"');
    expect(taskList).toContain("按负责人分组");
    expect(taskList).toContain("全部负责人");
    expect(taskList).toContain("全部展开");
    expect(taskList).toContain("全部收起");
    expect(taskList).toContain("多人任务会分别显示在每位执行人名下");
    expect(taskList).toContain("item.assignees");
    expect(taskList).toContain(".map(person => person.name)");
    expect(taskList).toContain("groupTasksByPerson(items)");
    expect(taskList).toContain("group.counts.blocked");
    expect(taskList).toContain('data-testid="task-person-unfinished-marker"');
    expect(taskList).toContain('data-testid="task-unfinished-dot"');
    expect(taskList).toContain("未完成 {group.unfinishedCount}项");
    expect(taskList).toContain("isTaskUnfinishedForPerson(item, group.key)");
  });

  it("opens a report-derived task at its original daily report", () => {
    expect(taskList).toContain("setLocation(item.href)");
    expect(reports).toContain('get("reportId")');
    expect(reports).toContain("setReportDetailDialogOpen(true)");
  });

  it("deduplicates concurrent report tasks without deleting historical rows or double-scoring", () => {
    expect(schema).toContain('dedupeKey: varchar("dedupeKey"');
    expect(schema).toContain('duplicateOfId: int("duplicateOfId")');
    expect(schema).toContain('archivedAt: timestamp("archivedAt")');
    expect(schema).toContain('deletedAt: timestamp("deletedAt")');
    expect(schema).toContain('uniqueIndex("uq_report_followup_report_item")');
    expect(database).toContain("reportFollowupDedupeKey");
    expect(database).toContain("isNull(reportFollowups.duplicateOfId)");
    expect(upgrade).toContain("SET duplicateItem.duplicateOfId = duplicateGroup.keeperId");
    expect(upgrade).toContain("CREATE UNIQUE INDEX uq_report_followup_report_item");
    expect(reconciliation).toContain("followup.duplicateOfId IS NULL");
    expect(reconciliation).toContain("followup.archivedAt IS NULL");
    expect(reconciliation).toContain("report.deletedAt IS NULL");
    expect(database).toContain('deleteReason = "Archived from daily reports"');
    expect(database).toContain('archiveReason = "Archived from report tasks"');
  });
});
