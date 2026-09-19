import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is required");

const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) throw new Error("DATABASE_URL must be a valid MySQL connection URL");
const [, user, password, host, port, database] = match;

async function main() {
  const connection = await mysql.createConnection({
    host, port: parseInt(port), user, password, database,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Connected to DB");

  // Add isFree column to master_set_suggestion_items
  try {
    await connection.execute(`
      ALTER TABLE master_set_suggestion_items 
      ADD COLUMN isFree TINYINT DEFAULT 0
    `);
    console.log("✅ Added isFree column to master_set_suggestion_items");
  } catch (e) {
    if (e.message.includes("Duplicate column")) {
      console.log("⚠️ isFree column already exists");
    } else {
      console.error("❌ Error:", e.message);
    }
  }

  await connection.end();
  console.log("Done!");
}

main().catch(console.error);
