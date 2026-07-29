import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const mergePlan = [
  { keep: 1380001, absorb: [2550003], keepName: "A.GLOBAL" },
  { keep: 1890001, absorb: [1470001], keepName: "ATELO" },
  { keep: 2370008, absorb: [1350001, 1230005], keepName: "A X" },
  { keep: 2190001, absorb: [1440013], keepName: "Dermabell" },
  { keep: 1380007, absorb: [1320004], keepName: "Dr.Alba" },
  { keep: 90005, absorb: [2640001], keepName: "F&W" },
  { keep: 1290002, absorb: [1290001], keepName: "I" },
  { keep: 2310004, absorb: [2310003], keepName: "KG" },
  { keep: 1500002, absorb: [1710006], keepName: "KINUJO" },
  { keep: 1, absorb: [1380010], keepName: "KYOGOKU" },
  { keep: 1770004, absorb: [1440005], keepName: "LUREAQU" },
  { keep: 30001, absorb: [1170010], keepName: "RENOVATIO" },
  { keep: 1170011, absorb: [1230004], keepName: "SISI" },
  { keep: 2580002, absorb: [1770001], keepName: "spicare" },
  { keep: 1170045, absorb: [1350006], keepName: "ULUKA" },
  { keep: 2400001, absorb: [2370007], keepName: "アパレル" },
  { keep: 1740002, absorb: [1710207], keepName: "栄進製薬" },
];

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Tables that reference brandId
const brandIdTables = [
  'brand_products', 'brand_activities', 'brand_contracts', 'brand_memos', 
  'brand_files', 'brand_livestreams', 'livestream_brands',
  'selection_products', 'procurement_orders',
  'tiktok_tap_reports', 'tiktok_tap_live_reports', 'tiktok_tap_video_reports',
  'brand_ad_reports', 'brand_short_videos', 'brand_sample_applications',
  'brand_monthly_gmv_targets', 'brand_addition_logs',
  'brand_portal_products', 'brand_portal_performance', 'brand_portals',
  'brand_ad_email_recipients', 'brand_analysis_cache'
];

console.log("=== 执行品牌合并 ===\n");

let successCount = 0;
let failCount = 0;

for (const plan of mergePlan) {
  for (const sourceId of plan.absorb) {
    console.log(`  合并: ID ${sourceId} → ID ${plan.keep} ("${plan.keepName}") ...`);
    
    try {
      // 1. Migrate all related data from source to target
      for (const table of brandIdTables) {
        try {
          // Check if table has deletedAt column
          const [cols] = await conn.execute(`SHOW COLUMNS FROM ${table} LIKE 'deletedAt'`);
          if (cols.length > 0) {
            await conn.execute(
              `UPDATE ${table} SET brandId = ? WHERE brandId = ? AND deletedAt IS NULL`,
              [plan.keep, sourceId]
            );
          } else {
            await conn.execute(
              `UPDATE ${table} SET brandId = ? WHERE brandId = ?`,
              [plan.keep, sourceId]
            );
          }
        } catch (e) {
          // Table might not exist or not have brandId column - skip
          if (!e.message.includes("doesn't exist") && !e.message.includes("Unknown column")) {
            console.log(`    ⚠️ ${table}: ${e.message}`);
          }
        }
      }
      
      // 2. Also update brandName in tables that have it
      const brandNameTables = ['selection_products', 'procurement_orders'];
      for (const table of brandNameTables) {
        try {
          await conn.execute(
            `UPDATE ${table} SET brandName = ? WHERE brandId = ?`,
            [plan.keepName, plan.keep]
          );
        } catch (e) {
          // Skip if column doesn't exist
        }
      }
      
      // 3. Soft-delete the source brand
      await conn.execute(
        `UPDATE brands SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL`,
        [sourceId]
      );
      
      console.log(`    ✅ 成功`);
      successCount++;
    } catch (e) {
      console.log(`    ❌ 失败: ${e.message}`);
      failCount++;
    }
  }
}

console.log(`\n=== 完成 ===`);
console.log(`  成功: ${successCount}`);
console.log(`  失败: ${failCount}`);

// Verify: check remaining duplicates
const [remaining] = await conn.execute(`
  SELECT name, COUNT(*) as cnt 
  FROM brands 
  WHERE deletedAt IS NULL 
  GROUP BY LOWER(REPLACE(REPLACE(REPLACE(REPLACE(name, '.', ''), ' ', ''), '-', ''), '_', ''))
  HAVING cnt > 1
`);
console.log(`\n验证: 剩余重复品牌组数: ${remaining.length}`);
if (remaining.length > 0) {
  for (const r of remaining) {
    console.log(`  "${r.name}" (${r.cnt}个)`);
  }
}

await conn.end();
