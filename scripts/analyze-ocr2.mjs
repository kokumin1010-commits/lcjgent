import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. 却下レシートの中で「OCRデータは完全（TikTok+配達済み+金額あり+注文番号あり）」なのに却下されたもの
const [perfectButRejected] = await conn.query(`SELECT COUNT(*) as cnt FROM line_receipts 
  WHERE status = 'rejected' AND ocrRawText IS NOT NULL AND ocrRawText != ''
  AND JSON_EXTRACT(ocrRawText, '$.isTikTokShop') = true
  AND JSON_EXTRACT(ocrRawText, '$.isDelivered') = true
  AND JSON_EXTRACT(ocrRawText, '$.totalAmount') > 0`);
console.log('=== OCR完全だが却下されたレシート ===');
console.log('件数:', perfectButRejected[0].cnt);

// 2. 承認レシートの中で「OCRデータが不完全」なもの
const [incompleteButApproved] = await conn.query(`SELECT COUNT(*) as cnt FROM line_receipts 
  WHERE status = 'approved' AND ocrRawText IS NOT NULL AND ocrRawText != ''
  AND (JSON_EXTRACT(ocrRawText, '$.isTikTokShop') IS NULL OR JSON_EXTRACT(ocrRawText, '$.isTikTokShop') = false)`);
console.log('isTikTokShop=falseだが承認:', incompleteButApproved[0].cnt);

// 3. 却下レシートのreviewNoteの内容分布
const [reviewNotes] = await conn.query(`SELECT reviewNote, COUNT(*) as cnt 
  FROM line_receipts WHERE status = 'rejected' 
  GROUP BY reviewNote ORDER BY cnt DESC LIMIT 20`);
console.log('\n=== 却下レシートのreviewNote分布 ===');
console.table(reviewNotes);

// 4. 画像枚数と承認率
const [imgCount] = await conn.query(`SELECT 
  CASE WHEN imageUrls IS NULL OR imageUrls = '[]' OR imageUrls = '' THEN 'single' ELSE 'multi' END as img_type,
  status, COUNT(*) as cnt
  FROM line_receipts WHERE status IN ('approved','rejected')
  GROUP BY img_type, status`);
console.log('\n=== 画像枚数と承認/却下 ===');
console.table(imgCount);

// 5. 同一ユーザーの重複提出パターン
const [dupUsers] = await conn.query(`SELECT lineUserId, 
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  COUNT(*) as total
  FROM line_receipts 
  GROUP BY lineUserId 
  HAVING rejected > 3
  ORDER BY rejected DESC
  LIMIT 10`);
console.log('\n=== 却下が多いユーザー（上位10）===');
console.table(dupUsers);

// 6. 却下レシートのreviewNote詳細（「不承認」以外）
const [otherNotes] = await conn.query(`SELECT reviewNote, COUNT(*) as cnt 
  FROM line_receipts WHERE status = 'rejected' AND reviewNote != '不承認' AND reviewNote IS NOT NULL
  GROUP BY reviewNote ORDER BY cnt DESC LIMIT 20`);
console.log('\n=== 却下レシートのreviewNote（不承認以外）===');
console.table(otherNotes);

// 7. LLMベースの自動承認シミュレーション用データ
// 条件: isTikTokShop=true AND isDelivered=true AND totalAmount>0 AND fraudFlags=null
const [llmSim] = await conn.query(`SELECT 
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  COUNT(*) as total,
  ROUND(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as approval_rate
  FROM line_receipts 
  WHERE ocrRawText IS NOT NULL AND ocrRawText != ''
  AND JSON_EXTRACT(ocrRawText, '$.isTikTokShop') = true
  AND JSON_EXTRACT(ocrRawText, '$.isDelivered') = true
  AND JSON_EXTRACT(ocrRawText, '$.totalAmount') > 0
  AND (fraudFlags IS NULL OR fraudFlags = '[]' OR fraudFlags = 'null')
  AND status IN ('approved','rejected')`);
console.log('\n=== ルール3: TikTok+配達済み+金額あり+不正フラグなし ===');
console.table(llmSim);

await conn.end();
