import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, execute } = vi.hoisted(() => ({
  getDb: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("./db", () => ({ getDb }));

import {
  finalizeStaleMorningMeetingProcessing,
  MORNING_MEETING_STALE_PROCESSING_MINUTES,
} from "./morningMeetingProcessingRecovery";

function sqlText(value: unknown): string {
  return JSON.stringify(value).replace(/\\n/g, " ");
}

describe("stale morning meeting processing recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockResolvedValue([{ affectedRows: 2 }]);
    getDb.mockResolvedValue({ execute });
  });

  it("moves only stale active transcribing/summarizing rows to retryable failed state", async () => {
    const result = await finalizeStaleMorningMeetingProcessing();

    expect(result).toEqual({ finalized: 2 });
    expect(MORNING_MEETING_STALE_PROCESSING_MINUTES).toBe(10);
    const statement = sqlText(execute.mock.calls[0][0]);
    expect(statement).toContain("transcribing");
    expect(statement).toContain("summarizing");
    expect(statement).toContain("MORNING_TRANSCRIPTION_PROCESS_INTERRUPTED");
    expect(statement).toContain("supersededAt");
    expect(statement).toContain("deletedAt");
    expect(statement).not.toContain("DELETE FROM");
  });

  it("is a no-op when the database is unavailable", async () => {
    getDb.mockResolvedValue(null);
    await expect(finalizeStaleMorningMeetingProcessing()).resolves.toEqual({ finalized: 0 });
    expect(execute).not.toHaveBeenCalled();
  });
});
