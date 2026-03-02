import mysql from 'mysql2/promise';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(dbUrl);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });

  const [rows] = await conn.execute(`
    SELECT 
      a.id, a.orderNumber, a.totalAmount, a.storeName, 
      LEFT(a.imageUrl, 80) as log_img, 
      a.aiDecision, a.aiConfidence,
      r.totalAmount as r_amt, r.storeName as r_store, 
      LEFT(r.imageUrl, 80) as r_img,
      CASE WHEN r.imageUrls IS NOT NULL THEN 'yes' ELSE 'no' END as r_has_imageUrls,
      CASE WHEN r.ocrRawText IS NOT NULL THEN 'yes' ELSE 'no' END as r_has_ocr,
      r.pointsAwarded as r_pts,
      r.pointsCalculated as r_ptsCalc
    FROM ai_auto_review_logs a 
    LEFT JOIN line_receipts r ON a.receiptId = r.id 
    WHERE a.isDryRun = 0 
    ORDER BY a.id DESC 
    LIMIT 5
  `);

  console.table(rows);
  await conn.end();
}

main().catch(console.error);
