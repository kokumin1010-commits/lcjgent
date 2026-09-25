import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { reportExtractionContentHash } from "./reportFollowupAutomation";
import {
  processDailyReportTaskLifecycle,
  safelyReviewPreviousTasksFromReport,
} from "./dailyReportTaskReview";

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

export async function retryFailedReportFollowupExtractions(limit = 10) {
  if (running) return { processed: 0, succeeded: 0, failed: 0, skipped: true };
  running = true;
  try {
    const db = await getDb();
    if (!db) return { processed: 0, succeeded: 0, failed: 0, skipped: true };
    const result = await db.execute(sql`
      SELECT run.id AS runId, run.reportContentHash, run.errorCode, run.attempts,
        r.id, r.reportStaffId, r.reportDate,
        r.workContent, r.issues, r.remarks, r.createdBy, r.updatedAt
      FROM report_followup_extraction_runs run
      INNER JOIN reports r ON r.id = run.reportId
        AND r.updatedAt = run.reportUpdatedAt
        AND r.deletedAt IS NULL
      WHERE run.deadLetterAt IS NULL
        AND (
          (run.status = 'failed' AND (run.nextAttemptAt IS NULL OR run.nextAttemptAt <= CURRENT_TIMESTAMP))
          OR (run.status = 'running' AND (run.leaseUntil IS NULL OR run.leaseUntil <= CURRENT_TIMESTAMP))
        )
      ORDER BY COALESCE(run.nextAttemptAt, run.leaseUntil, run.startedAt) ASC, run.id ASC
      LIMIT ${Math.max(1, Math.min(25, limit))}
    `);
    const pending = rowsOf<any>(result);
    let succeeded = 0;
    let failed = 0;
    for (const row of pending) {
      const currentReport = {
        id: Number(row.id),
        reportStaffId: Number(row.reportStaffId),
        reportDate: new Date(row.reportDate),
        workContent: row.workContent || null,
        issues: row.issues || null,
        remarks: row.remarks || null,
        createdBy: Number(row.createdBy),
        updatedAt: new Date(row.updatedAt),
      };
      if (row.reportContentHash && row.reportContentHash !== reportExtractionContentHash(currentReport)) {
        await db.execute(sql`
          UPDATE report_followup_extraction_runs
          SET deadLetterAt = CURRENT_TIMESTAMP, nextAttemptAt = NULL,
              errorCode = 'SUPERSEDED', errorMessage = 'Report content changed before retry'
          WHERE id = ${Number(row.runId)}
        `);
        continue;
      }
      if (row.errorCode === "TASK_REVIEW_FAILED") {
        const leaseToken = randomUUID();
        const claimed = await db.execute(sql`
          UPDATE report_followup_extraction_runs
          SET status = 'running', attempts = attempts + 1,
              leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE),
              leaseToken = ${leaseToken}, startedAt = CURRENT_TIMESTAMP,
              finishedAt = NULL, nextAttemptAt = NULL
          WHERE id = ${Number(row.runId)}
            AND errorCode = 'TASK_REVIEW_FAILED'
            AND deadLetterAt IS NULL
            AND attempts < 5
            AND (
              (status = 'failed' AND (nextAttemptAt IS NULL OR nextAttemptAt <= CURRENT_TIMESTAMP))
              OR (status = 'running' AND (leaseUntil IS NULL OR leaseUntil <= CURRENT_TIMESTAMP))
            )
        `);
        if (Number((claimed as any)?.[0]?.affectedRows || 0) !== 1) continue;
        const renewLease = () => db.execute(sql`
          UPDATE report_followup_extraction_runs
          SET leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
          WHERE id = ${Number(row.runId)} AND status = 'running'
            AND errorCode = 'TASK_REVIEW_FAILED' AND leaseToken = ${leaseToken}
            AND leaseUntil > CURRENT_TIMESTAMP
        `);
        const heartbeat = setInterval(() => {
          void renewLease().catch(error => console.warn("[ReportFollowupRetry] review lease renewal failed", {
            runId: Number(row.runId),
            errorName: error instanceof Error ? error.name : "UnknownError",
          }));
        }, 60_000);
        let review;
        try {
          review = await safelyReviewPreviousTasksFromReport(currentReport, {
            assertBeforeCommit: async transaction => {
              const renewed = await transaction.execute(sql`
                UPDATE report_followup_extraction_runs
                SET leaseUntil = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
                WHERE id = ${Number(row.runId)} AND status = 'running'
                  AND errorCode = 'TASK_REVIEW_FAILED' AND leaseToken = ${leaseToken}
                  AND leaseUntil > CURRENT_TIMESTAMP
              `);
              if (Number((renewed as any)?.[0]?.affectedRows || 0) !== 1) {
                throw new Error("Daily report task review lease was lost before completion");
              }
            },
          });
        } finally {
          clearInterval(heartbeat);
        }
        if (review.status === "succeeded") {
          const completed = await db.execute(sql`
            UPDATE report_followup_extraction_runs
            SET status = 'succeeded', errorCode = NULL, errorMessage = NULL,
                finishedAt = CURRENT_TIMESTAMP, nextAttemptAt = NULL, deadLetterAt = NULL,
                leaseUntil = NULL, leaseToken = NULL
            WHERE id = ${Number(row.runId)} AND status = 'running' AND leaseToken = ${leaseToken}
          `);
          if (Number((completed as any)?.[0]?.affectedRows || 0) === 1) succeeded += 1;
          else failed += 1;
        } else {
          await db.execute(sql`
            UPDATE report_followup_extraction_runs
            SET status = 'failed', errorCode = 'TASK_REVIEW_FAILED',
                errorMessage = 'Daily report task completion review requires retry',
                finishedAt = CURRENT_TIMESTAMP, leaseUntil = NULL, leaseToken = NULL,
                nextAttemptAt = CASE WHEN attempts >= 5 THEN NULL ELSE
                  DATE_ADD(CURRENT_TIMESTAMP, INTERVAL LEAST(3600, 60 * POW(2, GREATEST(0, attempts - 1))) SECOND)
                END,
                deadLetterAt = CASE WHEN attempts >= 5 THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE id = ${Number(row.runId)} AND status = 'running' AND leaseToken = ${leaseToken}
          `);
          failed += 1;
        }
        continue;
      }
      const lifecycle = await processDailyReportTaskLifecycle(currentReport);
      if (lifecycle.extraction.status === "succeeded" && lifecycle.review.status === "succeeded") succeeded += 1;
      else failed += 1;
    }
    return { processed: pending.length, succeeded, failed, skipped: false };
  } finally {
    running = false;
  }
}

export function startReportFollowupRetryScheduler() {
  if (intervalId) return;
  const run = () => retryFailedReportFollowupExtractions().catch(error => {
    console.error("[ReportFollowupRetry] retry cycle failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
  });
  setTimeout(run, 30_000);
  intervalId = setInterval(run, 60_000);
}

export function stopReportFollowupRetryScheduler() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
