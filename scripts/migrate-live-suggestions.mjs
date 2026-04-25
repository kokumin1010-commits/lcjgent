import mysql from "mysql2/promise";

// Parse DATABASE_URL from Railway environment - use the known TiDB connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Try to read from package.json scripts or other config
  console.error("DATABASE_URL not set. Trying alternative...");
  process.exit(1);
}

const match = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error("Invalid DATABASE_URL format:", DATABASE_URL.substring(0, 30));
  process.exit(1);
}

const [, user, password, host, port, database] = match;

async function main() {
  const conn = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connected to database");

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS live_suggestions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      targetDate TIMESTAMP NOT NULL,
      liverName VARCHAR(255) NOT NULL,
      liverId INT,
      scheduleId INT,
      scheduledStartTime TIMESTAMP NULL,
      scheduledEndTime TIMESTAMP NULL,
      suggestionText TEXT NOT NULL,
      promptUsed TEXT,
      sentToLineGroupId VARCHAR(64),
      sentToLineGroupName VARCHAR(255),
      lineSendSuccess BOOLEAN NOT NULL DEFAULT FALSE,
      lineSendError TEXT,
      generatedBy VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  await conn.execute(createTableSQL);
  console.log("live_suggestions table created successfully");

  const [rows] = await conn.execute("DESCRIBE live_suggestions");
  console.log("Table columns:", rows.map(r => r.Field).join(", "));

  await conn.end();
  console.log("Done");
}

main().catch(console.error);
