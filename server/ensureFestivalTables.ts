/**
 * Ensure festival tables exist in the database.
 * Called on server startup to auto-create tables if they don't exist.
 */
import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function ensureFestivalTables(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[FestivalTables] DB not available, skipping table check");
    return;
  }

  try {
    // Check if festival_company_applications exists
    const [rows]: any = await db.execute(
      sql.raw(`SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'festival_company_applications'`)
    );
    
    const count = rows?.[0]?.cnt ?? rows?.cnt ?? 0;
    if (Number(count) > 0) {
      console.log("[FestivalTables] Festival tables already exist");
      return;
    }

    console.log("[FestivalTables] Creating festival tables...");

    // Create festival_company_applications
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_company_applications (
        id int AUTO_INCREMENT NOT NULL,
        company_name varchar(255) NOT NULL,
        contact_name varchar(255) NOT NULL,
        contact_department varchar(255) NOT NULL,
        contact_name_kana varchar(255) NOT NULL,
        postal_code varchar(20) NOT NULL,
        address text NOT NULL,
        phone varchar(50) NOT NULL,
        email varchar(320) NOT NULL,
        website_url varchar(500) NOT NULL,
        line_or_lark varchar(255),
        tiktok_shop_seller_name varchar(255) NOT NULL,
        brand_intro text NOT NULL,
        tiktok_shop_url varchar(500),
        matching_products text,
        target_audience text NOT NULL,
        sales_license text NOT NULL,
        status enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
        notes text,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] ✅ festival_company_applications created");

    // Create festival_liver_applications
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_liver_applications (
        id int AUTO_INCREMENT NOT NULL,
        name varchar(255) NOT NULL,
        name_kana varchar(255) NOT NULL,
        liver_name varchar(255) NOT NULL,
        agency varchar(255),
        account_info text,
        genre varchar(255),
        email varchar(320) NOT NULL,
        phone varchar(50) NOT NULL,
        line_or_lark varchar(255),
        attendance_schedule enum('day1_only','day2_only','both_days') NOT NULL,
        matching_preference enum('yes','no') NOT NULL,
        portrait_rights_consent enum('agreed') NOT NULL,
        compliance_consent enum('agreed') NOT NULL,
        status enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
        notes text,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] ✅ festival_liver_applications created");

    // Create festival_general_applications
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_general_applications (
        id int AUTO_INCREMENT NOT NULL,
        participation_type enum('corporate','individual') NOT NULL,
        company_name varchar(255) NOT NULL,
        department varchar(255),
        name varchar(255) NOT NULL,
        name_kana varchar(255) NOT NULL,
        email varchar(320) NOT NULL,
        phone varchar(50) NOT NULL,
        attendance_schedule enum('day1_only','day2_only','both_days') NOT NULL,
        visit_purposes json NOT NULL,
        portrait_rights_consent enum('agreed') NOT NULL,
        compliance_consent enum('agreed') NOT NULL,
        status enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
        notes text,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] ✅ festival_general_applications created");

  } catch (err: any) {
    console.error("[FestivalTables] Error creating tables:", err.message);
    // Don't throw - server should still start even if table creation fails
  }
}
