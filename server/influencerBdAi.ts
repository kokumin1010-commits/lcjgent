import { invokeLLM } from "./_core/llm";

export const INFLUENCER_BD_AI_MODEL = "gemini-3-flash-preview";
export const INFLUENCER_BD_PROMPT_VERSION = "influencer-bd-v1";

export type InfluencerBdAnalysisResult = {
  executiveSummary: string;
  dataQuality: {
    sufficient: boolean;
    sampleSize: number;
    missingFields: string[];
    limitations: string[];
  };
  funnelDiagnosis: {
    contactedCreators: number;
    repliedCreators: number;
    positiveCreators: number;
    sampleCreators: number;
    cooperatingCreators: number;
    replyRate: number | null;
    positiveReplyRate: number | null;
    bottleneck: string;
  };
  rootCauses: Array<{
    category: "approach" | "script" | "selling_points" | "creator_fit" | "follow_up" | "evidence_gap" | "other";
    finding: string;
    evidence: string;
    impact: "high" | "medium" | "low";
    confidence: "high" | "medium" | "low";
  }>;
  sellingPointGaps: Array<{ gap: string; whyItMatters: string; recommendedExpression: string }>;
  recommendedActions: Array<{ priority: "high" | "medium" | "low"; action: string; reason: string; completionStandard: string; ownerRole: string }>;
  messageScripts: {
    opening: { zh: string; ja: string };
    followUp: { zh: string; ja: string };
    objectionResponse: { zh: string; ja: string };
  };
  creatorSegmentAdvice: Array<{ segment: string; reason: string; qualificationSignals: string[] }>;
  experiments: Array<{ hypothesis: string; variable: string; control: string; variation: string; successMetric: string; minimumSample: number }>;
  warnings: string[];
  confidence: "high" | "medium" | "low";
};

const bilingualScriptSchema = {
  type: "object",
  properties: {
    zh: { type: "string" },
    ja: { type: "string" },
  },
  required: ["zh", "ja"],
  additionalProperties: false,
} as const;

const resultSchema = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    dataQuality: {
      type: "object",
      properties: {
        sufficient: { type: "boolean" },
        sampleSize: { type: "integer", minimum: 0 },
        missingFields: { type: "array", items: { type: "string" } },
        limitations: { type: "array", items: { type: "string" } },
      },
      required: ["sufficient", "sampleSize", "missingFields", "limitations"],
      additionalProperties: false,
    },
    funnelDiagnosis: {
      type: "object",
      properties: {
        contactedCreators: { type: "integer", minimum: 0 },
        repliedCreators: { type: "integer", minimum: 0 },
        positiveCreators: { type: "integer", minimum: 0 },
        sampleCreators: { type: "integer", minimum: 0 },
        cooperatingCreators: { type: "integer", minimum: 0 },
        replyRate: { anyOf: [{ type: "number" }, { type: "null" }] },
        positiveReplyRate: { anyOf: [{ type: "number" }, { type: "null" }] },
        bottleneck: { type: "string" },
      },
      required: ["contactedCreators", "repliedCreators", "positiveCreators", "sampleCreators", "cooperatingCreators", "replyRate", "positiveReplyRate", "bottleneck"],
      additionalProperties: false,
    },
    rootCauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["approach", "script", "selling_points", "creator_fit", "follow_up", "evidence_gap", "other"] },
          finding: { type: "string" },
          evidence: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["category", "finding", "evidence", "impact", "confidence"],
        additionalProperties: false,
      },
    },
    sellingPointGaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          gap: { type: "string" },
          whyItMatters: { type: "string" },
          recommendedExpression: { type: "string" },
        },
        required: ["gap", "whyItMatters", "recommendedExpression"],
        additionalProperties: false,
      },
    },
    recommendedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          action: { type: "string" },
          reason: { type: "string" },
          completionStandard: { type: "string" },
          ownerRole: { type: "string" },
        },
        required: ["priority", "action", "reason", "completionStandard", "ownerRole"],
        additionalProperties: false,
      },
    },
    messageScripts: {
      type: "object",
      properties: {
        opening: bilingualScriptSchema,
        followUp: bilingualScriptSchema,
        objectionResponse: bilingualScriptSchema,
      },
      required: ["opening", "followUp", "objectionResponse"],
      additionalProperties: false,
    },
    creatorSegmentAdvice: {
      type: "array",
      items: {
        type: "object",
        properties: {
          segment: { type: "string" },
          reason: { type: "string" },
          qualificationSignals: { type: "array", items: { type: "string" } },
        },
        required: ["segment", "reason", "qualificationSignals"],
        additionalProperties: false,
      },
    },
    experiments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hypothesis: { type: "string" },
          variable: { type: "string" },
          control: { type: "string" },
          variation: { type: "string" },
          successMetric: { type: "string" },
          minimumSample: { type: "integer", minimum: 1 },
        },
        required: ["hypothesis", "variable", "control", "variation", "successMetric", "minimumSample"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["executiveSummary", "dataQuality", "funnelDiagnosis", "rootCauses", "sellingPointGaps", "recommendedActions", "messageScripts", "creatorSegmentAdvice", "experiments", "warnings", "confidence"],
  additionalProperties: false,
} as const;

const systemPrompt = `你是LCJ公司的达人BD改善分析师。你的任务是根据真实联络记录、推广方案、聊天文字和聊天截图，判断为什么回复率或推进率低，并给出可执行改善方案。

必须遵守以下规则：
1. 只使用输入证据。不得捏造达人回复、产品功能、佣金、样品政策、合作结果或员工行为。
2. 事实与假设必须分开。证据不足时明确写“证据不足”，并把confidence降低。
3. KPI以系统提供的确定性统计为准，不重新猜测数字。
4. 优先检查联络方式、话术、卖点/达人利益、达人匹配、跟进节奏和数据完整性。
5. 建议必须具体，包含原因、优先级、完成标准和适合的负责人角色。
6. 生成中日双语话术。日语必须自然、礼貌、简短，不要像机器翻译；中文用于内部确认。
7. 不输出密码、访问令牌、私人联系方式或与BD分析无关的个人敏感信息。
8. 聊天截图只用于识别本次沟通内容，不要推断未显示的信息。
9. A/B实验每次只改变一个变量，并给出可衡量成功指标。
10. 严格返回指定JSON结构。`;

export async function analyzeInfluencerBdEvidence(input: {
  snapshot: Record<string, unknown>;
  imageUrls: string[];
}): Promise<InfluencerBdAnalysisResult> {
  const content: Array<any> = [
    {
      type: "text",
      text: `请分析以下达人BD证据包。系统统计是确定性事实；记录中的空值表示未登记，不代表0。\n\n${JSON.stringify(input.snapshot)}`,
    },
  ];
  for (const url of input.imageUrls.slice(0, 8)) {
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  }

  const response = await invokeLLM({
    model: INFLUENCER_BD_AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "influencer_bd_analysis",
        strict: true,
        schema: resultSchema,
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("[BD-AI-EMPTY] AI没有返回可用结果");
  }
  let jsonText = raw.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) jsonText = fenced[1].trim();
  try {
    return JSON.parse(jsonText) as InfluencerBdAnalysisResult;
  } catch {
    throw new Error("[BD-AI-INVALID-JSON] AI返回的结构无法解析");
  }
}
