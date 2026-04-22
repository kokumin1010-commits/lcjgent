import mysql from "mysql2/promise";

const DB_URL = "mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw";

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
