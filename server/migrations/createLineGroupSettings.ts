import { type MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
export async function createLineGroupSettings(db: MySql2Database<any>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS line_group_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lineGroupId VARCHAR(255) NOT NULL UNIQUE,
      autoReplyEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      autoReplyMessage TEXT,
      analysisEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      proactiveAiEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      relationshipObjective TEXT,
      groupInsightJson LONGTEXT,
      groupInsightUpdatedAt TIMESTAMP NULL,
      groupInsightLastMessageAt TIMESTAMP NULL,
      groupInsightMessageCount INT NOT NULL DEFAULT 0,
      groupInsightLeaseToken VARCHAR(64) NULL,
      groupInsightLeaseExpiresAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  // Add autoReplyMessage column if it doesn't exist (safe for existing tables)
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS autoReplyMessage TEXT`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS analysisEnabled BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS proactiveAiEnabled BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS relationshipObjective TEXT`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightJson LONGTEXT`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightUpdatedAt TIMESTAMP NULL`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightLastMessageAt TIMESTAMP NULL`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightMessageCount INT NOT NULL DEFAULT 0`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightLeaseToken VARCHAR(64) NULL`).catch(() => {});
  await db.execute(sql`ALTER TABLE line_group_settings ADD COLUMN IF NOT EXISTS groupInsightLeaseExpiresAt TIMESTAMP NULL`).catch(() => {});
  console.log("[Migration] line_group_settings table ready");
}
