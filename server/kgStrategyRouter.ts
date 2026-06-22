/**
 * KG Strategy Dashboard Router
 * - GPM自動計算 & 推移
 * - 滚動7天GMV（流量池レベル）
 * - 大目標進捗（9月10億等）
 * - 商品別GPM分析
 * - 配信履歴（GPM付き）
 */
import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { brandLivestreams, livestreamProducts, liverGoals, brandProducts } from "../drizzle/schema";
import { eq, desc, and, sql, isNull, gte, lte, like } from "drizzle-orm";

// ===== Helper Functions =====

function getJSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function getJSTDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function getJSTMonthRange(month: string): { startDate: Date; endDate: Date } {
  const [year, monthNum] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = new Date(Date.UTC(year, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);
  return { startDate, endDate };
}

/**
 * 流量池レベル判定（TikTok基準）
 * 滚動7天GMVに基づくレベル
 */
function getTrafficPoolLevel(rolling7DayGmv: number): {
  level: number;
  name: string;
  color: string;
  nextThreshold: number;
  amountToNext: number;
} {
  const levels = [
    { level: 1, name: "E1 起步池", threshold: 0, color: "#6b7280" },
    { level: 2, name: "E2 成長池", threshold: 1000000, color: "#3b82f6" },
    { level: 3, name: "E3 優質池", threshold: 5000000, color: "#8b5cf6" },
    { level: 4, name: "E4 爆發池", threshold: 10000000, color: "#f59e0b" },
    { level: 5, name: "E5 頂級池", threshold: 50000000, color: "#ef4444" },
    { level: 6, name: "E6 超級池", threshold: 100000000, color: "#ec4899" },
  ];

  let current = levels[0];
  let next = levels[1];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (rolling7DayGmv >= levels[i].threshold) {
      current = levels[i];
      next = levels[i + 1] || levels[i];
      break;
    }
  }

  return {
    level: current.level,
    name: current.name,
    color: current.color,
    nextThreshold: next.threshold,
    amountToNext: Math.max(0, next.threshold - rolling7DayGmv),
  };
}

export const kgStrategyRouter = router({
  // ===== 戦略ダッシュボード全データ取得 =====
  getStrategyData: publicProcedure
    .input(z.object({
      liverId: z.number(),
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB接続エラー" });

      const { liverId, yearMonth } = input;
      const { startDate, endDate } = getJSTMonthRange(yearMonth);

      // 1. 当月の全配信データ取得
      const monthStreams = await db
        .select()
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, startDate),
          lte(brandLivestreams.livestreamDate, endDate),
        ))
        .orderBy(desc(brandLivestreams.livestreamDate));

      // 2. 滚動7天GMV計算（直近7日）
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const last7DaysStreams = await db
        .select({
          id: brandLivestreams.id,
          salesAmount: brandLivestreams.salesAmount,
          gmv: brandLivestreams.gmv,
          livestreamDate: brandLivestreams.livestreamDate,
        })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, sevenDaysAgo),
        ));

      const rolling7DayGmv = last7DaysStreams.reduce((sum, s) => 
        sum + Number(s.gmv || s.salesAmount || 0), 0
      );

      // 3. GPM計算（各配信ごと + 月平均）
      const streamsWithGpm = monthStreams.map(s => {
        const gmv = Number(s.gmv || s.salesAmount || 0);
        const impressions = Number(s.impressions || 0);
        const gpm = impressions > 0 ? Math.round((gmv / impressions) * 1000) : 0;
        return {
          id: s.id,
          livestreamDate: s.livestreamDate,
          livestreamStartTime: s.livestreamStartTime,
          livestreamEndTime: s.livestreamEndTime,
          duration: s.duration,
          viewerCount: s.viewerCount,
          salesAmount: s.salesAmount,
          gmv: s.gmv,
          impressions: s.impressions,
          peakViewers: s.peakViewers,
          orderCount: s.orderCount,
          gpm,
        };
      });

      const totalGmv = monthStreams.reduce((sum, s) => sum + Number(s.gmv || s.salesAmount || 0), 0);
      const totalImpressions = monthStreams.reduce((sum, s) => sum + Number(s.impressions || 0), 0);
      const monthlyAvgGpm = totalImpressions > 0 ? Math.round((totalGmv / totalImpressions) * 1000) : 0;

      // 4. GPM推移（日別）
      const dailyGpmMap: Record<string, { gmv: number; impressions: number; date: string }> = {};
      for (const s of monthStreams) {
        if (!s.livestreamDate) continue;
        const dateStr = getJSTDateString(s.livestreamDate);
        if (!dailyGpmMap[dateStr]) {
          dailyGpmMap[dateStr] = { gmv: 0, impressions: 0, date: dateStr };
        }
        dailyGpmMap[dateStr].gmv += Number(s.gmv || s.salesAmount || 0);
        dailyGpmMap[dateStr].impressions += Number(s.impressions || 0);
      }
      const gpmTrend = Object.values(dailyGpmMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          date: d.date,
          gpm: d.impressions > 0 ? Math.round((d.gmv / d.impressions) * 1000) : 0,
          gmv: d.gmv,
          impressions: d.impressions,
        }));

      // 5. 流量池レベル
      const trafficPool = getTrafficPoolLevel(rolling7DayGmv);

      // 6. 大目標進捗（liverGoalsから取得）
      const [yearStr, monthStr] = yearMonth.split("-");
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const goals = await db
        .select()
        .from(liverGoals)
        .where(and(
          eq(liverGoals.liverId, liverId),
          eq(liverGoals.year, yearNum),
          eq(liverGoals.month, monthNum),
        ))
        .limit(1);
      
      const goal = goals[0] || null;
      const salesGoal = goal?.salesGoal || 0;
      const salesProgress = salesGoal > 0 ? Math.round((totalGmv / salesGoal) * 100) : 0;

      // 7. 商品別GPM（当月の全商品データ）
      const livestreamIds = monthStreams.map(s => s.id);
      let productGpmData: Array<{
        productName: string;
        totalGmv: number;
        totalImpressions: number;
        gpm: number;
        salesCount: number;
      }> = [];

      if (livestreamIds.length > 0) {
        // バッチで取得
        const batchSize = 100;
        let allProducts: Array<{
          productName: string;
          grossRevenue: number | null;
          directGmv: number | null;
          gmv: number | null;
          productImpressions: number | null;
          itemsSold: number | null;
        }> = [];

        for (let i = 0; i < livestreamIds.length; i += batchSize) {
          const batch = livestreamIds.slice(i, i + batchSize);
          const products = await db
            .select({
              productName: livestreamProducts.productName,
              grossRevenue: livestreamProducts.grossRevenue,
              directGmv: livestreamProducts.directGmv,
              gmv: livestreamProducts.gmv,
              productImpressions: livestreamProducts.productImpressions,
              itemsSold: livestreamProducts.itemsSold,
            })
            .from(livestreamProducts)
            .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
          allProducts = allProducts.concat(products);
        }

        // 商品名でグループ化
        const productMap: Record<string, { gmv: number; impressions: number; count: number }> = {};
        for (const p of allProducts) {
          const name = (p.productName || "").trim();
          if (!name) continue;
          const gmv = Number(p.grossRevenue || p.directGmv || p.gmv || 0);
          const impressions = Number(p.productImpressions || 0);
          if (!productMap[name]) {
            productMap[name] = { gmv: 0, impressions: 0, count: 0 };
          }
          productMap[name].gmv += gmv;
          productMap[name].impressions += impressions;
          productMap[name].count += Number(p.itemsSold || 0);
        }

        productGpmData = Object.entries(productMap)
          .map(([name, data]) => ({
            productName: name,
            totalGmv: data.gmv,
            totalImpressions: data.impressions,
            gpm: data.impressions > 0 ? Math.round((data.gmv / data.impressions) * 1000) : 0,
            salesCount: data.count,
          }))
          .sort((a, b) => b.gpm - a.gpm)
          .slice(0, 10);
      }

      // 8. 時間帯別GPM分析
      const hourlyGpm: Record<number, { gmv: number; impressions: number; count: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourlyGpm[i] = { gmv: 0, impressions: 0, count: 0 };
      }
      for (const s of monthStreams) {
        if (!s.livestreamDate) continue;
        const jstDate = new Date(s.livestreamDate.getTime() + 9 * 60 * 60 * 1000);
        const hour = jstDate.getUTCHours();
        hourlyGpm[hour].gmv += Number(s.gmv || s.salesAmount || 0);
        hourlyGpm[hour].impressions += Number(s.impressions || 0);
        hourlyGpm[hour].count += 1;
      }
      const hourlyGpmData = Object.entries(hourlyGpm)
        .filter(([_, data]) => data.count > 0)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          gpm: data.impressions > 0 ? Math.round((data.gmv / data.impressions) * 1000) : 0,
          avgGmv: Math.round(data.gmv / data.count),
          count: data.count,
        }));

      return {
        // 基本統計
        summary: {
          totalGmv,
          totalImpressions,
          monthlyAvgGpm,
          streamCount: monthStreams.length,
          totalDuration: monthStreams.reduce((sum, s) => sum + Number(s.duration || 0), 0),
        },
        // 滚動7天GMV & 流量池
        rolling7Day: {
          gmv: rolling7DayGmv,
          streamCount: last7DaysStreams.length,
          trafficPool,
        },
        // 目標進捗
        goalProgress: {
          salesGoal,
          currentSales: totalGmv,
          progress: salesProgress,
          streamCountGoal: goal?.streamCountGoal || 0,
          currentStreamCount: monthStreams.length,
        },
        // GPM推移
        gpmTrend,
        // 配信履歴（GPM付き）
        streams: streamsWithGpm,
        // 商品別GPM
        productGpm: productGpmData,
        // 時間帯別GPM
        hourlyGpm: hourlyGpmData,
      };
    }),

  // ===== 直近7日間 売れ筋TOP10 =====
  getWeeklyTopProducts: publicProcedure
    .input(z.object({ liverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // 直近7日間の配信を取得
      const now = getJSTNow();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentStreams = await db
        .select({ id: brandLivestreams.id })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, input.liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, sevenDaysAgo),
        ));

      if (recentStreams.length === 0) return [];

      const streamIds = recentStreams.map(s => s.id);

      // 配信IDに紐づく商品データを取得
      const batchSize = 100;
      let allProducts: Array<{
        productName: string;
        grossRevenue: number | null;
        directGmv: number | null;
        gmv: number | null;
        itemsSold: number | null;
        quantity: number | null;
      }> = [];

      for (let i = 0; i < streamIds.length; i += batchSize) {
        const batch = streamIds.slice(i, i + batchSize);
        const products = await db
          .select({
            productName: livestreamProducts.productName,
            grossRevenue: livestreamProducts.grossRevenue,
            directGmv: livestreamProducts.directGmv,
            gmv: livestreamProducts.gmv,
            itemsSold: livestreamProducts.itemsSold,
            quantity: livestreamProducts.quantity,
          })
          .from(livestreamProducts)
          .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
        allProducts = allProducts.concat(products);
      }

      // 商品名でグループ化して集計
      const productMap: Record<string, { totalGmv: number; totalItemsSold: number }> = {};

      for (const p of allProducts) {
        const name = (p.productName || "").trim();
        if (!name) continue;

        const gmv = Number(p.grossRevenue || p.directGmv || p.gmv || 0);
        const itemsSold = Number(p.itemsSold || p.quantity || 0);

        if (!productMap[name]) {
          productMap[name] = { totalGmv: 0, totalItemsSold: 0 };
        }
        productMap[name].totalGmv += gmv;
        productMap[name].totalItemsSold += itemsSold;
      }

      // TOP10を売上順で返す
      const top10 = Object.entries(productMap)
        .filter(([_, data]) => data.totalGmv > 0)
        .map(([name, data]) => ({
          productName: name,
          totalGmv: data.totalGmv,
          totalItemsSold: data.totalItemsSold,
          avgUnitPrice: data.totalItemsSold > 0
            ? Math.round(data.totalGmv / data.totalItemsSold)
            : 0,
        }))
        .sort((a, b) => b.totalGmv - a.totalGmv)
        .slice(0, 10);

      return top10;
    }),

  // ===== 大目標設定・取得 =====
  getBigGoal: publicProcedure
    .input(z.object({ liverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // 9月10億目標
      const targetMonth = "2026-09";
      const targetYear = 2026;
      const targetMonthNum = 9;
      const goals = await db
        .select()
        .from(liverGoals)
        .where(and(
          eq(liverGoals.liverId, input.liverId),
          eq(liverGoals.year, targetYear),
          eq(liverGoals.month, targetMonthNum),
        ))
        .limit(1);

      if (!goals[0]) {
        return {
          targetMonth,
          salesGoal: 1000000000, // デフォルト10億
          label: "9月 月GMV 10億円",
        };
      }

      return {
        targetMonth,
        salesGoal: goals[0].salesGoal || 1000000000,
        label: "9月 月GMV 10億円",
      };
    }),

  // ===== 大目標の累計進捗（全月合計） =====
  getBigGoalProgress: publicProcedure
    .input(z.object({ liverId: z.number(), targetMonth: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // 対象月の売上を取得
      const { startDate, endDate } = getJSTMonthRange(input.targetMonth);
      
      const result = await db
        .select({
          totalGmv: sql<number>`COALESCE(SUM(COALESCE(${brandLivestreams.gmv}, ${brandLivestreams.salesAmount}, 0)), 0)`,
          streamCount: sql<number>`COUNT(*)`,
        })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, input.liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, startDate),
          lte(brandLivestreams.livestreamDate, endDate),
        ));

      return {
        totalGmv: Number(result[0]?.totalGmv || 0),
        streamCount: Number(result[0]?.streamCount || 0),
      };
    }),

  // ===== 今日のおすすめ構成（鉄板・急上昇・最近出してない） =====
  getProductRecommendations: publicProcedure
    .input(z.object({ liverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const now = getJSTNow();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // 直近7日間の配信を取得
      const recentStreams = await db
        .select({ id: brandLivestreams.id, livestreamDate: brandLivestreams.livestreamDate })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, input.liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, sevenDaysAgo),
        ));

      if (recentStreams.length === 0) return null;

      // 前週（7-14日前）の配信を取得
      const prevWeekStreams = await db
        .select({ id: brandLivestreams.id })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, input.liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, fourteenDaysAgo),
          lte(brandLivestreams.livestreamDate, sevenDaysAgo),
        ));

      // 直近3日間の配信を特定
      const last3DayStreams = recentStreams.filter(
        s => s.livestreamDate && new Date(s.livestreamDate).getTime() >= threeDaysAgo.getTime()
      );

      // 商品データを取得するヘルパー（GPM計算用にimpressions含む）
      async function getProductsForStreams(streamIds: number[]): Promise<Record<string, { totalGmv: number; totalItemsSold: number; totalImpressions: number; latestUnitPrice: number }>> {
        if (streamIds.length === 0) return {};
        const productMap: Record<string, { totalGmv: number; totalItemsSold: number; totalImpressions: number; latestUnitPrice: number }> = {};
        const batchSize = 100;
        for (let i = 0; i < streamIds.length; i += batchSize) {
          const batch = streamIds.slice(i, i + batchSize);
          const products = await db
            .select({
              productName: livestreamProducts.productName,
              grossRevenue: livestreamProducts.grossRevenue,
              directGmv: livestreamProducts.directGmv,
              gmv: livestreamProducts.gmv,
              itemsSold: livestreamProducts.itemsSold,
              quantity: livestreamProducts.quantity,
              productImpressions: livestreamProducts.productImpressions,
              impressions: livestreamProducts.impressions,
              unitPrice: livestreamProducts.unitPrice,
            })
            .from(livestreamProducts)
            .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
          for (const p of products) {
            const name = (p.productName || "").trim();
            if (!name) continue;
            const gmv = Number(p.grossRevenue || p.directGmv || p.gmv || 0);
            const itemsSold = Number(p.itemsSold || p.quantity || 0);
            const impressions = Number(p.productImpressions || p.impressions || 0);
            const uPrice = Number(p.unitPrice || 0);
            if (!productMap[name]) productMap[name] = { totalGmv: 0, totalItemsSold: 0, totalImpressions: 0, latestUnitPrice: 0 };
            productMap[name].totalGmv += gmv;
            productMap[name].totalItemsSold += itemsSold;
            productMap[name].totalImpressions += impressions;
            if (uPrice > 0) productMap[name].latestUnitPrice = uPrice;
          }
        }
        return productMap;
      }

      // 今週と前週の商品データを取得
      const thisWeekProducts = await getProductsForStreams(recentStreams.map(s => s.id));
      const prevWeekProducts = await getProductsForStreams(prevWeekStreams.map(s => s.id));
      const last3DayProducts = await getProductsForStreams(last3DayStreams.map(s => s.id));

      // 🔥 鉄板: 今週TOP3（GMV順）- GMV付き
      const staples = Object.entries(thisWeekProducts)
        .filter(([_, d]) => d.totalGmv > 0)
        .sort((a, b) => b[1].totalGmv - a[1].totalGmv)
        .slice(0, 3)
        .map(([name, d]) => ({ name, gmv: d.totalGmv, itemsSold: d.totalItemsSold, unitPrice: d.totalItemsSold > 0 ? Math.round(d.totalGmv / d.totalItemsSold) : 0 }));
      const stapleNames = staples.map(s => s.name);

      // 📈 急上昇: 前週比で伸びてる商品（前週にもあった商品で、GMVが+20%以上）
      const rising: Array<{ name: string; growthPct: number; gmv: number; unitPrice: number }> = [];
      for (const [name, data] of Object.entries(thisWeekProducts)) {
        if (data.totalGmv <= 0) continue;
        const prev = prevWeekProducts[name];
        if (prev && prev.totalGmv > 0) {
          const growth = ((data.totalGmv - prev.totalGmv) / prev.totalGmv) * 100;
          if (growth >= 20) {
            rising.push({ name, growthPct: Math.round(growth), gmv: data.totalGmv, unitPrice: data.totalItemsSold > 0 ? Math.round(data.totalGmv / data.totalItemsSold) : 0 });
          }
        } else if (!prev && data.totalGmv >= 100000) {
          // 前週になかった新商品で売上10万以上 = 新星
          rising.push({ name, growthPct: 999, gmv: data.totalGmv, unitPrice: data.totalItemsSold > 0 ? Math.round(data.totalGmv / data.totalItemsSold) : 0 });
        }
      }
      rising.sort((a, b) => b.growthPct - a.growthPct);
      const topRising = rising
        .filter(r => !stapleNames.includes(r.name))
        .slice(0, 3);

      // 🆕 最近出してない: 今週売れてるけど直近3日間に出してない商品
      const forgotten: Array<{ name: string; daysSince: number; gmv: number; unitPrice: number }> = [];
      const allThisWeekNames = Object.entries(thisWeekProducts)
        .filter(([_, d]) => d.totalGmv > 50000) // 売上5万以上の商品のみ
        .map(([name]) => name);

      for (const name of allThisWeekNames) {
        if (stapleNames.includes(name)) continue; // 鉄板は除外
        if (!last3DayProducts[name] || last3DayProducts[name].totalGmv === 0) {
          const fData = thisWeekProducts[name];
          forgotten.push({ name, daysSince: 3, gmv: fData.totalGmv, unitPrice: fData.totalItemsSold > 0 ? Math.round(fData.totalGmv / fData.totalItemsSold) : 0 });
        }
      }
      // GMV順でソート
      forgotten.sort((a, b) => b.gmv - a.gmv);
      const topForgotten = forgotten.slice(0, 3);

      // 💎 GPM効率: 商品別GPMが高い商品（鉄板と被らないTOP3）
      const gpmEfficient: Array<{ name: string; gpm: number; gmv: number; unitPrice: number }> = [];
      for (const [name, data] of Object.entries(thisWeekProducts)) {
        if (data.totalGmv <= 0 || data.totalImpressions <= 0) continue;
        if (stapleNames.includes(name)) continue; // 鉄板は除外
        const gpm = Math.round((data.totalGmv / data.totalImpressions) * 1000);
        if (gpm > 0) {
          gpmEfficient.push({ name, gpm, gmv: data.totalGmv, unitPrice: data.totalItemsSold > 0 ? Math.round(data.totalGmv / data.totalItemsSold) : 0 });
        }
      }
      gpmEfficient.sort((a, b) => b.gpm - a.gpm);
      const topGpmEfficient = gpmEfficient.slice(0, 3);

      // 📉 落ちてきた: 前週比でGMVが-20%以上落ちてる商品
      const declining: Array<{ name: string; declinePct: number; thisWeekGmv: number; prevWeekGmv: number }> = [];
      for (const [name, prevData] of Object.entries(prevWeekProducts)) {
        if (prevData.totalGmv < 50000) continue; // 前週5万未満は無視
        const thisData = thisWeekProducts[name];
        if (!thisData || thisData.totalGmv <= 0) {
          // 今週全く売れてない = -100%
          declining.push({ name, declinePct: -100, thisWeekGmv: 0, prevWeekGmv: prevData.totalGmv });
        } else {
          const change = ((thisData.totalGmv - prevData.totalGmv) / prevData.totalGmv) * 100;
          if (change <= -20) {
            declining.push({ name, declinePct: Math.round(change), thisWeekGmv: thisData.totalGmv, prevWeekGmv: prevData.totalGmv });
          }
        }
      }
      declining.sort((a, b) => a.declinePct - b.declinePct); // 最も落ちてる順
      const topDeclining = declining.slice(0, 3);

      // ⏰ ベストタイム: 直近の配信データから最もGPMが高い時間帯を算出
      const hourlyGpm: Record<number, { totalGmv: number; totalImpressions: number; count: number }> = {};
      for (const stream of recentStreams) {
        if (!stream.livestreamDate) continue;
        const hour = new Date(new Date(stream.livestreamDate).getTime() + 9 * 60 * 60 * 1000).getUTCHours();
        // この配信のGMVとimpressionsを取得
        const streamProducts = await db
          .select({
            grossRevenue: livestreamProducts.grossRevenue,
            directGmv: livestreamProducts.directGmv,
            gmv: livestreamProducts.gmv,
            productImpressions: livestreamProducts.productImpressions,
            impressions: livestreamProducts.impressions,
          })
          .from(livestreamProducts)
          .where(eq(livestreamProducts.livestreamId, stream.id));
        let streamGmv = 0;
        let streamImpressions = 0;
        for (const p of streamProducts) {
          streamGmv += Number(p.grossRevenue || p.directGmv || p.gmv || 0);
          streamImpressions += Number(p.productImpressions || p.impressions || 0);
        }
        if (!hourlyGpm[hour]) hourlyGpm[hour] = { totalGmv: 0, totalImpressions: 0, count: 0 };
        hourlyGpm[hour].totalGmv += streamGmv;
        hourlyGpm[hour].totalImpressions += streamImpressions;
        hourlyGpm[hour].count += 1;
      }
      // GPMが最も高い時間帯TOP3
      const bestTimes = Object.entries(hourlyGpm)
        .filter(([_, d]) => d.totalImpressions > 0 && d.totalGmv > 0)
        .map(([hour, d]) => ({
          hour: Number(hour),
          gpm: Math.round((d.totalGmv / d.totalImpressions) * 1000),
          avgGmv: Math.round(d.totalGmv / d.count),
          count: d.count,
        }))
        .sort((a, b) => b.gpm - a.gpm)
        .slice(0, 3);

      // ⚡ 紹介チャンス: インプレ高×売上0（直近7日全体から集計、全件返却）
      // 単価は過去30日の全配信から同じ商品名の売上実績を参照
      const missedNames = Object.entries(thisWeekProducts)
        .filter(([_, d]) => d.totalImpressions >= 200 && d.totalGmv === 0)
        .map(([name]) => name);
      
      // 過去30日の全配信から単価を取得 + brandProductsテーブルから定価を取得
      const priceMap: Record<string, number> = {};
      if (missedNames.length > 0) {
        // 1) 過去30日の配信から売上実績で単価算出
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const allStreams30d = await db
          .select({ id: brandLivestreams.id })
          .from(brandLivestreams)
          .where(sql`${brandLivestreams.liverId} = ${input.liverId} AND ${brandLivestreams.livestreamDate} >= ${thirtyDaysAgo}`);
        const allProducts30d = await getProductsForStreams(allStreams30d.map(s => s.id));
        for (const name of missedNames) {
          const data = allProducts30d[name];
          if (data && data.totalItemsSold > 0) {
            priceMap[name] = Math.round(data.totalGmv / data.totalItemsSold);
          } else if (data && data.latestUnitPrice > 0) {
            priceMap[name] = data.latestUnitPrice;
          }
        }
        
        // 2) まだ単価がない商品はbrandProductsテーブルから定価/特別価格を取得
        const missingPriceNames = missedNames.filter(n => !priceMap[n]);
        if (missingPriceNames.length > 0) {
          const allBrandProducts = await db
            .select({
              productName: brandProducts.productName,
              listPrice: brandProducts.listPrice,
              specialPrice: brandProducts.specialPrice,
            })
            .from(brandProducts)
            .where(isNull(brandProducts.deletedAt));
          for (const bp of allBrandProducts) {
            const bpName = (bp.productName || '').trim();
            for (const missedName of missingPriceNames) {
              if (missedName.includes(bpName) || bpName.includes(missedName.slice(0, 20))) {
                const price = Number(bp.specialPrice || bp.listPrice || 0);
                if (price > 0 && !priceMap[missedName]) {
                  priceMap[missedName] = price;
                }
              }
            }
          }
        }
      }
      
      const missedOpportunities = Object.entries(thisWeekProducts)
        .filter(([_, d]) => d.totalImpressions >= 200 && d.totalGmv === 0)
        .sort((a, b) => b[1].totalImpressions - a[1].totalImpressions)
        .map(([name, d]) => ({
          name,
          impressions: d.totalImpressions,
          unitPrice: priceMap[name] || 0,
        }));

      return {
        staples, // 鉄板TOP3（GMV付き）
        rising: topRising, // 急上昇TOP3（GMV付き）
        gpmEfficient: topGpmEfficient, // GPM効率TOP3
        forgotten: topForgotten, // 最近出してないTOP3（GMV付き）
        declining: topDeclining, // 落ちてきたTOP3
        bestTimes, // ベストタイムTOP3
        missedOpportunities, // 紹介チャンス（インプレ高×売上0）
      };
    }),

  // ===== 配信別商品データ取得 =====
  getStreamProducts: publicProcedure
    .input(z.object({ livestreamId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const products = await db
        .select({
          productName: livestreamProducts.productName,
          grossRevenue: livestreamProducts.grossRevenue,
          directGmv: livestreamProducts.directGmv,
          gmv: livestreamProducts.gmv,
          itemsSold: livestreamProducts.itemsSold,
          quantity: livestreamProducts.quantity,
          unitPrice: livestreamProducts.unitPrice,
          productImpressions: livestreamProducts.productImpressions,
          productClicks: livestreamProducts.productClicks,
        })
        .from(livestreamProducts)
        .where(eq(livestreamProducts.livestreamId, input.livestreamId));

      // GMV降順でソート
      return products
        .map(p => ({
          productName: (p.productName || "").trim(),
          gmv: Number(p.grossRevenue || p.directGmv || p.gmv || 0),
          itemsSold: Number(p.itemsSold || p.quantity || 0),
          unitPrice: Number(p.unitPrice || 0),
          impressions: Number(p.productImpressions || 0),
          clicks: Number(p.productClicks || 0),
        }))
        .filter(p => p.productName.length > 0)
        .sort((a, b) => b.gmv - a.gmv);
    }),

  // ===== 商品別過去配信履歴 =====
  getProductHistory: publicProcedure
    .input(z.object({
      liverId: z.number(),
      productName: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [], consecutiveDays: 0, daysSinceLast: 0 };

      const now = getJSTNow();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 直近30日間の配信を取得
      const streams = await db
        .select({
          id: brandLivestreams.id,
          livestreamDate: brandLivestreams.livestreamDate,
          gmv: brandLivestreams.gmv,
          salesAmount: brandLivestreams.salesAmount,
        })
        .from(brandLivestreams)
        .where(and(
          eq(brandLivestreams.liverId, input.liverId),
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, thirtyDaysAgo),
        ))
        .orderBy(desc(brandLivestreams.livestreamDate));

      if (streams.length === 0) return { history: [], consecutiveDays: 0, daysSinceLast: 0 };

      // 各配信から該当商品を検索（部分一致）
      const history: Array<{
        livestreamId: number;
        livestreamDate: string;
        gmv: number;
        itemsSold: number;
      }> = [];

      for (const stream of streams) {
        const products = await db
          .select({
            productName: livestreamProducts.productName,
            grossRevenue: livestreamProducts.grossRevenue,
            directGmv: livestreamProducts.directGmv,
            gmv: livestreamProducts.gmv,
            itemsSold: livestreamProducts.itemsSold,
            quantity: livestreamProducts.quantity,
          })
          .from(livestreamProducts)
          .where(and(
            eq(livestreamProducts.livestreamId, stream.id),
            like(livestreamProducts.productName, `%${input.productName}%`),
          ));

        if (products.length > 0) {
          // 同じ配信で同じ商品が複数ある場合は合算
          let totalGmv = 0;
          let totalItems = 0;
          for (const p of products) {
            totalGmv += Number(p.grossRevenue || p.directGmv || p.gmv || 0);
            totalItems += Number(p.itemsSold || p.quantity || 0);
          }
          history.push({
            livestreamId: stream.id,
            livestreamDate: stream.livestreamDate ? getJSTDateString(stream.livestreamDate) : "",
            gmv: totalGmv,
            itemsSold: totalItems,
          });
        }
      }

      // 連続配信日数を計算（今日から遡って連続何日出してるか）
      let consecutiveDays = 0;
      if (history.length > 0) {
        const today = getJSTDateString(now);
        const historyDates = [...new Set(history.map(h => h.livestreamDate))].sort().reverse();
        
        // 最新の配信日から遡って連続日数を計算
        let checkDate = new Date(historyDates[0] + "T00:00:00Z");
        for (const dateStr of historyDates) {
          const d = new Date(dateStr + "T00:00:00Z");
          const diffDays = Math.round((checkDate.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays <= 1) {
            consecutiveDays++;
            checkDate = d;
          } else {
            break;
          }
        }
      }

      // 最後に出した日からの日数
      let daysSinceLast = 0;
      if (history.length > 0) {
        const lastDate = new Date(history[0].livestreamDate + "T00:00:00Z");
        const todayDate = new Date(getJSTDateString(now) + "T00:00:00Z");
        daysSinceLast = Math.round((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      }

      return {
        history,
        consecutiveDays,
        daysSinceLast,
      };
    }),
});
