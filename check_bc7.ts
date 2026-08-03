import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check what created the current business_cards table
  // The current table has: id, companyName, category, source, sourceUrl, website, email, phone, contactPerson, memo, batchId, status, tab, createdAt, updatedAt
  // This matches a "lead collection" schema, NOT the Drizzle schema (which has name, imageUrl, etc.)
  
  // Let's check if there's a migration that creates this schema
  // Also check if the table was manually created or via a different migration
  
  // Check the first migration file for business_cards
  console.log("Current business_cards table was created with a DIFFERENT schema than what's in drizzle/0017_short_songbird.sql");
  console.log("The DB table has: id, companyName, category, source, sourceUrl, website, email, phone, contactPerson, memo, batchId, status, tab");
  console.log("The Drizzle schema expects: id, name, nameReading, company, department, position, email, phone, mobile, fax, address, website, imageUrl, imageKey, registeredBy, notes, tags, duplicateHash");
  console.log("");
  console.log("SOLUTION: Need to either:");
  console.log("1. DROP and recreate the table (loses 500 lead records)");
  console.log("2. ALTER TABLE to add missing columns and rename existing ones");
  console.log("3. Rename current table to 'business_leads' and create a new proper 'business_cards' table");
  
  // Check if there's a separate table that could hold the proper business cards
  const [allTables] = await db.execute(sql`
    SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `);
  const tableList = (allTables as any[]).filter(t => 
    t.TABLE_NAME.includes('card') || t.TABLE_NAME.includes('lead') || t.TABLE_NAME.includes('business')
  );
  console.log("\nRelated tables:", JSON.stringify(tableList, null, 2));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
