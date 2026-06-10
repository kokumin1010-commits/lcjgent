import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

/**
 * AI Coach Brain - 3層構造の自律型コーチング脳
 * 
 * Layer 1: ai_coach_master_knowledge - 全ライバーの集合知（マスターブレイン）
 * Layer 2: ai_coach_liver_memory - ライバー個別のカルテ（個人記憶）
 * Layer 3: ai_coach_messages - 既存のセッション履歴（短期記憶）
 */
export async function createAiCoachBrainTables(db: MySql2Database<any>) {
  console.log("[Migration] Creating AI Coach Brain tables (master_knowledge + liver_memory)...");

  // Layer 1: Master Knowledge - 全ライバーの集合知
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_coach_master_knowledge (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        metadata JSON,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        INDEX idx_category (category),
        INDEX idx_active_category (isActive, category),
        INDEX idx_version (version)
      )
    `);
    console.log("[Migration] ai_coach_master_knowledge table created successfully");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ai_coach_master_knowledge table already exists, skipping");
    } else {
      console.error("[Migration] Error creating ai_coach_master_knowledge:", error.message);
    }
  }

  // Layer 2: Liver Memory - ライバー個別のカルテ
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_coach_liver_memory (
        id INT PRIMARY KEY AUTO_INCREMENT,
        liverId INT NOT NULL,
        summary TEXT NOT NULL,
        strengths TEXT,
        weaknesses TEXT,
        currentGoals TEXT,
        pastAdviceResults TEXT,
        communicationStyle TEXT,
        growthPhase ENUM('new', 'developing', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'new',
        coachingCount INT NOT NULL DEFAULT 0,
        lastCoachingAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        UNIQUE INDEX idx_liver_unique (liverId),
        INDEX idx_growth_phase (growthPhase)
      )
    `);
    console.log("[Migration] ai_coach_liver_memory table created successfully");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ai_coach_liver_memory table already exists, skipping");
    } else {
      console.error("[Migration] Error creating ai_coach_liver_memory:", error.message);
    }
  }

  // Master Knowledge generation log
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_coach_brain_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        action VARCHAR(100) NOT NULL,
        targetType VARCHAR(50) NOT NULL,
        targetId INT,
        details TEXT,
        tokensUsed INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_action (action),
        INDEX idx_target (targetType, targetId),
        INDEX idx_created (createdAt)
      )
    `);
    console.log("[Migration] ai_coach_brain_logs table created successfully");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ai_coach_brain_logs table already exists, skipping");
    } else {
      console.error("[Migration] Error creating ai_coach_brain_logs:", error.message);
    }
  }

  console.log("[Migration] AI Coach Brain tables migration completed");
}
