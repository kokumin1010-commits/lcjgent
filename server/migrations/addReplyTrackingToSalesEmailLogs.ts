import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

/**
 * Add reply tracking columns to sales_email_logs table
 * - replyReceived: whether a reply has been received from the recipient
 * - replyReceivedAt: when the reply was received
 * - repliedByUs: whether we have replied back
 * - repliedByUsAt: when we replied back
 */
export async function addReplyTrackingToSalesEmailLogs(db: MySql2Database<any>) {
  const columns = [
    { name: "replyReceived", ddl: "ADD COLUMN `replyReceived` TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "replyReceivedAt", ddl: "ADD COLUMN `replyReceivedAt` TIMESTAMP NULL DEFAULT NULL" },
    { name: "repliedByUs", ddl: "ADD COLUMN `repliedByUs` TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "repliedByUsAt", ddl: "ADD COLUMN `repliedByUsAt` TIMESTAMP NULL DEFAULT NULL" },
  ];

  for (const col of columns) {
    try {
      const [rows] = await db.execute(sql.raw(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales_email_logs' AND COLUMN_NAME = '${col.name}'`
      ));
      if (Array.isArray(rows) && rows.length === 0) {
        await db.execute(sql.raw(`ALTER TABLE sales_email_logs ${col.ddl}`));
        console.log(`[Migration] Added column ${col.name} to sales_email_logs`);
      }
    } catch (err: any) {
      console.error(`[Migration] Error adding ${col.name}:`, err.message);
    }
  }

  // Add index for quick unreplied lookup
  try {
    const [idxRows] = await db.execute(sql.raw(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'sales_email_logs' AND INDEX_NAME = 'idx_reply_status'`
    ));
    if (Array.isArray(idxRows) && idxRows.length === 0) {
      await db.execute(sql.raw(
        `ALTER TABLE sales_email_logs ADD INDEX idx_reply_status (replyReceived, repliedByUs, status)`
      ));
      console.log("[Migration] Added idx_reply_status index");
    }
  } catch (err: any) {
    console.error("[Migration] Error adding idx_reply_status:", err.message);
  }
}
