import nodemailer from "nodemailer";

interface EmailMessage {
  to: string[];
  subject: string;
  content: string;
  cc?: string[];
  bcc?: string[];
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
    secure: false, // Use TLS
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Send email via Gmail SMTP
 */
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: message.to.join(", "),
      cc: message.cc?.join(", "),
      bcc: message.bcc?.join(", "),
      subject: message.subject,
      text: message.content,
    };

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
  completionToken?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `【リマインド】タスクの進捗確認: ${taskDetail.substring(0, 50)}...`;
  
  // Generate completion URL if token is provided
  const baseUrl = process.env.VITE_FRONTEND_FORGE_API_URL?.replace('/api', '') || 'https://your-domain.com';
  const completionUrl = completionToken ? `${baseUrl}/complete/${completionToken}` : null;
  
  const content = `${staffName} 様

お疲れ様です。

以下のタスクについて、進捗状況の確認をお願いいたします。

【タスク詳細】
${taskDetail}

【経過日数】
${daysElapsed}日

━━━━━━━━━━━━━━━━━━━━
【完了報告方法】
━━━━━━━━━━━━━━━━━━━━

方法1: ワンクリックで完了報告
${completionUrl ? completionUrl : 'リンクは生成されませんでした'}

方法2: このメールに返信
このメールに「finish」または「完了」と返信してください。
自動的にタスクが完了になります。

━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。

---
業務自動化システム
タスクID: ${taskId}`;

  return await sendEmail({
    to: [staffEmail],
    subject,
    content,
  });
}
