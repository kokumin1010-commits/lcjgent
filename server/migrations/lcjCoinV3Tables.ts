/**
 * Migration V3: LCJ Coin - Tier Templates, Peer Bonus, Buyback, Grant Types
 * 
 * New tables:
 * - lcj_coin_tier_templates: Tier別付与テンプレート (S/A/B/C/D)
 * - lcj_coin_peer_bonuses: ピアボーナス送受信記録
 * - lcj_coin_buyback_requests: バイバック（換金）申請
 * - lcj_coin_buyback_periods: バイバック期間定義
 * 
 * ALTER:
 * - lcj_coin_transactions.transactionType: 新しいenum値追加
 * - lcj_coin_vesting_schedules.vestingType: 新しいenum値追加
 * - lcj_coin_vesting_schedules: grantType カラム追加
 * - lcj_coin_settings: 新しい設定値追加
 */
import { sql } from "drizzle-orm";

export async function createLcjCoinV3Tables(db: any) {
  try {
    // Check if v3 tables already exist
    const [rows] = await db.execute(sql`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'lcj_coin_tier_templates'
    `);
    
    if ((rows as any[]).length > 0) {
      console.log("[Migration V3] LCJ Coin V3 tables already exist, skipping.");
      return;
    }

    console.log("[Migration V3] Creating LCJ Coin V3 tables...");

    // ============================================================
    // 1. Tier Templates - 役職Tier別の付与テンプレート
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_tier_templates (
        id int AUTO_INCREMENT NOT NULL,
        tierCode varchar(10) NOT NULL,
        tierName varchar(100) NOT NULL,
        description text,
        salaryCoefficient decimal(5,2) NOT NULL DEFAULT 0.00,
        exampleRoles text,
        vestingPeriodMonths int NOT NULL DEFAULT 36,
        cliffMonths int NOT NULL DEFAULT 12,
        vestingType varchar(30) NOT NULL DEFAULT 'monthly_flat',
        sortOrder int NOT NULL DEFAULT 0,
        isActive tinyint(1) NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_tier_code (tierCode)
      )
    `);
    console.log("[Migration V3] Created: lcj_coin_tier_templates");

    // ============================================================
    // 2. Peer Bonuses - ピアボーナス送受信記録
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_peer_bonuses (
        id int AUTO_INCREMENT NOT NULL,
        senderHolderType enum('staff','liver') NOT NULL,
        senderHolderId int NOT NULL,
        receiverHolderType enum('staff','liver') NOT NULL,
        receiverHolderId int NOT NULL,
        coinAmount int NOT NULL,
        message text NOT NULL,
        yearMonth varchar(7) NOT NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sender (senderHolderType, senderHolderId, yearMonth),
        KEY idx_receiver (receiverHolderType, receiverHolderId, yearMonth),
        KEY idx_yearmonth (yearMonth)
      )
    `);
    console.log("[Migration V3] Created: lcj_coin_peer_bonuses");

    // ============================================================
    // 3. Buyback Periods - バイバック期間定義
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_buyback_periods (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(200) NOT NULL,
        startDate timestamp NOT NULL,
        endDate timestamp NOT NULL,
        maxPercentage decimal(5,2) NOT NULL DEFAULT 20.00,
        coinPriceAtOpen decimal(12,4) NOT NULL,
        totalBudget decimal(18,2),
        totalRequested decimal(18,2) DEFAULT 0,
        totalApproved decimal(18,2) DEFAULT 0,
        status enum('upcoming','open','closed','settled') NOT NULL DEFAULT 'upcoming',
        notes text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("[Migration V3] Created: lcj_coin_buyback_periods");

    // ============================================================
    // 4. Buyback Requests - バイバック申請
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_coin_buyback_requests (
        id int AUTO_INCREMENT NOT NULL,
        periodId int NOT NULL,
        holdingId int NOT NULL,
        holderType enum('staff','liver') NOT NULL,
        holderId int NOT NULL,
        requestedCoins bigint NOT NULL,
        coinPriceAtRequest decimal(12,4) NOT NULL,
        requestedAmount decimal(18,2) NOT NULL,
        approvedCoins bigint DEFAULT 0,
        approvedAmount decimal(18,2) DEFAULT 0,
        status enum('pending','approved','rejected','settled','cancelled') NOT NULL DEFAULT 'pending',
        reason text,
        approvedBy int,
        approvedAt timestamp NULL,
        settledAt timestamp NULL,
        notes text,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_period (periodId),
        KEY idx_holder (holderType, holderId)
      )
    `);
    console.log("[Migration V3] Created: lcj_coin_buyback_requests");

    // ============================================================
    // 5. ALTER: Add new transactionType enum values
    // ============================================================
    try {
      await db.execute(sql`
        ALTER TABLE lcj_coin_transactions 
        MODIFY COLUMN transactionType enum(
          'grant','refresh_grant','vest','exercise','bonus',
          'season_reward','achievement','penalty','adjustment',
          'peer_bonus_send','peer_bonus_receive','buyback',
          'spot_grant','signon_grant','forfeit'
        ) NOT NULL
      `);
      console.log("[Migration V3] Updated: lcj_coin_transactions.transactionType enum");
    } catch (e: any) {
      console.log("[Migration V3] transactionType enum update skipped:", e?.message?.slice(0, 100));
    }

    // ============================================================
    // 6. ALTER: Add new vestingType enum values
    // ============================================================
    try {
      await db.execute(sql`
        ALTER TABLE lcj_coin_vesting_schedules 
        MODIFY COLUMN vestingType enum(
          'backloaded','frontloaded','flat','custom',
          'monthly_flat','immediate_partial','immediate'
        ) NOT NULL DEFAULT 'monthly_flat'
      `);
      console.log("[Migration V3] Updated: lcj_coin_vesting_schedules.vestingType enum");
    } catch (e: any) {
      console.log("[Migration V3] vestingType enum update skipped:", e?.message?.slice(0, 100));
    }

    // ============================================================
    // 7. ALTER: Add grantType column to vesting_schedules
    // ============================================================
    try {
      await db.execute(sql`
        ALTER TABLE lcj_coin_vesting_schedules 
        ADD COLUMN grantType enum('signon','refresh','spot','peer_bonus','other') DEFAULT 'signon' AFTER vestingType
      `);
      console.log("[Migration V3] Added: lcj_coin_vesting_schedules.grantType");
    } catch (e: any) {
      console.log("[Migration V3] grantType column add skipped:", e?.message?.slice(0, 100));
    }

    // ============================================================
    // 8. Seed Tier Templates
    // ============================================================
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_tier_templates (tierCode, tierName, description, salaryCoefficient, exampleRoles, vestingPeriodMonths, cliffMonths, vestingType, sortOrder) VALUES
        ('S', 'Tier S', 'CTO候補・メガブランド獲得セールスVP等、時価総額を大きく押し上げる可能性のある人材', 80.00, 'CTO候補, セールスVP, 事業統括', 36, 12, 'monthly_flat', 1),
        ('A', 'Tier A', 'コアエンジニア・事業責任者・トップライバーマネージャー等、事業の中核を担う人材', 30.00, 'コアエンジニア, 事業責任者, トップライバーMgr', 36, 12, 'monthly_flat', 2),
        ('B', 'Tier B', '中堅エンジニア・一般セールス・デザイナー等、安定的に貢献する人材', 12.00, '中堅エンジニア, 一般セールス, デザイナー', 36, 12, 'monthly_flat', 3),
        ('C', 'Tier C', 'CS・運用担当・一般ライバーマネージャー等、日常業務を支える人材', 5.00, 'CS, 運用担当, 一般ライバーMgr', 36, 12, 'monthly_flat', 4),
        ('D', 'Tier D', '事務・アシスタント・オペレーター等、ルーチンワーク中心の人材', 2.00, '事務, アシスタント, オペレーター', 36, 12, 'monthly_flat', 5)
    `);
    console.log("[Migration V3] Seeded: lcj_coin_tier_templates");

    // ============================================================
    // 9. Seed new settings
    // ============================================================
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_settings (settingKey, settingValue, description, category) VALUES
        ('peer_bonus_monthly_pool', '100', 'ピアボーナス月間配布量（1人あたりコイン数）', 'general'),
        ('peer_bonus_max_per_send', '50', 'ピアボーナス1回の送信上限コイン数', 'general'),
        ('buyback_max_percentage', '20', 'バイバック上限（確定済みコインの%）', 'general'),
        ('buyback_enabled', 'true', 'バイバック機能の有効/無効', 'general'),
        ('default_vesting_period_months', '36', 'デフォルトベスティング期間（月）- 3年', 'vesting'),
        ('default_cliff_months', '12', 'デフォルトクリフ期間（月）- 1年', 'vesting'),
        ('exit_rule_ipo', 'IPO/M&A時に全額現金化。イグジット後90日以内に支払い。上限なし。', 'general'),
        ('exit_rule_buyback', '毎年12月、希望者のみ。確定済みコインの20%まで。翌年1月末支払い。', 'general'),
        ('exit_rule_resign', '退職日から90日以内に申請。確定済みコインの100%。申請後60日以内支払い。', 'general'),
        ('exit_rule_fired_company', '会社都合解雇の場合、全額即時確定。', 'general'),
        ('exit_rule_fired_disciplinary', '懲戒解雇の場合、全コイン没収。', 'general')
    `);
    console.log("[Migration V3] Seeded: new settings");

    // ============================================================
    // 10. Update default vesting settings to 3-year monthly
    // ============================================================
    await db.execute(sql`
      UPDATE lcj_coin_settings 
      SET settingValue = '36' 
      WHERE settingKey = 'vesting_period_months' AND settingValue = '48'
    `);
    await db.execute(sql`
      UPDATE lcj_coin_settings 
      SET settingValue = 'monthly_flat', description = 'デフォルトのベスティングタイプ（3年月次均等）'
      WHERE settingKey = 'default_vesting_type'
    `);
    await db.execute(sql`
      UPDATE lcj_coin_settings 
      SET settingValue = '{"month1to12": 0, "month13to36": 4.17}', description = 'デフォルトのベスティング率（1年クリフ後、月次4.17%）'
      WHERE settingKey = 'default_vesting_rates'
    `);
    console.log("[Migration V3] Updated: default vesting settings to 3-year monthly flat");

    console.log("[Migration V3] LCJ Coin V3 tables created successfully!");
  } catch (err: any) {
    console.error("[Migration V3] Error:", err?.message || err);
  }
}
