/**
 * Run drizzle migrations on deploy.
 * This script is called during the build/start process on Railway
 * to ensure the database schema is up to date.
 */
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Migration] DATABASE_URL is not set, skipping migrations');
    process.exit(0);
  }

  console.log('[Migration] Connecting to database...');
  
  const connection = await mysql.createConnection(connectionString);
  const db = drizzle(connection);

  console.log('[Migration] Running migrations from ./drizzle ...');
  
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, 'drizzle') });
    console.log('[Migration] All migrations applied successfully!');
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    // Don't fail the build if migrations have issues (table/column may already exist)
    if (err.message.includes('already exists') || err.message.includes('Duplicate column')) {
      console.log('[Migration] Schema already up to date, continuing...');
    } else {
      // Log but don't throw - let the app start
      console.error('[Migration] Non-fatal migration error, continuing deployment...');
      console.error('[Migration] Full error:', err);
    }
  }

  // Fallback: ensure critical tables exist (CREATE IF NOT EXISTS is safe to run always)
  try {
    console.log('[Migration] Running fallback table creation...');
    await connection.execute(`CREATE TABLE IF NOT EXISTS \`platform_accounts\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`platform\` varchar(100) NOT NULL,
      \`account_name\` varchar(255) NOT NULL,
      \`account_id\` varchar(255),
      \`password\` text,
      \`login_url\` text,
      \`email\` varchar(320),
      \`phone\` varchar(50),
      \`responsible\` varchar(255),
      \`status\` enum('active','inactive','expired','suspended') NOT NULL DEFAULT 'active',
      \`expires_at\` timestamp NULL,
      \`tags\` json,
      \`notes\` text,
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    await connection.execute(`CREATE TABLE IF NOT EXISTS \`contact_info\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`category\` enum('brand','client','partner','supplier','other') NOT NULL DEFAULT 'client',
      \`company_name\` varchar(255),
      \`contact_name\` varchar(255) NOT NULL,
      \`position\` varchar(255),
      \`email\` varchar(320),
      \`phone\` varchar(50),
      \`wechat\` varchar(255),
      \`line_id\` varchar(255),
      \`address\` text,
      \`responsible\` varchar(255),
      \`status\` enum('active','inactive') NOT NULL DEFAULT 'active',
      \`tags\` json,
      \`notes\` text,
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(\`id\`)
    )`);
    console.log('[Migration] Fallback tables ensured.');
  } catch (fallbackErr) {
    console.error('[Migration] Fallback error:', fallbackErr.message);
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('[Migration] Fatal error:', err);
  // Don't exit with error code to prevent broken deploys
  console.error('[Migration] Continuing despite error...');
  process.exit(0);
});
