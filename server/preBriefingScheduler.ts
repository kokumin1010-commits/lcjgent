/**
 * 配信前ブリーフィング スケジューラー
 * 
 * 配信1時間前にライバーへ個別LINE送信:
 * - 今日の売上目標（時間単価×配信時間）
 * - 前回同時間帯の実績との比較
 * - 前回の改善点（AIコーチからのフィードバック）
 * - 推奨商品TOP3
 * 
 * 配信5分前に「準備OK？」メッセージ送信
 * 
 * 既存のscheduleReminderSchedulerとは別に動作（そちらは30分前の簡易リマインダー）
 */

import { getDb } from "./db";
import { schedules, livers, brandLivestreams, brands } from "../drizzle/schema";
import { and, eq, gte, lte, isNull, not, desc, sql } from "drizzle-orm";
import { pushMessage } from "./line";
import { getLiverMonthlySummaryV2, getLiverMonthlyGoalByName, getRecentTopProductsForLiver } from "./db";
import { invokeLLM } from "./_core/llm";

const LOG_PREFIX = "[Pre-Briefing]";
let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

// Track sent briefings to avoid duplicates
const sentBriefings = new Map<string, Date>(); // key: `${scheduleId}-${type}` -> sentAt

/**
 * Get JST now
 */
function getJSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/**
 * Get schedules starting within the next 65 minutes (for 1h briefing with buffer)
 */
async function getUpcomingSchedules(minutesAhead: number): Promise<Array<{
  id: number;
  title: string;
  startTime: Date;
  endTime: Date | null;
  liverName: string | null;
  liverId: number | null;
  category: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureLimit = new Date(now.getTime() + minutesAhead * 60 * 1000);

  const result = await db
    .select({
      id: schedules.id,
      title: schedules.title,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      liverName: schedules.liverName,
      liverId: schedules.liverId,
      category: schedules.category,
    })
    .from(schedules)
    .where(
      and(
        gte(schedules.startTime, now),
        lte(schedules.startTime, futureLimit),
        not(eq(schedules.status, "cancelled"))
      )
    );

  return result;
}

/**
 * Get liver's LINE user ID by name
 */
async function getLiverLineUserId(liverName: string): Promise<{ lineUserId: string | null; liverId: number | null }> {
  const db = await getDb();
  if (!db) return { lineUserId: null, liverId: null };

  const result = await db
    .select({ id: livers.id, lineUserId: livers.lineUserId })
    .from(livers)
    .where(eq(livers.name, liverName))
    .limit(1);

  if (result.length === 0) return { lineUserId: null, liverId: null };
  return { lineUserId: result[0].lineUserId, liverId: result[0].id };
}

/**
 * Get liver's recent performance at same time slot (for comparison)
 */
async function getSameTimeSlotPerformance(liverName: string, startHour: number): Promise<{
  avgSales: number;
  avgHourlyRate: number;
  count: number;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Find liver
    const liver = await db
      .select({ id: livers.id })
      .from(livers)
      .where(eq(livers.name, liverName))
      .limit(1);

    if (liver.length === 0) return null;

    // Get streams in similar time slot (within 2 hours) from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const streams = await db
      .select({
        salesAmount: brandLivestreams.salesAmount,
        duration: brandLivestreams.duration,
        livestreamDate: brandLivestreams.livestreamDate,
      })
      .from(brandLivestreams)
      .where(
        and(
          eq(brandLivestreams.liverId, liver[0].id),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, thirtyDaysAgo),
          sql`HOUR(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00')) BETWEEN ${startHour - 2} AND ${startHour + 2}`
        )
      )
      .orderBy(desc(brandLivestreams.livestreamDate))
      .limit(10);

    if (streams.length === 0) return null;

    const totalSales = streams.reduce((sum, s) => sum + Number(s.salesAmount || 0), 0);
    const totalDuration = streams.reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const avgSales = Math.round(totalSales / streams.length);
    const avgHourlyRate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;

    return { avgSales, avgHourlyRate, count: streams.length };
  } catch (err) {
    console.error(`${LOG_PREFIX} getSameTimeSlotPerformance error:`, err);
    return null;
  }
}

/**
 * Get last coaching feedback for this liver (improvement points)
 */
async function getLastImprovementPoint(liverName: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Check ai_coach_messages or live_suggestions for last feedback
    const result = await db.execute(
      sql`SELECT suggestion_text FROM live_suggestions 
          WHERE liver_name = ${liverName} 
          ORDER BY created_at DESC LIMIT 1`
    );
    
    const rows = result.rows || result;
    if (Array.isArray(rows) && rows.length > 0) {
      const text = (rows[0] as any).suggestion_text || '';
      // Extract improvement/strategy section
      const strategyMatch = text.match(/💡[^]*?(?=━|$)/);
      if (strategyMatch) return strategyMatch[0].trim().slice(0, 200);
    }
    return null;
  } catch (err) {
    console.error(`${LOG_PREFIX} getLastImprovementPoint error:`, err);
    return null;
  }
}

/**
 * Build 1-hour-before briefing message
 */
async function buildBriefingMessage(
  liverName: string,
  schedule: { startTime: Date; endTime: Date | null; title: string }
): Promise<string> {
  // Gather data
  const [monthlySummary, monthlyGoal, topProducts, timeSlotPerf, lastImprovement] = await Promise.all([
    getLiverMonthlySummaryV2(liverName).catch(() => null),
    getLiverMonthlyGoalByName(liverName).catch(() => null),
    getRecentTopProductsForLiver(liverName, 7, 3).catch(() => []),
    getSameTimeSlotPerformance(liverName, new Date(schedule.startTime.getTime() + 9 * 60 * 60 * 1000).getUTCHours()).catch(() => null),
    getLastImprovementPoint(liverName).catch(() => null),
  ]);

  const startTimeStr = schedule.startTime.toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo"
  });
  const endTimeStr = schedule.endTime
    ? schedule.endTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
    : null;

  // Calculate scheduled duration
  let scheduledHours = 2; // default
  if (schedule.endTime) {
    const diffMs = schedule.endTime.getTime() - schedule.startTime.getTime();
    scheduledHours = Math.round(diffMs / (1000 * 60 * 60) * 10) / 10;
    if (scheduledHours <= 0) scheduledHours = 2;
  }

  // Build message
  let msg = `🎯 配信前ブリーフィング\n━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${liverName}さん\n`;
  msg += `⏰ ${startTimeStr}${endTimeStr ? `〜${endTimeStr}` : ''} (${scheduledHours}時間)\n\n`;

  // Today's target
  const hourlyRate = monthlySummary?.current?.hourlyRate || monthlySummary?.prev?.hourlyRate || 0;
  if (hourlyRate > 0) {
    const todayTarget = Math.round(hourlyRate * scheduledHours);
    msg += `🎯 今日の目標:\n`;
    msg += `• 時間単価: ¥${hourlyRate.toLocaleString()}/h\n`;
    msg += `• 売上目安: ¥${todayTarget.toLocaleString()}\n`;
  }

  // Monthly goal progress
  if (monthlyGoal && monthlyGoal.salesGoal > 0) {
    const remaining = monthlyGoal.salesGoal - monthlyGoal.currentSales;
    if (remaining > 0) {
      msg += `• 月間目標: ¥${monthlyGoal.salesGoal.toLocaleString()} (達成${monthlyGoal.achievementRate}% / 残り¥${remaining.toLocaleString()})\n`;
    } else {
      msg += `• 月間目標: 🎉達成済み！(${monthlyGoal.achievementRate}%)\n`;
    }
  }

  // Same time slot comparison
  if (timeSlotPerf && timeSlotPerf.count >= 2) {
    msg += `\n📊 同時間帯の過去実績 (${timeSlotPerf.count}回平均):\n`;
    msg += `• 平均売上: ¥${timeSlotPerf.avgSales.toLocaleString()}\n`;
    msg += `• 平均時間単価: ¥${timeSlotPerf.avgHourlyRate.toLocaleString()}/h\n`;
    if (hourlyRate > 0 && timeSlotPerf.avgHourlyRate > 0) {
      const improvement = Math.round(((hourlyRate - timeSlotPerf.avgHourlyRate) / timeSlotPerf.avgHourlyRate) * 100);
      if (improvement > 0) {
        msg += `• 📈 今月は${improvement}%成長中！\n`;
      }
    }
  }

  // Recommended products
  if (topProducts.length > 0) {
    msg += `\n📦 推奨商品 (あなたの売れ筋):\n`;
    topProducts.slice(0, 3).forEach((p: any, i: number) => {
      const gmv = Number(p.totalGmv || 0);
      msg += `${i + 1}. ${p.productName}${gmv > 0 ? ` (¥${gmv.toLocaleString()})` : ''}\n`;
    });
  }

  // Last improvement point
  if (lastImprovement) {
    msg += `\n💡 前回の改善ポイント:\n${lastImprovement.slice(0, 150)}\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━\n`;
  msg += `💪 今日も最高の配信にしましょう！\n`;
  msg += `💬 相談 → https://lcjmall.com/liver/coach`;

  return msg;
}

/**
 * Build 5-minute-before message
 */
function buildFiveMinMessage(liverName: string, startTimeStr: string): string {
  return `⏰ まもなく配信開始！\n\n${liverName}さん、${startTimeStr}の配信まであと5分です！\n\n✅ カメラ・照明OK？\n✅ 商品の準備OK？\n✅ 笑顔の準備OK？\n\n今日も楽しい配信にしましょう🔥`;
}

/**
 * Main check function - runs every 5 minutes
 */
async function checkAndSendBriefings(): Promise<void> {
  try {
    const now = new Date();
    
    // 1. Check for 1-hour-before briefings (55-65 minutes before)
    const oneHourSchedules = await getUpcomingSchedules(65);
    
    for (const schedule of oneHourSchedules) {
      const minutesUntilStart = (schedule.startTime.getTime() - now.getTime()) / (60 * 1000);
      
      // 1h briefing: 55-65 minutes before
      if (minutesUntilStart >= 55 && minutesUntilStart <= 65) {
        const briefingKey = `${schedule.id}-1h`;
        if (sentBriefings.has(briefingKey)) continue;

        const liverName = schedule.liverName || schedule.title;
        const { lineUserId } = await getLiverLineUserId(liverName);
        
        if (!lineUserId) {
          console.log(`${LOG_PREFIX} No lineUserId for ${liverName}, skipping 1h briefing`);
          sentBriefings.set(briefingKey, now);
          continue;
        }

        console.log(`${LOG_PREFIX} Sending 1h briefing to ${liverName}...`);
        const message = await buildBriefingMessage(liverName, schedule);
        const success = await pushMessage(lineUserId, [{ type: "text", text: message }]);
        
        if (success) {
          console.log(`${LOG_PREFIX} ✅ 1h briefing sent to ${liverName}`);
        } else {
          console.error(`${LOG_PREFIX} ❌ Failed to send 1h briefing to ${liverName}`);
        }
        sentBriefings.set(briefingKey, now);
      }

      // 5-min message: 3-7 minutes before
      if (minutesUntilStart >= 3 && minutesUntilStart <= 7) {
        const fiveMinKey = `${schedule.id}-5m`;
        if (sentBriefings.has(fiveMinKey)) continue;

        const liverName = schedule.liverName || schedule.title;
        const { lineUserId } = await getLiverLineUserId(liverName);
        
        if (!lineUserId) {
          sentBriefings.set(fiveMinKey, now);
          continue;
        }

        const startTimeStr = schedule.startTime.toLocaleTimeString("ja-JP", {
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo"
        });

        console.log(`${LOG_PREFIX} Sending 5min reminder to ${liverName}...`);
        const message = buildFiveMinMessage(liverName, startTimeStr);
        const success = await pushMessage(lineUserId, [{ type: "text", text: message }]);
        
        if (success) {
          console.log(`${LOG_PREFIX} ✅ 5min reminder sent to ${liverName}`);
        } else {
          console.error(`${LOG_PREFIX} ❌ Failed to send 5min reminder to ${liverName}`);
        }
        sentBriefings.set(fiveMinKey, now);
      }
    }

    // Clean up old entries (older than 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const [key, sentAt] of sentBriefings) {
      if (sentAt < oneDayAgo) sentBriefings.delete(key);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in checkAndSendBriefings:`, error);
  }
}

/**
 * Start the pre-briefing scheduler
 * Runs every 5 minutes
 */
export function startPreBriefingScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (every 5 minutes)`);

  // Run immediately
  checkAndSendBriefings();

  // Then every 5 minutes
  schedulerIntervalId = setInterval(checkAndSendBriefings, 5 * 60 * 1000);
}

export function stopPreBriefingScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
