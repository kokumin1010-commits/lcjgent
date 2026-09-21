/**
 * ============================================================
 * ⚠️ PROTECTED FILE - DO NOT MODIFY WITHOUT CAREFUL REVIEW ⚠️
 * ============================================================
 * 
 * このファイルはHTMLメール送信の根幹機能を担っています。
 * 変更する場合は以下を必ず確認してください：
 * 
 * 1. from フィールド: 「株式会社ライブコマースジャパン」表示名を維持
 * 2. html フィールド: nodemailerのhtmlオプションで送信（textではない）
 * 3. Content-Type: text/htmlが正しく設定されること
 * 4. 型注釈: nodemailer.SendMailOptions ではなく any を使用（ビルドエラー防止）
 * 5. stripHtml: HTMLからプレーンテキストへのフォールバック生成
 * 
 * 最終確認日: 2026-05-29
 * ============================================================
 */
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

interface EmailMessage {
  to: string[];
  subject: string;
  content: string;
  html?: string;
  idempotencyKey?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
    cid?: string;
    contentType?: string;
  }>;
}

/**
 * Create the configured SMTP transporter.
 * Gmail uses SMTP_USER/SMTP_PASS; the existing enterprise mailbox uses
 * EMAIL_USER/EMAIL_PASSWORD with EMAIL_SMTP_HOST.
 */
type EmailProvider = "aliyun" | "gmail";

export interface EmailDeliveryResult {
  success: boolean;
  provider?: EmailProvider;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

interface TransportCandidate {
  provider: EmailProvider;
  fromEmail: string;
  transporter: ReturnType<typeof nodemailer.createTransport>;
}

export function getEmailProviderConfiguration(): {
  aliyunConfigured: boolean;
  gmailConfigured: boolean;
  priority: EmailProvider[];
} {
  const aliyunConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  const gmailConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== process.env.EMAIL_USER);
  return {
    aliyunConfigured,
    gmailConfigured,
    priority: [aliyunConfigured ? "aliyun" : null, gmailConfigured ? "gmail" : null].filter((value): value is EmailProvider => Boolean(value)),
  };
}

function createTransportCandidates(): TransportCandidate[] {
  const candidates: TransportCandidate[] = [];
  const customUser = process.env.EMAIL_USER;
  const customPass = process.env.EMAIL_PASSWORD;
  if (customUser && customPass) {
    const port = Number(process.env.EMAIL_SMTP_PORT || 465);
    candidates.push({
      provider: "aliyun",
      fromEmail: customUser,
      transporter: nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST || "smtp.qiye.aliyun.com",
        port,
        secure: process.env.EMAIL_SMTP_SECURE ? process.env.EMAIL_SMTP_SECURE === "true" : port === 465,
        auth: { user: customUser, pass: customPass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    });
  }

  const gmailUser = process.env.SMTP_USER;
  const gmailPass = process.env.SMTP_PASS;
  if (gmailUser && gmailPass && gmailUser !== customUser) {
    candidates.push({
      provider: "gmail",
      fromEmail: gmailUser,
      transporter: nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: gmailUser, pass: gmailPass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    });
  }

  return candidates;
}

function getSafeEmailError(error: unknown): { code: string; message: string; canFailover: boolean } {
  const value = error as { code?: string; responseCode?: number; command?: string; message?: string };
  const code = String(value?.code || (value?.responseCode ? `SMTP_${value.responseCode}` : "SMTP_ERROR")).slice(0, 100);
  const command = value?.command ? ` (${String(value.command).slice(0, 40)})` : "";
  const message = `${code}${command}`;
  const canFailover = ["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(String(value?.code || ""));
  return { code, message, canFailover };
}

/**
 * Strip HTML tags to generate plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHeaderText(value: string): string {
  return value.replace(/[\r\n\u0000-\u001F\u007F]+/g, " ").trim();
}

/**
 * Send email through the configured enterprise SMTP, with Gmail failover
 * 
 * IMPORTANT: When html field is provided, it is used as the email body.
 * The content field serves as plain-text fallback only.
 * HTML is sent only when callers explicitly provide the html field.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  const candidates = createTransportCandidates();
  if (candidates.length === 0) {
    console.error("[Email Service] No SMTP provider is configured");
    return { success: false, error: "SMTP provider is not configured", errorCode: "SMTP_NOT_CONFIGURED" };
  }

  const fromName = "株式会社ライブコマースジャパン";
  let htmlBody: string | undefined = message.html;
  let textBody: string = message.content;
  if (htmlBody && textBody === message.content && /<[a-z][\s\S]*>/i.test(textBody)) {
    textBody = stripHtml(htmlBody);
  }

  let lastFailure: EmailDeliveryResult = { success: false, error: "Email delivery failed", errorCode: "SMTP_ERROR" };
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const mailOptions: any = {
      from: `${fromName} <${candidate.fromEmail}>`,
      to: message.to.join(", "),
      subject: message.subject,
      text: textBody,
      html: htmlBody,
    };
    if (message.idempotencyKey) {
      const digest = createHash("sha256").update(message.idempotencyKey).digest("hex");
      mailOptions.messageId = `<${digest}@lcjmall.com>`;
    }
    if (message.cc?.length) mailOptions.cc = message.cc.join(", ");
    if (message.bcc?.length) mailOptions.bcc = message.bcc.join(", ");
    if (message.attachments) mailOptions.attachments = message.attachments;

    try {
      const info = await candidate.transporter.sendMail(mailOptions);
      const messageId = String(info.messageId || "").slice(0, 255) || undefined;
      console.log(`[Email Service] Accepted by ${candidate.provider}${messageId ? `: ${messageId}` : ""}`);
      return { success: true, provider: candidate.provider, messageId };
    } catch (error) {
      const safeError = getSafeEmailError(error);
      console.error(`[Email Service] ${candidate.provider} failed: ${safeError.message}`);
      lastFailure = {
        success: false,
        provider: candidate.provider,
        error: safeError.message,
        errorCode: safeError.code,
      };
      const hasNext = index + 1 < candidates.length;
      if (!hasNext || !safeError.canFailover) break;
      console.warn(`[Email Service] Trying fallback provider after ${safeError.code}`);
    }
  }

  return lastFailure;
}

/**
 * Send reminder email to staff member
 */
export async function sendReminderEmail(
  staffEmail: string,
  staffName: string,
  taskDetail: string,
  taskId: string,
  daysElapsed: number,
  completionToken?: string,
  screenshotUrls?: string[],
  notes?: string,
  deadline?: number,
  trackingToken?: string,
  taskRecordId?: number,
  idempotencyKey?: string
): Promise<EmailDeliveryResult> {
  const subject = safeHeaderText(`【リマインド/提醒】タスクの進捗確認 / 任务进度确认: ${taskDetail.substring(0, 50)}...`);
  
  const getBaseUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      return process.env.APP_URL || 'https://lcjmall.com';
    }
    return 'https://3000-i58mz8953bkj8oa3sie09-f1f28683.sg1.manus.computer';
  };
  
  const baseUrl = getBaseUrl();
  const completionUrl = completionToken ? `${baseUrl}/complete/${completionToken}` : null;
  const feedbackUrl = taskRecordId ? `${baseUrl}/master/tasks/${taskRecordId}` : completionUrl;
  
  const content = `${staffName} 様 / 尊敬的 ${staffName}

【日本語 / Japanese】
お疲れ様です。
以下のタスクについて、進捗状況の確認をお願いいたします。

【タスク詳細】
${taskDetail}

${notes ? `【メモ】
${notes}

` : ''}【期限】
${deadline ? new Date(deadline).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}

【経過日数】
${daysElapsed}日

━━━━━━━━━━━━━━━━━━━━
【実行フィードバック方法】
以下のリンクからログインし、本人の進行中・ブロック・完了状況と実行内容を報告してください：
${feedbackUrl ? feedbackUrl : 'リンクは生成されませんでした'}
━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、お気軽にお問い合わせください。
よろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【中文 / Chinese】
您好，辛苦了。
请确认以下任务的进度情况。

【任务详情】
${taskDetail}

${notes ? `【备注】
${notes}

` : ''}【截止日期】
${deadline ? new Date(deadline).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设定'}

【已过天数】
${daysElapsed}天

━━━━━━━━━━━━━━━━━━━━
【执行反馈方法】
请登录以下任务页面，由本人提交进行中、受阻或完成状态，以及执行内容：
${feedbackUrl ? feedbackUrl : '链接未生成'}
━━━━━━━━━━━━━━━━━━━━

如有任何疑问，请随时联系我们。
谢谢合作。

---
业务自动化系统 / 業務自動化システム
任务ID / タスクID: ${taskId}`;

  const html = `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(content)}</div>${
    trackingToken
      ? `<img src="${escapeHtml(`${baseUrl}/api/track/pixel/${trackingToken}`)}" width="1" height="1" style="display:none" alt="" />`
      : ""
  }`;

  const mailOptions: any = {
    to: [staffEmail],
    subject,
    content,
    html,
    idempotencyKey,
  };

  // Add screenshots as attachments if provided
  if (screenshotUrls && screenshotUrls.length > 0) {
    mailOptions.attachments = screenshotUrls.map((url, index) => ({
      filename: `screenshot_${index + 1}.png`,
      path: url,
    }));
  }

  return await sendEmail(mailOptions);
}
