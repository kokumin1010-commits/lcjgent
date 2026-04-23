/**
 * Migration: Create LCJ Coin (Phantom Stock) System tables
 * 
 * Creates all tables for the LCJ Coin gamified phantom stock system:
 * - lcj_coin_settings: System configuration
 * - lcj_coin_valuation_log: Monthly valuation snapshots
 * - lcj_coin_holdings: Per-user coin holdings
 * - lcj_coin_transactions: All coin transaction history
 * - lcj_coin_vesting_schedules: Individual vesting plans
 * - lcj_coin_badges: Badge definitions
 * - lcj_coin_badge_awards: Badge award history
 * - lcj_coin_seasons: Season/event definitions
 * - lcj_coin_ranking_history: Ranking snapshots
 */
import { sql } from "drizzle-orm";

export async function createLcjCoinTables(db: any) {
  try {
    // Check if main table already exists
    const [rows] = await db.execute(sql`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'lcj_coin_settings'
    `);
    
    if ((rows as any[]).length > 0) {
      console.log("[Migration] LCJ Coin tables already exist, skipping.");
      return;
    }

    console.log("[Migration] Creating LCJ Coin system tables...");

    // 1. Settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_settings (
        id int AUTO_INCREMENT NOT NULL,
        settingKey varchar(100) NOT NULL,
        settingValue text NOT NULL,
        description text,
        category enum('valuation','vesting','gamification','general') NOT NULL DEFAULT 'general',
        updatedBy int,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY lcj_coin_settings_key_unique (settingKey)
      )
    `);
    console.log("[Migration] Created: lcj_coin_settings");

    // 2. Valuation log table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_valuation_log (
        id int AUTO_INCREMENT NOT NULL,
        yearMonth varchar(7) NOT NULL,
        monthlyRevenue decimal(15,2) NOT NULL,
        psrMultiplier decimal(5,2) NOT NULL,
        valuationAmount decimal(18,2) NOT NULL,
        totalCoinsIssued bigint NOT NULL,
        coinPrice decimal(12,4) NOT NULL,
        notes text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration] Created: lcj_coin_valuation_log");

    // 3. Holdings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_holdings (
        id int AUTO_INCREMENT NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        totalCoins bigint NOT NULL DEFAULT 0,
        vestedCoins bigint NOT NULL DEFAULT 0,
        exercisedCoins bigint NOT NULL DEFAULT 0,
        level int NOT NULL DEFAULT 1,
        xp bigint NOT NULL DEFAULT 0,
        streak int NOT NULL DEFAULT 0,
        lastActiveDate timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_holder (holderType, holderId)
      )
    `);
    console.log("[Migration] Created: lcj_coin_holdings");

    // 4. Transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_transactions (
        id int AUTO_INCREMENT NOT NULL,
        holdingId int NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        transactionType enum('grant','refresh_grant','vest','exercise','bonus','season_reward','achievement','penalty','adjustment') NOT NULL,
        coinAmount bigint NOT NULL,
        coinPriceAtTime decimal(12,4),
        vestingScheduleId int,
        reason text,
        approvedBy int,
        metadata json,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_holding (holdingId),
        KEY idx_holder_tx (holderType, holderId)
      )
    `);
    console.log("[Migration] Created: lcj_coin_transactions");

    // 5. Vesting schedules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_vesting_schedules (
        id int AUTO_INCREMENT NOT NULL,
        holdingId int NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        grantDate timestamp NOT NULL,
        totalGrantCoins bigint NOT NULL,
        vestingType enum('backloaded','frontloaded','flat','custom') NOT NULL DEFAULT 'backloaded',
        vestingRates json NOT NULL,
        vestingPeriodMonths int NOT NULL DEFAULT 48,
        cliffMonths int NOT NULL DEFAULT 12,
        vestedSoFar bigint NOT NULL DEFAULT 0,
        nextVestDate timestamp NULL,
        status enum('active','completed','cancelled','paused') NOT NULL DEFAULT 'active',
        notes text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_holding_vest (holdingId)
      )
    `);
    console.log("[Migration] Created: lcj_coin_vesting_schedules");

    // 6. Badges table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_badges (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(100) NOT NULL,
        nameEn varchar(100),
        description text,
        iconUrl text,
        iconEmoji varchar(10),
        category enum('performance','loyalty','special','season','social') NOT NULL DEFAULT 'performance',
        rarity enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
        requirement json,
        xpReward int NOT NULL DEFAULT 0,
        coinReward bigint NOT NULL DEFAULT 0,
        isActive tinyint(1) NOT NULL DEFAULT 1,
        sortOrder int NOT NULL DEFAULT 0,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration] Created: lcj_coin_badges");

    // 7. Badge awards table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_badge_awards (
        id int AUTO_INCREMENT NOT NULL,
        badgeId int NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        awardedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata json,
        PRIMARY KEY (id),
        KEY idx_holder_badge (holderType, holderId)
      )
    `);
    console.log("[Migration] Created: lcj_coin_badge_awards");

    // 8. Seasons table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_seasons (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(200) NOT NULL,
        description text,
        startDate timestamp NOT NULL,
        endDate timestamp NOT NULL,
        theme varchar(100),
        bonusMultiplier decimal(5,2) NOT NULL DEFAULT 1.00,
        rewards json,
        status enum('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration] Created: lcj_coin_seasons");

    // 9. Ranking history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_ranking_history (
        id int AUTO_INCREMENT NOT NULL,
        period varchar(20) NOT NULL,
        periodType enum('monthly','season','yearly') NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        \`rank\` int NOT NULL,
        totalValue decimal(18,2) NOT NULL,
        xpEarned bigint NOT NULL DEFAULT 0,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_period_rank (period, periodType)
      )
    `);
    console.log("[Migration] Created: lcj_coin_ranking_history");

    // 10. Financial Documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_documents (
        id int AUTO_INCREMENT NOT NULL,
        documentType varchar(50) NOT NULL,
        title varchar(255) NOT NULL,
        fileName varchar(500) NOT NULL,
        fileUrl text NOT NULL,
        fileKey varchar(500),
        fileSize int,
        mimeType varchar(100),
        periodStart varchar(20),
        periodEnd varchar(20),
        extractedData text,
        extractedRevenue bigint,
        extractedNetIncome bigint,
        extractedTotalAssets bigint,
        extractedNetAssets bigint,
        uploadedBy int,
        uploadedByName varchar(255),
        notes text,
        isActive tinyint(1) NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration] Created: lcj_coin_documents");

    // 11. Shareholders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_shareholders (
        id int AUTO_INCREMENT NOT NULL,
        documentId int,
        shareholderNo int,
        name varchar(255) NOT NULL,
        shares int NOT NULL,
        ratio varchar(20),
        shareType varchar(50) DEFAULT '普通株式',
        acquisitionDate varchar(20),
        address text,
        isActive tinyint(1) NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration] Created: lcj_coin_shareholders");

    // Seed default settings
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_settings (settingKey, settingValue, description, category) VALUES
        ('psr_multiplier', '15', 'PSR倍率（時価総額 = 月間売上 × 12 × PSR倍率）', 'valuation'),
        ('total_coins_pool', '10000000', '発行可能な総コイン数（1000万枚）', 'valuation'),
        ('default_vesting_type', 'backloaded', 'デフォルトのベスティングタイプ', 'vesting'),
        ('default_vesting_rates', '{"year1": 5, "year2": 15, "year3": 40, "year4": 40}', 'デフォルトのベスティング率（Amazonバックローデッド型）', 'vesting'),
        ('cliff_months', '12', 'クリフ期間（月）', 'vesting'),
        ('vesting_period_months', '48', 'ベスティング期間（月）', 'vesting'),
        ('xp_per_level', '1000', 'レベルアップに必要なXP', 'gamification'),
        ('streak_bonus_xp', '50', '連続ログインボーナスXP', 'gamification'),
        ('monthly_revenue', '0', '現在の月間売上（手動入力）', 'valuation'),
        ('coin_exercise_enabled', 'false', 'コイン行使（換金）機能の有効/無効', 'general')
    `);
    console.log("[Migration] Seeded: lcj_coin_settings defaults");

    // Seed default badges
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_badges (name, nameEn, description, iconEmoji, category, rarity, xpReward, coinReward, sortOrder) VALUES
        ('ルーキー', 'Rookie', '初めてLCJコインを受け取った', '🌱', 'loyalty', 'common', 100, 0, 1),
        ('ダイヤモンドハンド', 'Diamond Hands', '1年間コインを保持し続けた', '💎', 'loyalty', 'rare', 500, 100, 2),
        ('トップセールス', 'Top Sales', '月間売上ランキング1位', '🏆', 'performance', 'epic', 1000, 500, 3),
        ('ストリークマスター', 'Streak Master', '30日連続アクティブ', '🔥', 'loyalty', 'rare', 300, 50, 4),
        ('レジェンド', 'Legend', 'レベル50に到達', '⭐', 'special', 'legendary', 5000, 2000, 5),
        ('チームプレイヤー', 'Team Player', '5人以上にコインを紹介', '🤝', 'social', 'common', 200, 0, 6),
        ('アーリーアダプター', 'Early Adopter', 'LCJコインシステム初期参加者', '🚀', 'special', 'epic', 1000, 1000, 7),
        ('100万コインクラブ', '1M Coin Club', '累計100万コインを獲得', '👑', 'performance', 'legendary', 10000, 5000, 8),
        ('シーズンチャンピオン', 'Season Champion', 'シーズンランキング1位', '🎖️', 'season', 'epic', 2000, 1000, 9),
        ('ベスティング完了', 'Fully Vested', '全ベスティングスケジュールを完了', '🎓', 'loyalty', 'rare', 800, 200, 10)
    `);
    console.log("[Migration] Seeded: lcj_coin_badges defaults");

    console.log("[Migration] LCJ Coin system tables created successfully!");
  } catch (err: any) {
    // Don't throw - just log. Tables may already exist partially.
    console.error("[Migration] LCJ Coin tables error:", err?.message || err);
  }
}
