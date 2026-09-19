import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is required");

async function migrate() {
  const connection = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true },
  });

  console.log("Connected to DB");

  // Create index_now_logs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS index_now_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      urls TEXT NOT NULL,
      urlCount INT NOT NULL DEFAULT 1,
      \`trigger\` VARCHAR(50) NOT NULL DEFAULT 'manual',
      indexNowStatus INT,
      bingStatus INT,
      yandexStatus INT,
      success BOOLEAN NOT NULL DEFAULT true,
      errorMessage TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Created index_now_logs table");

  await connection.end();
  console.log("Migration complete!");
}

migrate().catch(console.error);
