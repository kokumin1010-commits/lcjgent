import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Check if __drizzle_migrations table exists and what migrations have been applied
  try {
    const [migrations] = await db.execute(sql`SELECT * FROM __drizzle_migrations ORDER BY created_at`);
    console.log("Applied migrations:", JSON.stringify(migrations, null, 2));
  } catch (e: any) {
    console.log("No __drizzle_migrations table:", e.message);
  }
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
