import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const form = read("client/src/pages/ReportForm.tsx");
const routers = read("server/routers.ts");
const database = read("server/db.ts");
const scheduler = read("server/reportFollowupRetryScheduler.ts");
const upgrade = read("server/taskExecutionUpgrade.ts");
const schema = read("drizzle/schema.ts");
const migration = read("drizzle/0162_daily_report_reliable_submission.sql");
const journal = read("drizzle/meta/_journal.json");
const startupMigration = read("run-required-startup-migrations.mjs");

describe("daily report reliable submission", () => {
  it("uses one stable request id for retries of unchanged form data", () => {
    expect(form).toContain("lastCreateAttemptRef");
    expect(form).toContain("await hashReportPayload(JSON.stringify");
    expect(form).toContain("sessionStorage.getItem(reportCreateAttemptStorageKey(actorId, payloadKey))");
    expect(form).toContain("storeReportCreateAttempt(lastCreateAttemptRef.current)");
    expect(form).toContain("parsed?.actorId === actorId && parsed.payloadKey === payloadKey");
    expect(form).toContain("requestId: createReportRequestId()");
    expect(form).toContain("requestId: lastCreateAttemptRef.current.requestId");
    expect(form).toContain("lastCreateAttemptRef.current = null");
    expect(routers).toContain("requestId: z.string().uuid()");
    expect(routers).toContain("requestId: input.requestId");
  });

  it("enforces database idempotency and returns the original matching report", () => {
    expect(schema).toContain('requestId: varchar("requestId", { length: 36 })');
    expect(schema).toContain('uniqueIndex("uq_reports_request_id")');
    expect(database).toContain("reportMatchesCreationRequest");
    expect(database).toContain("replayed: true as const");
    expect(migration).toContain("ADD COLUMN `requestId` VARCHAR(36) NULL");
    expect(migration).toContain("CREATE UNIQUE INDEX `uq_reports_request_id`");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `entity_revision_audits`");
    expect(migration).toContain("ADD COLUMN `deletedAt` TIMESTAMP NULL");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `report_followup_extraction_runs`");
    expect(journal).toContain('"tag": "0162_daily_report_reliable_submission"');
    expect(startupMigration).toContain('"0161_tw_daily_line_bridge"');
    expect(startupMigration).toContain('"0162_daily_report_reliable_submission"');
    expect(startupMigration).toContain("REQUIRED_MIGRATION_TAGS.map");
    expect(upgrade).not.toContain("CREATE UNIQUE INDEX uq_reports_request_id ON reports(requestId)");
  });

  it("commits form create and update with their followup work item", () => {
    const createRoute = routers.slice(
      routers.indexOf("create: protectedProcedure", routers.indexOf("report: router")),
      routers.indexOf("list: protectedProcedure", routers.indexOf("report: router")),
    );
    const updateRoute = routers.slice(
      routers.indexOf("update: protectedProcedure", routers.indexOf("report: router")),
      routers.indexOf("delete: protectedProcedure", routers.indexOf("report: router")),
    );
    expect(database).toContain("await enqueueReportFollowupExtractionWithExecutor(transaction, created)");
    expect(database).toContain("await enqueueReportFollowupExtractionWithExecutor(transaction, after, true)");
    expect(routers).toContain('await updateReport(id, data, ctx.user.id, "update", true)');
    expect(database).toContain('status: "failed"');
    expect(database).toContain('errorCode: "QUEUED"');
    expect(database).toContain("UPDATE report_followup_extraction_runs");
    expect(database).toContain("reportUpdatedAt = ${report.updatedAt}");
    expect(database).toContain("errorCode = 'SUPERSEDED'");
    expect(database).toContain("await enqueueReportFollowupExtractionWithExecutor(transaction, after, true)");
    expect(createRoute).not.toContain("processDailyReportTaskLifecycle");
    expect(updateRoute).not.toContain("processDailyReportTaskLifecycle");
    expect(routers).toContain("await processDailyReportTaskLifecycle(report)");
    expect(scheduler).toContain("run.status = 'failed'");
    expect(scheduler).toContain("run.status = 'running'");
    expect(scheduler).toContain("run.leaseUntil IS NULL OR run.leaseUntil <= CURRENT_TIMESTAMP");
  });

  it("shows actionable error codes and browser-decodable mobile previews", () => {
    expect(form).toContain("[REPORT-NETWORK]");
    expect(form).toContain("[REPORT-IMAGE-UPLOAD]");
    expect(form).toContain("[REPORT-IMAGE-DECODE]");
    expect(form).toContain("fileToDataUrl");
    expect(form).toContain("canDecodeImage");
    expect(form).toContain("hashPendingImage");
    expect(form).toContain("uploadId: img.uploadId");
    expect(form).not.toContain("URL.createObjectURL(file)");
    expect(form).toContain("支持 JPG/PNG/WEBP，最大5MB");
    expect(schema).toContain('uploadId: varchar("uploadId", { length: 64 })');
    expect(schema).toContain('contentHash: varchar("contentHash", { length: 64 })');
    expect(schema).toContain('uniqueIndex("uq_report_attachments_upload")');
    expect(routers).toContain("getReportAttachmentByUploadId(input.reportId, input.uploadId)");
    expect(routers).toContain("[REPORT-ATTACHMENT-CONFLICT]");
    expect(migration).toContain("CREATE UNIQUE INDEX `uq_report_attachments_upload`");
  });
});
