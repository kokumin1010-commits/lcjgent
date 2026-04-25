/**
 * Migration: Add quota numeric fields to brand_contracts table
 * 
 * Adds structured numeric fields for norma/quota tracking:
 * - kgLiveHoursQuota: KG老师の月間配信ノルマ（分単位）
 * - liverLiveHoursQuota: 达人の月間配信ノルマ（分単位）
 * - shortVideoCountQuota: 短視頻の月間本数ノルマ
 */
import { sql } from "drizzle-orm";

export async function addContractQuotaFields(db: any) {
  try {
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'brand_contracts' 
      AND COLUMN_NAME IN ('kgLiveHoursQuota', 'liverLiveHoursQuota', 'shortVideoCountQuota')
    `);
    
    const existingCols = new Set((rows as any[]).map((r: any) => r.COLUMN_NAME));
    
    if (!existingCols.has('kgLiveHoursQuota')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN kgLiveHoursQuota INT DEFAULT NULL`);
      console.log('[Migration] Added column: brand_contracts.kgLiveHoursQuota');
    }
    
    if (!existingCols.has('liverLiveHoursQuota')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN liverLiveHoursQuota INT DEFAULT NULL`);
      console.log('[Migration] Added column: brand_contracts.liverLiveHoursQuota');
    }
    
    if (!existingCols.has('shortVideoCountQuota')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN shortVideoCountQuota INT DEFAULT NULL`);
      console.log('[Migration] Added column: brand_contracts.shortVideoCountQuota');
    }
    
    console.log('[Migration] brand_contracts quota fields check complete');
  } catch (error) {
    console.error('[Migration] Error adding brand_contracts quota fields:', error);
  }
}
