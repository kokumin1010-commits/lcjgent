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
    // Don't fail the build if migrations have issues (table may already exist)
    if (err.message.includes('already exists')) {
      console.log('[Migration] Tables already exist, continuing...');
    } else {
      throw err;
    }
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
