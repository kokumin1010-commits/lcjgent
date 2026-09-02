import { invokeLLM } from "./_core/llm";
import type { WhisperSegment } from "./_core/voiceTranscription";

export type MorningStaffSpeechProfile = {
  staffId: number;
  name: string;
  nameEn?: string | null;
  aliases?: string[] | null;
};

export type MorningMeetingProcessingSource =
  | "server_audio"
  | "browser_fallback";

type StructuredWorkPlan = {
  staffId: number;
  calledName: string;
  sourceTime: string;
  todayTaskZh: string;
  todayTaskJa: string;
  supportNeededZh: string;
  supportNeededJa: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
};

type StructuredAnalysis = {
  correctedTranscript: string;
  overviewZh: string;
  overviewJa: string;
  workPlans: StructuredWorkPlan[];
  unmatchedStatements: string[];
};

export type MorningMeetingSummaryV2 = {
  overview: string;
  participants: Array<{
    staffId: number;
    name: string;
    todayTask: string;
    supportNeeded?: string;
    confidence: "high" | "medium" | "low";
    evidence: string;
    calledName?: string;
    sourceTime?: string;
  }>;
  actionItems: Array<{
    staffId: number;
    person: string;
    task: string;
    deadline?: string;
    confidence: "high" | "medium" | "low";
  }>;
  cultureRuleRead: boolean;
  intelligenceVersion: "staff_work_plan_v2";
  sourceLanguage: "zh" | "ja";
  processingSource: MorningMeetingProcessingSource;
  translations: {
    zh: {
      overview: string;
      participants: Array<{
        staffId: number;
        name: string;
        todayTask: string;
        supportNeeded?: string;
        confidence: "high" | "medium" | "low";
        evidence: string;
        calledName?: string;
        sourceTime?: string;
      }>;
      actionItems: Array<{
        staffId: number;
        person: string;
        task: string;
        deadline?: string;
        confidence: "high" | "medium" | "low";
      }>;
    };
    ja: {
      overview: string;
      participants: Array<{
        staffId: number;
        name: string;
        todayTask: string;
        supportNeeded?: string;
        confidence: "high" | "medium" | "low";
        evidence: string;
        calledName?: string;
        sourceTime?: string;
      }>;
      actionItems: Array<{
        staffId: number;
        person: string;
        task: string;
        deadline?: string;
        confidence: "high" | "medium" | "low";
      }>;
    };
  };
  unmatchedStatements: string[];
};

const ANALYSIS_SCHEMA = {
  name: "morning_meeting_staff_work_plans",
  strict: true,
  schema: {
    type: "object",
    properties: {
      correctedTranscript: { type: "string" },
      overviewZh: { type: "string" },
      overviewJa: { type: "string" },
      workPlans: {
        type: "array",
        items: {
          type: "object",
          properties: {
            staffId: { type: "integer" },
            calledName: { type: "string" },
            sourceTime: { type: "string" },
            todayTaskZh: { type: "string" },
            todayTaskJa: { type: "string" },
            supportNeededZh: { type: "string" },
            supportNeededJa: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            evidence: { type: "string" },
          },
          required: [
            "staffId",
            "calledName",
            "sourceTime",
            "todayTaskZh",
            "todayTaskJa",
            "supportNeededZh",
            "supportNeededJa",
            "confidence",
            "evidence",
          ],
          additionalProperties: false,
        },
      },
      unmatchedStatements: { type: "array", items: { type: "string" } },
    },
    required: [
      "correctedTranscript",
      "overviewZh",
      "overviewJa",
      "workPlans",
      "unmatchedStatements",
    ],
    additionalProperties: false,
  },
} as const;

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function usableNameAlias(value: string): boolean {
  const normalized = value.trim();
  return (
    Boolean(normalized) &&
    !normalized.includes("@") &&
    !/^\S+\.\S+$/.test(normalized) &&
    normalized.length <= 40
  );
}

function generatedAliasCandidates(
  profile: MorningStaffSpeechProfile
): string[] {
  const characters = Array.from(profile.name.trim());
  if (
    characters.length < 2 ||
    characters.length > 4 ||
    !characters.every(character => /\p{Script=Han}/u.test(character))
  ) {
    return [];
  }
  const surname = characters[0];
  const givenCharacters = characters.slice(1);
  const givenName = givenCharacters.join("");
  const repeatedGivenNames = [
    `${givenCharacters[0]}${givenCharacters[0]}`,
    `${givenCharacters[givenCharacters.length - 1]}${givenCharacters[givenCharacters.length - 1]}`,
  ];
  return [
    givenName,
    ...repeatedGivenNames,
    `${givenName}姐`,
    `${givenName}哥`,
    `小${surname}`,
    `${surname}姐`,
    `${surname}哥`,
  ].filter(usableNameAlias);
}

export function deriveUniqueMorningStaffAliases(
  profiles: MorningStaffSpeechProfile[]
): Map<number, string[]> {
  const aliasOwners = new Map<string, Set<number>>();
  const candidatesByStaffId = new Map<number, string[]>();

  for (const profile of profiles) {
    const candidates = [
      profile.nameEn || "",
      ...(profile.aliases || []),
      ...generatedAliasCandidates(profile),
    ]
      .map(value => value.trim())
      .filter(usableNameAlias)
      .filter(alias => alias !== profile.name)
      .filter((alias, index, aliases) => aliases.indexOf(alias) === index);
    candidatesByStaffId.set(profile.staffId, candidates);
    for (const candidate of candidates) {
      const key = candidate.toLocaleLowerCase();
      const owners = aliasOwners.get(key) || new Set<number>();
      owners.add(profile.staffId);
      aliasOwners.set(key, owners);
    }
  }

  const uniqueAliasesByStaffId = new Map<number, string[]>();
  for (const profile of profiles) {
    const uniqueAliases = (candidatesByStaffId.get(profile.staffId) || [])
      .filter(alias => aliasOwners.get(alias.toLocaleLowerCase())?.size === 1)
      .slice(0, 12);
    uniqueAliasesByStaffId.set(profile.staffId, uniqueAliases);
  }
  return uniqueAliasesByStaffId;
}

export function buildMorningTranscriptionDictionary(
  profiles: MorningStaffSpeechProfile[]
): string {
  return profiles
    .map(profile => {
      const maintainedAliases = [
        profile.nameEn || "",
        ...(profile.aliases || []),
      ]
        .map(value => value.trim())
        .filter(usableNameAlias)
        .filter(alias => alias !== profile.name)
        .slice(0, 2);
      return maintainedAliases.length > 0
        ? `${profile.name}(${maintainedAliases.join("/")})`
        : profile.name;
    })
    .join("、");
}

export function buildMorningStaffDictionary(
  profiles: MorningStaffSpeechProfile[]
): string {
  const aliasesByStaffId = deriveUniqueMorningStaffAliases(profiles);
  return profiles
    .map(profile => {
      const aliases = aliasesByStaffId.get(profile.staffId) || [];
      return aliases.length > 0
        ? `${profile.staffId}: ${profile.name}（姓名变体：${aliases.join("、")}）`
        : `${profile.staffId}: ${profile.name}`;
    })
    .join("\n");
}

function segmentTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function formatMorningMeetingSegments(
  segments: WhisperSegment[] | undefined,
  fallbackText: string
): string {
  if (!Array.isArray(segments) || segments.length === 0)
    return fallbackText.trim();
  return segments
    .filter(
      segment =>
        segment && typeof segment.text === "string" && segment.text.trim()
    )
    .map(
      segment =>
        `[${segmentTime(segment.start)}-${segmentTime(segment.end)}] ${segment.text.trim()}`
    )
    .join("\n")
    .trim();
}

function normalizeCalledName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\[\]【】（）()，。！？!?：:\s]/g, "")
    .replace(/^(好的|然后|接下来|还有)+/g, "")
    .replace(/(这边|你这边|今天|工作计划|请讲|说一下)+$/g, "")
    .toLocaleLowerCase();
}

function isUniqueCalledNameForStaff(
  calledName: string,
  staffId: number,
  profiles: MorningStaffSpeechProfile[],
  aliasesByStaffId: Map<number, string[]>
): boolean {
  const normalizedCalledName = normalizeCalledName(calledName);
  if (!normalizedCalledName) return false;
  const owners = profiles.filter(profile =>
    [profile.name, ...(aliasesByStaffId.get(profile.staffId) || [])].some(
      name => normalizeCalledName(name) === normalizedCalledName
    )
  );
  return owners.length === 1 && owners[0].staffId === staffId;
}

function parseStructuredContent(response: unknown): StructuredAnalysis {
  const content =
    typeof response === "string"
      ? response
      : (response as any)?.choices?.[0]?.message?.content ||
        (response as any)?.content ||
        "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("morning meeting intelligence returned empty content");
  }
  return JSON.parse(content) as StructuredAnalysis;
}

function fallbackSummary(
  transcript: string,
  language: "zh" | "ja",
  source: MorningMeetingProcessingSource
): MorningMeetingSummaryV2 {
  const overviewZh =
    language === "zh"
      ? "AI分析暂时失败，请查看完整转写内容。"
      : "AI分析暂时失败，请查看原始日语转写。";
  const overviewJa =
    language === "ja"
      ? "AI分析に失敗しました。文字起こし原文を確認してください。"
      : "AI分析に失敗しました。中国語の文字起こし原文を確認してください。";
  return {
    overview: language === "zh" ? overviewZh : overviewJa,
    participants: [],
    actionItems: [],
    cultureRuleRead: false,
    intelligenceVersion: "staff_work_plan_v2",
    sourceLanguage: language,
    processingSource: source,
    translations: {
      zh: { overview: overviewZh, participants: [], actionItems: [] },
      ja: { overview: overviewJa, participants: [], actionItems: [] },
    },
    unmatchedStatements: transcript ? [transcript.slice(0, 500)] : [],
  };
}

export async function analyzeMorningMeetingWorkPlans(input: {
  transcript: string;
  browserTranscript?: string;
  language: "zh" | "ja";
  profiles: MorningStaffSpeechProfile[];
  source: MorningMeetingProcessingSource;
}): Promise<{ transcript: string; summary: MorningMeetingSummaryV2 }> {
  const transcript = input.transcript.trim();
  if (!transcript) {
    return {
      transcript,
      summary: fallbackSummary(transcript, input.language, input.source),
    };
  }

  const profilesById = new Map(
    input.profiles.map(profile => [profile.staffId, profile])
  );
  const dictionary = buildMorningStaffDictionary(input.profiles);
  const browserContext = input.browserTranscript?.trim()
    ? `\n\n浏览器实时字幕（仅作低优先级辅助，可能有很多错字，不能覆盖原音频转写）：\n${input.browserTranscript.trim().slice(0, 40_000)}`
    : "";

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `你是LCJ公司中文早会的文字校对与工作计划提取员。你的唯一任务是：利用整段上下文和主持人的点名顺序，识别员工并提取每个人今天明确说出的工作计划。\n\n严格规则：\n1. 员工姓名只能来自给定员工词典，最终通过staffId绑定；不得创造“主持人、小刘、张姐、燕社长、参加者1”等词典外人员。\n2. 只把员工词典用于姓名或别名识别，不根据部门、职位、邮箱推测工作内容。\n3. 以主持人的点名问句作为发言边界。每次出现“好的，然后X”“X你今天”“X这边”等新点名时，前一个员工的发言立即结束；绝不能把下一位员工的内容并入上一位。\n4. calledName必须填写转写中实际听到的点名称呼，sourceTime填写该点名所在的时间标记。一个点名区段只能归属一个staffId，同一段内容不得重复分配给两个人。\n5. 只有当点名称呼与员工全名、词典中的唯一姓名变体，或明显同音且全场唯一的姓名变体对应时才匹配。像“小吴”“吴姐”“黄桑”这样可能对应多名在场员工的称呼，必须放入unmatchedStatements，禁止根据工作内容或职位猜人。\n6. 纠正同音人名和明显语音错字，但不能捏造录音中没有的任务、数字、品牌、期限或问题。\n7. 只提取每个人当天计划做什么。寒暄、主持人提问、历史背景和无法归属的内容不要硬分配；无法确认的片段放入unmatchedStatements。\n8. 同一员工的连续内容合并成一条具体工作计划；没有明确工作计划的员工不要输出。\n9. todayTaskZh必须是准确自然的中文；todayTaskJa是同一内容的忠实日文翻译，不增删事实。\n10. correctedTranscript保留原始发言顺序和主要内容；可在已确认时用“[员工姓名]”标记发言人，不能确认时不要编造标签。\n11. evidence引用支持归属判断的短句，不超过80字。confidence只有在姓名/别名或点名上下文明晰时为high，否则为medium或low。`,
        },
        {
          role: "user",
          content: `录音语言：${input.language === "zh" ? "中文" : "日文"}\n\n允许使用的员工姓名/别名词典：\n${dictionary || "（没有可用员工词典；不要输出任何员工工作计划）"}\n\n服务器原音频转写（主证据，带时间顺序）：\n${transcript.slice(0, 160_000)}${browserContext}`,
        },
      ],
      outputSchema: ANALYSIS_SCHEMA,
    });

    const parsed = parseStructuredContent(response);
    const seenStaffIds = new Set<number>();
    const seenSpeechBlocks = new Set<string>();
    const aliasesByStaffId = deriveUniqueMorningStaffAliases(input.profiles);
    const plans = (Array.isArray(parsed.workPlans) ? parsed.workPlans : [])
      .filter(plan => {
        const speechBlockKey = `${cleanText(plan?.calledName, 100).toLocaleLowerCase()}|${cleanText(plan?.sourceTime, 100).toLocaleLowerCase()}|${cleanText(plan?.evidence, 500).toLocaleLowerCase()}`;
        if (
          !plan ||
          !Number.isInteger(plan.staffId) ||
          seenStaffIds.has(plan.staffId)
        )
          return false;
        if (
          !profilesById.has(plan.staffId) ||
          !cleanText(plan.todayTaskZh, 4_000) ||
          seenSpeechBlocks.has(speechBlockKey)
        )
          return false;
        seenStaffIds.add(plan.staffId);
        seenSpeechBlocks.add(speechBlockKey);
        return true;
      })
      .map(plan => ({
        ...plan,
        calledName: cleanText(plan.calledName, 100),
        sourceTime: cleanText(plan.sourceTime, 100),
        todayTaskZh: cleanText(plan.todayTaskZh, 4_000),
        todayTaskJa: cleanText(plan.todayTaskJa, 4_000),
        supportNeededZh: cleanText(plan.supportNeededZh, 2_000),
        supportNeededJa: cleanText(plan.supportNeededJa, 2_000),
        confidence: isUniqueCalledNameForStaff(
          plan.calledName,
          plan.staffId,
          input.profiles,
          aliasesByStaffId
        )
          ? plan.confidence
          : ("low" as const),
        evidence: cleanText(plan.evidence, 500),
        profile: profilesById.get(plan.staffId)!,
      }));

    const zhParticipants = plans.map(plan => ({
      staffId: plan.staffId,
      name: plan.profile.name,
      todayTask: plan.todayTaskZh,
      supportNeeded: plan.supportNeededZh || undefined,
      confidence: plan.confidence,
      evidence: plan.evidence,
      calledName: plan.calledName,
      sourceTime: plan.sourceTime,
    }));
    const jaParticipants = plans.map(plan => ({
      staffId: plan.staffId,
      name: plan.profile.name,
      todayTask: plan.todayTaskJa || plan.todayTaskZh,
      supportNeeded: plan.supportNeededJa || undefined,
      confidence: plan.confidence,
      evidence: plan.evidence,
      calledName: plan.calledName,
      sourceTime: plan.sourceTime,
    }));
    const zhActionItems = zhParticipants.map(plan => ({
      staffId: plan.staffId,
      person: plan.name,
      task: plan.todayTask,
      confidence: plan.confidence,
    }));
    const jaActionItems = jaParticipants.map(plan => ({
      staffId: plan.staffId,
      person: plan.name,
      task: plan.todayTask,
      confidence: plan.confidence,
    }));
    const overviewZh =
      cleanText(parsed.overviewZh, 8_000) || "已按员工整理今天的工作计划。";
    const overviewJa =
      cleanText(parsed.overviewJa, 8_000) ||
      "スタッフ別に本日の作業計画を整理しました。";
    const primaryParticipants =
      input.language === "zh" ? zhParticipants : jaParticipants;
    const primaryActionItems =
      input.language === "zh" ? zhActionItems : jaActionItems;
    const correctedTranscript =
      cleanText(parsed.correctedTranscript, 200_000) || transcript;

    return {
      transcript: correctedTranscript,
      summary: {
        overview: input.language === "zh" ? overviewZh : overviewJa,
        participants: primaryParticipants,
        actionItems: primaryActionItems,
        cultureRuleRead: false,
        intelligenceVersion: "staff_work_plan_v2",
        sourceLanguage: input.language,
        processingSource: input.source,
        translations: {
          zh: {
            overview: overviewZh,
            participants: zhParticipants,
            actionItems: zhActionItems,
          },
          ja: {
            overview: overviewJa,
            participants: jaParticipants,
            actionItems: jaActionItems,
          },
        },
        unmatchedStatements: (Array.isArray(parsed.unmatchedStatements)
          ? parsed.unmatchedStatements
          : []
        )
          .map(value => cleanText(value, 1_000))
          .filter(Boolean)
          .slice(0, 50),
      },
    };
  } catch (error) {
    console.error("Morning meeting work-plan analysis error:", error);
    return {
      transcript,
      summary: fallbackSummary(transcript, input.language, input.source),
    };
  }
}

const MANUAL_TRANSLATION_SCHEMA = {
  name: "morning_meeting_manual_work_plan_translation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      plans: {
        type: "array",
        items: {
          type: "object",
          properties: {
            staffId: { type: "integer" },
            todayTaskJa: { type: "string" },
          },
          required: ["staffId", "todayTaskJa"],
          additionalProperties: false,
        },
      },
    },
    required: ["plans"],
    additionalProperties: false,
  },
} as const;

export async function buildManualMorningMeetingSummary(input: {
  plans: Array<{ staffId: number; todayTaskZh: string }>;
  profiles: MorningStaffSpeechProfile[];
  existingSummary?: Partial<MorningMeetingSummaryV2> | null;
}): Promise<MorningMeetingSummaryV2> {
  const profileById = new Map(
    input.profiles.map(profile => [profile.staffId, profile])
  );
  const cleanPlans = input.plans
    .filter(
      plan =>
        profileById.has(plan.staffId) && cleanText(plan.todayTaskZh, 4_000)
    )
    .map(plan => ({
      staffId: plan.staffId,
      todayTaskZh: cleanText(plan.todayTaskZh, 4_000),
    }));
  if (cleanPlans.length === 0) {
    throw new Error("至少需要保留一名员工的工作计划");
  }

  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "你是严谨的中日翻译员。把每条员工工作计划忠实翻译成自然日语，不得补充、删减或推测任何任务、数字、品牌、期限。staffId必须原样返回。",
      },
      {
        role: "user",
        content: JSON.stringify(cleanPlans),
      },
    ],
    outputSchema: MANUAL_TRANSLATION_SCHEMA,
  });
  const parsed = parseStructuredContent(response) as unknown as {
    plans?: Array<{ staffId: number; todayTaskJa: string }>;
  };
  const japaneseByStaffId = new Map(
    (Array.isArray(parsed.plans) ? parsed.plans : [])
      .filter(
        plan => Number.isInteger(plan.staffId) && profileById.has(plan.staffId)
      )
      .map(plan => [plan.staffId, cleanText(plan.todayTaskJa, 4_000)])
  );
  if (japaneseByStaffId.size !== cleanPlans.length) {
    throw new Error("人工修正内容の日中翻訳に失敗しました");
  }

  const zhParticipants = cleanPlans.map(plan => ({
    staffId: plan.staffId,
    name: profileById.get(plan.staffId)!.name,
    todayTask: plan.todayTaskZh,
    confidence: "high" as const,
    evidence: "人工确认",
  }));
  const jaParticipants = cleanPlans.map(plan => ({
    staffId: plan.staffId,
    name: profileById.get(plan.staffId)!.name,
    todayTask: japaneseByStaffId.get(plan.staffId) || plan.todayTaskZh,
    confidence: "high" as const,
    evidence: "手動確認済み",
  }));
  const zhActionItems = zhParticipants.map(plan => ({
    staffId: plan.staffId,
    person: plan.name,
    task: plan.todayTask,
    confidence: plan.confidence,
  }));
  const jaActionItems = jaParticipants.map(plan => ({
    staffId: plan.staffId,
    person: plan.name,
    task: plan.todayTask,
    confidence: plan.confidence,
  }));
  const overviewZh = `已人工确认${zhParticipants.length}名员工今天的工作计划。`;
  const overviewJa = `${jaParticipants.length}名の本日の作業計画を手動確認しました。`;
  const sourceLanguage =
    input.existingSummary?.sourceLanguage === "ja" ? "ja" : "zh";

  return {
    overview: sourceLanguage === "zh" ? overviewZh : overviewJa,
    participants: sourceLanguage === "zh" ? zhParticipants : jaParticipants,
    actionItems: sourceLanguage === "zh" ? zhActionItems : jaActionItems,
    cultureRuleRead: false,
    intelligenceVersion: "staff_work_plan_v2",
    sourceLanguage,
    processingSource:
      input.existingSummary?.processingSource === "browser_fallback"
        ? "browser_fallback"
        : "server_audio",
    translations: {
      zh: {
        overview: overviewZh,
        participants: zhParticipants,
        actionItems: zhActionItems,
      },
      ja: {
        overview: overviewJa,
        participants: jaParticipants,
        actionItems: jaActionItems,
      },
    },
    unmatchedStatements: [],
  };
}
