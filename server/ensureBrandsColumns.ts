/**
 * Ensure brands table has all required columns.
 * Called on server startup to auto-add columns if they don't exist.
 * This is a safety net for when drizzle migrations fail.
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function ensureBrandsColumns(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[BrandsColumns] DB not available, skipping column check");
    return;
  }

  try {
    // Check if hasTikTokBackend column exists
    const [rows]: any = await db.execute(
      sql.raw(`SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brands' AND COLUMN_NAME = 'hasTikTokBackend'`)
    );
    const count = rows?.[0]?.cnt ?? rows?.cnt ?? 0;

    if (Number(count) > 0) {
      console.log("[BrandsColumns] hasTikTokBackend column already exists");
      return;
    }

    console.log("[BrandsColumns] Adding hasTikTokBackend column to brands table...");
    await db.execute(
      sql.raw(`ALTER TABLE brands ADD COLUMN hasTikTokBackend boolean NOT NULL DEFAULT false`)
    );
    console.log("[BrandsColumns] hasTikTokBackend column added successfully");
  } catch (error: any) {
    // If column already exists (race condition), that's fine
    if (error.message?.includes('Duplicate column') || error.message?.includes('already exists')) {
      console.log("[BrandsColumns] Column already exists (concurrent add)");
    } else {
      console.error("[BrandsColumns] Error ensuring columns:", error.message);
    }
  }
}
