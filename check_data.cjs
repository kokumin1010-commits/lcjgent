const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 紐付けされているがGMV=NULLのレコード
  const [nullGmvLinks] = await conn.query(`
    SELECT bl.id, bl.brandId, bl.streamerName, bl.livestreamDate, bl.gmv, bl.impressions, bl.productClicks, bl.salesCount,
           bl.salesAmount, bl.platform, bl.duration
    FROM contract_livestream_links cl
    JOIN brand_livestreams bl ON cl.livestreamId = bl.id
    WHERE bl.gmv IS NULL AND bl.deletedAt IS NULL
    ORDER BY bl.brandId, bl.livestreamDate DESC
  `);
  console.log('=== 紐付けされているがGMV=NULLのレコード ===');
  console.log('Total:', nullGmvLinks.length);
  
  // ブランド別に集計
  const byBrand = {};
  nullGmvLinks.forEach(l => {
    const bid = l.brandId;
    if (!byBrand[bid]) byBrand[bid] = { count: 0, hasAnyData: false };
    byBrand[bid].count++;
    if (l.impressions || l.productClicks || l.salesCount || l.salesAmount || l.duration) {
      byBrand[bid].hasAnyData = true;
    }
  });
  console.log('\nブランド別:');
  Object.entries(byBrand).forEach(([bid, info]) => {
    console.log(`  brandId=${bid}: ${info.count}件 (他フィールドにデータあり: ${info.hasAnyData})`);
  });
  
  // 全体の数
  const [total] = await conn.query(`
    SELECT COUNT(*) as cnt FROM contract_livestream_links cl
    JOIN brand_livestreams bl ON cl.livestreamId = bl.id
    WHERE bl.deletedAt IS NULL
  `);
  const [withGmv] = await conn.query(`
    SELECT COUNT(*) as cnt FROM contract_livestream_links cl
    JOIN brand_livestreams bl ON cl.livestreamId = bl.id
    WHERE bl.gmv IS NOT NULL AND bl.deletedAt IS NULL
  `);
  console.log(`\n紐付け合計: ${total[0].cnt}件, GMVあり: ${withGmv[0].cnt}件, GMVなし: ${nullGmvLinks.length}件`);
  
  // 全brand_livestreamsでGMVがnullだが他のフィールドにデータがあるレコード
  const [partialData] = await conn.query(`
    SELECT id, brandId, streamerName, livestreamDate, gmv, impressions, productClicks, salesCount, salesAmount, platform, duration
    FROM brand_livestreams
    WHERE gmv IS NULL AND deletedAt IS NULL
    AND (impressions IS NOT NULL OR productClicks IS NOT NULL OR salesCount IS NOT NULL OR salesAmount IS NOT NULL OR duration IS NOT NULL)
  `);
  console.log(`\n=== GMV=NULLだが他フィールドにデータがあるレコード: ${partialData.length}件 ===`);
  partialData.forEach(l => console.log(JSON.stringify({id: l.id, brandId: l.brandId, impressions: l.impressions, productClicks: l.productClicks, salesCount: l.salesCount, salesAmount: l.salesAmount, duration: l.duration})));
  
  // 直播パフォーマンスで表示されるレコードの全体像
  const [allLivestreams] = await conn.query(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN gmv IS NOT NULL THEN 1 ELSE 0 END) as withGmv,
           SUM(CASE WHEN gmv IS NULL AND impressions IS NULL AND productClicks IS NULL AND salesCount IS NULL AND salesAmount IS NULL AND duration IS NULL THEN 1 ELSE 0 END) as completelyEmpty
    FROM brand_livestreams WHERE deletedAt IS NULL
  `);
  console.log(`\n=== 全体統計 ===`);
  console.log(`全レコード: ${allLivestreams[0].total}, GMVあり: ${allLivestreams[0].withGmv}, 完全に空: ${allLivestreams[0].completelyEmpty}`);
  
  await conn.end();
})();
