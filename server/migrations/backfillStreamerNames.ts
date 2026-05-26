/**
 * Migration: Backfill empty streamerName in brand_livestreams
 * 
 * Some records have empty streamerName (e.g., when created from LiverSelfRecord
 * without a proper name resolution). This migration fills them using the
 * livers table (tiktokAccount or name).
 */
import { eq, and, or, isNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

const LOG_PREFIX = "[Migration:BackfillStreamerNames]";

export async function backfillStreamerNames(db: MySql2Database<any>): Promise<void> {
  try {
    console.log(`${LOG_PREFIX} Starting backfill of empty streamerNames...`);

    // Find brand_livestreams records with empty or null streamerName that have a liverId
    const emptyRecords = await db.execute(sql`
      SELECT bl.id, bl.liverId, l.name as liverName, l.tiktokAccount
      FROM brand_livestreams bl
      LEFT JOIN livers l ON bl.liverId = l.id
      WHERE bl.liverId IS NOT NULL
        AND (bl.streamerName IS NULL OR bl.streamerName = '' OR TRIM(bl.streamerName) = '')
        AND l.id IS NOT NULL
    `);

    const rows = (emptyRecords as any)[0] || emptyRecords;
    
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`${LOG_PREFIX} No records with empty streamerName found. Done.`);
      return;
    }

    console.log(`${LOG_PREFIX} Found ${rows.length} records with empty streamerName to fix.`);

    let updated = 0;
    for (const row of rows) {
      const resolvedName = row.tiktokAccount || row.liverName;
      if (!resolvedName || resolvedName.trim() === '') continue;

      await db.execute(sql`
        UPDATE brand_livestreams 
        SET streamerName = ${resolvedName.trim()}
        WHERE id = ${row.id}
      `);
      updated++;
    }

    console.log(`${LOG_PREFIX} ✅ Updated ${updated} records with resolved streamerNames.`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during backfill:`, error);
  }
}
