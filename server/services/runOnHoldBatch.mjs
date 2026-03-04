/**
 * on_hold専用ワンショットバッチスクリプト
 * 
 * Level1自動却下（同一ユーザー×同一注文番号）+ AI再審査
 * 
 * 処理フロー:
 * 1. on_holdレシートを全件取得
 * 2. Level1重複チェック: 同一ユーザー×同一注文番号で承認済みが存在 → auto-reject (DUPLICATE_SAME_USER_ORDER)
 *    ※ ポイント付与は一切しない（rejectパスなので）
 * 3. 残りをAI審査: 高信頼度(90%+) → auto-approve, それ以外 → on_hold維持
 * 
 * 安全設計:
 * - Level1却下: ポイント付与コードパスを通らない（rejectなので）
 * - 承認時のみポイント付与
 * - 全決定をaiAutoReviewLogsに記録（batch_idでロールバック可能）
 * - idempotent: 同じレシートを2回処理しない
 * 
 * 実行: node server/services/runOnHoldBatch.mjs
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

// ========== CONFIG ==========
const BATCH_SIZE = 20;
const CONFIDENCE_THRESHOLD = 90; // 90%以上で自動承認
const REJECTION_THRESHOLD = 50;  // 50%未満でAI自動却下
const ADMIN_USER_ID = 1;
const BATCH_PREFIX = 'onhold_v2';
const DRY_RUN = false; // true=ログのみ、false=実際にステータス変更

// ========== DB CONNECTION ==========
let conn;
async function getConn() {
  if (!conn) {
    conn = await mysql.createConnection({
      uri: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return conn;
}

// ========== HELPERS ==========
async function getAllOnHoldReceipts() {
  const c = await getConn();
  const [rows] = await c.execute(`
    SELECT id, lineUserId, imageUrl, imageUrls, storeName, totalAmount, 
           ocrRawText, ocrConfidence, pointsCalculated, pointsAwarded,
           fraudFlags, fraudScore, isForceSubmitted, submittedAt
    FROM line_receipts 
    WHERE status = 'on_hold'
    ORDER BY submittedAt ASC
  `);
  return rows;
}

async function getApprovedReceiptsWithOrderNumbers() {
  const c = await getConn();
  const [rows] = await c.execute(`
    SELECT id, lineUserId, 
           JSON_EXTRACT(ocrRawText, '$.orderNumber') as orderNumber
    FROM line_receipts 
    WHERE status = 'approved'
    AND ocrRawText IS NOT NULL
    AND JSON_EXTRACT(ocrRawText, '$.orderNumber') IS NOT NULL
  `);
  return rows;
}

async function updateReceiptStatus(id, status, reviewNote) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would update receipt #${id} to ${status}`);
    return;
  }
  const c = await getConn();
  await c.execute(
    `UPDATE line_receipts SET status = ?, reviewedBy = ?, reviewedAt = NOW(), reviewNote = ? WHERE id = ?`,
    [status, ADMIN_USER_ID, reviewNote, id]
  );
}

async function awardPoints(receiptId, points, lineUserId, storeName) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would award ${points} points for receipt #${receiptId}`);
    return;
  }
  const c = await getConn();
  // Update receipt
  await c.execute(
    `UPDATE line_receipts SET pointsAwarded = ? WHERE id = ?`,
    [points, receiptId]
  );
  // Get current balance
  const [balRows] = await c.execute(
    `SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN amount WHEN type = 'use' THEN -amount WHEN type = 'refund' THEN amount WHEN type = 'adjustment' THEN amount ELSE 0 END), 0) as balance FROM line_point_transactions WHERE lineUserId = ?`,
    [lineUserId]
  );
  const currentBalance = Number(balRows[0]?.balance || 0);
  const newBalance = currentBalance + points;
  // Create point transaction
  await c.execute(
    `INSERT INTO line_point_transactions (lineUserId, type, amount, balanceAfter, referenceType, referenceId, description, createdAt) 
     VALUES (?, 'earn', ?, ?, 'receipt', ?, ?, NOW())`,
    [lineUserId, points, newBalance, receiptId, `レシート承認によるポイント付与 (${storeName || '不明店舗'})`]
  );
}

async function insertReviewLog(data) {
  const c = await getConn();
  await c.execute(
    `INSERT INTO ai_auto_review_logs (batchId, receiptId, lineUserId, aiDecision, aiConfidence, aiComment, aiReason, orderNumber, totalAmount, storeName, imageUrl, isDryRun, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.batchId, data.receiptId, data.lineUserId || null,
      data.aiDecision, data.aiConfidence || null,
      data.aiComment || null, data.aiReason || null,
      data.orderNumber || null, data.totalAmount || null,
      data.storeName || null, data.imageUrl || null,
      DRY_RUN ? 1 : 0,
    ]
  );
}

async function insertReceiptReviewLog(data) {
  const c = await getConn();
  await c.execute(
    `INSERT INTO receipt_review_logs (receiptType, receiptId, decision, rejectionCategory, rejectionNote, totalAmount, hasOrderNumber, imageCount, fraudScore, fraudFlagCount, pointsCalculated, pointsAwarded, reviewedBy, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.receiptType, data.receiptId, data.decision,
      data.rejectionCategory || null, data.rejectionNote || null,
      data.totalAmount || null, data.hasOrderNumber || null,
      data.imageCount || 1, data.fraudScore || null,
      data.fraudFlagCount || 0, data.pointsCalculated || null,
      data.pointsAwarded || null, data.reviewedBy || ADMIN_USER_ID,
    ]
  );
}

// ========== LLM CALL ==========
async function callLLM(messages) {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  
  const response = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 1000,
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} ${text}`);
  }
  
  return response.json();
}

// ========== LINE PUSH ==========
async function sendLineMessage(to, text) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send LINE message to ${to}`);
    return;
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    });
  } catch (e) {
    console.error(`  LINE push error: ${e.message}`);
  }
}

// ========== MAIN BATCH LOGIC ==========
async function main() {
  const batchId = `${BATCH_PREFIX}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`on_hold一括再審査バッチ開始`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`信頼度閾値: ${CONFIDENCE_THRESHOLD}%`);
  console.log(`却下閾値: ${REJECTION_THRESHOLD}%`);
  console.log(`${'='.repeat(60)}\n`);

  // ===== STEP 1: Get all on_hold receipts =====
  console.log('[Step 1] on_holdレシートを取得中...');
  const onHoldReceipts = await getAllOnHoldReceipts();
  console.log(`  → ${onHoldReceipts.length}件のon_holdレシートを取得\n`);

  if (onHoldReceipts.length === 0) {
    console.log('処理対象なし。終了します。');
    return;
  }

  // ===== STEP 2: Build order number map for on_hold receipts =====
  console.log('[Step 2] 注文番号マップを構築中...');
  const orderNumberMap = new Map(); // receiptId -> orderNumber
  for (const r of onHoldReceipts) {
    if (r.ocrRawText) {
      try {
        const ocr = typeof r.ocrRawText === 'string' ? JSON.parse(r.ocrRawText) : r.ocrRawText;
        const orderNum = String(ocr?.orderNumber || '').trim();
        if (orderNum && orderNum !== 'null' && orderNum.length >= 5) {
          orderNumberMap.set(r.id, orderNum);
        }
      } catch { /* skip */ }
    }
  }
  console.log(`  → ${orderNumberMap.size}件に注文番号あり\n`);

  // ===== STEP 3: Level1 duplicate check =====
  console.log('[Step 3] Level1重複チェック（同一ユーザー×同一注文番号）...');
  const approvedReceipts = await getApprovedReceiptsWithOrderNumbers();
  console.log(`  → 承認済みレシート: ${approvedReceipts.length}件`);
  
  // Build lookup: lineUserId+orderNumber -> approved receipt id
  const approvedLookup = new Map(); // "lineUserId:orderNumber" -> approvedReceiptId
  for (const ar of approvedReceipts) {
    const orderNum = String(ar.orderNumber || '').replace(/"/g, '').trim();
    if (orderNum && orderNum !== 'null') {
      const key = `${ar.lineUserId}:${orderNum}`;
      if (!approvedLookup.has(key)) {
        approvedLookup.set(key, ar.id);
      }
    }
  }
  console.log(`  → 承認済みユーザー×注文番号ペア: ${approvedLookup.size}件\n`);

  // ===== STEP 4: Process all receipts =====
  const results = {
    level1_rejected: 0,
    ai_approved: 0,
    ai_rejected: 0,
    held: 0,
    skipped: 0,
    errors: 0,
  };
  const level1Details = [];
  const aiApproveDetails = [];
  const aiRejectDetails = [];

  let processed = 0;
  const total = onHoldReceipts.length;

  for (const receipt of onHoldReceipts) {
    processed++;
    const orderNumber = orderNumberMap.get(receipt.id);
    let ocrData = {};
    try {
      ocrData = receipt.ocrRawText
        ? (typeof receipt.ocrRawText === 'string' ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText)
        : {};
    } catch { ocrData = {}; }

    // --- Level1 Check: Same user + same order number → auto-reject ---
    if (orderNumber) {
      const lookupKey = `${receipt.lineUserId}:${orderNumber}`;
      const approvedId = approvedLookup.get(lookupKey);
      
      if (approvedId) {
        // LEVEL1 AUTO-REJECT: Same user + same order number already approved
        // ★ ポイント付与は一切しない（rejectパスなので）
        const reason = `DUPLICATE_SAME_USER_ORDER: 同一ユーザー×同一注文番号 ${orderNumber} (承認済み #${approvedId})`;
        
        await updateReceiptStatus(receipt.id, 'rejected', `[Level1自動却下] ${reason}`);
        
        // Log to ai_auto_review_logs
        await insertReviewLog({
          batchId,
          receiptId: receipt.id,
          lineUserId: receipt.lineUserId,
          aiDecision: 'rejected_duplicate_level1',
          aiConfidence: 100,
          aiComment: `❌ Level1自動却下: ${reason}`,
          aiReason: reason,
          orderNumber,
          totalAmount: receipt.totalAmount,
          storeName: receipt.storeName,
          imageUrl: receipt.imageUrl,
        });
        
        // Log to receipt_review_logs
        try {
          await insertReceiptReviewLog({
            receiptType: 'line_receipt',
            receiptId: receipt.id,
            decision: 'rejected',
            rejectionCategory: 'duplicate',
            rejectionNote: `Level1自動却下: ${reason}`,
            totalAmount: receipt.totalAmount,
            hasOrderNumber: 'yes',
            imageCount: receipt.imageUrls ? JSON.parse(receipt.imageUrls).length : 1,
            fraudScore: receipt.fraudScore,
            fraudFlagCount: receipt.fraudFlags ? JSON.parse(receipt.fraudFlags).length : 0,
            pointsCalculated: receipt.pointsCalculated,
          });
        } catch (e) { /* ignore log errors */ }

        // ★ 安全確認: on_holdレシートにポイントが既に付与されている場合は警告
        if (receipt.pointsAwarded && receipt.pointsAwarded > 0) {
          console.warn(`  ⚠️ WARNING: Receipt #${receipt.id} has ${receipt.pointsAwarded} points already awarded while on_hold! Manual review needed.`);
        }

        results.level1_rejected++;
        level1Details.push({ id: receipt.id, orderNumber, approvedId, lineUserId: receipt.lineUserId });
        
        if (processed % 50 === 0 || results.level1_rejected <= 5) {
          console.log(`  [${processed}/${total}] #${receipt.id} → Level1却下 (注文番号: ${orderNumber}, 承認済み: #${approvedId})`);
        }
        continue;
      }
    }

    // --- Force-submitted → skip (needs human review) ---
    if (receipt.isForceSubmitted) {
      results.skipped++;
      await insertReviewLog({
        batchId,
        receiptId: receipt.id,
        lineUserId: receipt.lineUserId,
        aiDecision: 'skipped',
        aiComment: '⏭️ スキップ: 強制申請レシート（人間審査必要）',
        aiReason: '強制申請レシート',
        orderNumber,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        imageUrl: receipt.imageUrl,
      });
      continue;
    }

    // --- High fraud flags → skip ---
    let fraudFlagCount = 0;
    try {
      const flags = receipt.fraudFlags ? (typeof receipt.fraudFlags === 'string' ? JSON.parse(receipt.fraudFlags) : receipt.fraudFlags) : [];
      fraudFlagCount = Array.isArray(flags) ? flags.length : 0;
    } catch { /* ignore */ }
    
    if (fraudFlagCount >= 3) {
      results.skipped++;
      await insertReviewLog({
        batchId,
        receiptId: receipt.id,
        lineUserId: receipt.lineUserId,
        aiDecision: 'skipped',
        aiComment: `⏭️ スキップ: 不正フラグ${fraudFlagCount}件`,
        aiReason: `不正フラグ${fraudFlagCount}件`,
        orderNumber,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        imageUrl: receipt.imageUrl,
      });
      continue;
    }

    // --- AI LLM Review ---
    const isTikTok = ocrData.isTikTokShop === true;
    const isDelivered = ocrData.isDelivered === true;
    const ocrConf = parseFloat(receipt.ocrConfidence || '0');
    
    let aiConfidence = 0;
    let aiReason = '';
    let shouldApprove = false;

    // Fast path: high-quality OCR data
    if (isTikTok && isDelivered && orderNumber && (receipt.totalAmount ?? 0) > 0 && ocrConf >= 95) {
      aiConfidence = 92;
      aiReason = `OCRデータ良好(信頼度${ocrConf}%): TikTok Shop + 配達済み + 注文番号 + 金額あり`;
      shouldApprove = true;
    } else {
      // Need LLM evaluation
      try {
        const allImageUrls = [];
        if (receipt.imageUrls) {
          try {
            const urls = typeof receipt.imageUrls === 'string' ? JSON.parse(receipt.imageUrls) : receipt.imageUrls;
            if (Array.isArray(urls)) allImageUrls.push(...urls);
          } catch { /* ignore */ }
        }
        if (allImageUrls.length === 0 && receipt.imageUrl) {
          allImageUrls.push(receipt.imageUrl);
        }

        if (allImageUrls.length === 0) {
          results.skipped++;
          await insertReviewLog({
            batchId,
            receiptId: receipt.id,
            lineUserId: receipt.lineUserId,
            aiDecision: 'skipped',
            aiComment: '⏭️ スキップ: 画像なし',
            aiReason: '画像なし',
            orderNumber,
            totalAmount: receipt.totalAmount,
            storeName: receipt.storeName,
          });
          continue;
        }

        const missingOrderNumber = !orderNumber;
        const missingAmount = !receipt.totalAmount || receipt.totalAmount <= 0;
        let missingDataNote = '';
        if (missingOrderNumber) {
          missingDataNote += '\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号を読み取ってdetectedOrderNumberに設定してください。';
        }
        if (missingAmount) {
          missingDataNote += '\n\n❗ OCRで金額が取得できませんでした。画像から合計金額を読み取ってdetectedAmountに設定してください。';
        }

        const imageContents = allImageUrls.map(url => ({
          type: 'image_url',
          image_url: { url, detail: 'low' },
        }));
        imageContents.push({
          type: 'text',
          text: `このレシート画像を審査してください。\n\nOCRデータ: ${JSON.stringify({
            orderNumber: ocrData.orderNumber,
            totalAmount: receipt.totalAmount,
            shopName: ocrData.shopName || receipt.storeName,
            isTikTokShop: ocrData.isTikTokShop,
            isDelivered: ocrData.isDelivered,
          })}${missingDataNote}`,
        });

        const llmResult = await callLLM([
          {
            role: 'system',
            content: `あなたはTikTok Shopのレシート審査AIです。レシート画像とOCRデータを見て、承認すべきか判断してください。

=== 承認基準（全て満たす必要がある） ===
1. TikTok Shopの「注文詳細」画面のスクリーンショットであること
2. 「配達済み」のステータスが確認できること
3. 注文番号（16-19桁の数字）が読み取れること
4. 合計金額が読み取れること

=== 却下基準（いずれか1つでも該当すれば却下） ===
★ 注文詳細画面ではない場合
★ TikTok Shop以外のプラットフォーム
★ 配達未完了
★ 画像が不鮮明で情報が読み取れない
★ 注文番号が見えない
★ 金額が見えない
★ スクリーンショットが不完全

=== グレーゾーン判定ガイド ===
- 複数枚のスクショがある場合: 全ての画像を総合的に判断
- 中国語のTikTok Shop: 「抖音商城」「拖音商城」もTikTok Shopとして承認
- 金額が小さい（100円未満等）: 金額の大小では却下しない
- ステータスが「受取確認待ち」: 配達済みとみなす

=== 信頼度スコアガイドライン ===
- 90-100: 全ての情報が明確に確認できる
- 75-89: ほぼ確認できるが一部不明瞭な点がある
- 50-74: 判断が難しい、人間の確認が必要
- 0-49: 明らかに基準を満たしていない

必ず以下のJSON形式で回答してください：
{
  "shouldApprove": true/false,
  "confidence": 0-100,
  "reason": "判断理由（日本語）",
  "detectedOrderNumber": "string or null",
  "detectedAmount": number or null
}

★ 重要: OCRで注文番号や金額が取得できなかった場合でも、画像から読み取れる場合はそれを基に判定してください。
★ 過去の審査実績では承認率約75%です。基準を満たすレシートは積極的に承認してください。`,
          },
          {
            role: 'user',
            content: imageContents,
          },
        ]);

        const msgContent = llmResult.choices?.[0]?.message?.content || '{}';
        let parsed = {};
        try {
          let jsonStr = typeof msgContent === 'string' ? msgContent : '{}';
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.replace(/```\s*/g, '');
          }
          jsonStr = jsonStr.trim();
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          results.skipped++;
          await insertReviewLog({
            batchId,
            receiptId: receipt.id,
            lineUserId: receipt.lineUserId,
            aiDecision: 'skipped',
            aiComment: '⏭️ スキップ: LLM応答解析失敗',
            aiReason: 'LLM応答解析失敗',
            orderNumber,
            totalAmount: receipt.totalAmount,
            storeName: receipt.storeName,
            imageUrl: receipt.imageUrl,
          });
          continue;
        }

        aiConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
        aiReason = parsed.reason || 'LLM判定';
        shouldApprove = parsed.shouldApprove === true;
      } catch (llmErr) {
        console.error(`  LLM error for #${receipt.id}: ${llmErr.message}`);
        results.errors++;
        await insertReviewLog({
          batchId,
          receiptId: receipt.id,
          lineUserId: receipt.lineUserId,
          aiDecision: 'skipped',
          aiComment: `⏭️ スキップ: LLMエラー: ${llmErr.message?.substring(0, 100)}`,
          aiReason: `LLMエラー`,
          orderNumber,
          totalAmount: receipt.totalAmount,
          storeName: receipt.storeName,
          imageUrl: receipt.imageUrl,
        });
        continue;
      }
    }

    // --- Decision ---
    if (!shouldApprove && aiConfidence < REJECTION_THRESHOLD) {
      // AI auto-reject (low confidence, clearly not valid)
      await updateReceiptStatus(receipt.id, 'rejected', 
        `[AI自動却下] 信頼度${aiConfidence}% - ${aiReason}`);
      
      // Send LINE notification
      const appUrl = process.env.APP_URL || 'https://lcjmall.com';
      await sendLineMessage(receipt.lineUserId, 
        `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`);
      
      results.ai_rejected++;
      aiRejectDetails.push({ id: receipt.id, confidence: aiConfidence, reason: aiReason });
      
      await insertReviewLog({
        batchId,
        receiptId: receipt.id,
        lineUserId: receipt.lineUserId,
        aiDecision: 'rejected_ai',
        aiConfidence,
        aiComment: `🚫 AI却下(${aiConfidence}%): ${aiReason}`,
        aiReason,
        orderNumber,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        imageUrl: receipt.imageUrl,
      });
      
      if (processed % 100 === 0 || results.ai_rejected <= 3) {
        console.log(`  [${processed}/${total}] #${receipt.id} → AI却下 (${aiConfidence}%: ${aiReason.substring(0, 60)})`);
      }
      continue;
    }

    if (shouldApprove && aiConfidence >= CONFIDENCE_THRESHOLD) {
      // AUTO-APPROVE
      const pointsToAward = receipt.pointsCalculated ?? 0;
      
      await updateReceiptStatus(receipt.id, 'approved',
        `[AI自動承認] confidence: ${aiConfidence}% - ${aiReason}`);
      
      // Award points
      if (pointsToAward > 0) {
        await awardPoints(receipt.id, pointsToAward, receipt.lineUserId, receipt.storeName);
      }
      
      // Send LINE notification
      try {
        const appUrl = process.env.APP_URL || 'https://lcjmall.com';
        const storeName = receipt.storeName || '不明';
        const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : '不明';
        await sendLineMessage(receipt.lineUserId,
          `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`);
      } catch (e) { /* ignore */ }
      
      results.ai_approved++;
      aiApproveDetails.push({ id: receipt.id, confidence: aiConfidence, points: pointsToAward, orderNumber });
      
      await insertReviewLog({
        batchId,
        receiptId: receipt.id,
        lineUserId: receipt.lineUserId,
        aiDecision: 'approved',
        aiConfidence,
        aiComment: `✅ 承認(${aiConfidence}%): ${aiReason}`,
        aiReason,
        orderNumber,
        totalAmount: receipt.totalAmount,
        storeName: receipt.storeName,
        imageUrl: receipt.imageUrl,
      });
      
      // Log to receipt_review_logs
      try {
        await insertReceiptReviewLog({
          receiptType: 'line_receipt',
          receiptId: receipt.id,
          decision: 'approved',
          totalAmount: receipt.totalAmount,
          hasOrderNumber: orderNumber ? 'yes' : 'no',
          imageCount: receipt.imageUrls ? JSON.parse(receipt.imageUrls).length : 1,
          fraudScore: receipt.fraudScore,
          fraudFlagCount,
          pointsCalculated: receipt.pointsCalculated,
          pointsAwarded: pointsToAward,
        });
      } catch (e) { /* ignore */ }
      
      if (processed % 100 === 0 || results.ai_approved <= 5) {
        console.log(`  [${processed}/${total}] #${receipt.id} → 承認 (${aiConfidence}%: ${aiReason.substring(0, 60)})`);
      }
      continue;
    }

    // --- HOLD (keep on_hold) ---
    results.held++;
    await insertReviewLog({
      batchId,
      receiptId: receipt.id,
      lineUserId: receipt.lineUserId,
      aiDecision: 'held',
      aiConfidence,
      aiComment: `⏸️ 保留(${aiConfidence}%): ${aiReason}`,
      aiReason,
      orderNumber,
      totalAmount: receipt.totalAmount,
      storeName: receipt.storeName,
      imageUrl: receipt.imageUrl,
    });

    if (processed % 200 === 0) {
      console.log(`  [${processed}/${total}] Progress: L1却下=${results.level1_rejected}, 承認=${results.ai_approved}, AI却下=${results.ai_rejected}, 保留=${results.held}, スキップ=${results.skipped}`);
    }

    // Rate limiting: small delay every batch
    if (processed % BATCH_SIZE === 0) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ===== SUMMARY =====
  console.log(`\n${'='.repeat(60)}`);
  console.log(`バッチ完了: ${batchId}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`処理件数: ${total}`);
  console.log(`Level1自動却下: ${results.level1_rejected}件 (同一ユーザー×同一注文番号)`);
  console.log(`AI自動承認: ${results.ai_approved}件`);
  console.log(`AI自動却下: ${results.ai_rejected}件`);
  console.log(`保留維持: ${results.held}件`);
  console.log(`スキップ: ${results.skipped}件`);
  console.log(`エラー: ${results.errors}件`);
  console.log(`${'='.repeat(60)}`);
  
  if (level1Details.length > 0) {
    console.log(`\n--- Level1却下の詳細（先頭10件） ---`);
    for (const d of level1Details.slice(0, 10)) {
      console.log(`  #${d.id}: 注文番号=${d.orderNumber}, 承認済み=#${d.approvedId}`);
    }
  }
  
  if (aiApproveDetails.length > 0) {
    console.log(`\n--- AI承認の詳細（先頭10件） ---`);
    for (const d of aiApproveDetails.slice(0, 10)) {
      console.log(`  #${d.id}: 信頼度=${d.confidence}%, ポイント=${d.points}, 注文番号=${d.orderNumber || 'なし'}`);
    }
  }

  if (aiRejectDetails.length > 0) {
    console.log(`\n--- AI却下の詳細（先頭10件） ---`);
    for (const d of aiRejectDetails.slice(0, 10)) {
      console.log(`  #${d.id}: 信頼度=${d.confidence}%, 理由=${d.reason.substring(0, 80)}`);
    }
  }

  // Close connection
  if (conn) await conn.end();
  console.log('\n完了。');
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  if (conn) await conn.end();
  process.exit(1);
});
