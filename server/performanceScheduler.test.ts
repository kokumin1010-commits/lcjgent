import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, runPerformanceReconciliation, backfillMorningMeetingMediaValidation, morningMeetingMediaBackfillFromDate } = vi.hoisted(() => ({
  getDb: vi.fn(),
  runPerformanceReconciliation: vi.fn(),
  backfillMorningMeetingMediaValidation: vi.fn(),
  morningMeetingMediaBackfillFromDate: vi.fn(() => "2026-09-08"),
}));

vi.mock("./db", () => ({ getDb }));
vi.mock("./performanceReconciliationService", () => ({ runPerformanceReconciliation }));
vi.mock("./morningMeetingMediaBackfill", () => ({
  backfillMorningMeetingMediaValidation,
  morningMeetingMediaBackfillFromDate,
}));

import {
  runPerformanceShadowReconciliation,
  startPerformanceScheduler,
  stopPerformanceScheduler,
} from "./performanceScheduler";

describe("performance scheduler deployment catch-up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getDb.mockResolvedValue({ execute: vi.fn() });
    backfillMorningMeetingMediaValidation.mockResolvedValue({ inspected: 0, validated: 0, failed: 0 });
    runPerformanceReconciliation.mockResolvedValue({
      skipped: false,
      runKey: "test",
      counters: {},
      settings: {
        mode: "shadow",
        impactsBonus: false,
        impactsLcjCoin: false,
        externalNotificationsEnabled: false,
      },
    });
  });

  afterEach(() => {
    stopPerformanceScheduler();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses one shared deployment revision after media backfill so replicas do not duplicate catch-up", async () => {
    startPerformanceScheduler();
    await vi.advanceTimersByTimeAsync(90_000);

    expect(backfillMorningMeetingMediaValidation).toHaveBeenCalledTimes(1);
    expect(runPerformanceReconciliation).toHaveBeenCalledWith(expect.anything(), {
      runRevision: "morning-media-v2",
      morningMeetingFromDate: "2026-09-08",
    });
    expect(backfillMorningMeetingMediaValidation.mock.invocationCallOrder[0])
      .toBeLessThan(runPerformanceReconciliation.mock.invocationCallOrder[0]);
  });

  it("keeps ordinary invocations idempotent and accepts an explicit stable revision", async () => {
    await runPerformanceShadowReconciliation();
    await runPerformanceShadowReconciliation("manual-test-v1");

    expect(runPerformanceReconciliation).toHaveBeenNthCalledWith(1, expect.anything(), { runRevision: undefined, morningMeetingFromDate: "2026-09-08" });
    expect(runPerformanceReconciliation).toHaveBeenNthCalledWith(2, expect.anything(), { runRevision: "manual-test-v1", morningMeetingFromDate: "2026-09-08" });
  });

  it("continues ordinary performance reconciliation when media backfill is temporarily unavailable", async () => {
    backfillMorningMeetingMediaValidation.mockRejectedValueOnce(new Error("temporary storage failure"));

    await runPerformanceShadowReconciliation();

    expect(runPerformanceReconciliation).toHaveBeenCalledTimes(1);
    expect(runPerformanceReconciliation).toHaveBeenCalledWith(expect.anything(), { runRevision: undefined, morningMeetingFromDate: "2026-09-08" });
  });
});
