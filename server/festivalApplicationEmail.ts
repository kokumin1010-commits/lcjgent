import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { sendEmail, type EmailDeliveryResult } from "./emailService";
import { getPool } from "./selectionCenterRouter";

export type FestivalApplicationEmailSource = "application" | "duplicate_submission" | "admin_retry" | "status_update";
export type FestivalApplicationEmailStatus = "pending" | "accepted" | "failed";

export interface CompanyApplicationReceiptInput {
  applicationId: number;
  email: string;
  companyName: string;
  contactName: string;
  ticketId: string;
  source: FestivalApplicationEmailSource;
}

export interface ApplicationEmailStatusSummary {
  status: FestivalApplicationEmailStatus;
  provider: string | null;
  errorCode: string | null;
  attemptCount: number;
  lastAttemptAt: Date | string | null;
  acceptedAt: Date | string | null;
}

export interface CompanyApplicationReceiptResult extends EmailDeliveryResult {
  alreadyAccepted: boolean;
  auditStatus: FestivalApplicationEmailStatus;
  attemptCount: number;
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureFestivalApplicationEmailSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS festival_application_email_deliveries (
        id INT NOT NULL AUTO_INCREMENT,
        application_type ENUM('company','liver','general') NOT NULL,
        application_id INT NOT NULL,
        purpose ENUM('application_receipt','ticket','review_status') NOT NULL,
        source ENUM('application','duplicate_submission','admin_retry','status_update') NOT NULL,
        recipient_hash VARCHAR(64) NOT NULL,
        recipient_domain VARCHAR(255) NOT NULL,
        status ENUM('pending','accepted','failed') NOT NULL DEFAULT 'pending',
        provider VARCHAR(32) NULL,
        message_id VARCHAR(255) NULL,
        error_code VARCHAR(100) NULL,
        attempt_count INT NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMP NULL,
        accepted_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_festival_application_email_purpose (application_type, application_id, purpose),
        KEY idx_festival_application_email_status_updated (status, updated_at),
        KEY idx_festival_application_email_application_created (application_type, application_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    schemaReady = true;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashRecipientEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

function recipientDomain(email: string): string {
  return normalizeEmail(email).split("@").pop()?.slice(0, 255) || "unknown";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function receiptNumber(applicationId: number): string {
  return `LCF-C-${String(applicationId).padStart(6, "0")}`;
}

export async function buildCompanyApplicationReceiptMessage(input: CompanyApplicationReceiptInput) {
  const qrDataUrl = await QRCode.toDataURL(input.ticketId, { width: 300, margin: 2 });
  const qrContent = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  const number = receiptNumber(input.applicationId);
  const company = escapeHtml(input.companyName);
  const contact = escapeHtml(input.contactName);
  const ticket = escapeHtml(input.ticketId);
  const plainText = `${input.contactName} 様\n\nLive Commerce Festival 2026 企業出展・協賛のお申し込みを受け付けました。\n\n受付番号: ${number}\n会社名: ${input.companyName}\n\n【今後のご案内】\n担当者が申込内容を確認し、受付後3営業日以内に、出展・協賛の次の手順または確認事項をこのメールアドレスへご連絡します。\n\n【入場チケット】\nチケットID: ${input.ticketId}\n添付のQRコードを当日会場でご提示ください。マイページでも確認できます。\n\n3営業日を過ぎても連絡がない場合は、このメールに返信するか info@livecommercejapan.jp まで受付番号を添えてご連絡ください。\n\n開催日: 2026年9月8日（火）〜9日（水）\n会場: 八芳園（東京都港区白金台1-1-1）\n\nLive Commerce Festival 2026 事務局`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.7">
      <div style="border-radius:16px;padding:22px;background:linear-gradient(135deg,#fff7ed,#fffbeb);border:1px solid #fed7aa">
        <p style="margin:0 0 8px;color:#c2410c;font-size:13px;font-weight:700">Live Commerce Festival 2026</p>
        <h1 style="margin:0;font-size:22px">企業出展・協賛のお申し込みを受け付けました</h1>
      </div>
      <p>${contact} 様</p>
      <p><strong>${company}</strong> のお申し込みを正常に受け付けました。</p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:20px 0">
        <div style="font-size:12px;color:#64748b">受付番号</div>
        <div style="font-size:20px;font-weight:800;letter-spacing:.04em">${number}</div>
      </div>
      <h2 style="font-size:17px;margin-top:28px">今後のご案内</h2>
      <p>担当者が申込内容を確認し、<strong>受付後3営業日以内</strong>に、出展・協賛の次の手順または確認事項をこのメールアドレスへご連絡します。</p>
      <div style="text-align:center;margin:28px 0;padding:20px;background:#f8fafc;border-radius:14px">
        <p style="margin:0 0 8px;font-weight:700">入場QRコード</p>
        <img src="cid:lcf-company-ticket" width="240" height="240" alt="入場QRコード" style="display:block;margin:0 auto;max-width:100%;height:auto" />
        <p style="margin:10px 0 0;font-size:13px;color:#475569">チケットID: <strong>${ticket}</strong></p>
      </div>
      <p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 16px">3営業日を過ぎても連絡がない場合は、このメールに返信するか <a href="mailto:info@livecommercejapan.jp">info@livecommercejapan.jp</a> まで受付番号を添えてご連絡ください。</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0" />
      <p style="font-size:13px;color:#64748b">開催日: 2026年9月8日（火）〜9日（水）<br/>会場: 八芳園（東京都港区白金台1-1-1）<br/>Live Commerce Festival 2026 事務局</p>
    </div>`;
  return {
    to: [normalizeEmail(input.email)],
    subject: `【LCF 2026】企業出展・協賛 お申し込み受付完了（${number}）`,
    content: plainText,
    html,
    attachments: [{ filename: "lcf-2026-ticket.png", content: qrContent, cid: "lcf-company-ticket", contentType: "image/png" }],
  };
}

function toSummary(row: any): ApplicationEmailStatusSummary {
  return {
    status: row.status,
    provider: row.provider || null,
    errorCode: row.errorCode || row.error_code || null,
    attemptCount: Number(row.attemptCount ?? row.attempt_count ?? 0),
    lastAttemptAt: row.lastAttemptAt ?? row.last_attempt_at ?? null,
    acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
  };
}

export async function getCompanyApplicationEmailStatuses(applicationIds: number[]): Promise<Map<number, ApplicationEmailStatusSummary>> {
  const result = new Map<number, ApplicationEmailStatusSummary>();
  if (applicationIds.length === 0) return result;
  await ensureFestivalApplicationEmailSchema();
  const pool = getPool();
  const placeholders = applicationIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT application_id AS applicationId, status, provider, error_code AS errorCode,
            attempt_count AS attemptCount, last_attempt_at AS lastAttemptAt, accepted_at AS acceptedAt
       FROM festival_application_email_deliveries
      WHERE application_type = 'company' AND purpose = 'application_receipt'
        AND application_id IN (${placeholders})`,
    applicationIds,
  ) as any;
  for (const row of rows as any[]) result.set(Number(row.applicationId), toSummary(row));
  return result;
}

export async function sendCompanyApplicationReceipt(input: CompanyApplicationReceiptInput): Promise<CompanyApplicationReceiptResult> {
  await ensureFestivalApplicationEmailSchema();
  const pool = getPool();
  const connection = await pool.getConnection();
  const lockName = `lcf-company-mail-${input.applicationId}`;
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK(?, 8) AS acquired", [lockName]) as any;
    lockAcquired = Number(lockRows?.[0]?.acquired || 0) === 1;
    if (!lockAcquired) {
      return { success: false, alreadyAccepted: false, auditStatus: "failed", attemptCount: 0, errorCode: "DELIVERY_BUSY", error: "Delivery is already running" };
    }
    const [existingRows] = await connection.query(
      `SELECT status, provider, message_id AS messageId, error_code AS errorCode, attempt_count AS attemptCount
         FROM festival_application_email_deliveries
        WHERE application_type = 'company' AND application_id = ? AND purpose = 'application_receipt'
        LIMIT 1`,
      [input.applicationId],
    ) as any;
    const existing = existingRows?.[0];
    if (existing?.status === "accepted") {
      return {
        success: true,
        alreadyAccepted: true,
        auditStatus: "accepted",
        attemptCount: Number(existing.attemptCount || 0),
        provider: existing.provider || undefined,
        messageId: existing.messageId || undefined,
      };
    }

    const nextAttempt = Number(existing?.attemptCount || 0) + 1;
    if (existing) {
      await connection.query(
        `UPDATE festival_application_email_deliveries
            SET source = ?, recipient_hash = ?, recipient_domain = ?, status = 'pending',
                provider = NULL, message_id = NULL, error_code = NULL,
                attempt_count = ?, last_attempt_at = CURRENT_TIMESTAMP
          WHERE application_type = 'company' AND application_id = ? AND purpose = 'application_receipt'`,
        [input.source, hashRecipientEmail(input.email), recipientDomain(input.email), nextAttempt, input.applicationId],
      );
    } else {
      await connection.query(
        `INSERT INTO festival_application_email_deliveries
          (application_type, application_id, purpose, source, recipient_hash, recipient_domain, status, attempt_count, last_attempt_at)
         VALUES ('company', ?, 'application_receipt', ?, ?, ?, 'pending', 1, CURRENT_TIMESTAMP)`,
        [input.applicationId, input.source, hashRecipientEmail(input.email), recipientDomain(input.email)],
      );
    }

    let delivery: EmailDeliveryResult;
    try {
      delivery = await sendEmail(await buildCompanyApplicationReceiptMessage(input));
    } catch (error) {
      const code = String((error as { code?: string })?.code || "SMTP_EXCEPTION").slice(0, 100);
      delivery = { success: false, errorCode: code, error: code };
    }
    const auditStatus: FestivalApplicationEmailStatus = delivery.success ? "accepted" : "failed";
    await connection.query(
      `UPDATE festival_application_email_deliveries
          SET status = ?, provider = ?, message_id = ?, error_code = ?,
              accepted_at = CASE WHEN ? = 'accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END
        WHERE application_type = 'company' AND application_id = ? AND purpose = 'application_receipt'`,
      [auditStatus, delivery.provider || null, delivery.messageId || null, delivery.errorCode || null, auditStatus, input.applicationId],
    );
    return { ...delivery, alreadyAccepted: false, auditStatus, attemptCount: nextAttempt };
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    connection.release();
  }
}

export function __resetFestivalApplicationEmailSchemaForTests() {
  schemaReady = false;
  schemaPromise = null;
}
