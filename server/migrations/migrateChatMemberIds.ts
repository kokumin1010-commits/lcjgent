import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

/**
 * Migration: Fix chat_room_members userId for staff users
 * 
 * Background: getChatUser was changed to return staff.id instead of users.id.
 * However, existing chat_room_members entries still have users.id as userId.
 * This migration updates those entries to use staff.id instead.
 * 
 * Logic:
 * - For each chat_room_members entry with userType='staff'
 * - Find the corresponding user in users table
 * - Find the matching staff by email
 * - Update userId to staff.id
 */
export async function migrateChatMemberIds(db: MySql2Database<any>) {
  try {
    // Find all staff members in chat_room_members whose userId doesn't match any staff.id
    // These are likely using users.id instead of staff.id
    const result = await db.execute(sql`
      UPDATE chat_room_members crm
      JOIN users u ON crm.userId = u.id
      JOIN staff s ON u.email = s.email AND s.isActive = 'active'
      SET crm.userId = s.id
      WHERE crm.userType = 'staff'
        AND crm.userId != s.id
        AND NOT EXISTS (SELECT 1 FROM staff WHERE id = crm.userId AND isActive = 'active')
    `);
    const affected = (result as any)[0]?.affectedRows || 0;
    if (affected > 0) {
      console.log(`[Migration] migrateChatMemberIds: Updated ${affected} chat_room_members entries (users.id → staff.id)`);
    } else {
      console.log("[Migration] migrateChatMemberIds: No entries needed migration");
    }
  } catch (error: any) {
    console.error("[Migration] migrateChatMemberIds error:", error.message);
  }
}
