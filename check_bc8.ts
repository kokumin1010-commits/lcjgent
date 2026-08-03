import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check if there was a DROP TABLE and recreation at some point
  // The current table has companyName (NOT name), sourceUrl, contactPerson, memo, batchId, status (enum), tab
  // This looks like a "lead collection" table that was created manually or via a script
  
  // Check the AUTO_INCREMENT value - 30001 means there were at most 30000 records at some point
  // But currently only 500 records exist
  
  // Let's check the data more carefully
  const [statusDist] = await db.execute(sql`
    SELECT status, COUNT(*) as cnt FROM business_cards GROUP BY status
  `);
  console.log("Status distribution:", JSON.stringify(statusDist));
  
  const [tabDist] = await db.execute(sql`
    SELECT tab, COUNT(*) as cnt FROM business_cards GROUP BY tab
  `);
  console.log("Tab distribution:", JSON.stringify(tabDist));
  
  const [sourceDist] = await db.execute(sql`
    SELECT source, COUNT(*) as cnt FROM business_cards GROUP BY source
  `);
  console.log("Source distribution:", JSON.stringify(sourceDist));
  
  const [dateDist] = await db.execute(sql`
    SELECT DATE(createdAt) as dt, COUNT(*) as cnt FROM business_cards GROUP BY DATE(createdAt) ORDER BY dt DESC LIMIT 5
  `);
  console.log("Date distribution:", JSON.stringify(dateDist));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
