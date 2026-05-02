/**
 * Peer Bonus Monthly Grant & Reset Scheduler
 * 
 * 毎月1日に全アクティブメンバー（スタッフ+ライバー）に100コインを自動付与。
 * - 付与されたコインは即時確定（vestedCoins）
 * - 月末に未使用の送信プールは自動失効（yearMonthベース）
 * - 受け取ったコインは保有コインに加算される
 * 
 * Schedule: 毎月1日 JST 00:05 (= UTC 15:05 前日)
 */
import { getDb } from "./db";
import { 
  lcjCoinPeerBonuses, lcjCoinHoldings, lcjCoinSettings,
  lcjCoinTransactions, staff, livers 
} from "../drizzle/schema";
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
 * 全アクティブメンバーにピアボーナス用コインを付与
 * - holdingsがない人は新規作成
 * - holdingsがある人はtotalCoins + vestedCoinsに加算
 * - transactionに記録
 */
async function grantPeerBonusCoinsToAll(db: any, settings: Record<string, string>, yearMonth: string): Promise<{
  staffGranted: number;
  liverGranted: number;
  coinsPerPerson: number;
  errors: string[];
}> {
  const coinsPerPerson = parseInt(settings.peer_bonus_monthly_pool || "100");
  const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
  const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
  const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
  const valuation = monthlyRevenue * 12 * psrMultiplier;
  const coinPrice = totalCoinsPool > 0 ? valuation / totalCoinsPool : 0;

  // Check if already granted this month
  const [alreadyGranted] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM lcj_coin_transactions 
        WHERE transactionType = 'bonus' 
        AND reason LIKE ${`ピアボーナス月間付与 (${yearMonth})%`}
        LIMIT 1`
  );
  if (Number((alreadyGranted as any[])[0]?.cnt || 0) > 0) {
    console.log(`[PeerBonusGrant] Already granted for ${yearMonth}, skipping`);
    return { staffGranted: 0, liverGranted: 0, coinsPerPerson, errors: ["Already granted this month"] };
  }

  const errors: string[] = [];
  let staffGranted = 0;
  let liverGranted = 0;

  // Get all active staff
  const staffList = await db.select({ id: staff.id }).from(staff).where(eq(staff.isActive, "active"));
  // Get all active livers
  const liverList = await db.select({ id: livers.id }).from(livers).where(eq(livers.isActive, true));

  const allTargets: { holderType: "staff" | "liver"; holderId: number }[] = [
    ...staffList.map((s: any) => ({ holderType: "staff" as const, holderId: s.id })),
    ...liverList.map((l: any) => ({ holderType: "liver" as const, holderId: l.id })),
  ];

  for (const target of allTargets) {
    try {
      // Find or create holding
      let [holding] = await db.select().from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, target.holderType),
          eq(lcjCoinHoldings.holderId, target.holderId),
        )).limit(1);

      if (!holding) {
        const [result] = await db.insert(lcjCoinHoldings).values({
          holderType: target.holderType,
          holderId: target.holderId,
          totalCoins: coinsPerPerson,
          vestedCoins: coinsPerPerson, // Immediately vested
          exercisedCoins: 0,
          level: 1,
          xp: 50,
          streak: 0,
        });
        holding = { id: Number(result.insertId) };
      } else {
        await db.execute(
          sql`UPDATE lcj_coin_holdings 
              SET totalCoins = totalCoins + ${coinsPerPerson}, 
                  vestedCoins = vestedCoins + ${coinsPerPerson},
                  xp = xp + 50 
              WHERE id = ${holding.id}`
        );
      }

      // Record transaction
      await db.insert(lcjCoinTransactions).values({
        holdingId: holding.id,
        holderType: target.holderType,
        holderId: target.holderId,
        transactionType: "bonus",
        coinAmount: coinsPerPerson,
        coinPriceAtTime: String(coinPrice),
        reason: `ピアボーナス月間付与 (${yearMonth})`,
        metadata: { type: "peer_bonus_monthly_grant", yearMonth },
      });

      if (target.holderType === "staff") staffGranted++;
      else liverGranted++;
    } catch (e: any) {
      errors.push(`${target.holderType}:${target.holderId} - ${e.message}`);
      console.error(`[PeerBonusGrant] Error granting to ${target.holderType}:${target.holderId}`, e);
    }
  }

  return { staffGranted, liverGranted, coinsPerPerson, errors };
}

/**
 * 月初のピアボーナスリセット＋コイン付与ジョブ
 */
export async function runPeerBonusMonthlyReset(): Promise<{
  previousMonth: string;
  currentMonth: string;
  monthlyPool: number;
  totalHolders: number;
  grantResult: { staffGranted: number; liverGranted: number; coinsPerPerson: number; errors: string[] };
  previousMonthStats: {
    totalBonusesSent: number;
    totalCoinsSent: number;
    uniqueSenders: number;
    uniqueReceivers: number;
  };
}> {
  console.log("[PeerBonusReset] Starting monthly peer bonus grant & reset job...");
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const settings = await getSettingsMap(db);
  const monthlyPool = parseInt(settings.peer_bonus_monthly_pool || "100");

  // Calculate current and previous month (JST)
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
  
  const prevDate = new Date(jstNow);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const previousMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  // 1. Grant coins to all active members
  const grantResult = await grantPeerBonusCoinsToAll(db, settings, currentMonth);
  console.log(`[PeerBonusGrant] Granted ${grantResult.coinsPerPerson} coins each: ${grantResult.staffGranted} staff, ${grantResult.liverGranted} livers`);
  if (grantResult.errors.length > 0) {
    console.warn(`[PeerBonusGrant] ${grantResult.errors.length} errors occurred`);
  }

  // 2. Get previous month stats
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

  const [holdersResult] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM lcj_coin_holdings`
  );
  const totalHolders = Number((holdersResult as any[])[0]?.cnt || 0);

  const result = {
    previousMonth,
    currentMonth,
    monthlyPool,
    totalHolders,
    grantResult,
    previousMonthStats: {
      totalBonusesSent: Number(stats.totalBonuses || 0),
      totalCoinsSent: Number(stats.totalCoins || 0),
      uniqueSenders: Number(stats.uniqueSenders || 0),
      uniqueReceivers: Number(stats.uniqueReceivers || 0),
    },
  };

  console.log(`[PeerBonusReset] Monthly reset complete:`);
  console.log(`  Previous month (${previousMonth}): ${result.previousMonthStats.totalBonusesSent} bonuses sent, ${result.previousMonthStats.totalCoinsSent} coins`);
  console.log(`  Current month (${currentMonth}): ${grantResult.staffGranted + grantResult.liverGranted} members granted ${grantResult.coinsPerPerson} coins each`);
  return result;
}

/**
 * スケジューラー起動
 * 毎月1日 JST 00:05 に実行
 */
export function startPeerBonusResetScheduler(): void {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;

  let lastRunMonth = "";

  async function checkAndRun() {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
    
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

  // Run immediately on startup if it's the 1st
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  if (jstNow.getUTCDate() === 1) {
    console.log("[PeerBonusReset] It's the 1st - running immediately on startup");
    checkAndRun();
  }

  setInterval(checkAndRun, CHECK_INTERVAL_MS);
  console.log(`[PeerBonusReset] Scheduler started. Runs on 1st of each month (JST)`);
}
