import crypto from "crypto";
import { ENV } from "./_core/env";
import { getDb, verifyAndUseLinkCode, linkLineAccountToEmailUser, getLineUserById, getLineReceiptsByUser, getLinePointBalance } from "./db";
import { livers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendLinePushMessage } from "./_core/lineMessaging";

/**
 * プロラインフリーへWebhookを転送する
 * LCJの処理をブロックしないように非同期で実行
 */
export async function forwardToProline(
  rawBody: string,
  signature: string
): Promise<void> {
  const prolineUrl = ENV.prolineWebhookUrl;
  
  if (!prolineUrl) {
    console.log("[Proline Forward] PROLINE_WEBHOOK_URL not configured, skipping");
    return;
  }
  
  try {
    const response = await fetch(prolineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Line-Signature": signature,
      },
      body: rawBody,
    });
    
    if (response.ok) {
      console.log(`[Proline Forward] Successfully forwarded to ${prolineUrl}`);
    } else {
      console.error(`[Proline Forward] Failed with status ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    // 転送失敗してもLCJの処理は継続
    console.error("[Proline Forward] Error forwarding webhook:", error);
  }
}

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
 * LINE連携コードを生成
 * ライバー用: L-XXXXXX
 * モール会員用: M-XXXXXX
 */
export function generateLinkCode(type: 'liver' | 'mall' = 'liver'): string {
  const prefix = type === 'liver' ? 'L' : 'M';
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${code}`;
}

/**
 * ライバー用連携コードを生成
 */
export function generateLiverLinkCode(): string {
  return generateLinkCode('liver');
}

/**
 * モール会員用連携コードを生成
 */
export function generateMallLinkCode(): string {
  return generateLinkCode('mall');
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
 * @param body - Parsed webhook body
 * @param rawBody - Raw request body string (for forwarding)
 * @param signature - X-Line-Signature header (for forwarding)
 */
export async function handleLineWebhook(
  body: LineWebhookBody,
  rawBody?: string,
  signature?: string
): Promise<{ processed: number; errors: string[] }> {
  // プロラインフリーへ非同期で転送（LCJの処理をブロックしない）
  if (rawBody && signature) {
    forwardToProline(rawBody, signature).catch((err) => {
      console.error("[Proline Forward] Async forward error:", err);
    });
  }
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
 * コード形式:
 * - L-XXXXXX: ライバー用
 * - M-XXXXXX: モール会員用
 */
async function handleTextMessage(
  event: LineWebhookEvent,
  text: string
): Promise<void> {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const trimmedText = text.trim();
  const upperText = trimmedText.toUpperCase();
  
  // 「ポイント履歴」コマンドのチェック
  if (trimmedText === 'ポイント履歴' || trimmedText === '履歴' || upperText === 'HISTORY' || upperText === 'POINTS') {
    await handlePointHistoryCommand(lineUserId);
    return;
  }
  
  // プレフィックス付きコードの形式をチェック (L-XXXXXX または M-XXXXXX)
  const codeMatch = upperText.match(/^([LM])-?(\d{6})$/);
  
  if (!codeMatch) {
    // 連携コードではない場合は案内メッセージを送信
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `LINE連携をするには、連携コードを送信してください。\n\n【LCJ MALL会員の方】\nマイページ → LINE連携 → コード発行\n例: M-123456\n\n【LCJライバーの方】\nアプリ → プロフィール → LINE連携\n例: L-123456`,
      },
    ]);
    return;
  }

  const codeType = codeMatch[1]; // 'L' or 'M'
  const fullCode = `${codeType}-${codeMatch[2]}`; // Normalize to X-XXXXXX format

  if (codeType === 'M') {
    // モール会員用コード
    const mallUserLinked = await tryLinkMallUser(fullCode, lineUserId);
    if (mallUserLinked) {
      return; // MALL会員の連携が完了
    }
    // コードが見つからない場合
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `モール会員用の連携コードが見つからないか、有効期限が切れています。\n\nLCJ MALLのマイページから新しいコードを発行してください。`,
      },
    ]);
    return;
  }

  // ライバー用コード (L-XXXXXX)
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

  // 連携コードでライバーを検索
  const liverData = await findLiverByLinkCode(fullCode);
  
  if (!liverData) {
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `ライバー用の連携コードが見つからないか、有効期限が切れています。\n\nLCJライバーアプリで新しいコードを発行してください。`,
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
 * Try to link LCJ MALL user with LINE account
 * Returns true if linked successfully, false if code not found
 */
async function tryLinkMallUser(
  code: string,
  lineUserId: string
): Promise<boolean> {
  try {
    // 連携コードを検証して使用
    const emailUserId = await verifyAndUseLinkCode(code, lineUserId);
    
    if (!emailUserId) {
      return false; // コードが見つからないか期限切れ
    }
    
    // LINEプロフィールを取得（名前とアイコン）
    let displayName = "LCJ MALL会員";
    let pictureUrl: string | undefined;
    
    try {
      const profileResponse = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      });
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        displayName = profile.displayName || displayName;
        pictureUrl = profile.pictureUrl;
      }
    } catch {
      // プロフィール取得失敗しても継続
    }
    
    // メールユーザーにLINE IDを紐付け
    await linkLineAccountToEmailUser(emailUserId, lineUserId, displayName, pictureUrl);
    
    // ユーザー情報を取得して名前を表示
    const user = await getLineUserById(emailUserId);
    const userName = user?.displayName || "お客様";
    
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `🎉 ${userName}さん、LINE連携が完了しました！\n\nこれでレシートをLINEで送信できるようになりました。\n\n購入後はレシート画像をこちらに送信してポイントを獲得してください！`,
      },
    ]);
    
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "LINE_ALREADY_LINKED") {
      await sendLinePushMessage(lineUserId, [
        {
          type: "text",
          text: `このLINEアカウントは既に別のアカウントに連携されています。\n\n別のLINEアカウントでお試しください。`,
        },
      ]);
      return true; // エラーだが処理済み
    }
    console.error("[LINE Webhook] Error linking MALL user:", error);
    return false;
  }
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


/**
 * Handle "ポイント履歴" command
 * Shows user's point balance and recent receipt submissions
 */
async function handlePointHistoryCommand(lineUserId: string): Promise<void> {
  try {
    // Get point balance
    const balance = await getLinePointBalance(lineUserId);
    
    // Get recent receipts (last 10)
    const receipts = await getLineReceiptsByUser(lineUserId);
    const recentReceipts = receipts.slice(0, 10);
    
    if (!balance && recentReceipts.length === 0) {
      // User has no history
      await sendLinePushMessage(lineUserId, [
        {
          type: "text",
          text: "📊 ポイント履歴\n\nまだポイント申請の履歴がありません。\n\nTikTok Shopで商品を購入したら、注文詳細のスクリーンショットを送信してポイントを獲得しましょう！",
        },
      ]);
      return;
    }
    
    // Build Flex Message
    const currentBalance = balance?.balance || 0;
    const totalEarned = balance?.totalEarned || 0;
    const totalUsed = balance?.totalUsed || 0;
    
    // Status emoji mapping
    const statusEmoji: Record<string, string> = {
      pending: "⏳",
      approved: "✅",
      rejected: "❌",
      on_hold: "⚠️",
    };
    
    const statusText: Record<string, string> = {
      pending: "審査中",
      approved: "承認済",
      rejected: "却下",
      on_hold: "保留中",
    };
    
    // Build receipt history text
    let historyText = "";
    if (recentReceipts.length > 0) {
      historyText = "\n\n📋 最近の申請:\n";
      for (const receipt of recentReceipts) {
        const date = new Date(receipt.submittedAt).toLocaleDateString("ja-JP", {
          month: "numeric",
          day: "numeric",
        });
        const emoji = statusEmoji[receipt.status] || "❓";
        const status = statusText[receipt.status] || receipt.status;
        const amount = receipt.totalAmount?.toLocaleString() || "-";
        const points = receipt.status === "approved" 
          ? `+${receipt.pointsAwarded || 0}pt`
          : receipt.status === "pending"
            ? `(${receipt.pointsCalculated || 0}pt予定)`
            : "";
        
        historyText += `${emoji} ${date} ¥${amount} ${status} ${points}\n`;
      }
    }
    
    // Send summary message
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: `📊 ポイント履歴\n\n💰 現在のポイント: ${currentBalance.toLocaleString()}pt\n📈 累計獲得: ${totalEarned.toLocaleString()}pt\n📉 累計使用: ${totalUsed.toLocaleString()}pt${historyText}\n\n※ 審査中の申請は承認後にポイントが付与されます`,
      },
    ]);
    
  } catch (error) {
    console.error("[Point History] Error:", error);
    await sendLinePushMessage(lineUserId, [
      {
        type: "text",
        text: "申し訳ありません。ポイント履歴の取得中にエラーが発生しました。しばらくしてから再度お試しください。",
      },
    ]);
  }
}
