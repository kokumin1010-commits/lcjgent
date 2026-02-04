import { invokeLLM } from "./_core/llm";
import { containsReminderKeyword, createReminderFromMessage, getReminderListMessage } from "./lineReminder";
import { storagePut } from "./storage";
import crypto from "crypto";
import {
  createLineReceipt,
  updateLineReceiptStatus,
  updateLineReceiptOcr,
  updateLineReceiptFraudFlags,
  checkDuplicateLineReceiptByHash,
  getRecentLineReceiptsCount,
  createLineFraudDetectionLog,
  checkDuplicateOrderNumberGlobal,
  deleteLineReceipt,
} from "./db";
import {
  createOrUpdateLineUser,
  updateLineUserLastMessage,
} from "./db";

// LINE API configuration
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_API_BASE = "https://api.line.me/v2/bot";

// Types for LINE webhook events
export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    type: string;
    id: string;
    text?: string;
    duration?: number;
    contentProvider?: {
      type: string;
    };
  };
}

// Conversation session management for group chats
interface ConversationSession {
  groupId: string;
  userId: string;
  startedAt: number;
  lastActivityAt: number;
}

// In-memory session storage (key: `${groupId}:${userId}`)
const conversationSessions = new Map<string, ConversationSession>();

// Session timeout in milliseconds (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

// ============================================
// Pending Image Session Management (for multiple images)
// ============================================
// When a user sends an image, we wait for additional images for 10 seconds
// This allows users to send multiple screenshots that together form one order

interface PendingImageData {
  messageId: string;
  imageData: Buffer;
  contentType: string;
  imageUrl: string;
  imageKey: string;
  imageHash: string;
  receiptId: number;
}

interface PendingImageSession {
  userId: string;
  replyToken: string;
  images: PendingImageData[];
  startedAt: number;
  timeoutId: NodeJS.Timeout | null;
}

// In-memory pending image sessions (key: userId)
const pendingImageSessions = new Map<string, PendingImageSession>();

// Image session timeout in milliseconds (10 seconds)
const IMAGE_SESSION_TIMEOUT_MS = 10 * 1000;

// Get or create pending image session
function getOrCreatePendingImageSession(userId: string, replyToken: string): PendingImageSession {
  let session = pendingImageSessions.get(userId);
  
  if (!session) {
    session = {
      userId,
      replyToken,
      images: [],
      startedAt: Date.now(),
      timeoutId: null,
    };
    pendingImageSessions.set(userId, session);
  }
  
  return session;
}

// Clear pending image session
function clearPendingImageSession(userId: string): void {
  const session = pendingImageSessions.get(userId);
  if (session?.timeoutId) {
    clearTimeout(session.timeoutId);
  }
  pendingImageSessions.delete(userId);
}

// Check if user has an active conversation session in the group
function hasActiveSession(groupId: string, userId: string): boolean {
  const key = `${groupId}:${userId}`;
  const session = conversationSessions.get(key);
  
  if (!session) return false;
  
  // Check if session has expired
  const now = Date.now();
  if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
    conversationSessions.delete(key);
    return false;
  }
  
  return true;
}

// Start or refresh a conversation session
function startOrRefreshSession(groupId: string, userId: string): void {
  const key = `${groupId}:${userId}`;
  const now = Date.now();
  
  const existingSession = conversationSessions.get(key);
  
  if (existingSession) {
    existingSession.lastActivityAt = now;
  } else {
    conversationSessions.set(key, {
      groupId,
      userId,
      startedAt: now,
      lastActivityAt: now,
    });
  }
}

// End a conversation session
function endSession(groupId: string, userId: string): void {
  const key = `${groupId}:${userId}`;
  conversationSessions.delete(key);
}

// LINE API helper functions
async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[LINE Agent] Reply failed:", error);
    throw new Error(`LINE reply failed: ${error}`);
  }
}

async function getUserProfile(userId: string): Promise<{
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  try {
    const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[LINE Agent] Failed to get user profile:", error);
    return null;
  }
}

async function getMessageContent(messageId: string): Promise<{
  data: Buffer;
  contentType: string;
} | null> {
  try {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error("[LINE Agent] Failed to get message content:", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    return { data, contentType };
  } catch (error) {
    console.error("[LINE Agent] Error getting message content:", error);
    return null;
  }
}

// Keywords that trigger the agent
// TRIGGER_KEYWORDS and GREETING_KEYWORDS are now ONLY used in combination with @LCJ mention
// They should NOT trigger responses on their own in group chats
const TRIGGER_KEYWORDS = ["タスク", "指示", "依頼", "お願い", "確認", "報告", "完了", "進捗"];
const GREETING_KEYWORDS = ["こんにちは", "おはよう", "こんばんは", "ハロー", "hello", "hi"];
const END_KEYWORDS = ["終了", "おわり", "バイバイ", "さようなら", "ありがとう"];

// Points history keywords
const POINTS_HISTORY_KEYWORDS = ["ポイント履歴", "履歴", "HISTORY", "POINTS", "ポイント確認", "残高"];

// Check if message contains trigger keywords
function containsTriggerKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return TRIGGER_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

function containsGreetingKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return GREETING_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

function containsEndKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return END_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

function containsPointsHistoryKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return POINTS_HISTORY_KEYWORDS.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

// Get points history for a user
async function getPointsHistoryMessage(lineUserId: string): Promise<string> {
  try {
    // Get user's LINE receipts
    const { getDb } = await import("./db");
    const { lineReceipts, lineUsers } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) {
      return "データベースに接続できません。";
    }
    
    // Get user info
    const userResult = await db
      .select()
      .from(lineUsers)
      .where(eq(lineUsers.lineUserId, lineUserId))
      .limit(1);
    
    if (userResult.length === 0) {
      return "ユーザー情報が見つかりません。";
    }
    
    // Get recent receipts (last 10)
    const receipts = await db
      .select()
      .from(lineReceipts)
      .where(eq(lineReceipts.lineUserId, lineUserId))
      .orderBy(desc(lineReceipts.createdAt))
      .limit(10);
    
    // Calculate total approved points
    const approvedReceipts = receipts.filter((r: any) => r.status === "approved");
    const totalPoints = approvedReceipts.reduce((sum: number, r: any) => sum + (r.pointsAwarded || 0), 0);
    
    // Build message
    let message = `📊 ポイント履歴\n\n`;
    message += `💰 現在のポイント残高: ${totalPoints}pt\n`;
    message += `📝 申請件数: ${receipts.length}件\n\n`;
    
    if (receipts.length === 0) {
      message += "まだ申請履歴がありません。";
    } else {
      message += "【最近の申請】\n";
      for (const receipt of receipts.slice(0, 5)) {
        const statusEmoji = 
          receipt.status === "approved" ? "✅" :
          receipt.status === "rejected" ? "❌" :
          receipt.status === "on_hold" ? "⏸️" : "⏳";
        
        const date = receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString("ja-JP") : "不明";
        const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : "金額不明";
        const points = receipt.status === "approved" ? `+${receipt.pointsAwarded}pt` : "";
        
        message += `${statusEmoji} ${date} ${amount} ${points}\n`;
      }
    }
    
    return message;
  } catch (error) {
    console.error("[LINE Agent] Error getting points history:", error);
    return "ポイント履歴の取得中にエラーが発生しました。";
  }
}

// Process text message from LINE
export async function processLineMessage(event: LineWebhookEvent): Promise<void> {
  // Only process text messages
  if (event.type !== "message" || event.message?.type !== "text") {
    return;
  }

  const messageText = event.message.text || "";
  const userId = event.source.userId;
  const isGroupChat = event.source.type === "group";
  const groupId = event.source.groupId;

  if (!userId) {
    console.log(`[LINE Agent] No user ID for message`);
    return;
  }

  console.log(`[LINE Agent] Processing message from ${userId}: ${messageText.substring(0, 50)}...`);

  try {
    // Get user profile
    let profile = null;
    try {
      profile = await getUserProfile(userId);
    } catch (error) {
      console.error("[LINE Agent] Failed to get user profile:", error);
    }

    // Create or update LINE user
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
    });

    // Update last message timestamp
    await updateLineUserLastMessage(userId);

    // For group chats, only respond if mentioned or has active session
    let shouldRespond = !isGroupChat; // Always respond in DM

    if (isGroupChat && groupId) {
      // CRITICAL: In group chats, ONLY respond when explicitly mentioned @LCJ
      // Do NOT use session-based continuation - this causes unwanted responses
      // Each message must have an explicit @LCJ mention to get a response
      const lcjMentionPatterns = [
        /@LCJ/i,           // @LCJ (case insensitive)
        /@714isnih/i,      // LINE bot ID
        /LCJエージェント/i, // LCJエージェント
        /エージェントさん/i, // エージェントさん
      ];
      const isMentioned = lcjMentionPatterns.some(pattern => pattern.test(messageText));

      // ONLY respond if explicitly mentioned - NO session continuation
      if (isMentioned) {
        shouldRespond = true;
        console.log(`[LINE Agent] Responding to mention in group ${groupId}`);
      } else {
        // Not mentioned - ignore completely
        console.log(`[LINE Agent] Ignoring message in group (no @LCJ mention): ${messageText.substring(0, 30)}...`);
        shouldRespond = false;
      }
    }

    if (!shouldRespond) {
      return;
    }

    // Check for points history request
    if (containsPointsHistoryKeyword(messageText)) {
      const historyMessage = await getPointsHistoryMessage(userId);
      
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: historyMessage },
        ]);
      }
      return;
    }

    // Check for reminder request
    if (containsReminderKeyword(messageText)) {
      // Check if it's a reminder list request
      const lowerText = messageText.toLowerCase();
      if (lowerText.includes("一覧") || lowerText.includes("確認") || lowerText.includes("リスト")) {
        const listMessage = await getReminderListMessage(userId);
        if (event.replyToken) {
          await replyMessage(event.replyToken, [
            { type: "text", text: listMessage },
          ]);
        }
        return;
      }

      // Try to create a reminder
      const result = await createReminderFromMessage(userId, messageText);
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: result.message },
        ]);
      }
      return;
    }

    // Generate response using LLM
    const systemPrompt = `あなたは業務支援AIエージェントです。
ユーザーからのタスク依頼や質問に対して、簡潔で親切に回答してください。

主な機能:
1. タスクの受付と整理
2. 進捗確認のリマインド
3. 完了報告の受付
4. 一般的な質問への回答

回答は日本語で、丁寧かつ簡潔にしてください。
絵文字は適度に使用してください。`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageText },
      ],
    });

    const replyText =
      response.choices[0].message.content || "申し訳ありません。応答を生成できませんでした。";

    // Send reply
    if (event.replyToken) {
      await replyMessage(event.replyToken, [{ type: "text", text: replyText }]);
    }
  } catch (error) {
    console.error("[LINE Agent] Error processing message:", error);

    // Send error message
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: "申し訳ありません。処理中にエラーが発生しました。しばらくしてからもう一度お試しください。",
        },
      ]);
    }
  }
}

// Process video message from LINE
export async function processVideoMessage(event: LineWebhookEvent): Promise<void> {
  // Check if this is a video message
  if (event.type !== "message" || event.message?.type !== "video") {
    return;
  }

  const messageId = event.message.id;
  const userId = event.source.userId;
  const isGroupChat = event.source.type === "group";
  const groupId = event.source.groupId;

  if (!userId) {
    console.log(`[LINE Agent] No user ID for video message`);
    return;
  }

  console.log(`[LINE Agent] Processing video from ${userId}`);

  try {
    // Get user profile
    let profile = null;
    try {
      profile = await getUserProfile(userId);
    } catch (error) {
      console.error("[LINE Agent] Failed to get user profile:", error);
    }

    // Create or update LINE user
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
    });

    // Update last message timestamp
    await updateLineUserLastMessage(userId);

    // For group chats, NEVER process videos automatically
    // Videos in groups should only be processed via explicit @LCJ mention in a text message
    let shouldRespond = !isGroupChat; // Always respond in DM, never in groups

    if (isGroupChat && groupId) {
      // CRITICAL: Do NOT process videos in group chats
      // This prevents unwanted responses to random videos shared in groups
      console.log(`[LINE Agent] Ignoring video in group chat (videos only processed in DM)`);
      shouldRespond = false;
    }

    if (!shouldRespond) {
      return;
    }

    // Get video content
    const videoContent = await getMessageContent(messageId);
    if (!videoContent) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "動画の取得に失敗しました。もう一度お送りください。" },
        ]);
      }
      return;
    }

    // Upload video to S3
    const timestamp = Date.now();
    const ext = videoContent.contentType.includes("mp4") ? "mp4" : "mov";
    const fileKey = `line-videos/${userId}/${timestamp}-${messageId}.${ext}`;
    const { url: videoUrl } = await storagePut(fileKey, videoContent.data, videoContent.contentType);

    console.log(`[LINE Agent] Video uploaded to S3: ${videoUrl}`);

    // Reply with confirmation
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: `📹 動画を受け取りました！\n\n動画は正常にアップロードされました。\n担当者が確認いたします。`,
        },
      ]);
    }
  } catch (error) {
    console.error("[LINE Agent] Error processing video:", error);

    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "動画の処理中にエラーが発生しました。しばらくしてからもう一度お試しください。" },
      ]);
    }
  }
}

/**
 * Send photo guide to user
 * ユーザーに撮影ガイドを送信する
 */
async function sendPhotoGuide(userId: string): Promise<void> {
  try {
    const { pushMessage } = await import("./line");
    
    // Photo guide URL (uploaded to S3)
    const photoGuideUrl = "https://manus-storage-c0b40993.s3.ap-northeast-1.amazonaws.com/task-automation-agent/photo-guide-tiktok-shop.png";
    
    // Send text message first
    await pushMessage(userId, [
      {
        type: "text" as const,
        text: `📸 TikTok Shop注文詳細の撮影ガイド\n\n以下の3つの情報が見えるようにスクリーンショットを撮ってください：\n\n1️⃣ 配達ステータス（「X月X日に配達」または「配達済み」）\n2️⃣ 注文番号（17桁の数字）\n3️⃣ 合計金額\n\n⚠️ 1枚に収まらない場合は、2～3枚に分けて送信してください。\n10秒以内に送信された画像は1セットとして処理されます。`,
      },
    ]);
    
    // Send image message separately
    await pushMessage(userId, [
      {
        type: "image" as const,
        originalContentUrl: photoGuideUrl,
        previewImageUrl: photoGuideUrl,
      } as any,
    ]);
  } catch (error) {
    console.error("[LINE Agent] Failed to send photo guide:", error);
  }
}

/**
 * Process receipt image message from LINE
 * LINEから送信されたレシート画像を処理してポイント申請を行う
 * 複数画像対応: 10秒間のバッファリングで複数画像を1セットとして処理
 */
export async function processReceiptImageMessage(event: LineWebhookEvent): Promise<void> {
  // Check if this is an image message
  if (event.type !== "message" || event.message?.type !== "image") {
    return;
  }
  
  const messageId = event.message.id;
  const userId = event.source.userId;
  const isGroupChat = event.source.type === "group";
  const groupId = event.source.groupId;
  
  if (!userId) {
    console.log(`[LINE Agent] No user ID for image message`);
    return;
  }
  
  console.log(`[LINE Agent] Processing receipt image from ${userId}, messageId: ${messageId}`);
  
  try {
    // Get user profile
    let profile = null;
    try {
      profile = await getUserProfile(userId);
    } catch (error) {
      console.error("[LINE Agent] Failed to get user profile:", error);
    }
    
    // Create or update LINE user
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
    });
    
    // Update last message timestamp
    await updateLineUserLastMessage(userId);
    
    // For group chats, NEVER process images automatically
    // Images in groups should only be processed via explicit @LCJ mention in a text message
    let shouldRespond = !isGroupChat; // Always respond in DM, never in groups
    
    if (isGroupChat && groupId) {
      // CRITICAL: Do NOT process images in group chats
      // This prevents unwanted responses to random images shared in groups
      console.log(`[LINE Agent] Ignoring image in group chat (images only processed in DM)`);
      shouldRespond = false;
    }
    
    if (!shouldRespond) {
      return;
    }
    
    // Check submission frequency (max 10 per 24 hours)
    const recentCount = await getRecentLineReceiptsCount(userId, 24);
    if (recentCount >= 10) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "⚠️ 24時間以内の申請上限（10件）に達しています。\n\n明日以降に再度お試しください。" },
        ]);
      }
      return;
    }
    
    // Get image content
    console.log(`[LINE Agent] Fetching image content for message ${messageId}`);
    const imageContent = await getMessageContent(messageId);
    if (!imageContent) {
      console.error(`[LINE Agent] Failed to get image content for message ${messageId}`);
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "画像の取得に失敗しました。もう一度お送りください。" },
        ]);
      }
      return;
    }
    console.log(`[LINE Agent] Image content fetched: ${(imageContent.data.length / 1024).toFixed(1)}KB, type: ${imageContent.contentType}`);
    
    // Generate image hash for duplicate detection
    const imageHash = crypto.createHash("sha256").update(imageContent.data).digest("hex");
    
    // Check for duplicate image
    const duplicateByHash = await checkDuplicateLineReceiptByHash(imageHash);
    if (duplicateByHash) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "⚠️ このレシート画像は既に登録されています。\n\n別のレシートをお送りください。" },
        ]);
      }
      return;
    }
    
    // Upload image to S3
    const timestamp = Date.now();
    const ext = imageContent.contentType.includes("png") ? "png" : "jpg";
    const fileKey = `line-receipts/${userId}/${timestamp}-${messageId}.${ext}`;
    const { url: imageUrl } = await storagePut(fileKey, imageContent.data, imageContent.contentType);
    
    // Create receipt record
    const receiptId = await createLineReceipt({
      lineUserId: userId,
      lineMessageId: messageId,
      imageUrl,
      imageKey: fileKey,
      imageHash,
      status: "pending",
    });
    
    console.log(`[LINE Agent] Created receipt record ${receiptId} for image ${messageId}`);
    
    // Get or create pending image session
    const session = getOrCreatePendingImageSession(userId, event.replyToken || "");
    
    // Add image to session
    session.images.push({
      messageId,
      imageData: imageContent.data,
      contentType: imageContent.contentType,
      imageUrl,
      imageKey: fileKey,
      imageHash,
      receiptId,
    });
    
    console.log(`[LINE Agent] Added image to session, total images: ${session.images.length}`);
    
    // If this is the first image, send initial response and photo guide
    if (session.images.length === 1) {
      // Send initial response
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "📷 画像を受け付けました！\n\n追加の画像がある場合は10秒以内に送信してください。\n（注文番号と配達ステータスが別々の画面にある場合は、両方のスクリーンショットを送信してください）" },
        ]);
      }
      
      // Send photo guide for first-time users
      await sendPhotoGuide(userId);
    }
    
    // Clear existing timeout
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    
    // Set new timeout to process images after 10 seconds
    session.timeoutId = setTimeout(async () => {
      console.log(`[LINE Agent] Processing ${session.images.length} images for user ${userId}`);
      
      try {
        // Process all images together
        await processMultipleImagesOcr(session.images, userId);
      } catch (error: any) {
        console.error("[LINE Agent] Multi-image OCR processing failed:", error);
        console.error("[LINE Agent] Error details:", {
          name: error?.name,
          message: error?.message,
          stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
        });
        
        // Delete all receipt records on failure
        for (const img of session.images) {
          try {
            await deleteLineReceipt(img.receiptId);
            console.log(`[LINE Agent] Deleted failed receipt record ${img.receiptId}`);
          } catch (deleteError) {
            console.error(`[LINE Agent] Failed to delete receipt ${img.receiptId}:`, deleteError);
          }
        }
        
        // Notify user
        try {
          const { pushMessage } = await import("./line");
          await pushMessage(userId, [
            {
              type: "text",
              text: `❌ 画像の解析に失敗しました。\n\nもう一度スクリーンショットを送信してください。\n\n【撮影のコツ】\n・「X月X日に配達」または「配達済み」が見える画面\n・注文番号（17桁）が見える画面\n・合計金額が見える画面\n\n1枚に収まらない場合は、2〜3枚に分けて送信してください。`,
            },
          ]);
        } catch (notifyError) {
          console.error("[LINE Agent] Failed to send error notification:", notifyError);
        }
      } finally {
        // Clear session
        clearPendingImageSession(userId);
      }
    }, IMAGE_SESSION_TIMEOUT_MS);
    
  } catch (error) {
    console.error("[LINE Agent] Error processing receipt image:", error);
    
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "レシートの処理中にエラーが発生しました。しばらくしてからもう一度お試しください。" },
      ]);
    }
  }
}

/**
 * Process multiple images together using OCR
 * 複数の画像を統合して解析する
 */
async function processMultipleImagesOcr(
  images: PendingImageData[],
  lineUserId: string
): Promise<void> {
  console.log(`[LINE Agent] Starting multi-image OCR for ${images.length} images`);
  
  // Build image content array for LLM
  const imageContents: any[] = [];
  for (const img of images) {
    const base64Image = img.imageData.toString("base64");
    imageContents.push({
      type: "image_url",
      image_url: {
        url: `data:${img.contentType};base64,${base64Image}`,
        detail: "high", // Use high resolution for better OCR
      },
    });
  }
  
  // Add text prompt
  imageContents.push({
    type: "text",
    text: `これらの${images.length}枚の画像はTikTok Shopの注文詳細画面のスクリーンショットです。
すべての画像を統合して、以下の情報を抽出してください。
情報が複数の画像に分散している場合は、すべての画像から情報を収集してください。`,
  });
  
  try {
    console.log(`[LINE Agent] Calling LLM for OCR analysis with ${images.length} images`);
    console.log(`[LINE Agent] Image sizes: ${images.map(img => `${(img.imageData.length / 1024).toFixed(1)}KB`).join(', ')}`);
    console.log(`[LINE Agent] Image content types: ${images.map(img => img.contentType).join(', ')}`);
    console.log(`[LINE Agent] Image URLs: ${images.map(img => img.imageUrl).join(', ')}`);
    
    // Validate image data before sending to LLM
    for (const img of images) {
      if (!img.imageData || img.imageData.length === 0) {
        console.error(`[LINE Agent] Empty image data for message ${img.messageId}`);
        throw new Error(`Empty image data for message ${img.messageId}`);
      }
      if (img.imageData.length > 10 * 1024 * 1024) {
        console.error(`[LINE Agent] Image too large: ${(img.imageData.length / 1024 / 1024).toFixed(2)}MB`);
        throw new Error(`Image too large: ${(img.imageData.length / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    console.log(`[LINE Agent] Starting LLM invocation...`);
    const llmStartTime = Date.now();
    
    // Run OCR analysis with LLM - NO response_format to avoid compatibility issues
    const ocrResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析するAIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：

{
  "isTikTokShop": true/false,  // TikTok Shopの注文詳細画面かどうか
  "isDelivered": true/false,   // 配達済みステータスが確認できるか
  "orderNumber": "string",     // 注文番号（17桁程度の数字）
  "totalAmount": number,       // 合計金額（数値のみ）
  "orderDate": "string",       // 注文日時
  "shopName": "string",        // ショップ名
  "productName": "string"      // 商品名
}

【配達済みの判定基準】
以下のいずれかが確認できれば isDelivered = true としてください：
- 「配達済み」という文字
- 「X月X日に配達」（例：「1月28日に配達」）
- 「お荷物が最終目的地に到着しました」
- 「已签收」「Delivered」
- 配達ステータスのプログレスバーで最後のステップが完了している

【重要】
- 抽出できない項目はnullを返してください
- 必ずJSON形式のみで回答してください（説明文は不要）
- 複数画像から情報を統合してください`,
        },
        {
          role: "user",
          content: imageContents,
        },
      ],
      // NO response_format - use natural JSON parsing instead
    });
    
    const llmEndTime = Date.now();
    console.log(`[LINE Agent] LLM invocation completed in ${llmEndTime - llmStartTime}ms`);
    console.log(`[LINE Agent] LLM response structure:`, {
      hasChoices: !!ocrResult.choices,
      choicesLength: ocrResult.choices?.length,
      hasMessage: !!ocrResult.choices?.[0]?.message,
      contentType: typeof ocrResult.choices?.[0]?.message?.content,
    });
    
    const messageContent = ocrResult.choices[0].message.content;
    console.log(`[LINE Agent] LLM raw response (first 500 chars): ${typeof messageContent === 'string' ? messageContent.substring(0, 500) : JSON.stringify(messageContent).substring(0, 500)}`);
    
    // Parse JSON from response (handle markdown code blocks)
    let ocrData: any;
    try {
      let jsonStr = typeof messageContent === "string" ? messageContent : "{}";
      
      // Remove markdown code blocks if present
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\s*/g, "");
      }
      
      // Trim whitespace
      jsonStr = jsonStr.trim();
      
      ocrData = JSON.parse(jsonStr);
      console.log(`[LINE Agent] Parsed OCR data:`, ocrData);
    } catch (parseError: any) {
      console.error("[LINE Agent] Failed to parse LLM response as JSON:", {
        error: parseError?.message,
        rawResponseLength: typeof messageContent === 'string' ? messageContent.length : 0,
        rawResponsePreview: typeof messageContent === 'string' ? messageContent.substring(0, 200) : JSON.stringify(messageContent).substring(0, 200),
      });
      console.error("[LINE Agent] Full raw response:", messageContent);
      throw new Error(`LLM response is not valid JSON: ${parseError?.message}`);
    }
    
    // Use the first receipt ID as the primary record
    const primaryReceiptId = images[0].receiptId;
    
    // Delete other receipt records (keep only the primary one)
    for (let i = 1; i < images.length; i++) {
      try {
        await deleteLineReceipt(images[i].receiptId);
        console.log(`[LINE Agent] Deleted secondary receipt record ${images[i].receiptId}`);
      } catch (deleteError) {
        console.error(`[LINE Agent] Failed to delete receipt ${images[i].receiptId}:`, deleteError);
      }
    }
    
    const { pushMessage } = await import("./line");
    
    // 1. TikTok Shopの注文詳細画面かどうか確認
    if (!ocrData.isTikTokShop) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `❌ この画像はTikTok Shopの注文詳細画面ではありません。\n\nTikTok Shopアプリの注文履歴から、注文詳細画面のスクリーンショットを送信してください。`,
        },
      ]);
      await updateLineReceiptStatus(primaryReceiptId, "rejected", 0, "自動拒否: TikTok Shopの注文詳細画面ではない");
      return;
    }
    
    // 2. 配達済みステータスの確認（必須）
    if (!ocrData.isDelivered) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `❌ この注文はまだ「配達済み」になっていません。\n\nポイント申請は商品が配達された後に行ってください。\n\n【確認方法】\n・「X月X日に配達」または「配達済み」の表示があるか確認\n・配達ステータスのプログレスバーが完了しているか確認\n\n配達完了後、再度スクリーンショットを送信してください。`,
        },
      ]);
      await updateLineReceiptStatus(primaryReceiptId, "rejected", 0, "自動拒否: 配達済みステータスではない");
      return;
    }
    
    // 3. 注文番号と金額の確認
    if (!ocrData.orderNumber || !ocrData.totalAmount) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `⚠️ 注文情報を読み取れませんでした。\n\n以下を確認して再送信してください：\n・注文番号（17桁の数字）が見えるか\n・合計金額が見えるか\n・画像が鮮明か\n\n1枚に収まらない場合は、2〜3枚に分けて送信してください。`,
        },
      ]);
      // Delete receipt record to allow resubmission
      await deleteLineReceipt(primaryReceiptId);
      return;
    }
    
    // Calculate points (1% return)
    const pointsCalculated = Math.floor(ocrData.totalAmount * 0.01);
    
    // Update receipt with OCR data
    await updateLineReceiptOcr(primaryReceiptId, {
      storeName: ocrData.shopName || "TikTok Shop",
      purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
      totalAmount: ocrData.totalAmount,
      currency: "JPY",
      ocrRawText: JSON.stringify({
        orderNumber: ocrData.orderNumber,
        shopName: ocrData.shopName,
        productName: ocrData.productName,
        isDelivered: ocrData.isDelivered,
        imageCount: images.length,
      }),
      ocrConfidence: "high",
      pointsCalculated,
    });
    
    // Run fraud detection
    const fraudFlags: string[] = [];
    let fraudScore = 0;
    
    // Check for expired order (older than 30 days for TikTok Shop)
    if (ocrData.orderDate) {
      const orderDate = new Date(ocrData.orderDate);
      const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceOrder > 30) {
        fraudFlags.push("expired_order");
        fraudScore += 50;
        await createLineFraudDetectionLog({
          receiptId: primaryReceiptId,
          lineUserId,
          checkType: "expired_receipt",
          detected: true,
          severity: "high",
          details: `注文日から${Math.floor(daysSinceOrder)}日経過（30日以内のみ有効）`,
        });
      }
    }
    
    // Check for duplicate order number across ALL users (global check)
    if (ocrData.orderNumber) {
      const duplicateOrder = await checkDuplicateOrderNumberGlobal(
        ocrData.orderNumber,
        primaryReceiptId
      );
      if (duplicateOrder) {
        // 全ユーザー間で重複が見つかった
        const isSameUser = duplicateOrder.lineUserId === lineUserId;
        fraudFlags.push("duplicate_order");
        fraudScore += 100; // 同じ注文番号は完全に重複
        await createLineFraudDetectionLog({
          receiptId: primaryReceiptId,
          lineUserId,
          checkType: "duplicate_receipt",
          detected: true,
          severity: "high",
          details: isSameUser 
            ? `あなたは既にこの注文でポイント申請済みです: ${ocrData.orderNumber}`
            : `この注文番号は他のユーザーが既に申請済みです: ${ocrData.orderNumber}`,
          relatedReceiptId: duplicateOrder.id,
        });
        
        // 即座に拒否してユーザーに通知
        await updateLineReceiptStatus(primaryReceiptId, "rejected", 0, 
          isSameUser 
            ? "自動拒否: 同じ注文番号での重複申請"
            : "自動拒否: 他ユーザーが既に申請済みの注文番号"
        );
        
        await pushMessage(lineUserId, [
          {
            type: "text",
            text: isSameUser
              ? `❌ この注文は既にポイント申請済みです。\n\n注文番号: ${ocrData.orderNumber}\n\n同じ注文での重複申請はできません。`
              : `❌ この注文番号は既に他の方が申請済みです。\n\n注文番号: ${ocrData.orderNumber}\n\n同じ注文での重複申請はできません。\nご自身の注文詳細画面を送信してください。`,
          },
        ]);
        return; // 重複の場合はここで終了
      }
    }
    
    // Check for unusually high amount (over 100,000 JPY)
    if (ocrData.totalAmount > 100000) {
      fraudFlags.push("high_amount");
      fraudScore += 20;
      await createLineFraudDetectionLog({
        receiptId: primaryReceiptId,
        lineUserId,
        checkType: "high_amount",
        detected: true,
        severity: "low",
        details: `高額購入: ¥${ocrData.totalAmount.toLocaleString()}`,
      });
    }
    
    // Update fraud flags
    if (fraudFlags.length > 0) {
      await updateLineReceiptFraudFlags(primaryReceiptId, fraudFlags, fraudScore);
      
      // Auto-hold if fraud score is high
      if (fraudScore >= 50) {
        await updateLineReceiptStatus(primaryReceiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
      }
    }
    
    console.log(`[LINE Agent] TikTok Shop OCR completed for ${primaryReceiptId}:`, {
      orderNumber: ocrData.orderNumber,
      shopName: ocrData.shopName,
      totalAmount: ocrData.totalAmount,
      pointsCalculated,
      fraudScore,
      imageCount: images.length,
    });
    
    // Send OCR completion notification to user
    if (fraudScore >= 50 && !fraudFlags.includes("duplicate_order")) {
      // High fraud score - notify user about hold status
      const holdReasons: string[] = [];
      if (fraudFlags.includes("expired_order")) {
        holdReasons.push("・注文日から30日以上経過しています");
      }
      
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `⚠️ 注文を確認中です\n\n以下の理由で保留となりました：\n${holdReasons.join("\n")}\n\nスタッフが確認後、結果をお知らせします。`,
        },
      ]);
    } else if (fraudScore < 50) {
      // Successful OCR - notify user with extracted info
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `✅ 注文の確認が完了しました！\n\n📝 注文番号: ${ocrData.orderNumber}\n🏪 ショップ: ${ocrData.shopName || "TikTok Shop"}\n📦 商品: ${ocrData.productName || "不明"}\n💰 購入金額: ¥${ocrData.totalAmount.toLocaleString()}\n⭐ 獲得予定ポイント: ${pointsCalculated}pt\n\nスタッフが確認後、ポイントが付与されます。`,
        },
      ]);
    }
    
  } catch (error: any) {
    console.error("[LINE Agent] Multi-image OCR analysis failed:", error);
    console.error("[LINE Agent] Error name:", error?.name);
    console.error("[LINE Agent] Error message:", error?.message);
    console.error("[LINE Agent] Error stack:", error?.stack);
    if (error?.response) {
      console.error("[LINE Agent] API response status:", error.response?.status);
      console.error("[LINE Agent] API response data:", JSON.stringify(error.response?.data, null, 2));
    }
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Combined message processor - handles both text and video messages
 */
export async function processLineMessageAll(event: LineWebhookEvent): Promise<void> {
  if (event.type !== "message") {
    return;
  }
  
  const messageType = event.message?.type;
  
  switch (messageType) {
    case "text":
      await processLineMessage(event);
      break;
    case "video":
      await processVideoMessage(event);
      break;
    case "image":
      await processReceiptImageMessage(event);
      break;
    case "audio":
      // TODO: Add audio processing if needed
      console.log(`[LINE Agent] Audio message received, not yet implemented`);
      break;
    default:
      console.log(`[LINE Agent] Unknown message type: ${messageType}`);
  }
}
