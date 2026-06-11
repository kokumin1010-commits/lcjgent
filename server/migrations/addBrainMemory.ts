/**
 * Migration: Add Brain Memory System
 * 1. Add fileContent/fileUrl columns to lcj_brain_chat_logs for persistent file context
 * 2. Create lcj_brain_insights table for self-learning (auto-extracted insights from conversations)
 */
import { getDb } from "../db";

export async function runAddBrainMemoryMigration() {
  const db = await getDb();
  if (!db) return;
  try {
    // Add fileContent column to store file text content for context continuity
    await db.execute({ sql: `ALTER TABLE lcj_brain_chat_logs ADD COLUMN IF NOT EXISTS fileContent MEDIUMTEXT DEFAULT NULL`, params: [] });
    // Add fileUrl column to store file download URL
    await db.execute({ sql: `ALTER TABLE lcj_brain_chat_logs ADD COLUMN IF NOT EXISTS fileUrl VARCHAR(500) DEFAULT NULL`, params: [] });
    // Add fileName column
    await db.execute({ sql: `ALTER TABLE lcj_brain_chat_logs ADD COLUMN IF NOT EXISTS fileName VARCHAR(255) DEFAULT NULL`, params: [] });
    console.log("[Migration] Added fileContent/fileUrl/fileName columns to lcj_brain_chat_logs");
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) {
      console.error("[Migration] Error adding columns:", e.message);
    }
  }
  try {
    // Create insights table for self-learning
    await db.execute({ sql: `CREATE TABLE IF NOT EXISTS lcj_brain_insights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversationId INT,
      category VARCHAR(100) NOT NULL,
      insight TEXT NOT NULL,
      confidence FLOAT DEFAULT 0.8,
      relatedBrandId INT DEFAULT NULL,
      relatedLiverId INT DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_category (category),
      INDEX idx_brand (relatedBrandId),
      INDEX idx_liver (relatedLiverId),
      INDEX idx_created (createdAt)
    )`, params: [] });
    console.log("[Migration] Created lcj_brain_insights table");
  } catch (e: any) {
    if (!e.message?.includes("already exists")) {
      console.error("[Migration] Error creating insights table:", e.message);
    }
  }
}
