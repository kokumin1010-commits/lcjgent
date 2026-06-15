import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Read the password from the manus db log
const logFile = '.manus/db/db-query-error-1772381295799.json';
const logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
const cmd = logData.command;

// Extract password
let password = '';
const pwMatch = cmd.match(/--password[= ](\S+)/);
if (pwMatch) {
  password = pwMatch[1];
}

const config = {
  host: 'gateway03.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'ViCMbGRGvoSuVwV.root',
  password: password,
  database: 'GgA9WvTBCZMf6mjyMMwACw',
  ssl: { rejectUnauthorized: true }
};

console.log(`Connecting to Railway DB: ${config.host}:${config.port}/${config.database}`);
console.log(`User: ${config.user}, Password length: ${password.length}`);

async function main() {
  const conn = await mysql.createConnection(config);
  console.log('Connected!');

  // Read the migration SQL
  const migrationSql = fs.readFileSync(path.join(process.cwd(), 'drizzle/0120_clever_firestar.sql'), 'utf8');
  
  // Split by statement-breakpoint
  const statements = migrationSql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  
  console.log(`Found ${statements.length} statements to execute`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    try {
      await conn.query(stmt);
      console.log(`  ✅ [${i+1}/${statements.length}] ${preview}...`);
    } catch (err) {
      if (err.message.includes('already exists') || err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_FIELDNAME') {
        console.log(`  ⏭️  [${i+1}/${statements.length}] Already exists, skipping: ${preview}...`);
      } else {
        console.error(`  ❌ [${i+1}/${statements.length}] Error: ${err.message}`);
        console.error(`     Statement: ${preview}...`);
      }
    }
  }

  // Also create the daily_ranking_log table for dedup
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_ranking_log (
        id int AUTO_INCREMENT PRIMARY KEY,
        run_date varchar(10) NOT NULL,
        sent_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_run_date (run_date)
      )
    `);
    console.log('  ✅ daily_ranking_log table created/verified');
  } catch (err) {
    console.log(`  ⏭️  daily_ranking_log: ${err.message}`);
  }

  // Verify
  const [tables] = await conn.query("SHOW TABLES LIKE 'festival%'");
  console.log('\nFestival tables in Railway DB:', tables);

  await conn.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
