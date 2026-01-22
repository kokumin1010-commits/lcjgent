import { invokeLLM } from "./_core/llm";
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
  searchSchedules,
} from "./db";

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
- "リマインド" または "remind" → {"action": "remind", "target": "内容", "hours": 時間数, "message": "メッセージ"}
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

通常の会話の場合は、普通のテキストで応答してください。`;

// Parse AI response for special actions
interface AgentAction {
  action: "remind" | "followup" | "list_staff" | "list_tasks" | "list_brands" | "schedule_today" | "schedule_tomorrow" | "schedule_week" | "schedule_add" | "schedule_liver" | "none";
  target?: string;
  targetType?: "person" | "task"; // person = 人名, task = タスク/業務内容
  time?: string;
  message?: string;
  hours?: number;
  // Schedule-specific fields
  title?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  liverName?: string;
  category?: "delivery" | "meeting" | "live" | "other";
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
      const hoursLater = action.hours || 24;
      
      await createLineFollowUp({
        targetType: "user",
        lineUserId: lineUserId,
        triggerCondition: "scheduled",
        delayHours: hoursLater,
        maxAttempts: 1,
        messageTemplate: `【リマインド】\n${action.message || action.target || "指定なし"}`,
        nextScheduledAt: new Date(Date.now() + hoursLater * 60 * 60 * 1000),
      });
      
      return `リマインドを設定しました。\n内容: ${action.target || action.message || "指定なし"}\n時間: ${hoursLater}時間後`;
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
      // TODO: Add image processing if needed
      console.log(`[LINE Agent] Image message received, not yet implemented`);
      break;
    case "audio":
      // TODO: Add audio processing if needed
      console.log(`[LINE Agent] Audio message received, not yet implemented`);
      break;
    default:
      console.log(`[LINE Agent] Unknown message type: ${messageType}`);
  }
}
