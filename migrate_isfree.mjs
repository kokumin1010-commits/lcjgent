import mysql from "mysql2/promise";

const DB_URL = "mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw";

const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
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
