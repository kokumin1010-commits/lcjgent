import mysql from 'mysql2/promise';
import crypto from 'crypto';
import fs from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = fs.readFileSync('./drizzle/0120_clever_firestar.sql', 'utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
console.log('Hash:', hash);

try {
  await conn.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [hash, Date.now()]);
  console.log('Migration 0120 marked as applied');
} catch(e) {
  console.log('Error:', e.message);
}
await conn.end();
process.exit(0);
