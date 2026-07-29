import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// First, list all tables to confirm table names
const [tables] = await conn.execute(`SHOW TABLES LIKE '%brand%'`);
console.log("Brand-related tables:");
tables.forEach(t => console.log("  ", Object.values(t)[0]));
console.log("");

// Find brands with similar/duplicate names
const [brands] = await conn.execute(`
  SELECT id, name, companyName, status, deletedAt, createdAt
  FROM brands 
  WHERE deletedAt IS NULL
  ORDER BY name
`);

console.log(`Total active brands: ${brands.length}\n`);

// Group by normalized name (lowercase, remove spaces, dots, special chars)
const normalize = (name) => name.toLowerCase().replace(/[\s.\-_()（）]/g, '').trim();
const groups = {};
for (const b of brands) {
  const key = normalize(b.name);
  if (!groups[key]) groups[key] = [];
  groups[key].push(b);
}

// Find duplicates
const dupes = Object.entries(groups).filter(([k, v]) => v.length > 1);
console.log(`Found ${dupes.length} groups with potential duplicates:\n`);

for (const [key, items] of dupes) {
  console.log(`--- Group: "${key}" ---`);
  for (const b of items) {
    let productCount = 0, activityCount = 0, memoCount = 0, fileCount = 0, contractCount = 0;
    try {
      const [r] = await conn.execute(`SELECT COUNT(*) as cnt FROM brand_products WHERE brandId = ? AND deletedAt IS NULL`, [b.id]);
      productCount = r[0].cnt;
    } catch(e) {}
    try {
      const [r] = await conn.execute(`SELECT COUNT(*) as cnt FROM brand_activities WHERE brandId = ? AND deletedAt IS NULL`, [b.id]);
      activityCount = r[0].cnt;
    } catch(e) {}
    try {
      const [r] = await conn.execute(`SELECT COUNT(*) as cnt FROM brand_memos WHERE brandId = ? AND deletedAt IS NULL`, [b.id]);
      memoCount = r[0].cnt;
    } catch(e) {}
    try {
      const [r] = await conn.execute(`SELECT COUNT(*) as cnt FROM brand_files WHERE brandId = ? AND deletedAt IS NULL`, [b.id]);
      fileCount = r[0].cnt;
    } catch(e) {}
    try {
      const [r] = await conn.execute(`SELECT COUNT(*) as cnt FROM brand_contracts WHERE brandId = ? AND deletedAt IS NULL`, [b.id]);
      contractCount = r[0].cnt;
    } catch(e) {}
    console.log(`  ID: ${b.id} | Name: "${b.name}" | Company: "${b.companyName || '-'}" | Status: ${b.status}`);
    console.log(`    Products: ${productCount} | Activities: ${activityCount} | Memos: ${memoCount} | Files: ${fileCount} | Contracts: ${contractCount}`);
  }
  console.log('');
}

await conn.end();
