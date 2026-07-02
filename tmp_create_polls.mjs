import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Create polls table
await conn.execute(`
  CREATE TABLE IF NOT EXISTS polls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productId INT,
    productName VARCHAR(500) NOT NULL,
    brandName VARCHAR(255),
    imageUrl TEXT,
    description TEXT,
    originalPrice DECIMAL(12, 2),
    status ENUM('active', 'closed', 'draft') NOT NULL DEFAULT 'active',
    expiresAt TIMESTAMP NULL,
    createdBy INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);
console.log('✅ polls table created');

// Create poll_votes table
await conn.execute(`
  CREATE TABLE IF NOT EXISTS poll_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pollId INT NOT NULL,
    desiredPrice DECIMAL(12, 2) NOT NULL,
    nickname VARCHAR(100),
    ipAddress VARCHAR(45),
    fingerprint VARCHAR(64),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_poll_id (pollId)
  )
`);
console.log('✅ poll_votes table created');

await conn.end();
console.log('Done!');
