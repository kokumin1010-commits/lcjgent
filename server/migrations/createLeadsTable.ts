/**
 * Migration: Create leads table and lead_collection_history table
 * for independent lead collection pipeline
 * 
 * These tables store leads collected from Google Maps, Google Search, etc.
 * Previously dependent on salesdash.buzzdrop.co.jp, now fully independent.
 */
import { sql } from "drizzle-orm";

export async function createLeadsTable(db: any) {
  try {
    // ---- leads table ----
    const [leadsRows] = await db.execute(sql`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'
    `);
    if ((leadsRows as any[]).length > 0) {
      console.log("[Migration] leads table already exists, skipping");
    } else {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS leads (
          id INT AUTO_INCREMENT PRIMARY KEY,
          companyName VARCHAR(500) NOT NULL,
          email VARCHAR(320),
          phone VARCHAR(50),
          website VARCHAR(500),
          address VARCHAR(500),
          category VARCHAR(255),
          source VARCHAR(100) NOT NULL DEFAULT 'google_maps',
          status VARCHAR(50) NOT NULL DEFAULT 'new',
          contactPerson VARCHAR(255),
          notes TEXT,
          emailSentCount INT DEFAULT 0,
          lastEmailSentAt TIMESTAMP NULL,
          prefecture VARCHAR(50),
          keyword VARCHAR(255),
          googlePlaceId VARCHAR(255),
          rating DECIMAL(2,1),
          reviewCount INT,
          batchId VARCHAR(100),
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_leads_status (status),
          INDEX idx_leads_email (email),
          INDEX idx_leads_source (source),
          INDEX idx_leads_googlePlaceId (googlePlaceId),
          INDEX idx_leads_batchId (batchId),
          INDEX idx_leads_keyword (keyword)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("[Migration] leads table created successfully");
    }

    // ---- lead_collection_history table ----
    const [histRows] = await db.execute(sql`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_collection_history'
    `);
    if ((histRows as any[]).length > 0) {
      console.log("[Migration] lead_collection_history table already exists, skipping");
    } else {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS lead_collection_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword VARCHAR(255) NOT NULL,
          prefecture VARCHAR(50),
          pipeline VARCHAR(50) NOT NULL,
          leadsFound INT DEFAULT 0,
          executedBy VARCHAR(255),
          executedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          batchId VARCHAR(100),
          status VARCHAR(50) DEFAULT 'completed'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("[Migration] lead_collection_history table created successfully");
    }
  } catch (error: any) {
    // If table already exists (error 1050), ignore
    if (error?.errno === 1050 || error?.message?.includes("already exists")) {
      console.log("[Migration] leads/lead_collection_history table already exists (caught), skipping");
      return;
    }
    console.error("[Migration] Failed to create leads tables:", error);
    throw error;
  }
}
