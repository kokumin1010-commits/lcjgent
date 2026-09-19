import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  festivalBulkEmailCampaigns,
  festivalBulkEmailRecipients,
  festivalCompanyApplications,
  festivalGeneralApplications,
  festivalLiverApplications,
  festivalSponsors,
} from "../drizzle/schema";
import { getDb } from "./db";
import { sendLcfEmail, validateLcfEmailContent } from "./lcfAdminEmailService";

export type LcfBulkAudienceType = "company" | "liver" | "general" | "sponsor";
export type LcfBulkEventFilter = "all" | "2026" | "2026-02";
export type LcfBulkApplicationStatus = "new" | "confirmed" | "rejected" | "cancelled";
export type LcfBulkAttendanceFilter = "all" | "day1_only" | "day2_only" | "both_days";

export type LcfBulkSelection = {
  eventYear: LcfBulkEventFilter;
  audienceTypes: LcfBulkAudienceType[];
  applicationStatuses: LcfBulkApplicationStatus[];
  attendanceSchedule: LcfBulkAttendanceFilter;
};

export type LcfBulkRecipientSnapshot = {
  applicationType: LcfBulkAudienceType;
  applicationId: number;
  eventYear: string;
  email: string;
  name: string;
  company: string | null;
};

const campaignJobs = new Map<number, Promise<void>>();
const SEND_INTERVAL_MS = 2_000;
const RECIPIENT_INSERT_CHUNK_SIZE = 250;
const UNKNOWN_DELIVERY_AFTER_MS = 10 * 60_000;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUDIENCE_LABELS: Record<LcfBulkAudienceType, string> = {
  company: "企業・ブランド",
  liver: "ライブコマーサー",
  general: "一般参加",
  sponsor: "スポンサー",
};

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function editionLabel(eventYear: string): string {
  return eventYear === "2026-02" ? "第2回（2026年12月）" : "第1回（2026年9月）";
}

export function renderLcfBulkTemplate(template: string, recipient: LcfBulkRecipientSnapshot): string {
  return template
    .replace(/\{\{name\}\}/g, recipient.name || "ご担当者")
    .replace(/\{\{company\}\}/g, recipient.company || "")
    .replace(/\{\{event\}\}/g, editionLabel(recipient.eventYear))
    .replace(/\{\{type\}\}/g, AUDIENCE_LABELS[recipient.applicationType]);
}

export function dedupeLcfBulkRecipients(recipients: LcfBulkRecipientSnapshot[]): LcfBulkRecipientSnapshot[] {
  const byEmail = new Map<string, LcfBulkRecipientSnapshot>();
  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email);
    if (!VALID_EMAIL.test(email) || byEmail.has(email)) continue;
    byEmail.set(email, { ...recipient, email });
  }
  return [...byEmail.values()];
}

export async function resolveLcfBulkRecipients(selection: LcfBulkSelection): Promise<LcfBulkRecipientSnapshot[]> {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const recipients: LcfBulkRecipientSnapshot[] = [];
  const years = selection.eventYear === "all" ? ["2026", "2026-02"] : [selection.eventYear];
  const statuses = selection.applicationStatuses.length > 0 ? selection.applicationStatuses : ["confirmed" as const];

  if (selection.audienceTypes.includes("company")) {
    const rows = await db.select({
      id: festivalCompanyApplications.id,
      eventYear: festivalCompanyApplications.eventYear,
      email: festivalCompanyApplications.email,
      name: festivalCompanyApplications.contactName,
      company: festivalCompanyApplications.companyName,
    }).from(festivalCompanyApplications).where(and(
      inArray(festivalCompanyApplications.eventYear, years),
      inArray(festivalCompanyApplications.status, statuses),
    ));
    recipients.push(...rows.map((row) => ({
      applicationType: "company" as const,
      applicationId: row.id,
      eventYear: row.eventYear === "2026-02" ? "2026-02" as const : "2026" as const,
      email: row.email || "",
      name: row.name || "ご担当者",
      company: row.company || "",
    })));
  }

  if (selection.audienceTypes.includes("liver")) {
    const conditions = [
      inArray(festivalLiverApplications.eventYear, years),
      inArray(festivalLiverApplications.status, statuses),
    ];
    if (selection.attendanceSchedule !== "all") conditions.push(eq(festivalLiverApplications.attendanceSchedule, selection.attendanceSchedule));
    const rows = await db.select({
      id: festivalLiverApplications.id,
      eventYear: festivalLiverApplications.eventYear,
      email: festivalLiverApplications.email,
      name: festivalLiverApplications.name,
      company: festivalLiverApplications.agency,
    }).from(festivalLiverApplications).where(and(...conditions));
    recipients.push(...rows.map((row) => ({
      applicationType: "liver" as const,
      applicationId: row.id,
      eventYear: row.eventYear === "2026-02" ? "2026-02" as const : "2026" as const,
      email: row.email || "",
      name: row.name || "ご担当者",
      company: row.company || "",
    })));
  }

  if (selection.audienceTypes.includes("general")) {
    const conditions = [
      inArray(festivalGeneralApplications.eventYear, years),
      inArray(festivalGeneralApplications.status, statuses),
    ];
    if (selection.attendanceSchedule !== "all") conditions.push(eq(festivalGeneralApplications.attendanceSchedule, selection.attendanceSchedule));
    const rows = await db.select({
      id: festivalGeneralApplications.id,
      eventYear: festivalGeneralApplications.eventYear,
      email: festivalGeneralApplications.email,
      name: festivalGeneralApplications.name,
      company: festivalGeneralApplications.companyName,
    }).from(festivalGeneralApplications).where(and(...conditions));
    recipients.push(...rows.map((row) => ({
      applicationType: "general" as const,
      applicationId: row.id,
      eventYear: row.eventYear === "2026-02" ? "2026-02" as const : "2026" as const,
      email: row.email || "",
      name: row.name || "ご担当者",
      company: row.company || "",
    })));
  }

  if (selection.audienceTypes.includes("sponsor")) {
    const rows = await db.select({
      id: festivalSponsors.id,
      eventYear: festivalSponsors.eventYear,
      email: festivalSponsors.contactEmail,
      name: festivalSponsors.contactName,
      company: festivalSponsors.companyName,
    }).from(festivalSponsors).where(and(
      inArray(festivalSponsors.eventYear, years),
      eq(festivalSponsors.status, "confirmed"),
    ));
    recipients.push(...rows.map((row) => ({
      applicationType: "sponsor" as const,
      applicationId: row.id,
      eventYear: row.eventYear === "2026-02" ? "2026-02" as const : "2026" as const,
      email: row.email || "",
      name: row.name || "ご担当者",
      company: row.company,
    })));
  }

  return dedupeLcfBulkRecipients(recipients.map((recipient: any) => ({
    applicationType: recipient.applicationType,
    applicationId: Number(recipient.applicationId ?? recipient.id),
    eventYear: String(recipient.eventYear),
    email: String(recipient.email || ""),
    name: String(recipient.name || "ご担当者"),
    company: recipient.company ? String(recipient.company) : null,
  })));
}

export async function previewLcfBulkEmail(selection: LcfBulkSelection, subjectTemplate: string, bodyTemplate: string) {
  const recipients = await resolveLcfBulkRecipients(selection);
  const sample = recipients[0] || null;
  const sampleSubject = sample ? renderLcfBulkTemplate(subjectTemplate, sample) : subjectTemplate;
  const sampleBody = sample ? renderLcfBulkTemplate(bodyTemplate, sample) : bodyTemplate;
  const validation = validateLcfEmailContent(sampleSubject, sampleBody);
  const counts = Object.fromEntries((Object.keys(AUDIENCE_LABELS) as LcfBulkAudienceType[]).map((type) => [
    type,
    recipients.filter((recipient) => recipient.applicationType === type).length,
  ])) as Record<LcfBulkAudienceType, number>;
  return {
    recipientCount: recipients.length,
    counts,
    sample: sample ? { email: sample.email, name: sample.name, company: sample.company, subject: validation.subject, body: validation.body } : null,
    validationErrors: validation.errors,
  };
}

export async function createLcfBulkEmailCampaign(input: {
  selection: LcfBulkSelection;
  subjectTemplate: string;
  bodyTemplate: string;
  createdByAccountId: number;
  createdByEmail: string;
}): Promise<{ campaignId: number; recipientCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const recipients = await resolveLcfBulkRecipients(input.selection);
  if (recipients.length === 0) throw new Error("条件に一致する送信先がありません");

  const snapshots = recipients.map((recipient) => {
    const subject = renderLcfBulkTemplate(input.subjectTemplate, recipient);
    const body = renderLcfBulkTemplate(input.bodyTemplate, recipient);
    const validation = validateLcfEmailContent(subject, body);
    if (validation.errors.length > 0) throw new Error(`${recipient.name}様向けの内容を確認してください: ${validation.errors.join("、")}`);
    return { recipient, subject: validation.subject, body: validation.body };
  });

  const campaignId = await db.transaction(async (tx) => {
    const [insertResult] = await tx.insert(festivalBulkEmailCampaigns).values({
      status: "queued",
      eventYear: input.selection.eventYear,
      audienceTypes: input.selection.audienceTypes,
      selectionJson: input.selection,
      subjectTemplate: input.subjectTemplate.trim(),
      bodyTemplate: input.bodyTemplate.trim(),
      recipientCount: snapshots.length,
      createdByAccountId: input.createdByAccountId,
      createdByEmail: input.createdByEmail,
    });
    const insertedCampaignId = Number((insertResult as any).insertId);
    if (!Number.isInteger(insertedCampaignId) || insertedCampaignId <= 0) throw new Error("一斉送信キャンペーンを作成できませんでした");

    for (let start = 0; start < snapshots.length; start += RECIPIENT_INSERT_CHUNK_SIZE) {
      const chunk = snapshots.slice(start, start + RECIPIENT_INSERT_CHUNK_SIZE);
      await tx.insert(festivalBulkEmailRecipients).values(chunk.map(({ recipient, subject, body }) => ({
        campaignId: insertedCampaignId,
        applicationType: recipient.applicationType,
        applicationId: recipient.applicationId,
        eventYear: recipient.eventYear,
        email: recipient.email,
        name: recipient.name,
        company: recipient.company,
        subject,
        body,
        status: "pending" as const,
      })));
    }
    return insertedCampaignId;
  });

  queueLcfBulkEmailCampaign(campaignId);
  return { campaignId, recipientCount: snapshots.length };
}

async function refreshCampaignProgress(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const rows = await db.select({ status: festivalBulkEmailRecipients.status, total: count() })
    .from(festivalBulkEmailRecipients)
    .where(eq(festivalBulkEmailRecipients.campaignId, campaignId))
    .groupBy(festivalBulkEmailRecipients.status);
  const totals = Object.fromEntries(rows.map((row) => [row.status, Number(row.total)])) as Record<string, number>;
  const pending = totals.pending || 0;
  const sending = totals.sending || 0;
  const sent = totals.sent || 0;
  const failed = totals.failed || 0;
  const cancelled = totals.cancelled || 0;
  const finished = pending === 0 && sending === 0;
  const status = finished ? (cancelled > 0 ? "cancelled" : failed > 0 ? "partial" : "completed") : "processing";
  await db.update(festivalBulkEmailCampaigns).set({
    status,
    sentCount: sent,
    failedCount: failed,
    completedAt: finished ? new Date() : null,
  }).where(eq(festivalBulkEmailCampaigns.id, campaignId));
  return { pending, sending, sent, failed, cancelled, finished, status };
}

async function processLcfBulkEmailCampaign(campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  // A process can stop after SMTP accepted a message but before the DB status update.
  // Never auto-retry that ambiguous recipient: surface it for manual review to avoid duplicates.
  await db.update(festivalBulkEmailRecipients).set({
    status: "failed",
    errorCode: "DELIVERY_STATE_UNKNOWN_MANUAL_REVIEW",
  }).where(and(
    eq(festivalBulkEmailRecipients.campaignId, campaignId),
    eq(festivalBulkEmailRecipients.status, "sending"),
    lt(festivalBulkEmailRecipients.updatedAt, new Date(Date.now() - UNKNOWN_DELIVERY_AFTER_MS)),
  ));
  await db.update(festivalBulkEmailCampaigns).set({ status: "processing", startedAt: new Date() })
    .where(and(eq(festivalBulkEmailCampaigns.id, campaignId), inArray(festivalBulkEmailCampaigns.status, ["queued", "processing"])));

  for (;;) {
    const [recipient] = await db.select().from(festivalBulkEmailRecipients).where(and(
      eq(festivalBulkEmailRecipients.campaignId, campaignId),
      eq(festivalBulkEmailRecipients.status, "pending"),
    )).orderBy(asc(festivalBulkEmailRecipients.id)).limit(1);
    if (!recipient) break;

    const [claimResult] = await db.update(festivalBulkEmailRecipients).set({
      status: "sending",
      attemptCount: sql`${festivalBulkEmailRecipients.attemptCount} + 1`,
    }).where(and(
      eq(festivalBulkEmailRecipients.id, recipient.id),
      eq(festivalBulkEmailRecipients.status, "pending"),
    ));
    if (Number((claimResult as any).affectedRows || 0) !== 1) continue;

    try {
      const result = await sendLcfEmail({
        to: [recipient.email],
        toName: recipient.name,
        toCompany: recipient.company || undefined,
        subject: recipient.subject,
        body: recipient.body,
      });
      await db.update(festivalBulkEmailRecipients).set({
        status: "sent",
        messageId: result.messageId,
        errorCode: result.historySaved ? null : "SMTP_ACCEPTED_HISTORY_PENDING",
        sentAt: new Date(),
      }).where(eq(festivalBulkEmailRecipients.id, recipient.id));
    } catch (error) {
      const errorCode = String((error as any)?.code || (error as any)?.responseCode || "SMTP_ERROR").slice(0, 100);
      await db.update(festivalBulkEmailRecipients).set({ status: "failed", errorCode })
        .where(eq(festivalBulkEmailRecipients.id, recipient.id));
    }
    await refreshCampaignProgress(campaignId);
    await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
  }
  await refreshCampaignProgress(campaignId);
}

export function queueLcfBulkEmailCampaign(campaignId: number): void {
  if (campaignJobs.has(campaignId)) return;
  const job = processLcfBulkEmailCampaign(campaignId)
    .catch((error) => console.error(`[LCF Bulk Email] Campaign ${campaignId} failed:`, error))
    .finally(() => campaignJobs.delete(campaignId));
  campaignJobs.set(campaignId, job);
}

export async function getLcfBulkEmailCampaign(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const [campaign] = await db.select().from(festivalBulkEmailCampaigns)
    .where(eq(festivalBulkEmailCampaigns.id, campaignId)).limit(1);
  if (!campaign) return null;
  if (campaign.status === "queued" || campaign.status === "processing") queueLcfBulkEmailCampaign(campaignId);
  const recipients = await db.select({
    id: festivalBulkEmailRecipients.id,
    email: festivalBulkEmailRecipients.email,
    name: festivalBulkEmailRecipients.name,
    applicationType: festivalBulkEmailRecipients.applicationType,
    status: festivalBulkEmailRecipients.status,
    errorCode: festivalBulkEmailRecipients.errorCode,
    sentAt: festivalBulkEmailRecipients.sentAt,
  }).from(festivalBulkEmailRecipients)
    .where(eq(festivalBulkEmailRecipients.campaignId, campaignId))
    .orderBy(desc(festivalBulkEmailRecipients.id))
    .limit(100);
  return { ...campaign, recipients };
}

export async function listRecentLcfBulkEmailCampaigns(limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const campaigns = await db.select().from(festivalBulkEmailCampaigns)
    .orderBy(desc(festivalBulkEmailCampaigns.createdAt)).limit(safeLimit);
  for (const campaign of campaigns) {
    if (campaign.status === "queued" || campaign.status === "processing") queueLcfBulkEmailCampaign(Number(campaign.id));
  }
  return campaigns;
}

export async function cancelLcfBulkEmailCampaign(campaignId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB接続エラー");
  await db.update(festivalBulkEmailRecipients).set({ status: "cancelled" }).where(and(
    eq(festivalBulkEmailRecipients.campaignId, campaignId),
    eq(festivalBulkEmailRecipients.status, "pending"),
  ));
  await refreshCampaignProgress(campaignId);
}
