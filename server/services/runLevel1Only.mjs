/**
 * Level1自動却下のみ実行スクリプト
 * 
 * 同一ユーザー×同一注文番号で承認済みが存在するon_holdレシートを自動却下
 * reason_code: DUPLICATE_SAME_USER_ORDER
 * 
 * ★ ポイント付与は一切しない（rejectパスなので）
 * ★ LINE通知は送らない（重複却下なので）
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const ADMIN_USER_ID = 1;
const BATCH_PREFIX = 'level1_reject';

async function main() {
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const batchId = `${BATCH_PREFIX}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Level1自動却下バッチ開始`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all on_hold receipts
  const [onHold] = await conn.execute(`
    SELECT id, lineUserId, ocrRawText, totalAmount, storeName, pointsAwarded,
           imageUrl, imageUrls, pointsCalculated, fraudFlags, fraudScore
    FROM line_receipts 
    WHERE status = 'on_hold'
    ORDER BY submittedAt ASC
  `);
  console.log(`on_holdレシート: ${onHold.length}件`);

  // Build order number map
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

  // Get approved receipts
  const [approved] = await conn.execute(`
    SELECT id, lineUserId, 
           JSON_EXTRACT(ocrRawText, '$.orderNumber') as orderNumber
    FROM line_receipts 
    WHERE status = 'approved'
    AND ocrRawText IS NOT NULL
    AND JSON_EXTRACT(ocrRawText, '$.orderNumber') IS NOT NULL
  `);

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

  // Process Level1 duplicates
  let rejectedCount = 0;
  let skippedDueToPoints = 0;
  const details = [];

  for (const r of onHold) {
    const orderNumber = orderMap.get(r.id);
    if (!orderNumber) continue;

    const lookupKey = `${r.lineUserId}:${orderNumber}`;
    const approvedId = approvedLookup.get(lookupKey);
    if (!approvedId) continue;

    // ★ 安全チェック: ポイント既付与のレシートはスキップ（手動確認が必要）
    if (r.pointsAwarded && r.pointsAwarded > 0) {
      console.warn(`  ⚠️ SKIP #${r.id}: ${r.pointsAwarded}pt already awarded - needs manual review`);
      skippedDueToPoints++;
      continue;
    }

    const reason = `DUPLICATE_SAME_USER_ORDER: 同一ユーザー×同一注文番号 ${orderNumber} (承認済み #${approvedId})`;

    // Update status to rejected
    await conn.execute(
      `UPDATE line_receipts SET status = 'rejected', reviewedBy = ?, reviewedAt = NOW(), reviewNote = ? WHERE id = ? AND status = 'on_hold'`,
      [ADMIN_USER_ID, `[Level1自動却下] ${reason}`, r.id]
    );

    // Insert ai_auto_review_logs
    await conn.execute(
      `INSERT INTO ai_auto_review_logs (batchId, receiptId, lineUserId, aiDecision, aiConfidence, aiComment, aiReason, orderNumber, totalAmount, storeName, imageUrl, isDryRun, createdAt, updatedAt) 
       VALUES (?, ?, ?, 'rejected_duplicate_level1', 100, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        batchId, r.id, r.lineUserId,
        `❌ Level1自動却下: ${reason}`,
        reason,
        orderNumber, r.totalAmount || null,
        r.storeName || null, r.imageUrl || null,
      ]
    );

    // Insert receipt_review_logs
    let imageCount = 1;
    let fraudFlagCount = 0;
    try {
      if (r.imageUrls) {
        const urls = typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : r.imageUrls;
        if (Array.isArray(urls)) imageCount = urls.length;
      }
    } catch {}
    try {
      if (r.fraudFlags) {
        const flags = typeof r.fraudFlags === 'string' ? JSON.parse(r.fraudFlags) : r.fraudFlags;
        if (Array.isArray(flags)) fraudFlagCount = flags.length;
      }
    } catch {}

    await conn.execute(
      `INSERT INTO receipt_review_logs (receiptType, receiptId, decision, rejectionCategory, rejectionNote, totalAmount, hasOrderNumber, imageCount, fraudScore, fraudFlagCount, pointsCalculated, reviewedBy, createdAt) 
       VALUES ('line_receipt', ?, 'rejected', 'duplicate', ?, ?, 'yes', ?, ?, ?, ?, ?, NOW())`,
      [
        r.id,
        `Level1自動却下: ${reason}`,
        r.totalAmount || null,
        imageCount, r.fraudScore || null,
        fraudFlagCount, r.pointsCalculated || null,
        ADMIN_USER_ID,
      ]
    );

    rejectedCount++;
    details.push({ id: r.id, orderNumber, approvedId, amount: r.totalAmount });

    if (rejectedCount <= 10 || rejectedCount % 50 === 0) {
      console.log(`  [${rejectedCount}] #${r.id} → 却下 (注文番号: ${orderNumber}, 承認済み: #${approvedId})`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Level1自動却下完了`);
  console.log(`${'='.repeat(60)}`);
  console.log(`却下件数: ${rejectedCount}件`);
  console.log(`ポイント付与済みスキップ: ${skippedDueToPoints}件`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`${'='.repeat(60)}`);

  // Verify: check remaining on_hold count
  const [remaining] = await conn.execute(`SELECT COUNT(*) as cnt FROM line_receipts WHERE status = 'on_hold'`);
  console.log(`\n残りon_hold: ${remaining[0].cnt}件`);

  // Verify: no points were awarded to rejected receipts
  const [pointCheck] = await conn.execute(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(pointsAwarded), 0) as totalPoints
    FROM line_receipts 
    WHERE id IN (${details.map(d => d.id).join(',') || '0'})
    AND pointsAwarded > 0
  `);
  console.log(`\n★ ポイント安全確認: 却下レシートのポイント付与 = ${pointCheck[0].cnt}件 (${pointCheck[0].totalPoints}pt)`);
  if (pointCheck[0].cnt > 0) {
    console.error('⚠️ 警告: 却下レシートにポイントが付与されています！手動確認が必要です。');
  } else {
    console.log('✅ 安全: 却下レシートにポイント付与なし');
  }

  await conn.end();
  console.log('\n完了。');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
