import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check if actualPartnerCommission has any non-zero values
const [rows1] = await conn.query(`
  SELECT reportMonth, 
    SUM(actualPartnerCommission) as totalActual,
    SUM(estimatedPartnerCommission) as totalEstimated,
    COUNT(*) as cnt
  FROM tiktok_tap_reports 
  GROUP BY reportMonth 
  ORDER BY reportMonth DESC 
  LIMIT 10
`);
console.log("=== TAP Reports - Partner Commission by Month ===");
console.table(rows1);

// Check a sample row to see the raw data
const [rows2] = await conn.query(`
  SELECT reportMonth, creatorUsername, affiliateGmv, actualPartnerCommission, estimatedPartnerCommission 
  FROM tiktok_tap_reports 
  WHERE actualPartnerCommission > 0 
  LIMIT 5
`);
console.log("\n=== Rows with non-zero actualPartnerCommission ===");
console.table(rows2);

// Check what the frontend is showing (m.totalActualPartnerCommission)
const [rows3] = await conn.query(`
  SELECT reportMonth, 
    COALESCE(SUM(actualPartnerCommission), 0) as totalActualPartnerCommission,
    COALESCE(SUM(estimatedPartnerCommission), 0) as totalEstimatedPartnerCommission
  FROM tiktok_tap_reports 
  GROUP BY reportMonth 
  ORDER BY reportMonth DESC 
  LIMIT 10
`);
console.log("\n=== What the frontend query returns ===");
console.table(rows3);

await conn.end();
