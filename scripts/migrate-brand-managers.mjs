import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Check if columns exist
  const [cols] = await connection.query(`SHOW COLUMNS FROM brands LIKE 'businessManagerId'`);
  if (cols.length === 0) {
    await connection.query(`ALTER TABLE brands ADD COLUMN businessManagerId INT NULL AFTER memo`);
    console.log("Added businessManagerId column");
  } else {
    console.log("businessManagerId column already exists");
  }
  
  const [cols2] = await connection.query(`SHOW COLUMNS FROM brands LIKE 'operationsManagerId'`);
  if (cols2.length === 0) {
    await connection.query(`ALTER TABLE brands ADD COLUMN operationsManagerId INT NULL AFTER businessManagerId`);
    console.log("Added operationsManagerId column");
  } else {
    console.log("operationsManagerId column already exists");
  }
  
  await connection.end();
  console.log("Migration complete!");
}

main().catch(console.error);
