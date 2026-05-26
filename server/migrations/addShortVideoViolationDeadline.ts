import { MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

export async function addShortVideoViolationDeadline(db: MySql2Database) {
  console.log("[Migration] Adding isViolation, violationNote, deadline to brand_short_videos...");
  
  // isViolation カラム追加
  try {
    await db.execute(sql`ALTER TABLE brand_short_videos ADD COLUMN isViolation INT NOT NULL DEFAULT 0`);
    console.log("[Migration] Added isViolation column");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] isViolation column already exists, skipping");
    } else {
      console.error("[Migration] Error adding isViolation:", e.message);
    }
  }

  // violationNote カラム追加
  try {
    await db.execute(sql`ALTER TABLE brand_short_videos ADD COLUMN violationNote TEXT`);
    console.log("[Migration] Added violationNote column");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] violationNote column already exists, skipping");
    } else {
      console.error("[Migration] Error adding violationNote:", e.message);
    }
  }

  // deadline カラム追加
  try {
    await db.execute(sql`ALTER TABLE brand_short_videos ADD COLUMN deadline TIMESTAMP NULL`);
    console.log("[Migration] Added deadline column");
  } catch (e: any) {
    if (e.message?.includes("Duplicate column")) {
      console.log("[Migration] deadline column already exists, skipping");
    } else {
      console.error("[Migration] Error adding deadline:", e.message);
    }
  }

  console.log("[Migration] brand_short_videos violation/deadline migration complete");
}
