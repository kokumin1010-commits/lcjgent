import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export async function addAiCoachRoomsTable(db: MySql2Database) {
  console.log("[Migration] Creating ai_coach_rooms table and adding roomId to ai_coach_messages...");
  
  try {
    // Create rooms table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_coach_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        liverId INT NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '新しい会話',
        lastMessageAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        deletedAt TIMESTAMP NULL,
        INDEX idx_ai_coach_rooms_liver (liverId),
        INDEX idx_ai_coach_rooms_liver_last (liverId, lastMessageAt)
      )
    `);
    console.log("[Migration] ai_coach_rooms table created successfully");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("[Migration] ai_coach_rooms table already exists, skipping");
    } else {
      throw error;
    }
  }
  
  try {
    // Add roomId column to ai_coach_messages
    await db.execute(sql`
      ALTER TABLE ai_coach_messages ADD COLUMN roomId INT NULL AFTER liverId
    `);
    console.log("[Migration] Added roomId column to ai_coach_messages");
  } catch (error: any) {
    if (error.message?.includes("Duplicate column")) {
      console.log("[Migration] roomId column already exists, skipping");
    } else {
      console.error("[Migration] Error adding roomId column:", error.message);
    }
  }
  
  try {
    // Add index on roomId
    await db.execute(sql`
      ALTER TABLE ai_coach_messages ADD INDEX idx_ai_coach_room (roomId)
    `);
    console.log("[Migration] Added roomId index to ai_coach_messages");
  } catch (error: any) {
    if (error.message?.includes("Duplicate key name")) {
      console.log("[Migration] roomId index already exists, skipping");
    } else {
      console.error("[Migration] Error adding roomId index:", error.message);
    }
  }
  
  // Migrate existing messages: create a default room for each liver and assign messages
  try {
    // Find all livers with messages but no room
    const [liverRows] = await db.execute(sql`
      SELECT DISTINCT liverId FROM ai_coach_messages WHERE roomId IS NULL
    `) as any;
    
    if (liverRows && liverRows.length > 0) {
      for (const row of liverRows) {
        // Create default room for this liver
        const [result] = await db.execute(sql`
          INSERT INTO ai_coach_rooms (liverId, title, lastMessageAt)
          SELECT ${row.liverId}, 'LCJ 神コーチ', COALESCE(MAX(createdAt), NOW())
          FROM ai_coach_messages WHERE liverId = ${row.liverId}
        `) as any;
        
        const roomId = result.insertId;
        
        // Assign all existing messages to this room
        await db.execute(sql`
          UPDATE ai_coach_messages SET roomId = ${roomId} WHERE liverId = ${row.liverId} AND roomId IS NULL
        `);
        
        console.log(`[Migration] Migrated liver ${row.liverId} messages to room ${roomId}`);
      }
    }
    console.log("[Migration] ai_coach_rooms migration completed successfully");
  } catch (error: any) {
    console.error("[Migration] Error migrating existing messages:", error.message);
  }
}
