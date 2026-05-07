/**
 * デイリーランキング自動送信スケジューラー
 * 
 * 毎日 JST 00:00（深夜0時）にその日の配信実績を集計し、
 * LINEグループ「LCJ所属連絡網」にランキングを自動投稿。
 * 
 * 含む情報:
 * - 売上ランキング（全員）
 * - 時間単価ランキング（全員）
 * - MVP選出
 * - 週間累計ランキング
 * - アチーブメント（連続1位、自己ベスト更新、チーム新記録等）
 * - チームサマリー（合計売上、総配信時間、配信人数、前日比）
 * - 未配信者リスト
 */
import { getDb } from "./db";
import { brandLivestreams, livers, lineGroups } from "../drizzle/schema";
import { pushMessage } from "./line";
import { eq, and, gte, lte, isNull, like, desc, sql } from "drizzle-orm";

const LOG_PREFIX = "[DailyRanking]";
const TARGET_GROUP_KEYWORDS = ["所属連絡網", "LCJ所属"];

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

// ========== Types ==========
interface LivestreamRecord {
  id: number;
  streamerName: string;
  liverId: number | null;
  salesAmount: number | null;
  duration: number | null; // minutes
  livestreamDate: Date;
}

interface RankedLiver {
  name: string;
  liverId: number | null;
  totalSales: number;
  totalDuration: number; // minutes
  hourlyRate: number; // yen per hour
  sessionCount: number;
}

interface WeeklyRanked {
  name: string;
  totalSales: number;
}

interface Achievement {
  emoji: string;
  text: string;
}

// ========== Helper Functions ==========

function getJSTDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatJSTDate(date: Date): string {
  const jst = getJSTDate(date);
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[jst.getUTCDay()];
  return `${month}/${day}（${weekday}）`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}m`;
}

function formatYen(amount: number): string {
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    if (remainder === 0) return `¥${man}万`;
    return `¥${amount.toLocaleString()}`;
  }
  return `¥${amount.toLocaleString()}`;
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `${rank}.`;
  }
}

// ========== Data Fetching ==========

async function findTargetLineGroup(): Promise<{ lineGroupId: string; groupName: string } | null> {
  const db = await getDb();
  if (!db) return null;

  for (const keyword of TARGET_GROUP_KEYWORDS) {
    const groups = await db
      .select({
        lineGroupId: lineGroups.lineGroupId,
        groupName: lineGroups.groupName,
      })
      .from(lineGroups)
      .where(and(
        like(lineGroups.groupName, `%${keyword}%`),
        eq(lineGroups.isActive, true)
      ))
      .limit(1);

    if (groups.length > 0) {
      return groups[0] as { lineGroupId: string; groupName: string };
    }
  }
  return null;
}

/**
 * Get today's livestream records (JST date)
 */
async function getTodayLivestreams(): Promise<LivestreamRecord[]> {
  const db = await getDb();
  if (!db) return [];

  // Get JST today boundaries
  const now = new Date();
  const jstNow = getJSTDate(now);
  const todayStr = jstNow.toISOString().split('T')[0]; // YYYY-MM-DD in JST
  
  // Convert JST day boundaries to UTC
  const jstDayStart = new Date(`${todayStr}T00:00:00+09:00`);
  const jstDayEnd = new Date(`${todayStr}T23:59:59+09:00`);

  const records = await db
    .select({
      id: brandLivestreams.id,
      streamerName: brandLivestreams.streamerName,
      liverId: brandLivestreams.liverId,
      salesAmount: brandLivestreams.salesAmount,
      duration: brandLivestreams.duration,
      livestreamDate: brandLivestreams.livestreamDate,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, jstDayStart),
      lte(brandLivestreams.livestreamDate, jstDayEnd),
      isNull(brandLivestreams.deletedAt)
    ))
    .orderBy(desc(brandLivestreams.salesAmount));

  return records;
}

/**
 * Get this week's livestream records (Monday to today, JST)
 */
async function getWeekLivestreams(): Promise<LivestreamRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const jstNow = getJSTDate(now);
  
  // Find Monday of this week (JST)
  const dayOfWeek = jstNow.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(jstNow);
  monday.setUTCDate(monday.getUTCDate() - daysToMonday);
  const mondayStr = monday.toISOString().split('T')[0];
  const todayStr = jstNow.toISOString().split('T')[0];
  
  const weekStart = new Date(`${mondayStr}T00:00:00+09:00`);
  const weekEnd = new Date(`${todayStr}T23:59:59+09:00`);

  const records = await db
    .select({
      id: brandLivestreams.id,
      streamerName: brandLivestreams.streamerName,
      liverId: brandLivestreams.liverId,
      salesAmount: brandLivestreams.salesAmount,
      duration: brandLivestreams.duration,
      livestreamDate: brandLivestreams.livestreamDate,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, weekStart),
      lte(brandLivestreams.livestreamDate, weekEnd),
      isNull(brandLivestreams.deletedAt)
    ));

  return records;
}

/**
 * Get yesterday's livestream records for comparison
 */
async function getYesterdayLivestreams(): Promise<LivestreamRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const jstNow = getJSTDate(now);
  const yesterday = new Date(jstNow);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const dayStart = new Date(`${yesterdayStr}T00:00:00+09:00`);
  const dayEnd = new Date(`${yesterdayStr}T23:59:59+09:00`);

  const records = await db
    .select({
      id: brandLivestreams.id,
      streamerName: brandLivestreams.streamerName,
      liverId: brandLivestreams.liverId,
      salesAmount: brandLivestreams.salesAmount,
      duration: brandLivestreams.duration,
      livestreamDate: brandLivestreams.livestreamDate,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, dayStart),
      lte(brandLivestreams.livestreamDate, dayEnd),
      isNull(brandLivestreams.deletedAt)
    ));

  return records;
}

/**
 * Get all active livers
 */
async function getAllActiveLivers(): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ id: livers.id, name: livers.name })
    .from(livers)
    .where(eq(livers.isActive, true));

  return result;
}

/**
 * Get historical daily sales records for a streamer (for consecutive wins & personal bests)
 */
async function getStreamerHistory(streamerName: string, days: number = 30): Promise<{ date: string; totalSales: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const jstNow = getJSTDate(now);
  const startDate = new Date(jstNow);
  startDate.setUTCDate(startDate.getUTCDate() - days);
  const startStr = startDate.toISOString().split('T')[0];
  const startUtc = new Date(`${startStr}T00:00:00+09:00`);

  const records = await db
    .select({
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      streamerName: brandLivestreams.streamerName,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, startUtc),
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.streamerName, streamerName)
    ))
    .orderBy(desc(brandLivestreams.livestreamDate));

  // Group by JST date
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    const jstDate = getJSTDate(r.livestreamDate);
    const dateStr = jstDate.toISOString().split('T')[0];
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + (r.salesAmount || 0));
  }

  return Array.from(dailyMap.entries())
    .map(([date, totalSales]) => ({ date, totalSales }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get historical daily #1 winners (for consecutive win tracking)
 */
async function getDailyWinners(days: number = 30): Promise<Map<string, string>> {
  const db = await getDb();
  if (!db) return new Map();

  const now = new Date();
  const jstNow = getJSTDate(now);
  const startDate = new Date(jstNow);
  startDate.setUTCDate(startDate.getUTCDate() - days);
  const startStr = startDate.toISOString().split('T')[0];
  const startUtc = new Date(`${startStr}T00:00:00+09:00`);

  const records = await db
    .select({
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      streamerName: brandLivestreams.streamerName,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, startUtc),
      isNull(brandLivestreams.deletedAt)
    ));

  // Group by JST date, find winner for each day
  const dailyData = new Map<string, Map<string, number>>();
  for (const r of records) {
    const jstDate = getJSTDate(r.livestreamDate);
    const dateStr = jstDate.toISOString().split('T')[0];
    if (!dailyData.has(dateStr)) dailyData.set(dateStr, new Map());
    const dayMap = dailyData.get(dateStr)!;
    dayMap.set(r.streamerName, (dayMap.get(r.streamerName) || 0) + (r.salesAmount || 0));
  }

  const winners = new Map<string, string>();
  for (const [date, dayMap] of dailyData) {
    let maxSales = 0;
    let winner = "";
    for (const [name, sales] of dayMap) {
      if (sales > maxSales) {
        maxSales = sales;
        winner = name;
      }
    }
    if (winner) winners.set(date, winner);
  }

  return winners;
}

/**
 * Get all-time team daily total record
 */
async function getTeamDailyRecord(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get all records, group by JST date, find max daily total
  const now = new Date();
  const jstNow = getJSTDate(now);
  const startDate = new Date(jstNow);
  startDate.setUTCDate(startDate.getUTCDate() - 90); // Look back 90 days
  const startStr = startDate.toISOString().split('T')[0];
  const startUtc = new Date(`${startStr}T00:00:00+09:00`);

  const records = await db
    .select({
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
    })
    .from(brandLivestreams)
    .where(and(
      gte(brandLivestreams.livestreamDate, startUtc),
      isNull(brandLivestreams.deletedAt)
    ));

  const dailyTotals = new Map<string, number>();
  for (const r of records) {
    const jstDate = getJSTDate(r.livestreamDate);
    const dateStr = jstDate.toISOString().split('T')[0];
    dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + (r.salesAmount || 0));
  }

  // Exclude today (we compare today's total against previous record)
  const todayStr = jstNow.toISOString().split('T')[0];
  dailyTotals.delete(todayStr);

  let maxTotal = 0;
  for (const total of dailyTotals.values()) {
    if (total > maxTotal) maxTotal = total;
  }
  return maxTotal;
}

// ========== Ranking Logic ==========

function aggregateByStreamer(records: LivestreamRecord[]): RankedLiver[] {
  const map = new Map<string, RankedLiver>();
  
  for (const r of records) {
    const name = r.streamerName;
    if (!map.has(name)) {
      map.set(name, {
        name,
        liverId: r.liverId,
        totalSales: 0,
        totalDuration: 0,
        hourlyRate: 0,
        sessionCount: 0,
      });
    }
    const entry = map.get(name)!;
    entry.totalSales += r.salesAmount || 0;
    entry.totalDuration += r.duration || 0;
    entry.sessionCount += 1;
    if (r.liverId) entry.liverId = r.liverId;
  }

  // Calculate hourly rate
  for (const entry of map.values()) {
    if (entry.totalDuration > 0) {
      entry.hourlyRate = Math.round(entry.totalSales / (entry.totalDuration / 60));
    }
  }

  return Array.from(map.values());
}

// ========== Achievement Detection ==========

async function detectAchievements(
  todayRanked: RankedLiver[],
  todayTotalSales: number,
): Promise<Achievement[]> {
  const achievements: Achievement[] = [];

  if (todayRanked.length === 0) return achievements;

  // 1. Consecutive #1 wins
  const todayWinner = todayRanked[0];
  if (todayWinner) {
    const winners = await getDailyWinners(30);
    const now = new Date();
    const jstNow = getJSTDate(now);
    
    let consecutiveDays = 1; // Today counts as 1
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(jstNow);
      checkDate.setUTCDate(checkDate.getUTCDate() - i);
      const checkStr = checkDate.toISOString().split('T')[0];
      if (winners.get(checkStr) === todayWinner.name) {
        consecutiveDays++;
      } else {
        break;
      }
    }
    
    if (consecutiveDays >= 2) {
      achievements.push({
        emoji: "🔥",
        text: `${todayWinner.name}: ${consecutiveDays}日連続売上1位！`,
      });
    }
  }

  // 2. Personal best (check each streamer)
  for (const liver of todayRanked) {
    const history = await getStreamerHistory(liver.name, 90);
    // history[0] is today, check if today is personal best
    const previousBest = history
      .slice(1) // exclude today
      .reduce((max, h) => Math.max(max, h.totalSales), 0);
    
    if (liver.totalSales > previousBest && previousBest > 0 && liver.totalSales > 10000) {
      achievements.push({
        emoji: "📈",
        text: `${liver.name}: 自己ベスト更新！${formatYen(liver.totalSales)}（前回${formatYen(previousBest)}）`,
      });
    }
  }

  // 3. Milestone achievements (first time reaching X yen)
  const milestones = [50000, 100000, 200000, 300000, 500000, 1000000];
  for (const liver of todayRanked) {
    const history = await getStreamerHistory(liver.name, 365);
    const previousMax = history
      .slice(1)
      .reduce((max, h) => Math.max(max, h.totalSales), 0);
    
    for (const milestone of milestones) {
      if (liver.totalSales >= milestone && previousMax < milestone) {
        const milestoneStr = milestone >= 10000 
          ? `${milestone / 10000}万円` 
          : `${milestone.toLocaleString()}円`;
        achievements.push({
          emoji: "⭐",
          text: `${liver.name}: 初の${milestoneStr}突破！おめでとう！`,
        });
        break; // Only show highest milestone
      }
    }
  }

  // 4. Hourly rate improvement (>30% up from yesterday)
  const yesterdayRecords = await getYesterdayLivestreams();
  const yesterdayRanked = aggregateByStreamer(yesterdayRecords);
  const yesterdayMap = new Map(yesterdayRanked.map(r => [r.name, r]));
  
  for (const liver of todayRanked) {
    const yesterday = yesterdayMap.get(liver.name);
    if (yesterday && yesterday.hourlyRate > 0 && liver.hourlyRate > 0) {
      const improvement = ((liver.hourlyRate - yesterday.hourlyRate) / yesterday.hourlyRate) * 100;
      if (improvement >= 30) {
        achievements.push({
          emoji: "🚀",
          text: `${liver.name}: 時間単価 前日比+${Math.round(improvement)}%UP！`,
        });
      }
    }
  }

  // 5. Team new record
  const previousTeamRecord = await getTeamDailyRecord();
  if (todayTotalSales > previousTeamRecord && previousTeamRecord > 0) {
    achievements.push({
      emoji: "🎯",
      text: `チーム新記録: 1日合計売上 ${formatYen(todayTotalSales)}！`,
    });
  }

  return achievements;
}

// ========== Message Building ==========

function buildRankingMessage(
  todayRanked: RankedLiver[],
  weeklyRanked: WeeklyRanked[],
  achievements: Achievement[],
  todayTotalSales: number,
  todayTotalDuration: number,
  todayStreamers: number,
  totalActiveLivers: number,
  yesterdayTotalSales: number,
  nonStreamers: string[],
): string {
  const now = new Date();
  const dateStr = formatJSTDate(now);
  
  let msg = "";
  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += `📊 ${dateStr} デイリーランキング\n`;
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

  // Sales Ranking
  msg += "【💰 売上ランキング】\n";
  const salesRanked = [...todayRanked].sort((a, b) => b.totalSales - a.totalSales);
  for (let i = 0; i < salesRanked.length; i++) {
    const r = salesRanked[i];
    const rank = getRankEmoji(i + 1);
    const duration = formatDuration(r.totalDuration);
    msg += `${rank} ${r.name} - ${formatYen(r.totalSales)}（${duration}）\n`;
  }
  msg += "\n";

  // Hourly Rate Ranking
  msg += "【⚡ 時間単価ランキング】\n";
  const hourlyRanked = [...todayRanked]
    .filter(r => r.hourlyRate > 0)
    .sort((a, b) => b.hourlyRate - a.hourlyRate);
  for (let i = 0; i < hourlyRanked.length; i++) {
    const r = hourlyRanked[i];
    const rank = getRankEmoji(i + 1);
    msg += `${rank} ${r.name} - ${formatYen(r.hourlyRate)}/h\n`;
  }
  msg += "\n";

  // MVP
  if (salesRanked.length > 0) {
    const mvp = salesRanked[0];
    const hourlyRank = hourlyRanked.findIndex(r => r.name === mvp.name) + 1;
    msg += "【🎖 本日のMVP】\n";
    msg += `👑 ${mvp.name} - 売上1位`;
    if (hourlyRank > 0 && hourlyRank <= 3) {
      msg += ` & 時間単価${hourlyRank}位`;
    }
    msg += "！\n\n";
  }

  // Weekly Ranking
  if (weeklyRanked.length > 0) {
    const jstNow = getJSTDate(new Date());
    const dayOfWeek = jstNow.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(jstNow);
    monday.setUTCDate(monday.getUTCDate() - daysToMonday);
    const mondayMonth = monday.getUTCMonth() + 1;
    const mondayDay = monday.getUTCDate();
    const todayMonth = jstNow.getUTCMonth() + 1;
    const todayDay = jstNow.getUTCDate();
    
    msg += `【🏆 今週の累計（${mondayMonth}/${mondayDay}〜${todayMonth}/${todayDay}）】\n`;
    for (let i = 0; i < Math.min(weeklyRanked.length, 5); i++) {
      const r = weeklyRanked[i];
      msg += `${getRankEmoji(i + 1)} ${r.name} - ${formatYen(r.totalSales)}\n`;
    }
    if (weeklyRanked.length > 5) {
      for (let i = 5; i < weeklyRanked.length; i++) {
        const r = weeklyRanked[i];
        msg += `${i + 1}. ${r.name} - ${formatYen(r.totalSales)}\n`;
      }
    }
    msg += "\n";
  }

  // Achievements
  if (achievements.length > 0) {
    msg += "【📈 記録更新・アチーブメント】\n";
    for (const a of achievements) {
      msg += `${a.emoji} ${a.text}\n`;
    }
    msg += "\n";
  }

  // Team Summary
  msg += "【📊 チームサマリー】\n";
  msg += `💰 合計売上: ${formatYen(todayTotalSales)}\n`;
  msg += `⏱ 総配信時間: ${formatDuration(todayTotalDuration)}\n`;
  msg += `👥 配信人数: ${todayStreamers}人 / 全${totalActiveLivers}人\n`;
  if (yesterdayTotalSales > 0) {
    const change = ((todayTotalSales - yesterdayTotalSales) / yesterdayTotalSales) * 100;
    const changeStr = change >= 0 ? `+${Math.round(change)}%` : `${Math.round(change)}%`;
    msg += `📈 前日比: ${changeStr}\n`;
  }
  msg += "\n";

  // Non-streamers
  if (nonStreamers.length > 0) {
    msg += `⚠️ 本日未配信: ${nonStreamers.join("、")}\n`;
    msg += "明日待ってるよ！💪\n\n";
  }

  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += "明日もみんなでギネス更新しよう！🔥\n";
  msg += "━━━━━━━━━━━━━━━━━━━━";

  return msg;
}

// ========== Main Execution ==========

export async function runDailyRanking(): Promise<void> {
  console.log(`${LOG_PREFIX} Starting daily ranking generation...`);

  try {
    // 1. Find target LINE group
    const targetGroup = await findTargetLineGroup();
    if (!targetGroup) {
      console.log(`${LOG_PREFIX} Target LINE group not found. Skipping.`);
      return;
    }
    console.log(`${LOG_PREFIX} Target group: ${targetGroup.groupName}`);

    // 2. Get today's livestream data
    const todayRecords = await getTodayLivestreams();
    if (todayRecords.length === 0) {
      console.log(`${LOG_PREFIX} No livestream records today. Sending minimal message.`);
      const dateStr = formatJSTDate(new Date());
      const noDataMsg = `━━━━━━━━━━━━━━━━━━━━\n📊 ${dateStr} デイリーランキング\n━━━━━━━━━━━━━━━━━━━━\n\n本日の配信記録はありませんでした。\n明日はみんなで配信しよう！🔥\n\n━━━━━━━━━━━━━━━━━━━━`;
      await pushMessage(targetGroup.lineGroupId, [{ type: "text", text: noDataMsg }]);
      return;
    }

    // 3. Aggregate data
    const todayRanked = aggregateByStreamer(todayRecords)
      .sort((a, b) => b.totalSales - a.totalSales);
    
    const todayTotalSales = todayRanked.reduce((sum, r) => sum + r.totalSales, 0);
    const todayTotalDuration = todayRanked.reduce((sum, r) => sum + r.totalDuration, 0);
    const todayStreamers = todayRanked.length;

    // 4. Get weekly data
    const weekRecords = await getWeekLivestreams();
    const weeklyAggregated = aggregateByStreamer(weekRecords)
      .sort((a, b) => b.totalSales - a.totalSales)
      .map(r => ({ name: r.name, totalSales: r.totalSales }));

    // 5. Get yesterday's data for comparison
    const yesterdayRecords = await getYesterdayLivestreams();
    const yesterdayTotalSales = yesterdayRecords.reduce((sum, r) => sum + (r.salesAmount || 0), 0);

    // 6. Get all active livers for non-streamer detection
    const allLivers = await getAllActiveLivers();
    const todayStreamerNames = new Set(todayRanked.map(r => r.name.toLowerCase()));
    const nonStreamers = allLivers
      .filter(l => !todayStreamerNames.has(l.name.toLowerCase()))
      .map(l => l.name);

    // 7. Detect achievements
    const achievements = await detectAchievements(todayRanked, todayTotalSales);

    // 8. Build message
    const message = buildRankingMessage(
      todayRanked,
      weeklyAggregated,
      achievements,
      todayTotalSales,
      todayTotalDuration,
      todayStreamers,
      allLivers.length,
      yesterdayTotalSales,
      nonStreamers,
    );

    // 9. Send to LINE group
    console.log(`${LOG_PREFIX} Sending ranking to group: ${targetGroup.groupName}`);
    const success = await pushMessage(targetGroup.lineGroupId, [{ type: "text", text: message }]);
    
    if (success) {
      console.log(`${LOG_PREFIX} ✅ Daily ranking sent successfully!`);
    } else {
      console.error(`${LOG_PREFIX} ❌ Failed to send daily ranking`);
    }

  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
  }
}

// ========== Scheduler ==========

function isTargetJSTHour(targetHour: number): boolean {
  const now = new Date();
  const jstHour = (now.getUTCHours() + 9) % 24;
  return jstHour === targetHour;
}

export function startDailyRankingScheduler(): void {
  if (schedulerIntervalId) {
    console.log(`${LOG_PREFIX} Already running`);
    return;
  }

  console.log(`${LOG_PREFIX} Starting scheduler (daily at JST 00:00)`);
  let lastRunDate = "";

  // Check every 15 minutes
  const CHECK_INTERVAL = 15 * 60 * 1000;

  schedulerIntervalId = setInterval(async () => {
    try {
      const now = new Date();
      const jstNow = getJSTDate(now);
      const todayStr = jstNow.toISOString().split('T')[0];

      // Run at JST 00:00 (midnight), only once per day
      if (isTargetJSTHour(0) && lastRunDate !== todayStr) {
        console.log(`${LOG_PREFIX} It's JST 00:00 - running daily ranking...`);
        lastRunDate = todayStr;
        await runDailyRanking();
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduler check error:`, error);
    }
  }, CHECK_INTERVAL);
}

export function stopDailyRankingScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log(`${LOG_PREFIX} Stopped`);
  }
}
