import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { execute, getDb } = vi.hoisted(() => ({
  execute: vi.fn(async () => [[]]),
  getDb: vi.fn(),
}));
vi.mock("./db", () => ({ getDb }));

import {
  ensureTaskExecutionTables,
  getTaskExecutionUpgradeStatus,
  isDuplicateSchemaObject,
} from "./taskExecutionUpgrade";

describe("task execution runtime migration", () => {
  it("recognizes TiDB duplicate schema errors through Drizzle cause chains", () => {
    expect(isDuplicateSchemaObject(new Error("Duplicate key name 'idx_existing'"))).toBe(true);
    expect(isDuplicateSchemaObject({ message: "Failed query", cause: { errno: 1061 } })).toBe(true);
    expect(isDuplicateSchemaObject({ code: "ER_DUP_FIELDNAME" })).toBe(true);
    expect(isDuplicateSchemaObject(new Error("permission denied"))).toBe(false);
  });

  it("is idempotent in-process and creates all preservation tables before serving", async () => {
    getDb.mockResolvedValue({ execute });
    await ensureTaskExecutionTables();
    expect(getTaskExecutionUpgradeStatus()).toMatchObject({ state: "ready", step: "complete", error: null });
    const firstCallCount = execute.mock.calls.length;
    await ensureTaskExecutionTables();
    expect(execute).toHaveBeenCalledTimes(firstCallCount);
    const sqlText = readFileSync("server/taskExecutionUpgrade.ts", "utf8");
    expect(sqlText).toContain("report_attachments");
    expect(sqlText).toContain("entity_revision_audits");
    expect(sqlText).toContain("task_creation_requests");
    expect(sqlText).toContain("report_followup_extraction_runs");
    expect(sqlText).toContain("task_notification_outbox");
    expect(sqlText).toContain("uq_task_notification_key");
    expect(sqlText).toContain("uq_task_execution_feedback_request");
    expect(sqlText).toContain("uq_followup_extraction_job");
    expect(sqlText).toContain("uq_tasks_request_id");
    expect(sqlText).toContain("leaseToken VARCHAR(64)");
    expect(sqlText).toContain("deliveryStartedAt TIMESTAMP");
    for (const column of [
      "reportId", "reportUpdatedAt", "status", "extractedCount", "createdCount",
      "updatedCount", "archivedCount", "errorCode", "errorMessage", "startedAt", "finishedAt",
    ]) {
      expect(sqlText).toContain(`[\"${column}\", \"ALTER TABLE report_followup_extraction_runs ADD COLUMN`);
    }
    expect(sqlText).toContain("idx_followup_runs_report_status ON report_followup_extraction_runs (reportId, status, id)");
  });
});
