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
    CREATE TABLE IF NOT EXISTS livestream_realtime_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      livestreamId INT NOT NULL,
      liverId INT,
      productName VARCHAR(500) NOT NULL,
      productPrice BIGINT,
      quantitySold INT NOT NULL DEFAULT 0,
      cartAddCount INT DEFAULT 0,
      timeSlot VARCHAR(20) NOT NULL,
      recordedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      recordedBy VARCHAR(255),
      notes TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_livestream (livestreamId),
      INDEX idx_liver (liverId),
      INDEX idx_timeslot (livestreamId, timeSlot)
    );
  `;
  
  await connection.execute(sql);
  console.log('✅ livestream_realtime_records table created successfully');
  
  await connection.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
