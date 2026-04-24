/**
 * Migration: Add tierCode column to lcj_coin_holdings
 * 
 * ALTER:
 * - lcj_coin_holdings.tierCode: 貢献期待度Tier（S/A/B/C/D）
 */
import { sql } from "drizzle-orm";

export async function addTierCodeToHoldings(db: any) {
  try {
    // Check if column already exists
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'lcj_coin_holdings' AND COLUMN_NAME = 'tierCode'
    `);

    if ((rows as any[]).length > 0) {
      console.log("[Migration] tierCode column already exists in lcj_coin_holdings, skipping.");
      return;
    }

    console.log("[Migration] Adding tierCode column to lcj_coin_holdings...");

    await db.execute(sql`
      ALTER TABLE lcj_coin_holdings 
      ADD COLUMN tierCode varchar(10) DEFAULT NULL AFTER lastActiveDate
    `);

    console.log("[Migration] Added: lcj_coin_holdings.tierCode");
  } catch (err: any) {
    console.error("[Migration] Error adding tierCode:", err?.message || err);
  }
}
