import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { extractAndCreateReportFollowups, reportExtractionContentHash } from "./reportFollowupAutomation";

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
      SELECT run.id AS runId, run.reportContentHash, r.id, r.reportStaffId, r.reportDate, r.workContent, r.issues, r.remarks, r.updatedAt
      FROM report_followup_extraction_runs run
      INNER JOIN reports r ON r.id = run.reportId
        AND r.updatedAt = run.reportUpdatedAt
        AND r.deletedAt IS NULL
      WHERE run.status = 'failed'
        AND run.deadLetterAt IS NULL
        AND (run.nextAttemptAt IS NULL OR run.nextAttemptAt <= CURRENT_TIMESTAMP)
      ORDER BY run.nextAttemptAt ASC, run.id ASC
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
      const extraction = await extractAndCreateReportFollowups(currentReport);
      if (extraction.status === "succeeded") succeeded += 1;
      else if (extraction.status === "failed") failed += 1;
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
