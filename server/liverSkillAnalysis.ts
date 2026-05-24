/**
 * ライバー配信スキル分析エンジン
 * 
 * 個人別のデータ分析:
 * - 時間帯別パフォーマンス（最も売上効率が良い時間帯）
 * - ブランド別得意不得意（CVR・売上効率）
 * - 配信時間と売上の相関（最適な配信時間）
 * - 成長トレンド（月別推移）
 * 
 * 週次AIレポートと配信前ブリーフィングで使用
 */

import { getDb } from "./db";
import { brandLivestreams, livers, brands } from "../drizzle/schema";
import { and, eq, gte, isNull, desc, sql } from "drizzle-orm";

const LOG_PREFIX = "[Skill Analysis]";

export interface TimeSlotAnalysis {
  hour: number; // JST hour (0-23)
  streamCount: number;
  totalSales: number;
  totalDuration: number; // minutes
  avgHourlyRate: number;
  avgSalesPerStream: number;
}

export interface BrandAnalysis {
  brandId: number;
  brandName: string;
  streamCount: number;
  totalSales: number;
  totalDuration: number; // minutes
  avgHourlyRate: number;
  avgSalesPerStream: number;
  trend: "up" | "down" | "stable"; // compared to previous period
}

export interface DurationAnalysis {
  durationBucket: string; // "1h未満", "1-2h", "2-3h", "3h以上"
  streamCount: number;
  avgHourlyRate: number;
  avgSales: number;
}

export interface GrowthData {
  month: string; // "2026-01"
  totalSales: number;
  streamCount: number;
  totalHours: number;
  hourlyRate: number;
}

export interface SkillAnalysisResult {
  liverName: string;
  analysisDate: string;
  // Best performing time slot
  bestTimeSlot: TimeSlotAnalysis | null;
  worstTimeSlot: TimeSlotAnalysis | null;
  timeSlots: TimeSlotAnalysis[];
  // Brand performance
  bestBrand: BrandAnalysis | null;
  brandAnalysis: BrandAnalysis[];
  // Duration sweet spot
  optimalDuration: DurationAnalysis | null;
  durationAnalysis: DurationAnalysis[];
  // Growth trend
  growthData: GrowthData[];
  monthOverMonthGrowth: number; // percentage
  // Key insights (text)
  insights: string[];
}

/**
 * Analyze a liver's performance by time slot
 */
async function analyzeTimeSlots(liverId: number, liverName: string, daysBack: number = 60): Promise<TimeSlotAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        hour: sql<number>`HOUR(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00'))`,
        streamCount: sql<number>`COUNT(*)`,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          sql`(${brandLivestreams.liverId} = ${liverId} OR ${brandLivestreams.streamerName} = ${liverName})`,
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, startDate)
        )
      )
      .groupBy(sql`HOUR(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00'))`)
      .having(sql`COUNT(*) >= 2`);

    return result.map(r => ({
      hour: Number(r.hour),
      streamCount: Number(r.streamCount),
      totalSales: Number(r.totalSales),
      totalDuration: Number(r.totalDuration),
      avgHourlyRate: Number(r.totalDuration) > 0
        ? Math.round(Number(r.totalSales) / (Number(r.totalDuration) / 60))
        : 0,
      avgSalesPerStream: Number(r.streamCount) > 0
        ? Math.round(Number(r.totalSales) / Number(r.streamCount))
        : 0,
    }));
  } catch (err) {
    console.error(`${LOG_PREFIX} analyzeTimeSlots error:`, err);
    return [];
  }
}

/**
 * Analyze a liver's performance by brand
 */
async function analyzeBrands(liverId: number, liverName: string, daysBack: number = 60): Promise<BrandAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const midDate = new Date(Date.now() - (daysBack / 2) * 24 * 60 * 60 * 1000);

    // Current period
    const currentResult = await db
      .select({
        brandId: brandLivestreams.brandId,
        brandName: brands.name,
        streamCount: sql<number>`COUNT(*)`,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      })
      .from(brandLivestreams)
      .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
      .where(
        and(
          sql`(${brandLivestreams.liverId} = ${liverId} OR ${brandLivestreams.streamerName} = ${liverName})`,
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, midDate)
        )
      )
      .groupBy(brandLivestreams.brandId, brands.name)
      .having(sql`COUNT(*) >= 1`);

    // Previous period for trend
    const prevResult = await db
      .select({
        brandId: brandLivestreams.brandId,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          sql`(${brandLivestreams.liverId} = ${liverId} OR ${brandLivestreams.streamerName} = ${liverName})`,
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, startDate),
          sql`${brandLivestreams.livestreamDate} < ${midDate}`
        )
      )
      .groupBy(brandLivestreams.brandId);

    const prevMap = new Map(prevResult.map(r => [r.brandId, r]));

    return currentResult
      .filter(r => r.brandId != null)
      .map(r => {
        const prevData = prevMap.get(r.brandId!);
        const currentRate = Number(r.totalDuration) > 0
          ? Number(r.totalSales) / (Number(r.totalDuration) / 60)
          : 0;
        const prevRate = prevData && Number(prevData.totalDuration) > 0
          ? Number(prevData.totalSales) / (Number(prevData.totalDuration) / 60)
          : 0;

        let trend: "up" | "down" | "stable" = "stable";
        if (prevRate > 0) {
          const change = (currentRate - prevRate) / prevRate;
          if (change > 0.1) trend = "up";
          else if (change < -0.1) trend = "down";
        }

        return {
          brandId: r.brandId!,
          brandName: r.brandName || "不明",
          streamCount: Number(r.streamCount),
          totalSales: Number(r.totalSales),
          totalDuration: Number(r.totalDuration),
          avgHourlyRate: Math.round(currentRate),
          avgSalesPerStream: Number(r.streamCount) > 0
            ? Math.round(Number(r.totalSales) / Number(r.streamCount))
            : 0,
          trend,
        };
      })
      .sort((a, b) => b.avgHourlyRate - a.avgHourlyRate);
  } catch (err) {
    console.error(`${LOG_PREFIX} analyzeBrands error:`, err);
    return [];
  }
}

/**
 * Analyze optimal stream duration
 */
async function analyzeDuration(liverId: number, liverName: string, daysBack: number = 90): Promise<DurationAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        durationBucket: sql<string>`CASE 
          WHEN ${brandLivestreams.duration} < 60 THEN '1h未満'
          WHEN ${brandLivestreams.duration} < 120 THEN '1-2h'
          WHEN ${brandLivestreams.duration} < 180 THEN '2-3h'
          ELSE '3h以上'
        END`,
        streamCount: sql<number>`COUNT(*)`,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          sql`(${brandLivestreams.liverId} = ${liverId} OR ${brandLivestreams.streamerName} = ${liverName})`,
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, startDate),
          sql`${brandLivestreams.duration} > 0`
        )
      )
      .groupBy(sql`CASE 
        WHEN ${brandLivestreams.duration} < 60 THEN '1h未満'
        WHEN ${brandLivestreams.duration} < 120 THEN '1-2h'
        WHEN ${brandLivestreams.duration} < 180 THEN '2-3h'
        ELSE '3h以上'
      END`);

    return result.map(r => ({
      durationBucket: String(r.durationBucket),
      streamCount: Number(r.streamCount),
      avgHourlyRate: Number(r.totalDuration) > 0
        ? Math.round(Number(r.totalSales) / (Number(r.totalDuration) / 60))
        : 0,
      avgSales: Number(r.streamCount) > 0
        ? Math.round(Number(r.totalSales) / Number(r.streamCount))
        : 0,
    }));
  } catch (err) {
    console.error(`${LOG_PREFIX} analyzeDuration error:`, err);
    return [];
  }
}

/**
 * Get monthly growth data (last 6 months)
 */
async function getMonthlyGrowth(liverId: number, liverName: string): Promise<GrowthData[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const result = await db
      .select({
        month: sql<string>`DATE_FORMAT(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00'), '%Y-%m')`,
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        streamCount: sql<number>`COUNT(*)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          sql`(${brandLivestreams.liverId} = ${liverId} OR ${brandLivestreams.streamerName} = ${liverName})`,
          isNull(brandLivestreams.deletedAt),
          gte(brandLivestreams.livestreamDate, sixMonthsAgo)
        )
      )
      .groupBy(sql`DATE_FORMAT(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00'), '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(CONVERT_TZ(${brandLivestreams.livestreamDate}, '+00:00', '+09:00'), '%Y-%m')`);

    return result.map(r => ({
      month: String(r.month),
      totalSales: Number(r.totalSales),
      streamCount: Number(r.streamCount),
      totalHours: Math.round(Number(r.totalDuration) / 60 * 10) / 10,
      hourlyRate: Number(r.totalDuration) > 0
        ? Math.round(Number(r.totalSales) / (Number(r.totalDuration) / 60))
        : 0,
    }));
  } catch (err) {
    console.error(`${LOG_PREFIX} getMonthlyGrowth error:`, err);
    return [];
  }
}

/**
 * Generate insights from analysis data
 */
function generateInsights(
  timeSlots: TimeSlotAnalysis[],
  brandAnalysis: BrandAnalysis[],
  durationAnalysis: DurationAnalysis[],
  growthData: GrowthData[]
): string[] {
  const insights: string[] = [];

  // Time slot insight
  if (timeSlots.length >= 2) {
    const best = timeSlots.reduce((a, b) => a.avgHourlyRate > b.avgHourlyRate ? a : b);
    const worst = timeSlots.reduce((a, b) => a.avgHourlyRate < b.avgHourlyRate ? a : b);
    if (best.avgHourlyRate > worst.avgHourlyRate * 1.3) {
      insights.push(`${best.hour}:00台の配信が最も売上効率が良い（時間単価¥${best.avgHourlyRate.toLocaleString()}/h）`);
    }
  }

  // Brand insight
  if (brandAnalysis.length >= 2) {
    const best = brandAnalysis[0];
    if (best.avgHourlyRate > 0) {
      insights.push(`${best.brandName}の紹介が得意（時間単価¥${best.avgHourlyRate.toLocaleString()}/h）`);
    }
    const trending = brandAnalysis.filter(b => b.trend === "up");
    if (trending.length > 0) {
      insights.push(`${trending[0].brandName}の売上が上昇トレンド📈`);
    }
  }

  // Duration insight
  if (durationAnalysis.length >= 2) {
    const best = durationAnalysis.reduce((a, b) => a.avgHourlyRate > b.avgHourlyRate ? a : b);
    insights.push(`配信時間${best.durationBucket}の時が最も時間単価が高い（¥${best.avgHourlyRate.toLocaleString()}/h）`);
  }

  // Growth insight
  if (growthData.length >= 2) {
    const latest = growthData[growthData.length - 1];
    const prev = growthData[growthData.length - 2];
    if (prev.hourlyRate > 0) {
      const growth = Math.round(((latest.hourlyRate - prev.hourlyRate) / prev.hourlyRate) * 100);
      if (growth > 0) {
        insights.push(`先月比で時間単価が${growth}%アップ！成長中🔥`);
      } else if (growth < -10) {
        insights.push(`先月比で時間単価が${Math.abs(growth)}%ダウン。配信時間帯や商品構成を見直してみよう`);
      }
    }
  }

  return insights;
}

/**
 * Run full skill analysis for a liver
 */
export async function runSkillAnalysis(liverName: string): Promise<SkillAnalysisResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Find liver
    const liver = await db
      .select({ id: livers.id, name: livers.name })
      .from(livers)
      .where(eq(livers.name, liverName))
      .limit(1);

    if (liver.length === 0) {
      console.log(`${LOG_PREFIX} Liver not found: ${liverName}`);
      return null;
    }

    const liverId = liver[0].id;

    // Run all analyses in parallel
    const [timeSlots, brandData, durationData, growthData] = await Promise.all([
      analyzeTimeSlots(liverId, liverName),
      analyzeBrands(liverId, liverName),
      analyzeDuration(liverId, liverName),
      getMonthlyGrowth(liverId, liverName),
    ]);

    // Find best/worst
    const bestTimeSlot = timeSlots.length > 0
      ? timeSlots.reduce((a, b) => a.avgHourlyRate > b.avgHourlyRate ? a : b)
      : null;
    const worstTimeSlot = timeSlots.length > 0
      ? timeSlots.reduce((a, b) => a.avgHourlyRate < b.avgHourlyRate ? a : b)
      : null;
    const bestBrand = brandData.length > 0 ? brandData[0] : null;
    const optimalDuration = durationData.length > 0
      ? durationData.reduce((a, b) => a.avgHourlyRate > b.avgHourlyRate ? a : b)
      : null;

    // Month over month growth
    let monthOverMonthGrowth = 0;
    if (growthData.length >= 2) {
      const latest = growthData[growthData.length - 1];
      const prev = growthData[growthData.length - 2];
      if (prev.hourlyRate > 0) {
        monthOverMonthGrowth = Math.round(((latest.hourlyRate - prev.hourlyRate) / prev.hourlyRate) * 100);
      }
    }

    // Generate insights
    const insights = generateInsights(timeSlots, brandData, durationData, growthData);

    return {
      liverName,
      analysisDate: new Date().toISOString().split('T')[0],
      bestTimeSlot,
      worstTimeSlot,
      timeSlots,
      bestBrand,
      brandAnalysis: brandData,
      optimalDuration,
      durationAnalysis: durationData,
      growthData,
      monthOverMonthGrowth,
      insights,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} runSkillAnalysis error for ${liverName}:`, err);
    return null;
  }
}

/**
 * Format skill analysis as LINE message text
 */
export function formatSkillAnalysisMessage(analysis: SkillAnalysisResult): string {
  let msg = `📊 配信スキル分析レポート\n━━━━━━━━━━━━━━━\n`;
  msg += `👤 ${analysis.liverName}さん\n\n`;

  // Key insights
  if (analysis.insights.length > 0) {
    msg += `💡 あなたの強み・特徴:\n`;
    analysis.insights.forEach(insight => {
      msg += `• ${insight}\n`;
    });
    msg += `\n`;
  }

  // Time slot
  if (analysis.bestTimeSlot) {
    msg += `⏰ ベスト配信時間帯: ${analysis.bestTimeSlot.hour}:00台\n`;
    msg += `  → 時間単価¥${analysis.bestTimeSlot.avgHourlyRate.toLocaleString()}/h (${analysis.bestTimeSlot.streamCount}回)\n`;
  }

  // Brand
  if (analysis.bestBrand) {
    msg += `\n🏆 得意ブランド: ${analysis.bestBrand.brandName}\n`;
    msg += `  → 時間単価¥${analysis.bestBrand.avgHourlyRate.toLocaleString()}/h`;
    if (analysis.bestBrand.trend === "up") msg += ` 📈`;
    msg += `\n`;
  }

  // Duration
  if (analysis.optimalDuration) {
    msg += `\n⏱️ 最適配信時間: ${analysis.optimalDuration.durationBucket}\n`;
    msg += `  → 時間単価¥${analysis.optimalDuration.avgHourlyRate.toLocaleString()}/h\n`;
  }

  // Growth
  if (analysis.growthData.length >= 2) {
    const latest = analysis.growthData[analysis.growthData.length - 1];
    msg += `\n📈 今月の時間単価: ¥${latest.hourlyRate.toLocaleString()}/h`;
    if (analysis.monthOverMonthGrowth !== 0) {
      msg += ` (先月比${analysis.monthOverMonthGrowth > 0 ? '+' : ''}${analysis.monthOverMonthGrowth}%)`;
    }
    msg += `\n`;
  }

  return msg;
}
