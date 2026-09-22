import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isStoredPendingTeamRecording,
  selectMorningMeetingRecorderMimeType,
} from "../client/src/pages/MorningMeeting";
import { normalizeMorningMeetingAudioMimeType } from "./morningMeetingAudioUpload";

const routerSource = readFileSync(new URL("./morningMeetingRouter.ts", import.meta.url), "utf8");
const uploadSource = readFileSync(new URL("./morningMeetingAudioUpload.ts", import.meta.url), "utf8");
const backfillSource = readFileSync(new URL("./morningMeetingMediaBackfill.ts", import.meta.url), "utf8");

describe("morning meeting save durability", () => {
  it("chooses MP4 on Safari when WebM is unavailable", () => {
    expect(selectMorningMeetingRecorderMimeType((mimeType) => mimeType === "audio/mp4")).toBe("audio/mp4");
    expect(selectMorningMeetingRecorderMimeType((mimeType) => mimeType === "video/mp4")).toBe("video/mp4");
    expect(normalizeMorningMeetingAudioMimeType("video/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
  });

  it("prefers Opus WebM where supported and falls back to the browser default otherwise", () => {
    expect(selectMorningMeetingRecorderMimeType((mimeType) => mimeType === "audio/webm;codecs=opus"))
      .toBe("audio/webm;codecs=opus");
    expect(selectMorningMeetingRecorderMimeType(() => false)).toBeUndefined();
  });

  it("recognizes only the exact creator, team, time and participant snapshot after a response interruption", () => {
    const recording = {
      teamCode: "japan" as const,
      startedAt: "2026-09-22T00:00:00.000Z",
      participantStaffIds: [1, 2, 3],
    };
    expect(isStoredPendingTeamRecording({
      id: 91,
      teamCode: "japan",
      startedAt: "2026-09-22T00:01:00.000Z",
      participantCount: 3,
      participantSnapshot: [{ staffId: 3 }, { staffId: 1 }, { staffId: 2 }],
      createdBy: 41,
    }, recording, 41)).toBe(true);
    expect(isStoredPendingTeamRecording({
      id: 92,
      teamCode: "china",
      startedAt: "2026-09-22T00:01:00.000Z",
      participantCount: 3,
      participantSnapshot: [{ staffId: 1 }, { staffId: 2 }, { staffId: 3 }],
      createdBy: 41,
    }, recording, 41)).toBe(false);
    expect(isStoredPendingTeamRecording({
      id: 93,
      teamCode: "japan",
      startedAt: "2026-09-22T00:01:00.000Z",
      participantCount: 2,
      participantSnapshot: [{ staffId: 1 }, { staffId: 2 }],
      createdBy: 41,
    }, recording, 41)).toBe(false);
    expect(isStoredPendingTeamRecording({
      id: 94,
      teamCode: "japan",
      startedAt: "2026-09-22T00:01:00.000Z",
      participantCount: 3,
      participantSnapshot: [{ staffId: 1 }, { staffId: 2 }, { staffId: 3 }],
      createdBy: 99,
    }, recording, 41)).toBe(false);
    expect(isStoredPendingTeamRecording({
      id: 95,
      teamCode: "japan",
      startedAt: "2026-09-22T00:01:00.000Z",
      participantCount: 3,
      participantSnapshot: [{ staffId: 1 }, { staffId: 2 }, { staffId: 4 }],
      createdBy: 41,
    }, recording, 41)).toBe(false);
  });

  it("persists first, returns processing acknowledgement, and makes the same upload token idempotent", () => {
    const saveBlock = routerSource.split("saveDailyTeamMeeting: protectedProcedure")[1]
      ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";
    const insertIndex = saveBlock.indexOf("transaction.insert(morningMeetings)");
    const detachedIndex = saveBlock.indexOf("void (async () => {");
    const acknowledgementIndex = saveBlock.lastIndexOf("processing: true");

    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(detachedIndex).toBeGreaterThan(insertIndex);
    expect(acknowledgementIndex).toBeGreaterThan(detachedIndex);
    expect(saveBlock).toContain("allowConsumed: true");
    expect(saveBlock).toContain("eq(morningMeetings.audioUploadId, uploadedAudio.uploadId)");
    expect(saveBlock).toContain("recoveredExistingUpload: true");
    expect(saveBlock).toContain("speechValidationAttemptedAt: new Date()");
    expect(saveBlock).toContain("onChunkCompleted: async () =>");
    expect(saveBlock).toContain("startMorningMeetingProcessingHeartbeat(db, meetingId)");
    expect(saveBlock).toContain("stopProcessingHeartbeat()");
    expect(routerSource).toContain("}, 60_000)");
    expect(uploadSource).toContain("options: { allowConsumed?: boolean } = {}");
    expect(uploadSource).toContain("options.allowConsumed ? [] : [isNull(morningMeetingAudioUploads.consumedAt)]");
    expect(backfillSource).toContain("MORNING_TRANSCRIPTION_PROCESS_INTERRUPTED");
    expect(backfillSource).toContain("INTERVAL 10 MINUTE");
  });

  it("starts and cleans retry heartbeat immediately after the atomic claim", () => {
    const retryBlock = routerSource.split("retryDailyTeamMeetingProcessing: protectedProcedure")[1]
      ?.split("getTodayDailyRecordings: protectedProcedure")[0] ?? "";
    const claimIndex = retryBlock.indexOf("const affectedRows");
    const heartbeatIndex = retryBlock.indexOf("startMorningMeetingProcessingHeartbeat(db, meeting.id)");
    const validationIndex = retryBlock.indexOf("validateStoredMorningMeetingAudio(meeting.audioKey)");
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(heartbeatIndex).toBeGreaterThan(claimIndex);
    expect(validationIndex).toBeGreaterThan(heartbeatIndex);
    expect(retryBlock.match(/stopProcessingHeartbeat\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
