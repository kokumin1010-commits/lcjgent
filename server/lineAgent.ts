import { invokeLLM } from "./_core/llm";
import { replyMessage, LineWebhookEvent, getUserProfile, getBotInfo } from "./line";
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
} from "./db";

// System prompt for the LINE AI Agent
const SYSTEM_PROMPT = `あなたは「ライブコマースジャパン」の業務支援AIアシスタントです。
LINEを通じてユーザーからの問い合わせに対応し、タスクを自動実行します。

【あなたの役割】
- ユーザーの質問に丁寧に回答する
- タスクの確認やリマインド設定を支援する
- フォローアップの設定を行う
- スタッフや予定の確認を行う

【対応可能なコマンド】
- 「リマインドして」「〇〇を確認して」→ タスク関連の操作
- 「フォローアップして」「〇〇さんに連絡して」→ フォローアップ設定
- 「スタッフ一覧」「担当者を教えて」→ スタッフ情報の確認
- その他の質問にも柔軟に対応

【応答ルール】
- 簡潔で分かりやすい日本語で回答
- 絵文字は控えめに使用
- 不明な点は確認を取る
- 個人情報の取り扱いに注意

【特別な指示の検出】
ユーザーのメッセージに以下のキーワードが含まれる場合、JSONで応答してください：
- "リマインド" または "remind" → {"action": "remind", "target": "内容", "hours": 時間数, "message": "メッセージ"}
- "フォローアップ" または "followup" → {"action": "followup", "target": "対象", "message": "メッセージ"}
- "スタッフ一覧" または "担当者" → {"action": "list_staff"}
- "タスク一覧" または "進行中" → {"action": "list_tasks"}
- "ブランド一覧" または "ブランド" → {"action": "list_brands"}

通常の会話の場合は、普通のテキストで応答してください。`;

// Parse AI response for special actions
interface AgentAction {
  action: "remind" | "followup" | "list_staff" | "list_tasks" | "list_brands" | "none";
  target?: string;
  time?: string;
  message?: string;
  hours?: number;
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
    const role = msg.direction === "incoming" ? "ユーザー" : "アシスタント";
    return `${role}: ${msg.content}`;
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
        return "フォローアップ対象を指定してください。例：「〇〇さんにフォローアップして」";
      }
      
      // Create a follow-up entry
      await createLineFollowUp({
        targetType: "user",
        lineUserId: lineUserId,
        triggerCondition: "scheduled",
        delayHours: 24,
        maxAttempts: 1,
        messageTemplate: action.message || `${action.target}さんへのフォローアップ`,
        nextScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      
      return `${action.target}さんへのフォローアップを設定しました。24時間後にリマインドします。`;
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
    
    default:
      return "";
  }
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
    
    // If group chat, save group info
    if (groupId) {
      await createOrUpdateLineGroup({
        lineGroupId: groupId,
        groupName: "グループ", // LINE API doesn't provide group name easily
      });
    }
    
    // Always save incoming message (for logging purposes)
    await saveLineMessage({
      messageId,
      sourceType: isGroupChat ? "group" : "user",
      lineUserId: userId,
      lineGroupId: chatId,
      messageType: "text",
      content: userMessage,
      direction: "incoming",
      lineTimestamp: event.timestamp,
    });
    
    // Update last message timestamp
    await updateLineUserLastMessage(userId);
    
    // For group chats, only respond if mentioned
    if (isGroupChat) {
      const botInfo = await getBotInfo();
      const mentioned = isBotMentioned(userMessage, botInfo?.userId);
      
      if (!mentioned) {
        console.log(`[LINE Agent] Group message not mentioning bot, skipping response`);
        return; // Don't respond, but message is already saved
      }
      
      console.log(`[LINE Agent] Bot mentioned in group, will respond`);
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
      messages.push({
        role: "system",
        content: "【注意】これはグループチャットでの会話です。メンションされたので応答します。",
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
