/**
 * LCJ Coin (Phantom Stock) Router - ファントムストック報酬システム
 *
 * 独立ファイルとして管理。routers.tsにはimportのみ。
 * 
 * 機能:
 * - 擬似時価総額ダッシュボード
 * - コイン保有・ベスティング管理
 * - ゲーミフィケーション（バッジ・ランキング・レベル・シーズン）
 * - 管理画面（設定変更・コイン付与・レポート）
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { sql, eq, and, desc, asc, count, sum } from "drizzle-orm";
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
  staff,
  livers,
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
  // Dashboard: Get overview data
  // ============================================================
  getDashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const settings = await getSettingsMap(db);
    const monthlyRevenue = parseFloat(settings.monthly_revenue || "0");
    const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
    const totalCoinsPool = parseInt(settings.total_coins_pool || "10000000");
    const xpPerLevel = parseInt(settings.xp_per_level || "1000");

    const { annualRevenue, valuation } = calculateValuation(monthlyRevenue, psrMultiplier);
    const coinPrice = calculateCoinPrice(valuation, totalCoinsPool);

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

    return {
      valuation: {
        monthlyRevenue,
        annualRevenue,
        psrMultiplier,
        valuationAmount: valuation,
        coinPrice,
        totalCoinsPool,
        totalIssuedCoins,
        remainingCoins: totalCoinsPool - totalIssuedCoins,
      },
      stats: {
        totalHolders,
        xpPerLevel,
      },
      valuationHistory,
      activeSeason: activeSeason || null,
    };
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
      const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
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
      const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
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
      const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
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
      const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
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
      const psrMultiplier = parseFloat(settings.psr_multiplier || "5");
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
});
