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
      console.log("[FestivalTables] Festival tables already exist, checking new tables...");
      // Still create new tables that might not exist yet
      await ensureNewFestivalTables(db);
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

    // Create festival_accounts (auto-created on form submission)
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_accounts (
        id int AUTO_INCREMENT NOT NULL,
        email varchar(320) NOT NULL,
        password_hash varchar(255) NOT NULL,
        account_type enum('company','liver','general') NOT NULL,
        application_id int NOT NULL,
        display_name varchar(255) NOT NULL,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        last_login_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_email (email)
      )
    `));
    console.log("[FestivalTables] ✅ festival_accounts created");

    // Create festival_event_settings
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_event_settings (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        event_name varchar(500),
        venue varchar(500),
        venue_address text,
        day1_date varchar(50),
        day2_date varchar(50),
        day1_start_time varchar(20),
        day1_end_time varchar(20),
        day2_start_time varchar(20),
        day2_end_time varchar(20),
        max_capacity int,
        description text,
        programs json,
        is_published tinyint(1) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_event_year (event_year)
      )
    `));
    console.log("[FestivalTables] ✅ festival_event_settings created");

    // Create festival_sponsors
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_sponsors (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        company_name varchar(500) NOT NULL,
        tier enum('platinum','gold','silver','bronze','partner') NOT NULL DEFAULT 'bronze',
        logo_url text,
        website_url text,
        contact_name varchar(255),
        contact_email varchar(320),
        contact_phone varchar(50),
        sponsorship_amount bigint,
        booth_size varchar(100),
        status enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
        notes text,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] ✅ festival_sponsors created");

    // Create festival_line_registrations
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_line_registrations (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        line_user_id varchar(255),
        display_name varchar(255),
        registered_from varchar(255),
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] ✅ festival_line_registrations created");

  } catch (err: any) {
    console.error("[FestivalTables] Error creating tables:", err.message);
    // Don't throw - server should still start even if table creation fails
  }
}

/**
 * Ensure new festival tables exist (called even when old tables already exist)
 */
async function ensureNewFestivalTables(db: any): Promise<void> {
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_event_settings (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        event_name varchar(500),
        venue varchar(500),
        venue_address text,
        day1_date varchar(50),
        day2_date varchar(50),
        day1_start_time varchar(20),
        day1_end_time varchar(20),
        day2_start_time varchar(20),
        day2_end_time varchar(20),
        max_capacity int,
        description text,
        programs json,
        is_published tinyint(1) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_event_year (event_year)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_sponsors (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        company_name varchar(500) NOT NULL,
        tier enum('platinum','gold','silver','bronze','partner') NOT NULL DEFAULT 'bronze',
        logo_url text,
        website_url text,
        contact_name varchar(255),
        contact_email varchar(320),
        contact_phone varchar(50),
        sponsorship_amount bigint,
        booth_size varchar(100),
        status enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
        notes text,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS festival_line_registrations (
        id int AUTO_INCREMENT NOT NULL,
        event_year varchar(10) NOT NULL DEFAULT '2026',
        line_user_id varchar(255),
        display_name varchar(255),
        registered_from varchar(255),
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `));
    console.log("[FestivalTables] \u2705 New festival tables ensured");

    // Ensure festival_accounts has role column and admin support
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts ADD COLUMN role ENUM('applicant', 'admin') NOT NULL DEFAULT 'applicant' AFTER account_type`));
      console.log("[FestivalTables] \u2705 role column added to festival_accounts");
    } catch (e: any) {
      // Ignore if column already exists
    }
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN account_type ENUM('company','liver','general','admin') NOT NULL`));
      console.log("[FestivalTables] \u2705 account_type enum updated");
    } catch (e: any) {
      // Ignore if already done
    }
    try {
      await db.execute(sql.raw(`ALTER TABLE festival_accounts MODIFY COLUMN application_id INT NULL`));
      console.log("[FestivalTables] \u2705 application_id made nullable");
    } catch (e: any) {
      // Ignore if already done
    }
  } catch (err: any) {
    console.error("[FestivalTables] Error creating new tables:", err.message);
  }
}
