import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SHOW COLUMNS FROM line_receipts');
rows.forEach(r => console.log(r.Field));

// 最新のapprovedレシートを確認
const [receipts] = await conn.execute(
  "SELECT id, status, totalAmount, createdAt FROM line_receipts WHERE status = 'approved' ORDER BY id DESC LIMIT 5"
);
console.log('\n=== Latest approved receipts ===');
receipts.forEach(r => console.log(r));

// 確変チャンス結果テーブル
const [kakuhen] = await conn.execute('SELECT COUNT(*) as cnt FROM receipt_kakuhen_results');
console.log('\n=== Kakuhen results count ===', kakuhen[0]);

// receipt_reviewsテーブル
const [reviews] = await conn.execute('SELECT COUNT(*) as cnt FROM receipt_reviews');
console.log('=== Receipt reviews count ===', reviews[0]);

await conn.end();
