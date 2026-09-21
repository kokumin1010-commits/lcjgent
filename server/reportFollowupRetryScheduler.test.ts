import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, extractAndCreateReportFollowups } = vi.hoisted(() => ({
  getDb: vi.fn(),
  extractAndCreateReportFollowups: vi.fn(),
}));
vi.mock("./db", () => ({ getDb }));
vi.mock("./reportFollowupAutomation", () => ({ extractAndCreateReportFollowups }));

import { retryFailedReportFollowupExtractions } from "./reportFollowupRetryScheduler";

describe("daily report extraction compensation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads due failed jobs for the current report version and retries them", async () => {
    const updatedAt = new Date("2026-09-20T08:00:00Z");
    getDb.mockResolvedValue({
      execute: vi.fn(async () => [[{
        id: 42,
        reportStaffId: 5,
        reportDate: new Date("2026-09-20T00:00:00Z"),
        workContent: "retry",
        issues: null,
        remarks: null,
        updatedAt,
      }]]),
    });
    extractAndCreateReportFollowups.mockResolvedValue({ status: "succeeded" });
    const result = await retryFailedReportFollowupExtractions();
    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    expect(extractAndCreateReportFollowups).toHaveBeenCalledWith(expect.objectContaining({ id: 42, updatedAt }));
  });
});
