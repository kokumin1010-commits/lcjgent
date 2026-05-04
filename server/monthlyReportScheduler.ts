/**
 * 月次レポート自動送信スケジューラー
 * 
 * 毎月1日 JST 09:00 に全ライバーの先月の配信レポートを生成し、
 * LINEグループ＆個人DMに送信する。
 * 
 * 内容:
 * - 月間売上・前月比・目標達成率
 * - 配信データ（回数・時間・時間単価・CVR）
 * - ブランド別実績（前月比付き）
 * - 成長トレンド（過去4ヶ月の時間単価推移）
 * - ベスト配信TOP3
 * - AIコーチング（月間総評）
 * - 神コーチリンク（URLパラメータ付き）
 */
import { getDb } from "./db";
import { brandLivestreams, livers, lineGroups, brands, liverGoals } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { pushMessage } from "./line";

const LOG_PREFIX = "[Monthly Report]";

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

interface MonthlyLiverData {
  liverId: number;
  liverName: string;
  lineUserId: string | null;
  totalSales: number;
  streamCount: number;
  totalDuration: number; // minutes
  totalViewers: number;
  totalOrders: number;
  hourlyRate: number;
  avgCVR: number;
  brandBreakdown: Array<{ brandName: string; sales: number; percentage: number }>;
  topStreams: Array<{ date: string; sales: number; cvr: number }>;
}

interface PreviousMonthData {
  totalSales: number;
  streamCount: number;
  totalDuration: number;
  hourlyRate: number;
  avgCVR: number;
  brandBreakdown: Map<string, number>;
}

/**
 * Get all active livers
 */
async function getActiveLivers(db: any) {
  return await db
    .select({ id: livers.id, name: livers.name, lineUserId: livers.lineUserId })
    .from(livers)
    .where(eq(livers.isActive, true));
}

/**
 * Get monthly data for a liver
 */
async function getMonthlyData(db: any, liverId: number, liverName: string, year: number, month: number): Promise<MonthlyLiverData | null> {
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0); // Last day of month

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
  const avgCVR = totalViewers > 0 ? (totalOrders / totalViewers) * 100 : 0;

  // Brand breakdown
  const brandMap = new Map<string, number>();
  streams.forEach((s: any) => {
    const bName = s.brandName || '不明';
    const sales = Number(s.salesAmount) || Number(s.gmv) || 0;
    brandMap.set(bName, (brandMap.get(bName) || 0) + sales);
  });
  const brandBreakdown = Array.from(brandMap.entries())
    .map(([brandName, sales]) => ({ brandName, sales, percentage: totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0 }))
    .sort((a, b) => b.sales - a.sales);

  // Top 3 streams
  const streamSales = streams.map((s: any) => ({
    date: new Date(s.livestreamDate).toLocaleDateString('ja-JP'),
    sales: Number(s.salesAmount) || Number(s.gmv) || 0,
    cvr: Number(s.viewerCount) > 0 ? ((Number(s.orderCount) || 0) / Number(s.viewerCount)) * 100 : 0,
  })).sort((a: any, b: any) => b.sales - a.sales).slice(0, 3);

  return {
    liverId, liverName, lineUserId: null,
    totalSales, streamCount: streams.length, totalDuration, totalViewers, totalOrders,
    hourlyRate, avgCVR, brandBreakdown, topStreams: streamSales,
  };
}

/**
 * Get previous month data for comparison
 */
async function getPreviousMonthData(db: any, liverId: number, year: number, month: number): Promise<PreviousMonthData> {
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0);

  const streams = await db
    .select({
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      duration: brandLivestreams.duration,
      viewerCount: brandLivestreams.viewerCount,
      orderCount: brandLivestreams.orderCount,
      brandName: brands.name,
    })
    .from(brandLivestreams)
    .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, fromDate.toISOString().split('T')[0]),
      lte(brandLivestreams.livestreamDate, toDate.toISOString().split('T')[0]),
    ));

  const totalSales = streams.reduce((sum: number, s: any) => sum + (Number(s.salesAmount) || Number(s.gmv) || 0), 0);
  const totalDuration = streams.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0);
  const totalViewers = streams.reduce((sum: number, s: any) => sum + (Number(s.viewerCount) || 0), 0);
  const totalOrders = streams.reduce((sum: number, s: any) => sum + (Number(s.orderCount) || 0), 0);
  const hourlyRate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;
  const avgCVR = totalViewers > 0 ? (totalOrders / totalViewers) * 100 : 0;

  const brandBreakdown = new Map<string, number>();
  streams.forEach((s: any) => {
    const bName = s.brandName || '不明';
    const sales = Number(s.salesAmount) || Number(s.gmv) || 0;
    brandBreakdown.set(bName, (brandBreakdown.get(bName) || 0) + sales);
  });

  return { totalSales, streamCount: streams.length, totalDuration, hourlyRate, avgCVR, brandBreakdown };
}

/**
 * Get hourly rate trend for past 4 months
 */
async function getHourlyRateTrend(db: any, liverId: number, currentYear: number, currentMonth: number): Promise<Array<{ month: string; rate: number }>> {
  const trend: Array<{ month: string; rate: number }> = [];
  
  for (let i = 3; i >= 0; i--) {
    let y = currentYear;
    let m = currentMonth - i;
    if (m <= 0) { m += 12; y--; }
    
    const fromDate = new Date(y, m - 1, 1);
    const toDate = new Date(y, m, 0);
    
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
    const rate = totalDuration > 0 ? Math.round(totalSales / (totalDuration / 60)) : 0;
    
    trend.push({ month: `${m}月`, rate });
  }
  
  return trend;
}

/**
 * Build monthly report message
 */
function buildMonthlyReportMessage(
  data: MonthlyLiverData,
  prevMonth: PreviousMonthData,
  trend: Array<{ month: string; rate: number }>,
  monthlyGoal: { targetAmount: number; currentSales: number; achievementRate: number } | null,
  monthStr: string,
): string {
  let msg = `📊 月間レポート（${monthStr}）\n━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `🎉 ${data.liverName}さん、今月もお疲れ様でした！\n\n`;

  // Sales summary
  msg += `━━ 売上サマリー ━━\n`;
  msg += `💰 月間売上: ¥${data.totalSales.toLocaleString()}\n`;
  if (prevMonth.totalSales > 0) {
    const diff = data.totalSales - prevMonth.totalSales;
    const diffPercent = Math.round((diff / prevMonth.totalSales) * 100);
    msg += `📈 前月比: ${diff >= 0 ? '+' : ''}¥${diff.toLocaleString()} (${diff >= 0 ? '+' : ''}${diffPercent}%${diff >= 0 ? '↑' : '↓'})\n`;
  }
  if (monthlyGoal && monthlyGoal.targetAmount > 0) {
    msg += `🎯 目標達成率: ${monthlyGoal.achievementRate}% (目標¥${monthlyGoal.targetAmount.toLocaleString()})\n`;
  }

  // Stream data
  msg += `\n━━ 配信データ ━━\n`;
  msg += `⏱️ 配信回数: ${data.streamCount}回 / 合計${(data.totalDuration / 60).toFixed(1)}時間\n`;
  msg += `📊 平均時間単価: ¥${data.hourlyRate.toLocaleString()}/h`;
  if (prevMonth.hourlyRate > 0) {
    const hrDiff = Math.round(((data.hourlyRate - prevMonth.hourlyRate) / prevMonth.hourlyRate) * 100);
    msg += ` (前月: ¥${prevMonth.hourlyRate.toLocaleString()}/h → ${hrDiff >= 0 ? '+' : ''}${hrDiff}%${hrDiff >= 0 ? '↑' : '↓'})`;
  }
  msg += `\n`;
  if (data.totalOrders > 0) {
    msg += `🛒 注文数合計: ${data.totalOrders}件\n`;
  }
  if (data.totalViewers > 0) {
    msg += `👀 累計視聴者: ${data.totalViewers.toLocaleString()}人\n`;
  }
  if (data.avgCVR > 0) {
    msg += `📊 平均CVR: ${data.avgCVR.toFixed(2)}%`;
    if (prevMonth.avgCVR > 0) {
      const cvrDiff = Math.round(((data.avgCVR - prevMonth.avgCVR) / prevMonth.avgCVR) * 100);
      msg += ` (前月: ${prevMonth.avgCVR.toFixed(2)}% → ${cvrDiff >= 0 ? '+' : ''}${cvrDiff}%${cvrDiff >= 0 ? '↑' : '↓'})`;
    }
    msg += `\n`;
  }

  // Brand breakdown with prev month comparison
  if (data.brandBreakdown.length > 0) {
    msg += `\n━━ ブランド別実績 ━━\n`;
    data.brandBreakdown.slice(0, 5).forEach((b, i) => {
      msg += `${i + 1}. ${b.brandName}: ¥${b.sales.toLocaleString()} (${b.percentage}%)`;
      const prevBrandSales = prevMonth.brandBreakdown.get(b.brandName);
      if (prevBrandSales && prevBrandSales > 0) {
        const bDiff = Math.round(((b.sales - prevBrandSales) / prevBrandSales) * 100);
        msg += ` [前月比${bDiff >= 0 ? '+' : ''}${bDiff}%]`;
      }
      msg += `\n`;
    });
  }

  // Growth trend
  if (trend.length > 0 && trend.some(t => t.rate > 0)) {
    msg += `\n━━ 成長トレンド ━━\n`;
    msg += `📈 時間単価推移:\n  `;
    const trendParts = trend.filter(t => t.rate > 0).map(t => `${t.month}: ¥${t.rate.toLocaleString()}`);
    msg += trendParts.join(' → ');
    if (trend.length >= 2) {
      const first = trend.find(t => t.rate > 0);
      const last = trend[trend.length - 1];
      if (first && last.rate > 0 && first.rate > 0) {
        const growth = Math.round(((last.rate - first.rate) / first.rate) * 100);
        if (growth > 0) msg += `\n  → ${trend.length}ヶ月で+${growth}%成長！🔥`;
      }
    }
    msg += `\n`;
  }

  // Top 3 streams
  if (data.topStreams.length > 0) {
    msg += `\n━━ ベスト配信 TOP3 ━━\n`;
    const medals = ['🥇', '🥈', '🥉'];
    data.topStreams.forEach((s, i) => {
      msg += `${medals[i]} ${s.date}: ¥${s.sales.toLocaleString()}`;
      if (s.cvr > 0) msg += ` (CVR ${s.cvr.toFixed(1)}%)`;
      msg += `\n`;
    });
  }

  // Coach link
  msg += `\n━━━━━━━━━━━━━━━━━━\n`;
  msg += `💬 今月の振り返り・来月の戦略を相談しよう\n`;
  msg += `👇 神コーチに聞いてみよう\n`;
  msg += `https://lcjmall.com/liver/coach?context=monthly&month=${monthStr}`;

  return msg;
}

/**
 * Run monthly report for all livers
 */
export async function runMonthlyReport(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error(`${LOG_PREFIX} DB not available`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting monthly report generation...`);

  // Last month
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  let reportYear = jstNow.getFullYear();
  let reportMonth = jstNow.getMonth(); // 0-indexed, so this is last month
  if (reportMonth === 0) { reportMonth = 12; reportYear--; }
  
  // Previous month for comparison
  let prevYear = reportYear;
  let prevMonth = reportMonth - 1;
  if (prevMonth <= 0) { prevMonth += 12; prevYear--; }

  const monthStr = `${reportYear}年${reportMonth}月`;
  console.log(`${LOG_PREFIX} Report for: ${monthStr}`);

  // Get target LINE group
  const groups = await db.select().from(lineGroups);
  const targetGroup = groups.find((g: any) => g.groupName?.includes('ライバー') || g.groupName?.includes('連絡'));

  // Get all active livers
  const activeLivers = await getActiveLivers(db);
  console.log(`${LOG_PREFIX} Found ${activeLivers.length} active livers`);

  let sentCount = 0;

  for (const liver of activeLivers) {
    try {
      const monthlyData = await getMonthlyData(db, liver.id, liver.name, reportYear, reportMonth);
      if (!monthlyData) {
        console.log(`${LOG_PREFIX} No data for ${liver.name}, skipping`);
        continue;
      }

      monthlyData.lineUserId = liver.lineUserId;

      const prevMonthData = await getPreviousMonthData(db, liver.id, prevYear, prevMonth);
      const trend = await getHourlyRateTrend(db, liver.id, reportYear, reportMonth);

      // Get monthly goal
      let monthlyGoal = null;
      try {
        const goalResult = await db
          .select()
          .from(liverGoals)
          .where(and(
            eq(liverGoals.liverName, liver.name),
            eq(liverGoals.year, reportYear),
            eq(liverGoals.month, reportMonth),
          ))
          .limit(1);
        if (goalResult.length > 0) {
          const g = goalResult[0];
          const targetAmount = Number(g.targetAmount) || 0;
          monthlyGoal = {
            targetAmount,
            currentSales: monthlyData.totalSales,
            achievementRate: targetAmount > 0 ? Math.round((monthlyData.totalSales / targetAmount) * 100) : 0,
          };
        }
      } catch (e) {}

      const reportMessage = buildMonthlyReportMessage(monthlyData, prevMonthData, trend, monthlyGoal, monthStr);

      // Send to group
      if (targetGroup) {
        await pushMessage(targetGroup.lineGroupId, [{ type: "text", text: reportMessage }]);
      }

      // Send DM
      if (liver.lineUserId) {
        await pushMessage(liver.lineUserId, [{ type: "text", text: reportMessage }]);
      }

      sentCount++;
      console.log(`${LOG_PREFIX} ✅ Sent report for ${liver.name} (¥${monthlyData.totalSales.toLocaleString()})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`${LOG_PREFIX} ❌ Error for ${liver.name}: ${error.message}`);
    }
  }

  console.log(`${LOG_PREFIX} Monthly report complete. Sent ${sentCount}/${activeLivers.length} reports.`);
}

/**
 * Start the monthly report scheduler
 * Runs on the 1st of each month at JST 09:00
 */
export function startMonthlyReportScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (monthly 1st at JST 09:00)`);

  let lastRunMonth = "";

  // Check every 30 minutes
  const CHECK_INTERVAL = 30 * 60 * 1000;

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const jstHour = jstNow.getUTCHours();
      const jstDate = jstNow.getDate();
      const monthKey = `${jstNow.getFullYear()}-${jstNow.getMonth() + 1}`;

      // Run on 1st of month at JST 9:00
      const currentJstHour = (now.getUTCHours() + 9) % 24;
      if (jstDate === 1 && currentJstHour === 9 && lastRunMonth !== monthKey) {
        console.log(`${LOG_PREFIX} It's the 1st at JST 09:00 - running monthly report...`);
        lastRunMonth = monthKey;
        await runMonthlyReport();
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduler check error:`, error);
    }
  }, CHECK_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopMonthlyReportScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
