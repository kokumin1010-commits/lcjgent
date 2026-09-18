import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { invokeLLM } from "./_core/llm";
import { ensureLcjBrainProjectUpgrade } from "./lcjBrainProjectUpgrade";
import {
  executionPlanValidationErrors,
  executionTaskDateRange,
  LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA,
  LCJ_BRAIN_EXECUTION_PLAN_MODEL,
  LCJ_BRAIN_EXECUTION_PLAN_PROMPT_VERSION,
  normalizeExecutionPlanDraft,
  type LcjBrainExecutionPlanDraft,
  type LcjBrainRoleAssignments,
} from "../shared/lcjBrainExecutionPlan";

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function cleanText(value: unknown, max = 10_000): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export function executionProjectDateKey(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.toISOString().slice(0, 10);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? "").trim());
  if (!match) throw new Error("INVALID_PROJECT_DATE");
  return match[1];
}

function asPlan(row: any) {
  return {
    id: Number(row.id),
    projectId: Number(row.projectId),
    revision: Number(row.revision),
    version: Number(row.version),
    sourceSopVersionId: Number(row.sourceSopVersionId),
    sourceSopVersion: Number(row.sourceSopVersion),
    status: row.status as "draft" | "published" | "superseded",
    plan: normalizeExecutionPlanDraft(parseJson(row.planJson, {})),
    roleAssignments: parseJson<LcjBrainRoleAssignments>(
      row.roleAssignments,
      {}
    ),
    validationErrors: parseJson<string[]>(row.validationErrors, []),
    model: row.model ? String(row.model) : null,
    promptVersion: String(row.promptVersion),
    generatedBy: Number(row.generatedBy),
    generatedByName: String(row.generatedByName),
    confirmedBy: row.confirmedBy ? Number(row.confirmedBy) : null,
    confirmedByName: row.confirmedByName ? String(row.confirmedByName) : null,
    confirmedAt: row.confirmedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asTaskState(row: any) {
  return {
    id: Number(row.id),
    planId: Number(row.planId),
    taskKey: String(row.taskKey),
    status: row.status as
      | "todo"
      | "pending_review"
      | "completed"
      | "rejected"
      | "cancelled",
    evidenceLinks: parseJson<string[]>(row.evidenceLinks, []),
    submissionNote: row.submissionNote ? String(row.submissionNote) : "",
    submittedByStaffId: row.submittedByStaffId
      ? Number(row.submittedByStaffId)
      : null,
    submittedAt: row.submittedAt || null,
    reviewedByStaffId: row.reviewedByStaffId
      ? Number(row.reviewedByStaffId)
      : null,
    reviewNote: row.reviewNote ? String(row.reviewNote) : "",
    reviewedAt: row.reviewedAt || null,
    externalTaskId: row.externalTaskId ? Number(row.externalTaskId) : null,
    updatedAt: row.updatedAt,
  };
}

export type ExecutionPlanActor = {
  id: number;
  name: string;
  staffId: number | null;
  isSuperAdmin: boolean;
};

export function buildExecutionPlanPrompt(input: {
  project: any;
  sop: Record<string, unknown>;
  maxOffsetDays: number;
}): string {
  return [
    `项目名称：${cleanText(input.project.name, 500)}`,
    `项目类型：${cleanText(input.project.projectType, 100)}`,
    `开始日期：${cleanText(input.project.startDate, 10)}`,
    `结束日期：${cleanText(input.project.endDate || "未设置", 10)}`,
    `目标：${cleanText(input.project.objective || "未填写", 10_000)}`,
    `范围：${cleanText(input.project.scope || "未填写", 10_000)}`,
    `最大日期偏移：${input.maxOffsetDays}天`,
    "",
    "请把以下SOP转换成当前项目可执行草案。角色只使用稳定英文key，不写任何实际员工姓名或staffId。每个必做任务必须有执行角色、不同的验收角色、明确操作说明、资料准备方法、证据要求、验收标准和从项目开始日计算的非负日期偏移。dependencyTaskKeys只能引用本次输出中的task key。SOP无法确定的信息放入unresolvedQuestions，禁止猜测。不要发布任务，不要发送通知。",
    "",
    `SOP JSON：${JSON.stringify(input.sop).slice(0, 180_000)}`,
  ].join("\n");
}

function dateDifference(startDate: string, endDate?: string | null): number {
  if (!endDate) return 365;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 365;
  return Math.max(0, Math.min(730, Math.floor((end - start) / 86_400_000)));
}

async function writePlanAudit(
  connection: Pool | PoolConnection,
  input: {
    projectId: number;
    entityType: string;
    entityId?: number | null;
    action: string;
    actor: ExecutionPlanActor;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
  }
) {
  await connection.query(
    `INSERT INTO lcj_brain_project_audit_logs
     (projectId,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      input.projectId,
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.actor.id,
      input.actor.name,
      input.reason || null,
    ]
  );
}

export async function getExecutionPlan(projectId: number) {
  const db = getPool();
  const [[planRows], [stateRows], [staffRows]] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT * FROM lcj_brain_project_execution_plans
       WHERE projectId=? AND status IN ('draft','published')
       ORDER BY FIELD(status,'published','draft'),revision DESC LIMIT 1`,
      [projectId]
    ),
    db.query<RowDataPacket[]>(
      `SELECT * FROM lcj_brain_project_execution_task_states
       WHERE projectId=? ORDER BY id`,
      [projectId]
    ),
    db.query<RowDataPacket[]>(
      `SELECT s.id AS staffId,s.name,s.department,s.position
       FROM staff s
       WHERE s.archivedAt IS NULL AND s.mergedIntoStaffId IS NULL AND s.isActive='active'
       ORDER BY s.department,s.name`
    ),
  ]);
  const plan = planRows[0] ? asPlan(planRows[0]) : null;
  return {
    plan,
    taskStates: plan
      ? stateRows.filter(row => Number(row.planId) === plan.id).map(asTaskState)
      : [],
    staff: staffRows.map(row => ({
      staffId: Number(row.staffId),
      name: String(row.name),
      department: row.department ? String(row.department) : null,
      position: row.position ? String(row.position) : null,
    })),
  };
}

export async function generateExecutionPlanDraft(input: {
  project: any;
  actor: ExecutionPlanActor;
}) {
  if (input.project.status === "archived")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "已归档项目不能生成执行草案，请先重新启用",
    });
  const db = getPool();
  const [publishedRows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM lcj_brain_project_execution_plans WHERE projectId=? AND status='published' LIMIT 1",
    [input.project.id]
  );
  if (publishedRows[0])
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "执行计划已经发布，不能覆盖；后续应通过计划修订流程调整",
    });
  const [sopRows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1",
    [input.project.id]
  );
  const sop = sopRows[0];
  if (!sop)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "请先生成或载入SOP，再生成执行草案",
    });
  const maxOffsetDays = dateDifference(
    executionProjectDateKey(input.project.startDate),
    input.project.endDate
      ? executionProjectDateKey(input.project.endDate)
      : null
  );
  const requestSnapshot = {
    projectId: Number(input.project.id),
    projectVersion: Number(input.project.version),
    sourceSopVersionId: Number(sop.id),
    sourceSopVersion: Number(sop.version),
    maxOffsetDays,
  };
  const [run] = await db.query<ResultSetHeader>(
    `INSERT INTO lcj_brain_project_execution_runs
     (projectId,runKey,status,model,promptVersion,requestSnapshot,startedBy,startedByName)
     VALUES (?,?,'running',?,?,?,?,?)`,
    [
      input.project.id,
      `execution:${input.project.id}:${Date.now()}:${crypto.randomBytes(3).toString("hex")}`,
      LCJ_BRAIN_EXECUTION_PLAN_MODEL,
      LCJ_BRAIN_EXECUTION_PLAN_PROMPT_VERSION,
      JSON.stringify(requestSnapshot),
      input.actor.id,
      input.actor.name,
    ]
  );
  const runId = Number(run.insertId);
  const startedAt = Date.now();
  try {
    const sopContent = parseJson<Record<string, unknown>>(
      sop.structuredContent,
      {}
    );
    const response = await invokeLLM({
      model: LCJ_BRAIN_EXECUTION_PLAN_MODEL,
      responseFormat: {
        type: "json_schema",
        json_schema: LCJ_BRAIN_EXECUTION_PLAN_JSON_SCHEMA as any,
      },
      messages: [
        {
          role: "system",
          content:
            "你是LCJ项目执行设计专家。把已有SOP转换成可由员工执行和验收的结构化草案。AI只能提出草案，不能指定实际人员、不能发布任务、不能发送通知。只依据输入SOP和项目信息；不确定内容必须进入unresolvedQuestions。输出严格JSON。",
        },
        {
          role: "user",
          content: buildExecutionPlanPrompt({
            project: {
              ...input.project,
              startDate: executionProjectDateKey(input.project.startDate),
              endDate: input.project.endDate
                ? executionProjectDateKey(input.project.endDate)
                : null,
            },
            sop: sopContent,
            maxOffsetDays,
          }),
        },
      ],
    });
    const raw = response.choices?.[0]?.message?.content;
    if (typeof raw !== "string")
      throw new Error("EXECUTION_PLAN_EMPTY_RESPONSE");
    const draft = normalizeExecutionPlanDraft(JSON.parse(raw));
    const errors = executionPlanValidationErrors(draft);
    if (!draft.roles.length || !draft.tasks.length || errors.length)
      throw new Error(
        `EXECUTION_PLAN_INVALID:${errors.slice(0, 10).join("；") || "草案为空"}`
      );
    if (draft.tasks.some(task => task.dueOffsetDays > maxOffsetDays))
      throw new Error("EXECUTION_PLAN_DATE_OUTSIDE_PROJECT");

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [projectRows] = await connection.query<RowDataPacket[]>(
        "SELECT status,version FROM lcj_brain_projects WHERE id=? LIMIT 1 FOR UPDATE",
        [input.project.id]
      );
      if (!projectRows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
      if (projectRows[0].status === "archived")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "项目已归档，不能保存执行草案",
        });
      if (Number(projectRows[0].version) !== Number(input.project.version))
        throw new TRPCError({
          code: "CONFLICT",
          message: "项目已被修改，请刷新后重新生成执行草案",
        });
      const [latestSopRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1 FOR UPDATE",
        [input.project.id]
      );
      if (Number(latestSopRows[0]?.id || 0) !== Number(sop.id))
        throw new TRPCError({
          code: "CONFLICT",
          message: "SOP已更新，请按最新版本重新生成执行草案",
        });
      const [publishedInside] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM lcj_brain_project_execution_plans WHERE projectId=? AND status='published' LIMIT 1 FOR UPDATE",
        [input.project.id]
      );
      if (publishedInside[0])
        throw new TRPCError({
          code: "CONFLICT",
          message: "执行计划已由其他管理员发布，请刷新",
        });
      const [revisionRows] = await connection.query<RowDataPacket[]>(
        "SELECT revision FROM lcj_brain_project_execution_plans WHERE projectId=? ORDER BY revision DESC LIMIT 1 FOR UPDATE",
        [input.project.id]
      );
      const revision = Number(revisionRows[0]?.revision || 0) + 1;
      await connection.query(
        "UPDATE lcj_brain_project_execution_plans SET status='superseded' WHERE projectId=? AND status='draft'",
        [input.project.id]
      );
      const [inserted] = await connection.query<ResultSetHeader>(
        `INSERT INTO lcj_brain_project_execution_plans
         (projectId,revision,version,sourceSopVersionId,sourceSopVersion,status,planJson,roleAssignments,validationErrors,model,promptVersion,rawResponse,generatedBy,generatedByName)
         VALUES (?,?,1,?,?,'draft',?,JSON_OBJECT(),JSON_ARRAY(),?,?,?,?,?)`,
        [
          input.project.id,
          revision,
          Number(sop.id),
          Number(sop.version),
          JSON.stringify(draft),
          response.model || LCJ_BRAIN_EXECUTION_PLAN_MODEL,
          LCJ_BRAIN_EXECUTION_PLAN_PROMPT_VERSION,
          raw,
          input.actor.id,
          input.actor.name,
        ]
      );
      await writePlanAudit(connection, {
        projectId: Number(input.project.id),
        entityType: "execution_plan",
        entityId: Number(inserted.insertId),
        action: "execution_plan_ai_draft_generated",
        actor: input.actor,
        after: {
          revision,
          roleCount: draft.roles.length,
          taskCount: draft.tasks.length,
          sourceSopVersion: Number(sop.version),
          model: response.model || LCJ_BRAIN_EXECUTION_PLAN_MODEL,
        },
        reason: "管理员手动触发AI执行草案；尚未发布任务",
      });
      await connection.query(
        "UPDATE lcj_brain_project_execution_runs SET status='success',planId=?,model=?,rawResponse=?,durationMs=?,finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          Number(inserted.insertId),
          response.model || LCJ_BRAIN_EXECUTION_PLAN_MODEL,
          raw,
          Date.now() - startedAt,
          runId,
        ]
      );
      await connection.commit();
      return { planId: Number(inserted.insertId), revision };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    await db
      .query(
        "UPDATE lcj_brain_project_execution_runs SET status='failed',errorCode=?,errorMessage=?,durationMs=?,finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          cleanText(error?.message || "EXECUTION_PLAN_GENERATION_FAILED", 100),
          cleanText(error?.message || error, 4_000),
          Date.now() - startedAt,
          runId,
        ]
      )
      .catch(() => undefined);
    throw error;
  }
}

async function activeStaffIds(
  connection: Pool | PoolConnection,
  staffIds: number[]
): Promise<Set<number>> {
  if (!staffIds.length) return new Set();
  const placeholders = staffIds.map(() => "?").join(",");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM staff WHERE id IN (${placeholders})
     AND archivedAt IS NULL AND mergedIntoStaffId IS NULL AND isActive='active'`,
    staffIds
  );
  return new Set(rows.map(row => Number(row.id)));
}

export async function saveExecutionPlanDraft(input: {
  project: any;
  planId: number;
  expectedVersion: number;
  plan: unknown;
  roleAssignments: LcjBrainRoleAssignments;
  actor: ExecutionPlanActor;
}) {
  const draft = normalizeExecutionPlanDraft(input.plan);
  const roleKeys = new Set(draft.roles.map(role => role.key));
  const assignments = Object.fromEntries(
    Object.entries(input.roleAssignments)
      .filter(([key]) => roleKeys.has(key))
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isInteger(value) && Number(value) > 0)
  ) as LcjBrainRoleAssignments;
  const errors = executionPlanValidationErrors(draft, assignments, {
    requireAssignments: true,
  });
  const assignedIds: number[] = [
    ...new Set(Object.values(assignments).map(Number)),
  ];
  const projectMembers = new Set<number>(
    (input.project.memberStaffIds || []).map(Number)
  );
  for (const staffId of assignedIds)
    if (!projectMembers.has(staffId))
      errors.push(`staffId ${staffId} 不是当前项目成员`);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [projectRows] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM lcj_brain_projects WHERE id=? LIMIT 1 FOR UPDATE",
      [input.project.id]
    );
    if (!projectRows[0])
      throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
    if (projectRows[0].status === "archived")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "已归档项目为只读；如需修改，请先重新启用",
      });
    const active = await activeStaffIds(connection, assignedIds);
    for (const staffId of assignedIds)
      if (!active.has(staffId)) errors.push(`staffId ${staffId} 不是现役员工`);
    const uniqueErrors = [...new Set(errors)];
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE lcj_brain_project_execution_plans
       SET planJson=?,roleAssignments=?,validationErrors=?,version=version+1
       WHERE id=? AND projectId=? AND status='draft' AND version=?`,
      [
        JSON.stringify(draft),
        JSON.stringify(assignments),
        JSON.stringify(uniqueErrors),
        input.planId,
        input.project.id,
        input.expectedVersion,
      ]
    );
    if (result.affectedRows !== 1)
      throw new TRPCError({
        code: "CONFLICT",
        message: "执行草案已被其他管理员修改，请刷新后重试",
      });
    await writePlanAudit(connection, {
      projectId: Number(input.project.id),
      entityType: "execution_plan",
      entityId: input.planId,
      action: "execution_plan_draft_saved",
      actor: input.actor,
      after: {
        roleCount: draft.roles.length,
        taskCount: draft.tasks.length,
        assignedRoleCount: Object.keys(assignments).length,
        validationErrorCount: uniqueErrors.length,
      },
      reason: "管理员保存AI草案和人员映射；尚未发布任务",
    });
    await connection.commit();
    return {
      version: input.expectedVersion + 1,
      validationErrors: uniqueErrors,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function tokyoDateTime(dateKey: string, endOfDay = false): Date {
  const suffix = endOfDay ? "23:59:59+09:00" : "00:00:00+09:00";
  return new Date(`${dateKey}T${suffix}`);
}

function externalTaskCode(projectId: number, planId: number, taskKey: string) {
  const digest = crypto
    .createHash("sha256")
    .update(taskKey)
    .digest("hex")
    .slice(0, 12);
  return `LCJB-${projectId}-${planId}-${digest}`.slice(0, 64);
}

export async function publishExecutionPlan(input: {
  project: any;
  planId: number;
  expectedVersion: number;
  actor: ExecutionPlanActor;
}) {
  if (input.project.status === "archived")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "已归档项目不能发布执行计划",
    });
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [projectRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM lcj_brain_projects WHERE id=? LIMIT 1 FOR UPDATE",
      [input.project.id]
    );
    const project = projectRows[0];
    if (!project)
      throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
    if (project.status === "archived")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "项目已归档，不能发布执行计划",
      });
    const [planRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM lcj_brain_project_execution_plans WHERE id=? AND projectId=? LIMIT 1 FOR UPDATE",
      [input.planId, input.project.id]
    );
    const row = planRows[0];
    if (!row)
      throw new TRPCError({ code: "NOT_FOUND", message: "执行草案不存在" });
    if (row.status !== "draft")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "该执行草案已发布或被替换",
      });
    if (Number(row.version) !== input.expectedVersion)
      throw new TRPCError({
        code: "CONFLICT",
        message: "执行草案已被其他管理员修改，请刷新后重试",
      });
    const draft = normalizeExecutionPlanDraft(parseJson(row.planJson, {}));
    const assignments = parseJson<LcjBrainRoleAssignments>(
      row.roleAssignments,
      {}
    );
    const errors = executionPlanValidationErrors(draft, assignments, {
      requireAssignments: true,
    });
    if (draft.unresolvedQuestions.length)
      errors.push("仍有未解决问题，请编辑草案并清空后再发布");
    const assignedIds = [...new Set(Object.values(assignments).map(Number))];
    const projectMembers = new Set<number>(
      parseJson<number[]>(project.memberStaffIds, []).map(Number)
    );
    const projectStartDate = executionProjectDateKey(project.startDate);
    const projectEndDate = project.endDate
      ? executionProjectDateKey(project.endDate)
      : null;
    const active = await activeStaffIds(connection, assignedIds);
    for (const staffId of assignedIds) {
      if (!projectMembers.has(staffId))
        errors.push(`staffId ${staffId} 不是当前项目成员`);
      if (!active.has(staffId)) errors.push(`staffId ${staffId} 不是现役员工`);
    }
    for (const task of draft.tasks) {
      const dates = executionTaskDateRange(projectStartDate, task);
      if (projectEndDate && dates.dueDate > projectEndDate)
        errors.push(`任务“${task.title}”的截止日期晚于项目结束日`);
    }
    if (errors.length)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: [...new Set(errors)].slice(0, 8).join("；"),
      });

    const taskIdByKey = new Map<string, number>();
    for (const task of draft.tasks) {
      const ownerStaffId = Number(assignments[task.ownerRoleKey]);
      const reviewerStaffId = task.reviewerRoleKey
        ? Number(assignments[task.reviewerRoleKey])
        : null;
      const collaboratorStaffIds = [
        ...new Set(
          task.collaboratorRoleKeys
            .map(key => Number(assignments[key]))
            .filter(id => Number.isInteger(id) && id > 0 && id !== ownerStaffId)
        ),
      ];
      const materialOwnerStaffIds = task.materials
        .map(material => Number(assignments[material.ownerRoleKey]))
        .filter(id => Number.isInteger(id) && id > 0);
      const participantStaffIds = [
        ...new Set([
          ownerStaffId,
          ...collaboratorStaffIds,
          ...materialOwnerStaffIds,
        ]),
      ];
      const dates = executionTaskDateRange(projectStartDate, task);
      const taskCode = externalTaskCode(
        Number(project.id),
        input.planId,
        task.key
      );
      const context = [
        `LCJ Brain项目：${project.name}`,
        `阶段：${task.phase}`,
        `操作说明：${task.instructions}`,
        `完成证据：${task.evidenceRequirements.join("；")}`,
        `验收标准：${task.acceptanceCriteria.join("；")}`,
        `项目入口：/master/lcj-brain?tab=projects&projectId=${project.id}&executionTask=${encodeURIComponent(task.key)}`,
        "请在LCJ Brain执行计划中提交证据；任务列表不能直接完成此任务。",
      ].join("\n");
      const [insertedTask] = await connection.query<ResultSetHeader>(
        `INSERT INTO tasks
         (taskId,status,staffId,taskDetail,extractedContext,deadline,completionToken,notes,startDate,createdBy)
         VALUES (?,'pending',?,?,?,?,NULL,?,?,?)`,
        [
          taskCode,
          ownerStaffId,
          `[项目执行] ${task.title}`,
          context,
          tokyoDateTime(dates.dueDate, true),
          `LCJ Brain执行计划任务；发布时不发送外部通知。项目#${project.id} / 计划#${input.planId}`,
          tokyoDateTime(dates.startDate).getTime(),
          input.actor.id,
        ]
      );
      const externalTaskId = Number(insertedTask.insertId);
      taskIdByKey.set(task.key, externalTaskId);
      for (const staffId of participantStaffIds)
        await connection.query(
          "INSERT INTO task_staff (taskId,staffId) VALUES (?,?)",
          [externalTaskId, staffId]
        );
      const [state] = await connection.query<ResultSetHeader>(
        `INSERT INTO lcj_brain_project_execution_task_states
         (projectId,planId,taskKey,status,evidenceLinks,externalTaskId)
         VALUES (?,?,?,'todo',JSON_ARRAY(),?)`,
        [project.id, input.planId, task.key, externalTaskId]
      );
      await connection.query(
        `INSERT INTO lcj_brain_project_execution_task_links
         (projectId,planId,executionTaskStateId,externalTaskId,externalTaskCode)
         VALUES (?,?,?,?,?)`,
        [
          project.id,
          input.planId,
          Number(state.insertId),
          externalTaskId,
          taskCode,
        ]
      );
      if (reviewerStaffId)
        await connection.query(
          `INSERT INTO lcj_brain_project_execution_events
           (projectId,planId,taskKey,action,actorUserId,actorName,actorStaffId,detailJson)
           VALUES (?,?,?,'reviewer_assigned',?,?,?,?)`,
          [
            project.id,
            input.planId,
            task.key,
            input.actor.id,
            input.actor.name,
            input.actor.staffId,
            JSON.stringify({ reviewerStaffId }),
          ]
        );
    }
    const [updated] = await connection.query<ResultSetHeader>(
      `UPDATE lcj_brain_project_execution_plans
       SET status='published',validationErrors=JSON_ARRAY(),version=version+1,confirmedBy=?,confirmedByName=?,confirmedAt=CURRENT_TIMESTAMP
       WHERE id=? AND status='draft' AND version=?`,
      [input.actor.id, input.actor.name, input.planId, input.expectedVersion]
    );
    if (updated.affectedRows !== 1)
      throw new TRPCError({
        code: "CONFLICT",
        message: "执行草案发布冲突，请刷新后重试",
      });
    await writePlanAudit(connection, {
      projectId: Number(project.id),
      entityType: "execution_plan",
      entityId: input.planId,
      action: "execution_plan_published",
      actor: input.actor,
      after: {
        taskCount: draft.tasks.length,
        roleAssignments: assignments,
        externalTaskIds: [...taskIdByKey.values()],
      },
      reason: "管理员确认AI草案后发布；未发送外部通知",
    });
    await connection.commit();
    return { published: true, taskCount: draft.tasks.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function lockExecutionTask(
  connection: PoolConnection,
  input: { projectId: number; taskKey: string }
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT state.*,plan.planJson,plan.roleAssignments,plan.status AS planStatus
     FROM lcj_brain_project_execution_task_states state
     INNER JOIN lcj_brain_project_execution_plans plan ON plan.id=state.planId
     WHERE state.projectId=? AND state.taskKey=? AND plan.status='published'
     LIMIT 1 FOR UPDATE`,
    [input.projectId, input.taskKey]
  );
  if (!rows[0])
    throw new TRPCError({ code: "NOT_FOUND", message: "执行任务不存在" });
  const draft = normalizeExecutionPlanDraft(parseJson(rows[0].planJson, {}));
  const task = draft.tasks.find(item => item.key === input.taskKey);
  if (!task)
    throw new TRPCError({ code: "NOT_FOUND", message: "执行任务定义不存在" });
  const assignments = parseJson<LcjBrainRoleAssignments>(
    rows[0].roleAssignments,
    {}
  );
  return { row: rows[0], task, assignments };
}

export async function submitExecutionTask(input: {
  projectId: number;
  taskKey: string;
  evidenceLinks: string[];
  note: string;
  actor: ExecutionPlanActor;
}) {
  if (!input.actor.staffId)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "当前账号尚未关联现役员工主档",
    });
  const links = [
    ...new Set(
      input.evidenceLinks.map(link => cleanText(link, 2_000)).filter(Boolean)
    ),
  ].slice(0, 20);
  const note = cleanText(input.note, 10_000);
  if (!links.length && !note)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "请至少填写一项证据链接或提交说明",
    });
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const locked = await lockExecutionTask(connection, input);
    const ownerStaffId = Number(locked.assignments[locked.task.ownerRoleKey]);
    if (ownerStaffId !== input.actor.staffId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "只有该事项的执行负责人可以提交验收",
      });
    if (locked.task.dependencyTaskKeys.length) {
      const placeholders = locked.task.dependencyTaskKeys
        .map(() => "?")
        .join(",");
      const [dependencyRows] = await connection.query<RowDataPacket[]>(
        `SELECT taskKey,status FROM lcj_brain_project_execution_task_states
         WHERE planId=? AND taskKey IN (${placeholders})`,
        [locked.row.planId, ...locked.task.dependencyTaskKeys]
      );
      const completedDependencies = new Set(
        dependencyRows
          .filter(row => row.status === "completed")
          .map(row => String(row.taskKey))
      );
      const pendingDependencies = locked.task.dependencyTaskKeys.filter(
        key => !completedDependencies.has(key)
      );
      if (pendingDependencies.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `前置任务尚未完成：${pendingDependencies.join("、")}`,
        });
    }
    if (!(["todo", "rejected"] as string[]).includes(locked.row.status))
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          locked.row.status === "pending_review"
            ? "该事项正在等待验收，不能覆盖已提交证据"
            : "该事项已结束，不能重复提交",
      });
    await connection.query(
      `UPDATE lcj_brain_project_execution_task_states
       SET status='pending_review',evidenceLinks=?,submissionNote=?,submittedByStaffId=?,submittedAt=CURRENT_TIMESTAMP,reviewedByStaffId=NULL,reviewNote=NULL,reviewedAt=NULL
       WHERE id=?`,
      [JSON.stringify(links), note || null, input.actor.staffId, locked.row.id]
    );
    await connection.query(
      `INSERT INTO lcj_brain_project_execution_events
       (projectId,planId,taskKey,action,actorUserId,actorName,actorStaffId,detailJson)
       VALUES (?,?,?,'submitted',?,?,?,?)`,
      [
        input.projectId,
        locked.row.planId,
        input.taskKey,
        input.actor.id,
        input.actor.name,
        input.actor.staffId,
        JSON.stringify({ evidenceLinks: links, note }),
      ]
    );
    await connection.commit();
    return { submitted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reviewExecutionTask(input: {
  projectId: number;
  taskKey: string;
  decision: "approve" | "reject";
  note: string;
  actor: ExecutionPlanActor;
  canManage: boolean;
}) {
  if (!input.actor.staffId && !input.canManage)
    throw new TRPCError({ code: "FORBIDDEN", message: "无权验收该事项" });
  const note = cleanText(input.note, 10_000);
  if (input.decision === "reject" && !note)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "退回时必须填写原因",
    });
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const locked = await lockExecutionTask(connection, input);
    if (locked.row.status !== "pending_review")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "该事项当前不在待验收状态",
      });
    const ownerStaffId = Number(locked.assignments[locked.task.ownerRoleKey]);
    const reviewerStaffId = locked.task.reviewerRoleKey
      ? Number(locked.assignments[locked.task.reviewerRoleKey])
      : null;
    const reviewerMatched =
      Boolean(input.actor.staffId) && reviewerStaffId === input.actor.staffId;
    if (
      (reviewerStaffId && !reviewerMatched) ||
      (!reviewerStaffId && !input.canManage)
    )
      throw new TRPCError({ code: "FORBIDDEN", message: "无权验收该事项" });
    if (input.actor.staffId && ownerStaffId === input.actor.staffId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "执行负责人不能验收自己的事项",
      });
    const nextStatus = input.decision === "approve" ? "completed" : "rejected";
    await connection.query(
      `UPDATE lcj_brain_project_execution_task_states
       SET status=?,reviewedByStaffId=?,reviewNote=?,reviewedAt=CURRENT_TIMESTAMP
       WHERE id=?`,
      [nextStatus, input.actor.staffId, note || null, locked.row.id]
    );
    if (locked.row.externalTaskId)
      await connection.query(
        `UPDATE tasks SET status=?,completedAt=? WHERE id=?`,
        [
          input.decision === "approve" ? "completed" : "pending",
          input.decision === "approve" ? Date.now() : null,
          locked.row.externalTaskId,
        ]
      );
    await connection.query(
      `INSERT INTO lcj_brain_project_execution_events
       (projectId,planId,taskKey,action,actorUserId,actorName,actorStaffId,detailJson)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        input.projectId,
        locked.row.planId,
        input.taskKey,
        input.decision === "approve" ? "approved" : "rejected",
        input.actor.id,
        input.actor.name,
        input.actor.staffId,
        JSON.stringify({ note }),
      ]
    );
    await connection.commit();
    return { status: nextStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertLcjBrainLinkedTaskMutationAllowed(
  externalTaskId: number,
  action: "update" | "delete" | "notify"
): Promise<void> {
  await ensureLcjBrainProjectUpgrade();
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT projectId,taskKey FROM lcj_brain_project_execution_task_links WHERE externalTaskId=? LIMIT 1",
    [externalTaskId]
  );
  if (!rows[0]) return;
  const label =
    action === "delete"
      ? "删除"
      : action === "notify"
        ? "发送提醒"
        : "直接修改或完成";
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: `这是LCJ Brain执行计划任务，不能在任务列表${label}；请进入项目执行计划提交证据并由验收人确认`,
  });
}
