import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_BD_AI_ANALYSIS_TYPES,
  isBrandBdAiDraftType,
  toJstDateKey,
} from "../shared/brandBdCommand";
import { buildBrandBdMeetingNotificationKey } from "./brandBdCommandService";

const source = (path: string) => readFileSync(path, "utf8");

describe("brand BD command center", () => {
  it("keeps shared AI types and JST dates deterministic", () => {
    expect(BRAND_BD_AI_ANALYSIS_TYPES).toContain("next_strategy");
    expect(BRAND_BD_AI_ANALYSIS_TYPES).toContain("executive_summary");
    expect(isBrandBdAiDraftType("followup_draft")).toBe(true);
    expect(isBrandBdAiDraftType("send_email")).toBe(false);
    expect(toJstDateKey("2026-09-21T16:00:00.000Z")).toBe("2026-09-22");
  });

  it("uses stable reminder idempotency keys", () => {
    expect(buildBrandBdMeetingNotificationKey(12, "staff", 9, 60)).toBe(
      "brand-bd-meeting:12:staff:9:60"
    );
  });

  it("migrates the interaction, meeting, task, AI, reminder and audit stores", () => {
    const migration = source("drizzle/0155_brand_bd_command_center.sql");
    const journal = source("drizzle/meta/_journal.json");
    const runner = source("run-migrations.mjs");
    for (const table of [
      "brand_bd_interactions",
      "brand_bd_interaction_files",
      "brand_bd_meetings",
      "brand_bd_task_links",
      "brand_bd_ai_snapshots",
      "brand_bd_meeting_reminder_outbox",
      "brand_bd_command_audit_logs",
    ]) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("'/master/brand-bd-command'");
    expect(migration).toContain("'/master/brands'");
    expect(journal).toContain('"tag": "0155_brand_bd_command_center"');
    expect(runner).toContain("0155_brand_bd_command_center.sql");
  });

  it("enforces object-level brand access and appends auditable interactions", () => {
    const service = source("server/brandBdCommandService.ts");
    const upgrade = source("server/brandBusinessUpgrade.ts");
    expect(service).toContain("resolveTaskExecutionAccess");
    expect(service).toContain("canAccessBrand");
    expect(service).toContain("access.reviewableStaffIds.includes");
    expect(service).toContain("无权查看或更新该品牌的BD记录");
    expect(upgrade).toContain('"brand_bd_command_audit_logs"');
    expect(upgrade).toContain("brandBdPagePermissionExists");
    expect(upgrade).toContain("pageKey='/master/brand-bd-command'");
    expect(service).toContain("brand_business_events");
  });

  it("creates meetings, tasks, assignments and notification outbox records atomically", () => {
    const service = source("server/brandBdCommandService.ts");
    expect(service).toContain("await connection.beginTransaction()");
    expect(service).toContain(
      "brand-bd-meeting:${actor.id}:${input.brandId}:${input.requestId}"
    );
    expect(service).toContain("INSERT INTO brand_bd_meetings");
    expect(service).toContain("INSERT INTO tasks");
    expect(service).toContain("INSERT IGNORE INTO task_staff");
    expect(service).toContain("task_notification_outbox");
    expect(service).toContain("brand_bd_task_links");
    expect(service).toContain("await connection.commit()");
    expect(service).toContain("await connection.rollback()");
    expect(service).toContain("status='completed',completedAt=COALESCE");
  });

  it("delivers boss and employee reminders from a leased idempotent outbox", () => {
    const scheduler = source("server/brandBdMeetingReminderScheduler.ts");
    expect(scheduler).toContain("listBrandBdCoreBossUserIds");
    expect(scheduler).toContain(
      "INSERT IGNORE INTO brand_bd_meeting_reminder_outbox"
    );
    expect(scheduler).toContain("leaseToken");
    expect(scheduler).toContain("attempts<5");
    expect(scheduler).toContain("recoverExpiredLeases");
    expect(scheduler).toContain("LEASE_RECOVERED_BEFORE_DELIVERY");
    expect(scheduler).toContain("DELIVERY_OUTCOME_UNKNOWN");
    expect(scheduler).toContain("status='manual_review'");
    expect(scheduler).toContain("EMAIL_PROVIDER_THROW");
    expect(scheduler).toContain(
      "idempotencyKey: String(delivery.notificationKey)"
    );
    expect(scheduler).toContain("startBrandBdMeetingReminderScheduler");
  });

  it("keeps AI read-only, evidence-bound and human-approved", () => {
    const service = source("server/brandBdCommandService.ts");
    expect(service).toContain('const model = "gpt-5-mini"');
    expect(service).toContain('type: "json_schema"');
    expect(service).toContain("只能依据提供的JSON事实");
    expect(service).toContain("所有对外跟进内容只能标记为草稿");
    expect(service).toContain("attachmentExtractedText");
    expect(service).toContain(
      "WHERE brandId <=> ? AND analysisType=? AND sourceHash=? AND model=?"
    );
    expect(service).not.toContain("AI自动发送品牌消息");
  });

  it("protects uploads and never sends file names or storage paths into Brain", () => {
    const index = source("server/_core/index.ts");
    const brain = source("server/lcjBrainTools.ts");
    expect(index).toContain("brand-bd-interaction-file-upload");
    expect(index).toContain("文件内容与声明类型不一致");
    expect(index).toContain('toString("ascii") === "%PDF-"');
    expect(index.indexOf("requireBrandBdInteractionAccess")).toBeLessThan(
      index.indexOf('brandBdUpload.single("file")')
    );
    expect(index).toContain("brand-bd-interaction-files/:fileId");
    expect(index).toContain("getAuthorizedBrandBdAttachment");
    expect(index).toContain("await storageGet(attachment.fileKey)");
    const bdUploadSection = index.slice(
      index.indexOf("brand-bd-interaction-file-upload"),
      index.indexOf('app.post("/api/brand-file-upload"')
    );
    expect(bdUploadSection).not.toContain("fileUrl: stored.url");
    expect(index).toContain("sdk.authenticateRequest(req)");
    expect(index).toContain("attachBrandBdInteractionFile");
    expect(index).toContain('app.post("/api/brand-file-upload", async');
    expect(brain).toContain("get_brand_bd_command_data");
    expect(brain).toContain("attachmentCount: interaction.files.length");
  });

  it("exposes the command center in the brand domain with all approved workflows", () => {
    const app = source("client/src/App.tsx");
    const menu = source("client/src/lib/adminMenuConfig.ts");
    const page = source("client/src/pages/BrandBdCommandCenter.tsx");
    const brandList = source("client/src/pages/BrandList.tsx");
    expect(app).toContain("/master/brand-bd-command");
    expect(menu).toContain('labelZh: "品牌 BD 指挥塔"');
    expect(brandList).toContain('href="/master/brand-bd-command"');
    expect(page).toContain("记录洽谈");
    expect(page).toContain("安排会议");
    expect(page).toContain("全部BD日程");
    expect(page).toContain("AI 商务副驾");
    expect(page).toContain("生成全局老板摘要");
    expect(page).toContain("创建会议和任务");
    expect(page).toContain("requestId: meetingRequestId");
    expect(page).toContain("const [meetingRequestId, setMeetingRequestId]");
  });
});
