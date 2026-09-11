import { describe, expect, it, vi } from "vitest";
import type {
  TranscriptionError,
  TranscriptionResponse,
  WhisperSegment,
} from "./_core/voiceTranscription";
import {
  MorningMeetingTranscriptionQualityError,
  assessMorningMeetingTranscription,
  transcribeMorningMeetingWithQualityRetry,
} from "./morningMeetingTranscriptionQuality";

function segment(
  id: number,
  start: number,
  end: number,
  text: string,
  overrides: Partial<WhisperSegment> = {},
): WhisperSegment {
  return {
    id,
    seek: 0,
    start,
    end,
    text,
    tokens: [],
    temperature: 0,
    avg_logprob: -0.2,
    compression_ratio: 1.1,
    no_speech_prob: 0.01,
    ...overrides,
  };
}

function response(segments: WhisperSegment[]): TranscriptionResponse {
  return {
    task: "transcribe",
    language: "zh",
    duration: Math.max(0, ...segments.map(item => item.end)),
    text: segments.map(item => item.text).join("\n"),
    segments,
  };
}

const serviceError: TranscriptionError = {
  error: "synthetic service failure",
  code: "TRANSCRIPTION_FAILED",
};

const validSegments = [
  segment(1, 0, 12, "主持人说明今天依次确认每位成员的工作安排。"),
  segment(2, 12, 24, "成员一今天整理商品资料，并核对待补充的图片。"),
  segment(3, 24, 36, "成员二今天联系合作方，确认下午的沟通时间。"),
  segment(4, 36, 48, "成员三今天检查库存数字，并记录需要补货的项目。"),
  segment(5, 48, 60, "成员四今天制作短视频，并完成发布前的审核。"),
  segment(6, 60, 72, "成员五今天跟进直播准备，确认设备和样品状态。"),
  segment(7, 72, 84, "成员六今天更新店铺信息，并复核负责人资料。"),
  segment(8, 84, 96, "成员七今天处理采购进度，确认预计到货日期。"),
  segment(9, 96, 108, "成员八今天汇总昨日数据，整理需要解决的问题。"),
  segment(10, 108, 120, "成员九今天确认主播安排，并补充广告费用记录。"),
  segment(11, 120, 132, "成员十今天检查订单状态，完成异常订单分类。"),
  segment(12, 132, 143.5, "主持人确认以上安排，并说明有问题要及时提出。"),
];

const repeatedSegments = Array.from({ length: 12 }, (_, index) =>
  index < 10
    ? segment(index + 1, index * 12, (index + 1) * 12, "合成重复片段，仅用于质量测试。")
    : segment(index + 1, index * 12, (index + 1) * 12, index === 10 ? "今天确认一下。" : "好的。"),
);

describe("morning meeting transcription quality", () => {
  it("accepts a fully covered multi-speaker style 144-second transcript", () => {
    const quality = assessMorningMeetingTranscription({
      text: response(validSegments).text,
      segments: validSegments,
      expectedDurationSeconds: 144,
    });

    expect(quality.accepted).toBe(true);
    expect(quality.reasons).toEqual([]);
    expect(quality.durationCoverageRatio).toBeGreaterThan(0.99);
    expect(quality.uniqueSegmentCount).toBe(12);
  });

  it("rejects a dominant repeated short sentence in 10 of 12 segments", () => {
    const quality = assessMorningMeetingTranscription({
      text: response(repeatedSegments).text,
      segments: repeatedSegments,
      expectedDurationSeconds: 144,
    });

    expect(quality.accepted).toBe(false);
    expect(quality.reasons).toEqual(expect.arrayContaining([
      "DOMINANT_REPEATED_SEGMENT",
      "LOW_SEGMENT_DIVERSITY",
    ]));
    expect(quality.dominantSegmentRatio).toBeCloseTo(10 / 12);
  });

  it("does not reject a real meeting merely because a short moderator prompt repeats", () => {
    const shortPrompt = "下一位。";
    const segments = [
      segment(1, 0, 8, shortPrompt),
      segment(2, 8, 28, "第一位成员详细说明商品资料整理和图片核对的计划。"),
      segment(3, 28, 36, shortPrompt),
      segment(4, 36, 58, "第二位成员详细说明合作方联系和沟通时间确认的计划。"),
      segment(5, 58, 66, shortPrompt),
      segment(6, 66, 94, "第三位成员详细说明库存核对补货记录和异常确认的计划。"),
      segment(7, 94, 102, shortPrompt),
      segment(8, 102, 143, "第四位成员详细说明直播准备设备确认样品检查和发布安排。"),
    ];

    const quality = assessMorningMeetingTranscription({
      text: response(segments).text,
      segments,
      expectedDurationSeconds: 144,
    });

    expect(quality.accepted).toBe(true);
    expect(quality.dominantSegmentRatio).toBe(0.5);
    expect(quality.dominantSegmentCharacterRatio).toBeLessThan(0.45);
  });

  it("rejects an implausibly short transcript for a two-minute recording", () => {
    const quality = assessMorningMeetingTranscription({
      text: "今天先确认工作。",
      expectedDurationSeconds: 120,
    });

    expect(quality.accepted).toBe(false);
    expect(quality.reasons).toContain("TRANSCRIPT_TOO_SHORT_FOR_DURATION");
  });

  it("rejects timestamped segments that end before most of the recording", () => {
    const earlySegments = validSegments.map((item, index) => ({
      ...item,
      start: index * 4,
      end: (index + 1) * 4,
    }));
    const quality = assessMorningMeetingTranscription({
      text: response(earlySegments).text,
      segments: earlySegments,
      expectedDurationSeconds: 144,
    });

    expect(quality.accepted).toBe(false);
    expect(quality.reasons).toContain("LOW_AUDIO_DURATION_COVERAGE");
  });

  it("uses a valid second server transcription after primary quality failure", async () => {
    const transcribe = vi.fn()
      .mockResolvedValueOnce(response(repeatedSegments))
      .mockResolvedValueOnce(response(validSegments));

    const result = await transcribeMorningMeetingWithQualityRetry({
      audioUrl: "https://storage.example.test/synthetic.webm",
      language: "zh",
      primaryPrompt: "synthetic primary prompt",
      expectedDurationSeconds: 144,
      transcribe,
    });

    expect(result.processingSource).toBe("server_audio_retry");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.quality.accepted).toBe(false);
    expect(result.attempts[1]?.quality.accepted).toBe(true);
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(transcribe.mock.calls[1]?.[0]?.prompt).not.toBe("synthetic primary prompt");
  });

  it("accepts browser text only after both server attempts fail and browser text passes", async () => {
    const browserTranscript = validSegments.map(item => item.text).join("\n");
    const transcribe = vi.fn()
      .mockResolvedValueOnce(serviceError)
      .mockResolvedValueOnce(response(repeatedSegments));

    const result = await transcribeMorningMeetingWithQualityRetry({
      audioUrl: "https://storage.example.test/synthetic.webm",
      language: "zh",
      primaryPrompt: "synthetic primary prompt",
      browserTranscript,
      expectedDurationSeconds: 144,
      transcribe,
    });

    expect(result.processingSource).toBe("browser_fallback");
    expect(result.response).toBeNull();
    expect(result.transcript).toBe(browserTranscript);
    expect(result.attempts.map(attempt => attempt.source)).toEqual(["primary", "retry", "browser"]);
  });

  it("throws a structured non-sensitive error when every candidate is low quality", async () => {
    const privateRawText = "PRIVATE_SYNTHETIC_REPEATED_SENTENCE";
    const privateSegments = repeatedSegments.map(item => ({ ...item, text: privateRawText }));
    const transcribe = vi.fn()
      .mockResolvedValueOnce(response(privateSegments))
      .mockResolvedValueOnce(response(privateSegments));

    let caught: unknown;
    try {
      await transcribeMorningMeetingWithQualityRetry({
        audioUrl: "https://storage.example.test/synthetic.webm",
        language: "zh",
        primaryPrompt: "synthetic primary prompt",
        browserTranscript: Array.from({ length: 10 }, () => privateRawText).join("\n"),
        expectedDurationSeconds: 144,
        transcribe,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MorningMeetingTranscriptionQualityError);
    const qualityError = caught as MorningMeetingTranscriptionQualityError;
    expect(qualityError.code).toBe("MORNING_TRANSCRIPTION_LOW_QUALITY");
    expect(qualityError.attempts).toHaveLength(3);
    expect(qualityError.message).not.toContain(privateRawText);
    expect(JSON.stringify(qualityError.attempts)).not.toContain(privateRawText);
    expect(qualityError.attempts.flatMap(attempt => attempt.quality.reasons)).toContain(
      "DOMINANT_REPEATED_SEGMENT",
    );
  });
});
