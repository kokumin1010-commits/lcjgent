import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  console.log("=== Business Cards Table Fix Migration ===");
  
  // Step 1: Rename current business_cards to business_cards_kalodata
  console.log("\n[Step 1] Renaming business_cards → business_cards_kalodata...");
  try {
    await db.execute(sql`RENAME TABLE business_cards TO business_cards_kalodata`);
    console.log("  ✓ Renamed successfully");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("  ⚠ business_cards_kalodata already exists, dropping old and retrying...");
      await db.execute(sql`DROP TABLE IF EXISTS business_cards_kalodata`);
      await db.execute(sql`RENAME TABLE business_cards TO business_cards_kalodata`);
      console.log("  ✓ Renamed successfully (after drop)");
    } else {
      console.error("  ✗ Error:", e.message);
      throw e;
    }
  }
  
  // Step 2: Create new business_cards table with correct schema
  console.log("\n[Step 2] Creating new business_cards table with correct schema...");
  await db.execute(sql`
    CREATE TABLE business_cards (
      id int AUTO_INCREMENT NOT NULL,
      name varchar(255) NOT NULL,
      nameReading varchar(255),
      company varchar(255),
      department varchar(255),
      position varchar(255),
      email varchar(320),
      phone varchar(50),
      mobile varchar(50),
      fax varchar(50),
      address text,
      website varchar(500),
      imageUrl text,
      imageKey varchar(512),
      registeredBy int NOT NULL,
      notes text,
      tags json,
      duplicateHash varchar(64),
      salesStatus enum('new','contacted','negotiating','meeting','contracted','rejected') DEFAULT 'new',
      assignedTo int,
      nextFollowUpAt timestamp NULL,
      linkedBrandId int,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT business_cards_id PRIMARY KEY(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("  ✓ Created new business_cards table");
  
  // Step 3: Verify
  console.log("\n[Step 3] Verifying...");
  const [cols] = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_cards'
    ORDER BY ORDINAL_POSITION
  `);
  console.log("  New table columns:", (cols as any[]).map(c => c.COLUMN_NAME).join(", "));
  
  const [kalodataCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM business_cards_kalodata`);
  console.log("  Kalodata data preserved:", JSON.stringify(kalodataCount));
  
  console.log("\n=== Migration Complete ===");
  process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
