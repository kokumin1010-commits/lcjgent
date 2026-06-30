import 'dotenv/config';
import mysql from 'mysql2/promise';

// The Railway deployment might use a different DB. Check the other known DB.
const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Try switching to the other database
try {
  await conn.query('USE GgA9WvTBCZMf6mjyMMwACw');
  console.log('Switched to GgA9WvTBCZMf6mjyMMwACw');
  
  const [tables] = await conn.query("SHOW TABLES LIKE '%schedule%'");
  console.log('Schedule tables:', tables);
  
  const [rows] = await conn.query('SELECT * FROM sc_schedules LIMIT 10');
  console.log('sc_schedules:', rows.length, JSON.stringify(rows, null, 2));
} catch(e) {
  console.log('Cannot switch DB:', e.message);
}

await conn.end();
process.exit(0);
