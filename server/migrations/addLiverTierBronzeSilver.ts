/**
 * Migration: ライバー用Tier 4段階化
 * 
 * 既存: L-S (BLACK), L-A (GOLD)
 * 追加: L-B (SILVER), L-C (BRONZE)
 * 
 * また、既存のL-S, L-Aの名前・説明・対象例も更新する
 */
import { sql } from "drizzle-orm";

export async function addLiverTierBronzeSilver(db: any) {
  try {
    // 1. 既存のL-Sを更新（BLACK）
    await db.execute(sql`
      UPDATE lcj_coin_tier_templates 
      SET tierName = 'BLACK', 
          description = '月間配信60時間以上 & 月間売上300万円以上',
          exampleRoles = 'トップライバー・メガブランド獲得者',
          sortOrder = 1
      WHERE tierCode = 'L-S' AND tierType = 'creator'
    `);
    console.log("[Migration] Updated L-S → BLACK");

    // 2. 既存のL-Aを更新（GOLD）
    await db.execute(sql`
      UPDATE lcj_coin_tier_templates 
      SET tierName = 'GOLD', 
          description = '月間配信30時間以上 & 月間売上100万円以上',
          exampleRoles = '安定配信ライバー・成長中ライバー',
          sortOrder = 2
      WHERE tierCode = 'L-A' AND tierType = 'creator'
    `);
    console.log("[Migration] Updated L-A → GOLD");

    // 3. L-B (SILVER) を追加
    const [existingLB] = await db.execute(sql`
      SELECT id FROM lcj_coin_tier_templates WHERE tierCode = 'L-B' LIMIT 1
    `);
    if (!existingLB || (Array.isArray(existingLB) && existingLB.length === 0)) {
      await db.execute(sql`
        INSERT INTO lcj_coin_tier_templates 
          (tierCode, tierType, tierName, description, salaryCoefficient, exampleRoles, vestingPeriodMonths, cliffMonths, vestingType, sortOrder, isActive)
        VALUES 
          ('L-B', 'creator', 'SILVER', '月間配信10時間以上 & 月間売上50万円以上', '0.00', '新人ライバー・副業ライバー', 6, 0, 'trigger_based', 3, 1)
      `);
      console.log("[Migration] Inserted L-B (SILVER)");
    } else {
      console.log("[Migration] L-B already exists, skipping insert");
    }

    // 4. L-C (BRONZE) を追加
    const [existingLC] = await db.execute(sql`
      SELECT id FROM lcj_coin_tier_templates WHERE tierCode = 'L-C' LIMIT 1
    `);
    if (!existingLC || (Array.isArray(existingLC) && existingLC.length === 0)) {
      await db.execute(sql`
        INSERT INTO lcj_coin_tier_templates 
          (tierCode, tierType, tierName, description, salaryCoefficient, exampleRoles, vestingPeriodMonths, cliffMonths, vestingType, sortOrder, isActive)
        VALUES 
          ('L-C', 'creator', 'BRONZE', '配信開始済み', '0.00', '配信開始したばかりのライバー', 6, 0, 'trigger_based', 4, 1)
      `);
      console.log("[Migration] Inserted L-C (BRONZE)");
    } else {
      console.log("[Migration] L-C already exists, skipping insert");
    }

    console.log("[Migration] ライバーTier 4段階化 完了");
  } catch (error) {
    console.error("[Migration] Error:", error);
    throw error;
  }
}
