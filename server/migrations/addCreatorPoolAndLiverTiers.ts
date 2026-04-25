/**
 * Migration: Creator Pool (ライバー用別財布) + ライバーTier (L-S/L-A)
 * 
 * 1. lcj_coin_settings に creator_pool_size を追加（20万枚）
 * 2. lcj_coin_tier_templates に tierType カラムを追加（staff/creator）
 * 3. ライバー用Tier L-S / L-A を挿入
 */
import { sql } from "drizzle-orm";

export async function addCreatorPoolAndLiverTiers(db: any) {
  try {
    // ============================================================
    // 1. Add creator_pool_size setting (200,000 coins = 2%)
    // ============================================================
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_settings (settingKey, settingValue, description, category) VALUES
        ('creator_pool_size', '200000', 'クリエイター・エコシステム枠（ライバー用プール）のサイズ', 'general')
    `);
    console.log("[Migration] Added: creator_pool_size setting");

    // ============================================================
    // 2. Add tierType column to lcj_coin_tier_templates
    // ============================================================
    const [cols] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'lcj_coin_tier_templates' AND COLUMN_NAME = 'tierType'
    `);

    if ((cols as any[]).length === 0) {
      await db.execute(sql`
        ALTER TABLE lcj_coin_tier_templates 
        ADD COLUMN tierType varchar(20) DEFAULT 'staff' NOT NULL AFTER tierCode
      `);
      console.log("[Migration] Added: lcj_coin_tier_templates.tierType");

      // Update existing tiers to 'staff' type
      await db.execute(sql`
        UPDATE lcj_coin_tier_templates SET tierType = 'staff' WHERE tierType = 'staff'
      `);
    } else {
      console.log("[Migration] tierType column already exists, skipping.");
    }

    // ============================================================
    // 3. Insert liver/creator Tiers (L-S, L-A)
    // ============================================================
    await db.execute(sql`
      INSERT IGNORE INTO lcj_coin_tier_templates 
        (tierCode, tierType, tierName, description, salaryCoefficient, exampleRoles, vestingPeriodMonths, cliffMonths, vestingType, sortOrder) 
      VALUES
        ('L-S', 'creator', 'Tier L-S（トップライバー）', 'LCJシステム経由で月間GMV達成、またはメガブランド専属アンバサダー契約を獲得した者。即時付与またはごく短期のベスティング。', 0.00, 'トップライバー, メガブランドアンバサダー, 月間GMVトップ', 6, 0, 'monthly_flat', 10),
        ('L-A', 'creator', 'Tier L-A（レギュラーライバー）', 'LCJの案件で一定回数以上配信、または月間GMV基準を達成した者。達成時に少額コインを付与。', 0.00, 'レギュラーライバー, 配信回数達成者, GMV基準達成者', 6, 0, 'monthly_flat', 11)
    `);
    console.log("[Migration] Added: Liver Tiers (L-S, L-A)");

  } catch (err: any) {
    console.error("[Migration] Error in addCreatorPoolAndLiverTiers:", err?.message || err);
  }
}
