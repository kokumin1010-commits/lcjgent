import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL not set');

const conn = await mysql.createConnection(dbUrl);

const sql = `
CREATE TABLE IF NOT EXISTS brand_short_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brandId INT NOT NULL,
  liverId INT,
  liverName VARCHAR(255) NOT NULL,
  contractId INT,
  postDate TIMESTAMP NOT NULL,
  platform VARCHAR(100) DEFAULT 'TikTok',
  videoUrl TEXT,
  thumbnailUrl TEXT,
  title VARCHAR(500),
  productName VARCHAR(255),
  productId INT,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'posted', 'failed') NOT NULL DEFAULT 'posted',
  notes TEXT,
  createdBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  deletedAt TIMESTAMP NULL,
  INDEX idx_brand_short_videos_brandId (brandId),
  INDEX idx_brand_short_videos_postDate (postDate),
  INDEX idx_brand_short_videos_liverId (liverId),
  INDEX idx_brand_short_videos_contractId (contractId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

try {
  await conn.execute(sql);
  console.log('✅ brand_short_videos table created successfully');
  const [rows] = await conn.execute("SHOW TABLES LIKE 'brand_short_videos'");
  console.log('Table exists:', rows.length > 0);
  const [cols] = await conn.execute("DESCRIBE brand_short_videos");
  console.log('Columns:', cols.map(c => c.Field).join(', '));
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
