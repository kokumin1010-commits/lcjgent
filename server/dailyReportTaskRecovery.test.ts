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

describe("daily-report tasks in the master task list", () => {
  it("merges manual tasks with report followups under report visibility rules", () => {
    expect(routers).toContain("feed: protectedProcedure");
    expect(routers).toContain("getAllReportFollowups(buildReportVisibilityFilter(scope))");
    expect(routers).toContain("buildUnifiedTaskFeed");
    expect(database).toContain("export async function getAllReportFollowups");
    expect(database).toContain("buildReportVisibilityCondition(visibility)");
  });

  it("automatically analyzes every form-created, edited and chat-created report", () => {
    expect(routers.match(/await safelyExtractReportFollowups\(/g)).toHaveLength(3);
    expect(routers).toContain("await safelyExtractReportFollowups(report)");
    expect(routers).toContain("await safelyExtractReportFollowups(updated.report)");
    expect(routers).toContain("await extractReportFollowupBatch(");
    expect(routers).not.toContain("Simple keyword-based extraction for batch processing");
  });

  it("shows source badges, status counts, search and historical sync in the task UI", () => {
    expect(taskList).toContain("trpc.task.feed.useQuery");
    expect(taskList).toContain("日報分析");
    expect(taskList).toContain("手動登録");
    expect(taskList).toContain("過去30日の日報を同期");
    expect(taskList).toContain("utils.task.feed.invalidate()");
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
