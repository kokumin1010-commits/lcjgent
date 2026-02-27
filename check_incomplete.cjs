const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get incomplete records grouped by brand
  const [incomplete] = await conn.query(
    `SELECT bl.id, bl.brandId, bl.streamerName, bl.livestreamDate, bl.platform, bl.duration,
            bl.livestreamStartTime, bl.productCommission, bl.liverId
     FROM brand_livestreams bl
     WHERE bl.brandId != 1 
     AND bl.gmv IS NULL AND bl.impressions IS NULL AND bl.productClicks IS NULL
     ORDER BY bl.brandId, bl.livestreamDate DESC`
  );
  
  console.log('Total incomplete:', incomplete.length);
  
  // Group by brand
  const byBrand = new Map();
  for (const r of incomplete) {
    if (!byBrand.has(r.brandId)) byBrand.set(r.brandId, []);
    byBrand.get(r.brandId).push(r);
  }
  
  // Get brand names
  for (const [brandId, records] of byBrand) {
    const [brand] = await conn.query('SELECT name FROM brands WHERE id = ?', [brandId]);
    const brandName = brand[0] ? brand[0].name : 'Unknown';
    console.log(`\n[Brand ${brandId}] ${brandName} - ${records.length}件`);
    records.forEach(r => {
      const date = r.livestreamDate ? new Date(r.livestreamDate).toISOString().split('T')[0] : 'N/A';
      console.log(`  ID:${r.id} ${date} ${r.streamerName} plat:${r.platform||'-'} dur:${r.duration||'-'} start:${r.livestreamStartTime||'-'} comm:${r.productCommission||'-'}`);
    });
  }
  
  // Also check: how many complete records exist per brand (for comparison)
  console.log('\n=== Complete vs Incomplete per brand ===');
  const [stats] = await conn.query(
    `SELECT brandId, 
            COUNT(*) as total,
            SUM(CASE WHEN gmv IS NULL AND impressions IS NULL AND productClicks IS NULL THEN 1 ELSE 0 END) as incomplete,
            SUM(CASE WHEN gmv IS NOT NULL OR impressions IS NOT NULL OR productClicks IS NOT NULL THEN 1 ELSE 0 END) as complete
     FROM brand_livestreams 
     WHERE brandId != 1
     GROUP BY brandId
     HAVING incomplete > 0
     ORDER BY brandId`
  );
  stats.forEach(s => console.log(`  Brand ${s.brandId}: total=${s.total} complete=${s.complete} incomplete=${s.incomplete}`));
  
  await conn.end();
}

main().catch(console.error);
