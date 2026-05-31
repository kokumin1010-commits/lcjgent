import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check brands table for seinsmous / セインムー
const [rows] = await conn.execute(
  `SELECT id, name, nameJa, status, deletedAt FROM brands WHERE name LIKE '%seinsmous%' OR name LIKE '%セインムー%' OR nameJa LIKE '%seinsmous%' OR nameJa LIKE '%セインムー%'`
);

console.log('=== Brands matching seinsmous/セインムー ===');
console.table(rows);

// Also check brand_livestreams for these brand IDs
if (rows.length > 0) {
  const ids = rows.map(r => r.id);
  const [lsRows] = await conn.execute(
    `SELECT brandId, COUNT(*) as count, SUM(duration) as totalMinutes FROM livestream_brands WHERE brandId IN (${ids.join(',')}) GROUP BY brandId`
  );
  console.log('\n=== livestream_brands usage ===');
  console.table(lsRows);

  // Check brand_livestreams (old table) for these brand IDs
  const [blRows] = await conn.execute(
    `SELECT brandId, COUNT(*) as count FROM brand_livestreams WHERE brandId IN (${ids.join(',')}) AND deletedAt IS NULL GROUP BY brandId`
  );
  console.log('\n=== brand_livestreams (old table) usage ===');
  console.table(blRows);
}

await conn.end();
