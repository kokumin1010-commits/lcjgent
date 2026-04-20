/**
 * Migration: Add durationMinutes column to livestream_brands table
 * 
 * Tracks how many minutes were spent on each brand during a livestream.
 * This allows accurate recording of per-brand streaming time.
 */
import { sql } from "drizzle-orm";

export async function addLivestreamBrandDuration(db: any) {
  try {
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'livestream_brands' 
      AND COLUMN_NAME = 'durationMinutes'
    `);
    
    const existingCols = new Set((rows as any[]).map((r: any) => r.COLUMN_NAME));
    
    if (!existingCols.has('durationMinutes')) {
      await db.execute(sql`ALTER TABLE livestream_brands ADD COLUMN durationMinutes INT DEFAULT NULL`);
      console.log('[Migration] Added column: livestream_brands.durationMinutes');
    }
    
    console.log('[Migration] livestream_brands durationMinutes check complete');
  } catch (error) {
    console.error('[Migration] Error adding livestream_brands.durationMinutes:', error);
  }
}
