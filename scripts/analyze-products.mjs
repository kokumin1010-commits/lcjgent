import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(`SELECT productName, shopName, COUNT(*) as cnt FROM receipt_products GROUP BY productName, shopName ORDER BY productName`);

console.log(`\n=== 全商品名一覧 (${rows.length}種類) ===\n`);
for (const r of rows) {
  const truncated = r.productName.length > 40 ? ' [長い]' : '';
  console.log(`[${r.cnt}件] ${r.productName} @ ${r.shopName}${truncated}`);
}

// 類似商品名の検出
console.log(`\n=== 類似商品名の候補 ===\n`);
const names = rows.map(r => ({ name: r.productName, shop: r.shopName, cnt: Number(r.cnt) }));
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = names[i].name;
    const b = names[j].name;
    // 同じショップで、片方がもう片方の先頭部分と一致
    if (names[i].shop === names[j].shop) {
      if (a.startsWith(b.substring(0, Math.min(15, b.length))) || b.startsWith(a.substring(0, Math.min(15, a.length)))) {
        if (a !== b) {
          console.log(`  可能性: "${a}" ≈ "${b}" (${names[i].shop})`);
        }
      }
    }
  }
}

// 「...」で切れている商品名
console.log(`\n=== 途中で切れている可能性のある商品名 ===\n`);
for (const r of rows) {
  if (r.productName.endsWith('...') || r.productName.endsWith('…') || r.productName.endsWith('ー') || r.productName.length > 60) {
    console.log(`  "${r.productName}" (${r.shopName})`);
  }
}

console.log(`\n=== 統計 ===`);
console.log(`ユニーク商品名: ${rows.length}`);
console.log(`総レコード数: ${rows.reduce((s, r) => s + Number(r.cnt), 0)}`);

await conn.end();
