import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const { invokeLLMMock } = vi.hoisted(() => ({
  invokeLLMMock: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

import {
  analyzeMorningMeetingWorkPlans,
  buildManualMorningMeetingSummary,
  buildMorningStaffDictionary,
  buildMorningTranscriptionDictionary,
  deriveUniqueMorningStaffAliases,
  formatMorningMeetingSegments,
} from "./morningMeetingIntelligence";

const routerSource = readFileSync(
  new URL("./morningMeetingRouter.ts", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../client/src/pages/MorningMeeting.tsx", import.meta.url),
  "utf8"
);

const profiles = [
  { staffId: 1, name: "胡佳婷", aliases: ["jiating@example.com"] },
  { staffId: 2, name: "施宇宁" },
  { staffId: 3, name: "吴品震" },
  { staffId: 4, name: "吴逸清" },
  { staffId: 5, name: "王强" },
];

function llmResponse(content: unknown) {
  return {
    id: "test",
    created: 1,
    model: "gpt-5-mini",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(content) },
        finish_reason: "stop",
      },
    ],
  };
}

afterEach(() => {
  invokeLLMMock.mockReset();
});

describe("morning meeting staff-aware intelligence", () => {
  it("derives only unique name variants and excludes email-shaped aliases", () => {
    const aliases = deriveUniqueMorningStaffAliases(profiles);
    expect(aliases.get(1)).toContain("佳婷姐");
    expect(aliases.get(2)).toContain("小施");
    expect(aliases.get(5)).toContain("强哥");
    expect(aliases.get(3)).not.toContain("小吴");
    expect(aliases.get(4)).not.toContain("小吴");
    expect(buildMorningStaffDictionary(profiles)).not.toContain(
      "jiating@example.com"
    );
    expect(buildMorningTranscriptionDictionary(profiles)).not.toContain(
      "jiating@example.com"
    );
    expect(buildMorningTranscriptionDictionary(profiles)).not.toContain(
      "佳婷姐"
    );
  });

  it("keeps timestamped audio segments so the model can follow call-and-response order", () => {
    const result = formatMorningMeetingSegments(
      [
        {
          id: 1,
          seek: 0,
          start: 1.2,
          end: 4.9,
          text: "佳婷姐，你今天做什么？",
          tokens: [],
          temperature: 0,
          avg_logprob: -0.1,
          compression_ratio: 1,
          no_speech_prob: 0,
        },
      ],
      "fallback"
    );
    expect(result).toBe("[00:01-00:04] 佳婷姐，你今天做什么？");
  });

  it("accepts only roster staff IDs, removes duplicate staff blocks and marks ambiguous called names low-confidence", async () => {
    invokeLLMMock.mockResolvedValue(
      llmResponse({
        correctedTranscript: "[胡佳婷] 今天跟进招聘。",
        overviewZh: "今天按人员确认工作计划。",
        overviewJa: "本日の作業計画を確認しました。",
        workPlans: [
          {
            staffId: 1,
            calledName: "佳婷姐",
            sourceTime: "00:01",
            todayTaskZh: "跟进招聘。",
            todayTaskJa: "採用をフォローする。",
            supportNeededZh: "",
            supportNeededJa: "",
            confidence: "high",
            evidence: "佳婷姐，你今天做什么",
          },
          {
            staffId: 1,
            calledName: "佳婷姐",
            sourceTime: "00:02",
            todayTaskZh: "重复内容",
            todayTaskJa: "重複内容",
            supportNeededZh: "",
            supportNeededJa: "",
            confidence: "high",
            evidence: "重复",
          },
          {
            staffId: 999,
            calledName: "主持人",
            sourceTime: "00:03",
            todayTaskZh: "不得出现",
            todayTaskJa: "出力禁止",
            supportNeededZh: "",
            supportNeededJa: "",
            confidence: "high",
            evidence: "主持人",
          },
          {
            staffId: 3,
            calledName: "小吴",
            sourceTime: "00:04",
            todayTaskZh: "优化商品页面。",
            todayTaskJa: "商品ページを最適化する。",
            supportNeededZh: "",
            supportNeededJa: "",
            confidence: "medium",
            evidence: "小吴，你今天",
          },
        ],
        unmatchedStatements: ["无法归属的片段"],
      })
    );

    const result = await analyzeMorningMeetingWorkPlans({
      transcript: "[00:01] 佳婷姐，你今天做什么？今天跟进招聘。",
      language: "zh",
      profiles,
      source: "server_audio",
    });

    expect(result.summary.participants).toHaveLength(2);
    expect(result.summary.participants.map(item => item.name)).toEqual([
      "胡佳婷",
      "吴品震",
    ]);
    expect(result.summary.participants[0].confidence).toBe("high");
    expect(result.summary.participants[1].confidence).toBe("low");
    expect(
      result.summary.participants.some(item => item.name === "主持人")
    ).toBe(false);
    expect(result.summary.translations.ja.participants[0].todayTask).toBe(
      "採用をフォローする。"
    );
    expect(invokeLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        outputSchema: expect.objectContaining({
          name: "morning_meeting_staff_work_plans",
          strict: true,
        }),
      })
    );
  });

  it("rebuilds manually corrected plans with faithful Japanese output and keeps only roster staff", async () => {
    invokeLLMMock.mockResolvedValue(
      llmResponse({
        plans: [{ staffId: 2, todayTaskJa: "ライブ動画を編集する。" }],
      })
    );

    const result = await buildManualMorningMeetingSummary({
      plans: [
        { staffId: 2, todayTaskZh: "剪辑直播视频。" },
        { staffId: 999, todayTaskZh: "不得写入。" },
      ],
      profiles,
      existingSummary: {
        sourceLanguage: "zh",
        processingSource: "server_audio",
      },
    });

    expect(result.participants).toEqual([
      expect.objectContaining({
        staffId: 2,
        name: "施宇宁",
        todayTask: "剪辑直播视频。",
        confidence: "high",
      }),
    ]);
    expect(result.translations.ja.participants[0].todayTask).toBe(
      "ライブ動画を編集する。"
    );
    expect(result.participants.some(item => item.staffId === 999)).toBe(false);
  });
});

describe("morning meeting pipeline contracts", () => {
  it("always transcribes saved team audio and uses browser text only as fallback context", () => {
    const saveBlock =
      routerSource
        .split("saveDailyTeamMeeting: protectedProcedure")[1]
        ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";
    expect(saveBlock).toContain("storageGet(stored.key)");
    expect(saveBlock).toContain("formatMorningMeetingSegments(");
    expect(saveBlock).toContain('processingSource = "browser_fallback"');
    expect(saveBlock).toContain("analyzeMorningMeetingWorkPlans({");
    expect(saveBlock).not.toContain(
      "transcript = await correctTranscription(browserTranscript"
    );
  });

  it("injects employee names, English names and aliases without departments or positions", () => {
    const teamBlock =
      routerSource
        .split("saveDailyTeamMeeting: protectedProcedure")[1]
        ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";
    expect(teamBlock).toContain("nameEn: staff.nameEn");
    expect(teamBlock).toContain("aliases: staff.aliases");
    expect(routerSource).toContain("buildMorningTranscriptionDictionary(");
    expect(routerSource).toContain(
      "participantSpeechProfiles(participantSnapshot)"
    );
  });

  it("locks team speech recognition language to China or Japan instead of a free toggle", () => {
    expect(pageSource).toContain(
      'recognition.lang = activeTeamCode === "china" ? "zh-CN" : "ja-JP"'
    );
    expect(pageSource).toContain(
      'const language = activeTeamCode === "china" ? "zh" : "ja"'
    );
    expect(pageSource).toContain("识别语言：中文（跟随中国团队）");
    expect(pageSource).toContain("認識言語：日本語（日本チーム連動）");
  });

  it("protects manual corrections with owner/admin access, participant whitelist and audit", () => {
    const updateBlock =
      routerSource
        .split("updateTeamMeetingWorkPlans: protectedProcedure")[1]
        ?.split("getSeparatedHistory: protectedProcedure")[0] ?? "";
    expect(updateBlock).toContain(
      "requireMeetingOwnerOrAdmin(db, input.id, ctx.user)"
    );
    expect(updateBlock).toContain("allowedStaffIds.has(plan.staffId)");
    expect(updateBlock).toContain("buildManualMorningMeetingSummary({");
    expect(updateBlock).toContain(
      'actionType: "morning_meeting_work_plans_corrected"'
    );
    expect(pageSource).toContain("人工修正员工与工作计划");
    expect(pageSource).toContain("保存并同步日语");
  });
});
