import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check all tables
  const [tables] = await db.execute(sql`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND (TABLE_NAME LIKE '%lead%' OR TABLE_NAME LIKE '%card%' OR TABLE_NAME LIKE '%business%')
    ORDER BY TABLE_NAME
  `);
  console.log("Related tables:", JSON.stringify(tables, null, 2));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
