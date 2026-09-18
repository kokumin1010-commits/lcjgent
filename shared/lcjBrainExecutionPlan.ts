export const LCJ_BRAIN_EXECUTION_PLAN_PROMPT_VERSION = "2026-09-18.v1";
export const LCJ_BRAIN_EXECUTION_PLAN_MODEL = "gpt-5-mini";

export type LcjBrainExecutionRole = {
  key: string;
  title: string;
  departmentHint: string;
  responsibility: string;
  required: boolean;
};

export type LcjBrainExecutionMaterial = {
  name: string;
  purpose: string;
  ownerRoleKey: string;
  format: string;
  preparationInstructions: string;
  requiredFields: string[];
  acceptanceCriteria: string[];
};

export type LcjBrainExecutionTask = {
  key: string;
  phase: string;
  title: string;
  instructions: string;
  ownerRoleKey: string;
  reviewerRoleKey: string | null;
  collaboratorRoleKeys: string[];
  startOffsetDays: number;
  dueOffsetDays: number;
  dependencyTaskKeys: string[];
  materials: LcjBrainExecutionMaterial[];
  evidenceRequirements: string[];
  acceptanceCriteria: string[];
  risks: string[];
  required: boolean;
};

export type LcjBrainExecutionPlanDraft = {
  summary: string;
  roles: LcjBrainExecutionRole[];
  tasks: LcjBrainExecutionTask[];
  unresolvedQuestions: string[];
};

export type LcjBrainRoleAssignments = Record<string, number>;

const stringArraySchema = {
  type: "array",
  maxItems: 30,
  items: { type: "string" },
} as const;

export const LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA = {
  name: "lcj_brain_execution_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      roles: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: {
              type: "string",
              pattern: "^[a-z][a-z0-9_]{1,49}$",
            },
            title: { type: "string" },
            departmentHint: { type: "string" },
            responsibility: { type: "string" },
            required: { type: "boolean" },
          },
          required: [
            "key",
            "title",
            "departmentHint",
            "responsibility",
            "required",
          ],
        },
      },
      tasks: {
        type: "array",
        minItems: 1,
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: {
              type: "string",
              pattern: "^[a-z][a-z0-9_]{1,59}$",
            },
            phase: { type: "string" },
            title: { type: "string" },
            instructions: { type: "string" },
            ownerRoleKey: { type: "string" },
            reviewerRoleKey: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            collaboratorRoleKeys: stringArraySchema,
            startOffsetDays: {
              type: "integer",
              minimum: 0,
              maximum: 730,
            },
            dueOffsetDays: {
              type: "integer",
              minimum: 0,
              maximum: 730,
            },
            dependencyTaskKeys: stringArraySchema,
            materials: {
              type: "array",
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  purpose: { type: "string" },
                  ownerRoleKey: { type: "string" },
                  format: { type: "string" },
                  preparationInstructions: { type: "string" },
                  requiredFields: stringArraySchema,
                  acceptanceCriteria: stringArraySchema,
                },
                required: [
                  "name",
                  "purpose",
                  "ownerRoleKey",
                  "format",
                  "preparationInstructions",
                  "requiredFields",
                  "acceptanceCriteria",
                ],
              },
            },
            evidenceRequirements: stringArraySchema,
            acceptanceCriteria: stringArraySchema,
            risks: stringArraySchema,
            required: { type: "boolean" },
          },
          required: [
            "key",
            "phase",
            "title",
            "instructions",
            "ownerRoleKey",
            "reviewerRoleKey",
            "collaboratorRoleKeys",
            "startOffsetDays",
            "dueOffsetDays",
            "dependencyTaskKeys",
            "materials",
            "evidenceRequirements",
            "acceptanceCriteria",
            "risks",
            "required",
          ],
        },
      },
      unresolvedQuestions: stringArraySchema,
    },
    required: ["summary", "roles", "tasks", "unresolvedQuestions"],
  },
} as const;

function text(value: unknown, max = 10_000): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function strings(value: unknown, maxItems = 30): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => text(item, 1_000))
    .filter(Boolean)
    .slice(0, maxItems);
}

function integer(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(0, Math.min(730, number)) : 0;
}

export function normalizeExecutionPlanDraft(
  value: unknown
): LcjBrainExecutionPlanDraft {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  const roles = (Array.isArray(row.roles) ? row.roles : [])
    .map((role: any) => ({
      key: text(role?.key, 50).toLowerCase(),
      title: text(role?.title, 255),
      departmentHint: text(role?.departmentHint, 255),
      responsibility: text(role?.responsibility, 4_000),
      required: role?.required !== false,
    }))
    .slice(0, 20);
  const tasks = (Array.isArray(row.tasks) ? row.tasks : [])
    .map((task: any) => ({
      key: text(task?.key, 60).toLowerCase(),
      phase: text(task?.phase, 255),
      title: text(task?.title, 500),
      instructions: text(task?.instructions, 10_000),
      ownerRoleKey: text(task?.ownerRoleKey, 50).toLowerCase(),
      reviewerRoleKey: task?.reviewerRoleKey
        ? text(task.reviewerRoleKey, 50).toLowerCase()
        : null,
      collaboratorRoleKeys: strings(task?.collaboratorRoleKeys, 20).map(key =>
        key.toLowerCase()
      ),
      startOffsetDays: integer(task?.startOffsetDays),
      dueOffsetDays: integer(task?.dueOffsetDays),
      dependencyTaskKeys: strings(task?.dependencyTaskKeys, 30).map(key =>
        key.toLowerCase()
      ),
      materials: (Array.isArray(task?.materials) ? task.materials : [])
        .map((material: any) => ({
          name: text(material?.name, 500),
          purpose: text(material?.purpose, 4_000),
          ownerRoleKey: text(material?.ownerRoleKey, 50).toLowerCase(),
          format: text(material?.format, 500),
          preparationInstructions: text(
            material?.preparationInstructions,
            10_000
          ),
          requiredFields: strings(material?.requiredFields, 30),
          acceptanceCriteria: strings(material?.acceptanceCriteria, 30),
        }))
        .slice(0, 20),
      evidenceRequirements: strings(task?.evidenceRequirements, 30),
      acceptanceCriteria: strings(task?.acceptanceCriteria, 30),
      risks: strings(task?.risks, 30),
      required: task?.required !== false,
    }))
    .slice(0, 80);
  return {
    summary: text(row.summary, 10_000),
    roles,
    tasks,
    unresolvedQuestions: strings(row.unresolvedQuestions, 50),
  };
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,59}$/;

export function executionPlanValidationErrors(
  draft: LcjBrainExecutionPlanDraft,
  assignments: LcjBrainRoleAssignments = {},
  options: { requireAssignments?: boolean } = {}
): string[] {
  const errors: string[] = [];
  const roleKeys = new Set<string>();
  for (const role of draft.roles) {
    if (!KEY_PATTERN.test(role.key))
      errors.push(`角色代码无效：${role.key || "空"}`);
    if (roleKeys.has(role.key)) errors.push(`角色代码重复：${role.key}`);
    roleKeys.add(role.key);
    if (!role.title || !role.responsibility)
      errors.push(`角色信息不完整：${role.key || "未命名角色"}`);
    if (
      options.requireAssignments &&
      role.required &&
      (!Number.isInteger(assignments[role.key]) || assignments[role.key] <= 0)
    )
      errors.push(`必需角色尚未分配：${role.title || role.key}`);
  }

  const taskKeys = new Set<string>();
  for (const task of draft.tasks) {
    if (!KEY_PATTERN.test(task.key))
      errors.push(`任务代码无效：${task.key || "空"}`);
    if (taskKeys.has(task.key)) errors.push(`任务代码重复：${task.key}`);
    taskKeys.add(task.key);
  }
  for (const task of draft.tasks) {
    if (!task.phase || !task.title || !task.instructions)
      errors.push(`任务信息不完整：${task.title || task.key}`);
    if (!roleKeys.has(task.ownerRoleKey))
      errors.push(`任务“${task.title}”的负责人角色不存在`);
    if (task.reviewerRoleKey && !roleKeys.has(task.reviewerRoleKey))
      errors.push(`任务“${task.title}”的验收角色不存在`);
    if (task.reviewerRoleKey === task.ownerRoleKey)
      errors.push(`任务“${task.title}”不能由同一角色执行并验收`);
    for (const roleKey of task.collaboratorRoleKeys)
      if (!roleKeys.has(roleKey))
        errors.push(`任务“${task.title}”的协作角色不存在：${roleKey}`);
    for (const dependency of task.dependencyTaskKeys) {
      if (dependency === task.key)
        errors.push(`任务“${task.title}”不能依赖自身`);
      else if (!taskKeys.has(dependency))
        errors.push(`任务“${task.title}”的前置任务不存在：${dependency}`);
    }
    if (task.startOffsetDays > task.dueOffsetDays)
      errors.push(`任务“${task.title}”的开始日期晚于截止日期`);
    if (!task.evidenceRequirements.length)
      errors.push(`任务“${task.title}”缺少完成证据要求`);
    if (!task.acceptanceCriteria.length)
      errors.push(`任务“${task.title}”缺少验收标准`);
    for (const material of task.materials) {
      if (!material.name || !material.preparationInstructions)
        errors.push(`任务“${task.title}”存在不完整的资料要求`);
      if (!roleKeys.has(material.ownerRoleKey))
        errors.push(`资料“${material.name}”的准备角色不存在`);
      if (!material.acceptanceCriteria.length)
        errors.push(`资料“${material.name}”缺少验收标准`);
    }
    if (options.requireAssignments) {
      const owner = assignments[task.ownerRoleKey];
      const reviewer = task.reviewerRoleKey
        ? assignments[task.reviewerRoleKey]
        : undefined;
      if (!Number.isInteger(owner) || Number(owner) <= 0)
        errors.push(`任务“${task.title}”的负责人尚未分配`);
      if (
        task.reviewerRoleKey &&
        (!Number.isInteger(reviewer) || Number(reviewer) <= 0)
      )
        errors.push(`任务“${task.title}”的验收人尚未分配`);
      if (
        Number.isInteger(owner) &&
        Number.isInteger(reviewer) &&
        owner === reviewer
      )
        errors.push(`任务“${task.title}”的执行人和验收人必须不同`);
    }
  }
  const dependencies = new Map(
    draft.tasks.map(task => [task.key, task.dependencyTaskKeys])
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const dependency of dependencies.get(key) || []) {
      if (dependencies.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(key);
    visited.add(key);
    return false;
  };
  if (draft.tasks.some(task => visit(task.key)))
    errors.push("任务前置关系存在循环依赖");
  return [...new Set(errors)];
}

export function addDaysToDateKey(dateKey: string, offsetDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("INVALID_PROJECT_DATE");
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.trunc(offsetDays)));
  return date.toISOString().slice(0, 10);
}

export function executionTaskDateRange(
  projectStartDate: string,
  task: Pick<LcjBrainExecutionTask, "startOffsetDays" | "dueOffsetDays">
): { startDate: string; dueDate: string } {
  return {
    startDate: addDaysToDateKey(projectStartDate, task.startOffsetDays),
    dueDate: addDaysToDateKey(projectStartDate, task.dueOffsetDays),
  };
}
