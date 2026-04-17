/**
 * Migration: Add missing columns to brand_contracts table
 * 
 * Added in commit 8b9990d but never migrated to production DB.
 * Columns: currency, kgLiveCondition, liverLiveCondition, shortVideoCondition, contractPeriodLabel
 */
import { sql } from "drizzle-orm";

export async function addBrandContractColumns(db: any) {
  try {
    // Check if columns already exist by querying information_schema
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'brand_contracts' 
      AND COLUMN_NAME IN ('currency', 'kgLiveCondition', 'liverLiveCondition', 'shortVideoCondition', 'contractPeriodLabel')
    `);
    
    const existingCols = new Set((rows as any[]).map((r: any) => r.COLUMN_NAME));
    
    if (!existingCols.has('currency')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN currency VARCHAR(10) DEFAULT 'JPY'`);
      console.log('[Migration] Added column: currency');
    }
    
    if (!existingCols.has('kgLiveCondition')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN kgLiveCondition TEXT`);
      console.log('[Migration] Added column: kgLiveCondition');
    }
    
    if (!existingCols.has('liverLiveCondition')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN liverLiveCondition TEXT`);
      console.log('[Migration] Added column: liverLiveCondition');
    }
    
    if (!existingCols.has('shortVideoCondition')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN shortVideoCondition TEXT`);
      console.log('[Migration] Added column: shortVideoCondition');
    }
    
    if (!existingCols.has('contractPeriodLabel')) {
      await db.execute(sql`ALTER TABLE brand_contracts ADD COLUMN contractPeriodLabel VARCHAR(100)`);
      console.log('[Migration] Added column: contractPeriodLabel');
    }
    
    console.log('[Migration] brand_contracts columns check complete');
  } catch (error) {
    console.error('[Migration] Error adding brand_contract columns:', error);
  }
}
