import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check total count
  const [count] = await db.execute(sql`SELECT COUNT(*) as cnt FROM business_cards`);
  console.log("Total count:", JSON.stringify(count));
  
  // Check sample data
  const [sample] = await db.execute(sql`SELECT * FROM business_cards LIMIT 3`);
  console.log("\nSample data:", JSON.stringify(sample, null, 2));
  
  // Check if there's a separate table for uploaded cards
  const [tables] = await db.execute(sql`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME LIKE '%card%'
  `);
  console.log("\nTables with 'card':", JSON.stringify(tables));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
