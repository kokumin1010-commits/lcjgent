import { describe, expect, it, vi } from "vitest";
import { submitTaskExecutionFeedback } from "./taskExecutionService";

describe("task cancellation precedence under feedback writes", () => {
  it("locks and rechecks the current task row before inserting feedback", async () => {
    const insert = vi.fn(() => { throw new Error("feedback insert must not run"); });
    const transaction = {
      execute: vi.fn(async () => [[{ status: "cancelled", completedAt: null }]]),
      insert,
    };
    const db = {
      transaction: vi.fn(async (callback: any) => callback(transaction)),
    };
    await expect(submitTaskExecutionFeedback({
      db: db as any,
      access: {
        userId: 10,
        staffId: 2,
        staffName: "Assignee",
        department: "Ops",
        level: "employee",
        managedDepartment: null,
        isSuperAdmin: false,
        reviewableStaffIds: [],
      },
      task: { id: 9, createdBy: 1, status: "in_progress", completedAt: null } as any,
      status: "completed",
      feedbackNote: "done",
      evidenceUrl: null,
      requestId: "00000000-0000-4000-8000-000000000001",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(transaction.execute).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });
});
