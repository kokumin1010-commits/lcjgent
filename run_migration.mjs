import mysql from 'mysql2/promise';
import fs from 'fs';

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const conn = await mysql.createConnection(dbUrl);
  const sql = fs.readFileSync('drizzle/migrations/featured_products.sql', 'utf8');
  const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log('OK:', stmt.substring(0, 80).replace(/\n/g, ' '));
    } catch (e) {
      console.error('ERR:', e.message.substring(0, 100));
    }
  }
  await conn.end();
  console.log('Migration done');
}
run();
