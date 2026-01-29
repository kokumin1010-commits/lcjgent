import crypto from "crypto";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { livers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendLinePushMessage } from "./_core/lineMessaging";

/**
 * LINE Webhook Event Types
 */
interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  postback?: {
    data: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

/**
 * Verify LINE webhook signature
 */
export function verifyLineSignature(
  body: string,
  signature: string
): boolean {
  if (!ENV.lineChannelSecret) {
    console.error("[LINE Webhook] LINE_CHANNEL_SECRET not configured");
    return false;
  }

  const hash = crypto
    .createHmac("SHA256", ENV.lineChannelSecret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

/**
 * LINE連携コードを生成（6桁の数字）
 */
export function generateLinkCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 連携コードをライバーに保存
 */
export async function saveLinkCodeForLiver(
  liverId: number,
  linkCode: string
): Promise<void> {
  // 連携コードの有効期限は10分
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(livers)
    .set({
      lineLinkCode: linkCode,
      lineLinkCodeExpiresAt: expiresAt,
    })
    .where(eq(livers.id, liverId));
}

/**
 * 連携コードでライバーを検索
 */
export async function findLiverByLinkCode(
  linkCode: string
): Promise<{ id: number; name: string } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select({ id: livers.id, name: livers.name })
    .from(livers)
    .where(eq(livers.lineLinkCode, linkCode))
    .limit(1);

  if (result.length === 0) return null;

  const liverData = result[0];
  
  // 有効期限を確認するために再度取得
  const fullLiver = await db
    .select()
    .from(livers)
    .where(eq(livers.id, liverData.id))
    .limit(1);
  
  if (fullLiver.length === 0) return null;
  
  const expiresAt = fullLiver[0].lineLinkCodeExpiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    // 期限切れ
    return null;
  }

  return liverData;
}

/**
 * LINE User IDをライバーに紐付け
 */
export async function linkLineUserToLiver(
  liverId: number,
  lineUserId: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(livers)
    .set({
      lineUserId: lineUserId,
      lineLinkCode: null,
      lineLinkCodeExpiresAt: null,
    })
    .where(eq(livers.id, liverId));
}

/**
 * LINE User IDでライバーを検索
 */
export async function findLiverByLineUserId(
  lineUserId: string
): Promise<{ id: number; name: string } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select({ id: livers.id, name: livers.name })
    .from(livers)
    .where(eq(livers.lineUserId, lineUserId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Handle LINE webhook events
 */
export async function handleLineWebhook(
  body: LineWebhookBody
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  for (const event of body.events) {
    try {
      switch (event.type) {
        case "follow":
          // 友だち追加イベント
          await handleFollowEvent(event);
          break;

        case "message":
          // メッセージイベント（連携コード入力）
          if (event.message?.type === "text" && event.message.text) {
            await handleTextMessage(event, event.message.text);
          }
          break;

        case "postback":
          // ポストバックイベント
          if (event.postback?.data) {
            await handlePostback(event, event.postback.data);
          }
          break;

        default:
          // その他のイベントは無視
          break;
      }
      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Event ${event.type}: ${errorMsg}`);
      console.error(`[LINE Webhook] Error processing ${event.type}:`, error);
    }
  }

  return { processed, errors };
}

/**
 * Handle follow event (友だち追加)
 */
async function handleFollowEvent(event: LineWebhookEvent): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  // 既に連携済みかチェック
  const existingLiver = await findLiverByLineUserId(lineUserId);
  
  if (existingLiver) {
    // 既に連携済み
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `${existingLiver.name}さん、おかえりなさい！🎉\n\nLINE連携は完了しています。配信後にAIコーチングが届きます。`,
      },
    ]);
  } else {
    // 未連携 - 連携方法を案内
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `LCJ AIコーチングへようこそ！🎊\n\n配信後にAIからのアドバイスをLINEで受け取れます。\n\n【連携方法】\n1. LCJライバーアプリにログイン\n2. プロフィール編集 → LINE連携\n3. 表示される6桁のコードをこちらに送信\n\n連携コードを入力してください👇`,
      },
    ]);
  }
}

/**
 * Handle text message (連携コード入力)
 */
async function handleTextMessage(
  event: LineWebhookEvent,
  text: string
): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  // 既に連携済みかチェック
  const existingLiver = await findLiverByLineUserId(lineUserId);
  if (existingLiver) {
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `${existingLiver.name}さん、既にLINE連携済みです！✅\n\n配信後にAIコーチングが届きます。`,
      },
    ]);
    return;
  }

  // 6桁の数字かチェック
  const trimmedText = text.trim();
  if (!/^\d{6}$/.test(trimmedText)) {
    // 連携コードではない場合は無視（通常のメッセージ）
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `LINE連携をするには、LCJライバーアプリで発行した6桁の連携コードを送信してください。\n\n例: 123456`,
      },
    ]);
    return;
  }

  // 連携コードでライバーを検索
  const liverData = await findLiverByLinkCode(trimmedText);
  
  if (!liverData) {
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `連携コードが見つからないか、有効期限が切れています。\n\nLCJライバーアプリで新しいコードを発行してください。`,
      },
    ]);
    return;
  }

  // 連携を実行
  await linkLineUserToLiver(liverData.id, lineUserId);

  await sendLinePushMessage(lineUserId, [
    {
      type: "text",
      text: `🎉 ${liverData.name}さん、LINE連携が完了しました！\n\nこれから配信後にAIコーチングがLINEに届きます。\n\n頑張ってください！💪`,
    },
  ]);
}

/**
 * Handle postback event
 */
async function handlePostback(
  event: LineWebhookEvent,
  data: string
): Promise<void> {
  // 将来的な拡張用（ボタン操作など）
  console.log(`[LINE Webhook] Postback received: ${data}`);
}
