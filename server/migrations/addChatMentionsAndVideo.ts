import { sql } from "drizzle-orm";

export async function addChatMentionsAndVideo(db: any) {
  console.log("[Migration] Adding mentions, video messageType, replyToType, replyToFileUrl to chat_messages...");
  try {
    // Add 'video' to messageType ENUM
    await db.execute(sql`
      ALTER TABLE chat_messages 
      MODIFY COLUMN messageType ENUM('text', 'image', 'file', 'video') NOT NULL DEFAULT 'text'
    `);
  } catch (error: any) {
    if (!error.message?.includes("Duplicate") && error.code !== "ER_DUP_FIELDNAME") {
      console.log("[Migration] messageType ENUM modify note:", error.message?.slice(0, 100));
    }
  }
  try {
    // Add mentions column (JSON array of mentioned user IDs)
    await db.execute(sql`
      ALTER TABLE chat_messages 
      ADD COLUMN mentions JSON NULL AFTER replyToContent
    `);
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME" || error.message?.includes("Duplicate column")) {
      console.log("[Migration] mentions column already exists, skipping");
    } else {
      console.log("[Migration] mentions column note:", error.message?.slice(0, 100));
    }
  }
  try {
    // Add replyToType column to distinguish reply content type (text, image, file, video)
    await db.execute(sql`
      ALTER TABLE chat_messages 
      ADD COLUMN replyToType ENUM('text', 'image', 'file', 'video') NULL AFTER mentions
    `);
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME" || error.message?.includes("Duplicate column")) {
      console.log("[Migration] replyToType column already exists, skipping");
    } else {
      console.log("[Migration] replyToType column note:", error.message?.slice(0, 100));
    }
  }
  try {
    // Add replyToFileUrl column for quoting images/files/videos
    await db.execute(sql`
      ALTER TABLE chat_messages 
      ADD COLUMN replyToFileUrl TEXT NULL AFTER replyToType
    `);
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME" || error.message?.includes("Duplicate column")) {
      console.log("[Migration] replyToFileUrl column already exists, skipping");
    } else {
      console.log("[Migration] replyToFileUrl column note:", error.message?.slice(0, 100));
    }
  }
  console.log("[Migration] Chat mentions/video migration complete");
}
