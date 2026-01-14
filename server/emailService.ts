import nodemailer from "nodemailer";

interface EmailMessage {
  to: string[];
  subject: string;
  content: string;
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

    const mailOptions: any = {
      from: process.env.SMTP_USER,
      to: message.to.join(", "),
      cc: message.cc?.join(", "),
      bcc: message.bcc?.join(", "),
      subject: message.subject,
      text: message.content,
    };

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
  screenshotUrls?: string[]
): Promise<{ success: boolean; error?: string }> {
  const subject = `【リマインド】タスクの進捗確認: ${taskDetail.substring(0, 50)}...`;
  
  // Generate completion URL if token is provided
  // Get the base URL from environment or use the dev server URL
  const getBaseUrl = () => {
    // In production, use the deployed domain
    if (process.env.NODE_ENV === 'production') {
      return process.env.APP_URL || 'https://your-domain.manus.space';
    }
    // In development, use the dev server URL
    return 'https://3000-i58mz8953bkj8oa3sie09-f1f28683.sg1.manus.computer';
  };
  
  const baseUrl = getBaseUrl();
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

以下のリンクをクリックして完了報告をしてください：
${completionUrl ? completionUrl : 'リンクは生成されませんでした'}



━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。

---
業務自動化システム
タスクID: ${taskId}`;

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
