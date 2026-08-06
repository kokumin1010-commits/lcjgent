import mysql from 'mysql2/promise';
const pool = mysql.createPool('mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw?ssl={"rejectUnauthorized":true}');

// 1. 中国データ全部のsourceAccountを世曜元宇(中信銀行)に設定
const [upd] = await pool.query("UPDATE company_cashflows SET sourceAccount='世曜元宇(中信銀行)' WHERE entity='china' AND deletedAt IS NULL AND (sourceAccount IS NULL OR sourceAccount='')");
console.log(`Updated: ${upd.affectedRows} records`);

// 2. その他経費の中身確認（日本）
const [jpOther] = await pool.query("SELECT id, transactionDate, amount, type, counterparty, description FROM company_cashflows WHERE entity='japan' AND category='その他経費' AND deletedAt IS NULL ORDER BY amount DESC LIMIT 20");
console.log(`\nJapan その他経費:`);
for (const r of jpOther) console.log(`  ${r.id}|${r.transactionDate}|${r.type}|${r.amount}|${r.counterparty}|${r.description}`);

await pool.end();
