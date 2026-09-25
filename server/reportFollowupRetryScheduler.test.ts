import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { getDb, processDailyReportTaskLifecycle, safelyReviewPreviousTasksFromReport } = vi.hoisted(() => ({
  getDb: vi.fn(),
  processDailyReportTaskLifecycle: vi.fn(),
  safelyReviewPreviousTasksFromReport: vi.fn(),
}));
vi.mock("./db", () => ({ getDb }));
vi.mock("./reportFollowupAutomation", () => ({ reportExtractionContentHash: vi.fn(() => "hash") }));
vi.mock("./dailyReportTaskReview", () => ({
  processDailyReportTaskLifecycle,
  safelyReviewPreviousTasksFromReport,
}));

import { retryFailedReportFollowupExtractions } from "./reportFollowupRetryScheduler";

function queryText(value: unknown): string {
  const chunks = (value as any)?.queryChunks;
  if (!Array.isArray(chunks)) return String(value || "");
  return chunks.map((chunk: any) => {
    if (typeof chunk?.value?.[0] === "string") return chunk.value[0];
    if (chunk?.queryChunks) return queryText(chunk);
    return "?";
  }).join("").replace(/\s+/g, " ").trim();
}

const updatedAt = new Date("2026-09-20T08:00:00Z");
const baseRow = {
  runId: 7,
  id: 42,
  reportStaffId: 5,
  reportDate: new Date("2026-09-20T00:00:00Z"),
  workContent: "retry",
  issues: null,
  remarks: null,
  createdBy: 88,
  updatedAt,
  reportContentHash: "hash",
  attempts: 1,
};

const schedulerSource = readFileSync(
  new URL("./reportFollowupRetryScheduler.ts", import.meta.url),
  "utf8"
);

describe("daily report extraction compensation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads real extraction failures and retries the complete lifecycle", async () => {
    getDb.mockResolvedValue({
      execute: vi.fn(async () => [[{ ...baseRow, errorCode: "Error" }]]),
    });
    processDailyReportTaskLifecycle.mockResolvedValue({
      review: { status: "succeeded" },
      extraction: { status: "succeeded" },
    });

    const result = await retryFailedReportFollowupExtractions();

    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    expect(processDailyReportTaskLifecycle).toHaveBeenCalledWith(expect.objectContaining({ id: 42, createdBy: 88, updatedAt }));
    expect(safelyReviewPreviousTasksFromReport).not.toHaveBeenCalled();
  });

  it("retries TASK_REVIEW_FAILED under a CAS lease without rerunning extraction", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ ...baseRow, errorCode: "TASK_REVIEW_FAILED" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    getDb.mockResolvedValue({ execute });
    safelyReviewPreviousTasksFromReport.mockResolvedValue({ status: "succeeded" });

    const result = await retryFailedReportFollowupExtractions();

    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    expect(safelyReviewPreviousTasksFromReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
      expect.objectContaining({ assertBeforeCommit: expect.any(Function) }),
    );
    expect(processDailyReportTaskLifecycle).not.toHaveBeenCalled();
    const reviewOptions = safelyReviewPreviousTasksFromReport.mock.calls[0][1];
    const transactionExecute = vi.fn(async () => [{ affectedRows: 1 }]);
    await reviewOptions.assertBeforeCommit({ execute: transactionExecute });
    expect(queryText(transactionExecute.mock.calls[0][0])).toContain("leaseToken");
    const sqlTexts = execute.mock.calls.map(([raw]) => queryText(raw));
    expect(sqlTexts.some(text => text.includes("attempts = attempts + 1") && text.includes("leaseToken"))).toBe(true);
    expect(sqlTexts.some(text => text.includes("SET status = 'succeeded'") && text.includes("leaseToken"))).toBe(true);
  });

  it("does not call the model when another replica wins the review lease", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ ...baseRow, errorCode: "TASK_REVIEW_FAILED" }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    getDb.mockResolvedValue({ execute });

    const result = await retryFailedReportFollowupExtractions();

    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 0 });
    expect(safelyReviewPreviousTasksFromReport).not.toHaveBeenCalled();
    expect(processDailyReportTaskLifecycle).not.toHaveBeenCalled();
  });

  it("dead-letters the fifth failed review and blocks a sixth claim", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ ...baseRow, errorCode: "TASK_REVIEW_FAILED", attempts: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    getDb.mockResolvedValue({ execute });
    safelyReviewPreviousTasksFromReport.mockResolvedValue({ status: "failed" });

    const result = await retryFailedReportFollowupExtractions();

    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    const failureSql = queryText(execute.mock.calls[2][0]);
    expect(failureSql).toContain("WHEN attempts >= 5 THEN CURRENT_TIMESTAMP");
    expect(failureSql).toContain("leaseToken");
  });

  it("also reclaims a worker run whose lease expired", () => {
    expect(schedulerSource).toContain("run.status = 'failed'");
    expect(schedulerSource).toContain("run.status = 'running'");
    expect(schedulerSource).toContain("run.leaseUntil IS NULL OR run.leaseUntil <= CURRENT_TIMESTAMP");
  });
});
