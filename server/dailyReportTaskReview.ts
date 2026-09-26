import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Report } from "../drizzle/schema";
import {
  reportFollowupExtractionRuns,
  taskExecutionFeedbacks,
  taskNotificationOutbox,
} from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import {
  extractAndCreateReportFollowups,
  safelyExtractReportFollowups,
  type ReportTaskExtractionResult,
} from "./reportFollowupAutomation";
import { ensureTaskExecutionTables } from "./taskExecutionUpgrade";

type ReportInput = Pick<
  Report,
  "id" | "reportStaffId" | "reportDate" | "workContent" | "issues" | "remarks" | "createdBy" | "updatedAt"
>;

type ReviewCandidate = {
  source: "daily_report" | "manual";
  id: number;
  title: string;
  sourceDate: Date | null;
  deadline: Date | null;
};

const completionReviewSchema = z.object({
  decisions: z.array(z.object({
    source: z.enum(["daily_report", "manual"]),
    id: z.number().int().positive(),
    outcome: z.enum(["completed", "keep"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(300),
    evidence: z.string().trim().min(1).max(300),
  })).max(100),
});

type CompletionDecision = z.infer<typeof completionReviewSchema>["decisions"][number];

type ReviewDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ReviewTransaction = Pick<ReviewDatabase, "execute" | "insert">;

type ReviewResult = {
  reviewedCount: number;
  completedCount: number;
  keptCount: number;
  status: "succeeded" | "failed";
};

type ReviewOptions = {
  assertBeforeCommit?: (transaction: ReviewTransaction) => Promise<void>;
};

export type ReportTaskLifecycleResult = {
  extraction: ReportTaskExtractionResult;
  review: ReviewResult;
};

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reportReviewContentHash(report: ReportInput): string {
  return createHash("sha256").update(JSON.stringify({
    reportStaffId: report.reportStaffId,
    reportDate: new Date(report.reportDate).toISOString(),
    workContent: report.workContent || "",
    issues: report.issues || "",
    remarks: report.remarks || "",
    updatedAt: report.updatedAt ? new Date(report.updatedAt).toISOString() : null,
  })).digest("hex");
}

async function loadVerifiedReportStaffIdentity(
  db: Pick<ReviewDatabase, "execute">,
  report: ReportInput,
  lock = false,
): Promise<number | null> {
  const profileRows = rowsOf<{ linkedStaffId: number | null; creatorStaffId: number | null }>(await db.execute(sql`
    SELECT profile.linkedStaffId, creatorStaff.id AS creatorStaffId
    FROM report_staff profile
    INNER JOIN staff linkedStaff ON linkedStaff.id = profile.linkedStaffId
      AND linkedStaff.isActive = 'active'
      AND linkedStaff.archivedAt IS NULL
      AND linkedStaff.mergedIntoStaffId IS NULL
    LEFT JOIN users creatorUser ON creatorUser.id = ${report.createdBy}
    LEFT JOIN staff creatorStaff ON LOWER(TRIM(creatorStaff.email)) = LOWER(TRIM(creatorUser.email))
      AND creatorStaff.isActive = 'active'
      AND creatorStaff.archivedAt IS NULL
      AND creatorStaff.mergedIntoStaffId IS NULL
    WHERE profile.id = ${report.reportStaffId}
      AND profile.isActive = 'active'
      AND profile.archivedAt IS NULL
    LIMIT 1
    ${lock ? sql`FOR UPDATE` : sql``}
  `));
  const linkedStaffId = profileRows[0]?.linkedStaffId == null
    ? null
    : Number(profileRows[0].linkedStaffId);
  const creatorStaffId = profileRows[0]?.creatorStaffId == null
    ? null
    : Number(profileRows[0].creatorStaffId);
  return linkedStaffId && creatorStaffId === linkedStaffId ? linkedStaffId : null;
}

async function loadReviewCandidates(db: ReviewDatabase, report: ReportInput) {
  const reportDate = new Date(report.reportDate);
  const followupRows = rowsOf<any>(await db.execute(sql`
    SELECT followup.id, followup.extractedItem AS title,
      sourceReport.reportDate AS sourceDate, followup.dueDate AS deadline
    FROM report_followups followup
    INNER JOIN reports sourceReport ON sourceReport.id = followup.reportId
    WHERE followup.reportStaffId = ${report.reportStaffId}
      AND followup.status = 'pending'
      AND followup.archivedAt IS NULL
      AND followup.duplicateOfId IS NULL
      AND sourceReport.deletedAt IS NULL
      AND sourceReport.reportDate < ${reportDate}
    ORDER BY sourceReport.reportDate DESC, followup.id DESC
    LIMIT 80
  `));

  const linkedStaffId = await loadVerifiedReportStaffIdentity(db, report);
  if (!linkedStaffId) {
    return { candidates: [] as ReviewCandidate[], linkedStaffId: null };
  }

  const manualRows = linkedStaffId
    ? rowsOf<any>(await db.execute(sql`
        SELECT DISTINCT task.id, task.taskDetail AS title,
          FROM_UNIXTIME(task.startDate / 1000) AS sourceDate, task.deadline
        FROM tasks task
        WHERE task.status IN ('pending', 'in_progress')
          AND task.archivedAt IS NULL
          AND task.taskId NOT LIKE 'LCJB-%'
          AND NOT EXISTS (
            SELECT 1 FROM lcj_brain_project_execution_task_links brainLink
            WHERE brainLink.externalTaskId = task.id
          )
          AND task.startDate < ${reportDate.getTime()}
          AND (
            task.staffId = ${linkedStaffId}
            OR EXISTS (
              SELECT 1 FROM task_staff assignment
              WHERE assignment.taskId = task.id AND assignment.staffId = ${linkedStaffId}
            )
          )
        ORDER BY task.startDate DESC, task.id DESC
        LIMIT 80
      `))
    : [];

  const candidates: ReviewCandidate[] = [
    ...followupRows.map(row => ({
      source: "daily_report" as const,
      id: Number(row.id),
      title: String(row.title || ""),
      sourceDate: asDate(row.sourceDate),
      deadline: asDate(row.deadline),
    })),
    ...manualRows.map(row => ({
      source: "manual" as const,
      id: Number(row.id),
      title: String(row.title || ""),
      sourceDate: asDate(row.sourceDate),
      deadline: asDate(row.deadline),
    })),
  ].filter(candidate => candidate.id > 0 && candidate.title.trim().length > 0)
    .sort((left, right) => (right.sourceDate?.getTime() || 0) - (left.sourceDate?.getTime() || 0))
    .slice(0, 100);

  return { candidates, linkedStaffId };
}

function buildReviewPrompt(report: ReportInput, candidates: ReviewCandidate[]) {
  return [
    `今回の日報日: ${new Date(report.reportDate).toISOString().slice(0, 10)}`,
    `業務内容 / 工作内容:\n${report.workContent || ""}`,
    `課題 / 问题:\n${report.issues || ""}`,
    `備考・明日予定 / 备注・明日计划:\n${report.remarks || ""}`,
    "",
    "以前から未完了の候補タスク / 之前尚未完成的候选任务:",
    JSON.stringify(candidates.map(candidate => ({
      source: candidate.source,
      id: candidate.id,
      title: candidate.title,
      sourceDate: candidate.sourceDate?.toISOString() || null,
      deadline: candidate.deadline?.toISOString() || null,
    }))),
  ].join("\n\n").slice(0, 28_000);
}

async function decideCompletions(report: ReportInput, candidates: ReviewCandidate[]) {
  if (candidates.length === 0) return [];
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `あなたは、次の日以降の日報を根拠に以前のタスクが完了したかを厳格に判定する業務監査アシスタントです。
你是根据后续日报严格判断旧任务是否已经完成的业务审核助手。

规则：
- 日报明确写明“完成、已发送、已提交、已修复、已确认完毕、对应完了”等，或清楚记载了与任务完全对应的完成结果时，才判 completed。
- “进行中、计划、明天做、等待、准备、需确认、未完成、受阻”一律 keep。
- 仅凭主题相似、提到同一客户、模糊推测不得判完成。
- 每个候选必须返回一条decision；source和id必须原样返回。
- completed的confidence必须至少0.90，并在evidence中引用日报里的具体完成事实；无法引用就keep。
- 不新增任务，本步骤只复核候选任务。`,
      },
      { role: "user", content: buildReviewPrompt(report, candidates) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "daily_report_task_completion_review",
        strict: true,
        schema: {
          type: "object",
          properties: {
            decisions: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                properties: {
                  source: { type: "string", enum: ["daily_report", "manual"] },
                  id: { type: "integer", minimum: 1 },
                  outcome: { type: "string", enum: ["completed", "keep"] },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  reason: { type: "string" },
                  evidence: { type: "string" },
                },
                required: ["source", "id", "outcome", "confidence", "reason", "evidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["decisions"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  const parsed = completionReviewSchema.parse(JSON.parse(typeof content === "string" ? content : "{}"));
  const allowed = new Set(candidates.map(candidate => `${candidate.source}:${candidate.id}`));
  return parsed.decisions.filter(decision => allowed.has(`${decision.source}:${decision.id}`));
}

async function completeReportFollowup(
  transaction: ReviewTransaction,
  report: ReportInput,
  decision: CompletionDecision,
) {
  const rows = rowsOf<any>(await transaction.execute(sql`
    SELECT id, reportStaffId, status, completedAt, resultCategory, resultNote,
      requiresAcceptance, completionRevision
    FROM report_followups
    WHERE id = ${decision.id}
      AND archivedAt IS NULL
      AND duplicateOfId IS NULL
    FOR UPDATE
  `));
  const current = rows[0];
  if (!current || Number(current.reportStaffId) !== report.reportStaffId || String(current.status) !== "pending") {
    return false;
  }
  const completedAt = new Date();
  const completionRevision = Number(current.completionRevision || 0) + 1;
  const completionRequestId = `daily-report-review:${report.id}:followup:${decision.id}:v${completionRevision}`;
  const resultNote = `AI次日日報復核：${decision.reason}（根拠：${decision.evidence}）`;
  const after = {
    ...current,
    status: "completed",
    completedAt,
    resultCategory: "完了",
    resultNote,
    completedNote: resultNote,
    reviewReportId: report.id,
    requiresAcceptance: true,
    completionRevision,
    completionRequestId,
  };
  await transaction.execute(sql`
    INSERT INTO entity_revision_audits
      (entityType, entityId, action, actorUserId, beforeState, afterState)
    VALUES ('report_followup', ${decision.id}, 'ai_next_report_completion_submitted', NULL,
      ${JSON.stringify(current)}, ${JSON.stringify(after)})
  `);
  await transaction.execute(sql`
    UPDATE report_followups
    SET status = 'completed', completedAt = ${completedAt}, resultCategory = '完了',
      resultNote = ${resultNote}, completedNote = ${resultNote},
      requiresAcceptance = TRUE, completionRevision = ${completionRevision},
      completionRequestId = ${completionRequestId}, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${decision.id} AND status = 'pending'
      AND archivedAt IS NULL AND duplicateOfId IS NULL
  `);
  return true;
}

async function completeManualTask(
  transaction: ReviewTransaction,
  report: ReportInput,
  linkedStaffId: number | null,
  decision: CompletionDecision,
) {
  if (!linkedStaffId) return false;
  const taskRows = rowsOf<any>(await transaction.execute(sql`
    SELECT id, taskId, status, completedAt, createdBy, requiresAcceptance
    FROM tasks
    WHERE id = ${decision.id} AND archivedAt IS NULL
    FOR UPDATE
  `));
  const task = taskRows[0];
  if (!task || !["pending", "in_progress"].includes(String(task.status)) || String(task.taskId).startsWith("LCJB-")) {
    return false;
  }
  const assignmentRows = rowsOf<any>(await transaction.execute(sql`
    SELECT 1 AS assigned
    FROM tasks candidate
    WHERE candidate.id = ${decision.id}
      AND (
        candidate.staffId = ${linkedStaffId}
        OR EXISTS (
          SELECT 1 FROM task_staff assignment
          WHERE assignment.taskId = candidate.id AND assignment.staffId = ${linkedStaffId}
        )
      )
    LIMIT 1
  `));
  if (!assignmentRows[0]) return false;
  const brainLinkRows = rowsOf<any>(await transaction.execute(sql`
    SELECT 1 AS linked
    FROM lcj_brain_project_execution_task_links
    WHERE externalTaskId = ${decision.id}
    LIMIT 1
  `));
  if (brainLinkRows[0]) return false;

  const requestId = `daily-report-review:${report.id}:task:${decision.id}`;
  const existing = rowsOf<any>(await transaction.execute(sql`
    SELECT id FROM task_execution_feedbacks WHERE requestId = ${requestId} LIMIT 1
  `));
  if (existing[0]) return false;
  const latestFeedback = rowsOf<any>(await transaction.execute(sql`
    SELECT status, submittedAt
    FROM task_execution_feedbacks
    WHERE taskId = ${decision.id} AND staffId = ${linkedStaffId}
    ORDER BY id DESC
    LIMIT 1
  `));
  if (["completed", "cancelled"].includes(String(latestFeedback[0]?.status || ""))) {
    return false;
  }
  const latestSubmittedAt = asDate(latestFeedback[0]?.submittedAt);
  if (latestSubmittedAt && latestSubmittedAt.getTime() >= new Date(report.updatedAt).getTime()) {
    return false;
  }
  const completedAt = Date.now();
  const feedbackNote = `AI次日日報復核：${decision.reason}（根拠：${decision.evidence}）`;
  const [insertedFeedback] = await transaction.insert(taskExecutionFeedbacks).values({
    requestId,
    taskId: decision.id,
    staffId: linkedStaffId,
    status: "completed",
    feedbackNote,
    evidenceUrl: null,
    acknowledgedAt: completedAt,
    completedAt,
    submittedByUserId: report.createdBy,
  }).$returningId();
  if (!insertedFeedback?.id) throw new Error("Failed to persist AI daily report task completion");
  if (Number(task.createdBy) !== report.createdBy) {
    await transaction.insert(taskNotificationOutbox).values({
      notificationKey: `feedback:${insertedFeedback.id}:creator`,
      eventType: "feedback_creator",
      taskId: decision.id,
      staffId: linkedStaffId,
      recipientUserId: Number(task.createdBy),
      feedbackId: insertedFeedback.id,
      feedbackStatus: "completed",
      status: "pending",
    });
  }

  const stateRows = rowsOf<any>(await transaction.execute(sql`
    SELECT assigned.staffId,
      COALESCE(latest.status, CASE WHEN task.status = 'completed' THEN 'completed' ELSE 'pending' END) AS status,
      latest.completedAt, review.decision AS reviewDecision
    FROM tasks task
    INNER JOIN (
      SELECT taskId, staffId FROM task_staff WHERE taskId = ${decision.id}
      UNION
      SELECT id AS taskId, staffId FROM tasks
      WHERE id = ${decision.id}
        AND NOT EXISTS (
          SELECT 1 FROM task_staff existing
          WHERE existing.taskId = tasks.id AND existing.staffId = tasks.staffId
        )
    ) assigned ON assigned.taskId = task.id
    INNER JOIN staff activeStaff ON activeStaff.id = assigned.staffId
      AND activeStaff.isActive = 'active'
      AND activeStaff.archivedAt IS NULL
      AND activeStaff.mergedIntoStaffId IS NULL
    LEFT JOIN task_execution_feedbacks latest ON latest.id = (
      SELECT MAX(history.id) FROM task_execution_feedbacks history
      WHERE history.taskId = task.id AND history.staffId = assigned.staffId
    )
    LEFT JOIN task_completion_review_events review
      ON review.sourceType = 'manual'
      AND review.sourceId = task.id
      AND review.subjectKey = CONCAT('staff:', assigned.staffId)
      AND review.completionVersion = latest.id
    WHERE task.id = ${decision.id}
  `));
  const activeStates = stateRows.filter(row => String(row.status) !== "cancelled");
  const aggregateStatus = activeStates.length > 0 && activeStates.every(row =>
    String(row.status) === "completed"
    && (!Boolean(task.requiresAcceptance) || String(row.reviewDecision) === "accepted")
  )
    ? "completed"
    : "in_progress";
  const completedTimes = activeStates
    .map(row => row.completedAt == null ? null : Number(row.completedAt))
    .filter((value): value is number => value != null);
  const aggregateCompletedAt = aggregateStatus === "completed" && completedTimes.length > 0
    ? Math.max(...completedTimes)
    : null;
  const after = {
    status: aggregateStatus,
    completedAt: aggregateCompletedAt,
    completedByStaffId: linkedStaffId,
    reviewReportId: report.id,
    reason: decision.reason,
    evidence: decision.evidence,
  };
  await transaction.execute(sql`
    INSERT INTO entity_revision_audits
      (entityType, entityId, action, actorUserId, beforeState, afterState)
    VALUES ('task', ${decision.id}, 'ai_next_report_complete', NULL,
      ${JSON.stringify({ status: task.status, completedAt: task.completedAt })}, ${JSON.stringify(after)})
  `);
  await transaction.execute(sql`
    UPDATE tasks
    SET status = ${aggregateStatus}, completedAt = ${aggregateCompletedAt}, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${decision.id} AND status IN ('pending', 'in_progress') AND archivedAt IS NULL
  `);
  return true;
}

export async function autoReviewPreviousTasksFromReport(
  report: ReportInput,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  await ensureTaskExecutionTables();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { candidates, linkedStaffId } = await loadReviewCandidates(db, report);
  if (candidates.length === 0) {
    return { reviewedCount: 0, completedCount: 0, keptCount: 0, status: "succeeded" };
  }
  const decisions = await decideCompletions(report, candidates);
  const reportEvidenceText = [report.workContent, report.issues, report.remarks]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
  const completionDecisions = decisions.filter(decision =>
    decision.outcome === "completed"
    && decision.confidence >= 0.9
    && reportEvidenceText.includes(decision.evidence.trim())
  );
  const completedCount = await db.transaction(async transaction => {
    const reportRows = rowsOf<any>(await transaction.execute(sql`
      SELECT id, reportStaffId, reportDate, workContent, issues, remarks, createdBy, updatedAt
      FROM reports
      WHERE id = ${report.id} AND deletedAt IS NULL
      FOR UPDATE
    `));
    const current = reportRows[0];
    if (!current || !current.updatedAt || reportReviewContentHash({
      id: Number(current.id),
      reportStaffId: Number(current.reportStaffId),
      reportDate: new Date(current.reportDate),
      workContent: String(current.workContent || ""),
      issues: current.issues == null ? null : String(current.issues),
      remarks: current.remarks == null ? null : String(current.remarks),
      createdBy: Number(current.createdBy),
      updatedAt: new Date(current.updatedAt),
    }) !== reportReviewContentHash(report)) {
      throw new Error("Stale daily report completion review superseded by a newer report version");
    }
    const currentLinkedStaffId = await loadVerifiedReportStaffIdentity(transaction, report, true);
    if (!currentLinkedStaffId || currentLinkedStaffId !== linkedStaffId) {
      throw new Error("Daily report employee identity changed during completion review");
    }
    if (options.assertBeforeCommit) await options.assertBeforeCommit(transaction);

    let completed = 0;
    for (const decision of completionDecisions) {
      const changed = decision.source === "daily_report"
        ? await completeReportFollowup(transaction, report, decision)
        : await completeManualTask(transaction, report, linkedStaffId, decision);
      if (changed) completed += 1;
    }
    return completed;
  });
  return {
    reviewedCount: candidates.length,
    completedCount,
    keptCount: Math.max(0, candidates.length - completedCount),
    status: "succeeded",
  };
}

export async function safelyReviewPreviousTasksFromReport(
  report: ReportInput,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  try {
    return await autoReviewPreviousTasksFromReport(report, options);
  } catch (error) {
    console.warn("[Daily report task review] Automatic review failed", {
      reportId: report.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { reviewedCount: 0, completedCount: 0, keptCount: 0, status: "failed" };
  }
}

export async function processDailyReportTaskLifecycle(
  report: ReportInput,
  options: { forceExtraction?: boolean } = {},
): Promise<ReportTaskLifecycleResult> {
  const review = await safelyReviewPreviousTasksFromReport(report);
  const extraction = options.forceExtraction
    ? await extractAndCreateReportFollowups(report, { force: true })
    : await safelyExtractReportFollowups(report);
  if (review.status === "failed" && extraction.status === "succeeded" && extraction.runId) {
    try {
      const db = await getDb();
      if (db) {
        await db.update(reportFollowupExtractionRuns).set({
          status: "failed",
          errorCode: "TASK_REVIEW_FAILED",
          errorMessage: "Daily report task completion review requires retry",
          nextAttemptAt: sql`CASE
            WHEN ${reportFollowupExtractionRuns.attempts} >= 5 THEN NULL
            ELSE DATE_ADD(CURRENT_TIMESTAMP, INTERVAL LEAST(3600, 60 * POW(2, GREATEST(0, ${reportFollowupExtractionRuns.attempts} - 1))) SECOND)
          END`,
          finishedAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
          deadLetterAt: sql`CASE
            WHEN ${reportFollowupExtractionRuns.attempts} >= 5 THEN CURRENT_TIMESTAMP
            ELSE NULL
          END`,
        }).where(and(
          eq(reportFollowupExtractionRuns.id, extraction.runId),
          eq(reportFollowupExtractionRuns.status, "succeeded"),
        ));
      }
    } catch (error) {
      console.warn("[Daily report task review] Failed to queue retry marker", {
        reportId: report.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  return { review, extraction };
}

export async function processDailyReportTaskLifecycleBatch(reports: ReportInput[], concurrency = 4) {
  const groups = new Map<number, ReportInput[]>();
  for (const report of reports) {
    const list = groups.get(report.reportStaffId) || [];
    list.push(report);
    groups.set(report.reportStaffId, list);
  }
  const staffQueues = [...groups.values()].map(queue => queue.sort((left, right) =>
    new Date(left.reportDate).getTime() - new Date(right.reportDate).getTime() || left.id - right.id
  ));
  const workerCount = Math.max(1, Math.min(4, concurrency, staffQueues.length || 1));
  let nextQueue = 0;
  let reportsProcessed = 0;
  let totalExtracted = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalArchived = 0;
  let failedCount = 0;
  let totalReviewed = 0;
  let totalAutoCompleted = 0;
  let reviewFailedCount = 0;
  const failedRuns: Array<{ reportId: number; runId: number | null }> = [];

  async function worker() {
    while (nextQueue < staffQueues.length) {
      const queue = staffQueues[nextQueue++];
      for (const report of queue) {
        const result = await processDailyReportTaskLifecycle(report);
        reportsProcessed += 1;
        totalExtracted += result.extraction.extractedCount;
        totalCreated += result.extraction.createdCount;
        totalUpdated += result.extraction.updatedCount;
        totalArchived += result.extraction.archivedCount;
        totalReviewed += result.review.reviewedCount;
        totalAutoCompleted += result.review.completedCount;
        if (result.review.status === "failed") reviewFailedCount += 1;
        if (result.extraction.status !== "succeeded") {
          failedCount += 1;
          failedRuns.push({ reportId: report.id, runId: result.extraction.runId });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return {
    reportsProcessed,
    totalExtracted,
    totalCreated,
    totalUpdated,
    totalArchived,
    failedCount,
    failedRuns,
    totalReviewed,
    totalAutoCompleted,
    reviewFailedCount,
  };
}
