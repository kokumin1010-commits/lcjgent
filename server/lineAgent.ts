import { replyMessage, LineWebhookEvent, getUserProfile, getBotInfo, getGroupSummary, getGroupMemberProfile, getMessageContent, getTranscodingStatus } from "./line";
import { analyzeVideoContent, generateVideoAnalysisPrompt, VideoAnalysisResult } from "./videoAnalysis";
import { 
  saveLineMessage, 
  getLineMessages, 
  createOrUpdateLineUser,
  updateLineUserLastMessage,
  getAllStaff,
  createLineFollowUp,
  getTasksByStatus,
  getAllBrands,
  createOrUpdateLineGroup,
  updateGroupLastMessageAt,
  markMessageNeedsResponse,
  markMessageResponded,
  createSchedule,
  getSchedulesByDate,
  getSchedulesByLiverName,
  getUpcomingSchedules,
  deleteSchedule,
  updateSchedule,
  searchSchedules,
  // LINE Point System
  getOrCreateLinePointBalance,
  createLineReceipt,
  updateLineReceiptOcr,
  checkDuplicateLineReceiptByHash,
  checkDuplicateLineReceiptByDetails,
  getRecentLineReceiptsCount,
  updateLineReceiptFraudFlags,
  createLineFraudDetectionLog,
  updateLineReceiptStatus,
  checkDuplicateOrderNumberGlobal,
} from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import crypto from "crypto";
import type { InsertSchedule } from "../drizzle/schema";

// ============================================
// Conversation Session Management
// ============================================
// When a user mentions the bot in a group, we start a "conversation session"
// During this session (default 5 minutes), we respond to their messages without requiring mentions

interface ConversationSession {
  userId: string;
  groupId: string;
  startedAt: number;
  lastActivityAt: number;
}

// In-memory session storage (key: `${groupId}:${userId}`)
const conversationSessions = new Map<string, ConversationSession>();

// Session timeout in milliseconds (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

// Check if user has an active conversation session in the group
function hasActiveSession(groupId: string, userId: string): boolean {
  const key = `${groupId}:${userId}`;
  const session = conversationSessions.get(key);
  
  if (!session) return false;
  
  const now = Date.now();
  const timeSinceLastActivity = now - session.lastActivityAt;
  
  // Session expired
  if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
    conversationSessions.delete(key);
    console.log(`[LINE Agent] Session expired for user ${userId} in group ${groupId}`);
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
    // Refresh existing session
    existingSession.lastActivityAt = now;
    console.log(`[LINE Agent] Session refreshed for user ${userId} in group ${groupId}`);
  } else {
    // Start new session
    conversationSessions.set(key, {
      userId,
      groupId,
      startedAt: now,
      lastActivityAt: now,
    });
    console.log(`[LINE Agent] New session started for user ${userId} in group ${groupId}`);
  }
}

// ============================================
// Multiple Image Buffering for TikTok Shop OCR
// ============================================
// Users may need to send 2-3 screenshots to capture all required info
// (delivery status + order number + amount may not fit in one screenshot)

interface PendingImageSession {
  userId: string;
  images: Array<{
    data: Buffer;
    contentType: string;
    url: string;
    key: string;
    hash: string;
    messageId: string;
  }>;
  startedAt: number;
  lastImageAt: number;
  receiptId: number | null;
  processingTimeout: ReturnType<typeof setTimeout> | null;
}

// In-memory pending image storage (key: lineUserId)
const pendingImageSessions = new Map<string, PendingImageSession>();

// Image collection timeout in milliseconds (10 seconds - wait for more images)
const IMAGE_COLLECTION_TIMEOUT_MS = 10 * 1000;

// Maximum images per session
const MAX_IMAGES_PER_SESSION = 3;

// TikTok Shop screenshot guide image URL
const TIKTOK_SHOP_GUIDE_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663045992616/QjyQieoeowHpYIKd.png";

// Get or create pending image session
function getOrCreatePendingImageSession(userId: string): PendingImageSession {
  let session = pendingImageSessions.get(userId);
  if (!session) {
    session = {
      userId,
      images: [],
      startedAt: Date.now(),
      lastImageAt: Date.now(),
      receiptId: null,
      processingTimeout: null,
    };
    pendingImageSessions.set(userId, session);
  }
  return session;
}

// Clear pending image session
function clearPendingImageSession(userId: string): void {
  const session = pendingImageSessions.get(userId);
  if (session?.processingTimeout) {
    clearTimeout(session.processingTimeout);
  }
  pendingImageSessions.delete(userId);
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  const keysToDelete: string[] = [];
  
  conversationSessions.forEach((session, key) => {
    if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    conversationSessions.delete(key);
    cleaned++;
  });
  
  if (cleaned > 0) {
    console.log(`[LINE Agent] Cleaned up ${cleaned} expired sessions`);
  }
}, 60 * 1000); // Run every minute

// System prompt for the LINE AI Agent
const SYSTEM_PROMPT = `あなたは「ライブコマースジャパン」の業務支援AIアシスタントです。
LINEを通じてユーザーからの問い合わせに対応し、タスクを自動実行します。

【あなたの役割】
- ユーザーの質問に丁寧に回答する
- タスクの確認やリマインド設定を支援する
- フォローアップの設定を行う
- スタッフや予定の確認を行う

【重要：文脈理解のルール】
1. **人名とタスク内容の区別**
   - 「ミーティング日程」「見積もり」「進捗」「納品」などは人名ではなくタスク/業務内容です
   - 「〇〇さん」「@〇〇」の形式で言及されているものが人名です
   - 「〇〇フォローして」の場合、〇〇が人名なら「〇〇さんへのフォローアップ」、タスク内容なら「〇〇のフォローアップ」として扱う

2. **会話の流れを正確に把握**
   - 「紹介していただき感謝です」→ 発言者が紹介を「受けた」側
   - 「紹介します」「紹介しました」→ 発言者が紹介「する」側
   - 誰が誰に対して発言しているかを文脈から判断してください

3. **グループチャットでの注意点**
   - 各メッセージの送信者名を確認して、誰が何を言ったかを正確に把握
   - 複数人の会話では、それぞれの発言の関係性を理解
   - 自分へのメンションと他の人へのメンションを区別

【対応可能なコマンド】
- 「リマインドして」「〇〇を確認して」→ タスク関連の操作
- 「フォローアップして」「〇〇さんに連絡して」→ フォローアップ設定
- 「スタッフ一覧」「担当者を教えて」→ スタッフ情報の確認
- 「今日の予定」「明日の予定」「今週の予定」→ スケジュール確認
- 「予定追加」「1/25 14:00 配信」→ スケジュール追加
- 「〇〇さんの予定」→ 特定ライバーのスケジュール確認
- その他の質問にも柔軟に対応

【応答ルール】
- 簡潔で分かりやすい日本語で回答
- 絵文字は控えめに使用
- 不明な点は確認を取る
- 個人情報の取り扱いに注意
- 会話の文脈を踏まえて適切に応答（紹介された側には「よろしくお願いします」、紹介した側には「ご紹介ありがとうございます」）

【特別な指示の検出】
ユーザーのメッセージに以下のキーワードが含まれる場合、JSONで応答してください：
- "リマインド" または "remind" → {"action": "remind", "target": "内容", "message": "メッセージ", "scheduledAt": "YYYY-MM-DD HH:MM"または"曜日 HH:MM", "hours": 時間数}
  - 「月曜日9時にリマインド」→ scheduledAtに次の月曜日9:00を計算して設定（例: "2026-02-02 09:00"）
  - 「明日の14時にリマインド」→ scheduledAtに明日の14:00を設定
  - 「3時間後にリマインド」→ hoursに3を設定
  - scheduledAtとhoursの両方がある場合はscheduledAtを優先
- "フォローアップ" または "followup" → {"action": "followup", "target": "対象", "targetType": "person"または"task", "message": "メッセージ"}
  - targetTypeは必ず指定してください。人名なら"person"、タスク/業務内容なら"task"
- "スタッフ一覧" または "担当者" → {"action": "list_staff"}
- "タスク一覧" または "進行中" → {"action": "list_tasks"}
- "ブランド一覧" または "ブランド" → {"action": "list_brands"}
- "今日の予定" → {"action": "schedule_today"}
- "明日の予定" → {"action": "schedule_tomorrow"}
- "今週の予定" または "この週の予定" → {"action": "schedule_week"}
- "予定追加" または 日時を含む予定の記載 → {"action": "schedule_add", "title": "予定名", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "liverName": "ライバー名(任意)", "category": "delivery/meeting/live/other"}
- "〇〇さんの予定" → {"action": "schedule_liver", "liverName": "ライバー名"}
- "スケジュールのリンク" または "予定のURL" または "カレンダーのリンク" → {"action": "schedule_link"}
- "〇〇さんのスケジュールURL" または "〇〇の予定のリンク" または "〇〇のカレンダーリンク" → {"action": "schedule_liver_link", "liverName": "ライバー名"}
- "予定を削除" または "スケジュールを削除" → {"action": "schedule_delete", "date": "YYYY-MM-DD", "liverName": "ライバー名(任意)", "title": "予定名(任意)"}
- "予定を変更" または "スケジュールを編集" → {"action": "schedule_edit", "date": "YYYY-MM-DD", "liverName": "ライバー名(任意)", "newDate": "YYYY-MM-DD(任意)", "newStartTime": "HH:MM(任意)", "newEndTime": "HH:MM(任意)"}

通常の会話の場合は、普通のテキストで応答してください。`;

// Parse AI response for special actions
interface AgentAction {
  action: "remind" | "followup" | "list_staff" | "list_tasks" | "list_brands" | "schedule_today" | "schedule_tomorrow" | "schedule_week" | "schedule_add" | "schedule_liver" | "schedule_link" | "schedule_liver_link" | "schedule_delete" | "schedule_edit" | "none";
  target?: string;
  targetType?: "person" | "task"; // person = 人名, task = タスク/業務内容
  time?: string;
  message?: string;
  hours?: number;
  scheduledAt?: string; // YYYY-MM-DD HH:MM 形式の絶対日時指定
  // Schedule-specific fields
  title?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  liverName?: string;
  category?: "delivery" | "meeting" | "live" | "other";
  // Schedule edit fields
  newDate?: string; // YYYY-MM-DD
  newStartTime?: string; // HH:MM
  newEndTime?: string; // HH:MM
}

function parseAgentAction(response: string): AgentAction | null {
  try {
    // Check if response contains JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action) {
        return parsed as AgentAction;
      }
    }
  } catch {
    // Not a JSON response, that's fine
  }
  return null;
}

// Get conversation history for context
async function getConversationContext(lineUserId: string, lineGroupId?: string, limit: number = 10): Promise<string> {
  const messages = await getLineMessages({ 
    lineUserId: lineGroupId ? undefined : lineUserId, 
    lineGroupId,
    limit 
  });
  
  if (!messages || messages.length === 0) {
    return "";
  }
  
  // Reverse to get chronological order
  const orderedMessages = messages.reverse();
  
  return orderedMessages.map(msg => {
    if (msg.direction === "outgoing") {
      return `[LCJエージェント]: ${msg.content}`;
    } else {
      // For incoming messages, include sender name if available
      const senderName = msg.senderName || "ユーザー";
      return `[${senderName}]: ${msg.content}`;
    }
  }).join("\n");
}

// Check if message mentions the bot
function isBotMentioned(text: string, botUserId?: string): boolean {
  // Check for common mention patterns
  const mentionPatterns = [
    /@LCJ/i,
    /@lcj/i,
    /LCJエージェント/i,
    /LCJ エージェント/i,
    /エージェント/i,
    /@714isnih/i,
  ];
  
  for (const pattern of mentionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Check if bot user ID is mentioned (LINE mentions format)
  if (botUserId && text.includes(botUserId)) {
    return true;
  }
  
  return false;
}

// Remove mention from message text
function removeMention(text: string): string {
  return text
    .replace(/@LCJ\s*/gi, "")
    .replace(/@lcj\s*/gi, "")
    .replace(/LCJエージェント\s*/gi, "")
    .replace(/LCJ エージェント\s*/gi, "")
    .replace(/@714isnih\s*/gi, "")
    .trim();
}

// Parse scheduled time from various formats
function parseScheduledAt(scheduledAt: string): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // JST is UTC+9
  
  // Try YYYY-MM-DD HH:MM format first
  const dateTimeMatch = scheduledAt.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    return date;
  }
  
  // Try MM/DD HH:MM or M/D HH:MM format
  const shortDateMatch = scheduledAt.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (shortDateMatch) {
    const [, month, day, hour, minute] = shortDateMatch;
    const year = now.getFullYear();
    const date = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    // If the date is in the past, assume next year
    if (date < now) {
      date.setFullYear(year + 1);
    }
    return date;
  }
  
  // Try 曜日 HH:MM format (例: "月曜日 09:00")
  const dayOfWeekMap: Record<string, number> = {
    '日曜日': 0, '日': 0,
    '月曜日': 1, '月': 1,
    '火曜日': 2, '火': 2,
    '水曜日': 3, '水': 3,
    '木曜日': 4, '木': 4,
    '金曜日': 5, '金': 5,
    '土曜日': 6, '土': 6,
  };
  
  const dayOfWeekMatch = scheduledAt.match(/(日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日|月|火|水|木|金|土)\s*(\d{1,2}):(\d{2})/);
  if (dayOfWeekMatch) {
    const [, dayName, hour, minute] = dayOfWeekMatch;
    const targetDayOfWeek = dayOfWeekMap[dayName];
    const currentDayOfWeek = now.getDay();
    
    // Calculate days until target day
    let daysUntil = targetDayOfWeek - currentDayOfWeek;
    if (daysUntil <= 0) {
      daysUntil += 7; // Next week
    }
    
    // If it's the same day but the time has passed, go to next week
    if (daysUntil === 0) {
      const targetTime = new Date(now);
      targetTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (targetTime <= now) {
        daysUntil = 7;
      }
    }
    
    const date = new Date(now);
    date.setDate(date.getDate() + daysUntil);
    date.setHours(parseInt(hour), parseInt(minute), 0, 0);
    return date;
  }
  
  // Try "明日 HH:MM" or "明後日 HH:MM" format
  const relativeDayMatch = scheduledAt.match(/(今日|明日|明後日)\s*(\d{1,2}):(\d{2})/);
  if (relativeDayMatch) {
    const [, dayWord, hour, minute] = relativeDayMatch;
    const date = new Date(now);
    
    if (dayWord === '明日') {
      date.setDate(date.getDate() + 1);
    } else if (dayWord === '明後日') {
      date.setDate(date.getDate() + 2);
    }
    
    date.setHours(parseInt(hour), parseInt(minute), 0, 0);
    return date;
  }
  
  // Try just HH:MM format (assume today or tomorrow)
  const timeOnlyMatch = scheduledAt.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnlyMatch) {
    const [, hour, minute] = timeOnlyMatch;
    const date = new Date(now);
    date.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    // If the time has passed today, assume tomorrow
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }
  
  // Fallback: try to parse as a general date string
  const parsed = new Date(scheduledAt);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // If all parsing fails, default to 24 hours from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

// Format scheduled time for display (detailed format with year)
function formatScheduledTime(date: Date): string {
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const dayOfWeek = dayNames[date.getDay()];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${year}年${month}月${day}日 ${dayOfWeek} ${hours}:${minutes}`;
}

// Execute agent actions
async function executeAction(action: AgentAction, lineUserId: string): Promise<string> {
  switch (action.action) {
    case "list_staff": {
      const staffList = await getAllStaff();
      if (!staffList || staffList.length === 0) {
        return "現在登録されているスタッフはいません。";
      }
      const staffNames = staffList.slice(0, 10).map(s => `・${s.name}`).join("\n");
      return `【スタッフ一覧】\n${staffNames}${staffList.length > 10 ? `\n...他${staffList.length - 10}名` : ""}`;
    }
    
    case "followup": {
      if (!action.target) {
        return "フォローアップ対象を指定してください。例：「〇〇さんにフォローアップして」または「ミーティング日程をフォローして」";
      }
      
      // Determine if target is a person or a task based on targetType
      const isPerson = action.targetType === "person";
      const targetLabel = isPerson ? `${action.target}さんへのフォローアップ` : `${action.target}のフォローアップ`;
      
      // Create a follow-up entry
      await createLineFollowUp({
        targetType: "user",
        lineUserId: lineUserId,
        triggerCondition: "scheduled",
        delayHours: 24,
        maxAttempts: 1,
        messageTemplate: action.message || targetLabel,
        nextScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      
      return `${targetLabel}を設定しました。24時間後にリマインドします。`;
    }
    
    case "remind": {
      // Create a reminder (using LINE follow-up instead since reminders table is for email)
      let scheduledTime: Date;
      let timeDescription: string;
      
      if (action.scheduledAt) {
        // 絶対日時指定の場合
        scheduledTime = parseScheduledAt(action.scheduledAt);
        timeDescription = formatScheduledTime(scheduledTime);
      } else {
        // 相対時間指定の場合
        const hoursLater = action.hours || 24;
        scheduledTime = new Date(Date.now() + hoursLater * 60 * 60 * 1000);
        timeDescription = `${hoursLater}時間後`;
      }
      
      // 過去の日時が指定された場合はエラー
      if (scheduledTime <= new Date()) {
        return `指定された日時は既に過ぎています。未来の日時を指定してください。`;
      }
      
      const delayMs = scheduledTime.getTime() - Date.now();
      const delayHours = Math.ceil(delayMs / (60 * 60 * 1000));
      
      await createLineFollowUp({
        targetType: "user",
        lineUserId: lineUserId,
        triggerCondition: "scheduled",
        delayHours: delayHours,
        maxAttempts: 1,
        messageTemplate: `【リマインド】\n${action.message || action.target || "指定なし"}`,
        nextScheduledAt: scheduledTime,
      });
      
      return `リマインドを設定しました。\n内容: ${action.target || action.message || "指定なし"}\n時間: ${timeDescription}`;
    }
    
    case "list_tasks": {
      const tasks = await getTasksByStatus("in_progress");
      if (!tasks || tasks.length === 0) {
        return "現在進行中のタスクはありません。";
      }
      const taskList = tasks.slice(0, 5).map(t => `・${t.task.taskDetail.substring(0, 30)}`).join("\n");
      return `【進行中のタスク】\n${taskList}${tasks.length > 5 ? `\n...他${tasks.length - 5}件` : ""}`;
    }
    
    case "list_brands": {
      const brands = await getAllBrands();
      if (!brands || brands.length === 0) {
        return "登録されているブランドはありません。";
      }
      const brandList = brands.slice(0, 10).map(b => `・${b.name}`).join("\n");
      return `【ブランド一覧】\n${brandList}${brands.length > 10 ? `\n...他${brands.length - 10}件` : ""}`;
    }
    
    case "schedule_today": {
      const today = new Date();
      const schedules = await getSchedulesByDate(today);
      if (!schedules || schedules.length === 0) {
        return "今日の予定はありません。";
      }
      const scheduleList = schedules.map(s => {
        const time = s.startTime ? `${s.startTime}${s.endTime ? `-${s.endTime}` : ""}` : "終日";
        const liver = s.liverName ? ` (担当: ${s.liverName})` : "";
        return `・${time} ${s.title}${liver}`;
      }).join("\n");
      return `【今日の予定】\n${scheduleList}`;
    }
    
    case "schedule_tomorrow": {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const schedules = await getSchedulesByDate(tomorrow);
      if (!schedules || schedules.length === 0) {
        return "明日の予定はありません。";
      }
      const scheduleList = schedules.map(s => {
        const time = s.startTime ? `${s.startTime}${s.endTime ? `-${s.endTime}` : ""}` : "終日";
        const liver = s.liverName ? ` (担当: ${s.liverName})` : "";
        return `・${time} ${s.title}${liver}`;
      }).join("\n");
      return `【明日の予定】\n${scheduleList}`;
    }
    
    case "schedule_week": {
      const schedules = await getUpcomingSchedules(7);
      if (!schedules || schedules.length === 0) {
        return "今週の予定はありません。";
      }
      const scheduleList = schedules.slice(0, 10).map(s => {
        const dateStr = new Date(s.startTime).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
        const timeStr = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : "";
        const endTimeStr = s.endTime ? `-${new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : "";
        const liver = s.liverName ? ` (担当: ${s.liverName})` : "";
        return `・${dateStr} ${timeStr}${endTimeStr} ${s.title}${liver}`;
      }).join("\n");
      return `【今週の予定】\n${scheduleList}${schedules.length > 10 ? `\n...他${schedules.length - 10}件` : ""}`;
    }
    
    case "schedule_add": {
      if (!action.title || !action.date) {
        return "予定を追加するには、タイトルと日付が必要です。\n例: 「1/25 14:00-16:00 配信予定 追加して」";
      }
      
      // Parse date and time strings into Date objects
      // Handle date formats like "2026-01-25", "1/25", "01-25"
      let baseDate: Date;
      const dateStr = action.date;
      
      // Check if the date string contains a year (4 digits)
      if (/\d{4}/.test(dateStr)) {
        // Full date with year
        baseDate = new Date(dateStr);
      } else {
        // Date without year - assume current year or next year if date has passed
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Try to parse month/day format (e.g., "1/25" or "01-25")
        const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/);
        if (match) {
          const month = parseInt(match[1], 10) - 1; // 0-indexed
          const day = parseInt(match[2], 10);
          baseDate = new Date(currentYear, month, day);
          
          // If the date is in the past, use next year
          if (baseDate < now) {
            baseDate = new Date(currentYear + 1, month, day);
          }
        } else {
          // Fallback: try parsing as-is with current year prepended
          baseDate = new Date(`${currentYear}-${dateStr}`);
        }
      }
      
      // Validate the parsed date
      if (isNaN(baseDate.getTime())) {
        console.error("[Schedule Add] Invalid date:", dateStr);
        return `日付の形式が正しくありません: ${dateStr}\n例: 　1/25、2026-01-25`;
      }
      
      let startTime: Date;
      let endTime: Date | undefined;
      
      // Create date in JST (UTC+9) and convert to UTC for storage
      // This ensures the time is stored correctly regardless of server timezone
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const day = baseDate.getDate();
      
      if (action.startTime) {
        const [hours, minutes] = action.startTime.split(":").map(Number);
        // Create UTC date by subtracting 9 hours from JST
        startTime = new Date(Date.UTC(year, month, day, hours - 9, minutes, 0, 0));
      } else {
        // All day event - set to midnight JST (15:00 UTC previous day)
        startTime = new Date(Date.UTC(year, month, day - 1, 15, 0, 0, 0));
      }
      
      if (action.endTime) {
        const [hours, minutes] = action.endTime.split(":").map(Number);
        // Create UTC date by subtracting 9 hours from JST
        endTime = new Date(Date.UTC(year, month, day, hours - 9, minutes, 0, 0));
      }
      
      try {
        const newSchedule = await createSchedule({
          title: action.title,
          startTime: startTime,
          endTime: endTime,
          isAllDay: !action.startTime,
          liverName: action.liverName,
          category: action.category || "other",
          description: action.message,
        });
        const dateStr = baseDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
        const timeStr = action.startTime ? `${action.startTime}${action.endTime ? `-${action.endTime}` : ""}` : "";
        return `予定を追加しました！\n📅 ${dateStr} ${timeStr}\n📝 ${action.title}${action.liverName ? `\n👤 ${action.liverName}` : ""}`;
      } catch (error) {
        console.error("[Schedule Add] Error creating schedule:", error);
        return `予定の追加に失敗しました。エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
      }
    }
    
    case "schedule_liver": {
      if (!action.liverName) {
        return "ライバー名を指定してください。\n例: 「〇〇さんの予定」";
      }
      
      const schedules = await getSchedulesByLiverName(action.liverName);
      if (!schedules || schedules.length === 0) {
        return `${action.liverName}さんの予定は登録されていません。`;
      }
      const scheduleList = schedules.slice(0, 10).map(s => {
        const dateStr = new Date(s.startTime).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
        const timeStr = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : "";
        const endTimeStr = s.endTime ? `-${new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : "";
        return `・${dateStr} ${timeStr}${endTimeStr} ${s.title}`;
      }).join("\n");
      return `【${action.liverName}さんの予定】\n${scheduleList}${schedules.length > 10 ? `\n...他${schedules.length - 10}件` : ""}`;
    }
    
    case "schedule_link": {
      // Get the base URL from environment variable
      const baseUrl = process.env.APP_URL || "https://task-automation-agent.manus.space";
      const scheduleUrl = `${baseUrl}/s`;
      return `📅 スケジュールはこちらから確認できます：\n\n${scheduleUrl}\n\nログイン不要で、スマホからも簡単に確認できます。`;
    }
    
    case "schedule_liver_link": {
      if (!action.liverName) {
        return "ライバー名を指定してください。\n例: 「京極琉のスケジュールURL教えて」";
      }
      
      // Get the base URL from environment variable
      const baseUrl = process.env.APP_URL || "https://task-automation-agent.manus.space";
      const liverScheduleUrl = `${baseUrl}/s/${encodeURIComponent(action.liverName)}`;
      return `📅 ${action.liverName}さんのスケジュールはこちらから確認できます：\n\n${liverScheduleUrl}\n\nログイン不要で、スマホからも簡単に確認できます。`;
    }
    
    case "schedule_delete": {
      if (!action.date) {
        return "削除する予定の日付を指定してください。\n例: 「1/25の予定を削除して」";
      }
      
      // Parse the date
      const currentYear = new Date().getFullYear();
      let targetDate: Date;
      
      if (action.date.includes("-")) {
        // YYYY-MM-DD format
        targetDate = new Date(action.date + "T00:00:00+09:00");
      } else {
        // M/D format
        const [month, day] = action.date.split("/").map(Number);
        targetDate = new Date(currentYear, month - 1, day);
      }
      
      // Get schedules for that date
      const schedulesToDelete = await getSchedulesByDate(targetDate);
      
      if (schedulesToDelete.length === 0) {
        return `${action.date}には予定が登録されていません。`;
      }
      
      // Filter by liver name if specified
      let filteredSchedules = schedulesToDelete;
      if (action.liverName) {
        const searchName = action.liverName.replace(/\s/g, "");
        filteredSchedules = schedulesToDelete.filter(s => 
          s.liverName && s.liverName.replace(/\s/g, "").includes(searchName)
        );
      }
      
      // Filter by title if specified
      if (action.title) {
        filteredSchedules = filteredSchedules.filter(s => 
          s.title && s.title.includes(action.title!)
        );
      }
      
      if (filteredSchedules.length === 0) {
        return `指定された条件に合う予定が見つかりませんでした。`;
      }
      
      if (filteredSchedules.length === 1) {
        // Delete the single matching schedule
        await deleteSchedule(filteredSchedules[0].id);
        const s = filteredSchedules[0];
        const startTime = new Date(s.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
        return `✅ 予定を削除しました！\n\n📅 ${action.date} ${startTime}\n📝 ${s.title}\n👤 ${s.liverName || "未指定"}`;
      }
      
      // Multiple matches - list them and ask for clarification
      const scheduleList = filteredSchedules.map((s, i) => {
        const startTime = new Date(s.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
        return `${i + 1}. ${startTime} ${s.title} (${s.liverName || "未指定"})`;
      }).join("\n");
      
      return `${action.date}には複数の予定があります。どの予定を削除しますか？\n\n${scheduleList}\n\n例: 「1番の予定を削除」または「ライブ配信を削除」`;
    }
    
    case "schedule_edit": {
      if (!action.date) {
        return "編集する予定の日付を指定してください。\n例: 「1/25の予定を1/26に変更して」";
      }
      
      // Parse the date
      const currentYear = new Date().getFullYear();
      let targetDate: Date;
      
      if (action.date.includes("-")) {
        targetDate = new Date(action.date + "T00:00:00+09:00");
      } else {
        const [month, day] = action.date.split("/").map(Number);
        targetDate = new Date(currentYear, month - 1, day);
      }
      
      // Get schedules for that date
      const schedulesToEdit = await getSchedulesByDate(targetDate);
      
      if (schedulesToEdit.length === 0) {
        return `${action.date}には予定が登録されていません。`;
      }
      
      // Filter by liver name if specified
      let filteredSchedules = schedulesToEdit;
      if (action.liverName) {
        const searchName = action.liverName.replace(/\s/g, "");
        filteredSchedules = schedulesToEdit.filter(s => 
          s.liverName && s.liverName.replace(/\s/g, "").includes(searchName)
        );
      }
      
      if (filteredSchedules.length === 0) {
        return `指定された条件に合う予定が見つかりませんでした。`;
      }
      
      if (filteredSchedules.length === 1) {
        // Edit the single matching schedule
        const schedule = filteredSchedules[0];
        const updateData: Record<string, unknown> = {};
        
        // Parse new date if specified
        if (action.newDate) {
          let newDateObj: Date;
          if (action.newDate.includes("-")) {
            newDateObj = new Date(action.newDate + "T00:00:00+09:00");
          } else {
            const [month, day] = action.newDate.split("/").map(Number);
            newDateObj = new Date(currentYear, month - 1, day);
          }
          
          // Keep the same time but change the date
          const oldStart = new Date(schedule.startTime);
          const oldEnd = schedule.endTime ? new Date(schedule.endTime) : null;
          
          const newStart = new Date(newDateObj);
          newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
          updateData.startTime = newStart;
          
          if (oldEnd) {
            const newEnd = new Date(newDateObj);
            newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);
            updateData.endTime = newEnd;
          }
        }
        
        // Parse new start time if specified
        if (action.newStartTime) {
          const [hours, minutes] = action.newStartTime.split(":").map(Number);
          const currentStart = updateData.startTime ? new Date(updateData.startTime as Date) : new Date(schedule.startTime);
          currentStart.setHours(hours, minutes, 0, 0);
          updateData.startTime = currentStart;
        }
        
        // Parse new end time if specified
        if (action.newEndTime) {
          const [hours, minutes] = action.newEndTime.split(":").map(Number);
          const baseDate = updateData.startTime ? new Date(updateData.startTime as Date) : new Date(schedule.startTime);
          const newEnd = new Date(baseDate);
          newEnd.setHours(hours, minutes, 0, 0);
          updateData.endTime = newEnd;
        }
        
        if (Object.keys(updateData).length === 0) {
          return "変更内容を指定してください。\n例: 「1/25の予定を1/26に変更」または「1/25の予定を14時からに変更」";
        }
        
        await updateSchedule(schedule.id, updateData as Partial<InsertSchedule>);
        
        const newStart = updateData.startTime ? new Date(updateData.startTime as Date) : new Date(schedule.startTime);
        const newEnd = updateData.endTime ? new Date(updateData.endTime as Date) : (schedule.endTime ? new Date(schedule.endTime) : null);
        const newDateStr = newStart.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });
        const newStartTimeStr = newStart.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
        const newEndTimeStr = newEnd ? newEnd.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "";
        
        return `✅ 予定を変更しました！\n\n📅 ${newDateStr} ${newStartTimeStr}${newEndTimeStr ? "-" + newEndTimeStr : ""}\n📝 ${schedule.title}\n👤 ${schedule.liverName || "未指定"}`;
      }
      
      // Multiple matches - list them
      const scheduleList = filteredSchedules.map((s, i) => {
        const startTime = new Date(s.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
        return `${i + 1}. ${startTime} ${s.title} (${s.liverName || "未指定"})`;
      }).join("\n");
      
      return `${action.date}には複数の予定があります。どの予定を編集しますか？\n\n${scheduleList}\n\n例: 「1番の予定を1/26に変更」`;
    }
    
    default:
      return "";
  }
}

// ============================================
// Response Requirement Detection
// ============================================

// Check if a message requires a response from staff
async function checkIfNeedsResponse(message: string, senderName: string): Promise<{ needsResponse: boolean; summary?: string }> {
  // Skip very short messages or simple greetings
  if (message.length < 10) {
    return { needsResponse: false };
  }
  
  // Skip messages that are clearly just acknowledgments
  const acknowledgmentPatterns = [
    /^はい$/,
    /^わかりました$/,
    /^了解$/,
    /^承知$/,
    /^ありがとう$/,
    /^お疑いします$/,
  ];
  
  for (const pattern of acknowledgmentPatterns) {
    if (pattern.test(message.trim())) {
      return { needsResponse: false };
    }
  }
  
  // Use AI to determine if response is needed
  try {
    const analysisPrompt = `以下のメッセージを分析して、スタッフからの返事が必要かどうかを判定してください。

送信者: ${senderName}
メッセージ: ${message}

以下の場合は「返事が必要」と判定してください：
- 質問や確認事項が含まれている
- スケジュールや日程の提案がある
- 条件や見積もりの確認がある
- 契約や合意に関する内容
- 具体的なアクションを求めている

以下の場合は「返事不要」と判定してください：
- 単なる挨拶やお礼
- 情報の共有のみ（返事を求めていない）
- スタンプや絵文字のみ
- 「了解」「承知」などの確認応答

JSON形式で回答してください：
{"needsResponse": true/false, "summary": "返事が必要な内容の要約（返事が必要な場合のみ）"}`;
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "あなたはビジネスメッセージの分析アシスタントです。JSON形式でのみ回答してください。" },
        { role: "user", content: analysisPrompt },
      ],
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          needsResponse: parsed.needsResponse === true,
          summary: parsed.summary,
        };
      }
    }
  } catch (error) {
    console.error("[LINE Agent] Failed to analyze message for response requirement:", error);
  }
  
  return { needsResponse: false };
}

// Main agent function - process incoming message and generate response
export async function processLineMessage(event: LineWebhookEvent): Promise<void> {
  // Only process text messages
  if (event.type !== "message" || !event.message?.text) {
    return;
  }
  
  const userId = event.source.userId;
  const groupId = event.source.groupId;
  const roomId = event.source.roomId;
  const isGroupChat = !!(groupId || roomId);
  const chatId = groupId || roomId;
  
  if (!userId) {
    return;
  }
  
  const userMessage = event.message.text;
  const messageId = event.message.id;
  
  console.log(`[LINE Agent] Processing message from ${userId} in ${isGroupChat ? `group ${chatId}` : "DM"}: ${userMessage.substring(0, 50)}...`);
  
  try {
    // Get or create user profile
    const profile = await getUserProfile(userId);
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName || "Unknown",
      pictureUrl: profile?.pictureUrl,
      userType: "customer",
    });
    
    // If group chat, save group info with actual group name
    if (groupId) {
      let groupName = "グループ";
      try {
        const groupSummary = await getGroupSummary(groupId);
        if (groupSummary?.groupName) {
          groupName = groupSummary.groupName;
          console.log(`[LINE Agent] Got group name: ${groupName}`);
        }
      } catch (error) {
        console.error("[LINE Agent] Failed to get group summary:", error);
      }
      
      await createOrUpdateLineGroup({
        lineGroupId: groupId,
        groupName,
        pictureUrl: undefined, // Can be added later if needed
      });
    }
    
    // Get sender name for group messages
    let senderName = profile?.displayName || "Unknown";
    if (isGroupChat && groupId) {
      try {
        const memberProfile = await getGroupMemberProfile(groupId, userId);
        if (memberProfile?.displayName) {
          senderName = memberProfile.displayName;
        }
      } catch (error) {
        console.error("[LINE Agent] Failed to get group member profile:", error);
      }
    }
    
    // Always save incoming message (for logging purposes)
    await saveLineMessage({
      messageId,
      sourceType: isGroupChat ? "group" : "user",
      lineUserId: userId,
      lineGroupId: chatId,
      senderName,
      messageType: "text",
      content: userMessage,
      direction: "incoming",
      lineTimestamp: event.timestamp,
    });
    
    // Update last message timestamp
    await updateLineUserLastMessage(userId);
    
    // Update group last message timestamp (for auto follow-up tracking)
    if (groupId) {
      await updateGroupLastMessageAt(groupId);
    }
    
    // For group chats, check if mentioned OR has active conversation session
    let shouldRespond = !isGroupChat; // Always respond in DM
    let wasMentioned = false;
    
    if (isGroupChat && groupId) {
      const botInfo = await getBotInfo();
      wasMentioned = isBotMentioned(userMessage, botInfo?.userId);
      const hasSession = hasActiveSession(groupId, userId);
      
      if (wasMentioned) {
        // User mentioned bot - start/refresh session and respond
        startOrRefreshSession(groupId, userId);
        shouldRespond = true;
        console.log(`[LINE Agent] Bot mentioned in group, starting/refreshing session`);
      } else if (hasSession) {
        // User has active session - refresh and respond
        startOrRefreshSession(groupId, userId);
        shouldRespond = true;
        console.log(`[LINE Agent] User has active session, responding without mention`);
      } else {
        // No mention and no session - don't respond
        console.log(`[LINE Agent] Group message not mentioning bot and no active session, skipping response`);
      }
    }
    
    if (!shouldRespond) {
      return; // Don't respond, but message is already saved
    }
    
    // Check if we have a reply token (needed for responding)
    if (!event.replyToken) {
      console.log(`[LINE Agent] No reply token, cannot respond`);
      return;
    }
    
    // Remove mention from message for processing
    const cleanMessage = isGroupChat ? removeMention(userMessage) : userMessage;
    
    // Check for point balance inquiry command
    if (cleanMessage.match(/ポイント|残高|確認|照会|point|balance/i)) {
      const pointResult = await handlePointBalanceInquiry(userId, event.replyToken);
      if (pointResult) {
        return; // Point inquiry handled, no need to continue
      }
    }
    
    // Get conversation context
    const context = await getConversationContext(userId, chatId, 10);
    
    // Build messages for LLM
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    
    // Add context if available
    if (context) {
      messages.push({
        role: "system",
        content: `【直近の会話履歴】\n${context}`,
      });
    }
    
    // Add group context if applicable
    if (isGroupChat) {
      const sessionNote = wasMentioned 
        ? "メンションされたので応答します。" 
        : "会話セッション中のため応答します。";
      messages.push({
        role: "system",
        content: `【注意】これはグループチャットでの会話です。${sessionNote}`,
      });
    }
    
    messages.push({ role: "user", content: cleanMessage });
    
    // Call LLM
    const llmResponse = await invokeLLM({ messages });
    
    const rawContent = llmResponse.choices?.[0]?.message?.content;
    let responseText = typeof rawContent === "string" ? rawContent : "申し訳ありません。応答を生成できませんでした。";
    
    // Check for special actions
    const action = parseAgentAction(responseText);
    if (action && action.action !== "none") {
      const actionResult = await executeAction(action, userId);
      if (actionResult) {
        responseText = actionResult;
      }
    }
    
    // Limit response length for LINE (max 5000 chars)
    if (responseText.length > 4500) {
      responseText = responseText.substring(0, 4500) + "...\n\n（続きがあります）";
    }
    
    // Send reply
    const replySuccess = await replyMessage(event.replyToken, [
      { type: "text", text: responseText },
    ]);
    
    if (replySuccess) {
      // Save outgoing message
      await saveLineMessage({
        messageId: `reply_${messageId}_${Date.now()}`,
        sourceType: isGroupChat ? "group" : "user",
        lineUserId: userId,
        lineGroupId: chatId,
        messageType: "text",
        content: responseText,
        direction: "outgoing",
      });
      
      // Mark any pending responses in this group as responded (auto-clear)
      if (isGroupChat && chatId) {
        try {
          await markMessageResponded(chatId, "bot");
          console.log(`[LINE Agent] Marked pending responses as responded in group ${chatId}`);
        } catch (error) {
          console.error("[LINE Agent] Failed to mark messages as responded:", error);
        }
      }
      
      console.log(`[LINE Agent] Reply sent successfully to ${userId}`);
    } else {
      console.error(`[LINE Agent] Failed to send reply to ${userId}`);
    }
    
  } catch (error) {
    console.error("[LINE Agent] Error processing message:", error);
    
    // Try to send error message
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "申し訳ありません。処理中にエラーが発生しました。しばらくしてからもう一度お試しください。" },
      ]);
    }
  }
}


// ============================================
// Video Message Processing
// ============================================

/**
 * Wait for video transcoding to complete with retries
 */
async function waitForTranscoding(messageId: string, maxRetries: number = 5): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const status = await getTranscodingStatus(messageId);
    
    if (!status) {
      console.log(`[LINE Agent] Could not get transcoding status for ${messageId}`);
      return false;
    }
    
    if (status.status === "succeeded") {
      return true;
    }
    
    if (status.status === "failed") {
      console.log(`[LINE Agent] Transcoding failed for ${messageId}`);
      return false;
    }
    
    // Still processing, wait and retry
    console.log(`[LINE Agent] Transcoding in progress for ${messageId}, waiting...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  }
  
  console.log(`[LINE Agent] Transcoding timeout for ${messageId}`);
  return false;
}

/**
 * Process video message from LINE
 */
export async function processVideoMessage(event: LineWebhookEvent): Promise<void> {
  // Check if this is a video message
  if (event.type !== "message" || event.message?.type !== "video") {
    return;
  }
  
  const userId = event.source.userId;
  const groupId = event.source.groupId;
  const roomId = event.source.roomId;
  const isGroupChat = !!(groupId || roomId);
  const chatId = groupId || roomId;
  const messageId = event.message.id;
  
  if (!userId) {
    return;
  }
  
  console.log(`[LINE Agent] Processing video message ${messageId} from ${userId}`);
  
  try {
    // Get or create user profile
    const profile = await getUserProfile(userId);
    await createOrUpdateLineUser({
      lineUserId: userId,
      displayName: profile?.displayName || "Unknown",
      pictureUrl: profile?.pictureUrl,
      userType: "customer",
    });
    
    // If group chat, save group info
    if (groupId) {
      let groupName = "グループ";
      try {
        const groupSummary = await getGroupSummary(groupId);
        if (groupSummary?.groupName) {
          groupName = groupSummary.groupName;
        }
      } catch (error) {
        console.error("[LINE Agent] Failed to get group summary:", error);
      }
      
      await createOrUpdateLineGroup({
        lineGroupId: groupId,
        groupName,
        pictureUrl: undefined,
      });
    }
    
    // Get sender name
    let senderName = profile?.displayName || "Unknown";
    if (isGroupChat && groupId) {
      try {
        const memberProfile = await getGroupMemberProfile(groupId, userId);
        if (memberProfile?.displayName) {
          senderName = memberProfile.displayName;
        }
      } catch (error) {
        console.error("[LINE Agent] Failed to get group member profile:", error);
      }
    }
    
    // Save incoming video message record
    await saveLineMessage({
      messageId,
      sourceType: isGroupChat ? "group" : "user",
      lineUserId: userId,
      lineGroupId: chatId,
      senderName,
      messageType: "video",
      content: "[動画メッセージ]",
      direction: "incoming",
      lineTimestamp: event.timestamp,
    });
    
    // Update timestamps
    await updateLineUserLastMessage(userId);
    if (groupId) {
      await updateGroupLastMessageAt(groupId);
    }
    
    // For group chats, check if we should respond (need mention or active session)
    let shouldRespond = !isGroupChat; // Always respond in DM
    
    if (isGroupChat && groupId) {
      const hasSession = hasActiveSession(groupId, userId);
      if (hasSession) {
        startOrRefreshSession(groupId, userId);
        shouldRespond = true;
        console.log(`[LINE Agent] User has active session, processing video`);
      } else {
        // For video messages in groups without session, we could optionally process
        // For now, skip unless there's an active session
        console.log(`[LINE Agent] Group video message without active session, skipping`);
      }
    }
    
    if (!shouldRespond) {
      return;
    }
    
    if (!event.replyToken) {
      console.log(`[LINE Agent] No reply token for video message`);
      return;
    }
    
    // Wait for video transcoding to complete
    const transcodingReady = await waitForTranscoding(messageId);
    if (!transcodingReady) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "動画の処理に時間がかかっています。しばらくしてからもう一度お送りください。" },
      ]);
      return;
    }
    
    // Get video content
    const content = await getMessageContent(messageId);
    if (!content) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "動画の取得に失敗しました。もう一度お試しください。" },
      ]);
      return;
    }
    
    // Analyze video content
    console.log(`[LINE Agent] Analyzing video content (${(content.data.length / 1024 / 1024).toFixed(2)}MB)`);
    const analysisResult = await analyzeVideoContent(content.data, messageId, content.contentType);
    
    if (analysisResult.error) {
      console.error(`[LINE Agent] Video analysis error: ${analysisResult.error}`);
      await replyMessage(event.replyToken, [
        { type: "text", text: "動画の分析中にエラーが発生しました。" },
      ]);
      return;
    }
    
    // Generate analysis summary
    const analysisSummary = generateVideoAnalysisPrompt(analysisResult);
    
    // Build messages for LLM with video analysis context
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `ユーザーから動画が送信されました。以下は動画の分析結果です：\n\n${analysisSummary}` },
    ];
    
    // Add frame images for vision analysis if available
    if (analysisResult.frames.length > 0) {
      const imageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: "以下は動画から抽出されたフレーム画像です。これらを参考に動画の内容を理解してください。" },
      ];
      
      for (const frame of analysisResult.frames) {
        imageContent.push({
          type: "image_url",
          image_url: { url: frame.url },
        });
      }
      
      messages.push({ role: "user", content: imageContent });
    }
    
    messages.push({ 
      role: "user", 
      content: "この動画の内容を分析して、何が映っているか、何を伝えようとしているかを教えてください。" 
    });
    
    // Call LLM
    const llmResponse = await invokeLLM({ messages: messages as any });
    
    const rawContent = llmResponse.choices?.[0]?.message?.content;
    let responseText = typeof rawContent === "string" ? rawContent : "動画の分析結果を生成できませんでした。";
    
    // Limit response length
    if (responseText.length > 4500) {
      responseText = responseText.substring(0, 4500) + "...\n\n（続きがあります）";
    }
    
    // Send reply
    const replySuccess = await replyMessage(event.replyToken, [
      { type: "text", text: responseText },
    ]);
    
    if (replySuccess) {
      await saveLineMessage({
        messageId: `reply_${messageId}_${Date.now()}`,
        sourceType: isGroupChat ? "group" : "user",
        lineUserId: userId,
        lineGroupId: chatId,
        messageType: "text",
        content: responseText,
        direction: "outgoing",
      });
      
      // Mark any pending responses in this group as responded (auto-clear)
      if (isGroupChat && chatId) {
        try {
          await markMessageResponded(chatId, "bot");
          console.log(`[LINE Agent] Marked pending responses as responded in group ${chatId}`);
        } catch (error) {
          console.error("[LINE Agent] Failed to mark messages as responded:", error);
        }
      }
      
      console.log(`[LINE Agent] Video analysis reply sent to ${userId}`);
    }
    
  } catch (error) {
    console.error("[LINE Agent] Error processing video message:", error);
    
    if (event.replyToken) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "動画の処理中にエラーが発生しました。しばらくしてからもう一度お試しください。" },
      ]);
    }
  }
}

/**
 * Handle point balance inquiry
 * ポイント残高照会コマンドを処理
 */
async function handlePointBalanceInquiry(lineUserId: string, replyToken: string): Promise<boolean> {
  try {
    const balance = await getOrCreateLinePointBalance(lineUserId);
    
    const message = `🎯 **LCJポイント残高**\n\n` +
      `💰 現在のポイント: ${balance.balance.toLocaleString()} pt\n` +
      `✅ 獲得累計: ${balance.totalEarned.toLocaleString()} pt\n` +
      `🛒 利用累計: ${balance.totalUsed.toLocaleString()} pt\n\n` +
      `📷 レシートを送信するとポイントが貯まります！`;
    
    await replyMessage(replyToken, [
      { type: "text", text: message },
    ]);
    
    return true;
  } catch (error) {
    console.error("[LINE Agent] Failed to get point balance:", error);
    return false;
  }
}

/**
 * Process receipt image message from LINE
 * LINEから送信されたレシート画像を処理してポイント申請を行う
 * TikTok Shopの注文詳細は複数枚のスクリーンショットが必要な場合があるため、
 * 10秒間画像をバッファリングしてから統合解析を行う
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
  
  console.log(`[LINE Agent] Processing receipt image from ${userId}`);
  
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
    
    // For group chats, check if we should respond
    let shouldRespond = !isGroupChat; // Always respond in DM
    
    if (isGroupChat && groupId) {
      const hasSession = hasActiveSession(groupId, userId);
      if (hasSession) {
        startOrRefreshSession(groupId, userId);
        shouldRespond = true;
        console.log(`[LINE Agent] User has active session, processing receipt image`);
      } else {
        // For image messages in groups without session, skip
        console.log(`[LINE Agent] Group image message without active session, skipping`);
      }
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
    const imageContent = await getMessageContent(messageId);
    if (!imageContent) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "画像の取得に失敗しました。もう一度お送りください。" },
        ]);
      }
      return;
    }
    
    // Generate image hash for duplicate detection
    const imageHash = crypto.createHash("sha256").update(imageContent.data).digest("hex");
    
    // Check for duplicate image
    const duplicateByHash = await checkDuplicateLineReceiptByHash(imageHash);
    if (duplicateByHash) {
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "⚠️ この画像は既に登録されています。\n\n別の画像をお送りください。" },
        ]);
      }
      return;
    }
    
    // Upload image to S3
    const timestamp = Date.now();
    const ext = imageContent.contentType.includes("png") ? "png" : "jpg";
    const fileKey = `line-receipts/${userId}/${timestamp}-${messageId}.${ext}`;
    const { url: imageUrl } = await storagePut(fileKey, imageContent.data, imageContent.contentType);
    
    // Get or create pending image session for this user
    const session = getOrCreatePendingImageSession(userId);
    
    // Add image to session
    session.images.push({
      data: imageContent.data,
      contentType: imageContent.contentType,
      url: imageUrl,
      key: fileKey,
      hash: imageHash,
      messageId,
    });
    session.lastImageAt = Date.now();
    
    console.log(`[LINE Agent] Image ${session.images.length}/${MAX_IMAGES_PER_SESSION} added to session for ${userId}`);
    
    // Clear any existing processing timeout
    if (session.processingTimeout) {
      clearTimeout(session.processingTimeout);
      session.processingTimeout = null;
    }
    
    // If this is the first image, create the receipt record and send initial response
    if (session.images.length === 1) {
      // Create receipt record with first image
      const receiptId = await createLineReceipt({
        lineUserId: userId,
        lineMessageId: messageId,
        imageUrl,
        imageKey: fileKey,
        imageHash,
        status: "pending",
      });
      session.receiptId = receiptId;
      
      // Send initial response with guide image
      if (event.replyToken) {
        await replyMessage(event.replyToken, [
          { type: "text", text: "📷 画像を受け付けました！\n\n複数枚のスクリーンショットを送信する場合は、10秒以内に続けて送信してください。" },
          { 
            type: "image", 
            originalContentUrl: TIKTOK_SHOP_GUIDE_IMAGE_URL,
            previewImageUrl: TIKTOK_SHOP_GUIDE_IMAGE_URL,
          },
        ]);
      }
    } else {
      // Additional image - send confirmation
      const { pushMessage } = await import("./line");
      await pushMessage(userId, [
        { type: "text", text: `📷 ${session.images.length}枚目の画像を受け付けました。\n\nさらに追加する場合は10秒以内に送信してください。` },
      ]);
    }
    
    // If we've reached max images, process immediately
    if (session.images.length >= MAX_IMAGES_PER_SESSION) {
      console.log(`[LINE Agent] Max images reached for ${userId}, processing now`);
      await processMultipleImagesOcr(userId);
      return;
    }
    
    // Set timeout to process after IMAGE_COLLECTION_TIMEOUT_MS
    session.processingTimeout = setTimeout(async () => {
      console.log(`[LINE Agent] Image collection timeout for ${userId}, processing ${session.images.length} images`);
      await processMultipleImagesOcr(userId);
    }, IMAGE_COLLECTION_TIMEOUT_MS);
    
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
 * Process multiple images OCR analysis
 * 複数のスクリーンショットを統合してTikTok Shop注文情報を抽出
 */
async function processMultipleImagesOcr(userId: string): Promise<void> {
  const session = pendingImageSessions.get(userId);
  if (!session || session.images.length === 0 || !session.receiptId) {
    console.log(`[LINE Agent] No pending images for ${userId}`);
    clearPendingImageSession(userId);
    return;
  }
  
  const receiptId = session.receiptId;
  const images = [...session.images];
  
  // Clear the session immediately to prevent duplicate processing
  clearPendingImageSession(userId);
  
  console.log(`[LINE Agent] Processing ${images.length} images for receipt ${receiptId}`);
  
  try {
    const { pushMessage } = await import("./line");
    
    // Notify user that processing has started
    await pushMessage(userId, [
      { type: "text", text: `🔍 ${images.length}枚の画像を解析中です...しばらくお待ちください。` },
    ]);
    
    // Build image content array for LLM
    // Log image sizes for debugging
    images.forEach((img, index) => {
      const base64Size = Math.ceil(img.data.length * 4 / 3);
      console.log(`[LINE Agent] Image ${index + 1}: ${img.contentType}, original size: ${(img.data.length / 1024).toFixed(2)}KB, base64 size: ${(base64Size / 1024).toFixed(2)}KB`);
    });
    
    const imageContents = images.map((img, index) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.contentType};base64,${img.data.toString("base64")}`,
        detail: "high" as const,
      },
    }));
    
    // Run OCR analysis with LLM - Multiple images
    console.log(`[LINE Agent] Calling LLM for OCR analysis with ${images.length} images...`);
    const ocrResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはTikTok Shopの注文詳細画面の複数のスクリーンショットを解析するAIです。
ユーザーは同じ注文の異なる部分を撮影した複数のスクリーンショットを送信しています。
すべての画像を注意深く確認し、情報を統合してJSON形式で返してください。

## 抽出する情報

1. **isTikTokShop** (true/false): TikTok Shopの注文詳細画面かどうか
   - 「注文詳細」「注文番号」「合計金額」「配達済み」などの表記があればtrue

2. **isDelivered** (true/false): 商品が配達済みかどうか
   ※これが最も重要です。以下のいずれかが見つかれば必ずtrueを返してください：
   - 「○月○日に配達」というテキスト（例：「1月28日に配達」）
   - 「お荷物が最終目的地に到着しました」
   - プログレスバーで「配達済み」がアクティブ（ハイライトされている）
   - 「配達済み」「Delivered」「已签收」のテキスト
   - 配達ステータスのプログレスバーが最後まで進んでいる

3. **orderNumber**: 注文番号（17-18桁の数字）
   - 「注文番号」の横に表示されている数字

4. **totalAmount**: 合計金額（数値のみ、円記号なし）
   - 「合計金額（税込）」の値を探す
   - 例: "6,864円" → 6864

5. **orderDate**: 注文日時（YYYY-MM-DD HH:mm形式、不明ならnull）

6. **shopName**: ショップ名（例: "KYOGOKU JAPAN"）

7. **productName**: 商品名

## 重要な注意事項
- 複数の画像から情報を統合してください
- 1枚目に配達ステータス、2枚目に注文番号と金額がある場合、両方を統合
- 抽出できない項目はnullを返す
- JSONのみを返してください（説明文は不要）`,
        },
        {
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text" as const,
              text: `これら${images.length}枚の画像は同じTikTok Shop注文の異なる部分のスクリーンショットです。すべての画像から情報を統合して、注文情報を抽出してください。`,
            },
          ],
        },
      ],
      // Note: response_format removed due to compatibility issues with LLM
      // LLM will return JSON naturally based on the system prompt
    });
    
    console.log(`[LINE Agent] LLM response received for multi-image OCR`);
    console.log(`[LINE Agent] LLM response choices count:`, ocrResult.choices?.length || 0);
    
    if (!ocrResult.choices || ocrResult.choices.length === 0) {
      throw new Error("LLM returned no choices for multi-image OCR");
    }
    
    const messageContent = ocrResult.choices[0].message.content;
    console.log(`[LINE Agent] LLM message content type:`, typeof messageContent);
    console.log(`[LINE Agent] LLM raw message content:`, messageContent);
    
    // Parse JSON from LLM response, handling potential markdown code blocks
    let jsonString = typeof messageContent === "string" ? messageContent : "{}";
    // Remove markdown code block if present
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }
    // Also try to extract JSON object from the response
    const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonString = jsonObjectMatch[0];
    }
    
    let ocrData;
    try {
      ocrData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`[LINE Agent] Failed to parse JSON from LLM response:`, parseError);
      console.error(`[LINE Agent] Raw response:`, messageContent);
      throw new Error(`Failed to parse OCR result JSON: ${parseError}`);
    }
    
    console.log(`[LINE Agent] Multi-image OCR result:`, ocrData);
    
    // Update receipt with all image URLs
    await updateLineReceiptOcr(receiptId, {
      imageUrls: images.map(img => img.url),
      imageKeys: images.map(img => img.key),
    });
    
    // Process the OCR result (same logic as single image)
    await processOcrResult(receiptId, ocrData, userId, images.map(img => img.url));
    
  } catch (error) {
    console.error("[LINE Agent] Multi-image OCR analysis failed:", error);
    console.error("[LINE Agent] Error details:", error instanceof Error ? error.message : String(error));
    console.error("[LINE Agent] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Delete the failed receipt record to allow re-submission
    if (receiptId) {
      try {
        const { deleteLineReceipt } = await import("./db");
        await deleteLineReceipt(receiptId);
        console.log(`[LINE Agent] Deleted failed receipt record ${receiptId}`);
      } catch (deleteError) {
        console.error("[LINE Agent] Failed to delete receipt record:", deleteError);
      }
    }
    
    try {
      const { pushMessage } = await import("./line");
      await pushMessage(userId, [
        {
          type: "text",
          text: `❌ 画像の解析に失敗しました。\n\nもう一度画像を送信してください。\n問題が続く場合はサポートまでお問い合わせください。`,
        },
      ]);
    } catch (notifyError) {
      console.error("[LINE Agent] Failed to send error notification:", notifyError);
    }
  }
}

/**
 * Process OCR result and handle validation, fraud detection, and notifications
 * OCR結果を処理し、検証、不正検知、通知を行う
 */
async function processOcrResult(
  receiptId: number,
  ocrData: {
    isTikTokShop: boolean;
    isDelivered: boolean;
    orderNumber: string | null;
    totalAmount: number | null;
    orderDate: string | null;
    shopName: string | null;
    productName: string | null;
  },
  lineUserId: string,
  imageUrls: string[]
): Promise<void> {
  const { pushMessage } = await import("./line");
  
  // 1. TikTok Shopの注文詳細画面かどうか確認
  if (!ocrData.isTikTokShop) {
    await pushMessage(lineUserId, [
      {
        type: "text",
        text: `❌ この画像はTikTok Shopの注文詳細画面ではありません。\n\nTikTok Shopアプリの注文履歴から、注文詳細画面のスクリーンショットを送信してください。`,
      },
    ]);
    await updateLineReceiptStatus(receiptId, "rejected", 0, "自動拒否: TikTok Shopの注文詳細画面ではない");
    return;
  }
  
  // 2. 配達済みステータスの確認（必須）
  if (!ocrData.isDelivered) {
    await pushMessage(lineUserId, [
      {
        type: "text",
        text: `❌ この注文はまだ「配達済み」になっていません。\n\nポイント申請は商品が配達された後に行ってください。\n\nℹ️ スクリーンショットの撮り方：\n・「X月X日に配達」の表示が見えるように撮影\n・配達ステータスのプログレスバーが見えるように撮影\n・注文番号と合計金額も見えるように撮影`,
      },
    ]);
    await updateLineReceiptStatus(receiptId, "rejected", 0, "自動拒否: 配達済みステータスではない");
    return;
  }
  
  // 3. 注文番号と金額の確認
  if (!ocrData.orderNumber || !ocrData.totalAmount) {
    await pushMessage(lineUserId, [
      {
        type: "text",
        text: `⚠️ 注文情報を読み取れませんでした。\n\n以下を確認して再送信してください：\n・注文番号が見えるか\n・合計金額が見えるか\n・画像が鮮明か`,
      },
    ]);
    return;
  }
  
  // Calculate points (1% return)
  const pointsCalculated = Math.floor(ocrData.totalAmount * 0.01);
  
  // Update receipt with OCR data
  await updateLineReceiptOcr(receiptId, {
    storeName: ocrData.shopName || "TikTok Shop",
    purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
    totalAmount: ocrData.totalAmount,
    currency: "JPY",
    ocrRawText: JSON.stringify({
      orderNumber: ocrData.orderNumber,
      shopName: ocrData.shopName,
      productName: ocrData.productName,
      isDelivered: ocrData.isDelivered,
      imageCount: imageUrls.length,
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
        receiptId,
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
      receiptId
    );
    if (duplicateOrder) {
      // 全ユーザー間で重複が見つかった
      const isSameUser = duplicateOrder.lineUserId === lineUserId;
      fraudFlags.push("duplicate_order");
      fraudScore += 100; // 同じ注文番号は完全に重複
      await createLineFraudDetectionLog({
        receiptId,
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
      await updateLineReceiptStatus(receiptId, "rejected", 0, 
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
      receiptId,
      lineUserId,
      checkType: "high_amount",
      detected: true,
      severity: "low",
      details: `高額購入: ￥${ocrData.totalAmount.toLocaleString()}`,
    });
  }
  
  // Update fraud flags
  if (fraudFlags.length > 0) {
    await updateLineReceiptFraudFlags(receiptId, fraudFlags, fraudScore);
    
    // Auto-hold if fraud score is high
    if (fraudScore >= 50) {
      await updateLineReceiptStatus(receiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
    }
  }
  
  console.log(`[LINE Agent] TikTok Shop OCR completed for ${receiptId}:`, {
    orderNumber: ocrData.orderNumber,
    shopName: ocrData.shopName,
    totalAmount: ocrData.totalAmount,
    pointsCalculated,
    fraudScore,
    imageCount: imageUrls.length,
  });
  
  // Send OCR completion notification to user
  try {
    if (fraudScore >= 100) {
      // Duplicate order - already handled above
    } else if (fraudScore >= 50) {
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
    } else {
      // Successful OCR - notify user with extracted info
      const imageCountText = imageUrls.length > 1 ? `（${imageUrls.length}枚の画像から統合）` : "";
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `✅ 注文の確認が完了しました！${imageCountText}\n\n📝 注文番号: ${ocrData.orderNumber}\n🏪 ショップ: ${ocrData.shopName || "TikTok Shop"}\n📦 商品: ${ocrData.productName || "不明"}\n💰 購入金額: ￥${ocrData.totalAmount.toLocaleString()}\n⭐ 獲得予定ポイント: ${pointsCalculated}pt\n\nスタッフが確認後、ポイントが付与されます。`,
        },
      ]);
    }
  } catch (notifyError) {
    console.error("[LINE Agent] Failed to send OCR completion notification:", notifyError);
  }
}

/**
 * Process receipt OCR analysis (runs asynchronously) - Single image version
 * @deprecated Use processMultipleImagesOcr instead
 */
async function processReceiptOcr(
  receiptId: number,
  imageData: Buffer,
  contentType: string,
  lineUserId: string
): Promise<void> {
  try {
    const base64Image = imageData.toString("base64");
    
    // Run OCR analysis with LLM - TikTok Shop注文詳細画面専用
    const ocrResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析するAIです。

以下の情報を抽出してJSON形式で返してください：

1. isTikTokShop: これがTikTok Shopの注文詳細画面かどうか（true/false）
   - TikTok Shop、注文詳細、注文番号、商品価格の小計、合計金額などの表記があれはtrue
2. isDelivered: 商品が配達済みかどうか（true/false）
   重要：以下のいずれかが見つかればtrueを返す：
   - 「X月X日に配達」（例：「1月28日に配達」）
   - 「お荷物が最終目的地に到着しました」
   - 「配達済み」ステータス（プログレスバーの最後のステップ）
   - 「已签收」「Delivered」
   - 配達ステータスのプログレスバーで「配達済み」がハイライトされている
   注意：「返品/返金」ボタンのみが表示されていて配達ステータスが見えない場合でも、上記の表記があればtrue
3. orderNumber: 注文番号（17桁程度の数字）
4. totalAmount: 合計金額（数値のみ、通貨記号なし）
   - 「合計金額（税込）」の値を探す
5. orderDate: 注文日時（YYYY-MM-DD HH:mm形式）
6. shopName: ショップ名（例: KYOGOKU JAPAN）
7. productName: 商品名

抽出できない項目はnullを返してください。`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: "この画像からTikTok Shopの注文情報を抽出してください。",
            },
          ],
        },
      ],
      // Note: response_format removed due to compatibility issues with LLM
      // LLM will return JSON naturally based on the system prompt
    });
    
    const messageContent = ocrResult.choices[0].message.content;
    
    // Parse JSON from LLM response, handling potential markdown code blocks
    let jsonString = typeof messageContent === "string" ? messageContent : "{}";
    // Remove markdown code block if present
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }
    // Also try to extract JSON object from the response
    const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonString = jsonObjectMatch[0];
    }
    
    let ocrData;
    try {
      ocrData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`[LINE Agent] Failed to parse JSON from LLM response:`, parseError);
      console.error(`[LINE Agent] Raw response:`, messageContent);
      throw new Error(`Failed to parse OCR result JSON: ${parseError}`);
    }
    
    // TikTok Shop注文詳細画面の検証
    const { pushMessage } = await import("./line");
    
    // 1. TikTok Shopの注文詳細画面かどうか確認
    if (!ocrData.isTikTokShop) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `❌ この画像はTikTok Shopの注文詳細画面ではありません。\n\nTikTok Shopアプリの注文履歴から、注文詳細画面のスクリーンショットを送信してください。`,
        },
      ]);
      await updateLineReceiptStatus(receiptId, "rejected", 0, "自動拒否: TikTok Shopの注文詳細画面ではない");
      return;
    }
    
    // 2. 配達済みステータスの確認（必須）
    if (!ocrData.isDelivered) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `❌ この注文はまだ「配達済み」になっていません。\n\nポイント申請は商品が配達された後に行ってください。\n\nℹ️ スクリーンショットの撮り方：\n・「X月X日に配達」の表示が見えるように撮影\n・配達ステータスのプログレスバーが見えるように撮影\n・注文番号と合計金額も見えるように撮影`,
        },
      ]);
      await updateLineReceiptStatus(receiptId, "rejected", 0, "自動拒否: 配達済みステータスではない");
      return;
    }
    
    // 3. 注文番号と金額の確認
    if (!ocrData.orderNumber || !ocrData.totalAmount) {
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `⚠️ 注文情報を読み取れませんでした。\n\n以下を確認して再送信してください：\n・注文番号が見えるか\n・合計金額が見えるか\n・画像が鮮明か`,
        },
      ]);
      return;
    }
    
    // Calculate points (1% return)
    const pointsCalculated = Math.floor(ocrData.totalAmount * 0.01);
    
    // Update receipt with OCR data
    await updateLineReceiptOcr(receiptId, {
      storeName: ocrData.shopName || "TikTok Shop",
      purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
      totalAmount: ocrData.totalAmount,
      currency: "JPY",
      ocrRawText: JSON.stringify({
        orderNumber: ocrData.orderNumber,
        shopName: ocrData.shopName,
        productName: ocrData.productName,
        isDelivered: ocrData.isDelivered,
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
          receiptId,
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
        receiptId
      );
      if (duplicateOrder) {
        // 全ユーザー間で重複が見つかった
        const isSameUser = duplicateOrder.lineUserId === lineUserId;
        fraudFlags.push("duplicate_order");
        fraudScore += 100; // 同じ注文番号は完全に重複
        await createLineFraudDetectionLog({
          receiptId,
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
        await updateLineReceiptStatus(receiptId, "rejected", 0, 
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
        receiptId,
        lineUserId,
        checkType: "high_amount",
        detected: true,
        severity: "low",
        details: `高額購入: ¥${ocrData.totalAmount.toLocaleString()}`,
      });
    }
    
    // Update fraud flags
    if (fraudFlags.length > 0) {
      await updateLineReceiptFraudFlags(receiptId, fraudFlags, fraudScore);
      
      // Auto-hold if fraud score is high
      if (fraudScore >= 50) {
        await updateLineReceiptStatus(receiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
      }
    }
    
    console.log(`[LINE Agent] TikTok Shop OCR completed for ${receiptId}:`, {
      orderNumber: ocrData.orderNumber,
      shopName: ocrData.shopName,
      totalAmount: ocrData.totalAmount,
      pointsCalculated,
      fraudScore,
    });
    
    // Send OCR completion notification to user
    try {
      if (fraudScore >= 100) {
        // Duplicate order - reject
        await pushMessage(lineUserId, [
          {
            type: "text",
            text: `❌ この注文は既にポイント申請済みです。\n\n注文番号: ${ocrData.orderNumber}\n\n同じ注文での重複申請はできません。`,
          },
        ]);
      } else if (fraudScore >= 50) {
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
      } else {
        // Successful OCR - notify user with extracted info
        await pushMessage(lineUserId, [
          {
            type: "text",
            text: `✅ 注文の確認が完了しました！\n\n📝 注文番号: ${ocrData.orderNumber}\n🏪 ショップ: ${ocrData.shopName || "TikTok Shop"}\n📦 商品: ${ocrData.productName || "不明"}\n💰 購入金額: ¥${ocrData.totalAmount.toLocaleString()}\n⭐ 獲得予定ポイント: ${pointsCalculated}pt\n\nスタッフが確認後、ポイントが付与されます。`,
          },
        ]);
      }
    } catch (notifyError) {
      console.error("[LINE Agent] Failed to send OCR completion notification:", notifyError);
    }
    
  } catch (error) {
    console.error("[LINE Agent] OCR analysis failed:", error);
    
    // Notify user about the error
    try {
      const { pushMessage } = await import("./line");
      await pushMessage(lineUserId, [
        {
          type: "text",
          text: `❌ レシートの解析に失敗しました。\n\nもう一度レシート画像を送信してください。\n問題が続く場合はサポートまでお問い合わせください。`,
        },
      ]);
    } catch (notifyError) {
      console.error("[LINE Agent] Failed to send error notification:", notifyError);
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
