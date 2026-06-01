/**
 * Migration: Add tracking columns to sales_email_logs table
 * 
 * メール開封トラッキング + PDFダウンロードトラッキング用カラム追加
 */
import { sql } from "drizzle-orm";

export async function addTrackingToSalesEmailLogs(db: any) {
  try {
    // Check if trackingId column already exists
    const [rows] = await db.execute(sql`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_email_logs' AND COLUMN_NAME = 'trackingId'
    `);
    if ((rows as any[]).length > 0) {
      console.log("[Migration] tracking columns already exist in sales_email_logs, skipping.");
      return;
    }

    await db.execute(sql`
      ALTER TABLE sales_email_logs
      ADD COLUMN trackingId VARCHAR(64) NULL,
      ADD COLUMN openedAt TIMESTAMP NULL,
      ADD COLUMN openCount INT DEFAULT 0,
      ADD COLUMN lastOpenedAt TIMESTAMP NULL,
      ADD COLUMN pdfDownloadedAt TIMESTAMP NULL,
      ADD COLUMN pdfDownloadCount INT DEFAULT 0,
      ADD INDEX idx_trackingId (trackingId)
    `);
    console.log("[Migration] Added tracking columns to sales_email_logs successfully.");
  } catch (err: any) {
    if (err.message?.includes("Duplicate column")) {
      console.log("[Migration] tracking columns already exist in sales_email_logs.");
    } else {
      throw err;
    }
  }
}
