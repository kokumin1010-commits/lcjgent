import { invokeLLM } from "./_core/llm";
import { containsReminderKeyword, createReminderFromMessage, getReminderListMessage } from "./lineReminder";
import {
  createOrUpdateLineUser,
  getLineUserByLineId,
  saveLineGroupInboundMessageAndActivity,
  saveLineMessage,
  updateLineMessageSenderName,
  updateLineUserLastMessage,
} from "./db";

// LINE API configuration
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_PROFILE_TIMEOUT_MS = 2_000;
const LINE_MESSAGE_TIMEOUT_MS = 10_000;
const LINE_CONTENT_TIMEOUT_MS = 15_000;

// Customer questions must be handled by staff. Explicit business commands such as
// point-history lookup and reminder setup remain available below.
export const LINE_GENERAL_AI_AUTO_REPLY_ENABLED = false;
const LINE_GROUP_METADATA_REFRESH_COOLDOWN_MS = 60_000;
const groupMetadataRefreshAttemptAt = new Map<string, number>();

type CapturedGroupProfile = {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null;

async function captureGroupTextMessage(
  event: LineWebhookEvent,
  lineGroupId: string,
  lineUserId: string,
  waitForEnrichment: boolean,
): Promise<CapturedGroupProfile> {
  // Persist the raw event before any external LINE lookup. A duplicate message
  // ID is already a safe no-op in saveLineMessage.
  const stored = await saveLineGroupInboundMessageAndActivity({
    messageId: event.message!.id,
    lineUserId,
    lineGroupId,
    content: event.message?.text,
    lineTimestamp: event.timestamp,
  });
  if (!stored && !waitForEnrichment) return null;

  const enrich = async (): Promise<CapturedGroupProfile> => {
    const [{ getGroupMemberProfile }, { syncLineGroupMetadata }] = await Promise.all([
      import("./line"),
      import("./lineGroupLifecycle"),
    ]);
    const cachedUser = await getLineUserByLineId(lineUserId).catch(() => null);
    const now = Date.now();
    const shouldRefreshGroupMetadata =
      now - (groupMetadataRefreshAttemptAt.get(lineGroupId) || 0) >= LINE_GROUP_METADATA_REFRESH_COOLDOWN_MS;
    if (shouldRefreshGroupMetadata) groupMetadataRefreshAttemptAt.set(lineGroupId, now);
    const [profile] = await Promise.all([
      cachedUser?.displayName
        ? Promise.resolve({
            userId: lineUserId,
            displayName: cachedUser.displayName,
            pictureUrl: cachedUser.pictureUrl || undefined,
            statusMessage: cachedUser.statusMessage || undefined,
          })
        : getGroupMemberProfile(lineGroupId, lineUserId).catch(error => {
            console.error("[LINE Agent] Failed to get group member profile:", error);
            return null;
          }),
      shouldRefreshGroupMetadata
        ? syncLineGroupMetadata(lineGroupId).catch(error => {
            console.error("[LINE Agent] Failed to refresh group metadata:", error);
            return { updated: false };
          })
        : Promise.resolve({ updated: false }),
    ]);

    await createOrUpdateLineUser({
      lineUserId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      identityVerificationMethod: profile ? "line_profile_api" : undefined,
    }).catch(error => {
      console.error("[LINE Agent] Failed to persist group member profile:", error);
    });
    if (profile?.displayName && event.message?.id) {
      await updateLineMessageSenderName(
        event.message.id,
        lineUserId,
        profile.displayName,
      ).catch(error => {
        console.error("[LINE Agent] Failed to enrich group message sender name:", error);
      });
    }
    return profile;
  };

  if (waitForEnrichment) return await enrich();
  setImmediate(() => {
    void enrich().catch(error => {
      console.error("[LINE Agent] Deferred group enrichment failed:", error);
    });
  });
  return null;
}

async function queueMessageForHumanResponse(
  event: LineWebhookEvent,
  senderName?: string
): Promise<void> {
  if (!event.message?.id) return;

  try {
    await saveLineMessage({
      messageId: event.message.id,
      sourceType: event.source.type,
      lineUserId: event.source.userId,
      lineGroupId: event.source.groupId,
      senderName,
      messageType: event.message.type,
      content: event.message.text,
      direction: "incoming",
      lineTimestamp: event.timestamp,
      needsResponse: true,
      responseStatus: "pending",
      responseSummary: "AI自動返信は停止中です。内容を確認してスタッフが返信してください。",
    });
  } catch (error) {
    console.error("[LINE Agent] Failed to queue message for human response:", error);
  }
}

async function saveLineCommandReplyAudit(
  event: LineWebhookEvent,
  lineUserId: string,
  content: string,
): Promise<void> {
  if (!event.message?.id) return;
  await saveLineMessage({
    messageId: `line-command-reply:${event.message.id}`,
    sourceType: event.source.type,
    lineUserId,
    lineGroupId: event.source.groupId,
    senderName: "LCJ公式LINE",
    messageType: "text",
    content,
    direction: "outgoing",
    lineTimestamp: Date.now(),
    needsResponse: false,
    responseStatus: "none",
  }).catch(error => console.error("[LINE Agent] Command reply audit write failed:", error));
}

export function containsExplicitLcjMention(
  messageText: string,
  mention?: { mentionees?: Array<{ isSelf?: boolean; userId?: string }> },
): boolean {
  if (mention?.mentionees?.some(mentionee => mentionee.isSelf === true)) return true;
  return [
    /[@＠]LCJ\b/i,
    /[@＠]714isnih\b/i,
  ].some(pattern => pattern.test(messageText));
}

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
    mention?: {
      mentionees?: Array<{ isSelf?: boolean; userId?: string }>;
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
// Image message deduplication (重複メッセージ防止)
// ============================================
const agentImageCooldowns = new Map<string, number>();
const AGENT_IMAGE_COOLDOWN_MS = 5 * 60 * 1000; // 5分

// Clean up expired cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of Array.from(agentImageCooldowns.entries())) {
    if (now - ts > AGENT_IMAGE_COOLDOWN_MS) agentImageCooldowns.delete(uid);
  }
}, 10 * 60 * 1000);

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
    signal: AbortSignal.timeout(LINE_MESSAGE_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(LINE_PROFILE_TIMEOUT_MS),
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

// Beauty Wallet is the only live balance. Never derive a current balance from
// the legacy receipt subset because that can be incomplete or identity-split.
async function getPointsHistoryMessage(_lineUserId: string): Promise<string> {
  const appUrl = process.env.APP_URL || "https://lcjmall.com";
  return `ポイントの現在残高はBeauty Walletが唯一の主台帳です。\n\nLCJへログイン後、Beauty Wallet画面でメール認証・連携状況・統一残高をご確認ください。\n${appUrl}/beauty-wallet\n\nLCJ内の過去の申請・取引表示は照合用の履歴であり、現在残高ではありません。`;
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
  const isExplicitGroupMention = Boolean(
    isGroupChat && groupId && containsExplicitLcjMention(messageText, event.message.mention),
  );

  if (!userId) {
    console.log(`[LINE Agent] No user ID for message`);
    return;
  }

  console.log(`[LINE Agent] Processing ${event.source.type} text message`);

  let capturedGroupProfile: CapturedGroupProfile = null;
  if (isGroupChat && groupId) {
    capturedGroupProfile = await captureGroupTextMessage(
      event,
      groupId,
      userId,
      isExplicitGroupMention,
    );
  }

  if (isGroupChat && !isExplicitGroupMention) {
    console.log("[LINE Agent] Stored group message without replying (no explicit mention)");
    return;
  }

  try {
    const isDirectCommand = containsPointsHistoryKeyword(messageText) || containsReminderKeyword(messageText);
    if (!isGroupChat) {
      const {
        recordLineAiManagerInboundActivity,
        tryHandleLineAiManagerMessage,
      } = await import("./lineAiManager");
      if (isDirectCommand) {
        await recordLineAiManagerInboundActivity(event);
      } else {
        const handledByAiManager = await tryHandleLineAiManagerMessage(event);
        if (handledByAiManager) return;
      }
    }

    // Group members require the group-member profile endpoint. Direct chats use
    // the normal profile endpoint.
    let profile = capturedGroupProfile;
    try {
      if (isGroupChat && groupId && !profile) {
        const { getGroupMemberProfile } = await import("./line");
        profile = await getGroupMemberProfile(groupId, userId);
      } else if (!isGroupChat) {
        profile = await getUserProfile(userId);
      }
    } catch (error) {
      console.error("[LINE Agent] Failed to get user profile:", error);
    }

    // Create or update LINE user
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      identityVerificationMethod: profile ? "line_profile_api" : undefined,
    });

    // Update last message timestamp
    await updateLineUserLastMessage(userId);

    if (isExplicitGroupMention) {
      const {
        canLineAiManagerReplyInGroup,
        recordLineAiManagerInboundActivity,
        tryHandleLineAiManagerMessage,
      } = await import("./lineAiManager");
      const canReply = await canLineAiManagerReplyInGroup(groupId!, userId);
      if (!canReply) {
        console.log("[LINE Agent] Ignoring ineligible explicit group mention");
        return;
      }
      if (isDirectCommand) {
        await recordLineAiManagerInboundActivity(event, profile?.displayName);
        const privateCommandMessage = "ポイント履歴の確認やリマインダーの確認・設定は、個人情報保護のためLCJ公式LINEとの1対1トークで送ってください。グループ内では照会・登録を行いません。\n\n— LCJ公式AIマネージャー";
        if (event.replyToken) {
          try {
            await replyMessage(event.replyToken, [
              { type: "text", text: privateCommandMessage },
            ]);
          } catch (cause) {
            const handoffError = new Error("LINE group private-command warning delivery failed", { cause });
            handoffError.name = "LineAiManagerHandoffError";
            throw handoffError;
          }
          await saveLineCommandReplyAudit(event, userId, privateCommandMessage);
        }
        return;
      } else {
        await tryHandleLineAiManagerMessage(
          event,
          profile?.displayName,
          { isExplicitBotMention: true },
        );
        // Group messages are exclusively owned by the dedicated AI-manager path.
        // A false result can mean a concurrent opt-out or eligibility change and
        // must never fall through to the legacy generic responder.
        return;
      }
    }

    // Every group path is terminal above. Only 1:1 messages can continue into
    // legacy command handling or the human-response queue below.
    if (isGroupChat) return;

    // Check for points history request
    if (containsPointsHistoryKeyword(messageText)) {
      const historyMessage = await getPointsHistoryMessage(userId);
      
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: historyMessage },
        ]);
        await saveLineCommandReplyAudit(event, userId, historyMessage);
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
          await saveLineCommandReplyAudit(event, userId, listMessage);
        }
        return;
      }

      // Try to create a reminder
      const result = await createReminderFromMessage(userId, messageText);
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: result.message },
        ]);
        await saveLineCommandReplyAudit(event, userId, result.message);
      }
      return;
    }

    if (!LINE_GENERAL_AI_AUTO_REPLY_ENABLED) {
      await queueMessageForHumanResponse(event, profile?.displayName);
      console.log("[LINE Agent] General AI auto-reply is disabled; queued for staff response");
      return;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "LineAiManagerHandoffError") {
      throw error;
    }
    // Never send a fallback message automatically. A processing failure must not
    // re-enable customer-facing auto replies through the error path.
    console.error("[LINE Agent] Error processing message while auto-reply is disabled:", error);
    await queueMessageForHumanResponse(event);
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

  console.log("[LINE Agent] Processing video message");

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
      identityVerificationMethod: profile ? "line_profile_api" : undefined,
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
 * LINEから送信された画像を履歴として保存し、主台帳移行中であることを案内する
 */
export async function processReceiptImageMessage(event: LineWebhookEvent): Promise<void> {
  // Check if this is an image message
  if (event.type !== "message" || event.message?.type !== "image") {
    return;
  }
  
  const userId = event.source.userId;
  const isGroupChat = event.source.type === "group";
  
  if (!userId) {
    console.log(`[LINE Agent] No user ID for image message`);
    return;
  }
  
  // For group chats, ignore images completely
  if (isGroupChat) {
    console.log(`[LINE Agent] Ignoring image in group chat`);
    return;
  }
  
  console.log("[LINE Agent] Image received; sending migration notice");
  
  // 5分以内に既に案内メッセージを送信済みの場合はスキップ
  const now = Date.now();
  const lastSentAt = agentImageCooldowns.get(userId);
  if (lastSentAt && (now - lastSentAt) < AGENT_IMAGE_COOLDOWN_MS) {
    console.log(`[LINE Agent] Image reply skipped during cooldown (${Math.round((now - lastSentAt) / 1000)}s)`);
    return;
  }
  
  // クールダウンを記録
  agentImageCooldowns.set(userId, now);
  
  try {
    // Get user profile and update user record
    let profile = null;
    try {
      profile = await getUserProfile(userId);
    } catch (error) {
      console.error("[LINE Agent] Failed to get user profile:", error);
    }
    
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      identityVerificationMethod: profile ? "line_profile_api" : undefined,
    });
    
    await updateLineUserLastMessage(userId);

    // Keep the image event visible to staff even though the binary is not treated
    // as a completed receipt application. Keep it as historical evidence only.
    try {
      await saveLineMessage({
        messageId: event.message.id,
        sourceType: event.source.type,
        lineUserId: userId,
        senderName: profile?.displayName,
        messageType: "image",
        content: "【レシート画像】LCJポイント申請停止中（履歴保存のみ）",
        direction: "incoming",
        lineTimestamp: event.timestamp,
        needsResponse: false,
        responseStatus: "responded",
        responseSummary: "Beauty Wallet主台帳への移行案内を自動送信。新規LCJポイント申請は作成しない。",
      });
    } catch (messageError) {
      console.error("[LINE Agent] Failed to persist receipt image hand-off:", messageError);
    }
    
    // Never issue a member bearer URL. Member authentication stays bound to the
    // HttpOnly cookie and new LCJ receipt point applications remain paused.
    const appUrl = process.env.APP_URL || 'https://lcjmall.com';
    
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: `画像を確認しました。\n\nBeauty Walletを唯一のリアルタイム主台帳へ移行しているため、新しいLCJレシートポイント申請は停止中です。この画像から申請・ポイント付与は行いません。\n\nBeauty Walletの残高と連携状況は、LCJへログイン後に確認してください。\n${appUrl}/beauty-wallet`,
        },
      ]);
    }
  } catch (error) {
    console.error("[LINE Agent] Error handling receipt image:", error);
    
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "エラーが発生しました。しばらくしてからもう一度お試しください。" },
      ]);
    }
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
