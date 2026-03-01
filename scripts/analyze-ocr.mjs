import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. OCRデータの中身を詳しく確認 - 承認と却下の違い
const [approvedOcr] = await conn.query(`SELECT ocrRawText FROM line_receipts 
  WHERE status = 'approved' AND ocrRawText IS NOT NULL AND ocrRawText != '' 
  LIMIT 5`);

console.log('=== 承認レシートのOCR詳細 ===');
for (const r of approvedOcr) {
  try {
    const p = JSON.parse(r.ocrRawText);
    console.log(JSON.stringify({
      isTikTokShop: p.isTikTokShop,
      isDelivered: p.isDelivered,
      hasOrderNumber: !!p.orderNumber,
      hasAmount: !!p.totalAmount,
      confidence: p.confidence || 'N/A'
    }));
  } catch(e) {}
}

const [rejectedOcr] = await conn.query(`SELECT ocrRawText FROM line_receipts 
  WHERE status = 'rejected' AND ocrRawText IS NOT NULL AND ocrRawText != '' 
  LIMIT 5`);

console.log('\n=== 却下レシートのOCR詳細 ===');
for (const r of rejectedOcr) {
  try {
    const p = JSON.parse(r.ocrRawText);
    console.log(JSON.stringify({
      isTikTokShop: p.isTikTokShop,
      isDelivered: p.isDelivered,
      hasOrderNumber: !!p.orderNumber,
      hasAmount: !!p.totalAmount,
      confidence: p.confidence || 'N/A'
    }));
  } catch(e) {}
}

// 2. isTikTokShopとisDeliveredの分布
const [tiktokDist] = await conn.query(`SELECT status, 
  SUM(CASE WHEN JSON_EXTRACT(ocrRawText, '$.isTikTokShop') = true THEN 1 ELSE 0 END) as is_tiktok,
  SUM(CASE WHEN JSON_EXTRACT(ocrRawText, '$.isDelivered') = true THEN 1 ELSE 0 END) as is_delivered,
  SUM(CASE WHEN JSON_EXTRACT(ocrRawText, '$.orderNumber') IS NOT NULL THEN 1 ELSE 0 END) as has_order,
  SUM(CASE WHEN JSON_EXTRACT(ocrRawText, '$.totalAmount') IS NOT NULL AND JSON_EXTRACT(ocrRawText, '$.totalAmount') > 0 THEN 1 ELSE 0 END) as has_amount,
  COUNT(*) as total
  FROM line_receipts 
  WHERE ocrRawText IS NOT NULL AND ocrRawText != '' AND status IN ('approved','rejected')
  GROUP BY status`);
console.log('\n=== OCRフィールド分布（承認vs却下）===');
console.table(tiktokDist);

// 3. 承認レシートで金額なし・注文番号なしの割合
const [missingFields] = await conn.query(`SELECT status,
  SUM(CASE WHEN totalAmount IS NULL OR totalAmount = 0 THEN 1 ELSE 0 END) as no_amount,
  SUM(CASE WHEN storeName IS NULL OR storeName = '' THEN 1 ELSE 0 END) as no_store,
  COUNT(*) as total
  FROM line_receipts 
  WHERE status IN ('approved','rejected','pending')
  GROUP BY status`);
console.log('\n=== 欠損フィールド分布 ===');
console.table(missingFields);

// 4. 承認率の高いシンプルなルール検証
// ルール: totalAmount > 0 AND storeName != '' AND fraudFlags IS NULL
const [simRule] = await conn.query(`SELECT 
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  COUNT(*) as total,
  ROUND(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as approval_rate
  FROM line_receipts 
  WHERE totalAmount > 0 AND storeName IS NOT NULL AND storeName != '' 
  AND (fraudFlags IS NULL OR fraudFlags = '[]' OR fraudFlags = 'null')
  AND status IN ('approved','rejected')`);
console.log('\n=== ルール1: 金額あり+店舗あり+不正フラグなし ===');
console.table(simRule);

// 5. ルール2: 金額あり+店舗あり+不正フラグなし+金額<20000
const [simRule2] = await conn.query(`SELECT 
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  COUNT(*) as total,
  ROUND(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as approval_rate
  FROM line_receipts 
  WHERE totalAmount > 0 AND totalAmount < 20000 AND storeName IS NOT NULL AND storeName != '' 
  AND (fraudFlags IS NULL OR fraudFlags = '[]' OR fraudFlags = 'null')
  AND status IN ('approved','rejected')`);
console.log('\n=== ルール2: 金額あり+店舗あり+不正フラグなし+金額<20000 ===');
console.table(simRule2);

await conn.end();
