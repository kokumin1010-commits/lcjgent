import { getDb } from "../db";

/**
 * Add editedAt and isRevoked columns to chat_messages table
 * - editedAt: timestamp when message was last edited (NULL = never edited)
 * - isRevoked: whether the message has been revoked/recalled
 */
export async function addChatMessageEditRevoke() {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      // @ts-ignore
      `ALTER TABLE chat_messages ADD COLUMN editedAt TIMESTAMP NULL DEFAULT NULL`
    );
    console.log("[Migration] Added editedAt column to chat_messages");
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) {
      console.error("[Migration] Error adding editedAt:", e.message);
    }
  }

  try {
    await db.execute(
      // @ts-ignore
      `ALTER TABLE chat_messages ADD COLUMN isRevoked TINYINT(1) NOT NULL DEFAULT 0`
    );
    console.log("[Migration] Added isRevoked column to chat_messages");
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) {
      console.error("[Migration] Error adding isRevoked:", e.message);
    }
  }
}
