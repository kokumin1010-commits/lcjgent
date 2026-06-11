import { sql } from "drizzle-orm";

/**
 * One-time migration: Deactivate the staff account with email j2914113930@163.com
 * Also deactivate the corresponding user account if exists
 */
export async function deactivateStaffAccount(db: any) {
  try {
    // Deactivate the staff record
    await db.execute(sql`
      UPDATE staff 
      SET isActive = 'inactive', 
          resignDate = NOW(), 
          resignReason = '账号注销'
      WHERE email = 'j2914113930@163.com' AND isActive = 'active'
    `);
    
    // Also deactivate the corresponding user record if exists
    await db.execute(sql`
      UPDATE users 
      SET role = 'user'
      WHERE email = 'j2914113930@163.com'
    `);
    
    // Also deactivate in report_staff if exists
    await db.execute(sql`
      UPDATE report_staff 
      SET isActive = 'inactive'
      WHERE email = 'j2914113930@163.com' AND isActive = 'active'
    `);
    
    console.log("[Migration] Deactivated staff account: j2914113930@163.com");
  } catch (err: unknown) {
    // Ignore if tables don't exist or already done
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("doesn't exist")) {
      console.error("[Migration] Deactivate staff account error:", msg);
    }
  }
}
