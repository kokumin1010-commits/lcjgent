import mysql from 'mysql2/promise';

async function main() {
  const rawUrl = process.env.DATABASE_URL.replace(/\?ssl=.*$/, '');
  const conn = await mysql.createConnection({ uri: rawUrl, ssl: { rejectUnauthorized: true } });
  
  console.log('Creating referral_bonus_offers table...');
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS referral_bonus_offers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lineUserId INT NOT NULL,
      campaignId INT NOT NULL,
      bonusPoints INT NOT NULL DEFAULT 500,
      status ENUM('active', 'claimed', 'expired') NOT NULL DEFAULT 'active',
      expiresAt TIMESTAMP NOT NULL,
      claimedAt TIMESTAMP NULL,
      claimedReferralId INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_line_user_status (lineUserId, status),
      INDEX idx_expires (expiresAt)
    )
  `);
  
  console.log('✅ referral_bonus_offers table created successfully!');
  
  await conn.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
