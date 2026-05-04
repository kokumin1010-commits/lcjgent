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
 * Create a coaching advice message for LINE (enriched version)
 * @param liverName - Name of the liver
 * @param salesAmount - Sales amount in yen
 * @param advice - AI-generated advice (structured or plain text)
 * @param metrics - Calculated metrics (CVR, 客単価, 時間効率, etc.)
 * @param plainAdvice - Fallback plain text advice
 * @param enrichedData - Additional data for richer messages (brand breakdown, prev comparison, goal progress)
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
  plainAdvice?: string,
  enrichedData?: {
    duration?: number; // minutes
    orderCount?: number;
    viewerCount?: number;
    previousSales?: number;
    previousDuration?: number;
    brandBreakdown?: { brandName: string; sales: number; duration?: number }[];
    monthlyGoal?: { salesGoal: number; currentSales: number; achievementRate: number };
  } | null
): LineMessage[] {
  const messages: LineMessage[] = [];
  
  // === Message 1: Main Report ===
  let mainText = `🎉 ${liverName}さん、配信お疲れ様でした！\n\n`;
  mainText += `━━━━━━━━━━━━━━\n`;
  mainText += `📊 配信レポート\n`;
  mainText += `━━━━━━━━━━━━━━\n`;
  mainText += `💰 売上: ¥${salesAmount.toLocaleString()}`;
  
  // Add comparison with previous stream
  if (enrichedData?.previousSales !== undefined && enrichedData.previousSales > 0) {
    const diff = salesAmount - enrichedData.previousSales;
    const diffPercent = Math.round((diff / enrichedData.previousSales) * 100);
    if (diff >= 0) {
      mainText += ` (前回比 +${diffPercent}%↑)`;
    } else {
      mainText += ` (前回比 ${diffPercent}%)`;
    }
  }
  mainText += `\n`;
  
  // Duration and hourly rate
  if (enrichedData?.duration && enrichedData.duration > 0) {
    const hours = enrichedData.duration / 60;
    const hourlyRate = Math.round(salesAmount / hours);
    const durationStr = hours >= 1 
      ? `${Math.floor(hours)}時間${enrichedData.duration % 60 > 0 ? (enrichedData.duration % 60) + '分' : ''}`
      : `${enrichedData.duration}分`;
    mainText += `⏱️ 配信時間: ${durationStr}\n`;
    mainText += `📈 時間単価: ¥${hourlyRate.toLocaleString()}/h`;
    
    // Compare hourly rate with previous
    if (enrichedData.previousSales && enrichedData.previousDuration && enrichedData.previousDuration > 0) {
      const prevHourlyRate = Math.round(enrichedData.previousSales / (enrichedData.previousDuration / 60));
      const hrDiff = hourlyRate - prevHourlyRate;
      const hrDiffPercent = Math.round((hrDiff / prevHourlyRate) * 100);
      if (hrDiff >= 0) {
        mainText += ` (+${hrDiffPercent}%↑)`;
      } else {
        mainText += ` (${hrDiffPercent}%)`;
      }
    }
    mainText += `\n`;
  }
  
  // Order count and CVR
  if (enrichedData?.orderCount) {
    mainText += `🛒 注文数: ${enrichedData.orderCount}件`;
    if (enrichedData.viewerCount && enrichedData.viewerCount > 0) {
      const cvr = ((enrichedData.orderCount / enrichedData.viewerCount) * 100).toFixed(2);
      mainText += ` (CVR ${cvr}%)`;
    }
    mainText += `\n`;
  } else if (metrics) {
    if (metrics["コンバージョン率"]) mainText += `📊 CVR: ${metrics["コンバージョン率"]}\n`;
    if (metrics["客単価"]) mainText += `💵 客単価: ${metrics["客単価"]}\n`;
    if (metrics["時間効率"]) mainText += `⏱️ 時間効率: ${metrics["時間効率"]}\n`;
  }
  
  // Viewer count
  if (enrichedData?.viewerCount) {
    mainText += `👀 視聴者: ${enrichedData.viewerCount.toLocaleString()}人\n`;
  }
  
  // Monthly goal progress
  if (enrichedData?.monthlyGoal && enrichedData.monthlyGoal.salesGoal > 0) {
    const mg = enrichedData.monthlyGoal;
    const remaining = mg.salesGoal - mg.currentSales;
    mainText += `\n🎯 月間目標進捗\n`;
    mainText += `  目標: ¥${mg.salesGoal.toLocaleString()}\n`;
    mainText += `  達成: ¥${mg.currentSales.toLocaleString()} (${mg.achievementRate}%)\n`;
    mainText += `  残り: ¥${Math.max(0, remaining).toLocaleString()}`;
    if (mg.achievementRate >= 100) {
      mainText += ` 🏆達成！`;
    }
    mainText += `\n`;
  }
  
  messages.push({ type: "text", text: mainText.trim() });
  
  // === Message 2: Brand Breakdown (if available) ===
  if (enrichedData?.brandBreakdown && enrichedData.brandBreakdown.length > 0) {
    let brandText = `📦 ブランド別実績\n`;
    brandText += `━━━━━━━━━━━━━━\n`;
    enrichedData.brandBreakdown.forEach(brand => {
      const percentage = salesAmount > 0 ? Math.round((brand.sales / salesAmount) * 100) : 0;
      brandText += `・${brand.brandName}: ¥${brand.sales.toLocaleString()} (${percentage}%)`;
      if (brand.duration) {
        brandText += ` / ${brand.duration}分`;
      }
      brandText += `\n`;
    });
    messages.push({ type: "text", text: brandText.trim() });
  }
  
  // === Message 3: Advice ===
  if (advice) {
    let adviceText = `💡 AIコーチング\n`;
    adviceText += `━━━━━━━━━━━━━━\n`;
    
    // Summary
    if (advice.summary) {
      adviceText += `${advice.summary}\n\n`;
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
      adviceText += `⚡ 伸びしろ\n`;
      advice.improvements.forEach(point => {
        adviceText += `・${point}\n`;
      });
      adviceText += "\n";
    }
    
    if (adviceText.length > 30) {
      messages.push({ type: "text", text: adviceText.trim() });
    }
    
    // Next actions (separate message to stay within LINE limits)
    if (advice.nextActions && advice.nextActions.length > 0) {
      let actionsText = `🎯 次回のアクション\n\n`;
      advice.nextActions.forEach((action, i) => {
        actionsText += `${i + 1}. ${action.action}\n`;
        actionsText += `   理由: ${action.reason}\n`;
        actionsText += `   タイミング: ${action.timing}\n\n`;
      });
      
      // Target for next time
      if (advice.targetForNextTime) {
        actionsText += `\n🏆 次回の目標\n${advice.targetForNextTime}`;
      }
      
      messages.push({ type: "text", text: actionsText.trim() });
    }
  } else if (plainAdvice) {
    // Fallback to plain text advice
    messages.push({ type: "text", text: `💡 アドバイス\n${plainAdvice}` });
  }
  
  // Add 神コーチ link as the last message
  const coachLink = enrichedData?.livestreamId 
    ? `https://lcjmall.com/liver/coach?context=post_stream&livestreamId=${enrichedData.livestreamId}`
    : `https://lcjmall.com/liver/coach?context=post_stream`;
  messages.push({ type: "text", text: `━━━━━━━━━━━━━━━\n💬 もっと詳しく振り返りたい？\n👇 神コーチに相談する\n${coachLink}` });
  
  // Ensure we don't exceed LINE's 5 message limit
  return messages.slice(0, 5);
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
  plainAdvice?: string,
  enrichedData?: {
    duration?: number;
    orderCount?: number;
    viewerCount?: number;
    previousSales?: number;
    previousDuration?: number;
    brandBreakdown?: { brandName: string; sales: number; duration?: number }[];
    monthlyGoal?: { salesGoal: number; currentSales: number; achievementRate: number };
  } | null
): Promise<{ success: boolean; error?: string }> {
  const messages = createCoachingMessage(
    liverName,
    salesAmount,
    advice,
    metrics,
    plainAdvice,
    enrichedData
  );
  
  return sendLinePushMessage(lineUserId, messages);
}
