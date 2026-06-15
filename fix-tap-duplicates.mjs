import mysql from 'mysql2/promise';

const DB_URL = "mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw";

async function main() {
  const conn = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true }
  });

  console.log("Connected to database.");

  // Step 1: Check current state - count total records and duplicates
  console.log("\n=== Step 1: Current state ===");
  const [totalRows] = await conn.execute("SELECT COUNT(*) as cnt FROM tiktok_tap_reports");
  console.log(`Total records: ${totalRows[0].cnt}`);

  // Check duplicates based on (brandId, reportMonth, creatorUsername, productId)
  const [dupCount] = await conn.execute(`
    SELECT COUNT(*) as dup_groups FROM (
      SELECT brandId, reportMonth, creatorUsername, productId, COUNT(*) as cnt
      FROM tiktok_tap_reports
      GROUP BY brandId, reportMonth, creatorUsername, productId
      HAVING cnt > 1
    ) t
  `);
  console.log(`Duplicate groups: ${dupCount[0].dup_groups}`);

  // Show monthly totals BEFORE cleanup
  console.log("\n=== Step 2: Monthly totals BEFORE cleanup ===");
  const [monthlyBefore] = await conn.execute(`
    SELECT reportMonth, 
      SUM(affiliateGmv) as totalAffiliateGmv,
      COUNT(*) as records
    FROM tiktok_tap_reports
    GROUP BY reportMonth
    ORDER BY reportMonth DESC
    LIMIT 10
  `);
  console.table(monthlyBefore);

  // Step 3: Delete duplicates - keep only the latest record (highest id) for each unique combination
  console.log("\n=== Step 3: Deleting duplicates (keeping latest) ===");
  
  // First, find the IDs to keep (the MAX id for each unique combination)
  const [deleteResult] = await conn.execute(`
    DELETE t1 FROM tiktok_tap_reports t1
    INNER JOIN tiktok_tap_reports t2
    WHERE t1.brandId = t2.brandId
      AND t1.reportMonth = t2.reportMonth
      AND t1.creatorUsername = t2.creatorUsername
      AND t1.productId = t2.productId
      AND t1.id < t2.id
  `);
  console.log(`Deleted ${deleteResult.affectedRows} duplicate records.`);

  // Step 4: Verify - check for remaining duplicates
  console.log("\n=== Step 4: Verify no duplicates remain ===");
  const [remainingDups] = await conn.execute(`
    SELECT brandId, reportMonth, creatorUsername, productId, COUNT(*) as cnt
    FROM tiktok_tap_reports
    GROUP BY brandId, reportMonth, creatorUsername, productId
    HAVING cnt > 1
    LIMIT 5
  `);
  if (remainingDups.length === 0) {
    console.log("✅ No duplicates remain!");
  } else {
    console.log("⚠️ Some duplicates still exist:", remainingDups);
  }

  // Step 5: Add unique index
  console.log("\n=== Step 5: Adding unique index ===");
  try {
    await conn.execute(`
      ALTER TABLE tiktok_tap_reports 
      ADD UNIQUE INDEX unique_tap_report (brandId, reportMonth, creatorUsername, productId)
    `);
    console.log("✅ Unique index added successfully!");
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME' || e.message.includes('Duplicate key name')) {
      console.log("Index already exists, skipping.");
    } else if (e.message.includes('Duplicate entry')) {
      console.log("⚠️ Cannot add unique index - duplicates still exist. Running additional cleanup...");
      // Run cleanup again
      const [deleteResult2] = await conn.execute(`
        DELETE t1 FROM tiktok_tap_reports t1
        INNER JOIN tiktok_tap_reports t2
        WHERE t1.brandId = t2.brandId
          AND t1.reportMonth = t2.reportMonth
          AND t1.creatorUsername = t2.creatorUsername
          AND t1.productId = t2.productId
          AND t1.id < t2.id
      `);
      console.log(`Deleted ${deleteResult2.affectedRows} more duplicate records.`);
      // Try again
      await conn.execute(`
        ALTER TABLE tiktok_tap_reports 
        ADD UNIQUE INDEX unique_tap_report (brandId, reportMonth, creatorUsername, productId)
      `);
      console.log("✅ Unique index added after second cleanup!");
    } else {
      throw e;
    }
  }

  // Step 6: Show monthly totals AFTER cleanup
  console.log("\n=== Step 6: Monthly totals AFTER cleanup ===");
  const [monthlyAfter] = await conn.execute(`
    SELECT reportMonth, 
      SUM(affiliateGmv) as totalAffiliateGmv,
      SUM(liveGmv) as totalLiveGmv,
      SUM(videoGmv) as totalVideoGmv,
      COUNT(*) as records
    FROM tiktok_tap_reports
    GROUP BY reportMonth
    ORDER BY reportMonth DESC
    LIMIT 10
  `);
  console.table(monthlyAfter);

  // Step 7: Show total records after cleanup
  const [totalAfter] = await conn.execute("SELECT COUNT(*) as cnt FROM tiktok_tap_reports");
  console.log(`\nTotal records after cleanup: ${totalAfter[0].cnt} (was ${totalRows[0].cnt})`);
  console.log(`Records removed: ${totalRows[0].cnt - totalAfter[0].cnt}`);

  await conn.end();
  console.log("\n✅ Migration complete!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
