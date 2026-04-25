import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export async function addAiCoachMessagesTable(db: MySql2Database) {
  console.log("[Migration] Creating ai_coach_messages table...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_coach_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        liverId INT NOT NULL,
        role ENUM('ai', 'user') NOT NULL,
        content TEXT NOT NULL,
        messageType VARCHAR(100),
        contextType VARCHAR(100),
        contextId INT,
        metadata JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_ai_coach_liver (liverId),
        INDEX idx_ai_coach_liver_created (liverId, createdAt)
      )
    `);
    
    console.log("[Migration] ai_coach_messages table created successfully");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ai_coach_messages table already exists, skipping");
    } else {
      throw error;
    }
  }
}
