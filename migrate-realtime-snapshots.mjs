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
    CREATE TABLE IF NOT EXISTS livestream_realtime_snapshots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      livestreamId INT NOT NULL,
      liverId INT,
      imageUrl TEXT,
      imageKey VARCHAR(512),
      timeSlot VARCHAR(20) NOT NULL,
      snapshotAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      gmv BIGINT,
      gpm BIGINT,
      impressions INT,
      impressionsPerHour INT,
      viewerCount INT,
      viewCount INT,
      orderCount INT,
      tapThroughRate VARCHAR(20),
      commentRate VARCHAR(20),
      followRate VARCHAR(20),
      avgViewDuration VARCHAR(20),
      notes TEXT,
      rawResponse JSON,
      confidence ENUM('high', 'medium', 'low') DEFAULT 'medium',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_snapshot_livestream (livestreamId),
      INDEX idx_snapshot_liver (liverId),
      INDEX idx_snapshot_timeslot (livestreamId, timeSlot)
    );
  `;
  await connection.execute(sql);
  console.log('✅ livestream_realtime_snapshots table created successfully');
  await connection.end();
}
main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
