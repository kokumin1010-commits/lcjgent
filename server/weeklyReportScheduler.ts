/**
 * 週次レポート自動送信スケジューラー
 * 
 * 毎週月曜 JST 09:00 に全ライバーの先週の配信レポートを生成し、
 * LINEグループ＆個人DMに送信する。
 * 
 * 内容:
 * - 先週の売上合計・配信回数・時間単価・前週比
 * - ブランド別実績
 * - 月間目標進捗
 * - AIコーチング（週間総評）
 * - 神コーチリンク（URLパラメータ付き）
 */
import { getDb } from "./db";
import { brandLivestreams, livers, lineGroups, brands, aiCoachMessages, aiCoachRooms } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, isNull } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { pushMessage } from "./line";
import { getLiverMonthlyGoalByName } from "./db";
import { runSkillAnalysis, formatSkillAnalysisMessage } from "./liverSkillAnalysis";

/** Save message to ai_coach_messages for history tracking */
async function saveToHistory(db: any, liverId: number, content: string, messageType: string): Promise<void> {
  try {
    const rooms = await db.select({ id: aiCoachRooms.id }).from(aiCoachRooms)
      .where(and(eq(aiCoachRooms.liverId, liverId), isNull(aiCoachRooms.deletedAt)))
      .orderBy(desc(aiCoachRooms.lastMessageAt)).limit(1);
    const roomId = rooms.length > 0 ? rooms[0].id : null;
    await db.insert(aiCoachMessages).values({
      liverId, roomId, role: 'ai', content, messageType, contextType: 'livestream',
      metadata: { type: messageType },
    });
  } catch (e: any) {
    console.error(`[WeeklyReport] Failed to save to history: ${e.message}`);
  }
}

const LOG_PREFIX = "[Weekly Report]";

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

interface WeeklyLiverData {
  liverId: number;
  liverName: string;
  lineUserId: string | null;
  totalSales: number;
  streamCount: number;
  totalDuration: number; // minutes
  totalViewers: number;
  totalOrders: number;
  hourlyRate: number;
  brandBreakdown: Array<{ brandName: string; sales: number; percentage: number }>;
  bestStream: { date: string; sales: number } | null;
}

interface PreviousWeekData {
  totalSales: number;
  streamCount: number;
  totalDuration: number;
  hourlyRate: number;
}

/**
 * Get all active livers with LINE user IDs
 */
async function getActiveLivers(db: any) {
  const results = await db
    .select({
      id: livers.id,
      name: livers.name,
      lineUserId: livers.lineUserId,
    })
    .from(livers)
    .where(eq(livers.isActive, true));
  return results;
}

/**
 * Get weekly data for a specific liver
 */
async function getWeeklyData(db: any, liverId: number, liverName: string, fromDate: Date, toDate: Date): Promise<WeeklyLiverData | null> {
  // Get all livestreams for this liver in the date range
  const streams = await db
    .select({
      id: brandLivestreams.id,
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      duration: brandLivestreams.duration,
      viewerCount: brandLivestreams.viewerCount,
      orderCount: brandLivestreams.orderCount,
      livestreamDate: brandLivestreams.livestreamDate,
      brandId: brandLivestreams.brandId,
      brandName: brands.name,
    })
    .from(brandLivestreams)
    .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, fromDate.toISOString().split('T')[0]),
      lte(brandLivestreams.livestreamDate, toDate.toISOString().split('T')[0]),
    ));

  if (streams.length === 0) return null;

  const totalSales = streams.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || Number(s.gmv) || 0), 0);
  const totalDuration = streams.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0);
  const totalViewers = streams.reduce((sum: number, s: any) => sum + (Number(s.viewerCount) || 0), 0);
  const totalOrders = streams.reduce((sum: number, s: any) => sum + (Number(s.orderCount) || 0), 0);
  const hourlyRate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;

  // Brand breakdown
  const brandMap = new Map<string, number>();
  streams.forEach((s: any) => {
    const bName = s.brandName || '不明';
    const sales = Number(s.salesAmount) || Number(s.gmv) || 0;
    brandMap.set(bName, (brandMap.get(bName) || 0) + sales);
  });
  const brandBreakdown = Array.from(brandMap.entries())
    .map(([brandName, sales]) => ({
      brandName,
      sales,
      percentage: totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  // Best stream
  const bestStream = streams.reduce((best: any, s: any) => {
    const sales = Number(s.salesAmount) || Number(s.gmv) || 0;
    if (!best || sales > best.sales) {
      return { date: s.livestreamDate, sales };
    }
    return best;
  }, null);

  return {
    liverId,
    liverName,
    lineUserId: null, // Will be set later
    totalSales,
    streamCount: streams.length,
    totalDuration,
    totalViewers,
    totalOrders,
    hourlyRate,
    brandBreakdown,
    bestStream: bestStream ? { date: new Date(bestStream.date).toLocaleDateString('ja-JP'), sales: bestStream.sales } : null,
  };
}

/**
 * Get previous week data for comparison
 */
async function getPreviousWeekData(db: any, liverId: number, fromDate: Date, toDate: Date): Promise<PreviousWeekData> {
  const streams = await db
    .select({
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      duration: brandLivestreams.duration,
    })
    .from(brandLivestreams)
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, fromDate.toISOString().split('T')[0]),
      lte(brandLivestreams.livestreamDate, toDate.toISOString().split('T')[0]),
    ));

  const totalSales = streams.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || Number(s.gmv) || 0), 0);
  const totalDuration = streams.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0);
  const hourlyRate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;

  return { totalSales, streamCount: streams.length, totalDuration, hourlyRate };
}

/**
 * Build weekly report message
 */
function buildWeeklyReportMessage(
  data: WeeklyLiverData,
  prevWeek: PreviousWeekData,
  monthlyGoal: { targetAmount: number; currentSales: number; achievementRate: number } | null,
  fromDateStr: string,
  toDateStr: string,
): string {
  let msg = `📊 週間レポート（${fromDateStr}〜${toDateStr}）\n━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `🎉 ${data.liverName}さん、今週もお疲れ様でした！\n\n`;
  
  // Sales summary with comparison
  msg += `💰 今週の売上合計: ¥${data.totalSales.toLocaleString()}\n`;
  if (prevWeek.totalSales > 0) {
    const diff = data.totalSales - prevWeek.totalSales;
    const diffPercent = Math.round((diff / prevWeek.totalSales) * 100);
    const arrow = diff >= 0 ? '↑' : '↓';
    msg += `📈 先週比: ${diff >= 0 ? '+' : ''}¥${diff.toLocaleString()} (${diff >= 0 ? '+' : ''}${diffPercent}%${arrow})\n`;
  }
  
  msg += `⏱️ 配信回数: ${data.streamCount}回 / 合計${(data.totalDuration / 60).toFixed(1)}時間\n`;
  msg += `📊 時間単価: ¥${data.hourlyRate.toLocaleString()}/h`;
  if (prevWeek.hourlyRate > 0) {
    const hrDiff = Math.round(((data.hourlyRate - prevWeek.hourlyRate) / prevWeek.hourlyRate) * 100);
    msg += ` (先週: ¥${prevWeek.hourlyRate.toLocaleString()}/h → ${hrDiff >= 0 ? '+' : ''}${hrDiff}%${hrDiff >= 0 ? '↑' : '↓'})`;
  }
  msg += `\n`;
  
  if (data.totalOrders > 0) {
    const cvr = data.totalViewers > 0 ? ((data.totalOrders / data.totalViewers) * 100).toFixed(2) : '0';
    msg += `🛒 注文数合計: ${data.totalOrders}件 / 平均CVR: ${cvr}%\n`;
  }
  if (data.totalViewers > 0) {
    msg += `👀 累計視聴者: ${data.totalViewers.toLocaleString()}人\n`;
  }

  // Brand breakdown
  if (data.brandBreakdown.length > 0) {
    msg += `\n📦 ブランド別（今週）:\n`;
    data.brandBreakdown.slice(0, 5).forEach(b => {
      msg += `・${b.brandName}: ¥${b.sales.toLocaleString()} (${b.percentage}%)\n`;
    });
  }

  // Best stream
  if (data.bestStream) {
    msg += `\n🏆 今週のベスト配信:\n`;
    msg += `・${data.bestStream.date}: ¥${data.bestStream.sales.toLocaleString()}\n`;
  }

  // Monthly goal progress
  if (monthlyGoal && monthlyGoal.targetAmount > 0) {
    msg += `\n🎯 月間目標進捗:\n`;
    msg += `  目標: ¥${monthlyGoal.targetAmount.toLocaleString()}\n`;
    msg += `  達成: ¥${monthlyGoal.currentSales.toLocaleString()} (${monthlyGoal.achievementRate}%)\n`;
    msg += `  残り: ¥${(monthlyGoal.targetAmount - monthlyGoal.currentSales).toLocaleString()}\n`;
  }

  // Coach link
  msg += `\n━━━━━━━━━━━━━━━━━━\n`;
  msg += `💬 もっと詳しく振り返りたい？\n`;
  msg += `👇 神コーチに相談する\n`;
  msg += `https://lcjmall.com/liver/coach?context=weekly&from=${fromDateStr}&to=${toDateStr}`;

  return msg;
}

/**
 * Run weekly report for all livers
 */
export async function runWeeklyReport(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error(`${LOG_PREFIX} DB not available`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting weekly report generation...`);

  // Calculate date range (last week: Monday to Sunday)
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const lastMonday = new Date(jstNow);
  lastMonday.setDate(jstNow.getDate() - jstNow.getDay() - 6); // Last Monday
  lastMonday.setHours(0, 0, 0, 0);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  // Previous week for comparison
  const prevMonday = new Date(lastMonday);
  prevMonday.setDate(lastMonday.getDate() - 7);
  const prevSunday = new Date(lastMonday);
  prevSunday.setDate(lastMonday.getDate() - 1);

  const fromDateStr = `${lastMonday.getMonth() + 1}/${lastMonday.getDate()}`;
  const toDateStr = `${lastSunday.getMonth() + 1}/${lastSunday.getDate()}`;

  console.log(`${LOG_PREFIX} Report period: ${fromDateStr}〜${toDateStr}`);

  // Get target LINE group
  const groups = await db.select().from(lineGroups);
  const targetGroup = groups.find((g: any) => g.groupName?.includes('ライバー') || g.groupName?.includes('連絡'));

  // Get all active livers
  const activeLivers = await getActiveLivers(db);
  console.log(`${LOG_PREFIX} Found ${activeLivers.length} active livers`);

  let sentCount = 0;

  for (const liver of activeLivers) {
    try {
      const weeklyData = await getWeeklyData(db, liver.id, liver.name, lastMonday, lastSunday);
      if (!weeklyData) {
        console.log(`${LOG_PREFIX} No data for ${liver.name}, skipping`);
        continue;
      }

      weeklyData.lineUserId = liver.lineUserId;

      const prevWeekData = await getPreviousWeekData(db, liver.id, prevMonday, prevSunday);
      
      // Get monthly goal
      let monthlyGoal = null;
      try {
        monthlyGoal = await getLiverMonthlyGoalByName(liver.name);
      } catch (e) {}

      const reportMessage = buildWeeklyReportMessage(weeklyData, prevWeekData, monthlyGoal, fromDateStr, toDateStr);

      // Send to group
      if (targetGroup) {
        await pushMessage(targetGroup.lineGroupId, [{ type: "text", text: reportMessage }]);
      }

      // Send DM with skill analysis
      if (liver.lineUserId) {
        await pushMessage(liver.lineUserId, [{ type: "text", text: reportMessage }]);
        // Save weekly report to history
        await saveToHistory(db, liver.id, reportMessage, 'weekly_report');
        
        // Send skill analysis as separate DM (personal insights)
        try {
          const skillAnalysis = await runSkillAnalysis(liver.name);
          if (skillAnalysis && skillAnalysis.insights.length > 0) {
            const skillMsg = formatSkillAnalysisMessage(skillAnalysis);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await pushMessage(liver.lineUserId, [{ type: "text", text: skillMsg }]);
            // Save skill analysis to history
            await saveToHistory(db, liver.id, skillMsg, 'skill_analysis');
            console.log(`${LOG_PREFIX} ✅ Skill analysis sent to ${liver.name}`);
          }
        } catch (skillErr: any) {
          console.error(`${LOG_PREFIX} Skill analysis error for ${liver.name}: ${skillErr.message}`);
        }
      }

      sentCount++;
      console.log(`${LOG_PREFIX} ✅ Sent report for ${liver.name} (¥${weeklyData.totalSales.toLocaleString()})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`${LOG_PREFIX} ❌ Error for ${liver.name}: ${error.message}`);
    }
  }

  console.log(`${LOG_PREFIX} Weekly report complete. Sent ${sentCount}/${activeLivers.length} reports.`);
}

/**
 * Check if current time matches target (JST)
 */
function isTargetTime(targetHour: number, targetDayOfWeek: number): boolean {
  const now = new Date();
  const jstHour = (now.getUTCHours() + 9) % 24;
  const jstDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getDay();
  return jstHour === targetHour && jstDay === targetDayOfWeek;
}

/**
 * Start the weekly report scheduler
 * Runs every Monday at JST 09:00
 */
export function startWeeklyReportScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (weekly Monday at JST 09:00)`);

  let lastRunWeek = "";

  // Check every 30 minutes
  const CHECK_INTERVAL = 30 * 60 * 1000;

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const weekKey = `${jstNow.getFullYear()}-W${Math.ceil((jstNow.getDate() + new Date(jstNow.getFullYear(), jstNow.getMonth(), 1).getDay()) / 7)}`;

      // Run on Monday at JST 9:00, only once per week
      if (isTargetTime(9, 1) && lastRunWeek !== weekKey) {
        console.log(`${LOG_PREFIX} It's Monday JST 09:00 - running weekly report...`);
        lastRunWeek = weekKey;
        await runWeeklyReport();
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduler check error:`, error);
    }
  }, CHECK_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopWeeklyReportScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
