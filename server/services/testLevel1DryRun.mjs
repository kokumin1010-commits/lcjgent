/**
 * Level1重複チェックのDRY RUNテスト
 * AI審査なし、Level1重複のみカウント
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('=== Level1 DRY RUN テスト ===\n');

  // Get all on_hold receipts
  const [onHold] = await conn.execute(`
    SELECT id, lineUserId, ocrRawText, totalAmount, storeName, pointsAwarded
    FROM line_receipts 
    WHERE status = 'on_hold'
    ORDER BY submittedAt ASC
  `);
  console.log(`on_holdレシート: ${onHold.length}件\n`);

  // Build order number map for on_hold
  const orderMap = new Map();
  for (const r of onHold) {
    if (r.ocrRawText) {
      try {
        const ocr = typeof r.ocrRawText === 'string' ? JSON.parse(r.ocrRawText) : r.ocrRawText;
        const orderNum = String(ocr?.orderNumber || '').trim();
        if (orderNum && orderNum !== 'null' && orderNum.length >= 5) {
          orderMap.set(r.id, orderNum);
        }
      } catch { /* skip */ }
    }
  }
  console.log(`注文番号あり: ${orderMap.size}件\n`);

  // Get approved receipts with order numbers
  const [approved] = await conn.execute(`
    SELECT id, lineUserId, 
           JSON_EXTRACT(ocrRawText, '$.orderNumber') as orderNumber
    FROM line_receipts 
    WHERE status = 'approved'
    AND ocrRawText IS NOT NULL
    AND JSON_EXTRACT(ocrRawText, '$.orderNumber') IS NOT NULL
  `);
  console.log(`承認済みレシート（注文番号あり）: ${approved.length}件\n`);

  // Build lookup
  const approvedLookup = new Map();
  for (const ar of approved) {
    const orderNum = String(ar.orderNumber || '').replace(/"/g, '').trim();
    if (orderNum && orderNum !== 'null') {
      const key = `${ar.lineUserId}:${orderNum}`;
      if (!approvedLookup.has(key)) {
        approvedLookup.set(key, ar.id);
      }
    }
  }

  // Check Level1 duplicates
  let level1Count = 0;
  const level1Details = [];
  let pointsAtRisk = 0;
  let pointsAtRiskCount = 0;

  for (const r of onHold) {
    const orderNumber = orderMap.get(r.id);
    if (!orderNumber) continue;

    const lookupKey = `${r.lineUserId}:${orderNumber}`;
    const approvedId = approvedLookup.get(lookupKey);
    
    if (approvedId) {
      level1Count++;
      level1Details.push({
        id: r.id,
        lineUserId: r.lineUserId,
        orderNumber,
        approvedId,
        totalAmount: r.totalAmount,
        pointsAwarded: r.pointsAwarded,
      });
      
      if (r.pointsAwarded && r.pointsAwarded > 0) {
        pointsAtRisk += r.pointsAwarded;
        pointsAtRiskCount++;
      }
    }
  }

  console.log(`=== Level1重複チェック結果 ===`);
  console.log(`自動却下対象: ${level1Count}件`);
  console.log(`ポイント既付与の要注意件数: ${pointsAtRiskCount}件 (${pointsAtRisk}ポイント)`);
  console.log(`\n--- 詳細（先頭20件） ---`);
  for (const d of level1Details.slice(0, 20)) {
    const warn = d.pointsAwarded > 0 ? ` ⚠️ ${d.pointsAwarded}pt付与済み` : '';
    console.log(`  #${d.id}: user=${d.lineUserId.substring(0, 10)}..., order=${d.orderNumber}, approved=#${d.approvedId}, amount=${d.totalAmount}${warn}`);
  }

  // Unique users affected
  const uniqueUsers = new Set(level1Details.map(d => d.lineUserId));
  console.log(`\n影響ユーザー数: ${uniqueUsers.size}人`);

  // Remaining after Level1
  const remaining = onHold.length - level1Count;
  console.log(`\nLevel1却下後の残り: ${remaining}件（AI審査対象）`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
