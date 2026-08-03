import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  console.log("Connecting to DB...");
  const db = drizzle(dbUrl);
  
  // Check columns in business_cards table
  console.log("\n=== business_cards table columns ===");
  const [cols] = await db.execute(sql`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'business_cards'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(JSON.stringify(cols, null, 2));
  
  // Check how many have imageUrl
  console.log("\n=== imageUrl stats ===");
  const [stats] = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN imageUrl IS NOT NULL AND imageUrl != '' THEN 1 ELSE 0 END) as with_image,
      SUM(CASE WHEN imageUrl IS NULL OR imageUrl = '' THEN 1 ELSE 0 END) as without_image
    FROM business_cards
  `);
  console.log(JSON.stringify(stats, null, 2));
  
  // Check a few records with imageUrl
  console.log("\n=== Sample records with imageUrl ===");
  const [withImage] = await db.execute(sql`
    SELECT id, name, company, imageUrl, imageKey, createdAt
    FROM business_cards 
    WHERE imageUrl IS NOT NULL AND imageUrl != ''
    LIMIT 5
  `);
  console.log(JSON.stringify(withImage, null, 2));
  
  // Check a few recent records
  console.log("\n=== Most recent 5 records ===");
  const [recent] = await db.execute(sql`
    SELECT id, name, company, imageUrl, imageKey, registeredBy, createdAt
    FROM business_cards 
    ORDER BY id DESC
    LIMIT 5
  `);
  console.log(JSON.stringify(recent, null, 2));
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
