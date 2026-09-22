import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  validateStoredMorningMeetingAudio: vi.fn(),
  validateStoredMorningMeetingSpeech: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./morningMeetingMediaValidation", () => ({
  validateStoredMorningMeetingAudio: mocks.validateStoredMorningMeetingAudio,
}));
vi.mock("./morningMeetingSpeechValidation", () => ({
  validateStoredMorningMeetingSpeech: mocks.validateStoredMorningMeetingSpeech,
}));

import { backfillMorningMeetingMediaValidation } from "./morningMeetingMediaBackfill";

function databaseForOneRow(claimed = true, finalized = true) {
  const execute = vi.fn()
    .mockResolvedValueOnce([[{ id: 901, audioKey: "private/morning/901.webm" }], []])
    .mockResolvedValueOnce([{ affectedRows: claimed ? 1 : 0 }, []])
    .mockResolvedValueOnce([{ affectedRows: finalized ? 1 : 0 }, []]);
  return { execute };
}

describe("morning meeting historical media validation backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a due row before downloading and persists validated media evidence", async () => {
    const db = databaseForOneRow();
    mocks.getDb.mockResolvedValue(db);
    mocks.validateStoredMorningMeetingAudio.mockResolvedValue({
      size: 4096,
      mediaDurationSeconds: 93.125,
      mediaSha256: "b".repeat(64),
      mediaValidatedAt: new Date("2026-09-21T03:00:00.000Z"),
      audioStreamCount: 1,
    });
    mocks.validateStoredMorningMeetingSpeech.mockResolvedValue({
      speechValidatedAt: new Date("2026-09-21T03:01:00.000Z"),
      speechValidationProvider: "whisper_segments_v1",
    });

    await expect(backfillMorningMeetingMediaValidation()).resolves.toEqual({
      inspected: 1,
      validated: 1,
      failed: 0,
    });
    expect(db.execute).toHaveBeenCalledTimes(3);
    expect(mocks.validateStoredMorningMeetingAudio).toHaveBeenCalledWith("private/morning/901.webm");
    expect(mocks.validateStoredMorningMeetingSpeech).toHaveBeenCalledWith(expect.objectContaining({
      audioKey: "private/morning/901.webm",
      expectedDurationSeconds: 93.125,
    }));
  });

  it("does not download a row already claimed by another replica", async () => {
    const db = databaseForOneRow(false);
    mocks.getDb.mockResolvedValue(db);

    await expect(backfillMorningMeetingMediaValidation()).resolves.toEqual({
      inspected: 0,
      validated: 0,
      failed: 0,
    });
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(mocks.validateStoredMorningMeetingAudio).not.toHaveBeenCalled();
  });

  it("records only a safe validation code and leaves the row eligible after the retry window", async () => {
    const db = databaseForOneRow();
    mocks.getDb.mockResolvedValue(db);
    mocks.validateStoredMorningMeetingAudio.mockRejectedValue(new Error("storage leaked details: secret/path"));

    await expect(backfillMorningMeetingMediaValidation()).resolves.toEqual({
      inspected: 1,
      validated: 0,
      failed: 1,
    });
    expect(db.execute).toHaveBeenCalledTimes(3);
    const failureQuery = JSON.stringify(db.execute.mock.calls[2]?.[0]);
    expect(failureQuery).not.toContain("secret/path");
  });

  it("keeps media evidence but does not validate attendance when ASR finds no speech", async () => {
    const db = databaseForOneRow();
    mocks.getDb.mockResolvedValue(db);
    mocks.validateStoredMorningMeetingAudio.mockResolvedValue({
      mediaDurationSeconds: 75,
      mediaSha256: "c".repeat(64),
      mediaValidatedAt: new Date("2026-09-21T03:00:00.000Z"),
      audioStreamCount: 1,
    });
    mocks.validateStoredMorningMeetingSpeech.mockRejectedValue(new Error("MORNING_AUDIO_SPEECH_NOT_DETECTED"));

    await expect(backfillMorningMeetingMediaValidation()).resolves.toEqual({
      inspected: 1,
      validated: 0,
      failed: 1,
    });
    const failureQuery = JSON.stringify(db.execute.mock.calls[2]?.[0]);
    expect(failureQuery).toContain("speechValidationFailureCode");
    expect(failureQuery).not.toContain("speechValidatedAt =");
  });
});
