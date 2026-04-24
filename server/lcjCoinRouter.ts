/**
 * LCJ Coin (Phantom Stock) Router - ファントムストック報酬システム
 *
 * 独立ファイルとして管理。routers.tsにはimportのみ。
 * 
 * 機能:
 * - 擬似時価総額ダッシュボード（TikTok GMVデータ連携）
 * - コイン保有・ベスティング管理
 * - ゲーミフィケーション（バッジ・ランキング・レベル・シーズン）
 * - 管理画面（設定変更・コイン付与・レポート）
 * - 財務資料アップロード・履歴管理
 * - 株主名簿管理
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, getTiktokTapMonthlySummary } from "./db";
import { sql, eq, and, desc, asc, count, sum, isNull, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import {
  lcjCoinSettings,
  lcjCoinValuationLog,
  lcjCoinHoldings,
  lcjCoinTransactions,
  lcjCoinVestingSchedules,
  lcjCoinBadges,
  lcjCoinBadgeAwards,
  lcjCoinSeasons,
  lcjCoinRankingHistory,
  lcjCoinDocuments,
  lcjCoinShareholders,
  lcjCoinTierTemplates,
  lcjCoinPeerBonuses,
  lcjCoinBuybackPeriods,
  lcjCoinBuybackRequests,
  staff,
  livers,
  brandContracts,
  tspContracts,
  brands,
} from "../drizzle/schema";

// ============================================================
// Helper: Get all settings as key-value map
// ============================================================
async function getSettingsMap(db: any): Promise<Record<string, string>> {
  const rows = await db.select().from(lcjCoinSettings);
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.settingKey] = r.settingValue;
  }
  return map;
}

// ============================================================
// Helper: Calculate current valuation
// Fiscal year: Aug ~ Jul (決算期7月)
// Formula: 当期全収益実績合計 × PSR
// ============================================================
function getFiscalYearRange(): { start: string; end: string; months: string[] } {
  const now = new Date();
  let fyStartYear: number;
  // Fiscal year starts in August
  if (now.getMonth() >= 7) { // Aug(7) ~ Dec(11)
    fyStartYear = now.getFullYear();
  } else { // Jan(0) ~ Jul(6)
    fyStartYear = now.getFullYear() - 1;
  }
  const start = `${fyStartYear}-08`;
  const end = `${fyStartYear + 1}-07`;
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(fyStartYear, 7 + i, 1); // Aug + i
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return { start, end, months };
}

function calculateValuationFromTotal(totalRevenue: number, psrMultiplier: number) {
  const valuation = totalRevenue * psrMultiplier;
  return { totalRevenue, valuation };
}

// ============================================================
// Helper: Calculate valuation from monthly revenue
// ============================================================
function calculateValuation(monthlyRevenue: number, psrMultiplier: number) {
  const annualRevenue = monthlyRevenue * 12;
  const valuation = annualRevenue * psrMultiplier;
  return { annualRevenue, valuation };
}

// ============================================================
// Helper: Calculate coin price
// ============================================================
function calculateCoinPrice(valuation: number, totalCoinsPool: number) {
  if (totalCoinsPool <= 0) return 0;
  return valuation / totalCoinsPool;
}

// ============================================================
// Helper: Calculate level from XP
// ============================================================
function calculateLevel(xp: number, xpPerLevel: number): number {
  return Math.floor(xp / xpPerLevel) + 1;
}

export const lcjCoinRouter = router({
  // ============================================================
  // Dashboard: Get overview data (with real GMV data)
  // ============================================================
  getDashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const settings = await getSettingsMap(db);
    const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
    const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
    const xpPerLevel = parseInt(settings.xp_per_level || "1000");
    const manualMonthlyRevenue = parseFloat(settings.monthly_revenue || "0");

    // ---- Fetch real GMV data from TikTok TAP reports ----
    let gmvMonthlyData: any[] = [];
    let totalAffiliateGmv = 0;
    let totalLcjCommission = 0;
    let latestMonthLcjCommission = 0;
    let latestMonthGmv = 0;
    let avgMonthlyCommission = 0;
    try {
      gmvMonthlyData = await getTiktokTapMonthlySummary(0); // 0 = all brands
      for (const m of gmvMonthlyData) {
        totalAffiliateGmv += Number(m.totalAffiliateGmv || 0);
        totalLcjCommission += Number(m.totalActualPartnerCommission || 0);
      }
      if (gmvMonthlyData.length > 0) {
        // Latest month data
        latestMonthGmv = Number(gmvMonthlyData[0].totalAffiliateGmv || 0);
        latestMonthLcjCommission = Number(gmvMonthlyData[0].totalActualPartnerCommission || 0);
        // Average of last 3 months for stable calculation
        const recentMonths = gmvMonthlyData.slice(0, 3);
        const recentCommissionSum = recentMonths.reduce((s: number, m: any) => s + Number(m.totalActualPartnerCommission || 0), 0);
        avgMonthlyCommission = recentCommissionSum / recentMonths.length;
      }
    } catch (e) {
      console.error("[LCJ Coin] Failed to fetch GMV data:", e);
    }

    // ---- Fetch latest financial statement revenue ----
    let latestFinancialRevenue = 0;
    let latestFinancialMonthlyRevenue = 0;
    try {
      const [latestDoc] = await db
        .select()
        .from(lcjCoinDocuments)
        .where(and(
          eq(lcjCoinDocuments.documentType, "financial_statement"),
          eq(lcjCoinDocuments.isActive, true),
        ))
        .orderBy(desc(lcjCoinDocuments.createdAt))
        .limit(1);
      if (latestDoc && latestDoc.extractedRevenue) {
        latestFinancialRevenue = Number(latestDoc.extractedRevenue);
        // Calculate monthly average from period
        if (latestDoc.periodStart && latestDoc.periodEnd) {
          const start = new Date(latestDoc.periodStart);
          const end = new Date(latestDoc.periodEnd);
          const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
          latestFinancialMonthlyRevenue = latestFinancialRevenue / months;
        }
      }
    } catch (e) {
      console.error("[LCJ Coin] Failed to fetch financial data:", e);
    }

    // ---- Fetch brand contract & TSP details (with brand names) ----
    let brandContractMonthlyTotal = 0;
    let tspMonthlyTotal = 0;
    let activeBrandContractCount = 0;
    let activeTspContractCount = 0;
    let brandContractDetails: any[] = [];
    let tspContractDetails: any[] = [];
    try {
      // Brand contracts: get active contracts with brand names
      const allContracts = await db.select({
        id: brandContracts.id,
        brandId: brandContracts.brandId,
        fixedFee: brandContracts.fixedFee,
        commissionRate: brandContracts.commissionRate,
        startDate: brandContracts.startDate,
        endDate: brandContracts.endDate,
        serviceType: brandContracts.serviceType,
        contractPeriodLabel: brandContracts.contractPeriodLabel,
        currency: brandContracts.currency,
        brandName: brands.name,
      }).from(brandContracts)
        .leftJoin(brands, eq(brandContracts.brandId, brands.id))
        .where(and(
          eq(brandContracts.status, "契約中"),
          isNull(brandContracts.deletedAt)
        ));
      activeBrandContractCount = allContracts.length;
      for (const c of allContracts) {
        let monthlyAmount = 0;
        let contractMonths = 0;
        const isSingleEvent = (c.serviceType || "").includes("単発");
        if (c.fixedFee) {
          if (c.startDate && c.endDate) {
            const start = new Date(c.startDate);
            const end = new Date(c.endDate);
            contractMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
            monthlyAmount = Number(c.fixedFee) / contractMonths;
          } else {
            contractMonths = 1;
            monthlyAmount = Number(c.fixedFee);
          }
          // Only include recurring/period contracts in monthly total (exclude 単発)
          if (!isSingleEvent) {
            brandContractMonthlyTotal += monthlyAmount;
          }
        }
        brandContractDetails.push({
          id: c.id,
          brandName: c.brandName || `Brand #${c.brandId}`,
          fixedFee: Number(c.fixedFee || 0),
          currency: c.currency || "JPY",
          commissionRate: c.commissionRate,
          startDate: c.startDate,
          endDate: c.endDate,
          contractMonths,
          monthlyAmount: Math.round(monthlyAmount),
          serviceType: c.serviceType,
          contractPeriodLabel: c.contractPeriodLabel,
          isSingleEvent,
        });
      }
    } catch (e) {
      console.error("[LCJ Coin] Failed to fetch brand contracts:", e);
    }
    try {
      // TSP contracts: get active contracts with details
      const activeTsp = await db.select().from(tspContracts).where(eq(tspContracts.status, "active"));
      activeTspContractCount = activeTsp.length;
      for (const c of activeTsp) {
        const monthly = Number(c.monthlyAmount || 0);
        tspMonthlyTotal += monthly;
        tspContractDetails.push({
          id: c.id,
          shopName: c.shopName,
          companyName: c.companyName,
          monthlyAmount: monthly,
          contractStartDate: c.contractStartDate,
          contractEndDate: c.contractEndDate,
        });
      }
    } catch (e) {
      console.error("[LCJ Coin] Failed to fetch TSP contracts:", e);
    }

    // ---- Calculate valuation (当期実績ベース) ----
    // 決算期: 7月 → 会計年度: 8月〜翌7月
    // 計算式: 当期全収益実績合計 × PSR
    const fiscalYear = getFiscalYearRange();
    
    // Build monthly revenue data for fiscal year
    const commissionByMonth: Record<string, number> = {};
    for (const m of gmvMonthlyData) {
      commissionByMonth[m.reportMonth] = Number(m.totalActualPartnerCommission || 0);
    }
    
    // Calculate brand contract revenue per month for fiscal year
    const brandByMonthFY: Record<string, { recurring: number; single: number }> = {};
    for (const month of fiscalYear.months) {
      brandByMonthFY[month] = { recurring: 0, single: 0 };
    }
    for (const c of brandContractDetails) {
      if (!c.fixedFee) continue;
      if (c.startDate && c.endDate) {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        const contractMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
        const monthlyAmt = Number(c.fixedFee) / contractMonths;
        for (const month of fiscalYear.months) {
          const [y, m] = month.split('-').map(Number);
          const monthStart = new Date(y, m - 1, 1);
          const monthEnd = new Date(y, m, 0);
          if (start <= monthEnd && end >= monthStart) {
            if (c.isSingleEvent) {
              brandByMonthFY[month].single += monthlyAmt;
            } else {
              brandByMonthFY[month].recurring += monthlyAmt;
            }
          }
        }
      } else {
        // No dates - assume current month
        const currentMonth = fiscalYear.months.find(m => {
          const now = new Date();
          return m === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        });
        if (currentMonth) {
          if (c.isSingleEvent) {
            brandByMonthFY[currentMonth].single += Number(c.fixedFee);
          } else {
            brandByMonthFY[currentMonth].recurring += Number(c.fixedFee);
          }
        }
      }
    }
    
    // TSP by month for fiscal year
    const tspByMonthFY: Record<string, number> = {};
    for (const month of fiscalYear.months) {
      tspByMonthFY[month] = 0;
    }
    for (const c of tspContractDetails) {
      for (const month of fiscalYear.months) {
        const [y, m] = month.split('-').map(Number);
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0);
        const cStart = c.contractStartDate ? new Date(c.contractStartDate) : new Date(0);
        const cEnd = c.contractEndDate ? new Date(c.contractEndDate) : new Date(2099, 11, 31);
        if (cStart <= monthEnd && cEnd >= monthStart) {
          tspByMonthFY[month] += c.monthlyAmount;
        }
      }
    }
    
    // Sum up fiscal year total (only months up to current month)
    const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    let fiscalYearTotal = 0;
    let fiscalYearMonthsWithData = 0;
    const fiscalYearMonthlyBreakdown: Array<{ month: string; lcjCommission: number; brandRecurring: number; brandSingle: number; tsp: number; total: number }> = [];
    for (const month of fiscalYear.months) {
      if (month > nowMonth) break; // Don't include future months
      const lcj = commissionByMonth[month] || 0;
      const brandRec = brandByMonthFY[month]?.recurring || 0;
      const brandSng = brandByMonthFY[month]?.single || 0;
      const tsp = tspByMonthFY[month] || 0;
      const monthTotal = lcj + brandRec + brandSng + tsp;
      fiscalYearTotal += monthTotal;
      if (monthTotal > 0) fiscalYearMonthsWithData++;
      fiscalYearMonthlyBreakdown.push({ month, lcjCommission: Math.round(lcj), brandRecurring: Math.round(brandRec), brandSingle: Math.round(brandSng), tsp: Math.round(tsp), total: Math.round(monthTotal) });
    }
    
    // Valuation = fiscal year total revenue × PSR
    const { totalRevenue: fyTotalRevenue, valuation } = calculateValuationFromTotal(Math.round(fiscalYearTotal), psrMultiplier);
    const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);
    
    // Keep individual monthly for reference display
    const totalIndividualMonthly = Math.round(avgMonthlyCommission) + Math.round(brandContractMonthlyTotal) + tspMonthlyTotal;
    const monthlyRevenue = totalIndividualMonthly;

    // Get total issued coins
    const [issuedResult] = await db
      .select({ total: sum(lcjCoinHoldings.totalCoins) })
      .from(lcjCoinHoldings);
    const totalIssuedCoins = Number(issuedResult?.total || 0);

    // Get total holders count
    const [holdersResult] = await db
      .select({ count: count() })
      .from(lcjCoinHoldings);
    const totalHolders = holdersResult?.count || 0;

    // Get latest valuation log entries
    const valuationHistory = await db
      .select()
      .from(lcjCoinValuationLog)
      .orderBy(desc(lcjCoinValuationLog.yearMonth))
      .limit(12);

    // Get active season
    const [activeSeason] = await db
      .select()
      .from(lcjCoinSeasons)
      .where(eq(lcjCoinSeasons.status, "active"))
      .limit(1);

    // Get shareholders
    const shareholders = await db
      .select()
      .from(lcjCoinShareholders)
      .where(eq(lcjCoinShareholders.isActive, true))
      .orderBy(desc(lcjCoinShareholders.shares));
    const totalShares = shareholders.reduce((s: number, sh: any) => s + sh.shares, 0);

    return {
      valuation: {
        monthlyRevenue,
        annualRevenue: fyTotalRevenue,
        psrMultiplier,
        valuationAmount: valuation,
        coinPrice,
        totalCoinsPool,
        totalIssuedCoins,
        remainingCoins: totalCoinsPool - totalIssuedCoins,
        fiscalYear: {
          start: fiscalYear.start,
          end: fiscalYear.end,
          totalRevenue: fyTotalRevenue,
          monthsWithData: fiscalYearMonthsWithData,
          totalMonths: fiscalYearMonthlyBreakdown.length,
        },
      },
      gmv: {
        totalAffiliateGmv,
        totalLcjCommission,
        latestMonthGmv,
        latestMonthLcjCommission,
        avgMonthlyCommission,
        monthlyData: gmvMonthlyData.slice(0, 12).map((m: any) => ({
          month: m.reportMonth,
          affiliateGmv: Number(m.totalAffiliateGmv || 0),
          liveGmv: Number(m.totalLiveGmv || 0),
          videoGmv: Number(m.totalVideoGmv || 0),
          lcjCommission: Number(m.totalActualPartnerCommission || 0),
          orders: Number(m.totalOrders || 0),
          liveViews: Number(m.totalLiveViews || 0),
        })),
      },
      financial: {
        latestRevenue: latestFinancialRevenue,
        monthlyRevenue: latestFinancialMonthlyRevenue,
        manualMonthlyRevenue,
      },
      referenceSources: {
        brandContract: {
          monthlyTotal: Math.round(brandContractMonthlyTotal),
          activeCount: activeBrandContractCount,
        },
        tsp: {
          monthlyTotal: tspMonthlyTotal,
          activeCount: activeTspContractCount,
        },
        lcjCommission: {
          monthlyAvg: Math.round(avgMonthlyCommission),
        },
        totalIndividualMonthly,
      },
      shareholders: {
        totalShares,
        pricePerShare: totalShares > 0 ? valuation / totalShares : 0,
        count: shareholders.length,
      },
      stats: {
        totalHolders,
        xpPerLevel,
      },
      valuationHistoryCount: valuationHistory.length,
      latestValuationHistory: valuationHistory.slice(0, 3),
      activeSeason: activeSeason || null,
    };
  }),

  // ============================================================
  // Brand Contract Details (separate endpoint to avoid large response)
  // ============================================================
  getBrandContractDetails: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { details: [] };
    try {
      const allContracts = await db.select({
        id: brandContracts.id,
        brandId: brandContracts.brandId,
        fixedFee: brandContracts.fixedFee,
        commissionRate: brandContracts.commissionRate,
        startDate: brandContracts.startDate,
        endDate: brandContracts.endDate,
        serviceType: brandContracts.serviceType,
        contractPeriodLabel: brandContracts.contractPeriodLabel,
        currency: brandContracts.currency,
        brandName: brands.name,
      }).from(brandContracts)
        .leftJoin(brands, eq(brandContracts.brandId, brands.id))
        .where(and(
          eq(brandContracts.status, "契約中"),
          isNull(brandContracts.deletedAt)
        ));
      return {
        details: allContracts.map((c) => {
          let monthlyAmount = 0;
          let contractMonths = 0;
          if (c.fixedFee) {
            if (c.startDate && c.endDate) {
              const start = new Date(c.startDate);
              const end = new Date(c.endDate);
              contractMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
              monthlyAmount = Number(c.fixedFee) / contractMonths;
            } else {
              contractMonths = 1;
              monthlyAmount = Number(c.fixedFee);
            }
          }
          const isSingleEvent = (c.serviceType || "").includes("単発");
          return {
            id: c.id,
            brandName: c.brandName || `Brand #${c.brandId}`,
            fixedFee: Number(c.fixedFee || 0),
            currency: c.currency || "JPY",
            commissionRate: c.commissionRate,
            startDate: c.startDate,
            endDate: c.endDate,
            contractMonths,
            monthlyAmount: Math.round(monthlyAmount),
            serviceType: c.serviceType,
            contractPeriodLabel: c.contractPeriodLabel,
            isSingleEvent,
          };
        }),
      };
    } catch (e) {
      console.error("[LCJ Coin] getBrandContractDetails error:", e);
      return { details: [] };
    }
  }),

  // ============================================================
  // TSP Contract Details (separate endpoint to avoid large response)
  // ============================================================
  getTspContractDetails: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { details: [] };
    try {
      const activeTsp = await db.select().from(tspContracts).where(eq(tspContracts.status, "active"));
      return {
        details: activeTsp.map((c) => ({
          id: c.id,
          shopName: c.shopName,
          companyName: c.companyName,
          monthlyAmount: Number(c.monthlyAmount || 0),
          contractStartDate: c.contractStartDate,
          contractEndDate: c.contractEndDate,
        })),
      };
    } catch (e) {
      console.error("[LCJ Coin] getTspContractDetails error:", e);
      return { details: [] };
    }
  }),

  // ============================================================
  // Monthly Revenue Breakdown (月別収益推移)
  // ============================================================
  getMonthlyRevenueBreakdown: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { months: [] };
    try {
      // 1. Get LCJ commission by month from TikTok TAP
      const gmvMonthlyData = await getTiktokTapMonthlySummary(0);
      const commissionByMonth: Record<string, number> = {};
      for (const m of gmvMonthlyData) {
        commissionByMonth[m.reportMonth] = Number(m.totalActualPartnerCommission || 0);
      }

      // 2. Get all active brand contracts
      const allContracts = await db.select({
        id: brandContracts.id,
        fixedFee: brandContracts.fixedFee,
        startDate: brandContracts.startDate,
        endDate: brandContracts.endDate,
        serviceType: brandContracts.serviceType,
        currency: brandContracts.currency,
      }).from(brandContracts)
        .where(and(
          eq(brandContracts.status, "\u5951\u7d04\u4e2d"),
          isNull(brandContracts.deletedAt)
        ));

      // 3. Get active TSP contracts
      const activeTsp = await db.select().from(tspContracts).where(eq(tspContracts.status, "active"));
      const tspMonthly = activeTsp.reduce((s, c) => s + Number(c.monthlyAmount || 0), 0);

      // Build month list (last 12 months)
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      // Calculate brand contract revenue per month
      const brandByMonth: Record<string, { recurring: number; single: number }> = {};
      for (const month of months) {
        brandByMonth[month] = { recurring: 0, single: 0 };
      }
      for (const c of allContracts) {
        if (!c.fixedFee) continue;
        const isSingle = (c.serviceType || "").includes("\u5358\u767a");
        const fee = Number(c.fixedFee);
        if (c.startDate && c.endDate) {
          const start = new Date(c.startDate);
          const end = new Date(c.endDate);
          const contractMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
          const monthlyAmt = fee / contractMonths;
          // Distribute to each month the contract is active
          for (const month of months) {
            const [y, m] = month.split("-").map(Number);
            const monthStart = new Date(y, m - 1, 1);
            const monthEnd = new Date(y, m, 0); // last day of month
            if (start <= monthEnd && end >= monthStart) {
              if (isSingle) {
                brandByMonth[month].single += monthlyAmt;
              } else {
                brandByMonth[month].recurring += monthlyAmt;
              }
            }
          }
        } else {
          // No dates - assume current month only
          const currentMonth = months[0];
          if (isSingle) {
            brandByMonth[currentMonth].single += fee;
          } else {
            brandByMonth[currentMonth].recurring += fee;
          }
        }
      }

      // TSP: assume same monthly amount for all months where contracts are active
      // (simplified - TSP contracts have start/end dates too)
      const tspByMonth: Record<string, number> = {};
      for (const month of months) {
        tspByMonth[month] = 0;
      }
      for (const c of activeTsp) {
        const monthly = Number(c.monthlyAmount || 0);
        for (const month of months) {
          const [y, m] = month.split("-").map(Number);
          const monthStart = new Date(y, m - 1, 1);
          const monthEnd = new Date(y, m, 0);
          const cStart = c.contractStartDate ? new Date(c.contractStartDate) : new Date(0);
          const cEnd = c.contractEndDate ? new Date(c.contractEndDate) : new Date(2099, 11, 31);
          if (cStart <= monthEnd && cEnd >= monthStart) {
            tspByMonth[month] += monthly;
          }
        }
      }

      return {
        months: months.map((month) => ({
          month,
          lcjCommission: Math.round(commissionByMonth[month] || 0),
          brandRecurring: Math.round(brandByMonth[month]?.recurring || 0),
          brandSingle: Math.round(brandByMonth[month]?.single || 0),
          tsp: Math.round(tspByMonth[month] || 0),
          total: Math.round(
            (commissionByMonth[month] || 0) +
            (brandByMonth[month]?.recurring || 0) +
            (brandByMonth[month]?.single || 0) +
            (tspByMonth[month] || 0)
          ),
          totalRecurring: Math.round(
            (commissionByMonth[month] || 0) +
            (brandByMonth[month]?.recurring || 0) +
            (tspByMonth[month] || 0)
          ),
        })),
      };
    } catch (e) {
      console.error("[LCJ Coin] getMonthlyRevenueBreakdown error:", e);
      return { months: [] };
    }
  }),

  // ============================================================
  // My Portfolio: Get current user's coin data
  // ============================================================
  getMyPortfolio: protectedProcedure
    .input(z.object({
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settings = await getSettingsMap(db);
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const xpPerLevel = parseInt(settings.xp_per_level || "1000");

      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      // Get holding
      const [holding] = await db
        .select()
        .from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, input.holderType),
          eq(lcjCoinHoldings.holderId, input.holderId),
        ))
        .limit(1);

      if (!holding) {
        return {
          holding: null,
          coinPrice,
          totalValue: 0,
          vestedValue: 0,
          unvestedValue: 0,
          level: 1,
          xpToNextLevel: xpPerLevel,
          xpProgress: 0,
          vestingSchedules: [],
          recentTransactions: [],
          badges: [],
        };
      }

      const totalValue = holding.totalCoins * coinPrice;
      const vestedValue = holding.vestedCoins * coinPrice;
      const unvestedValue = (holding.totalCoins - holding.vestedCoins) * coinPrice;
      const level = calculateLevel(holding.xp, xpPerLevel);
      const xpInCurrentLevel = holding.xp % xpPerLevel;

      // Get vesting schedules
      const vestingSchedules = await db
        .select()
        .from(lcjCoinVestingSchedules)
        .where(eq(lcjCoinVestingSchedules.holdingId, holding.id))
        .orderBy(desc(lcjCoinVestingSchedules.grantDate));

      // Get recent transactions
      const recentTransactions = await db
        .select()
        .from(lcjCoinTransactions)
        .where(eq(lcjCoinTransactions.holdingId, holding.id))
        .orderBy(desc(lcjCoinTransactions.createdAt))
        .limit(20);

      // Get badges
      const badgeAwards = await db
        .select({
          award: lcjCoinBadgeAwards,
          badge: lcjCoinBadges,
        })
        .from(lcjCoinBadgeAwards)
        .innerJoin(lcjCoinBadges, eq(lcjCoinBadgeAwards.badgeId, lcjCoinBadges.id))
        .where(and(
          eq(lcjCoinBadgeAwards.holderType, input.holderType),
          eq(lcjCoinBadgeAwards.holderId, input.holderId),
        ));

      return {
        holding,
        coinPrice,
        totalValue,
        vestedValue,
        unvestedValue,
        level,
        xpToNextLevel: xpPerLevel - xpInCurrentLevel,
        xpProgress: (xpInCurrentLevel / xpPerLevel) * 100,
        vestingSchedules,
        recentTransactions,
        badges: badgeAwards.map(ba => ({ ...ba.badge, awardedAt: ba.award.awardedAt })),
      };
    }),

  // ============================================================
  // Leaderboard: Get ranking
  // ============================================================
  getLeaderboard: protectedProcedure
    .input(z.object({
      sortBy: z.enum(["totalValue", "level", "xp", "streak"]).default("totalValue"),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const sortBy = input?.sortBy || "totalValue";
      const limit = input?.limit || 20;

      const settings = await getSettingsMap(db);
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      const holdings = await db
        .select()
        .from(lcjCoinHoldings)
        .orderBy(
          sortBy === "level" ? desc(lcjCoinHoldings.level) :
          sortBy === "xp" ? desc(lcjCoinHoldings.xp) :
          sortBy === "streak" ? desc(lcjCoinHoldings.streak) :
          desc(lcjCoinHoldings.totalCoins)
        )
        .limit(limit);

      // Enrich with names
      const enriched = await Promise.all(holdings.map(async (h, idx) => {
        let name = "Unknown";
        let avatarUrl = null;
        if (h.holderType === "staff") {
          const [s] = await db.select({ name: staff.name, avatarUrl: staff.avatarUrl }).from(staff).where(eq(staff.id, h.holderId)).limit(1);
          if (s) { name = s.name; avatarUrl = s.avatarUrl; }
        } else {
          const [l] = await db.select({ name: livers.name, avatarUrl: livers.avatarUrl }).from(livers).where(eq(livers.id, h.holderId)).limit(1);
          if (l) { name = l.name; avatarUrl = l.avatarUrl; }
        }
        return {
          rank: idx + 1,
          ...h,
          name,
          avatarUrl,
          totalValue: h.totalCoins * coinPrice,
          vestedValue: h.vestedCoins * coinPrice,
        };
      }));

      return { leaderboard: enriched, coinPrice };
    }),

  // ============================================================
  // Badges: Get all available badges
  // ============================================================
  getAllBadges: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db.select().from(lcjCoinBadges).where(eq(lcjCoinBadges.isActive, true)).orderBy(asc(lcjCoinBadges.sortOrder));
  }),

  // ============================================================
  // Seasons: Get all seasons
  // ============================================================
  getSeasons: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db.select().from(lcjCoinSeasons).orderBy(desc(lcjCoinSeasons.startDate));
  }),

  // ============================================================
  // Admin: Get all settings
  // ============================================================
  getSettings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db.select().from(lcjCoinSettings).orderBy(asc(lcjCoinSettings.category));
  }),

  // ============================================================
  // Admin: Update setting
  // ============================================================
  updateSetting: protectedProcedure
    .input(z.object({
      settingKey: z.string(),
      settingValue: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(lcjCoinSettings)
        .set({ settingValue: input.settingValue })
        .where(eq(lcjCoinSettings.settingKey, input.settingKey));
      return { success: true };
    }),

  // ============================================================
  // Admin: Record monthly valuation
  // ============================================================
  recordValuation: protectedProcedure
    .input(z.object({
      yearMonth: z.string(),
      monthlyRevenue: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settings = await getSettingsMap(db);
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");

      const { valuation } = calculateValuation(input.monthlyRevenue, psrMultiplier);

      // Get total issued coins
      const [issuedResult] = await db
        .select({ total: sum(lcjCoinHoldings.totalCoins) })
        .from(lcjCoinHoldings);
      const totalIssuedCoins = Number(issuedResult?.total || 0);
      const coinPrice = calculateCoinPrice(valuation, totalIssuedCoins > 0 ? totalIssuedCoins : totalCoinsPool);

      await db.insert(lcjCoinValuationLog).values({
        yearMonth: input.yearMonth,
        monthlyRevenue: String(input.monthlyRevenue),
        psrMultiplier: String(psrMultiplier),
        valuationAmount: String(valuation),
        totalCoinsIssued: totalIssuedCoins,
        coinPrice: String(coinPrice),
        notes: input.notes,
      });

      // Also update monthly_revenue setting
      await db
        .update(lcjCoinSettings)
        .set({ settingValue: String(input.monthlyRevenue) })
        .where(eq(lcjCoinSettings.settingKey, "monthly_revenue"));

      return { success: true, valuation, coinPrice };
    }),

  // ============================================================
  // Admin: Grant coins to a holder
  // ============================================================
  grantCoins: protectedProcedure
    .input(z.object({
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
      coinAmount: z.number().min(1),
      reason: z.string().optional(),
      vestingType: z.enum(["backloaded", "frontloaded", "flat", "custom"]).default("backloaded"),
      vestingRates: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settings = await getSettingsMap(db);
      const defaultVestingType = settings.default_vesting_type || "backloaded";
      const defaultVestingRates = JSON.parse(settings.default_vesting_rates || '{"year1":5,"year2":15,"year3":40,"year4":40}');
      const vestingPeriodMonths = parseInt(settings.vesting_period_months || "48");
      const cliffMonths = parseInt(settings.cliff_months || "12");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      // Get or create holding - use atomic update
      let [holding] = await db
        .select()
        .from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, input.holderType),
          eq(lcjCoinHoldings.holderId, input.holderId),
        ))
        .limit(1);

      if (!holding) {
        const [result] = await db.insert(lcjCoinHoldings).values({
          holderType: input.holderType,
          holderId: input.holderId,
          totalCoins: input.coinAmount,
          vestedCoins: 0,
          exercisedCoins: 0,
          level: 1,
          xp: 100, // Initial XP for first grant
          streak: 0,
        });
        const holdingId = result.insertId;
        [holding] = await db.select().from(lcjCoinHoldings).where(eq(lcjCoinHoldings.id, Number(holdingId))).limit(1);
      } else {
        // CRITICAL: Use atomic SQL update (SET col = col + ?)
        await db.execute(
          sql`UPDATE lcj_coin_holdings SET totalCoins = totalCoins + ${input.coinAmount}, xp = xp + 100 WHERE id = ${holding.id}`
        );
        // Re-fetch
        [holding] = await db.select().from(lcjCoinHoldings).where(eq(lcjCoinHoldings.id, holding.id)).limit(1);
      }

      // Create vesting schedule
      const vestingType = input.vestingType || defaultVestingType;
      const vestingRates = input.vestingRates || defaultVestingRates;
      const grantDate = new Date();
      const nextVestDate = new Date(grantDate);
      nextVestDate.setMonth(nextVestDate.getMonth() + cliffMonths);

      await db.insert(lcjCoinVestingSchedules).values({
        holdingId: holding.id,
        holderType: input.holderType,
        holderId: input.holderId,
        grantDate,
        totalGrantCoins: input.coinAmount,
        vestingType: vestingType as any,
        vestingRates,
        vestingPeriodMonths,
        cliffMonths,
        vestedSoFar: 0,
        nextVestDate,
        status: "active",
      });

      // Record transaction
      await db.insert(lcjCoinTransactions).values({
        holdingId: holding.id,
        holderType: input.holderType,
        holderId: input.holderId,
        transactionType: "grant",
        coinAmount: input.coinAmount,
        coinPriceAtTime: String(coinPrice),
        reason: input.reason || "Initial grant",
      });

      return { success: true, holdingId: holding.id, coinAmount: input.coinAmount };
    }),

  // ============================================================
  // Admin: Bulk grant coins to all staff + livers
  // ============================================================
  bulkGrantCoins: protectedProcedure
    .input(z.object({
      coinAmountPerPerson: z.number().min(1),
      reason: z.string().optional(),
      vestingType: z.enum(["backloaded", "frontloaded", "flat", "custom"]).default("backloaded"),
      targetType: z.enum(["all", "staff_only", "liver_only"]).default("all"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settings = await getSettingsMap(db);
      const defaultVestingRates = JSON.parse(settings.default_vesting_rates || '{"year1":5,"year2":15,"year3":40,"year4":40}');
      const vestingPeriodMonths = parseInt(settings.vesting_period_months || "48");
      const cliffMonths = parseInt(settings.cliff_months || "12");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      let grantedCount = 0;
      const targets: { holderType: "staff" | "liver"; holderId: number }[] = [];

      // Get all active staff
      if (input.targetType === "all" || input.targetType === "staff_only") {
        const staffList = await db
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.isActive, "active"));
        for (const s of staffList) {
          targets.push({ holderType: "staff", holderId: s.id });
        }
      }

      // Get all active livers
      if (input.targetType === "all" || input.targetType === "liver_only") {
        const liverList = await db
          .select({ id: livers.id })
          .from(livers)
          .where(eq(livers.isActive, true));
        for (const l of liverList) {
          targets.push({ holderType: "liver", holderId: l.id });
        }
      }

      // Grant to each target
      for (const target of targets) {
        try {
          let [holding] = await db
            .select()
            .from(lcjCoinHoldings)
            .where(and(
              eq(lcjCoinHoldings.holderType, target.holderType),
              eq(lcjCoinHoldings.holderId, target.holderId),
            ))
            .limit(1);

          if (!holding) {
            const [result] = await db.insert(lcjCoinHoldings).values({
              holderType: target.holderType,
              holderId: target.holderId,
              totalCoins: input.coinAmountPerPerson,
              vestedCoins: 0,
              exercisedCoins: 0,
              level: 1,
              xp: 100,
              streak: 0,
            });
            const holdingId = result.insertId;
            [holding] = await db.select().from(lcjCoinHoldings).where(eq(lcjCoinHoldings.id, Number(holdingId))).limit(1);
          } else {
            await db.execute(
              sql`UPDATE lcj_coin_holdings SET totalCoins = totalCoins + ${input.coinAmountPerPerson}, xp = xp + 100 WHERE id = ${holding.id}`
            );
            [holding] = await db.select().from(lcjCoinHoldings).where(eq(lcjCoinHoldings.id, holding.id)).limit(1);
          }

          // Create vesting schedule
          const grantDate = new Date();
          const nextVestDate = new Date(grantDate);
          nextVestDate.setMonth(nextVestDate.getMonth() + cliffMonths);

          await db.insert(lcjCoinVestingSchedules).values({
            holdingId: holding.id,
            holderType: target.holderType,
            holderId: target.holderId,
            grantDate,
            totalGrantCoins: input.coinAmountPerPerson,
            vestingType: input.vestingType as any,
            vestingRates: defaultVestingRates,
            vestingPeriodMonths,
            cliffMonths,
            vestedSoFar: 0,
            nextVestDate,
            status: "active",
          });

          // Record transaction
          await db.insert(lcjCoinTransactions).values({
            holdingId: holding.id,
            holderType: target.holderType,
            holderId: target.holderId,
            transactionType: "grant",
            coinAmount: input.coinAmountPerPerson,
            coinPriceAtTime: String(coinPrice),
            reason: input.reason || "Bulk grant",
          });

          grantedCount++;
        } catch (e) {
          console.error(`[LCJ Coin] Failed to grant to ${target.holderType}:${target.holderId}`, e);
        }
      }

      return { success: true, grantedCount, totalTargets: targets.length };
    }),

  // ============================================================
  // Admin: Get all holders with details
  // HRスタッフ全員 + ライバー全員を表示（コイン未付与でも一覧表示）
  // ============================================================
  getAllHolders: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(100),
      search: z.string().optional(),
      filterType: z.enum(["all", "staff", "liver"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const page = input?.page || 1;
      const limit = input?.limit || 100;
      const offset = (page - 1) * limit;
      const search = input?.search?.toLowerCase() || "";
      const filterType = input?.filterType || "all";

      const settings = await getSettingsMap(db);
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      // 1. 全アクティブスタッフを取得
      const allStaff = filterType === "liver" ? [] : await db
        .select({
          id: staff.id,
          name: staff.name,
          department: staff.department,
          avatarUrl: staff.avatarUrl,
          position: staff.position,
        })
        .from(staff)
        .where(eq(staff.isActive, "active"));

      // 2. 全アクティブライバーを取得
      const allLivers = filterType === "staff" ? [] : await db
        .select({
          id: livers.id,
          name: livers.name,
          avatarUrl: livers.avatarUrl,
        })
        .from(livers)
        .where(eq(livers.isActive, true));

      // 3. 全holdingsデータを取得
      const allHoldings = await db.select().from(lcjCoinHoldings);
      const holdingsMap = new Map<string, typeof allHoldings[0]>();
      for (const h of allHoldings) {
        holdingsMap.set(`${h.holderType}_${h.holderId}`, h);
      }

      // 4. スタッフとライバーをマージ
      type MergedHolder = {
        id: number | null;
        holderType: "staff" | "liver";
        holderId: number;
        name: string;
        avatarUrl: string | null;
        department: string | null;
        position: string | null;
        totalCoins: number;
        vestedCoins: number;
        exercisedCoins: number;
        level: number;
        xp: number;
        streak: number;
        totalValue: number;
        vestedValue: number;
        hasHolding: boolean;
      };

      const merged: MergedHolder[] = [];

      for (const s of allStaff) {
        const holding = holdingsMap.get(`staff_${s.id}`);
        merged.push({
          id: holding?.id || null,
          holderType: "staff",
          holderId: s.id,
          name: s.name,
          avatarUrl: s.avatarUrl,
          department: s.department,
          position: s.position,
          totalCoins: holding?.totalCoins || 0,
          vestedCoins: holding?.vestedCoins || 0,
          exercisedCoins: holding?.exercisedCoins || 0,
          level: holding?.level || 0,
          xp: holding?.xp || 0,
          streak: holding?.streak || 0,
          totalValue: (holding?.totalCoins || 0) * coinPrice,
          vestedValue: (holding?.vestedCoins || 0) * coinPrice,
          hasHolding: !!holding,
        });
      }

      for (const l of allLivers) {
        const holding = holdingsMap.get(`liver_${l.id}`);
        merged.push({
          id: holding?.id || null,
          holderType: "liver",
          holderId: l.id,
          name: l.name,
          avatarUrl: l.avatarUrl,
          department: "ライバー",
          position: null,
          totalCoins: holding?.totalCoins || 0,
          vestedCoins: holding?.vestedCoins || 0,
          exercisedCoins: holding?.exercisedCoins || 0,
          level: holding?.level || 0,
          xp: holding?.xp || 0,
          streak: holding?.streak || 0,
          totalValue: (holding?.totalCoins || 0) * coinPrice,
          vestedValue: (holding?.vestedCoins || 0) * coinPrice,
          hasHolding: !!holding,
        });
      }

      // 5. 検索フィルタ
      let filtered = merged;
      if (search) {
        filtered = merged.filter(h =>
          h.name.toLowerCase().includes(search) ||
          (h.department || "").toLowerCase().includes(search)
        );
      }

      // 6. ソート: コイン保有者を先に（totalCoins降順）、未付与は最後
      filtered.sort((a, b) => {
        if (a.hasHolding && !b.hasHolding) return -1;
        if (!a.hasHolding && b.hasHolding) return 1;
        if (a.totalCoins !== b.totalCoins) return b.totalCoins - a.totalCoins;
        return a.name.localeCompare(b.name);
      });

      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);

      return {
        holders: paged,
        total,
        coinPrice,
      };
    }),

  // ============================================================
  // Admin: Create/Update badge
  // ============================================================
  upsertBadge: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string(),
      nameEn: z.string().optional(),
      description: z.string().optional(),
      iconEmoji: z.string().optional(),
      category: z.enum(["performance", "loyalty", "special", "season", "social"]).default("performance"),
      rarity: z.enum(["common", "rare", "epic", "legendary"]).default("common"),
      xpReward: z.number().default(0),
      coinReward: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      if (input.id) {
        await db.update(lcjCoinBadges).set({
          name: input.name,
          nameEn: input.nameEn,
          description: input.description,
          iconEmoji: input.iconEmoji,
          category: input.category,
          rarity: input.rarity,
          xpReward: input.xpReward,
          coinReward: input.coinReward,
        }).where(eq(lcjCoinBadges.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(lcjCoinBadges).values({
          name: input.name,
          nameEn: input.nameEn,
          description: input.description,
          iconEmoji: input.iconEmoji,
          category: input.category,
          rarity: input.rarity,
          xpReward: input.xpReward,
          coinReward: input.coinReward,
        });
        return { success: true, id: result.insertId };
      }
    }),

  // ============================================================
  // Admin: Award badge to holder
  // ============================================================
  awardBadge: protectedProcedure
    .input(z.object({
      badgeId: z.number(),
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Check if already awarded
      const [existing] = await db
        .select()
        .from(lcjCoinBadgeAwards)
        .where(and(
          eq(lcjCoinBadgeAwards.badgeId, input.badgeId),
          eq(lcjCoinBadgeAwards.holderType, input.holderType),
          eq(lcjCoinBadgeAwards.holderId, input.holderId),
        ))
        .limit(1);

      if (existing) {
        return { success: false, message: "Badge already awarded" };
      }

      // Get badge info for rewards
      const [badge] = await db.select().from(lcjCoinBadges).where(eq(lcjCoinBadges.id, input.badgeId)).limit(1);
      if (!badge) throw new Error("Badge not found");

      // Award badge
      await db.insert(lcjCoinBadgeAwards).values({
        badgeId: input.badgeId,
        holderType: input.holderType,
        holderId: input.holderId,
      });

      // Apply XP and coin rewards using atomic update
      if (badge.xpReward > 0 || badge.coinReward > 0) {
        await db.execute(
          sql`UPDATE lcj_coin_holdings 
              SET xp = xp + ${badge.xpReward}, totalCoins = totalCoins + ${Number(badge.coinReward)}
              WHERE holderType = ${input.holderType} AND holderId = ${input.holderId}`
        );

        // Record coin reward transaction if any
        if (badge.coinReward > 0) {
          const [holding] = await db
            .select()
            .from(lcjCoinHoldings)
            .where(and(
              eq(lcjCoinHoldings.holderType, input.holderType),
              eq(lcjCoinHoldings.holderId, input.holderId),
            ))
            .limit(1);

          if (holding) {
            await db.insert(lcjCoinTransactions).values({
              holdingId: holding.id,
              holderType: input.holderType,
              holderId: input.holderId,
              transactionType: "achievement",
              coinAmount: Number(badge.coinReward),
              reason: `Badge earned: ${badge.name}`,
            });
          }
        }
      }

      return { success: true };
    }),

  // ============================================================
  // Admin: Create/Update season
  // ============================================================
  upsertSeason: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string(),
      description: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      theme: z.string().optional(),
      bonusMultiplier: z.number().default(1),
      status: z.enum(["upcoming", "active", "ended"]).default("upcoming"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const data = {
        name: input.name,
        description: input.description,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        theme: input.theme,
        bonusMultiplier: String(input.bonusMultiplier),
        status: input.status as any,
      };

      if (input.id) {
        await db.update(lcjCoinSeasons).set(data).where(eq(lcjCoinSeasons.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(lcjCoinSeasons).values(data);
        return { success: true, id: result.insertId };
      }
    }),

  // ============================================================
  // Get all staff and livers for coin grant dropdown
  // ============================================================
  getGrantTargets: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const staffList = await db
      .select({ id: staff.id, name: staff.name, department: staff.department, avatarUrl: staff.avatarUrl })
      .from(staff)
      .where(eq(staff.isActive, "active"));

    const liverList = await db
      .select({ id: livers.id, name: livers.name, avatarUrl: livers.avatarUrl })
      .from(livers)
      .where(eq(livers.isActive, true));

    return {
      staff: staffList.map(s => ({ ...s, holderType: "staff" as const })),
      livers: liverList.map(l => ({ ...l, holderType: "liver" as const, department: "ライバー" })),
    };
  }),

  // ============================================================
  // Financial Documents: Upload
  // ============================================================
  uploadDocument: protectedProcedure
    .input(z.object({
      documentType: z.enum(["financial_statement", "shareholder_registry", "other"]),
      title: z.string(),
      fileName: z.string(),
      base64: z.string(),
      mimeType: z.string(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      extractedRevenue: z.number().optional(),
      extractedNetIncome: z.number().optional(),
      extractedTotalAssets: z.number().optional(),
      extractedNetAssets: z.number().optional(),
      notes: z.string().optional(),
      // For shareholder registry
      shareholders: z.array(z.object({
        shareholderNo: z.number().optional(),
        name: z.string(),
        shares: z.number(),
        ratio: z.string().optional(),
        shareType: z.string().optional(),
        acquisitionDate: z.string().optional(),
        address: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Upload file to S3
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "pdf";
      const fileKey = `lcj-coin-docs/${nanoid()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Insert document record
      const [result] = await db.insert(lcjCoinDocuments).values({
        documentType: input.documentType,
        title: input.title,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        extractedRevenue: input.extractedRevenue,
        extractedNetIncome: input.extractedNetIncome,
        extractedTotalAssets: input.extractedTotalAssets,
        extractedNetAssets: input.extractedNetAssets,
        notes: input.notes,
      });

      const documentId = Number(result.insertId);

      // If shareholder registry, insert shareholders
      if (input.documentType === "shareholder_registry" && input.shareholders) {
        // Deactivate old shareholders
        await db.execute(sql`UPDATE lcj_coin_shareholders SET isActive = 0`);
        
        for (const sh of input.shareholders) {
          await db.insert(lcjCoinShareholders).values({
            documentId,
            shareholderNo: sh.shareholderNo,
            name: sh.name,
            shares: sh.shares,
            ratio: sh.ratio,
            shareType: sh.shareType || "普通株式",
            acquisitionDate: sh.acquisitionDate,
            address: sh.address,
          });
        }
      }

      return { success: true, documentId, fileUrl: url };
    }),

  // ============================================================
  // Financial Documents: Get list
  // ============================================================
  getDocuments: protectedProcedure
    .input(z.object({
      documentType: z.string().optional(),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const conditions = [eq(lcjCoinDocuments.isActive, true)];
      if (input?.documentType) {
        conditions.push(eq(lcjCoinDocuments.documentType, input.documentType));
      }

      return db
        .select()
        .from(lcjCoinDocuments)
        .where(and(...conditions))
        .orderBy(desc(lcjCoinDocuments.createdAt))
        .limit(input?.limit || 20);
    }),

  // ============================================================
  // Financial Documents: Delete
  // ============================================================
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(lcjCoinDocuments).set({ isActive: false }).where(eq(lcjCoinDocuments.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // Shareholders: Get list
  // ============================================================
  getShareholders: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db
      .select()
      .from(lcjCoinShareholders)
      .where(eq(lcjCoinShareholders.isActive, true))
      .orderBy(desc(lcjCoinShareholders.shares));
  }),

  // ============================================================
  // Shareholders: Upsert
  // ============================================================
  upsertShareholder: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string(),
      shares: z.number(),
      ratio: z.string().optional(),
      shareType: z.string().optional(),
      acquisitionDate: z.string().optional(),
      address: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      if (input.id) {
        await db.update(lcjCoinShareholders).set({
          name: input.name,
          shares: input.shares,
          ratio: input.ratio,
          shareType: input.shareType,
          acquisitionDate: input.acquisitionDate,
          address: input.address,
        }).where(eq(lcjCoinShareholders.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(lcjCoinShareholders).values({
          name: input.name,
          shares: input.shares,
          ratio: input.ratio,
          shareType: input.shareType || "普通株式",
          acquisitionDate: input.acquisitionDate,
          address: input.address,
        });
        return { success: true, id: result.insertId };
      }
    }),

  // ============================================================
  // Shareholders: Delete
  // ============================================================
  deleteShareholder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(lcjCoinShareholders).set({ isActive: false }).where(eq(lcjCoinShareholders.id, input.id));
      return { success: true };
    }),

  // ============================================================
  // V3: Tier Templates - 取得
  // ============================================================
  getTierTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(lcjCoinTierTemplates).where(eq(lcjCoinTierTemplates.isActive, true)).orderBy(asc(lcjCoinTierTemplates.sortOrder));
  }),

  // ============================================================
  // V3: Tier Templates - 更新
  // ============================================================
  upsertTierTemplate: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      tierCode: z.string(),
      tierName: z.string(),
      description: z.string().optional(),
      salaryCoefficient: z.number(),
      exampleRoles: z.string().optional(),
      vestingPeriodMonths: z.number().default(36),
      cliffMonths: z.number().default(12),
      vestingType: z.string().default("monthly_flat"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      if (input.id) {
        await db.update(lcjCoinTierTemplates).set({
          tierCode: input.tierCode,
          tierName: input.tierName,
          description: input.description,
          salaryCoefficient: String(input.salaryCoefficient),
          exampleRoles: input.exampleRoles,
          vestingPeriodMonths: input.vestingPeriodMonths,
          cliffMonths: input.cliffMonths,
          vestingType: input.vestingType,
        }).where(eq(lcjCoinTierTemplates.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(lcjCoinTierTemplates).values({
          tierCode: input.tierCode,
          tierName: input.tierName,
          description: input.description,
          salaryCoefficient: String(input.salaryCoefficient),
          exampleRoles: input.exampleRoles,
          vestingPeriodMonths: input.vestingPeriodMonths,
          cliffMonths: input.cliffMonths,
          vestingType: input.vestingType,
        });
        return { success: true, id: result.insertId };
      }
    }),

  // ============================================================
  // V3: Calculate auto grant amount based on Tier + salary
  // ============================================================
  calculateAutoGrant: protectedProcedure
    .input(z.object({
      annualSalary: z.number(),
      tierCode: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const settings = await getSettingsMap(db);
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const { valuation } = calculateValuationFromTotal(monthlyRevenue * 12 * psrMultiplier, 1);
      const coinPrice = calculateCoinPrice(monthlyRevenue * 12 * psrMultiplier, totalCoinsPool);

      const [tier] = await db.select().from(lcjCoinTierTemplates)
        .where(eq(lcjCoinTierTemplates.tierCode, input.tierCode)).limit(1);
      if (!tier) throw new Error("Tier not found");

      const coefficient = Number(tier.salaryCoefficient) / 100;
      const grantValueJpy = input.annualSalary * coefficient;
      const coinAmount = coinPrice > 0 ? Math.round(grantValueJpy / coinPrice) : 0;

      return {
        tierCode: input.tierCode,
        tierName: tier.tierName,
        coefficient,
        annualSalary: input.annualSalary,
        grantValueJpy,
        coinPrice,
        coinAmount,
        vestingPeriodMonths: tier.vestingPeriodMonths,
        cliffMonths: tier.cliffMonths,
      };
    }),

  // ============================================================
  // V3: Peer Bonus - 送信
  // ============================================================
  sendPeerBonus: protectedProcedure
    .input(z.object({
      senderHolderType: z.enum(["staff", "liver"]),
      senderHolderId: z.number(),
      receiverHolderType: z.enum(["staff", "liver"]),
      receiverHolderId: z.number(),
      coinAmount: z.number().min(1),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settings = await getSettingsMap(db);
      const monthlyPool = parseInt(settings.peer_bonus_monthly_pool || "100");
      const maxPerSend = parseInt(settings.peer_bonus_max_per_send || "50");

      if (input.coinAmount > maxPerSend) {
        throw new Error(`1回の送信上限は${maxPerSend}コインです`);
      }
      if (input.senderHolderType === input.receiverHolderType && input.senderHolderId === input.receiverHolderId) {
        throw new Error("自分自身には送れません");
      }

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Check sender's remaining pool this month
      const [sentResult] = await db.execute(
        sql`SELECT COALESCE(SUM(coinAmount), 0) as totalSent FROM lcj_coin_peer_bonuses WHERE senderHolderType = ${input.senderHolderType} AND senderHolderId = ${input.senderHolderId} AND yearMonth = ${yearMonth}`
      );
      const totalSent = Number((sentResult as any[])[0]?.totalSent || 0);
      const remaining = monthlyPool - totalSent;

      if (input.coinAmount > remaining) {
        throw new Error(`今月の残りプールは${remaining}コインです（${totalSent}/${monthlyPool}使用済み）`);
      }

      // Record peer bonus
      await db.insert(lcjCoinPeerBonuses).values({
        senderHolderType: input.senderHolderType,
        senderHolderId: input.senderHolderId,
        receiverHolderType: input.receiverHolderType,
        receiverHolderId: input.receiverHolderId,
        coinAmount: input.coinAmount,
        message: input.message,
        yearMonth,
      });

      // Add coins to receiver's holding (immediately vested)
      let [receiverHolding] = await db.select().from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, input.receiverHolderType),
          eq(lcjCoinHoldings.holderId, input.receiverHolderId),
        )).limit(1);

      if (!receiverHolding) {
        const [result] = await db.insert(lcjCoinHoldings).values({
          holderType: input.receiverHolderType,
          holderId: input.receiverHolderId,
          totalCoins: input.coinAmount,
          vestedCoins: input.coinAmount, // Immediately vested
          exercisedCoins: 0,
          level: 1,
          xp: 50,
          streak: 0,
        });
        receiverHolding = { id: Number(result.insertId) } as any;
      } else {
        await db.execute(
          sql`UPDATE lcj_coin_holdings SET totalCoins = totalCoins + ${input.coinAmount}, vestedCoins = vestedCoins + ${input.coinAmount}, xp = xp + 50 WHERE id = ${receiverHolding.id}`
        );
      }

      // Record transaction for receiver
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const coinPrice = calculateCoinPrice(monthlyRevenue * 12 * psrMultiplier, totalCoinsPool);

      await db.insert(lcjCoinTransactions).values({
        holdingId: receiverHolding.id,
        holderType: input.receiverHolderType,
        holderId: input.receiverHolderId,
        transactionType: "bonus",
        coinAmount: input.coinAmount,
        coinPriceAtTime: String(coinPrice),
        reason: `ピアボーナス: ${input.message}`,
        metadata: { type: "peer_bonus", senderId: input.senderHolderId, senderType: input.senderHolderType },
      });

      return { success: true, remaining: remaining - input.coinAmount };
    }),

  // ============================================================
  // V3: Peer Bonus - タイムライン取得
  // ============================================================
  getPeerBonusTimeline: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const bonuses = await db.select().from(lcjCoinPeerBonuses)
        .orderBy(desc(lcjCoinPeerBonuses.createdAt))
        .limit(input.limit);

      // Resolve names
      const staffIds = new Set<number>();
      const liverIds = new Set<number>();
      for (const b of bonuses) {
        if (b.senderHolderType === "staff") staffIds.add(b.senderHolderId);
        else liverIds.add(b.senderHolderId);
        if (b.receiverHolderType === "staff") staffIds.add(b.receiverHolderId);
        else liverIds.add(b.receiverHolderId);
      }

      const nameMap: Record<string, string> = {};
      if (staffIds.size > 0) {
        const staffList = await db.select({ id: staff.id, name: staff.name }).from(staff);
        for (const s of staffList) nameMap[`staff-${s.id}`] = s.name;
      }
      if (liverIds.size > 0) {
        const liverList = await db.select({ id: livers.id, name: livers.name }).from(livers);
        for (const l of liverList) nameMap[`liver-${l.id}`] = l.name;
      }

      return bonuses.map(b => ({
        ...b,
        senderName: nameMap[`${b.senderHolderType}-${b.senderHolderId}`] || "不明",
        receiverName: nameMap[`${b.receiverHolderType}-${b.receiverHolderId}`] || "不明",
      }));
    }),

  // ============================================================
  // V3: Peer Bonus - 自分の月間残りプール
  // ============================================================
  getMyPeerBonusPool: protectedProcedure
    .input(z.object({
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { monthlyPool: 100, used: 0, remaining: 100 };

      const settings = await getSettingsMap(db);
      const monthlyPool = parseInt(settings.peer_bonus_monthly_pool || "100");
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const [sentResult] = await db.execute(
        sql`SELECT COALESCE(SUM(coinAmount), 0) as totalSent FROM lcj_coin_peer_bonuses WHERE senderHolderType = ${input.holderType} AND senderHolderId = ${input.holderId} AND yearMonth = ${yearMonth}`
      );
      const used = Number((sentResult as any[])[0]?.totalSent || 0);

      return { monthlyPool, used, remaining: monthlyPool - used };
    }),

  // ============================================================
  // V3: Buyback Periods - 取得
  // ============================================================
  getBuybackPeriods: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(lcjCoinBuybackPeriods).orderBy(desc(lcjCoinBuybackPeriods.startDate));
  }),

  // ============================================================
  // V3: Buyback Period - 作成
  // ============================================================
  createBuybackPeriod: protectedProcedure
    .input(z.object({
      name: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      maxPercentage: z.number().default(20),
      coinPriceAtOpen: z.number(),
      totalBudget: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [result] = await db.insert(lcjCoinBuybackPeriods).values({
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        maxPercentage: String(input.maxPercentage),
        coinPriceAtOpen: String(input.coinPriceAtOpen),
        totalBudget: input.totalBudget ? String(input.totalBudget) : null,
        notes: input.notes,
        status: "upcoming",
      });
      return { success: true, id: result.insertId };
    }),

  // ============================================================
  // V3: Buyback - 申請
  // ============================================================
  requestBuyback: protectedProcedure
    .input(z.object({
      periodId: z.number(),
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
      requestedCoins: z.number().min(1),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get period
      const [period] = await db.select().from(lcjCoinBuybackPeriods)
        .where(eq(lcjCoinBuybackPeriods.id, input.periodId)).limit(1);
      if (!period) throw new Error("バイバック期間が見つかりません");
      if (period.status !== "open") throw new Error("この期間はまだ受付中ではありません");

      // Get holding
      const [holding] = await db.select().from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, input.holderType),
          eq(lcjCoinHoldings.holderId, input.holderId),
        )).limit(1);
      if (!holding) throw new Error("コイン保有情報が見つかりません");

      // Check max percentage
      const maxPct = Number(period.maxPercentage) / 100;
      const maxCoins = Math.floor(holding.vestedCoins * maxPct);
      if (input.requestedCoins > maxCoins) {
        throw new Error(`確定済みコインの${period.maxPercentage}%（${maxCoins}コイン）が上限です`);
      }

      const coinPrice = Number(period.coinPriceAtOpen);
      const requestedAmount = input.requestedCoins * coinPrice;

      const [result] = await db.insert(lcjCoinBuybackRequests).values({
        periodId: input.periodId,
        holdingId: holding.id,
        holderType: input.holderType,
        holderId: input.holderId,
        requestedCoins: input.requestedCoins,
        coinPriceAtRequest: String(coinPrice),
        requestedAmount: String(requestedAmount),
        reason: input.reason,
        status: "pending",
      });

      // Update period totals
      await db.execute(
        sql`UPDATE lcj_coin_buyback_periods SET totalRequested = totalRequested + ${requestedAmount} WHERE id = ${input.periodId}`
      );

      return { success: true, id: result.insertId, requestedAmount };
    }),

  // ============================================================
  // V3: Buyback - 承認/却下
  // ============================================================
  approveBuyback: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      action: z.enum(["approve", "reject"]),
      approvedCoins: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [request] = await db.select().from(lcjCoinBuybackRequests)
        .where(eq(lcjCoinBuybackRequests.id, input.requestId)).limit(1);
      if (!request) throw new Error("申請が見つかりません");
      if (request.status !== "pending") throw new Error("この申請は既に処理済みです");

      if (input.action === "reject") {
        await db.update(lcjCoinBuybackRequests).set({
          status: "rejected",
          notes: input.notes,
        }).where(eq(lcjCoinBuybackRequests.id, input.requestId));
        return { success: true };
      }

      // Approve
      const approvedCoins = input.approvedCoins || request.requestedCoins;
      const coinPrice = Number(request.coinPriceAtRequest);
      const approvedAmount = approvedCoins * coinPrice;

      await db.update(lcjCoinBuybackRequests).set({
        status: "approved",
        approvedCoins,
        approvedAmount: String(approvedAmount),
        approvedAt: new Date(),
        notes: input.notes,
      }).where(eq(lcjCoinBuybackRequests.id, input.requestId));

      // Deduct from holding (exercised)
      await db.execute(
        sql`UPDATE lcj_coin_holdings SET exercisedCoins = exercisedCoins + ${approvedCoins}, vestedCoins = vestedCoins - ${approvedCoins} WHERE id = ${request.holdingId}`
      );

      // Record transaction
      await db.insert(lcjCoinTransactions).values({
        holdingId: request.holdingId,
        holderType: request.holderType,
        holderId: request.holderId,
        transactionType: "exercise",
        coinAmount: -approvedCoins,
        coinPriceAtTime: String(coinPrice),
        reason: `バイバック承認: ${approvedAmount.toLocaleString()}円`,
        metadata: { buybackRequestId: input.requestId },
      });

      // Update period totals
      await db.execute(
        sql`UPDATE lcj_coin_buyback_periods SET totalApproved = totalApproved + ${approvedAmount} WHERE id = ${request.periodId}`
      );

      return { success: true, approvedCoins, approvedAmount };
    }),

  // ============================================================
  // V3: Buyback Requests - 取得
  // ============================================================
  getBuybackRequests: protectedProcedure
    .input(z.object({ periodId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db.select().from(lcjCoinBuybackRequests).orderBy(desc(lcjCoinBuybackRequests.createdAt));
      if (input.periodId) {
        return db.select().from(lcjCoinBuybackRequests)
          .where(eq(lcjCoinBuybackRequests.periodId, input.periodId))
          .orderBy(desc(lcjCoinBuybackRequests.createdAt));
      }
      return query;
    }),

  // ============================================================
  // V3: Vesting Details - 個人のベスティング詳細
  // ============================================================
  getVestingDetails: protectedProcedure
    .input(z.object({
      holderType: z.enum(["staff", "liver"]),
      holderId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { schedules: [], summary: null };

      const schedules = await db.select().from(lcjCoinVestingSchedules)
        .where(and(
          eq(lcjCoinVestingSchedules.holderType, input.holderType),
          eq(lcjCoinVestingSchedules.holderId, input.holderId),
        ))
        .orderBy(desc(lcjCoinVestingSchedules.grantDate));

      const [holding] = await db.select().from(lcjCoinHoldings)
        .where(and(
          eq(lcjCoinHoldings.holderType, input.holderType),
          eq(lcjCoinHoldings.holderId, input.holderId),
        )).limit(1);

      // Calculate vesting progress for each schedule
      const now = new Date();
      const settings = await getSettingsMap(db);
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const coinPrice = calculateCoinPrice(monthlyRevenue * 12 * psrMultiplier, totalCoinsPool);

      const enrichedSchedules = schedules.map(s => {
        const grantDate = new Date(s.grantDate);
        const monthsElapsed = Math.max(0, (now.getFullYear() - grantDate.getFullYear()) * 12 + (now.getMonth() - grantDate.getMonth()));
        const cliffPassed = monthsElapsed >= s.cliffMonths;
        let vestedPercent = 0;
        let vestedCoins = 0;

        if (cliffPassed) {
          const monthsAfterCliff = monthsElapsed - s.cliffMonths;
          const vestingMonthsRemaining = s.vestingPeriodMonths - s.cliffMonths;
          if (vestingMonthsRemaining > 0) {
            vestedPercent = Math.min(100, (monthsAfterCliff / vestingMonthsRemaining) * 100);
          } else {
            vestedPercent = 100;
          }
          vestedCoins = Math.floor(s.totalGrantCoins * vestedPercent / 100);
        }

        const unvestedCoins = s.totalGrantCoins - vestedCoins;
        const unvestedValueJpy = unvestedCoins * coinPrice;

        return {
          ...s,
          monthsElapsed,
          cliffPassed,
          vestedPercent: Math.round(vestedPercent * 100) / 100,
          calculatedVestedCoins: vestedCoins,
          unvestedCoins,
          unvestedValueJpy,
          coinPrice,
        };
      });

      const totalVested = enrichedSchedules.reduce((sum, s) => sum + s.calculatedVestedCoins, 0);
      const totalUnvested = enrichedSchedules.reduce((sum, s) => sum + s.unvestedCoins, 0);

      return {
        schedules: enrichedSchedules,
        summary: holding ? {
          totalCoins: holding.totalCoins,
          vestedCoins: totalVested,
          unvestedCoins: totalUnvested,
          exercisedCoins: holding.exercisedCoins,
          vestedValueJpy: totalVested * coinPrice,
          unvestedValueJpy: totalUnvested * coinPrice,
          totalValueJpy: holding.totalCoins * coinPrice,
          coinPrice,
          // IPO projections
          ipoProjection1000: holding.totalCoins * (10000000000 / totalCoinsPool), // 1000億時
          ipoProjection300: holding.totalCoins * (3000000000 / totalCoinsPool), // 300億時
          ipoProjection100: holding.totalCoins * (1000000000 / totalCoinsPool), // 100億時
          // What you'd lose by quitting
          loseByQuitting: totalUnvested * coinPrice,
        } : null,
      };
    }),

  // ============================================================
  // V3: Exit Rules - 換金ルール取得
  // ============================================================
  getExitRules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const settings = await getSettingsMap(db);
    return [
      { id: "ipo", title: "IPO / M&A時", description: settings.exit_rule_ipo || "IPO/M&A時に全額現金化。イグジット後90日以内に支払い。上限なし。", icon: "rocket" },
      { id: "buyback", title: "年次バイバック", description: settings.exit_rule_buyback || "毎年12月、希望者のみ。確定済みコインの20%まで。翌年1月末支払い。", icon: "refresh" },
      { id: "resign", title: "退職時精算", description: settings.exit_rule_resign || "退職日から90日以内に申請。確定済みコインの100%。申請後60日以内支払い。", icon: "logout" },
      { id: "fired_company", title: "会社都合解雇", description: settings.exit_rule_fired_company || "会社都合解雇の場合、全額即時確定。", icon: "shield" },
      { id: "fired_disciplinary", title: "懲戒解雇", description: settings.exit_rule_fired_disciplinary || "懲戒解雇の場合、全コイン没収。", icon: "alert" },
    ];
  }),

  // ============================================================
  // V3: Process Monthly Vesting (batch) - 月次ベスティング処理
  // ============================================================
  processMonthlyVesting: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const activeSchedules = await db.select().from(lcjCoinVestingSchedules)
        .where(eq(lcjCoinVestingSchedules.status, "active"));

      const settings = await getSettingsMap(db);
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const coinPrice = calculateCoinPrice(monthlyRevenue * 12 * psrMultiplier, totalCoinsPool);

      let processedCount = 0;
      let vestedTotal = 0;
      const now = new Date();

      for (const schedule of activeSchedules) {
        const grantDate = new Date(schedule.grantDate);
        const monthsElapsed = (now.getFullYear() - grantDate.getFullYear()) * 12 + (now.getMonth() - grantDate.getMonth());

        if (monthsElapsed < schedule.cliffMonths) continue; // Still in cliff

        const vestingMonthsAfterCliff = schedule.vestingPeriodMonths - schedule.cliffMonths;
        if (vestingMonthsAfterCliff <= 0) continue;

        const monthsAfterCliff = monthsElapsed - schedule.cliffMonths;
        const targetVestedPercent = Math.min(1, monthsAfterCliff / vestingMonthsAfterCliff);
        const targetVestedCoins = Math.floor(schedule.totalGrantCoins * targetVestedPercent);
        const newlyVested = targetVestedCoins - schedule.vestedSoFar;

        if (newlyVested <= 0) {
          if (targetVestedPercent >= 1 && schedule.status === "active") {
            await db.update(lcjCoinVestingSchedules).set({ status: "completed" })
              .where(eq(lcjCoinVestingSchedules.id, schedule.id));
          }
          continue;
        }

        // Update vesting schedule
        await db.update(lcjCoinVestingSchedules).set({
          vestedSoFar: targetVestedCoins,
          status: targetVestedPercent >= 1 ? "completed" : "active",
        }).where(eq(lcjCoinVestingSchedules.id, schedule.id));

        // Update holding
        await db.execute(
          sql`UPDATE lcj_coin_holdings SET vestedCoins = vestedCoins + ${newlyVested} WHERE id = ${schedule.holdingId}`
        );

        // Record transaction
        await db.insert(lcjCoinTransactions).values({
          holdingId: schedule.holdingId,
          holderType: schedule.holderType,
          holderId: schedule.holderId,
          transactionType: "vest",
          coinAmount: newlyVested,
          coinPriceAtTime: String(coinPrice),
          vestingScheduleId: schedule.id,
          reason: `月次ベスティング確定 (${monthsElapsed}/${schedule.vestingPeriodMonths}ヶ月)`,
        });

        processedCount++;
        vestedTotal += newlyVested;
      }

      return { processedCount, vestedTotal, coinPrice };
    }),
});
