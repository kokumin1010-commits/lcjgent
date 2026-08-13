import { type MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

export async function createLineGroupSettings(db: MySql2Database<any>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS line_group_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lineGroupId VARCHAR(255) NOT NULL UNIQUE,
      autoReplyEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("[Migration] line_group_settings table ready");
}
