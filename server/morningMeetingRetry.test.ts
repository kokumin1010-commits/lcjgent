import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { resolveTranscriptionApiUrl, transcribeAudio } from "./_core/voiceTranscription";

const routerSource = readFileSync(new URL("./morningMeetingRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/MorningMeeting.tsx", import.meta.url), "utf8");
const voiceSource = readFileSync(new URL("./_core/voiceTranscription.ts", import.meta.url), "utf8");
const originalFetch = global.fetch;
const originalForgeApiKey = ENV.forgeApiKey;
const originalForgeApiUrl = ENV.forgeApiUrl;

afterEach(() => {
  global.fetch = originalFetch;
  ENV.forgeApiKey = originalForgeApiKey;
  ENV.forgeApiUrl = originalForgeApiUrl;
  vi.restoreAllMocks();
});

describe("morning meeting failed-audio recovery", () => {
  it("falls back to the OpenAI transcription endpoint without requiring a Forge URL", () => {
    expect(resolveTranscriptionApiUrl("")).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(resolveTranscriptionApiUrl("   ")).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(resolveTranscriptionApiUrl("https://forge.example.com")).toBe(
      "https://forge.example.com/v1/audio/transcriptions",
    );
    expect(voiceSource).not.toContain("BUILT_IN_FORGE_API_URL is not set");
    expect(voiceSource).toContain("BUILT_IN_FORGE_API_KEY or OPENAI_API_KEY is not set");
  });

  it("uses the fallback endpoint for a real multipart transcription request", async () => {
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "test-server-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "audio/webm" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        task: "transcribe",
        language: "zh",
        duration: 1,
        text: "早会测试文字稿",
        segments: [],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    global.fetch = fetchMock as typeof fetch;

    const result = await transcribeAudio({ audioUrl: "https://storage.example.com/meeting.webm", language: "zh" });

    expect("error" in result).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://storage.example.com/meeting.webm");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers).toMatchObject({
      authorization: "Bearer test-server-key",
    });
    const requestBody = (fetchMock.mock.calls[1]?.[1] as RequestInit)?.body as FormData;
    expect(requestBody.get("model")).toBe("whisper-1");
    expect(requestBody.get("response_format")).toBe("verbose_json");
    expect(requestBody.get("temperature")).toBe("0");
    expect(requestBody.get("language")).toBe("zh");
  });

  it("validates and stores original audio before transcription and never summarizes first", () => {
    const saveBlock = routerSource.split("saveDailyTeamMeeting: protectedProcedure")[1]
      ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";
    const validationIndex = saveBlock.indexOf("const mediaValidation = uploadedAudio");
    const storageIndex = saveBlock.indexOf("stored = uploadedAudio");
    const insertIndex = saveBlock.indexOf("transaction.insert(morningMeetings)");
    const qualityIndex = saveBlock.indexOf("transcribeSegmentedMorningMeetingWithQualityRetry({");
    const summaryIndex = saveBlock.indexOf("analyzeMorningMeetingWorkPlans({");

    expect(validationIndex).toBeGreaterThanOrEqual(0);
    expect(storageIndex).toBeGreaterThanOrEqual(0);
    expect(storageIndex).toBeGreaterThan(validationIndex);
    expect(insertIndex).toBeGreaterThan(storageIndex);
    expect(qualityIndex).toBeGreaterThan(insertIndex);
    expect(summaryIndex).toBeGreaterThan(qualityIndex);
    expect(saveBlock).toContain("verifyMorningMeetingAudioUploadToken(input.audioUploadToken, ctx.user.id, { allowConsumed: true })");
    expect(saveBlock).toContain("mediaSha256: mediaValidation.mediaSha256");
    expect(saveBlock).toContain("audioUploadId: uploadedAudio?.uploadId || null");
    expect(saveBlock).toContain("supersededById: newMeetingId, supersededAt: new Date()");
    expect(saveBlock).toContain("audioChunkCount: transcription.audioChunkCount");
    expect(saveBlock).toContain("speechValidationFailureCode: speechEvidence ? null");
    expect(saveBlock).toContain("participantSnapshot");
    expect(saveBlock).toContain('actionType: "morning_meeting_transcription_quality_failed"');
    expect(saveBlock).toContain('summary: analyzed.summary, status: "completed", errorMessage: null');
    expect(saveBlock).toContain("void (async () => {");
    expect(saveBlock).toContain("processing: true");
    expect(saveBlock.lastIndexOf("return {")).toBeGreaterThan(summaryIndex);
  });

  it("reprocesses only failed daily-team records for the creator or an administrator", () => {
    const retryBlock = routerSource.split("retryDailyTeamMeetingProcessing: protectedProcedure")[1]
      ?.split("getTodayDailyRecordings: protectedProcedure")[0] ?? "";

    expect(retryBlock).toContain('meeting.recordingKind !== "daily_team"');
    expect(retryBlock).toContain('ctx.user.role !== "admin" && meeting.createdBy !== ctx.user.id');
    expect(retryBlock).toContain('meeting.status !== "failed"');
    expect(retryBlock).toContain("!meeting.audioKey");
    expect(retryBlock).toContain("meeting.supersededAt");
    expect(retryBlock).toContain("validateStoredMorningMeetingAudio(meeting.audioKey)");
    expect(retryBlock).toContain("storageGet(meeting.audioKey)");
    expect(retryBlock).toContain("transcribeSegmentedMorningMeetingWithQualityRetry({");
    expect(retryBlock).toContain("expectedDurationSeconds: verifiedDurationSeconds");
    expect(retryBlock).not.toContain("storagePut(");
  });

  it("atomically claims one retry and records success or failure audit events", () => {
    const retryBlock = routerSource.split("retryDailyTeamMeetingProcessing: protectedProcedure")[1]
      ?.split("getTodayDailyRecordings: protectedProcedure")[0] ?? "";

    expect(retryBlock).toContain('eq(morningMeetings.status, "failed")');
    expect(retryBlock).toContain("affectedRows !== 1");
    expect(retryBlock).toContain('actionType: "morning_meeting_reprocess_started"');
    expect(retryBlock).toContain('actionType: "morning_meeting_reprocess_completed"');
    expect(retryBlock).toContain('actionType: "morning_meeting_reprocess_failed"');
    expect(retryBlock).toContain('set({ transcript, summary, status: "completed", errorMessage: null })');
    expect(retryBlock).toContain("speechValidationFailureCode: speechEvidence ? null");
    expect(retryBlock).toContain("error instanceof MorningMeetingTranscriptionQualityError");
    expect(retryBlock).toContain("attemptCount: error.attempts.length");
    expect(retryBlock).toContain("processingSource");
    expect(retryBlock).toContain("audioChunkCount: transcription.audioChunkCount");
  });

  it("shows the saved-audio recovery action without deleting or re-uploading the recording", () => {
    expect(pageSource).toContain("retryDailyTeamMeetingProcessing.useMutation()");
    expect(pageSource).toContain("原录音已保存，无需立即重录");
    expect(pageSource).toContain("使用原录音重新处理");
    expect(pageSource).toContain("handleRetryTeamMeetingProcessing");
    expect(pageSource).toContain("转写质量异常，原录音与参会名单已保存");
    expect(pageSource).toContain("元音声と参加者記録は保存済みです");
    expect(pageSource).toContain("参会已记录");
    expect(pageSource).toContain("文字起こし失敗でも参加記録は失われません");
    expect(pageSource).toContain("/api/morning-meeting/audio-upload");
    expect(pageSource).toContain("录音仍保留在此页面");
    expect(pageSource).toContain("重新上传并保存");
    expect(pageSource).toContain("下载原录音");
    expect(pageSource).not.toContain("早会录音为空或超过60MB");
  });

  it("uses validated non-superseded attendance evidence without exposing storage or HR internals", () => {
    const performanceSource = readFileSync(new URL("./performanceReconciliationService.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("isRecordedTeamMeetingAttendance({");
    expect(routerSource).toContain("attendanceRecorded");
    expect(routerSource).toContain("audioKey: _audioKey");
    expect(routerSource).toContain("audioUrl: _audioUrl");
    expect(routerSource).toContain("audioUploadId: _audioUploadId");
    expect(routerSource).toContain("mediaSha256: _mediaSha256");
    expect(routerSource).toContain("speechValidationProvider: _speechValidationProvider");
    expect(routerSource).toContain("participantSnapshot: publicParticipantSnapshot(participantSnapshot)");
    expect(routerSource).toContain("hasAudio: Boolean(record.audioKey)");
    expect(performanceSource).toContain("audioKey IS NOT NULL");
    expect(performanceSource).toContain("mediaValidatedAt, mediaDurationSeconds");
    expect(performanceSource).toContain("supersededAt IS NULL");
    expect(performanceSource).toContain("isRecordedTeamMeetingAttendance(row)");
    expect(performanceSource).toContain("status IN ('transcribing', 'summarizing', 'completed', 'failed')");
    expect(performanceSource).toContain('attendanceEvidence: attended ? "server_validated_speech_audio_and_participant_snapshot" : null');
  });
});
