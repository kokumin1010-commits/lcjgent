import { drizzle } from 'drizzle-orm/tidb-serverless';
import { connect } from '@tidbcloud/serverless';
import { sql } from 'drizzle-orm';

async function main() {
  const client = connect({ url: process.env.DATABASE_URL });
  const db = drizzle(client);

  const r1 = await db.execute(sql`
    SELECT liverId, MAX(streamerName) as sname, 
           COALESCE(SUM(salesAmount), 0) as totalSales,
           COUNT(*) as cnt
    FROM brand_livestreams 
    WHERE deletedAt IS NULL 
      AND livestreamDate >= '2025-10-31 15:00:00'
      AND livestreamDate <= '2025-11-30 14:59:59'
      AND liverId IS NOT NULL
    GROUP BY liverId
    ORDER BY totalSales DESC
    LIMIT 10
  `);
  console.log('=== 2025-11 ranking ===');
  r1.rows.forEach(r => console.log(JSON.stringify(r)));

  const r2 = await db.execute(sql`
    SELECT streamerName, COALESCE(SUM(salesAmount), 0) as totalSales, COUNT(*) as cnt
    FROM brand_livestreams 
    WHERE deletedAt IS NULL 
      AND livestreamDate >= '2025-10-31 15:00:00'
      AND livestreamDate <= '2025-11-30 14:59:59'
      AND liverId IS NULL
    GROUP BY streamerName ORDER BY totalSales DESC LIMIT 10
  `);
  console.log('\n=== NULL liverId 2025-11 ===');
  r2.rows.forEach(r => console.log(JSON.stringify(r)));

  const r3 = await db.execute(sql`SELECT id, name, isActive FROM livers WHERE isActive = 1 ORDER BY name`);
  console.log('\n=== Active livers ===');
  r3.rows.forEach(r => console.log(JSON.stringify(r)));

  const r4 = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM brand_livestreams 
    WHERE deletedAt IS NULL AND livestreamDate >= '2026-02-28 15:00:00' AND livestreamDate <= '2026-03-31 14:59:59'
  `);
  console.log('\n=== 2026-03 count ===', JSON.stringify(r4.rows));

  const r5 = await db.execute(sql`
    SELECT liverId, MAX(streamerName) as sname, 
           COALESCE(SUM(salesAmount), 0) as totalSales, COUNT(*) as cnt
    FROM brand_livestreams 
    WHERE deletedAt IS NULL 
      AND livestreamDate >= '2026-01-31 15:00:00'
      AND livestreamDate <= '2026-02-28 14:59:59'
      AND liverId IS NOT NULL
    GROUP BY liverId ORDER BY totalSales DESC LIMIT 10
  `);
  console.log('\n=== 2026-02 ranking ===');
  r5.rows.forEach(r => console.log(JSON.stringify(r)));

  // Check distinct liverId -> streamerName
  const r6 = await db.execute(sql`
    SELECT DISTINCT liverId, streamerName, brandId
    FROM brand_livestreams 
    WHERE deletedAt IS NULL AND liverId IS NOT NULL
    ORDER BY liverId LIMIT 30
  `);
  console.log('\n=== liverId -> streamerName mapping ===');
  r6.rows.forEach(r => console.log(JSON.stringify(r)));
}

main().catch(console.error);
