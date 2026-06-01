/**
 * Migration: Create sales_email_logs table
 * 
 * 営業メール送信履歴テーブル。テスト送信・一括送信の全履歴を記録。
 */
import { sql } from "drizzle-orm";

export async function createSalesEmailLogs(db: any) {
  try {
    // Check if table already exists
    const [rows] = await db.execute(sql`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'sales_email_logs'
    `);
    if ((rows as any[]).length > 0) {
      console.log("[Migration] sales_email_logs table already exists, skipping.");
      return;
    }

    await db.execute(sql`
      CREATE TABLE sales_email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        toEmail VARCHAR(320) NOT NULL,
        toName VARCHAR(255),
        toCompany VARCHAR(255),
        subject VARCHAR(500) NOT NULL,
        contentPreview TEXT,
        sendType VARCHAR(50) NOT NULL DEFAULT 'bulk',
        attachPdf BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) NOT NULL DEFAULT 'sent',
        errorMessage TEXT,
        businessCardId INT,
        sentBy INT,
        sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_toEmail (toEmail),
        INDEX idx_businessCardId (businessCardId),
        INDEX idx_sentAt (sentAt),
        INDEX idx_sendType (sendType)
      )
    `);
    console.log("[Migration] Created sales_email_logs table successfully.");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("[Migration] sales_email_logs table already exists.");
    } else {
      throw err;
    }
  }
}
