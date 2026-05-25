import { MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

export async function createBrandShortVideosTable(db: MySql2Database) {
  console.log("[Migration] Creating brand_short_videos table...");
  
  await db.execute(sql`
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
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP NULL,
      INDEX idx_brand_short_videos_brandId (brandId),
      INDEX idx_brand_short_videos_postDate (postDate),
      INDEX idx_brand_short_videos_liverId (liverId),
      INDEX idx_brand_short_videos_contractId (contractId)
    )
  `);

  console.log("[Migration] brand_short_videos table created successfully");
}
