export const LCJ_BRAIN_PROJECT_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export type LcjBrainProjectStatus = (typeof LCJ_BRAIN_PROJECT_STATUSES)[number];

export function projectCollaborationAccess(input: {
  actorId: number;
  isSuperAdmin: boolean;
  ownerUserId: number;
  createdBy: number;
  memberUserIds: readonly number[];
  status: LcjBrainProjectStatus;
}) {
  const memberUserIds = new Set(
    input.memberUserIds.filter(value => Number.isInteger(value) && value > 0)
  );
  const isOwner =
    input.actorId === input.ownerUserId || input.actorId === input.createdBy;
  const isAssignedMember = memberUserIds.has(input.actorId);
  const isParticipant = input.isSuperAdmin || isOwner || isAssignedMember;
  const participationOpen = input.status !== "archived";
  return {
    canView: true,
    canManage: input.isSuperAdmin || isOwner,
    canAddSource: isParticipant && participationOpen,
    isOwner,
    isParticipant,
    canJoin: participationOpen && !isParticipant,
    canLeave:
      participationOpen && !isOwner && !input.isSuperAdmin && isAssignedMember,
  };
}

export const LCJ_BRAIN_PROJECT_SOURCE_TYPES = [
  "meeting",
  "daily_report",
  "task",
  "issue",
  "knowledge",
  "file",
  "note",
  "decision",
] as const;
export type LcjBrainProjectSourceType =
  (typeof LCJ_BRAIN_PROJECT_SOURCE_TYPES)[number];

export const LCJ_BRAIN_SOP_PROMPT_VERSION = "2026-09-17.v2";

export type LcjBrainSopGenerationMetadata = {
  mode: "full" | "incremental";
  baseVersionId: number | null;
  includedSourceIds: number[];
  newSourceIds: number[];
  removedSourceIds: number[];
  generatedAt: string;
};

function validSourceIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 0)
    ),
  ].sort((a, b) => a - b);
}

export function readSopGenerationMetadata(
  input: unknown
): LcjBrainSopGenerationMetadata | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)._generation;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const mode =
    row.mode === "incremental"
      ? "incremental"
      : row.mode === "full"
        ? "full"
        : null;
  const generatedAt =
    typeof row.generatedAt === "string" ? row.generatedAt : "";
  if (!mode || !generatedAt) return null;
  const baseVersionId =
    row.baseVersionId === null ? null : Number(row.baseVersionId);
  if (
    baseVersionId !== null &&
    (!Number.isInteger(baseVersionId) || baseVersionId <= 0)
  )
    return null;
  return {
    mode,
    baseVersionId,
    includedSourceIds: validSourceIds(row.includedSourceIds),
    newSourceIds: validSourceIds(row.newSourceIds),
    removedSourceIds: validSourceIds(row.removedSourceIds),
    generatedAt,
  };
}

export function pendingSopSourceIds(
  allSourceIds: readonly number[],
  includedSourceIds: readonly number[]
): number[] {
  const included = new Set(validSourceIds(includedSourceIds));
  return validSourceIds(allSourceIds).filter(
    sourceId => !included.has(sourceId)
  );
}

export function attachSopGenerationMetadata(
  content: unknown,
  metadata: LcjBrainSopGenerationMetadata
): Record<string, unknown> {
  const base =
    content && typeof content === "object" && !Array.isArray(content)
      ? { ...(content as Record<string, unknown>) }
      : {};
  return { ...base, _generation: metadata };
}

export function stripSopGenerationMetadata(
  input: unknown
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const { _generation: _ignored, ...content } = input as Record<
    string,
    unknown
  >;
  return content;
}

function clearSopHistory(value: unknown, key = ""): unknown {
  if (key === "sourceRefs" || key === "sourceIndex") return [];
  if (key === "gaps" || key === "unresolvedQuestions") return [];
  if (key === "owner") return null;
  if (Array.isArray(value)) return value.map(entry => clearSopHistory(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([childKey]) => childKey !== "_generation")
        .map(([childKey, childValue]) => [
          childKey,
          clearSopHistory(childValue, childKey),
        ])
    );
  }
  return value;
}

export function buildReusableSopTemplateContent(
  input: unknown
): Record<string, unknown> {
  const content = clearSopHistory(input);
  return content && typeof content === "object" && !Array.isArray(content)
    ? (content as Record<string, unknown>)
    : {};
}

export function applyReusableSopTemplateContent(
  input: unknown,
  projectName: string
): Record<string, unknown> {
  return {
    ...buildReusableSopTemplateContent(input),
    title: `${projectName.trim() || "新项目"} SOP`,
  };
}

export function buildReusableProjectMilestones(input: unknown): Array<{
  id: string;
  title: string;
  status: "pending";
}> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const title = String(
        (entry as Record<string, unknown>).title || ""
      ).trim();
      if (!title) return null;
      return {
        id: `template-${index + 1}`,
        title: title.slice(0, 255),
        status: "pending" as const,
      };
    })
    .filter(
      (entry): entry is { id: string; title: string; status: "pending" } =>
        entry !== null
    )
    .slice(0, 100);
}

const STATUS_TRANSITIONS: Record<
  LcjBrainProjectStatus,
  readonly LcjBrainProjectStatus[]
> = {
  draft: ["active", "archived"],
  active: ["completed", "archived"],
  completed: ["active", "archived"],
  archived: ["active"],
};

export function canTransitionProjectStatus(
  from: LcjBrainProjectStatus,
  to: LcjBrainProjectStatus
): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

export function normalizeProjectKeywords(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map(value => value.trim().toLocaleLowerCase())
        .filter(value => value.length >= 2)
    ),
  ].slice(0, 30);
}

export function normalizeNumericIds(values: readonly number[]): number[] {
  return [
    ...new Set(values.filter(value => Number.isInteger(value) && value > 0)),
  ].slice(0, 200);
}

export function todayInTokyo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dateTimeInTokyo(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
}

export function isDateWithinProject(
  dateKey: string,
  startDate: string,
  endDate?: string | null
): boolean {
  return dateKey >= startDate && (!endDate || dateKey <= endDate);
}

export type AutoCollectCandidate = {
  occurredDate: string;
  text: string;
  personIds?: number[];
  personNames?: string[];
};

export type AutoCollectProjectScope = {
  startDate: string;
  endDate?: string | null;
  keywords: string[];
  memberUserIds: number[];
  memberStaffIds: number[];
  memberNames?: string[];
  mode: "strict" | "member_only";
};

export function matchAutoCollectCandidate(
  scope: AutoCollectProjectScope,
  candidate: AutoCollectCandidate
): { matched: boolean; reason: string; keywordHits: string[] } {
  if (
    !isDateWithinProject(candidate.occurredDate, scope.startDate, scope.endDate)
  ) {
    return { matched: false, reason: "日期不在项目周期内", keywordHits: [] };
  }
  const keywords = normalizeProjectKeywords(scope.keywords);
  const haystack = candidate.text.toLocaleLowerCase();
  const keywordHits = keywords.filter(keyword => haystack.includes(keyword));
  const allowedIds = new Set([
    ...normalizeNumericIds(scope.memberUserIds),
    ...normalizeNumericIds(scope.memberStaffIds),
  ]);
  const memberById = (candidate.personIds || []).some(id => allowedIds.has(id));
  const memberNames = new Set(
    (scope.memberNames || [])
      .map(name => name.trim().toLocaleLowerCase())
      .filter(Boolean)
  );
  const memberByName = (candidate.personNames || []).some(name =>
    memberNames.has(name.trim().toLocaleLowerCase())
  );
  const memberMatched = memberById || memberByName;

  if (scope.mode === "member_only") {
    if (memberMatched)
      return { matched: true, reason: "项目成员匹配（宽松模式）", keywordHits };
    return { matched: false, reason: "未匹配项目成员", keywordHits };
  }
  if (!keywords.length)
    return {
      matched: false,
      reason: "严格模式尚未配置关键词",
      keywordHits: [],
    };
  if (![...allowedIds].length && !memberNames.size)
    return { matched: false, reason: "严格模式尚未配置项目成员", keywordHits };
  if (memberMatched && keywordHits.length) {
    return {
      matched: true,
      reason: `成员与关键词同时匹配：${keywordHits.join("、")}`,
      keywordHits,
    };
  }
  return {
    matched: false,
    reason: !memberMatched ? "未匹配项目成员" : "未命中项目关键词",
    keywordHits,
  };
}

export function buildProjectSourceKey(
  type: LcjBrainProjectSourceType,
  sourceId: string | number,
  suffix?: string
): string {
  const safeId = String(sourceId)
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "_")
    .slice(0, 160);
  const safeSuffix = suffix
    ?.trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "_")
    .slice(0, 50);
  return [type, safeId || "unknown", safeSuffix].filter(Boolean).join(":");
}

export function collectValidSourceRefs(
  input: unknown,
  allowedSourceIds: readonly number[]
): number[] {
  const allowed = new Set(allowedSourceIds);
  const found = new Set<number>();
  const visit = (value: unknown, key = "") => {
    if (Array.isArray(value)) {
      if (key === "sourceRefs") {
        for (const entry of value)
          if (Number.isInteger(entry) && allowed.has(Number(entry)))
            found.add(Number(entry));
      } else {
        for (const entry of value) visit(entry);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value))
        visit(childValue, childKey);
    }
  };
  visit(input);
  return [...found].sort((a, b) => a - b);
}

export function hasUnknownSourceRefs(
  input: unknown,
  allowedSourceIds: readonly number[]
): boolean {
  const allowed = new Set(allowedSourceIds);
  let invalid = false;
  const visit = (value: unknown, key = "") => {
    if (invalid) return;
    if (Array.isArray(value)) {
      if (key === "sourceRefs") {
        invalid = value.some(
          entry => !Number.isInteger(entry) || !allowed.has(Number(entry))
        );
      } else {
        value.forEach(entry => visit(entry));
      }
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) =>
        visit(childValue, childKey)
      );
    }
  };
  visit(input);
  return invalid;
}

const stringArraySchema = { type: "array", items: { type: "string" } } as const;
const sourceRefsSchema = { type: "array", items: { type: "integer" } } as const;

export const LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA = {
  name: "lcj_brain_project_daily_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      completedItems: stringArraySchema,
      decisions: stringArraySchema,
      issues: stringArraySchema,
      risks: stringArraySchema,
      nextActions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: { type: "string" },
            owner: { anyOf: [{ type: "string" }, { type: "null" }] },
            dueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["action", "owner", "dueDate"],
        },
      },
      gaps: stringArraySchema,
      sourceIds: sourceRefsSchema,
    },
    required: [
      "summary",
      "completedItems",
      "decisions",
      "issues",
      "risks",
      "nextActions",
      "gaps",
      "sourceIds",
    ],
  },
} as const;

const evidenceSectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    sourceRefs: sourceRefsSchema,
  },
  required: ["text", "sourceRefs"],
} as const;

export const LCJ_BRAIN_SOP_JSON_SCHEMA = {
  name: "lcj_brain_project_sop",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      objective: evidenceSectionSchema,
      scope: evidenceSectionSchema,
      roles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string" },
            responsibility: { type: "string" },
            sourceRefs: sourceRefsSchema,
          },
          required: ["role", "responsibility", "sourceRefs"],
        },
      },
      prerequisites: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            item: { type: "string" },
            sourceRefs: sourceRefsSchema,
          },
          required: ["item", "sourceRefs"],
        },
      },
      phases: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            goal: { type: "string" },
            sourceRefs: sourceRefsSchema,
            steps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  order: { type: "integer" },
                  action: { type: "string" },
                  owner: { anyOf: [{ type: "string" }, { type: "null" }] },
                  inputs: stringArraySchema,
                  outputs: stringArraySchema,
                  completionCriteria: stringArraySchema,
                  cautions: stringArraySchema,
                  sourceRefs: sourceRefsSchema,
                },
                required: [
                  "order",
                  "action",
                  "owner",
                  "inputs",
                  "outputs",
                  "completionCriteria",
                  "cautions",
                  "sourceRefs",
                ],
              },
            },
          },
          required: ["name", "goal", "sourceRefs", "steps"],
        },
      },
      checklists: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            items: stringArraySchema,
            sourceRefs: sourceRefsSchema,
          },
          required: ["name", "items", "sourceRefs"],
        },
      },
      exceptionHandling: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            situation: { type: "string" },
            response: { type: "string" },
            sourceRefs: sourceRefsSchema,
          },
          required: ["situation", "response", "sourceRefs"],
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            risk: { type: "string" },
            mitigation: { type: "string" },
            sourceRefs: sourceRefsSchema,
          },
          required: ["risk", "mitigation", "sourceRefs"],
        },
      },
      lessonsLearned: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            lesson: { type: "string" },
            sourceRefs: sourceRefsSchema,
          },
          required: ["lesson", "sourceRefs"],
        },
      },
      gaps: stringArraySchema,
      unresolvedQuestions: stringArraySchema,
      sourceIndex: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sourceId: { type: "integer" },
            label: { type: "string" },
          },
          required: ["sourceId", "label"],
        },
      },
    },
    required: [
      "title",
      "objective",
      "scope",
      "roles",
      "prerequisites",
      "phases",
      "checklists",
      "exceptionHandling",
      "risks",
      "lessonsLearned",
      "gaps",
      "unresolvedQuestions",
      "sourceIndex",
    ],
  },
} as const;

export function sopContentToMarkdown(content: any): string {
  const refs = (ids: unknown) =>
    Array.isArray(ids) && ids.length
      ? `\n\n来源：${ids.map(id => `[S${id}]`).join(" ")}`
      : "";
  const lines: string[] = [`# ${content.title || "项目SOP"}`];
  lines.push(
    `\n## 目标\n\n${content.objective?.text || ""}${refs(content.objective?.sourceRefs)}`
  );
  lines.push(
    `\n## 适用范围\n\n${content.scope?.text || ""}${refs(content.scope?.sourceRefs)}`
  );
  lines.push("\n## 角色与职责");
  for (const item of content.roles || [])
    lines.push(
      `\n- **${item.role}**：${item.responsibility}${refs(item.sourceRefs)}`
    );
  lines.push("\n## 前置条件");
  for (const item of content.prerequisites || [])
    lines.push(`\n- ${item.item}${refs(item.sourceRefs)}`);
  lines.push("\n## 操作流程");
  for (const phase of content.phases || []) {
    lines.push(`\n### ${phase.name}\n\n${phase.goal}${refs(phase.sourceRefs)}`);
    for (const step of phase.steps || []) {
      lines.push(
        `\n${step.order}. **${step.action}**${step.owner ? `（负责人：${step.owner}）` : ""}`
      );
      if (step.inputs?.length)
        lines.push(`\n   - 输入：${step.inputs.join("；")}`);
      if (step.outputs?.length)
        lines.push(`\n   - 输出：${step.outputs.join("；")}`);
      if (step.completionCriteria?.length)
        lines.push(`\n   - 完成标准：${step.completionCriteria.join("；")}`);
      if (step.cautions?.length)
        lines.push(`\n   - 注意：${step.cautions.join("；")}`);
      lines.push(refs(step.sourceRefs));
    }
  }
  lines.push("\n## 检查清单");
  for (const group of content.checklists || [])
    lines.push(
      `\n### ${group.name}\n${(group.items || []).map((item: string) => `- [ ] ${item}`).join("\n")}${refs(group.sourceRefs)}`
    );
  lines.push("\n## 异常处理");
  for (const item of content.exceptionHandling || [])
    lines.push(
      `\n- **${item.situation}**：${item.response}${refs(item.sourceRefs)}`
    );
  lines.push("\n## 风险与对策");
  for (const item of content.risks || [])
    lines.push(
      `\n- **${item.risk}**：${item.mitigation}${refs(item.sourceRefs)}`
    );
  lines.push("\n## 复盘经验");
  for (const item of content.lessonsLearned || [])
    lines.push(`\n- ${item.lesson}${refs(item.sourceRefs)}`);
  lines.push(
    `\n## 待补资料\n\n${(content.gaps || []).map((item: string) => `- ${item}`).join("\n") || "无"}`
  );
  lines.push(
    `\n## 未解决问题\n\n${(content.unresolvedQuestions || []).map((item: string) => `- ${item}`).join("\n") || "无"}`
  );
  lines.push("\n## 来源索引");
  for (const item of content.sourceIndex || [])
    lines.push(`\n- [S${item.sourceId}] ${item.label}`);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
