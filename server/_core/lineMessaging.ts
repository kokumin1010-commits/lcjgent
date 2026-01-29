import { ENV } from "./env";

/**
 * LINE Messaging API helper for sending push messages to users
 */

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LineFlexMessage {
  type: "flex";
  altText: string;
  contents: object;
}

type LineMessage = LineTextMessage | LineFlexMessage;

/**
 * Send a push message to a specific LINE user
 * @param userId - LINE User ID
 * @param messages - Array of messages to send (max 5)
 */
export async function sendLinePushMessage(
  userId: string,
  messages: LineMessage[]
): Promise<{ success: boolean; error?: string }> {
  if (!ENV.lineChannelAccessToken) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN not configured" };
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: messages.slice(0, 5), // LINE allows max 5 messages per request
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[LINE Push] Error:", response.status, errorData);
      return { 
        success: false, 
        error: `LINE API error: ${response.status} - ${JSON.stringify(errorData)}` 
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[LINE Push] Exception:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Create a coaching advice message for LINE
 * @param liverName - Name of the liver
 * @param salesAmount - Sales amount in yen
 * @param advice - AI-generated advice (structured or plain text)
 * @param metrics - Calculated metrics
 */
export function createCoachingMessage(
  liverName: string,
  salesAmount: number,
  advice: {
    summary?: string;
    goodPoints?: string[];
    improvements?: string[];
    nextActions?: { action: string; reason: string; timing: string }[];
    targetForNextTime?: string;
  } | null,
  metrics?: Record<string, string | number> | null,
  plainAdvice?: string
): LineMessage[] {
  const messages: LineMessage[] = [];
  
  // Main message with summary
  let mainText = `🎉 ${liverName}さん、配信お疲れ様でした！\n\n`;
  mainText += `💰 売上: ¥${salesAmount.toLocaleString()}\n`;
  
  // Add metrics if available
  if (metrics) {
    if (metrics["コンバージョン率"]) mainText += `📊 CVR: ${metrics["コンバージョン率"]}\n`;
    if (metrics["客単価"]) mainText += `💵 客単価: ${metrics["客単価"]}\n`;
    if (metrics["時間効率"]) mainText += `⏱️ 時間効率: ${metrics["時間効率"]}\n`;
  }
  
  messages.push({ type: "text", text: mainText });
  
  // Structured advice
  if (advice) {
    let adviceText = "";
    
    // Summary
    if (advice.summary) {
      adviceText += `📝 総評\n${advice.summary}\n\n`;
    }
    
    // Good points
    if (advice.goodPoints && advice.goodPoints.length > 0) {
      adviceText += `✅ 良かった点\n`;
      advice.goodPoints.forEach(point => {
        adviceText += `・${point}\n`;
      });
      adviceText += "\n";
    }
    
    // Improvements
    if (advice.improvements && advice.improvements.length > 0) {
      adviceText += `⚠️ 改善ポイント\n`;
      advice.improvements.forEach(point => {
        adviceText += `・${point}\n`;
      });
      adviceText += "\n";
    }
    
    if (adviceText) {
      messages.push({ type: "text", text: adviceText.trim() });
    }
    
    // Next actions
    if (advice.nextActions && advice.nextActions.length > 0) {
      let actionsText = `🎯 次回のアクション\n\n`;
      advice.nextActions.forEach((action, i) => {
        actionsText += `${i + 1}. ${action.action}\n`;
        actionsText += `   理由: ${action.reason}\n`;
        actionsText += `   タイミング: ${action.timing}\n\n`;
      });
      messages.push({ type: "text", text: actionsText.trim() });
    }
    
    // Target for next time
    if (advice.targetForNextTime) {
      messages.push({ 
        type: "text", 
        text: `🏆 次回の目標\n${advice.targetForNextTime}` 
      });
    }
  } else if (plainAdvice) {
    // Fallback to plain text advice
    messages.push({ type: "text", text: `💡 アドバイス\n${plainAdvice}` });
  }
  
  return messages;
}

/**
 * Send coaching advice to a liver via LINE
 */
export async function sendCoachingToLiver(
  lineUserId: string,
  liverName: string,
  salesAmount: number,
  advice: {
    summary?: string;
    goodPoints?: string[];
    improvements?: string[];
    nextActions?: { action: string; reason: string; timing: string }[];
    targetForNextTime?: string;
  } | null,
  metrics?: Record<string, string | number> | null,
  plainAdvice?: string
): Promise<{ success: boolean; error?: string }> {
  const messages = createCoachingMessage(
    liverName,
    salesAmount,
    advice,
    metrics,
    plainAdvice
  );
  
  return sendLinePushMessage(lineUserId, messages);
}
