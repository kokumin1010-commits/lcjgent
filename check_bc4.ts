import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check leads table structure
  const [leadsCols] = await db.execute(sql`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'
    ORDER BY ORDINAL_POSITION
  `);
  console.log("leads table columns:", JSON.stringify(leadsCols, null, 2));
  
  const [leadsCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM leads`);
  console.log("\nleads count:", JSON.stringify(leadsCount));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
