import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export async function createLcjBrainChatLogsTable(db: MySql2Database<any>) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lcj_brain_chat_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT,
        userName VARCHAR(100),
        sessionId VARCHAR(100),
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        context VARCHAR(50),
        suggestedQuestions TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_sessionId (sessionId),
        INDEX idx_createdAt (createdAt)
      )
    `);
    console.log("[Migration] lcj_brain_chat_logs table created or already exists");
  } catch (error: any) {
    console.error("[Migration] Error creating lcj_brain_chat_logs:", error.message);
  }
}
