import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportFollowupExtractionRuns, reportFollowups, reports } from "../drizzle/schema";

const { invokeLLM, getDb, reportFollowupDedupeKey, reportFollowupExtractionContentHash } = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  getDb: vi.fn(),
  reportFollowupDedupeKey: (value: string) => value.trim().toLowerCase(),
  reportFollowupExtractionContentHash: vi.fn(() => "stable-report-content-hash"),
}));

vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./db", () => ({ getDb, reportFollowupDedupeKey, reportFollowupExtractionContentHash }));
vi.mock("./taskExecutionUpgrade", () => ({ ensureTaskExecutionTables: vi.fn(async () => undefined) }));

import {
  extractAndCreateReportFollowups,
  extractReportFollowupBatch,
  safelyExtractReportFollowups,
} from "./reportFollowupAutomation";

const report = {
  id: 42,
  reportStaffId: 5,
  reportDate: new Date("2026-09-20T00:00:00.000Z"),
  workContent: "客户Aへ見積を送る必要があります。",
  issues: "確認待ちです。",
  remarks: "明日までに連絡します。",
  updatedAt: new Date("2026-09-20T08:00:00.000Z"),
};

function createDbMock(initialRows: any[] = [], options: { leaseOwned?: boolean } = {}) {
  const rows = initialRows.map(row => ({ ...row }));
  const runUpdates: any[] = [];
  const auditWrites: unknown[] = [];
  let nextRunId = 100;
  let nextFollowupId = 1000;
  const pendingRunIds: number[] = [];
  const runTokens = new Map<number, string>();

  const makeInsert = (table: unknown) => ({
    values: (value: any) => {
      if (table === reportFollowupExtractionRuns) {
        const id = ++nextRunId;
        pendingRunIds.push(id);
        runTokens.set(id, value.leaseToken);
        return { $returningId: async () => [{ id }] };
      }
      if (table === reportFollowups) {
        const id = ++nextFollowupId;
        rows.push({ id, createdAt: new Date(), updatedAt: new Date(), ...value });
        return { $returningId: async () => [{ id }] };
      }
      return Promise.resolve({});
    },
  });
  const makeUpdate = (table: unknown) => ({
    set: (change: any) => ({
      where: async () => {
        if (table === reportFollowupExtractionRuns) runUpdates.push(change);
        else if (table === reportFollowups) {
          const candidate = rows.find(row => !row.archivedAt && row.status === "pending");
          if (candidate) Object.assign(candidate, change);
        }
        return [{ affectedRows: 1 }];
      },
    }),
  });
  const transaction = {
    insert: vi.fn(makeInsert),
    update: vi.fn(makeUpdate),
    execute: vi.fn(async value => { auditWrites.push(value); return [{ affectedRows: 1 }]; }),
  };
  const db = {
    insert: vi.fn(makeInsert),
    update: vi.fn(makeUpdate),
    transaction: vi.fn(async (callback: any) => {
      const transactionRunId = pendingRunIds.shift() || nextRunId;
      const scopedTransaction = {
        ...transaction,
        select: () => ({
          from: (table: unknown) => ({
            where: () => table === reports
              ? { for: async () => [{
                  updatedAt: report.updatedAt,
                  reportDate: report.reportDate,
                  reportStaffId: report.reportStaffId,
                  workContent: report.workContent,
                  issues: report.issues,
                  remarks: report.remarks,
                }] }
              : table === reportFollowupExtractionRuns
                ? (() => {
                    const currentRun = [{
                      id: transactionRunId,
                      status: "running",
                      leaseToken: options.leaseOwned === false ? "stolen-lease" : runTokens.get(transactionRunId),
                    }];
                    return {
                      orderBy: () => ({ limit: () => ({ for: async () => currentRun }) }),
                      limit: () => ({ for: async () => currentRun }),
                    };
                  })()
                : Promise.resolve(rows.map(row => ({ ...row }))),
          }),
        }),
      };
      return callback(scopedTransaction);
    }),
  };
  return { db, rows, runUpdates, transaction, auditWrites };
}

function mockItems(items: any[]) {
  invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ items }) } }] });
}

describe("daily report automatic task extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems([
      { item: "客户Aへ見積を送る", category: "提案", daysUntilDue: 1 },
      { item: "客户Aへ見積を送る", category: "提案", daysUntilDue: 1 },
      { item: "確認結果を連絡する", category: "確認", daysUntilDue: 2 },
    ]);
  });

  it("creates a versioned run and unique actionable tasks", async () => {
    const state = createDbMock();
    getDb.mockResolvedValue(state.db);
    const result = await extractAndCreateReportFollowups(report);

    expect(result).toMatchObject({ status: "succeeded", extractedCount: 2, createdCount: 2 });
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
    expect(state.rows).toHaveLength(2);
    expect(state.runUpdates.at(-1)).toMatchObject({ status: "succeeded", createdCount: 2 });
  });

  it("updates retained pending items, archives absent pending items, and keeps completed history", async () => {
    const keep = { id: 1, reportId: 42, reportStaffId: 5, extractedItem: "客户Aへ見積を送る", dedupeKey: "客户aへ見積を送る", category: "確認", dueDate: new Date("2026-09-20T00:00:00Z"), status: "pending", archivedAt: null, duplicateOfId: null };
    const absent = { id: 2, reportId: 42, reportStaffId: 5, extractedItem: "旧タスク", dedupeKey: "旧タスク", category: "確認", dueDate: new Date(), status: "pending", archivedAt: null, duplicateOfId: null };
    const completed = { id: 3, reportId: 42, reportStaffId: 5, extractedItem: "完了済み", dedupeKey: "完了済み", category: "確認", dueDate: new Date(), status: "completed", archivedAt: null, duplicateOfId: null };
    mockItems([{ item: keep.extractedItem, category: "提案", daysUntilDue: 1 }]);
    const state = createDbMock([keep, absent, completed]);
    getDb.mockResolvedValue(state.db);

    const result = await extractAndCreateReportFollowups(report);

    expect(result).toMatchObject({ status: "succeeded", updatedCount: 1, archivedCount: 1, createdCount: 0 });
    expect(state.transaction.execute).toHaveBeenCalledTimes(2);
    expect(state.runUpdates.at(-1)).toMatchObject({ status: "succeeded", updatedCount: 1, archivedCount: 1 });
  });

  it("persists failure and never runs reconciliation when AI extraction fails", async () => {
    const state = createDbMock([{ id: 2, status: "pending", archivedAt: null }]);
    getDb.mockResolvedValue(state.db);
    invokeLLM.mockRejectedValue(new Error("temporary provider error"));

    const result = await safelyExtractReportFollowups(report);

    expect(result).toMatchObject({ status: "failed", createdCount: 0, archivedCount: 0, runId: expect.any(Number) });
    expect(state.db.transaction).not.toHaveBeenCalled();
    expect(state.runUpdates.at(-1)).toMatchObject({
      status: "failed",
      errorCode: "Error",
      nextAttemptAt: expect.any(Date),
      leaseUntil: null,
    });
  });

  it("does not reconcile after another worker takes the run lease", async () => {
    const state = createDbMock([], { leaseOwned: false });
    getDb.mockResolvedValue(state.db);

    const result = await extractAndCreateReportFollowups(report);

    expect(result.status).toBe("failed");
    expect(state.rows).toHaveLength(0);
    expect(state.auditWrites).toHaveLength(0);
  });

  it("processes historical reports with bounded concurrency", async () => {
    let active = 0;
    let peak = 0;
    invokeLLM.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return { choices: [{ message: { content: JSON.stringify({ items: [] }) } }] };
    });
    const state = createDbMock();
    getDb.mockResolvedValue(state.db);
    const reports = Array.from({ length: 9 }, (_, index) => ({ ...report, id: index + 1 }));
    const result = await extractReportFollowupBatch(reports, 4);

    expect(result).toMatchObject({ reportsProcessed: 9, totalExtracted: 0, totalCreated: 0, failedCount: 0 });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
  });
});
