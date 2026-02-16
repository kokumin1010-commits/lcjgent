import mysql from 'mysql2/promise';
import fs from 'fs';
import crypto from 'crypto';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [applied] = await conn.query('SELECT hash FROM __drizzle_migrations');
  const appliedHashes = new Set(applied.map(r => r.hash));
  console.log(`Applied: ${appliedHashes.size}`);
  
  const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf-8'));
  console.log(`Total in journal: ${journal.entries.length}`);
  
  let inserted = 0;
  for (const entry of journal.entries) {
    const sqlFile = `drizzle/${entry.tag}.sql`;
    if (!fs.existsSync(sqlFile)) continue;
    const content = fs.readFileSync(sqlFile, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (!appliedHashes.has(hash)) {
      await conn.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [hash, Date.now()]);
      inserted++;
      console.log(`Marked: ${entry.tag}`);
    }
  }
  console.log(`Inserted ${inserted} migration records`);
  await conn.end();
}
main().catch(console.error);
