import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const rawUrl = process.env.DATABASE_URL.replace(/\?ssl=.*$/, '');
  const conn = await mysql.createConnection({ uri: rawUrl, ssl: { rejectUnauthorized: true } });
  
  console.log('Adding bundleId column to procurement_orders...');
  
  // Check if column already exists
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'procurement_orders' AND COLUMN_NAME = 'bundleId'`
  );
  
  if (cols.length > 0) {
    console.log('✅ bundleId column already exists, skipping.');
  } else {
    await conn.execute(`
      ALTER TABLE procurement_orders ADD COLUMN bundleId INT DEFAULT NULL
    `);
    console.log('✅ bundleId column added to procurement_orders!');
  }
  
  // Add index for faster lookups
  try {
    await conn.execute(`
      CREATE INDEX idx_procurement_bundle ON procurement_orders (bundleId)
    `);
    console.log('✅ Index idx_procurement_bundle created.');
  } catch (e) {
    if (e.message.includes('Duplicate')) {
      console.log('Index already exists, skipping.');
    } else {
      console.warn('Index creation warning:', e.message);
    }
  }
  
  await conn.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
