import { describe, expect, it } from "vitest";
import {
  canReadMorningMeeting,
  publicMorningMeetingErrorMessage,
  toMorningPersonalClientRecord,
  publicParticipantSnapshot,
  toMorningMeetingClientRecord,
} from "./morningMeetingRouter";

const participantSnapshot = [{
  targetKey: "staff:44",
  staffId: 44,
  userId: 404,
  name: "Synthetic Staff",
  email: "private@example.test",
  position: "Operations",
  nameEn: "Private Alias",
  aliases: ["secret-alias"],
}];

const chinaTarget = {
  targetKey: "staff:44",
  staffCountry: "中国",
};

const japanTarget = {
  targetKey: "staff:55",
  staffCountry: "日本",
};

describe("morning meeting read access and public DTO", () => {
  it("allows only admins, creators, participants, or members of the meeting team", () => {
    const meeting = { createdBy: 7, teamCode: "china", participantSnapshot };

    expect(canReadMorningMeeting(meeting, { id: 1, role: "admin" }, japanTarget)).toBe(true);
    expect(canReadMorningMeeting(meeting, { id: 7, role: "user" }, japanTarget)).toBe(true);
    expect(canReadMorningMeeting(meeting, { id: 404, role: "user" }, chinaTarget)).toBe(true);
    expect(canReadMorningMeeting(meeting, { id: 8, role: "user" }, { ...chinaTarget, targetKey: "staff:88" })).toBe(true);
    expect(canReadMorningMeeting(meeting, { id: 9, role: "user" }, japanTarget)).toBe(false);
    expect(canReadMorningMeeting({
      ...meeting,
      teamCode: "legacy",
      participantSnapshot: [{ targetKey: "staff:99", aliases: ["staff:44"], name: "staff:44" }],
    }, { id: 9, role: "user" }, chinaTarget)).toBe(false);
    expect(canReadMorningMeeting({ ...meeting, deletedAt: new Date() }, { id: 7, role: "user" }, chinaTarget)).toBe(false);
    expect(canReadMorningMeeting({ ...meeting, deletedAt: new Date() }, { id: 1, role: "admin" }, chinaTarget)).toBe(false);
  });

  it("returns only the approved participant fields and no object-storage or HR internals", () => {
    expect(publicParticipantSnapshot(participantSnapshot)).toEqual([{
      targetKey: "staff:44",
      staffId: 44,
      name: "Synthetic Staff",
      position: "Operations",
    }]);

    const clientRecord = toMorningMeetingClientRecord({
      id: 901,
      dailyKey: "2026-09-21:china",
      audioKey: "private/storage/key.webm",
      audioUrl: "https://private-storage.example.test/signed",
      audioUploadId: "11111111-1111-4111-8111-111111111111",
      mediaSha256: "a".repeat(64),
      mediaValidatedAt: new Date(),
      mediaDurationSeconds: "123.000",
      mediaAudioStreamCount: 1,
      mediaValidationAttemptedAt: new Date(),
      mediaValidationFailureCode: "MORNING_AUDIO_DECODE_FAILED",
      speechValidatedAt: new Date(),
      speechValidationProvider: "whisper_segments_v1",
      speechValidationAttemptedAt: new Date(),
      speechValidationFailureCode: null,
      supersededById: 902,
      supersededAt: new Date(),
      errorMessage: "fetch failed for private/storage/key.webm?signature=secret",
      participantSnapshot,
    });

    expect(clientRecord).toMatchObject({
      id: 901,
      hasAudio: true,
      errorMessage: "MORNING_MEETING_PROCESSING_FAILED",
      participantSnapshot: [{ targetKey: "staff:44", staffId: 44, name: "Synthetic Staff", position: "Operations" }],
    });
    const serialized = JSON.stringify(clientRecord);
    expect(serialized).not.toContain("private/storage");
    expect(serialized).not.toContain("private-storage");
    expect(serialized).not.toContain("private@example.test");
    expect(serialized).not.toContain("secret-alias");
    expect(serialized).not.toContain("mediaSha256");
    expect(serialized).not.toContain("audioUploadId");
    expect(serialized).not.toContain("dailyKey");
    expect(serialized).not.toContain("speechValidation");
    expect(publicMorningMeetingErrorMessage("MORNING_TRANSCRIPTION_LOW_QUALITY:LOW_AUDIO_DURATION_COVERAGE"))
      .toBe("MORNING_TRANSCRIPTION_LOW_QUALITY:LOW_AUDIO_DURATION_COVERAGE");

    const personal = toMorningPersonalClientRecord({
      id: 10,
      dailyKey: "2026-09-21:staff:44:principles",
      audioKey: "private/personal.webm",
      audioUrl: "https://storage.invalid/private",
      userEmail: "employee@example.invalid",
      operatorUserEmail: "operator@example.invalid",
      mimeType: "audio/webm",
      status: "completed",
    });
    expect(personal).toMatchObject({ id: 10, hasAudio: true, status: "completed" });
    expect(JSON.stringify(personal)).not.toMatch(/dailyKey|audioKey|audioUrl|userEmail|operatorUserEmail|example\.invalid/);
  });
});
