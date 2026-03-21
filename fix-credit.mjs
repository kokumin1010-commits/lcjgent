import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Parse .env
const envContent = readFileSync('.env', 'utf-8');
const dbUrlMatch = envContent.match(/DATABASE_URL="(.+?)"/);
const dbUrl = dbUrlMatch[1];

async function main() {
  const conn = await mysql.createConnection({
    uri: dbUrl,
    ssl: { rejectUnauthorized: true }
  });

  // 2月の実績を確認 (camelCase column names)
  const [feb] = await conn.query(`
    SELECT 
      COALESCE(SUM(salesAmount), 0) as total_sales,
      COALESCE(SUM(duration), 0) as total_duration
    FROM brand_livestreams 
    WHERE liverId = 120005 
      AND deletedAt IS NULL
      AND livestreamDate >= '2026-01-31 15:00:00'
      AND livestreamDate <= '2026-02-28 14:59:59'
  `);
  const febHours = Math.round((Number(feb[0].total_duration) / 60) * 10) / 10;
  const febSales = Number(feb[0].total_sales);
  console.log('2月の実績:');
  console.log(`  配信: ${febHours}h, 売上: ¥${febSales.toLocaleString()}`);
  
  // ランク判定
  let rank = 'none';
  if (febHours >= 60 && febSales >= 3000000) rank = 'black';
  else if (febHours >= 30 && febSales >= 1000000) rank = 'gold';
  else if (febHours >= 10 && febSales >= 500000) rank = 'silver';
  console.log(`  → 3月のランク: ${rank.toUpperCase()}`);

  // 3月の実績を確認
  const [mar] = await conn.query(`
    SELECT 
      COALESCE(SUM(salesAmount), 0) as total_sales,
      COALESCE(SUM(duration), 0) as total_duration
    FROM brand_livestreams 
    WHERE liverId = 120005 
      AND deletedAt IS NULL
      AND livestreamDate >= '2026-02-28 15:00:00'
      AND livestreamDate <= '2026-03-31 14:59:59'
  `);
  const marHours = Math.round((Number(mar[0].total_duration) / 60) * 10) / 10;
  const marSales = Number(mar[0].total_sales);
  console.log('\n3月の実績:');
  console.log(`  配信: ${marHours}h, 売上: ¥${marSales.toLocaleString()}`);

  // クレジット計算
  const rankBonus = rank === 'black' ? 50000 : rank === 'gold' ? 15000 : rank === 'silver' ? 5000 : 0;
  const streamingCredit = Math.round(marHours * 500);
  const salesCredit = Math.round(marSales * 0.03);
  const total = streamingCredit + salesCredit + rankBonus;
  
  console.log('\n3月のクレジット計算:');
  console.log(`  配信クレジット: ${marHours}h × ¥500 = ¥${streamingCredit.toLocaleString()}`);
  console.log(`  売上クレジット: ¥${marSales.toLocaleString()} × 3% = ¥${salesCredit.toLocaleString()}`);
  console.log(`  ランクボーナス (${rank.toUpperCase()}): ¥${rankBonus.toLocaleString()}`);
  console.log(`  合計: ¥${total.toLocaleString()}`);

  // 残りのliver_creditsを確認
  const [remaining] = await conn.query('SELECT * FROM liver_credits WHERE liverId = 120005 ORDER BY month DESC');
  console.log('\n残りのliver_creditsレコード:', remaining.length);
  for (const r of remaining) {
    console.log(`  ${r.month}: rank=${r.rank}, total=${r.totalCredit}`);
  }

  await conn.end();
}

main().catch(console.error);
