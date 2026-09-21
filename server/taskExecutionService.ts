import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { taskExecutionFeedbacks, taskNotificationOutbox, type Task } from "../drizzle/schema";
import { getDb } from "./db";
import {
  resolvePerformanceAccess,
  type PerformanceAccess,
  type PerformanceDatabase,
} from "./performanceAccess";
import { ensureTaskExecutionTables } from "./taskExecutionUpgrade";

export type TaskExecutionStatus = "pending" | "in_progress" | "blocked" | "completed" | "cancelled";

export function toTaskClientRecord(task: Task) {
  const {
    completionToken: _completionToken,
    screenshotKey: _screenshotKey,
    screenshotKeys: _screenshotKeys,
    requestId: _requestId,
    ...safe
  } = task;
  return safe;
}

export type TaskExecutionAssignment = {
  taskId: number;
  staffId: number;
  staffName: string;
  department: string | null;
  assignedAt: Date | null;
  feedbackId: number | null;
  status: TaskExecutionStatus;
  feedbackNote: string | null;
  evidenceUrl: string | null;
  acknowledgedAt: number | null;
  completedAt: number | null;
  submittedAt: Date | null;
};

export type TaskExecutionAccess = PerformanceAccess;

type LegacyTaskRow = {
  task: Task;
  staff: { id: number; name: string; department: string | null } | null;
};

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function resolveTaskExecutionAccess(user: {
  id: number;
  email?: string | null;
}): Promise<{ db: PerformanceDatabase; access: TaskExecutionAccess }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接失败" });
  await ensureTaskExecutionTables();
  const access = await resolvePerformanceAccess(
    db,
    { id: user.id, email: user.email || null },
    todayJst()
  );
  return { db, access };
}

function taskFallbackStatus(task: Pick<Task, "status">): TaskExecutionStatus {
  if (task.status === "completed" || task.status === "cancelled") return task.status;
  return task.status === "in_progress" ? "in_progress" : "pending";
}

export function canViewTaskExecution(
  access: TaskExecutionAccess,
  task: Pick<Task, "createdBy">,
  assignedStaffIds: number[]
): boolean {
  return access.isSuperAdmin
    || task.createdBy === access.userId
    || Boolean(access.staffId && assignedStaffIds.includes(access.staffId))
    || assignedStaffIds.some(staffId => access.reviewableStaffIds.includes(staffId));
}

export function canManageTaskExecution(
  access: TaskExecutionAccess,
  task: Pick<Task, "createdBy">,
  assignedStaffIds: number[]
): boolean {
  return access.isSuperAdmin
    || task.createdBy === access.userId
    || (assignedStaffIds.length > 0
      && assignedStaffIds.every(staffId => access.reviewableStaffIds.includes(staffId)));
}

export function resolveAggregateTaskExecutionStatus(
  task: Pick<Task, "status">,
  assignments: Array<Pick<TaskExecutionAssignment, "status" | "feedbackId">>
): "pending" | "in_progress" | "completed" | "cancelled" {
  if (task.status === "cancelled") return "cancelled";
  if (assignments.length === 0 || assignments.every(row => row.feedbackId == null)) {
    return taskFallbackStatus(task) as "pending" | "in_progress" | "completed" | "cancelled";
  }
  const active = assignments.filter(row => row.status !== "cancelled");
  if (active.length === 0) return "cancelled";
  if (active.every(row => row.status === "completed")) return "completed";
  if (active.some(row => ["in_progress", "blocked", "completed"].includes(row.status))) {
    return "in_progress";
  }
  return "pending";
}

async function getAssignmentRows(
  db: Pick<PerformanceDatabase, "execute">,
  taskIds: number[]
): Promise<TaskExecutionAssignment[]> {
  if (taskIds.length === 0) return [];
  const result = await db.execute(sql`
    SELECT assigned.taskId, assigned.staffId, assigned.assignedAt,
      s.name AS staffName, s.department,
      t.status AS taskStatus, t.completedAt AS taskCompletedAt,
      feedback.id AS feedbackId, feedback.status, feedback.feedbackNote,
      feedback.evidenceUrl, feedback.acknowledgedAt, feedback.completedAt,
      feedback.submittedAt
    FROM (
      SELECT ts.taskId, ts.staffId, ts.assignedAt
      FROM task_staff ts
      WHERE ts.taskId IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})
      UNION
      SELECT t.id AS taskId, t.staffId, t.createdAt AS assignedAt
      FROM tasks t
      WHERE t.id IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})
        AND NOT EXISTS (
          SELECT 1 FROM task_staff existing
          WHERE existing.taskId = t.id AND existing.staffId = t.staffId
        )
    ) assigned
    INNER JOIN tasks t ON t.id = assigned.taskId
    INNER JOIN staff s ON s.id = assigned.staffId
      AND s.isActive = 'active' AND s.archivedAt IS NULL AND s.mergedIntoStaffId IS NULL
    LEFT JOIN task_execution_feedbacks feedback ON feedback.id = (
      SELECT MAX(latest.id)
      FROM task_execution_feedbacks latest
      WHERE latest.taskId = assigned.taskId AND latest.staffId = assigned.staffId
    )
    ORDER BY assigned.taskId DESC, assigned.assignedAt ASC, assigned.staffId ASC
  `);
  return rowsOf<any>(result).map(row => ({
    taskId: Number(row.taskId),
    staffId: Number(row.staffId),
    staffName: String(row.staffName || "不明"),
    department: row.department ? String(row.department) : null,
    assignedAt: row.assignedAt ? new Date(row.assignedAt) : null,
    feedbackId: row.feedbackId == null ? null : Number(row.feedbackId),
    status: (row.taskStatus === "cancelled"
      ? "cancelled"
      : row.feedbackId != null
      ? row.status
      : row.taskStatus === "completed" || row.taskStatus === "cancelled"
        ? row.taskStatus
        : "pending") as TaskExecutionStatus,
    feedbackNote: row.feedbackNote ? String(row.feedbackNote) : null,
    evidenceUrl: row.evidenceUrl ? String(row.evidenceUrl) : null,
    acknowledgedAt: row.acknowledgedAt == null ? null : Number(row.acknowledgedAt),
    completedAt: row.completedAt == null
      ? row.taskStatus === "completed" && row.taskCompletedAt != null
        ? Number(row.taskCompletedAt)
        : null
      : Number(row.completedAt),
    submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
  }));
}

export async function getVisibleTaskExecutionRows(
  db: PerformanceDatabase,
  access: TaskExecutionAccess,
  taskRows: LegacyTaskRow[]
) {
  const assignments = await getAssignmentRows(db, taskRows.map(row => row.task.id));
  const byTask = new Map<number, TaskExecutionAssignment[]>();
  for (const assignment of assignments) {
    const list = byTask.get(assignment.taskId) || [];
    list.push(assignment);
    byTask.set(assignment.taskId, list);
  }

  return taskRows.flatMap(row => {
    const taskAssignments = byTask.get(row.task.id) || [];
    const assignedStaffIds = taskAssignments.map(item => item.staffId);
    if (!canViewTaskExecution(access, row.task, assignedStaffIds)) return [];

    const canManage = canManageTaskExecution(access, row.task, assignedStaffIds);
    const ownAssignment = access.staffId
      ? taskAssignments.find(item => item.staffId === access.staffId) || null
      : null;
    const aggregateStatus = resolveAggregateTaskExecutionStatus(row.task, taskAssignments);
    const displayStatus = !canManage && ownAssignment?.feedbackId
      ? ownAssignment.status === "blocked" ? "in_progress" : ownAssignment.status
      : aggregateStatus;
    const isCancelled = row.task.status === "cancelled";
    const completedCount = isCancelled ? 0 : taskAssignments.filter(item => item.status === "completed").length;
    const displayStaff = !canManage && ownAssignment
      ? {
          id: ownAssignment.staffId,
          name: ownAssignment.staffName,
          department: ownAssignment.department,
        }
      : row.staff;

    return [{
      ...row,
      task: toTaskClientRecord(row.task),
      staff: displayStaff,
      displayStatus,
      canEdit: canManage,
      canSubmitFeedback: Boolean(ownAssignment) && !isCancelled,
      executionSummary: {
        assignedCount: taskAssignments.length,
        completedCount,
        blockedCount: isCancelled ? 0 : taskAssignments.filter(item => item.status === "blocked").length,
        ownStatus: isCancelled ? "cancelled" : ownAssignment?.status || null,
      },
    }];
  });
}

export async function getTaskExecutionOverview(
  db: Pick<PerformanceDatabase, "execute">,
  access: TaskExecutionAccess,
  task: Task
) {
  const assignments = await getAssignmentRows(db, [task.id]);
  const assignedStaffIds = assignments.map(item => item.staffId);
  if (!canViewTaskExecution(access, task, assignedStaffIds)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权查看该任务" });
  }
  const canManage = canManageTaskExecution(access, task, assignedStaffIds);
  const canSubmitFeedback = Boolean(
    task.status !== "cancelled" && access.staffId && assignedStaffIds.includes(access.staffId)
  );
  const historyResult = await db.execute(sql`
    SELECT feedback.id, feedback.taskId, feedback.staffId, feedback.status,
      feedback.feedbackNote, feedback.evidenceUrl, feedback.acknowledgedAt,
      feedback.completedAt, feedback.submittedAt,
      s.name AS staffName, s.department
    FROM task_execution_feedbacks feedback
    INNER JOIN staff s ON s.id = feedback.staffId
    WHERE feedback.taskId = ${task.id}
    ORDER BY feedback.id DESC
    LIMIT 200
  `);
  const history = rowsOf<any>(historyResult).map(row => ({
    id: Number(row.id),
    taskId: Number(row.taskId),
    staffId: Number(row.staffId),
    staffName: String(row.staffName || "不明"),
    department: row.department ? String(row.department) : null,
    status: String(row.status) as TaskExecutionStatus,
    feedbackNote: String(row.feedbackNote || ""),
    evidenceUrl: row.evidenceUrl ? String(row.evidenceUrl) : null,
    acknowledgedAt: row.acknowledgedAt == null ? null : Number(row.acknowledgedAt),
    completedAt: row.completedAt == null ? null : Number(row.completedAt),
    submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
  })).filter(item => canManage
    || item.staffId === access.staffId
    || access.reviewableStaffIds.includes(item.staffId));
  const activeAssignments = task.status === "cancelled"
    ? []
    : assignments.filter(item => item.status !== "cancelled");
  const completedCount = activeAssignments.filter(item => item.status === "completed").length;
  const visibleAssignments = canManage
    ? assignments
    : assignments.filter(item => item.staffId === access.staffId || access.reviewableStaffIds.includes(item.staffId));

  return {
    canManage,
    canSubmitFeedback,
    ownStaffId: access.staffId,
    aggregateStatus: resolveAggregateTaskExecutionStatus(task, assignments),
    completionRate: activeAssignments.length > 0
      ? completedCount / activeAssignments.length
      : null,
    assignments: visibleAssignments,
    history,
  };
}

export async function submitTaskExecutionFeedback(input: {
  db: PerformanceDatabase;
  access: TaskExecutionAccess;
  task: Task;
  status: Exclude<TaskExecutionStatus, "pending" | "cancelled">;
  feedbackNote: string;
  evidenceUrl?: string | null;
  requestId: string;
}) {
  if (!input.access.staffId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅被指派员工可以提交本人的执行反馈" });
  }
  const staffId = input.access.staffId;
  return input.db.transaction(async transaction => {
    const lockedRows = rowsOf<any>(await transaction.execute(sql`
      SELECT status, completedAt FROM tasks WHERE id = ${input.task.id} FOR UPDATE
    `));
    const locked = lockedRows[0];
    if (!locked) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
    if (String(locked.status) === "cancelled") {
      throw new TRPCError({ code: "CONFLICT", message: "任务已取消，请负责人恢复后再提交反馈" });
    }
    const lockedTask = {
      ...input.task,
      status: String(locked.status) as Task["status"],
      completedAt: locked.completedAt == null ? null : Number(locked.completedAt),
    };
    const existingRequest = await transaction.select({
      id: taskExecutionFeedbacks.id,
      taskId: taskExecutionFeedbacks.taskId,
      staffId: taskExecutionFeedbacks.staffId,
      submittedByUserId: taskExecutionFeedbacks.submittedByUserId,
    })
      .from(taskExecutionFeedbacks)
      .where(eq(taskExecutionFeedbacks.requestId, input.requestId))
      .limit(1);
    if (existingRequest[0]) {
      if (existingRequest[0].taskId !== input.task.id
        || existingRequest[0].staffId !== staffId
        || existingRequest[0].submittedByUserId !== input.access.userId) {
        throw new TRPCError({ code: "CONFLICT", message: "反馈请求ID已用于其他操作" });
      }
      return getTaskExecutionOverview(transaction, input.access, lockedTask);
    }
    const overview = await getTaskExecutionOverview(transaction, input.access, lockedTask);
    if (!overview.canSubmitFeedback) {
      throw new TRPCError({ code: "FORBIDDEN", message: "仅被指派员工可以提交本人的执行反馈" });
    }
    const now = Date.now();
    const prior = overview.assignments.find(row => row.staffId === input.access.staffId);
    const [insertedFeedback] = await transaction.insert(taskExecutionFeedbacks).values({
      requestId: input.requestId,
      taskId: input.task.id,
      staffId,
      status: input.status,
      feedbackNote: input.feedbackNote.trim(),
      evidenceUrl: input.evidenceUrl || null,
      acknowledgedAt: prior?.acknowledgedAt || now,
      completedAt: input.status === "completed" ? now : null,
      submittedByUserId: input.access.userId,
    }).$returningId();
    if (!insertedFeedback?.id) throw new Error("Failed to persist task execution feedback");
    if (input.task.createdBy !== input.access.userId) {
      await transaction.insert(taskNotificationOutbox).values({
        notificationKey: `feedback:${insertedFeedback.id}:creator`,
        eventType: "feedback_creator",
        taskId: input.task.id,
        staffId,
        recipientUserId: input.task.createdBy,
        feedbackId: insertedFeedback.id,
        feedbackStatus: input.status,
        status: "pending",
      });
    }

    const refreshed = await getTaskExecutionOverview(transaction, input.access, lockedTask);
    const completedTimes = refreshed.assignments
      .map(row => row.completedAt)
      .filter((value): value is number => value != null);
    const completedAt = refreshed.aggregateStatus === "completed" && completedTimes.length > 0
      ? Math.max(...completedTimes)
      : null;
    await transaction.execute(sql`
      INSERT INTO entity_revision_audits
        (entityType, entityId, action, actorUserId, beforeState, afterState)
      VALUES ('task', ${input.task.id}, 'execution_feedback_status', ${input.access.userId},
        ${JSON.stringify({ status: lockedTask.status, completedAt: lockedTask.completedAt })},
        ${JSON.stringify({ status: refreshed.aggregateStatus, completedAt })})
    `);
    await transaction.execute(sql`
      UPDATE tasks
      SET status = CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE ${refreshed.aggregateStatus} END,
        completedAt = CASE WHEN status = 'cancelled' THEN NULL ELSE ${completedAt} END,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${input.task.id}
    `);

    return getTaskExecutionOverview(transaction, input.access, {
      ...lockedTask,
      status: refreshed.aggregateStatus,
      completedAt,
    });
  });
}
