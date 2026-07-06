import 'dotenv/config';
import mysql from 'mysql2/promise';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const sql = `
    CREATE TABLE IF NOT EXISTS livestream_lucky_bag_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      livestreamId INT NOT NULL,
      liverId INT,
      imageUrl TEXT NOT NULL,
      imageKey VARCHAR(512) NOT NULL,
      title VARCHAR(255),
      description TEXT,
      price BIGINT,
      sortOrder INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_livestream (livestreamId),
      INDEX idx_liver (liverId)
    );
  `;
  try {
    await connection.execute(sql);
    console.log('✅ livestream_lucky_bag_images table created successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await connection.end();
  }
}
main();
