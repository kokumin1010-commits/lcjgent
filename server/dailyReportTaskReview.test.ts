import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  invokeLLM: vi.fn(),
  ensureTaskExecutionTables: vi.fn(async () => undefined),
  extractAndCreateReportFollowups: vi.fn(),
  safelyExtractReportFollowups: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));
vi.mock("./taskExecutionUpgrade", () => ({ ensureTaskExecutionTables: mocks.ensureTaskExecutionTables }));
vi.mock("./reportFollowupAutomation", () => ({
  extractAndCreateReportFollowups: mocks.extractAndCreateReportFollowups,
  safelyExtractReportFollowups: mocks.safelyExtractReportFollowups,
}));

import {
  autoReviewPreviousTasksFromReport,
  processDailyReportTaskLifecycle,
  safelyReviewPreviousTasksFromReport,
} from "./dailyReportTaskReview";

function queryText(value: any): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (Array.isArray(value)) return value.map(queryText).join(" ");
  if (Array.isArray(value.queryChunks)) return value.queryChunks.map(queryText).join(" ");
  if (Array.isArray(value.value)) return value.value.map(queryText).join(" ");
  if (typeof value.value === "string") return value.value;
  return "";
}

function normalized(value: unknown) {
  return queryText(value).replace(/\s+/g, " ").trim();
}

const report = {
  id: 22,
  reportStaffId: 5,
  reportDate: new Date("2026-09-22T00:00:00.000Z"),
  workContent: "昨天的客户报价已经发送，资料修复也已完成。",
  issues: "无",
  remarks: "明天继续跟进新项目。",
  createdBy: 88,
  updatedAt: new Date("2026-09-22T08:00:00.000Z"),
};

function createDb(options: {
  currentWorkContent?: string;
  decisions?: unknown[];
  latestManualStatus?: string | null;
  latestManualSubmittedAt?: Date | null;
  creatorStaffId?: number | null;
  transactionCreatorStaffId?: number | null;
  brainLinked?: boolean;
} = {}) {
  const transactionExecute = vi.fn(async (raw: unknown) => {
    const text = normalized(raw);
    if (text.includes("FROM reports") && text.includes("FOR UPDATE")) return [[{
      ...report,
      workContent: options.currentWorkContent ?? report.workContent,
    }], []];
    if (text.includes("FROM report_staff")) return [[{
      linkedStaffId: 9,
      creatorStaffId: options.transactionCreatorStaffId === undefined
        ? options.creatorStaffId === undefined ? 9 : options.creatorStaffId
        : options.transactionCreatorStaffId,
    }], []];
    if (text.includes("FROM report_followups") && text.includes("FOR UPDATE")) return [[{
      id: 101,
      reportStaffId: 5,
      status: "pending",
      completedAt: null,
      resultCategory: null,
      resultNote: null,
    }], []];
    if (text.includes("FROM tasks") && text.includes("FOR UPDATE")) return [[{
      id: 202,
      taskId: "TASK-MANUAL-202",
      status: "in_progress",
      completedAt: null,
      createdBy: 77,
    }], []];
    if (text.includes("FROM tasks candidate")) return [[{ assigned: 1 }], []];
    if (text.includes("FROM lcj_brain_project_execution_task_links")) {
      return [options.brainLinked ? [{ linked: 1 }] : [], []];
    }
    if (text.includes("FROM task_execution_feedbacks") && text.includes("requestId")) return [[], []];
    if (text.includes("FROM task_execution_feedbacks") && text.includes("ORDER BY id DESC")) {
      return [options.latestManualStatus ? [{
        status: options.latestManualStatus,
        submittedAt: options.latestManualSubmittedAt || new Date("2026-09-21T08:00:00.000Z"),
      }] : [], []];
    }
    if (text.includes("SELECT assigned.staffId")) return [[{
      staffId: 9,
      status: "completed",
      completedAt: Date.now(),
    }], []];
    if (text.startsWith("INSERT INTO entity_revision_audits")) return [{ affectedRows: 1 }, []];
    if (text.startsWith("UPDATE report_followups")) return [{ affectedRows: 1 }, []];
    if (text.startsWith("UPDATE tasks")) return [{ affectedRows: 1 }, []];
    throw new Error(`Unhandled transaction SQL: ${text}`);
  });
  const feedbackValues = vi.fn(() => ({
    $returningId: vi.fn(async () => [{ id: 900 }]),
  }));
  const transaction = {
    execute: transactionExecute,
    insert: vi.fn(() => ({ values: feedbackValues })),
  };
  const execute = vi.fn(async (raw: unknown) => {
    const text = normalized(raw);
    if (text.includes("FROM report_followups followup")) return [[{
      id: 101,
      title: "客户报价发送",
      sourceDate: new Date("2026-09-21T00:00:00.000Z"),
      deadline: new Date("2026-09-22T14:59:59.000Z"),
    }], []];
    if (text.includes("FROM report_staff")) return [[{
      linkedStaffId: 9,
      creatorStaffId: options.creatorStaffId === undefined ? 9 : options.creatorStaffId,
    }], []];
    if (text.includes("FROM tasks task")) return [[{
      id: 202,
      title: "修复资料",
      sourceDate: new Date("2026-09-21T02:00:00.000Z"),
      deadline: null,
    }], []];
    throw new Error(`Unhandled database SQL: ${text}`);
  });
  const db = {
    execute,
    transaction: vi.fn(async (callback: any) => callback(transaction)),
  };
  mocks.getDb.mockResolvedValue(db);
  mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    decisions: options.decisions ?? [
      { source: "daily_report", id: 101, outcome: "completed", confidence: 0.98, reason: "报价已发送", evidence: "客户报价已经发送" },
      { source: "manual", id: 202, outcome: "completed", confidence: 0.97, reason: "资料已修复", evidence: "资料修复也已完成" },
    ],
  }) } }] });
  return { db, execute, transaction, transactionExecute, feedbackValues };
}

describe("next daily report task completion review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes only explicit high-confidence prior tasks in one audited transaction", async () => {
    const state = createDb();

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 2, keptCount: 0, status: "succeeded" });
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
    const prompt = mocks.invokeLLM.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("completed的confidence必须至少0.90");
    expect(state.feedbackValues).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 202,
      staffId: 9,
      status: "completed",
      submittedByUserId: 88,
      requestId: "daily-report-review:22:task:202",
    }));
    expect(state.feedbackValues).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "feedback_creator",
      recipientUserId: 77,
      feedbackId: 900,
      feedbackStatus: "completed",
    }));
    const writes = state.transactionExecute.mock.calls.map(([raw]) => normalized(raw));
    expect(writes.some(text => text.includes("ai_next_report_complete"))).toBe(true);
    expect(writes.some(text => text.startsWith("UPDATE report_followups"))).toBe(true);
    expect(writes.some(text => text.startsWith("UPDATE tasks"))).toBe(true);
  });

  it("keeps ambiguous or low-confidence tasks unchanged", async () => {
    const state = createDb({
      decisions: [
        { source: "daily_report", id: 101, outcome: "completed", confidence: 0.7, reason: "似乎提到", evidence: "客户报价" },
        { source: "manual", id: 202, outcome: "keep", confidence: 0.99, reason: "仍需跟进", evidence: "明天继续跟进" },
      ],
    });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 0, keptCount: 2, status: "succeeded" });
    expect(state.feedbackValues).not.toHaveBeenCalled();
    expect(state.transactionExecute.mock.calls.map(([raw]) => normalized(raw)).some(text => text.startsWith("UPDATE report_followups") || text.startsWith("UPDATE tasks"))).toBe(false);
  });

  it("rejects high-confidence completion when the cited evidence is not in the report", async () => {
    const state = createDb({
      decisions: [
        { source: "daily_report", id: 101, outcome: "completed", confidence: 0.99, reason: "完了", evidence: "日报中不存在的完成证据" },
        { source: "manual", id: 202, outcome: "completed", confidence: 0.99, reason: "完了", evidence: "日报中不存在的另一条证据" },
      ],
    });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 0, keptCount: 2, status: "succeeded" });
    expect(state.feedbackValues).not.toHaveBeenCalled();
  });

  it("does not review another employee's tasks from a delegated creator report", async () => {
    const state = createDb({ creatorStaffId: 19 });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 0, completedCount: 0, keptCount: 0, status: "succeeded" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(state.feedbackValues).not.toHaveBeenCalled();
  });

  it("never mutates a linked LCJ Brain task even when its taskId has no LCJB prefix", async () => {
    const state = createDb({ brainLinked: true });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 1, keptCount: 1, status: "succeeded" });
    expect(state.feedbackValues).not.toHaveBeenCalledWith(expect.objectContaining({
      requestId: "daily-report-review:22:task:202",
    }));
    expect(state.transactionExecute.mock.calls.map(([raw]) => normalized(raw)).some(text =>
      text.includes("FROM lcj_brain_project_execution_task_links")
    )).toBe(true);
  });

  it("does not duplicate an employee completion already recorded concurrently", async () => {
    const state = createDb({ latestManualStatus: "completed" });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 1, keptCount: 1, status: "succeeded" });
    expect(state.feedbackValues).not.toHaveBeenCalledWith(expect.objectContaining({
      requestId: "daily-report-review:22:task:202",
    }));
  });

  it("preserves a newer employee blocked feedback submitted after the report version", async () => {
    const state = createDb({
      latestManualStatus: "blocked",
      latestManualSubmittedAt: new Date("2026-09-22T08:01:00.000Z"),
    });

    const result = await autoReviewPreviousTasksFromReport(report);

    expect(result).toEqual({ reviewedCount: 2, completedCount: 1, keptCount: 1, status: "succeeded" });
    expect(state.feedbackValues).not.toHaveBeenCalledWith(expect.objectContaining({
      requestId: "daily-report-review:22:task:202",
    }));
  });

  it("fails closed when the report changes after AI review", async () => {
    const state = createDb({ currentWorkContent: "报告在AI判断后被修改" });

    const result = await safelyReviewPreviousTasksFromReport(report);

    expect(result).toMatchObject({ status: "failed", completedCount: 0 });
    expect(state.feedbackValues).not.toHaveBeenCalled();
    expect(state.transactionExecute.mock.calls.map(([raw]) => normalized(raw)).some(text => text.startsWith("UPDATE report_followups") || text.startsWith("UPDATE tasks"))).toBe(false);
  });

  it("fails closed when the canonical employee identity changes after AI review", async () => {
    const state = createDb({ transactionCreatorStaffId: 19 });

    const result = await safelyReviewPreviousTasksFromReport(report);

    expect(result).toMatchObject({ status: "failed", completedCount: 0 });
    expect(state.feedbackValues).not.toHaveBeenCalled();
    expect(state.transactionExecute.mock.calls.map(([raw]) => normalized(raw)).some(text => text.startsWith("UPDATE report_followups") || text.startsWith("UPDATE tasks"))).toBe(false);
  });

  it("queues a bounded retry when task review fails after extraction succeeds", async () => {
    const where = vi.fn(async () => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    mocks.getDb
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce({ update });
    mocks.safelyExtractReportFollowups.mockResolvedValue({
      status: "succeeded",
      runId: 321,
      extractedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      archivedCount: 0,
    });

    const result = await processDailyReportTaskLifecycle(report);

    expect(result.review.status).toBe("failed");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      errorCode: "TASK_REVIEW_FAILED",
      nextAttemptAt: expect.anything(),
      deadLetterAt: expect.anything(),
    }));
    expect(where).toHaveBeenCalled();
  });
});
