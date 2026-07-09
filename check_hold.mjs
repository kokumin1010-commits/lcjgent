import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT 
    CASE 
      WHEN admin_notes LIKE '%別ユーザーと同一注文番号%' THEN 'CROSS_USER_DUPLICATE'
      WHEN admin_notes LIKE '%信頼度不足%' THEN 'LOW_CONFIDENCE'
      WHEN admin_notes LIKE '%画像読み取り失敗%' THEN 'IMAGE_READ_FAILURE'
      WHEN admin_notes LIKE '%AI応答の解析に失敗%' THEN 'AI_PARSE_FAILURE'
      WHEN admin_notes LIKE '%LLM判定: 承認不可%' THEN 'LLM_REJECTED_MEDIUM'
      WHEN admin_notes LIKE '%店舗不明%' THEN 'UNKNOWN_STORE'
      WHEN admin_notes IS NULL OR admin_notes = '' THEN 'NO_REASON'
      ELSE CONCAT('OTHER: ', LEFT(admin_notes, 80))
    END as reason_category,
    COUNT(*) as cnt
  FROM line_receipts
  WHERE status = 'on_hold'
  GROUP BY reason_category
  ORDER BY cnt DESC
  LIMIT 20
`);

console.log("=== ON_HOLD Receipts by Reason ===");
for (const r of rows) {
  console.log(`${r.reason_category}: ${r.cnt}`);
}

const [total] = await conn.execute(`SELECT COUNT(*) as total FROM line_receipts WHERE status = 'on_hold'`);
console.log(`\nTotal on_hold: ${total[0].total}`);

// Also check some sample admin_notes for OTHER category
const [samples] = await conn.execute(`
  SELECT id, admin_notes, submitted_at, total_amount 
  FROM line_receipts 
  WHERE status = 'on_hold' 
    AND admin_notes NOT LIKE '%別ユーザーと同一注文番号%'
    AND admin_notes NOT LIKE '%信頼度不足%'
    AND admin_notes NOT LIKE '%画像読み取り失敗%'
    AND admin_notes NOT LIKE '%AI応答の解析に失敗%'
    AND admin_notes NOT LIKE '%LLM判定: 承認不可%'
  ORDER BY id DESC
  LIMIT 10
`);

console.log("\n=== Sample OTHER hold reasons ===");
for (const s of samples) {
  console.log(`#${s.id} (¥${s.total_amount}): ${s.admin_notes?.substring(0, 120)}`);
}

await conn.end();
