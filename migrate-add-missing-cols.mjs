import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  
  const cols = [
    { sql: `ALTER TABLE selection_products ADD COLUMN productId VARCHAR(100) DEFAULT NULL AFTER productNameCn`, name: 'productId' },
    { sql: `ALTER TABLE selection_products ADD COLUMN talentExclusive TINYINT DEFAULT 0 AFTER supplierContact`, name: 'talentExclusive' },
    { sql: `ALTER TABLE selection_products ADD COLUMN exclusiveLiverIds TEXT DEFAULT NULL AFTER talentExclusive`, name: 'exclusiveLiverIds' },
    { sql: `ALTER TABLE selection_products ADD COLUMN tags TEXT DEFAULT NULL AFTER exclusiveLiverIds`, name: 'tags' },
  ];
  
  for (const col of cols) {
    try {
      await pool.query(col.sql);
      console.log(`✅ Added ${col.name}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️ ${col.name} already exists`);
      } else {
        console.error(`❌ Failed to add ${col.name}:`, e.message);
      }
    }
  }
  
  await pool.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
