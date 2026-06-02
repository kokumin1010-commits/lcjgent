/**
 * Migration: Add gmv column to livestream_brands table
 * 
 * Stores per-brand GMV calculated from CSV product imports.
 * This allows accurate brand-specific GMV display in brand management pages.
 */
import { sql } from "drizzle-orm";

export async function addLivestreamBrandGmv(db: any) {
  try {
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'livestream_brands' 
      AND COLUMN_NAME = 'gmv'
    `);
    const existingCols = new Set((rows as any[]).map((r: any) => r.COLUMN_NAME));

    if (!existingCols.has('gmv')) {
      await db.execute(sql`ALTER TABLE livestream_brands ADD COLUMN gmv BIGINT DEFAULT NULL COMMENT 'ブランド別GMV（CSVインポートから計算）'`);
      console.log('[Migration] Added column: livestream_brands.gmv');
    }

    console.log('[Migration] livestream_brands gmv check complete');
  } catch (error) {
    console.error('[Migration] Error adding livestream_brands.gmv:', error);
  }
}
