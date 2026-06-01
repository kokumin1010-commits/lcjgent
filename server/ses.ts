/**
 * Amazon SES Email Sender
 * 一括営業メール送信用のSESヘルパー
 * Aliyun SMTPのレート制限を回避するため、SES APIを使用
 */
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { ENV } from "./_core/env";

let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    if (!ENV.awsSesAccessKeyId || !ENV.awsSesSecretAccessKey) {
      throw new Error("[SES] AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY are required");
    }
    sesClient = new SESClient({
      region: ENV.awsSesRegion,
      credentials: {
        accessKeyId: ENV.awsSesAccessKeyId,
        secretAccessKey: ENV.awsSesSecretAccessKey,
      },
    });
  }
  return sesClient;
}

export interface SESEmailOptions {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * SESでメールを送信する
 * Raw Email形式で送信（添付ファイル対応）
 */
export async function sendEmailViaSES(options: SESEmailOptions): Promise<{ messageId: string; success: boolean }> {
  const client = getSESClient();
  const from = options.fromName 
    ? `=?UTF-8?B?${Buffer.from(options.fromName).toString('base64')}?= <${options.from || ENV.awsSesFromEmail}>`
    : options.from || ENV.awsSesFromEmail;
  
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2)}`;
  
  let rawMessage = "";
  rawMessage += `From: ${from}\r\n`;
  rawMessage += `To: ${options.to}\r\n`;
  rawMessage += `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=\r\n`;
  if (options.replyTo) {
    rawMessage += `Reply-To: ${options.replyTo}\r\n`;
  }
  rawMessage += `MIME-Version: 1.0\r\n`;
  
  if (options.attachments && options.attachments.length > 0) {
    rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    // Text/HTML part
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    rawMessage += `--${boundary}\r\n`;
    rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    
    // Plain text
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${Buffer.from(options.textBody).toString('base64')}\r\n\r\n`;
    
    // HTML
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${Buffer.from(options.htmlBody).toString('base64')}\r\n\r\n`;
    rawMessage += `--${altBoundary}--\r\n\r\n`;
    
    // Attachments
    for (const att of options.attachments) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
      rawMessage += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
      rawMessage += `${att.content.toString('base64')}\r\n\r\n`;
    }
    rawMessage += `--${boundary}--\r\n`;
  } else {
    // No attachments - multipart/alternative only
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${Buffer.from(options.textBody).toString('base64')}\r\n\r\n`;
    
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${Buffer.from(options.htmlBody).toString('base64')}\r\n\r\n`;
    
    rawMessage += `--${altBoundary}--\r\n`;
  }
  
  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
    Source: options.from || ENV.awsSesFromEmail,
    Destinations: [options.to],
  });
  
  const response = await client.send(command);
  return {
    messageId: response.MessageId || "",
    success: true,
  };
}

/**
 * SESが利用可能かチェック
 */
export function isSESConfigured(): boolean {
  return !!(ENV.awsSesAccessKeyId && ENV.awsSesSecretAccessKey);
}
