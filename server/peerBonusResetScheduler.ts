/**
 * Peer Bonus Monthly Reset Scheduler
 * 
 * ピアボーナスの月間配布プールを毎月1日 JST 00:05 に自動リセット。
 * 
 * 実際の仕組み:
 * - ピアボーナスの残りプールは yearMonth ベースで計算されている
 *   （lcj_coin_peer_bonuses.yearMonth で当月の送信済み合計を集計）
 * - つまり月が変わると自動的にプールはリセットされる
 * - このスケジューラーは「月初にログを出す + 前月の未使用分を記録する」役割
 * 
 * Schedule: 毎月1日 JST 00:05 (= UTC 15:05 前日)
 */

import { getDb } from "./db";
import { lcjCoinPeerBonuses, lcjCoinHoldings, lcjCoinSettings } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

async function getSettingsMap(db: any): Promise<Record<string, string>> {
  const rows = await db.select().from(lcjCoinSettings);
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.settingKey] = r.settingValue;
  }
  return map;
}

/**
 * 月初のピアボーナスリセットジョブ
 * - 前月の利用状況をログに記録
 * - 新しい月のプールが自動的に有効になっていることを確認
 */
export async function runPeerBonusMonthlyReset(): Promise<{
  previousMonth: string;
  currentMonth: string;
  monthlyPool: number;
  totalHolders: number;
  previousMonthStats: {
    totalBonusesSent: number;
    totalCoinsSent: number;
    uniqueSenders: number;
    uniqueReceivers: number;
  };
}> {
  console.log("[PeerBonusReset] Starting monthly peer bonus reset job...");

  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const settings = await getSettingsMap(db);
  const monthlyPool = parseInt(settings.peer_bonus_monthly_pool || "100");

  // Calculate current and previous month (JST)
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
  
  // Previous month
  const prevDate = new Date(jstNow);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const previousMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  // Get previous month stats
  const [statsResult] = await db.execute(
    sql`SELECT 
      COUNT(*) as totalBonuses,
      COALESCE(SUM(coinAmount), 0) as totalCoins,
      COUNT(DISTINCT CONCAT(senderHolderType, '_', senderHolderId)) as uniqueSenders,
      COUNT(DISTINCT CONCAT(receiverHolderType, '_', receiverHolderId)) as uniqueReceivers
    FROM lcj_coin_peer_bonuses 
    WHERE yearMonth = ${previousMonth}`
  );
  const stats = (statsResult as any[])[0] || {};

  // Count total holders
  const [holdersResult] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM lcj_coin_holdings`
  );
  const totalHolders = Number((holdersResult as any[])[0]?.cnt || 0);

  const result = {
    previousMonth,
    currentMonth,
    monthlyPool,
    totalHolders,
    previousMonthStats: {
      totalBonusesSent: Number(stats.totalBonuses || 0),
      totalCoinsSent: Number(stats.totalCoins || 0),
      uniqueSenders: Number(stats.uniqueSenders || 0),
      uniqueReceivers: Number(stats.uniqueReceivers || 0),
    },
  };

  console.log(`[PeerBonusReset] Monthly reset complete:`);
  console.log(`  Previous month (${previousMonth}): ${result.previousMonthStats.totalBonusesSent} bonuses sent, ${result.previousMonthStats.totalCoinsSent} coins, ${result.previousMonthStats.uniqueSenders} senders, ${result.previousMonthStats.uniqueReceivers} receivers`);
  console.log(`  Current month (${currentMonth}): Pool reset to ${monthlyPool} coins/person for ${totalHolders} holders`);
  console.log(`  Total available pool: ${monthlyPool * totalHolders} coins`);

  return result;
}

/**
 * スケジューラー起動
 * 毎月1日 JST 00:05 に実行
 */
export function startPeerBonusResetScheduler(): void {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

  function getNextFirstOfMonth(): Date {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    
    // Next 1st of month at JST 00:05
    const year = jstNow.getUTCMonth() === 11 
      ? jstNow.getUTCFullYear() + 1 
      : jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth() === 11 
      ? 0 
      : jstNow.getUTCMonth() + 1;
    
    // If we're already past the 1st, schedule for next month
    let targetJST: Date;
    if (jstNow.getUTCDate() === 1 && jstNow.getUTCHours() < 0.1) {
      // It's the 1st and before 00:05 JST - run today
      targetJST = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1, 0, 5, 0));
    } else {
      // Schedule for next month's 1st
      targetJST = new Date(Date.UTC(year, month, 1, 0, 5, 0));
    }
    
    // Convert JST to UTC
    return new Date(targetJST.getTime() - jstOffset);
  }

  let lastRunMonth = "";

  async function checkAndRun() {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
    
    // Run on the 1st of each month (JST), only once per month
    if (jstNow.getUTCDate() === 1 && currentMonth !== lastRunMonth) {
      try {
        await runPeerBonusMonthlyReset();
        lastRunMonth = currentMonth;
        console.log(`[PeerBonusReset] Successfully ran for ${currentMonth}`);
      } catch (err) {
        console.error("[PeerBonusReset] Error running monthly reset:", err);
      }
    }
  }

  // Also run immediately on startup if it's the 1st and hasn't run yet
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  if (jstNow.getUTCDate() === 1) {
    console.log("[PeerBonusReset] It's the 1st - running immediately on startup");
    checkAndRun();
  }

  // Check every hour
  setInterval(checkAndRun, CHECK_INTERVAL_MS);

  const nextRun = getNextFirstOfMonth();
  const hoursUntil = ((nextRun.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(1);
  console.log(`[PeerBonusReset] Scheduler started. Next reset: ${nextRun.toISOString()} (in ${hoursUntil} hours)`);
}
