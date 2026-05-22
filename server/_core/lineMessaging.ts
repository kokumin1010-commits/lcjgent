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
    livestreamId?: number;
    sets?: { setName: string; setPrice: number; quantitySold: number; items: { productName: string; originalPrice: number; quantity: number }[] }[];
    livestreamDate?: string;
    brandDurations?: Record<string, number>;
    complianceData?: {
      isScheduled: boolean;
      isLateRegistration: boolean;
      hoursLate?: number;
      hasBrandInput: boolean;
      monthlyStats: {
        totalStreams: number;
        lateCount: number;
        unscheduledCount: number;
        noBrandCount: number;
        consecutiveLate: number;
        overallRate: number;
      };
    };
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
    if (mg.achievementRate >= 100) {
      const exceeded = mg.currentSales - mg.salesGoal;
      mainText += `  🏆 目標達成！超過: ¥${exceeded.toLocaleString()}\n`;
    } else {
      mainText += `  残り: ¥${remaining.toLocaleString()}\n`;
    }
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
  
  // === Message 2.5: Set Breakdown (same as group LINE format) ===
  if (enrichedData?.sets && enrichedData.sets.length > 0) {
    let setText = `📦 セット内訳:\n\n`;
    enrichedData.sets.forEach(set => {
      const totalOriginalPrice = set.items.reduce((sum, item) => sum + item.originalPrice * (item.quantity || 1), 0);
      const discountRate = totalOriginalPrice > 0 ? Math.round(((totalOriginalPrice - set.setPrice) / totalOriginalPrice) * 100) : 0;
      setText += `【${set.setName}】\n`;
      setText += `定価¥${totalOriginalPrice.toLocaleString()} → ¥${set.setPrice.toLocaleString()}`;
      if (discountRate > 0) setText += ` (${discountRate}%OFF)`;
      setText += `\n\n`;
      set.items.forEach(item => {
        const qty = item.quantity || 1;
        setText += `■ ${item.productName} ${qty}個\n`;
      });
      setText += `合計 ${set.items.reduce((sum, item) => sum + (item.quantity || 1), 0)}点\n\n`;
      setText += `販売数 ${set.quantitySold}セット / 売上 ¥${(set.setPrice * set.quantitySold).toLocaleString()}\n`;
      setText += `━━━━━━━━━━━━━━\n`;
    });
    messages.push({ type: "text", text: setText.trim() });
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
    // Fallback to plain text advice - try to parse JSON if it looks like structured data
    let formattedAdvice = plainAdvice;
    try {
      if (plainAdvice.trim().startsWith('{')) {
        const parsed = JSON.parse(plainAdvice);
        // Convert structured JSON to readable text
        let adviceText = `💡 AIコーチング\n`;
        adviceText += `━━━━━━━━━━━━━━\n`;
        if (parsed.summary) {
          adviceText += `${parsed.summary}\n\n`;
        }
        if (parsed.goodPoints && parsed.goodPoints.length > 0) {
          adviceText += `✅ 良かった点\n`;
          parsed.goodPoints.forEach((point: string) => {
            adviceText += `・${point}\n`;
          });
          adviceText += "\n";
        }
        if (parsed.improvements && parsed.improvements.length > 0) {
          adviceText += `⚡ 伸びしろ\n`;
          parsed.improvements.forEach((point: string) => {
            adviceText += `・${point}\n`;
          });
          adviceText += "\n";
        }
        if (parsed.nextActions && parsed.nextActions.length > 0) {
          adviceText += `🎯 次回のアクション\n\n`;
          parsed.nextActions.forEach((action: any, i: number) => {
            adviceText += `${i + 1}. ${action.action}\n`;
            if (action.reason) adviceText += `   理由: ${action.reason}\n`;
            if (action.timing) adviceText += `   タイミング: ${action.timing}\n`;
            adviceText += `\n`;
          });
        }
        if (parsed.targetForNextTime) {
          adviceText += `🏆 次回の目標\n${parsed.targetForNextTime}`;
        }
        formattedAdvice = adviceText.trim();
      } else {
        formattedAdvice = `💡 アドバイス\n${plainAdvice}`;
      }
    } catch {
      formattedAdvice = `💡 アドバイス\n${plainAdvice}`;
    }
    messages.push({ type: "text", text: formattedAdvice });
  }
  
  // === Compliance Status Message ===
  if (enrichedData?.complianceData) {
    const cd = enrichedData.complianceData;
    const ms = cd.monthlyStats;
    let complianceText = `📋 配信ルール遵守状況\n━━━━━━━━━━━━━━\n`;
    
    // This stream's status
    complianceText += cd.isScheduled 
      ? `✅ スケジュール事前登録: OK\n`
      : `🚨 スケジュール未登録配信\n   → 次回は必ず事前にスケジュール登録しましょう\n`;
    
    if (cd.isLateRegistration) {
      complianceText += `⚠️ 48h超過登録（配信後${cd.hoursLate || '48+'}時間で登録）\n`;
      complianceText += `   → 次回は48時間以内に登録しましょう\n`;
    } else {
      complianceText += `✅ 記録登録: 48h以内 OK\n`;
    }
    
    complianceText += cd.hasBrandInput
      ? `✅ ブランド時間入力: OK\n`
      : `⚠️ ブランド時間未入力\n   → ブランド別配信時間を入力してください\n`;
    
    // Monthly stats
    complianceText += `\n📊 今月の状況:\n`;
    complianceText += `├ 総合遵守率: ${ms.overallRate}%\n`;
    if (ms.unscheduledCount > 0) {
      complianceText += `├ スケジュール未登録: ${ms.unscheduledCount}回 / ${ms.totalStreams}配信\n`;
    }
    if (ms.lateCount > 0) {
      complianceText += `├ 48h超過登録: ${ms.lateCount}回`;
      if (ms.consecutiveLate > 1) {
        complianceText += `（連続${ms.consecutiveLate}回 🔥）`;
      }
      complianceText += `\n`;
    }
    if (ms.noBrandCount > 0) {
      complianceText += `├ ブランド未入力: ${ms.noBrandCount}回\n`;
    }
    
    // Warning for consecutive violations
    if (ms.consecutiveLate >= 3) {
      complianceText += `\n🚨 連続${ms.consecutiveLate}回の遅延登録です！\n   評価に大きく影響します。改善してください。`;
    } else if (ms.consecutiveLate >= 2) {
      complianceText += `\n⚠️ 連続遅延が続いています。評価に影響します。`;
    }
    
    if (ms.overallRate < 60) {
      complianceText += `\n\n⚠️ 遵守率が${ms.overallRate}%です。80%以上を目指しましょう。`;
    }
    
    messages.push({ type: "text", text: complianceText.trim() });
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
    livestreamId?: number;
    sets?: { setName: string; setPrice: number; quantitySold: number; items: { productName: string; originalPrice: number; quantity: number }[] }[];
    livestreamDate?: string;
    brandDurations?: Record<string, number>;
    complianceData?: {
      isScheduled: boolean;
      isLateRegistration: boolean;
      hoursLate?: number;
      hasBrandInput: boolean;
      monthlyStats: {
        totalStreams: number;
        lateCount: number;
        unscheduledCount: number;
        noBrandCount: number;
        consecutiveLate: number;
        overallRate: number;
      };
    };
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
