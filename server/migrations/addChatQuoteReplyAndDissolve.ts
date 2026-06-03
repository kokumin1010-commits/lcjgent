import { sql } from "drizzle-orm";

export async function addChatQuoteReplyAndDissolve(db: any) {
  // Add replyToId column to chat_messages for quote reply feature
  try {
    await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN replyToId INT NULL`);
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) throw e;
  }
  // Add replyToContent column to chat_messages (cached for display without extra query)
  try {
    await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN replyToName VARCHAR(100) NULL`);
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) throw e;
  }
  try {
    await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN replyToContent TEXT NULL`);
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) throw e;
  }
  // Add isDissolvedAt column to chat_rooms for dissolve feature
  try {
    await db.execute(sql`ALTER TABLE chat_rooms ADD COLUMN dissolvedAt TIMESTAMP NULL`);
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) throw e;
  }
  // Add role column to chat_room_members (owner/admin/member)
  try {
    await db.execute(sql`ALTER TABLE chat_room_members ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'member'`);
  } catch (e: any) {
    if (!e.message?.includes("Duplicate column")) throw e;
  }
  // Set room creator as owner
  try {
    await db.execute(sql`
      UPDATE chat_room_members crm
      INNER JOIN chat_rooms cr ON crm.roomId = cr.id
      SET crm.role = 'owner'
      WHERE cr.createdBy = crm.userId
    `);
  } catch (e: any) {
    // Ignore if fails
  }
}
