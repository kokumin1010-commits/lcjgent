/**
 * Amazon SES Email Sender
 * 一括営業メール送信用のSESヘルパー
 * Aliyun SMTPのレート制限を回避するため、SES APIを使用
 */
import { SESClient, SendRawEmailCommand, GetSendQuotaCommand, GetAccountSendingEnabledCommand } from "@aws-sdk/client-ses";
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
 * SES送信クォータ・アカウント状態を取得（診断用）
 */
export async function getSESDiagnostics(): Promise<{
  configured: boolean;
  region: string;
  fromEmail: string;
  sendingEnabled?: boolean;
  quota?: { max24HourSend: number; sentLast24Hours: number; maxSendRate: number };
  error?: string;
}> {
  const configured = isSESConfigured();
  if (!configured) {
    return { configured: false, region: ENV.awsSesRegion, fromEmail: ENV.awsSesFromEmail };
  }
  try {
    const client = getSESClient();
    const quotaResp = await client.send(new GetSendQuotaCommand({}));
    let sendingEnabled: boolean | undefined;
    try {
      const enabledResp = await client.send(new GetAccountSendingEnabledCommand({}));
      sendingEnabled = enabledResp.Enabled;
    } catch (e: any) {
      console.warn("[SES Diagnostics] GetAccountSendingEnabled failed:", e.message);
    }
    return {
      configured: true,
      region: ENV.awsSesRegion,
      fromEmail: ENV.awsSesFromEmail,
      sendingEnabled,
      quota: {
        max24HourSend: quotaResp.Max24HourSend || 0,
        sentLast24Hours: quotaResp.SentLast24Hours || 0,
        maxSendRate: quotaResp.MaxSendRate || 0,
      },
    };
  } catch (e: any) {
    console.error("[SES Diagnostics] Error:", e.message);
    return {
      configured: true,
      region: ENV.awsSesRegion,
      fromEmail: ENV.awsSesFromEmail,
      error: e.message,
    };
  }
}

/**
 * SESでメールを送信する
 * Raw Email形式で送信（添付ファイル対応）
 */
export async function sendEmailViaSES(options: SESEmailOptions): Promise<{ messageId: string; success: boolean }> {
  const client = getSESClient();
  const fromEmail = options.from || ENV.awsSesFromEmail;
  const from = options.fromName 
    ? `=?UTF-8?B?${Buffer.from(options.fromName).toString('base64')}?= <${fromEmail}>`
    : fromEmail;
  
  console.log(`[SES] Sending email: from=${fromEmail}, to=${options.to}, subject=${options.subject.substring(0, 50)}`);
  
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2)}`;
  
  let rawMessage = "";
  rawMessage += `From: ${from}\r\n`;
  rawMessage += `To: ${options.to}\r\n`;
  rawMessage += `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=\r\n`;
  if (options.replyTo) {
    rawMessage += `Reply-To: ${options.replyTo}\r\n`;
  }
  rawMessage += `MIME-Version: 1.0\r\n`;
  
  // Helper to encode base64 with proper line breaks (76 chars per line per RFC 2045)
  const encodeBase64WithLineBreaks = (input: string | Buffer): string => {
    const buf = typeof input === 'string' ? Buffer.from(input) : input;
    const base64 = buf.toString('base64');
    // Split into 76-char lines
    return base64.replace(/(.{76})/g, '$1\r\n');
  };
  
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
    rawMessage += `${encodeBase64WithLineBreaks(options.textBody)}\r\n\r\n`;
    
    // HTML
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${encodeBase64WithLineBreaks(options.htmlBody)}\r\n\r\n`;
    rawMessage += `--${altBoundary}--\r\n\r\n`;
    
    // Attachments
    for (const att of options.attachments) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: ${att.contentType}; name="=?UTF-8?B?${Buffer.from(att.filename).toString('base64')}?="\r\n`;
      rawMessage += `Content-Disposition: attachment; filename="=?UTF-8?B?${Buffer.from(att.filename).toString('base64')}?="\r\n`;
      rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
      rawMessage += `${encodeBase64WithLineBreaks(att.content)}\r\n\r\n`;
    }
    rawMessage += `--${boundary}--\r\n`;
  } else {
    // No attachments - multipart/alternative only
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${encodeBase64WithLineBreaks(options.textBody)}\r\n\r\n`;
    
    rawMessage += `--${altBoundary}\r\n`;
    rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawMessage += `${encodeBase64WithLineBreaks(options.htmlBody)}\r\n\r\n`;
    
    rawMessage += `--${altBoundary}--\r\n`;
  }
  
  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
    Source: fromEmail,
    Destinations: [options.to],
  });
  
  try {
    const response = await client.send(command);
    console.log(`[SES] Email sent successfully: messageId=${response.MessageId}, to=${options.to}`);
    return {
      messageId: response.MessageId || "",
      success: true,
    };
  } catch (error: any) {
    console.error(`[SES] Send FAILED: to=${options.to}, error=${error.name}: ${error.message}`);
    // Re-throw with more context
    const enhancedError = new Error(`SES送信失敗 (${error.name}): ${error.message}. Region: ${ENV.awsSesRegion}, From: ${fromEmail}`);
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
}

/**
 * SESが利用可能かチェック
 */
export function isSESConfigured(): boolean {
  return !!(ENV.awsSesAccessKeyId && ENV.awsSesSecretAccessKey);
}
