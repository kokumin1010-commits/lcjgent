import { describe, expect, it } from "vitest";
import type { TranscriptionResponse } from "./_core/voiceTranscription";
import { mergeMorningMeetingChunkResponses } from "./morningMeetingSegmentedTranscription";

function response(text: string, start: number, end: number, duration: number): TranscriptionResponse {
  return {
    task: "transcribe",
    language: "zh",
    duration,
    text,
    segments: [{
      id: 0,
      start,
      end,
      text,
    }],
  };
}

describe("segmented morning meeting transcription", () => {
  it("uses verified chunk durations when provider duration metadata is shorter", () => {
    const merged = mergeMorningMeetingChunkResponses([
      response("第一段真实发言。", 0, 30, 30),
      response("第二段真实发言。", 1, 22, 22),
    ], [240, 24]);

    expect(merged.duration).toBe(264);
    expect(merged.segments).toHaveLength(2);
    expect(merged.segments[0]).toMatchObject({ start: 0, end: 30 });
    expect(merged.segments[1]).toMatchObject({ start: 241, end: 262 });
  });

  it("falls back to provider duration for callers without verified chunk metadata", () => {
    const merged = mergeMorningMeetingChunkResponses([
      response("第一段。", 0, 10, 10),
      response("第二段。", 2, 8, 8),
    ]);

    expect(merged.duration).toBe(18);
    expect(merged.segments[1]).toMatchObject({ start: 12, end: 18 });
  });
});
