import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const config = {
  uri: databaseUrl,
  ssl: { rejectUnauthorized: true }
};

async function main() {
  const conn = await mysql.createConnection(config);
  
  // 1. 月別のアフィリGMV合計を確認
  console.log("=== 月別 アフィリGMV 合計 (tiktok_tap_reports) ===");
  const [monthly] = await conn.execute(`
    SELECT 
      reportMonth,
      COALESCE(SUM(affiliateGmv), 0) as totalAffiliateGmv,
      COALESCE(SUM(videoGmv), 0) as totalVideoGmv,
      COALESCE(SUM(liveGmv), 0) as totalLiveGmv,
      COUNT(*) as recordCount,
      COUNT(DISTINCT creatorUsername) as creatorCount
    FROM tiktok_tap_reports
    GROUP BY reportMonth
    ORDER BY reportMonth DESC
    LIMIT 10
  `);
  console.table(monthly);

  // 2. 2026-05の詳細を確認
  console.log("\n=== 2026-05 ショップ別内訳 ===");
  const [byShop] = await conn.execute(`
    SELECT 
      shopName,
      COALESCE(SUM(affiliateGmv), 0) as totalAffiliateGmv,
      COALESCE(SUM(videoGmv), 0) as totalVideoGmv,
      COALESCE(SUM(liveGmv), 0) as totalLiveGmv,
      COUNT(*) as records
    FROM tiktok_tap_reports
    WHERE reportMonth = '2026-05'
    GROUP BY shopName
    ORDER BY totalAffiliateGmv DESC
    LIMIT 10
  `);
  console.table(byShop);

  // 3. affiliateGmv vs videoGmv + liveGmv の関係を確認
  console.log("\n=== 2026-05 affiliateGmv vs (videoGmv + liveGmv) ===");
  const [comparison] = await conn.execute(`
    SELECT 
      COALESCE(SUM(affiliateGmv), 0) as total_affiliateGmv,
      COALESCE(SUM(videoGmv), 0) as total_videoGmv,
      COALESCE(SUM(liveGmv), 0) as total_liveGmv,
      COALESCE(SUM(videoGmv), 0) + COALESCE(SUM(liveGmv), 0) as video_plus_live,
      COALESCE(SUM(affiliateGmv), 0) - (COALESCE(SUM(videoGmv), 0) + COALESCE(SUM(liveGmv), 0)) as difference
    FROM tiktok_tap_reports
    WHERE reportMonth = '2026-05'
  `);
  console.table(comparison);

  // 4. サンプルレコードを確認
  console.log("\n=== 2026-05 サンプルレコード (TOP 5 by affiliateGmv) ===");
  const [samples] = await conn.execute(`
    SELECT 
      creatorUsername,
      productName,
      shopName,
      affiliateGmv,
      videoGmv,
      liveGmv,
      orders
    FROM tiktok_tap_reports
    WHERE reportMonth = '2026-05'
    ORDER BY affiliateGmv DESC
    LIMIT 5
  `);
  console.table(samples);

  // 5. brandId別の確認
  console.log("\n=== 2026-05 brandId別 ===");
  const [byBrand] = await conn.execute(`
    SELECT 
      brandId,
      COALESCE(SUM(affiliateGmv), 0) as totalAffiliateGmv,
      COUNT(*) as records
    FROM tiktok_tap_reports
    WHERE reportMonth = '2026-05'
    GROUP BY brandId
  `);
  console.table(byBrand);

  await conn.end();
}

main().catch(console.error);
