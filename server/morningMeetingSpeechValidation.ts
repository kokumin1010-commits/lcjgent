import { storageGet } from "./storage";
import { transcribeSegmentedMorningMeetingWithQualityRetry } from "./morningMeetingSegmentedTranscription";
import { MorningMeetingTranscriptionQualityError } from "./morningMeetingTranscriptionQuality";

export const MORNING_MEETING_SPEECH_VALIDATION_PROVIDER = "whisper_segments_v1";

function attemptsContainSpeech(attempts: Array<{ source?: unknown; speechEvidence?: unknown }>): boolean {
  return attempts.some((attempt) => attempt.source !== "browser" && attempt.speechEvidence === true);
}

export async function validateStoredMorningMeetingSpeech(input: {
  audioKey: string;
  language: "ja" | "zh";
  expectedDurationSeconds: number;
}): Promise<{ speechValidatedAt: Date; speechValidationProvider: typeof MORNING_MEETING_SPEECH_VALIDATION_PROVIDER }> {
  const { url } = await storageGet(input.audioKey);
  try {
    const result = await transcribeSegmentedMorningMeetingWithQualityRetry({
      audioUrl: url,
      language: input.language,
      primaryPrompt: input.language === "zh"
        ? "仅逐字转写这段团队早会中实际听到的人声。不要猜测，不要把音乐、提示音或噪声写成话语。"
        : "このチーム朝会で実際に聞こえる人の発話だけを逐語で文字起こししてください。音楽・信号音・雑音を発話として推測しないでください。",
      expectedDurationSeconds: input.expectedDurationSeconds,
    });
    if (!attemptsContainSpeech(result.attempts)) throw new Error("MORNING_AUDIO_SPEECH_NOT_DETECTED");
  } catch (error) {
    if (error instanceof MorningMeetingTranscriptionQualityError) {
      if (!attemptsContainSpeech(error.attempts)) {
        const serviceUnavailable = error.attempts
          .filter((attempt) => attempt.source !== "browser")
          .every((attempt) => Boolean(attempt.serviceErrorCode));
        throw new Error(serviceUnavailable
          ? "MORNING_AUDIO_SPEECH_VALIDATION_UNAVAILABLE"
          : "MORNING_AUDIO_SPEECH_NOT_DETECTED");
      }
    } else {
      throw error;
    }
  }
  return {
    speechValidatedAt: new Date(),
    speechValidationProvider: MORNING_MEETING_SPEECH_VALIDATION_PROVIDER,
  };
}
