import { describe, expect, it } from "vitest";
import { resolvePersonalTaskStatus, summarizePersonalTaskRows } from "./taskStatistics";

describe("per-assignee task statistics", () => {
  it("counts the same multi-assignee task independently from each latest feedback", () => {
    const now = new Date("2026-09-22T00:00:00.000Z");
    const rows = [
      { staffId: 1, name: "A", department: "Ops", position: null, avatarUrl: null, taskId: 9, taskStatus: "in_progress", feedbackStatus: "completed", deadline: new Date("2026-09-21T00:00:00Z") },
      { staffId: 2, name: "B", department: "Ops", position: null, avatarUrl: null, taskId: 9, taskStatus: "in_progress", feedbackStatus: "blocked", deadline: new Date("2026-09-21T00:00:00Z") },
    ];
    expect(summarizePersonalTaskRows(rows, now)).toEqual([
      expect.objectContaining({ id: 1, inProgressCount: 0, overdueCount: 0 }),
      expect.objectContaining({ id: 2, inProgressCount: 1, overdueCount: 1 }),
    ]);
  });

  it("makes cancellation override historical completed feedback", () => {
    expect(resolvePersonalTaskStatus("cancelled", "completed")).toBe("cancelled");
  });
});
