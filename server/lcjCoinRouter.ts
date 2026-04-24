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
import { sql, eq, and, desc, asc, count, sum, isNull } from "drizzle-orm";
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
  // ============================================================
  getAllHolders: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const page = input?.page || 1;
      const limit = input?.limit || 50;
      const offset = (page - 1) * limit;

      const settings = await getSettingsMap(db);
      const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
      const psrMultiplier = parseFloat(settings.psr_multiplier || "15");
      const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
      const { valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
      const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

      const holdings = await db
        .select()
        .from(lcjCoinHoldings)
        .orderBy(desc(lcjCoinHoldings.totalCoins))
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db.select({ count: count() }).from(lcjCoinHoldings);

      const enriched = await Promise.all(holdings.map(async (h) => {
        let name = "Unknown";
        let avatarUrl = null;
        let department = null;
        if (h.holderType === "staff") {
          const [s] = await db.select({ name: staff.name, avatarUrl: staff.avatarUrl, department: staff.department }).from(staff).where(eq(staff.id, h.holderId)).limit(1);
          if (s) { name = s.name; avatarUrl = s.avatarUrl; department = s.department; }
        } else {
          const [l] = await db.select({ name: livers.name, avatarUrl: livers.avatarUrl }).from(livers).where(eq(livers.id, h.holderId)).limit(1);
          if (l) { name = l.name; avatarUrl = l.avatarUrl; }
        }
        return {
          ...h,
          name,
          avatarUrl,
          department,
          totalValue: h.totalCoins * coinPrice,
          vestedValue: h.vestedCoins * coinPrice,
        };
      }));

      return {
        holders: enriched,
        total: totalResult?.count || 0,
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
});
