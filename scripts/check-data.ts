import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  
  const connection = await mysql.createConnection(dbUrl);
  const db = drizzle(connection);
  
  const [pmCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM product_master`);
  console.log("product_master count:", (pmCount as any)[0]?.cnt);
  
  const [urCount] = await db.execute(sql`SELECT COUNT(DISTINCT productName) as cnt FROM receipt_reviews WHERE isVisible = 1`);
  console.log("unique review products:", (urCount as any)[0]?.cnt);
  
  const [top10] = await db.execute(sql`SELECT productName, COUNT(*) as reviewCount, ROUND(AVG(rating),1) as avgRating FROM receipt_reviews WHERE isVisible = 1 GROUP BY productName ORDER BY reviewCount DESC LIMIT 10`);
  console.log("\nTop 10 review products:");
  for (const r of top10 as any[]) {
    console.log(`  ${r.productName}: ${r.reviewCount} reviews, avg ${r.avgRating}`);
  }
  
  const [pmSample] = await db.execute(sql`SELECT id, canonicalName, sourceUrl, imageUrl, imageStatus FROM product_master LIMIT 5`);
  console.log("\nproduct_master sample:");
  for (const r of pmSample as any[]) {
    console.log(`  [${r.id}] ${r.canonicalName} | url: ${r.sourceUrl || 'null'} | img: ${r.imageUrl ? 'YES' : 'null'} | status: ${r.imageStatus}`);
  }
  
  await connection.end();
}

main().catch(console.error);
