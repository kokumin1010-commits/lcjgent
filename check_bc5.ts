import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  const [result] = await db.execute(sql`SHOW CREATE TABLE business_cards`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
