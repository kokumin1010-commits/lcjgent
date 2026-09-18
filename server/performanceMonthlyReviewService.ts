import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  PERFORMANCE_DIMENSION_CAPS,
  PERFORMANCE_DIMENSION_LABELS,
  canonicalizePerformanceItems,
  shouldRequireManagerDifferenceReason,
  shouldRequireMonthlyReviewSecondApproval,
  type PerformanceDimension,
} from "../shared/performancePolicy";
import { invokeLLM } from "./_core/llm";
import type { PerformanceAccess } from "./performanceAccess";
import {
  assertCanReviewPerformanceStaff,
  assertCanViewPerformanceStaff,
  requirePerformanceStaff,
} from "./performanceAccess";
import { buildDimensionRows } from "./performanceService";
import { ensurePerformanceInitialized } from "./performanceReconciliationService";
import type { PerformanceDatabase } from "./performanceUpgrade";

export const PERFORMANCE_AI_MODEL = "gpt-5-mini";
export const PERFORMANCE_AI_PROMPT_VERSION = "performance-monthly-v1";
export const PERFORMANCE_AI_SCHEMA_VERSION = "performance-ai-assessment-v1";

const DIMENSIONS = Object.keys(PERFORMANCE_DIMENSION_CAPS) as PerformanceDimension[];

export type AiDimensionAssessment = {
  dimension: PerformanceDimension;
  applicable: boolean;
  score: number | null;
  cap: number;
  confidence: number;
  reason: string;
  evidenceIds: string[];
};

export type AiMonthlyAssessment = {
  schemaVersion: string;
  staffId: number;
  yearMonth: string;
  factsCutoffAt: string;
  dimensions: AiDimensionAssessment[];
  applicableMaximum: number;
  totalScore: number;
  normalizedScore: number | null;
  overallConfidence: number;
  keyContributions: string[];
  risks: string[];
  nextMonthSuggestions: string[];
  dataGaps: string[];
};

export const PERFORMANCE_AI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", const: PERFORMANCE_AI_SCHEMA_VERSION },
    staffId: { type: "integer" },
    yearMonth: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}$" },
    factsCutoffAt: { type: "string" },
    dimensions: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", enum: DIMENSIONS },
          applicable: { type: "boolean" },
          score: { type: ["number", "null"] },
          cap: { type: "number" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["dimension", "applicable", "score", "cap", "confidence", "reason", "evidenceIds"],
        additionalProperties: false,
      },
    },
    applicableMaximum: { type: "number" },
    totalScore: { type: "number" },
    normalizedScore: { type: ["number", "null"] },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
    keyContributions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    nextMonthSuggestions: { type: "array", items: { type: "string" } },
    dataGaps: { type: "array", items: { type: "string" } },
  },
  required: [
    "schemaVersion", "staffId", "yearMonth", "factsCutoffAt", "dimensions",
    "applicableMaximum", "totalScore", "normalizedScore", "overallConfidence",
    "keyContributions", "risks", "nextMonthSuggestions", "dataGaps",
  ],
  additionalProperties: false,
} as const;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeYearMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "月份格式必须为YYYY-MM" });
  }
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "月份无效" });
  }
  return value;
}

function normalizedScore(total: number, maximum: number): number | null {
  return maximum > 0 ? Math.round((total / maximum) * 1000) / 10 : null;
}

function sanitizeError(error: unknown): Record<string, unknown> {
  const message = String((error as any)?.message || error || "unknown error");
  return { name: String((error as any)?.name || "Error"), message: message.slice(0, 2000) };
}

function validateDimensions(dimensions: AiDimensionAssessment[]): AiDimensionAssessment[] {
  if (!Array.isArray(dimensions) || dimensions.length !== DIMENSIONS.length) {
    throw new Error("AI维度数量无效");
  }
  const byDimension = new Map(dimensions.map(row => [row.dimension, row]));
  if (byDimension.size !== DIMENSIONS.length || DIMENSIONS.some(dimension => !byDimension.has(dimension))) {
    throw new Error("AI维度必须唯一且完整");
  }
  return DIMENSIONS.map(dimension => {
    const row = byDimension.get(dimension)!;
    const cap = PERFORMANCE_DIMENSION_CAPS[dimension];
    if (Number(row.cap) !== cap) throw new Error(`AI维度上限不一致:${dimension}`);
    if (row.applicable && (row.score == null || Number(row.score) < 0 || Number(row.score) > cap)) {
      throw new Error(`AI维度分数越界:${dimension}`);
    }
    if (!row.applicable && row.score != null) throw new Error(`N/A维度不得有分数:${dimension}`);
    if (!Number.isFinite(Number(row.confidence)) || Number(row.confidence) < 0 || Number(row.confidence) > 1) {
      throw new Error(`AI置信度无效:${dimension}`);
    }
    return {
      ...row,
      cap,
      score: row.score == null ? null : Math.round(Number(row.score) * 10) / 10,
      confidence: Math.round(Number(row.confidence) * 10_000) / 10_000,
      evidenceIds: Array.isArray(row.evidenceIds) ? [...new Set(row.evidenceIds.map(String))] : [],
    };
  });
}

export function validateAiMonthlyAssessment(
  value: unknown,
  expected: { staffId: number; yearMonth: string; factsCutoffAt: string; allowedEvidenceIds: Set<string> },
): AiMonthlyAssessment {
  const row = value as AiMonthlyAssessment;
  if (!row || typeof row !== "object") throw new Error("AI结果不是对象");
  if (row.schemaVersion !== PERFORMANCE_AI_SCHEMA_VERSION) throw new Error("AI schema版本不一致");
  if (Number(row.staffId) !== expected.staffId || row.yearMonth !== expected.yearMonth) throw new Error("AI员工或月份不一致");
  if (row.factsCutoffAt !== expected.factsCutoffAt) throw new Error("AI事实截止时间不一致");
  const dimensions = validateDimensions(row.dimensions);
  const managerDimension = dimensions.find(dimension => dimension.dimension === "manager_evaluation");
  if (!managerDimension || managerDimension.applicable || managerDimension.score != null) {
    throw new Error("管理员评价维度必须由管理员填写，AI必须返回N/A");
  }
  for (const dimension of dimensions) {
    for (const evidenceId of dimension.evidenceIds) {
      if (!expected.allowedEvidenceIds.has(evidenceId)) throw new Error(`AI引用了不存在的证据:${evidenceId}`);
    }
  }
  const applicableMaximum = dimensions.filter(item => item.applicable).reduce((sum, item) => sum + item.cap, 0);
  const totalScore = Math.round(dimensions.reduce((sum, item) => sum + Number(item.score || 0), 0) * 10) / 10;
  const computedNormalized = normalizedScore(totalScore, applicableMaximum);
  if (Math.abs(Number(row.applicableMaximum) - applicableMaximum) > 0.1) throw new Error("AI适用上限不一致");
  if (Math.abs(Number(row.totalScore) - totalScore) > 0.1) throw new Error("AI总分不一致");
  if ((row.normalizedScore == null) !== (computedNormalized == null)
      || (computedNormalized != null && Math.abs(Number(row.normalizedScore) - computedNormalized) > 0.1)) {
    throw new Error("AI归一化总分不一致");
  }
  if (!Number.isFinite(Number(row.overallConfidence)) || Number(row.overallConfidence) < 0 || Number(row.overallConfidence) > 1) {
    throw new Error("AI总体置信度无效");
  }
  return {
    ...row,
    staffId: expected.staffId,
    yearMonth: expected.yearMonth,
    factsCutoffAt: expected.factsCutoffAt,
    dimensions,
    applicableMaximum,
    totalScore,
    normalizedScore: computedNormalized,
    overallConfidence: Math.round(Number(row.overallConfidence) * 10_000) / 10_000,
    keyContributions: Array.isArray(row.keyContributions) ? row.keyContributions.map(String).slice(0, 8) : [],
    risks: Array.isArray(row.risks) ? row.risks.map(String).slice(0, 8) : [],
    nextMonthSuggestions: Array.isArray(row.nextMonthSuggestions) ? row.nextMonthSuggestions.map(String).slice(0, 8) : [],
    dataGaps: Array.isArray(row.dataGaps) ? row.dataGaps.map(String).slice(0, 8) : [],
  };
}

async function appendAudit(
  executor: Pick<PerformanceDatabase, "execute">,
  access: PerformanceAccess,
  input: {
    requestId: string;
    entityType: string;
    entityId: string;
    action: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.execute(sql`
    INSERT INTO performance_audit_logs (
      requestId, actorUserId, actorStaffId, entityType, entityId,
      action, beforeState, afterState
    ) VALUES (
      ${input.requestId}, ${access.userId}, ${access.staffId}, ${input.entityType},
      ${input.entityId}, ${input.action}, ${JSON.stringify(input.beforeState || null)},
      ${JSON.stringify(input.afterState || null)}
    )
  `);
}

async function buildMonthlyEvidenceSnapshot(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  staffId: number,
  yearMonth: string,
) {
  const initialized = await ensurePerformanceInitialized(db, access.userId);
  assertCanViewPerformanceStaff(access, staffId);
  const [itemResult, responseResult, salesResult] = await Promise.all([
    db.execute(sql`
      SELECT item.id, item.evidenceKey, item.staffId, item.businessDate, item.sourceType,
        item.status, item.dueAt, item.completedAt, item.isOnTime,
        item.primaryDimension, item.dataQuality, item.completionRate,
        item.applicabilityStatus, template.templateCode, template.title
      FROM performance_item_instances item
      INNER JOIN performance_templates template ON template.id = item.templateId
      WHERE item.staffId = ${staffId}
        AND DATE_FORMAT(item.businessDate, '%Y-%m') = ${yearMonth}
      ORDER BY item.id
    `),
    db.execute(sql`
      SELECT id, factKey, channel, sourceType, sourceId, status, speedBand,
        responseMinutes, closureMinutes, applicable, exclusionReason
      FROM performance_response_facts
      WHERE staffId = ${staffId}
        AND DATE_FORMAT(businessDate, '%Y-%m') = ${yearMonth}
      ORDER BY id
    `),
    db.execute(sql`
      SELECT id, attributionKey, sourceType, sourceId, currency, amount, entryType,
        reliability, status, businessDate
      FROM performance_business_sales_attributions
      WHERE staffId = ${staffId}
        AND DATE_FORMAT(businessDate, '%Y-%m') = ${yearMonth}
        AND status = 'confirmed'
      ORDER BY id
    `),
  ]);
  const items = canonicalizePerformanceItems(rowsOf<any>(itemResult));
  const responses = rowsOf<any>(responseResult);
  const sales = rowsOf<any>(salesResult);
  const deterministicScore = buildDimensionRows(items, []);
  const applicableItems = items.filter(item => String(item.applicabilityStatus || "applicable") === "applicable"
    && !["exception", "cancelled", "source_error"].includes(String(item.status)));
  const verifiedItems = applicableItems.filter(item => String(item.dataQuality) === "verified");
  const applicableResponses = responses.filter(row => Boolean(Number(row.applicable)));
  const responded = applicableResponses.filter(row => row.responseMinutes != null);
  const averageResponseMinutes = responded.length > 0
    ? Math.round(responded.reduce((sum, row) => sum + Number(row.responseMinutes || 0), 0) / responded.length)
    : null;
  const salesByCurrency = new Map<string, { amount: number; count: number }>();
  for (const row of sales) {
    const currency = String(row.currency || "JPY").toUpperCase();
    const signed = String(row.entryType) === "reversal" ? -Number(row.amount || 0) : Number(row.amount || 0);
    const current = salesByCurrency.get(currency) || { amount: 0, count: 0 };
    salesByCurrency.set(currency, { amount: current.amount + signed, count: current.count + 1 });
  }
  const citations = [
    ...items.map(item => ({
      evidenceId: `item:${item.id}`,
      type: "performance_item",
      templateCode: String(item.templateCode),
      status: String(item.status),
      completionRate: item.completionRate == null ? null : Number(item.completionRate),
      dataQuality: String(item.dataQuality),
    })),
    ...responses.map(row => ({
      evidenceId: `response:${row.id}`,
      type: "response_fact",
      channel: String(row.channel),
      status: String(row.status),
      speedBand: String(row.speedBand),
      applicable: Boolean(Number(row.applicable)),
    })),
    ...sales.map(row => ({
      evidenceId: `sale:${row.id}`,
      type: "business_sale",
      currency: String(row.currency),
      amount: Number(row.amount || 0),
      reliability: String(row.reliability),
    })),
  ];
  const missingData = [
    ...(items.length === 0 ? [{ code: "no_item_facts", message: "本月没有岗位事项事实" }] : []),
    ...(responses.length === 0 ? [{ code: "no_response_facts", message: "本月没有可唯一归属的回复时效事实" }] : []),
    ...(sales.length === 0 ? [{ code: "no_attributed_sales", message: "本月没有已确认归属的商务销售额" }] : []),
  ];
  const factsCutoffAt = new Date().toISOString();
  const snapshotPayload = {
    schemaVersion: "performance-evidence-snapshot-v1",
    staffId,
    yearMonth,
    ruleVersionId: initialized.ruleVersionId,
    factsCutoffAt,
    deterministicScore,
    itemMetrics: {
      total: items.length,
      applicable: applicableItems.length,
      completedEquivalent: Math.round(applicableItems.reduce((sum, item) =>
        sum + (item.completionRate == null ? Number(String(item.status) === "completed") : Number(item.completionRate)), 0) * 10) / 10,
      verified: verifiedItems.length,
    },
    responseMetrics: {
      applicable: applicableResponses.length,
      responded: responded.length,
      pending: applicableResponses.filter(row => String(row.status) === "pending").length,
      averageResponseMinutes,
      within24Hours: responded.filter(row => ["within_2h", "within_8h", "within_24h"].includes(String(row.speedBand))).length,
      byChannel: Object.fromEntries(["line", "sales_email", "internal_chat", "issue"].map(channel => [
        channel,
        applicableResponses.filter(row => String(row.channel) === channel).length,
      ])),
      contentIncluded: false,
    },
    salesMetrics: {
      byCurrency: [...salesByCurrency.entries()].map(([currency, value]) => ({ currency, ...value })),
      confirmedCount: sales.length,
      totalGmvAllocated: false,
    },
    citations,
    missingData,
  };
  const hashPayload = { ...snapshotPayload, factsCutoffAt: undefined };
  const inputHash = createHash("sha256").update(stableJson(hashPayload)).digest("hex");
  const latest = rowsOf<any>(await db.execute(sql`
    SELECT * FROM performance_monthly_evidence_snapshots
    WHERE staffId = ${staffId} AND yearMonth = ${yearMonth}
    ORDER BY version DESC LIMIT 1
  `))[0];
  if (latest && String(latest.inputHash) === inputHash) {
    const storedCutoff = new Date(latest.factsCutoffAt);
    return {
      ...latest,
      snapshot: {
        ...snapshotPayload,
        factsCutoffAt: Number.isNaN(storedCutoff.getTime()) ? String(latest.factsCutoffAt) : storedCutoff.toISOString(),
      },
      id: Number(latest.id),
      version: Number(latest.version),
    };
  }
  const version = Number(latest?.version || 0) + 1;
  const snapshotKey = `${staffId}:${yearMonth}:${version}:${inputHash.slice(0, 16)}`;
  const completenessBase = applicableItems.length + applicableResponses.length;
  const completenessNumerator = verifiedItems.length + applicableResponses.filter(row => row.responseMinutes != null || String(row.status) === "closed").length;
  const dataCompleteness = completenessBase > 0 ? Math.round((completenessNumerator / completenessBase) * 10_000) / 10_000 : 0;
  const inserted = await db.execute(sql`
    INSERT INTO performance_monthly_evidence_snapshots (
      snapshotKey, staffId, yearMonth, version, ruleVersionId, factsCutoffAt, inputHash,
      dimensionScoresJson, applicableMaximum, shadowScore, normalizedScore,
      dataCompleteness, itemMetricsJson, responseMetricsJson, salesMetricsJson,
      citationsJson, missingDataJson, createdByUserId
    ) VALUES (
      ${snapshotKey}, ${staffId}, ${yearMonth}, ${version}, ${initialized.ruleVersionId},
      ${new Date(factsCutoffAt)}, ${inputHash}, ${JSON.stringify(deterministicScore.dimensions)},
      ${deterministicScore.applicableMaximum}, ${deterministicScore.shadowScore},
      ${deterministicScore.normalizedScore}, ${dataCompleteness},
      ${JSON.stringify(snapshotPayload.itemMetrics)}, ${JSON.stringify(snapshotPayload.responseMetrics)},
      ${JSON.stringify(snapshotPayload.salesMetrics)}, ${JSON.stringify(citations)},
      ${JSON.stringify(missingData)}, ${access.userId}
    )
  `);
  return { id: Number((inserted as any)?.[0]?.insertId || 0), version, inputHash, snapshot: snapshotPayload };
}

function buildPrompt(snapshot: any): string {
  return [
    "你是LCJ员工月度绩效的独立AI评估员。只能根据给定的结构化事实评分，不得猜测。",
    "规则：没有证据的维度必须设为applicable=false且score=null；manager_evaluation永远设为N/A。",
    "完成度、及时性、准确闭环必须尊重确定性事实；回复时效只使用responseMetrics，普通群聊沉默已排除。",
    "商务销售只使用salesMetrics中的已确认归属记录；不得把店铺总GMV或直播GMV分摊给个人。",
    "建议应具体、可执行、面向下月，不得提及工资、奖金或LCJ Coin。",
    `各维度上限：${JSON.stringify(PERFORMANCE_DIMENSION_CAPS)}`,
    `证据快照：${JSON.stringify(snapshot)}`,
  ].join("\n");
}

export async function generatePerformanceAiAssessment(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { staffId: number; yearMonth: string; requestId: string; regenerate?: boolean },
) {
  const yearMonth = normalizeYearMonth(input.yearMonth);
  assertCanReviewPerformanceStaff(access, input.staffId);
  const snapshot = await buildMonthlyEvidenceSnapshot(db, access, input.staffId, yearMonth);
  const existing = rowsOf<any>(await db.execute(sql`
    SELECT * FROM performance_ai_monthly_assessments
    WHERE staffId = ${input.staffId} AND yearMonth = ${yearMonth}
      AND evidenceSnapshotId = ${Number(snapshot.id)} AND status = 'succeeded'
    ORDER BY version DESC LIMIT 1
  `))[0];
  if (existing && !input.regenerate) return normalizeAiAssessmentRow(existing);

  const latest = rowsOf<any>(await db.execute(sql`
    SELECT version FROM performance_ai_monthly_assessments
    WHERE staffId = ${input.staffId} AND yearMonth = ${yearMonth}
    ORDER BY version DESC LIMIT 1
  `))[0];
  const version = Number(latest?.version || 0) + 1;
  const inserted = await db.execute(sql`
    INSERT INTO performance_ai_monthly_assessments (
      staffId, yearMonth, evidenceSnapshotId, version, modelId, promptVersion,
      status, retryCount, generatedByUserId
    ) VALUES (
      ${input.staffId}, ${yearMonth}, ${Number(snapshot.id)}, ${version},
      ${PERFORMANCE_AI_MODEL}, ${PERFORMANCE_AI_PROMPT_VERSION}, 'generating', 0, ${access.userId}
    )
  `);
  const assessmentId = Number((inserted as any)?.[0]?.insertId || 0);
  const allowedEvidenceIds = new Set<string>((snapshot.snapshot.citations || []).map((row: any) => String(row.evidenceId)));
  let rawOutput = "";
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await invokeLLM({
        model: PERFORMANCE_AI_MODEL,
        messages: [
          {
            role: "system",
            content: "你是严格、保守、可审计的员工绩效评估AI。只输出JSON，不得使用输入之外的信息，不得自动产生奖金、工资、积分或惩罚决定。",
          },
          {
            role: "user",
            content: attempt === 0
              ? buildPrompt(snapshot.snapshot)
              : `${buildPrompt(snapshot.snapshot)}\n上一次输出未通过结构或证据校验。请严格按Schema重新输出，不得添加字段。`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "performance_monthly_assessment",
            strict: true,
            schema: PERFORMANCE_AI_RESPONSE_SCHEMA,
          },
        },
      });
      rawOutput = String(response.choices?.[0]?.message?.content || "");
      if (!rawOutput) throw new Error("AI返回空内容");
      const parsed = JSON.parse(rawOutput);
      const validated = validateAiMonthlyAssessment(parsed, {
        staffId: input.staffId,
        yearMonth,
        factsCutoffAt: snapshot.snapshot.factsCutoffAt,
        allowedEvidenceIds,
      });
      await db.execute(sql`
        UPDATE performance_ai_monthly_assessments
        SET status = 'succeeded', rawOutput = ${rawOutput}, structuredJson = ${JSON.stringify(validated)},
          errorJson = NULL, retryCount = ${attempt}, generatedAt = NOW()
        WHERE id = ${assessmentId}
      `);
      await appendAudit(db, access, {
        requestId: input.requestId,
        entityType: "ai_monthly_assessment",
        entityId: String(assessmentId),
        action: "generate_succeeded",
        afterState: {
          staffId: input.staffId,
          yearMonth,
          version,
          modelId: PERFORMANCE_AI_MODEL,
          promptVersion: PERFORMANCE_AI_PROMPT_VERSION,
          evidenceSnapshotId: Number(snapshot.id),
          retryCount: attempt,
          status: "succeeded",
        },
      });
      return {
        id: assessmentId,
        staffId: input.staffId,
        yearMonth,
        version,
        modelId: PERFORMANCE_AI_MODEL,
        promptVersion: PERFORMANCE_AI_PROMPT_VERSION,
        status: "succeeded",
        structured: validated,
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }
  const errorJson = sanitizeError(lastError);
  await db.execute(sql`
    UPDATE performance_ai_monthly_assessments
    SET status = 'failed', rawOutput = ${rawOutput || null}, errorJson = ${JSON.stringify(errorJson)},
      retryCount = 1, generatedAt = NOW()
    WHERE id = ${assessmentId}
  `);
  await appendAudit(db, access, {
    requestId: input.requestId,
    entityType: "ai_monthly_assessment",
    entityId: String(assessmentId),
    action: "generate_failed",
    afterState: {
      staffId: input.staffId,
      yearMonth,
      version,
      modelId: PERFORMANCE_AI_MODEL,
      promptVersion: PERFORMANCE_AI_PROMPT_VERSION,
      evidenceSnapshotId: Number(snapshot.id),
      retryCount: 1,
      status: "failed",
      error: errorJson,
    },
  });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI月度评分生成失败；原影子分和既有数据未受影响" });
}

function normalizeAiAssessmentRow(row: any) {
  return {
    ...row,
    id: Number(row.id),
    staffId: Number(row.staffId),
    evidenceSnapshotId: Number(row.evidenceSnapshotId),
    version: Number(row.version),
    retryCount: Number(row.retryCount || 0),
    structured: parseJson<AiMonthlyAssessment | null>(row.structuredJson, null),
    error: parseJson<Record<string, unknown> | null>(row.errorJson, null),
  };
}

function normalizeManagerReviewRow(row: any) {
  return {
    ...row,
    id: Number(row.id),
    staffId: Number(row.staffId),
    version: Number(row.version),
    aiAssessmentId: row.aiAssessmentId ? Number(row.aiAssessmentId) : null,
    submittedByStaffId: Number(row.submittedByStaffId),
    secondReviewerStaffId: row.secondReviewerStaffId ? Number(row.secondReviewerStaffId) : null,
    supersedesReviewId: row.supersedesReviewId ? Number(row.supersedesReviewId) : null,
    dimensionScores: parseJson<Record<string, unknown>>(row.dimensionScoresJson, {}),
    applicableMaximum: Number(row.applicableMaximum || 0),
    finalScore: Number(row.finalScore || 0),
    normalizedScore: Number(row.normalizedScore || 0),
  };
}

export async function getPerformanceMonthlyAssessment(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { staffId?: number; yearMonth: string },
) {
  await ensurePerformanceInitialized(db, access.userId);
  const staffId = input.staffId || requirePerformanceStaff(access);
  assertCanViewPerformanceStaff(access, staffId);
  const yearMonth = normalizeYearMonth(input.yearMonth);
  const [aiResult, reviewResult, snapshotResult] = await Promise.all([
    db.execute(sql`
      SELECT id, staffId, yearMonth, evidenceSnapshotId, version, modelId, promptVersion,
        status, structuredJson, errorJson, retryCount, generatedAt, createdAt
      FROM performance_ai_monthly_assessments
      WHERE staffId = ${staffId} AND yearMonth = ${yearMonth}
      ORDER BY version DESC
    `),
    db.execute(sql`
      SELECT * FROM performance_manager_monthly_reviews
      WHERE staffId = ${staffId} AND yearMonth = ${yearMonth}
      ORDER BY version DESC
    `),
    db.execute(sql`
      SELECT id, version, factsCutoffAt, inputHash, dimensionScoresJson, applicableMaximum,
        shadowScore, normalizedScore, dataCompleteness, itemMetricsJson,
        responseMetricsJson, salesMetricsJson, citationsJson, missingDataJson, createdAt
      FROM performance_monthly_evidence_snapshots
      WHERE staffId = ${staffId} AND yearMonth = ${yearMonth}
      ORDER BY version DESC LIMIT 1
    `),
  ]);
  const snapshots = rowsOf<any>(snapshotResult);
  return {
    staffId,
    yearMonth,
    currentAi: rowsOf<any>(aiResult).map(normalizeAiAssessmentRow).find(row => row.status === "succeeded") || null,
    aiHistory: rowsOf<any>(aiResult).map(normalizeAiAssessmentRow),
    currentManagerReview: rowsOf<any>(reviewResult).map(normalizeManagerReviewRow).find(row => row.status === "locked") || null,
    managerReviewHistory: rowsOf<any>(reviewResult).map(normalizeManagerReviewRow),
    latestEvidenceSnapshot: snapshots[0] ? {
      ...snapshots[0],
      id: Number(snapshots[0].id),
      version: Number(snapshots[0].version),
      applicableMaximum: Number(snapshots[0].applicableMaximum || 0),
      shadowScore: Number(snapshots[0].shadowScore || 0),
      normalizedScore: snapshots[0].normalizedScore == null ? null : Number(snapshots[0].normalizedScore),
      dataCompleteness: Number(snapshots[0].dataCompleteness || 0),
      dimensions: parseJson(snapshots[0].dimensionScoresJson, []),
      itemMetrics: parseJson(snapshots[0].itemMetricsJson, {}),
      responseMetrics: parseJson(snapshots[0].responseMetricsJson, {}),
      salesMetrics: parseJson(snapshots[0].salesMetricsJson, {}),
      citations: parseJson(snapshots[0].citationsJson, []),
      missingData: parseJson(snapshots[0].missingDataJson, []),
    } : null,
    safety: {
      aiIsAdvisoryOnly: true,
      administratorFinalScoreSeparate: true,
      writesLedger: false,
      impactsBonus: false,
      impactsLcjCoin: false,
    },
  };
}

export type ManagerDimensionInput = {
  dimension: PerformanceDimension;
  applicable: boolean;
  score: number | null;
};

function validateManagerDimensions(input: ManagerDimensionInput[]) {
  if (!Array.isArray(input) || input.length !== DIMENSIONS.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "必须提交全部六个评分维度" });
  }
  const map = new Map(input.map(row => [row.dimension, row]));
  if (map.size !== DIMENSIONS.length || DIMENSIONS.some(dimension => !map.has(dimension))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "评分维度重复或缺失" });
  }
  const dimensions = DIMENSIONS.map(dimension => {
    const row = map.get(dimension)!;
    const cap = PERFORMANCE_DIMENSION_CAPS[dimension];
    if (row.applicable && (row.score == null || !Number.isFinite(Number(row.score)) || Number(row.score) < 0 || Number(row.score) > cap)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${PERFORMANCE_DIMENSION_LABELS[dimension]}分数必须在0-${cap}之间` });
    }
    if (!row.applicable && row.score != null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${PERFORMANCE_DIMENSION_LABELS[dimension]}不适用时不得填写分数` });
    }
    return { dimension, applicable: row.applicable, score: row.score == null ? null : Math.round(Number(row.score) * 10) / 10, cap };
  });
  const applicableMaximum = dimensions.filter(row => row.applicable).reduce((sum, row) => sum + row.cap, 0);
  const finalScore = Math.round(dimensions.reduce((sum, row) => sum + Number(row.score || 0), 0) * 10) / 10;
  const normalized = normalizedScore(finalScore, applicableMaximum);
  if (normalized == null) throw new TRPCError({ code: "BAD_REQUEST", message: "至少一个维度必须适用" });
  return { dimensions, applicableMaximum, finalScore, normalizedScore: normalized };
}

export async function submitManagerMonthlyReview(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    staffId: number;
    yearMonth: string;
    aiAssessmentId: number;
    dimensions: ManagerDimensionInput[];
    overallReason: string;
    differenceReason?: string | null;
    appealId?: number | null;
    requestId: string;
  },
) {
  const reviewerStaffId = requirePerformanceStaff(access);
  const yearMonth = normalizeYearMonth(input.yearMonth);
  assertCanReviewPerformanceStaff(access, input.staffId);
  const score = validateManagerDimensions(input.dimensions);
  const overallReason = input.overallReason.trim();
  if (overallReason.length < 10) throw new TRPCError({ code: "BAD_REQUEST", message: "月末终评理由至少10个字符" });
  const ai = rowsOf<any>(await db.execute(sql`
    SELECT id, staffId, yearMonth, status, structuredJson
    FROM performance_ai_monthly_assessments WHERE id = ${input.aiAssessmentId} LIMIT 1
  `))[0];
  if (!ai) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "管理员终评前必须先生成AI独立月评" });
  }
  if (Number(ai.staffId) !== input.staffId || String(ai.yearMonth) !== yearMonth || String(ai.status) !== "succeeded") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "AI评分版本与员工或月份不一致" });
  }
  const aiStructured = parseJson<AiMonthlyAssessment | null>(ai.structuredJson, null);
  if (!aiStructured) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "AI月评结构化结果无效，不能提交管理员终评" });
  }
  const aiDimensions = new Map((aiStructured?.dimensions || []).map(row => [row.dimension, row]));
  let maximumDimensionDelta = 0;
  let maximumDimensionDeltaRatio = 0;
  for (const row of score.dimensions) {
    const aiRow = aiDimensions.get(row.dimension);
    if (!row.applicable || row.score == null || !aiRow?.applicable || aiRow.score == null) continue;
    const delta = Math.abs(row.score - Number(aiRow.score));
    maximumDimensionDelta = Math.max(maximumDimensionDelta, delta);
    maximumDimensionDeltaRatio = Math.max(maximumDimensionDeltaRatio, delta / row.cap);
  }
  const needsDifferenceReason = shouldRequireManagerDifferenceReason({
    aiNormalizedScore: aiStructured?.normalizedScore ?? null,
    managerNormalizedScore: score.normalizedScore,
    maximumDimensionDelta,
  });
  if (needsDifferenceReason && String(input.differenceReason || "").trim().length < 10) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "与AI评分差异较大，必须填写至少10个字符的差异理由" });
  }
  const needsSecondReview = shouldRequireMonthlyReviewSecondApproval({
    aiNormalizedScore: aiStructured?.normalizedScore ?? null,
    managerNormalizedScore: score.normalizedScore,
    maximumDimensionDeltaRatio,
  });
  return db.transaction(async tx => {
    const latest = rowsOf<any>(await tx.execute(sql`
      SELECT * FROM performance_manager_monthly_reviews
      WHERE staffId = ${input.staffId} AND yearMonth = ${yearMonth}
      ORDER BY version DESC LIMIT 1 FOR UPDATE
    `))[0];
    if (latest && !["locked", "rejected"].includes(String(latest.status))) {
      throw new TRPCError({ code: "CONFLICT", message: "已有待审核的月末终评版本" });
    }
    if (input.appealId) {
      const appeal = rowsOf<any>(await tx.execute(sql`
        SELECT id FROM performance_appeals
        WHERE id = ${input.appealId} AND staffId = ${input.staffId}
          AND managerReviewId IS NOT NULL AND status = 'accepted'
        LIMIT 1
      `))[0];
      if (!appeal) throw new TRPCError({ code: "BAD_REQUEST", message: "终评修订必须关联已接受的申诉" });
    }
    const version = Number(latest?.version || 0) + 1;
    const status = needsSecondReview ? "pending_second_review" : "locked";
    const inserted = await tx.execute(sql`
      INSERT INTO performance_manager_monthly_reviews (
        staffId, yearMonth, version, aiAssessmentId, dimensionScoresJson,
        applicableMaximum, finalScore, normalizedScore, overallReason,
        differenceReason, status, submittedByStaffId, supersedesReviewId,
        appealId, submittedAt, lockedAt
      ) VALUES (
        ${input.staffId}, ${yearMonth}, ${version}, ${input.aiAssessmentId || null},
        ${JSON.stringify(score.dimensions)}, ${score.applicableMaximum}, ${score.finalScore},
        ${score.normalizedScore}, ${overallReason}, ${String(input.differenceReason || "").trim() || null},
        ${status}, ${reviewerStaffId}, ${latest?.id ? Number(latest.id) : null},
        ${input.appealId || null}, NOW(), ${status === "locked" ? new Date() : null}
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = {
      id,
      staffId: input.staffId,
      yearMonth,
      version,
      aiAssessmentId: input.aiAssessmentId,
      applicableMaximum: score.applicableMaximum,
      finalScore: score.finalScore,
      normalizedScore: score.normalizedScore,
      status,
      needsSecondReview,
      maximumDimensionDelta,
    };
    await appendAudit(tx as any, access, {
      requestId: input.requestId,
      entityType: "manager_monthly_review",
      entityId: String(id),
      action: latest ? "submit_revision" : "submit",
      beforeState: latest || null,
      afterState,
    });
    return { ...afterState, dimensions: score.dimensions };
  });
}

export async function reviewManagerMonthlyReview(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { reviewId: number; decision: "approve" | "reject"; reason: string; requestId: string },
) {
  const reviewerStaffId = requirePerformanceStaff(access);
  return db.transaction(async tx => {
    const review = rowsOf<any>(await tx.execute(sql`
      SELECT * FROM performance_manager_monthly_reviews WHERE id = ${input.reviewId} FOR UPDATE
    `))[0];
    if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "月末终评不存在" });
    assertCanReviewPerformanceStaff(access, Number(review.staffId));
    if (String(review.status) !== "pending_second_review") {
      throw new TRPCError({ code: "CONFLICT", message: "该月末终评不在二审状态" });
    }
    if (Number(review.submittedByStaffId) === reviewerStaffId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "第一审核人不能进行二审" });
    }
    const reason = input.reason.trim();
    if (reason.length < 5) throw new TRPCError({ code: "BAD_REQUEST", message: "二审理由至少5个字符" });
    const status = input.decision === "approve" ? "locked" : "rejected";
    await tx.execute(sql`
      UPDATE performance_manager_monthly_reviews
      SET status = ${status}, secondReviewerStaffId = ${reviewerStaffId},
        secondReviewReason = ${reason}, secondReviewedAt = NOW(),
        lockedAt = ${status === "locked" ? new Date() : null}
      WHERE id = ${input.reviewId}
    `);
    const afterState = { reviewId: input.reviewId, status, secondReviewerStaffId: reviewerStaffId };
    await appendAudit(tx as any, access, {
      requestId: input.requestId,
      entityType: "manager_monthly_review",
      entityId: String(input.reviewId),
      action: `second_review_${input.decision}`,
      beforeState: review,
      afterState,
    });
    return afterState;
  });
}
