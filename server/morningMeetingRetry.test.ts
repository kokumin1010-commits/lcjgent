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
  });

  it("reprocesses only failed daily-team records for the creator or an administrator", () => {
    const retryBlock = routerSource.split("retryDailyTeamMeetingProcessing: protectedProcedure")[1]
      ?.split("getTodayDailyRecordings: protectedProcedure")[0] ?? "";

    expect(retryBlock).toContain('meeting.recordingKind !== "daily_team"');
    expect(retryBlock).toContain('ctx.user.role !== "admin" && meeting.createdBy !== ctx.user.id');
    expect(retryBlock).toContain('meeting.status !== "failed"');
    expect(retryBlock).toContain("!meeting.audioKey");
    expect(retryBlock).toContain("storageGet(meeting.audioKey)");
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
    expect(retryBlock).toContain('set({ status: "failed", errorMessage })');
  });

  it("shows the saved-audio recovery action without deleting or re-uploading the recording", () => {
    expect(pageSource).toContain("retryDailyTeamMeetingProcessing.useMutation()");
    expect(pageSource).toContain("原录音已保存，无需立即重录");
    expect(pageSource).toContain("使用原录音重新处理");
    expect(pageSource).toContain("handleRetryTeamMeetingProcessing");
  });
});
