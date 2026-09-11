import {
  transcribeAudio,
  type TranscriptionError,
  type TranscriptionResponse,
  type WhisperSegment,
} from "./_core/voiceTranscription";
import type { MorningMeetingProcessingSource } from "./morningMeetingIntelligence";

export type MorningMeetingTranscriptionQualityReason =
  | "EMPTY_TRANSCRIPT"
  | "TRANSCRIPT_TOO_SHORT_FOR_DURATION"
  | "DOMINANT_REPEATED_SEGMENT"
  | "LOW_SEGMENT_DIVERSITY"
  | "LOW_AUDIO_DURATION_COVERAGE"
  | "LOW_MODEL_CONFIDENCE"
  | "HIGH_MODEL_COMPRESSION";

export type MorningMeetingTranscriptionQuality = {
  accepted: boolean;
  reasons: MorningMeetingTranscriptionQualityReason[];
  characterCount: number;
  segmentCount: number;
  uniqueSegmentCount: number;
  dominantSegmentCount: number;
  dominantSegmentRatio: number;
  dominantSegmentCharacterRatio: number;
  uniqueSegmentRatio: number;
  repeatedCharacterRatio: number;
  durationCoverageRatio: number | null;
  averageLogProbability: number | null;
  averageCompressionRatio: number | null;
};

export type MorningMeetingTranscriptionAttempt = {
  source: "primary" | "retry" | "browser";
  quality: MorningMeetingTranscriptionQuality;
  serviceErrorCode?: TranscriptionError["code"];
};

export type MorningMeetingTranscriptionResult = {
  transcript: string;
  response: TranscriptionResponse | null;
  processingSource: MorningMeetingProcessingSource;
  attempts: MorningMeetingTranscriptionAttempt[];
};

type TranscribeFn = typeof transcribeAudio;

const TIMESTAMP_PREFIX = /^\s*\[[^\]]+\]\s*/;
const NORMALIZE_PUNCTUATION = /[\s，。！？!?、：:；;"“”'‘’（）()\[\]【】…—–-]+/gu;

function normalizeSegment(value: unknown): string {
  return String(value || "")
    .replace(TIMESTAMP_PREFIX, "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(NORMALIZE_PUNCTUATION, "")
    .trim();
}

function finiteAverage(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function transcriptUnits(
  text: string,
  segments?: WhisperSegment[],
): Array<{ text: string; end: number | null }> {
  if (Array.isArray(segments) && segments.length > 0) {
    return segments
      .filter(segment => segment && typeof segment.text === "string" && segment.text.trim())
      .map(segment => ({
        text: segment.text.trim(),
        end: Number.isFinite(segment.end) ? Math.max(0, Number(segment.end)) : null,
      }));
  }

  const lines = text
    .split(/\r?\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines.map(line => ({ text: line, end: null }));

  return text
    .split(/(?<=[。！？!?])\s*/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ text: line, end: null }));
}

export function assessMorningMeetingTranscription(input: {
  text: string;
  segments?: WhisperSegment[];
  expectedDurationSeconds: number;
}): MorningMeetingTranscriptionQuality {
  const text = String(input.text || "").trim();
  const expectedDurationSeconds = Math.max(0, Number(input.expectedDurationSeconds) || 0);
  const units = transcriptUnits(text, input.segments);
  const normalizedUnits = units.map(unit => normalizeSegment(unit.text)).filter(Boolean);
  const counts = new Map<string, number>();
  for (const value of normalizedUnits) counts.set(value, (counts.get(value) || 0) + 1);
  const dominantSegmentCount = Math.max(0, ...counts.values());
  const segmentCount = normalizedUnits.length;
  const uniqueSegmentCount = counts.size;
  const dominantSegmentRatio = segmentCount > 0 ? dominantSegmentCount / segmentCount : 0;
  const uniqueSegmentRatio = segmentCount > 0 ? uniqueSegmentCount / segmentCount : 0;
  const totalSegmentCharacters = normalizedUnits.reduce((sum, value) => sum + value.length, 0);
  const dominantSegmentCharacterCount = Math.max(
    0,
    ...Array.from(counts.entries()).map(([value, count]) => value.length * count),
  );
  const repeatedCharacterCount = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .reduce((sum, [value, count]) => sum + value.length * count, 0);
  const dominantSegmentCharacterRatio = totalSegmentCharacters > 0
    ? dominantSegmentCharacterCount / totalSegmentCharacters
    : 0;
  const repeatedCharacterRatio = totalSegmentCharacters > 0
    ? repeatedCharacterCount / totalSegmentCharacters
    : 0;
  const lastEnd = Math.max(0, ...units.map(unit => unit.end ?? 0));
  const durationCoverageRatio = expectedDurationSeconds > 0 && lastEnd > 0
    ? Math.min(1, lastEnd / expectedDurationSeconds)
    : null;
  const characterCount = normalizeSegment(text).length;
  const modelSegments = Array.isArray(input.segments) ? input.segments : [];
  const averageLogProbability = finiteAverage(
    modelSegments.map(segment => Number(segment.avg_logprob)),
  );
  const averageCompressionRatio = finiteAverage(
    modelSegments.map(segment => Number(segment.compression_ratio)),
  );
  const reasons: MorningMeetingTranscriptionQualityReason[] = [];

  if (!text || characterCount === 0) reasons.push("EMPTY_TRANSCRIPT");
  if (expectedDurationSeconds >= 60 && characterCount < Math.max(30, expectedDurationSeconds * 0.45)) {
    reasons.push("TRANSCRIPT_TOO_SHORT_FOR_DURATION");
  }
  if (
    segmentCount >= 6
    && dominantSegmentRatio >= 0.55
    && dominantSegmentCharacterRatio >= 0.45
  ) {
    reasons.push("DOMINANT_REPEATED_SEGMENT");
  }
  if (
    segmentCount >= 8
    && uniqueSegmentRatio <= 0.35
    && repeatedCharacterRatio >= 0.65
  ) {
    reasons.push("LOW_SEGMENT_DIVERSITY");
  }
  if (durationCoverageRatio !== null && expectedDurationSeconds >= 60 && durationCoverageRatio < 0.6) {
    reasons.push("LOW_AUDIO_DURATION_COVERAGE");
  }
  if (averageLogProbability !== null && averageLogProbability < -1.25) {
    reasons.push("LOW_MODEL_CONFIDENCE");
  }
  if (averageCompressionRatio !== null && averageCompressionRatio > 2.8) {
    reasons.push("HIGH_MODEL_COMPRESSION");
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    characterCount,
    segmentCount,
    uniqueSegmentCount,
    dominantSegmentCount,
    dominantSegmentRatio,
    dominantSegmentCharacterRatio,
    uniqueSegmentRatio,
    repeatedCharacterRatio,
    durationCoverageRatio,
    averageLogProbability,
    averageCompressionRatio,
  };
}

export function buildMorningMeetingRetryPrompt(language: "zh" | "ja"): string {
  return language === "zh"
    ? "团队早会完整逐字转写。请按实际时间顺序保留每位不同发言者的完整回答；不要重复主持人的提问，不要根据提示词补写听不清的内容。"
    : "チーム朝会を全文文字起こししてください。実際の時系列で各話者の回答を省略せず、司会者の質問を重複させたり、聞き取れない内容を推測で補ったりしないでください。";
}

function compactAttempt(
  source: MorningMeetingTranscriptionAttempt["source"],
  response: TranscriptionResponse | TranscriptionError,
  expectedDurationSeconds: number,
): MorningMeetingTranscriptionAttempt {
  if ("error" in response) {
    return {
      source,
      serviceErrorCode: response.code,
      quality: assessMorningMeetingTranscription({
        text: "",
        expectedDurationSeconds,
      }),
    };
  }
  return {
    source,
    quality: assessMorningMeetingTranscription({
      text: response.text,
      segments: response.segments,
      expectedDurationSeconds,
    }),
  };
}

export class MorningMeetingTranscriptionQualityError extends Error {
  readonly code = "MORNING_TRANSCRIPTION_LOW_QUALITY";
  readonly attempts: MorningMeetingTranscriptionAttempt[];

  constructor(attempts: MorningMeetingTranscriptionAttempt[]) {
    const reasonCodes = attempts
      .flatMap(attempt => attempt.quality.reasons)
      .filter((reason, index, all) => all.indexOf(reason) === index);
    super(`${"MORNING_TRANSCRIPTION_LOW_QUALITY"}:${reasonCodes.join(",") || "SERVICE_ERROR"}`);
    this.name = "MorningMeetingTranscriptionQualityError";
    this.attempts = attempts;
  }
}

export async function transcribeMorningMeetingWithQualityRetry(input: {
  audioUrl: string;
  language: "zh" | "ja";
  primaryPrompt: string;
  browserTranscript?: string;
  expectedDurationSeconds: number;
  transcribe?: TranscribeFn;
}): Promise<MorningMeetingTranscriptionResult> {
  const runTranscription = input.transcribe || transcribeAudio;
  const attempts: MorningMeetingTranscriptionAttempt[] = [];

  const primary = await runTranscription({
    audioUrl: input.audioUrl,
    language: input.language,
    prompt: input.primaryPrompt,
  });
  const primaryAttempt = compactAttempt("primary", primary, input.expectedDurationSeconds);
  attempts.push(primaryAttempt);
  if (!("error" in primary) && primaryAttempt.quality.accepted) {
    return {
      transcript: primary.text,
      response: primary,
      processingSource: "server_audio",
      attempts,
    };
  }

  const retry = await runTranscription({
    audioUrl: input.audioUrl,
    language: input.language,
    prompt: buildMorningMeetingRetryPrompt(input.language),
  });
  const retryAttempt = compactAttempt("retry", retry, input.expectedDurationSeconds);
  attempts.push(retryAttempt);
  if (!("error" in retry) && retryAttempt.quality.accepted) {
    return {
      transcript: retry.text,
      response: retry,
      processingSource: "server_audio_retry",
      attempts,
    };
  }

  const browserTranscript = String(input.browserTranscript || "").trim();
  if (browserTranscript) {
    const browserQuality = assessMorningMeetingTranscription({
      text: browserTranscript,
      expectedDurationSeconds: input.expectedDurationSeconds,
    });
    attempts.push({ source: "browser", quality: browserQuality });
    if (browserQuality.accepted) {
      return {
        transcript: browserTranscript,
        response: null,
        processingSource: "browser_fallback",
        attempts,
      };
    }
  }

  throw new MorningMeetingTranscriptionQualityError(attempts);
}
