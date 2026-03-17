const mysql = require('mysql2/promise');

async function main() {
  const rawUrl = process.env.DATABASE_URL.replace(/\?ssl=.*$/, '');
  const conn = await mysql.createConnection({ uri: rawUrl, ssl: { rejectUnauthorized: true } });
  
  // 既存カラムを確認
  const [rows] = await conn.execute('DESCRIBE livers');
  const cols = rows.map(r => r.Field);
  
  // shipping_postal_code, shipping_address, shipping_phone がなければ追加
  if (cols.indexOf('shipping_postal_code') === -1) {
    await conn.execute('ALTER TABLE livers ADD COLUMN shipping_postal_code VARCHAR(10) DEFAULT NULL');
    console.log('Added shipping_postal_code');
  } else {
    console.log('shipping_postal_code already exists');
  }
  
  if (cols.indexOf('shipping_address') === -1) {
    await conn.execute('ALTER TABLE livers ADD COLUMN shipping_address TEXT DEFAULT NULL');
    console.log('Added shipping_address');
  } else {
    console.log('shipping_address already exists');
  }
  
  if (cols.indexOf('shipping_phone') === -1) {
    await conn.execute('ALTER TABLE livers ADD COLUMN shipping_phone VARCHAR(20) DEFAULT NULL');
    console.log('Added shipping_phone');
  } else {
    console.log('shipping_phone already exists');
  }
  
  await conn.end();
  console.log('Done');
}

main().catch(console.error);
