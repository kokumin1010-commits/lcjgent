import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import {
  reportFollowupExtractionRuns,
  reportFollowups,
  reports,
  type Report,
} from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { getDb, reportFollowupDedupeKey } from "./db";

const reportTaskCategorySchema = z.enum([
  "提案", "打ち合わせ", "商談", "MTG", "確認", "その他",
]);

const reportTaskExtractionSchema = z.object({
  items: z.array(z.object({
    item: z.string().trim().min(1).max(200),
    category: reportTaskCategorySchema,
    daysUntilDue: z.number().int().min(0).max(30),
  })).max(12),
});

type ReportInput = Pick<
  Report,
  "id" | "reportStaffId" | "reportDate" | "workContent" | "issues" | "remarks" | "updatedAt"
>;

export type ReportTaskExtractionResult = {
  extractedCount: number;
  createdCount: number;
  updatedCount: number;
  archivedCount: number;
  runId: number | null;
  status: "running" | "succeeded" | "failed";
};

function buildDueDate(reportDate: Date, daysUntilDue: number) {
  const jst = new Date(reportDate.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate() + daysUntilDue,
    14, 59, 59, 999
  ));
}

function errorDetails(error: unknown) {
  const value = error instanceof Error ? error : new Error(String(error));
  return { code: value.name.slice(0, 120), message: value.message.slice(0, 4000) };
}

function isDuplicateEntryError(error: unknown): boolean {
  let current = error as any;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (current.code === "ER_DUP_ENTRY" || current.errno === 1062) return true;
    if (typeof current.message === "string" && current.message.includes("Duplicate entry")) return true;
    current = current.cause;
  }
  return false;
}

export function reportExtractionContentHash(report: ReportInput): string {
  return createHash("sha256").update(JSON.stringify({
    reportDate: new Date(report.reportDate).toISOString(),
    reportStaffId: report.reportStaffId,
    workContent: report.workContent || "",
    issues: report.issues || "",
    remarks: report.remarks || "",
  })).digest("hex");
}

async function startRun(report: ReportInput, force = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const version = report.updatedAt || new Date(0);
  const contentHash = reportExtractionContentHash(report);
  const jobKey = `${report.id}:${contentHash}`;
  const leaseUntil = new Date(Date.now() + 5 * 60 * 1000);
  const leaseToken = randomUUID();
  try {
    const [inserted] = await db.insert(reportFollowupExtractionRuns).values({
      jobKey,
      reportId: report.id,
      reportUpdatedAt: version,
      reportContentHash: contentHash,
      status: "running",
      attempts: 1,
      leaseUntil,
      leaseToken,
    }).$returningId();
    return { db, runId: Number(inserted.id), attempts: 1, leaseToken, claimed: true as const, cached: null };
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
  }
  const existingRows = await db.select().from(reportFollowupExtractionRuns)
    .where(eq(reportFollowupExtractionRuns.jobKey, jobKey)).limit(1);
  const existing = existingRows[0];
  if (!existing) throw new Error("Report extraction job reservation failed");
  if (existing.status === "succeeded") {
    return {
      db,
      runId: Number(existing.id),
      attempts: existing.attempts,
      leaseToken: null,
      claimed: false as const,
      cached: {
        extractedCount: existing.extractedCount,
        createdCount: existing.createdCount,
        updatedCount: existing.updatedCount,
        archivedCount: existing.archivedCount,
        runId: Number(existing.id),
        status: "succeeded" as const,
      },
    };
  }
  const now = new Date();
  const reclaim = await db.execute(sql`
    UPDATE report_followup_extraction_runs
    SET status = 'running', attempts = CASE WHEN ${force} = TRUE THEN 1 ELSE attempts + 1 END, leaseUntil = ${leaseUntil},
        leaseToken = ${leaseToken},
        startedAt = ${now}, finishedAt = NULL, errorCode = NULL, errorMessage = NULL,
        nextAttemptAt = NULL, deadLetterAt = NULL
    WHERE id = ${Number(existing.id)}
      AND (${force} = TRUE OR deadLetterAt IS NULL)
      AND (
        (status = 'failed' AND (${force} = TRUE OR nextAttemptAt IS NULL OR nextAttemptAt <= ${now}))
        OR (status = 'running' AND (leaseUntil IS NULL OR leaseUntil <= ${now}))
      )
  `);
  if (Number((reclaim as any)?.[0]?.affectedRows || 0) !== 1) {
    return {
      db,
      runId: Number(existing.id),
      attempts: existing.attempts,
      leaseToken: null,
      claimed: false as const,
      cached: {
        extractedCount: existing.extractedCount,
        createdCount: existing.createdCount,
        updatedCount: existing.updatedCount,
        archivedCount: existing.archivedCount,
        runId: Number(existing.id),
        status: existing.status === "running" ? "running" as const : "failed" as const,
      },
    };
  }
  return { db, runId: Number(existing.id), attempts: force ? 1 : existing.attempts + 1, leaseToken, claimed: true as const, cached: null };
}

async function reconcileSuccessfulExtraction(
  report: ReportInput,
  runId: number,
  leaseToken: string,
  items: z.infer<typeof reportTaskExtractionSchema>["items"]
): Promise<ReportTaskExtractionResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uniqueItems = Array.from(
    new Map(items.map(item => [reportFollowupDedupeKey(item.item), item])).entries()
  );

  return await db.transaction(async transaction => {
    const currentReports = await transaction.select({
      updatedAt: reports.updatedAt,
      reportDate: reports.reportDate,
      reportStaffId: reports.reportStaffId,
      workContent: reports.workContent,
      issues: reports.issues,
      remarks: reports.remarks,
    })
      .from(reports)
      .where(eq(reports.id, report.id))
      .for("update");
    const latestRuns = await transaction.select({
      id: reportFollowupExtractionRuns.id,
      status: reportFollowupExtractionRuns.status,
      leaseToken: reportFollowupExtractionRuns.leaseToken,
    })
      .from(reportFollowupExtractionRuns)
      .where(eq(reportFollowupExtractionRuns.reportId, report.id))
      .orderBy(desc(reportFollowupExtractionRuns.id))
      .limit(1)
      .for("update");
    const currentVersion = currentReports[0]?.updatedAt?.getTime() || null;
    const extractedVersion = report.updatedAt?.getTime() || null;
    const currentHash = currentReports[0]
      ? reportExtractionContentHash({ id: report.id, ...currentReports[0] })
      : null;
    if (!currentReports[0]
      || currentVersion !== extractedVersion
      || currentHash !== reportExtractionContentHash(report)
      || Number(latestRuns[0]?.id) !== runId
      || latestRuns[0]?.status !== "running"
      || latestRuns[0]?.leaseToken !== leaseToken) {
      throw new Error("Stale report extraction run superseded by a newer report version");
    }
    const existing = await transaction.select().from(reportFollowups).where(and(
      eq(reportFollowups.reportId, report.id),
      isNull(reportFollowups.duplicateOfId),
      isNull(reportFollowups.archivedAt)
    ));
    const byKey = new Map(existing.map(row => [row.dedupeKey || reportFollowupDedupeKey(row.extractedItem), row]));
    const observedKeys = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;
    let archivedCount = 0;

    for (const [dedupeKey, item] of uniqueItems) {
      observedKeys.add(dedupeKey);
      const current = byKey.get(dedupeKey);
      const dueDate = buildDueDate(new Date(report.reportDate), item.daysUntilDue);
      if (!current) {
        const createdValue = {
          reportId: report.id,
          reportStaffId: report.reportStaffId,
          extractedItem: item.item,
          category: item.category,
          status: "pending",
          dueDate,
          dedupeKey,
        } as const;
        const [inserted] = await transaction.insert(reportFollowups).values(createdValue).$returningId();
        if (!inserted?.id) throw new Error("Failed to create report followup");
        await transaction.execute(sql`
          INSERT INTO entity_revision_audits
            (entityType, entityId, action, actorUserId, beforeState, afterState)
          VALUES ('report_followup', ${inserted.id}, 'ai_reconcile_create', NULL, NULL,
            ${JSON.stringify({ ...createdValue, id: inserted.id, extractionRunId: runId })})
        `);
        createdCount += 1;
        continue;
      }
      if (current.status !== "pending") continue;
      const changed = current.category !== item.category
        || current.reportStaffId !== report.reportStaffId
        || current.dedupeKey !== dedupeKey
        || !current.dueDate
        || current.dueDate.getTime() !== dueDate.getTime();
      if (!changed) continue;
      const after = { ...current, category: item.category, reportStaffId: report.reportStaffId, dueDate, dedupeKey };
      await transaction.execute(sql`
        INSERT INTO entity_revision_audits
          (entityType, entityId, action, actorUserId, beforeState, afterState)
        VALUES ('report_followup', ${current.id}, 'ai_reconcile_update', NULL,
          ${JSON.stringify(current)}, ${JSON.stringify(after)})
      `);
      await transaction.update(reportFollowups).set({
        category: item.category,
        reportStaffId: report.reportStaffId,
        dueDate,
        dedupeKey,
      }).where(eq(reportFollowups.id, current.id));
      updatedCount += 1;
    }

    for (const current of existing) {
      const key = current.dedupeKey || reportFollowupDedupeKey(current.extractedItem);
      if (current.status !== "pending" || observedKeys.has(key)) continue;
      const change = {
        archivedAt: new Date(),
        archivedBy: null,
        archiveReason: `Superseded by successful extraction run ${runId}`,
        status: "cancelled" as const,
        dedupeKey: null,
      };
      await transaction.execute(sql`
        INSERT INTO entity_revision_audits
          (entityType, entityId, action, actorUserId, beforeState, afterState)
        VALUES ('report_followup', ${current.id}, 'ai_reconcile_archive', NULL,
          ${JSON.stringify(current)}, ${JSON.stringify({ ...current, ...change })})
      `);
      await transaction.update(reportFollowups).set(change).where(eq(reportFollowups.id, current.id));
      archivedCount += 1;
    }

    const completedRun = await transaction.update(reportFollowupExtractionRuns).set({
      status: "succeeded",
      extractedCount: uniqueItems.length,
      createdCount,
      updatedCount,
      archivedCount,
      finishedAt: new Date(),
      errorCode: null,
      errorMessage: null,
      leaseUntil: null,
      leaseToken: null,
      nextAttemptAt: null,
      deadLetterAt: null,
    }).where(and(
      eq(reportFollowupExtractionRuns.id, runId),
      eq(reportFollowupExtractionRuns.status, "running"),
      eq(reportFollowupExtractionRuns.leaseToken, leaseToken)
    ));
    if (Number((completedRun as any)?.[0]?.affectedRows || 0) !== 1) {
      throw new Error("Report extraction lease was lost before completion");
    }

    return {
      extractedCount: uniqueItems.length,
      createdCount,
      updatedCount,
      archivedCount,
      runId,
      status: "succeeded" as const,
    };
  });
}

export async function extractAndCreateReportFollowups(report: ReportInput, options: { force?: boolean } = {}) {
  const { db, runId, attempts, leaseToken, claimed, cached } = await startRun(report, options.force);
  if (!claimed && cached) return cached;
  if (!leaseToken) throw new Error("Report extraction lease token is missing");
  const heartbeat = setInterval(() => {
    void db.update(reportFollowupExtractionRuns).set({
      leaseUntil: new Date(Date.now() + 5 * 60 * 1000),
    }).where(and(
      eq(reportFollowupExtractionRuns.id, runId),
      eq(reportFollowupExtractionRuns.status, "running"),
      eq(reportFollowupExtractionRuns.leaseToken, leaseToken)
    )).catch(error => console.warn("[Report task extraction] Lease renewal failed", {
      reportId: report.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }));
  }, 60_000);
  heartbeat.unref?.();
  try {
    const reportText = [
      `業務内容 / 工作内容:\n${report.workContent || ""}`,
      `課題 / 问题:\n${report.issues || ""}`,
      `備考・明日予定 / 备注・明日计划:\n${report.remarks || ""}`,
    ].join("\n\n").slice(0, 20_000);
    const hasReportContent = [report.workContent, report.issues, report.remarks]
      .some(value => Boolean(value?.trim()));

    let items: z.infer<typeof reportTaskExtractionSchema>["items"] = [];
    if (hasReportContent) {
      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `あなたは日報から未完了の実行タスクだけを抽出する業務アシスタントです。
你是从日报中只提取尚未完成执行任务的业务助手。

ルール / 规则:
- すでに完了した作業、単なる実績・感想・報告はタスクにしない。
- 今後行う必要がある具体的な確認、連絡、提案、会議、商談、作成、提出、修正だけを抽出する。
- 担当者が明記されていなくても、日報提出者のタスクとして抽出する。
- 期限が明記されていなければ daysUntilDue は2。今日なら0、明日なら1。
- 同じ意味の項目は1件にまとめる。
- 原文と同じ言語で簡潔に書く。`,
          },
          { role: "user", content: reportText },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "daily_report_tasks",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  maxItems: 12,
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      category: { type: "string", enum: ["提案", "打ち合わせ", "商談", "MTG", "確認", "その他"] },
                      daysUntilDue: { type: "integer", minimum: 0, maximum: 30 },
                    },
                    required: ["item", "category", "daysUntilDue"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices[0]?.message?.content;
      items = reportTaskExtractionSchema.parse(JSON.parse(typeof content === "string" ? content : "{}")).items;
    }
    return await reconcileSuccessfulExtraction(report, runId, leaseToken, items);
  } catch (error) {
    const details = errorDetails(error);
    await db.update(reportFollowupExtractionRuns).set({
      status: "failed",
      errorCode: details.code,
      errorMessage: details.message,
      finishedAt: new Date(),
      leaseUntil: null,
      leaseToken: null,
      nextAttemptAt: attempts >= 5 ? null : new Date(Date.now() + Math.min(60 * 60, 60 * 2 ** Math.max(0, attempts - 1)) * 1000),
      deadLetterAt: attempts >= 5 ? new Date() : null,
    }).where(and(
      eq(reportFollowupExtractionRuns.id, runId),
      eq(reportFollowupExtractionRuns.status, "running"),
      eq(reportFollowupExtractionRuns.leaseToken, leaseToken)
    ));
    return { extractedCount: 0, createdCount: 0, updatedCount: 0, archivedCount: 0, runId, status: "failed" as const };
  } finally {
    clearInterval(heartbeat);
  }
}

export async function safelyExtractReportFollowups(report: ReportInput): Promise<ReportTaskExtractionResult> {
  try {
    return await extractAndCreateReportFollowups(report);
  } catch (error) {
    console.warn("[Report task extraction] Automatic extraction failed", {
      reportId: report.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { extractedCount: 0, createdCount: 0, updatedCount: 0, archivedCount: 0, runId: null, status: "failed" };
  }
}

export async function extractReportFollowupBatch(reports: ReportInput[], concurrency = 4) {
  const workerCount = Math.max(1, Math.min(4, concurrency));
  let nextIndex = 0;
  let totalExtracted = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalArchived = 0;
  let failedCount = 0;
  const failedRuns: Array<{ reportId: number; runId: number | null }> = [];

  async function worker() {
    while (nextIndex < reports.length) {
      const currentIndex = nextIndex++;
      const result = await safelyExtractReportFollowups(reports[currentIndex]);
      totalExtracted += result.extractedCount;
      totalCreated += result.createdCount;
      totalUpdated += result.updatedCount;
      totalArchived += result.archivedCount;
      if (result.status !== "succeeded") {
        failedCount += 1;
        failedRuns.push({ reportId: reports[currentIndex].id, runId: result.runId });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(workerCount, reports.length) }, () => worker()));
  return { reportsProcessed: reports.length, totalExtracted, totalCreated, totalUpdated, totalArchived, failedCount, failedRuns };
}
