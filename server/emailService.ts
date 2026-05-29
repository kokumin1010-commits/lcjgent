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

interface EmailMessage {
  to: string[];
  subject: string;
  content: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

/**
 * Create Gmail SMTP transporter
 * Requires SMTP_USER and SMTP_PASS environment variables
 */
function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error(
      "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables."
    );
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
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

/**
 * Send email via Gmail SMTP
 * 
 * IMPORTANT: When html field is provided, it is used as the email body.
 * The content field serves as plain-text fallback only.
 * If html is not provided but content contains HTML tags, content is treated as HTML.
 */
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const fromName = "株式会社ライブコマースジャパン";
    const fromEmail = process.env.SMTP_USER;

    // Determine if we should send as HTML
    let htmlBody: string | undefined = message.html;
    let textBody: string = message.content;

    // If content contains HTML tags but html field is not set, treat content as HTML
    if (!htmlBody && /<[a-z][\s\S]*>/i.test(message.content)) {
      htmlBody = message.content;
      textBody = stripHtml(message.content);
    }

    // If html is provided, ensure text is a clean plain-text version
    if (htmlBody && textBody === message.content && /<[a-z][\s\S]*>/i.test(textBody)) {
      textBody = stripHtml(htmlBody);
    }

    const mailOptions: any = {
      from: `${fromName} <${fromEmail}>`,
      to: message.to.join(", "),
      subject: message.subject,
      text: textBody,
      html: htmlBody,
    };

    // Only add cc/bcc if they have values
    if (message.cc && message.cc.length > 0) {
      mailOptions.cc = message.cc.join(", ");
    }
    if (message.bcc && message.bcc.length > 0) {
      mailOptions.bcc = message.bcc.join(", ");
    }

    if (message.attachments) {
      mailOptions.attachments = message.attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("[Email Service] Email sent successfully:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("[Email Service] Failed to send email:", error);
    return { success: false, error: String(error) };
  }
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
  trackingToken?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `【リマインド/提醒】タスクの進捗確認 / 任务进度确认: ${taskDetail.substring(0, 50)}...`;
  
  const getBaseUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      return process.env.APP_URL || 'https://lcjmall.com';
    }
    return 'https://3000-i58mz8953bkj8oa3sie09-f1f28683.sg1.manus.computer';
  };
  
  const baseUrl = getBaseUrl();
  const completionUrl = completionToken ? `${baseUrl}/complete/${completionToken}` : null;
  
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
【完了報告方法】
以下のリンクをクリックして完了報告をしてください：
${completionUrl ? completionUrl : 'リンクは生成されませんでした'}
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
【完成报告方法】
请点击以下链接提交完成报告：
${completionUrl ? completionUrl : '链接未生成'}
━━━━━━━━━━━━━━━━━━━━

如有任何疑问，请随时联系我们。
谢谢合作。

---
业务自动化系统 / 業務自動化システム
任务ID / タスクID: ${taskId}

${trackingToken ? `<img src="${baseUrl}/api/track/pixel/${trackingToken}" width="1" height="1" style="display:none" />` : ''}`;

  const mailOptions: any = {
    to: [staffEmail],
    subject,
    content,
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
