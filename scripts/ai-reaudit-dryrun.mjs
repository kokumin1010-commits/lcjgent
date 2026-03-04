/**
 * AI Re-Audit Dry Run Script
 * 
 * Takes the 593 human-reviewed receipts (that were sent to manual review)
 * and re-evaluates them with the AI using 1027 learning examples.
 * Compares AI's new judgment with human's actual decision.
 * Does NOT change any database records.
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limits
const DELAY_BETWEEN_BATCHES_MS = 2000;
const DELAY_BETWEEN_CALLS_MS = 500;

async function invokeLLM(messages) {
  const response = await fetch(`${BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} ${text.substring(0, 200)}`);
  }
  return response.json();
}

async function buildLearningExamplesPrompt(conn, limit = 20) {
  const [examples] = await conn.query(`
    SELECT * FROM ai_receipt_learning_examples 
    WHERE isActive = 1 
    ORDER BY createdAt DESC 
    LIMIT ?
  `, [limit]);
  
  if (examples.length === 0) return "";
  
  const lines = [
    "",
    "=== 過去の人間修正フィードバック（AIの判定ミスから学習） ===",
    `※ 以下は人間がAIの判定を修正した${examples.length}件の実例です。同様のケースでは人間の判定に従ってください。`,
    "",
  ];
  
  for (const ex of examples) {
    const errorLabel = ex.errorType ? `[エラー種別: ${ex.errorType}]` : "";
    lines.push(`--- 修正例 ${errorLabel} ---`);
    lines.push(`AI元判定: ${ex.aiOriginalDecision} (信頼度: ${ex.aiOriginalConfidence ?? "不明"}%)`);
    if (ex.aiOriginalComment) lines.push(`AIコメント: ${ex.aiOriginalComment}`);
    lines.push(`→ 人間修正: ${ex.humanDecision}`);
    if (ex.humanComment) lines.push(`人間コメント: ${ex.humanComment}`);
    
    const corrections = [];
    if (ex.aiOriginalOrderNumber !== ex.correctOrderNumber) {
      corrections.push(`注文番号: AI="${ex.aiOriginalOrderNumber || "なし"}" → 正解="${ex.correctOrderNumber || "なし"}"`);
    }
    if (ex.aiOriginalAmount !== ex.correctAmount) {
      corrections.push(`金額: AI="${ex.aiOriginalAmount ?? "なし"}" → 正解="${ex.correctAmount ?? "なし"}"`);
    }
    if (ex.aiOriginalStoreName !== ex.correctStoreName) {
      corrections.push(`店舗: AI="${ex.aiOriginalStoreName || "なし"}" → 正解="${ex.correctStoreName || "なし"}"`);
    }
    if (corrections.length > 0) {
      lines.push(`修正内容: ${corrections.join(", ")}`);
    }
    if (ex.learningNote) lines.push(`学習メモ: ${ex.learningNote}`);
    lines.push("");
  }
  
  lines.push("上記の修正例を参考に、同様のパターンでは人間の判定に合わせた判断をしてください。");
  lines.push("特に「注文番号なし」とAIが判定したが実際には画像に注文番号が存在するケースに注意してください。");
  
  return lines.join("\n");
}

async function buildStatisticsPrompt(conn) {
  const [stats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN humanDecision = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN humanDecision = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM ai_receipt_learning_examples
    WHERE isActive = 1
  `);
  
  const s = stats[0];
  if (!s || s.total === 0) return "";
  
  return `\n\n=== 学習データ統計 ===\n学習データ: ${s.total}件（承認に修正: ${s.approved}件, 却下に修正: ${s.rejected}件）\n人間の修正パターンから学んでください。特に保留→承認が多いケースでは、積極的に承認してください。`;
}

async function getReviewExamples(conn) {
  const [approved] = await conn.query(`
    SELECT totalAmount, hasOrderNumber, ocrConfidence 
    FROM receipt_review_logs 
    WHERE decision = 'approved' 
    ORDER BY id DESC LIMIT 10
  `);
  
  const [rejected] = await conn.query(`
    SELECT totalAmount, hasOrderNumber, ocrConfidence, rejectionCategory, rejectionNote 
    FROM receipt_review_logs 
    WHERE decision = 'rejected' 
    ORDER BY id DESC LIMIT 10
  `);
  
  const [rejectionStats] = await conn.query(`
    SELECT rejectionCategory as category, COUNT(*) as count 
    FROM receipt_review_logs 
    WHERE decision = 'rejected' AND rejectionCategory IS NOT NULL
    GROUP BY rejectionCategory 
    ORDER BY count DESC
  `);
  
  return { approved, rejected, rejectionStats };
}

async function evaluateReceipt(conn, receipt, learningPrompt, statisticsPrompt, reviewExamples) {
  const imageUrls = [];
  if (receipt.imageUrl) imageUrls.push(receipt.imageUrl);
  
  // Also check line_receipts for imageUrls array
  const [receiptData] = await conn.query(
    'SELECT imageUrls, ocrRawText, totalAmount, storeName, ocrConfidence, isForceSubmitted FROM line_receipts WHERE id = ?',
    [receipt.receiptId]
  );
  
  if (receiptData.length === 0) return null;
  
  const lr = receiptData[0];
  let allImageUrls = [...imageUrls];
  if (lr.imageUrls) {
    try {
      const parsed = typeof lr.imageUrls === 'string' ? JSON.parse(lr.imageUrls) : lr.imageUrls;
      if (Array.isArray(parsed)) allImageUrls = parsed;
    } catch {}
  }
  
  if (allImageUrls.length === 0) return { decision: 'skipped', reason: '画像なし', confidence: 0 };
  
  let ocrData = {};
  try {
    ocrData = lr.ocrRawText ? (typeof lr.ocrRawText === 'string' ? JSON.parse(lr.ocrRawText) : lr.ocrRawText) : {};
  } catch { ocrData = {}; }
  
  const rejectionCategoryLabels = {
    not_order_detail: "注文詳細画面ではない",
    not_tiktok_shop: "TikTok Shop以外",
    not_delivered: "配達未完了",
    blurry_image: "画像不鮮明",
    missing_order_number: "注文番号が見えない",
    missing_amount: "金額が見えない",
    partial_screenshot: "スクショ不完全",
    duplicate: "重複申請",
    wrong_store: "対象外店舗",
    suspicious: "不正の疑い",
    incomplete_info: "情報不足",
    other: "その他",
  };
  
  const exampleContext = [
    "=== 過去の却下理由統計（多い順） ===",
    ...(reviewExamples.rejectionStats || []).map(s =>
      `${rejectionCategoryLabels[s.category || "other"] || s.category}: ${s.count}件`
    ),
    "",
    "=== 過去の承認例 ===",
    ...reviewExamples.approved.map(e =>
      `承認: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`
    ),
    "",
    "=== 過去の却下例（理由付き） ===",
    ...reviewExamples.rejected.map(e => {
      const catLabel = rejectionCategoryLabels[e.rejectionCategory || "other"] || e.rejectionCategory;
      const note = e.rejectionNote ? ` - ${e.rejectionNote}` : "";
      return `却下[理由: ${catLabel}${note}]: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`;
    }),
  ].join("\n");
  
  const orderNumber = ocrData.orderNumber || null;
  const missingOrderNumber = !orderNumber;
  const missingAmount = !lr.totalAmount || lr.totalAmount <= 0;
  
  let missingDataNote = "";
  if (missingOrderNumber) {
    missingDataNote += "\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号（16-19桁の数字）を読み取ってdetectedOrderNumberに設定してください。";
  }
  if (missingAmount) {
    missingDataNote += "\n\n❗ OCRで金額が取得できませんでした。画像から合計金額を読み取ってdetectedAmountに設定してください。";
  }
  
  const imageContents = allImageUrls.map(url => ({
    type: "image_url",
    image_url: { url, detail: "low" },
  }));
  
  imageContents.push({
    type: "text",
    text: `このレシート画像を審査してください。\n\nOCRデータ: ${JSON.stringify({
      orderNumber: ocrData.orderNumber,
      totalAmount: lr.totalAmount,
      shopName: ocrData.shopName || lr.storeName,
      isTikTokShop: ocrData.isTikTokShop,
      isDelivered: ocrData.isDelivered,
    })}${missingDataNote}\n\n${exampleContext}`,
  });
  
  const systemPrompt = `あなたはTikTok Shopのレシート審査AIです。レシート画像とOCRデータを見て、承認すべきか判断してください。

=== 承認基準（全て満たす必要がある） ===
1. TikTok Shopの「注文詳細」画面のスクリーンショットであること
2. 「配達済み」のステータスが確認できること
3. 注文番号（16-19桁の数字）が読み取れること
4. 合計金額が読み取れること

=== 却下基準（いずれか1つでも該当すれば却下） ===
★ 注文詳細画面ではない場合 (rejectionCategory: "not_order_detail")
★ TikTok Shop以外のプラットフォーム (rejectionCategory: "not_tiktok_shop")
★ 配達未完了 (rejectionCategory: "not_delivered")
★ 画像が不鮮明 (rejectionCategory: "blurry_image")
★ 注文番号が見えない (rejectionCategory: "missing_order_number")
★ 金額が見えない (rejectionCategory: "missing_amount")
★ スクリーンショットが不完全 (rejectionCategory: "partial_screenshot")
★ 重複申請 (rejectionCategory: "duplicate")
★ 対象外店舗 (rejectionCategory: "wrong_store")
★ 不正の疑い (rejectionCategory: "suspicious")

=== グレーゾーン判定ガイド ===
- 複数枚のスクショがある場合: 全ての画像を総合的に判断
- 中国語のTikTok Shop: 「抖音商城」「拖音商城」もTikTok Shopとして承認
- 金額が小さい（100円未満等）: 金額の大小では却下しない
- ステータスが「受取確認待ち」: 配達済みとみなす（confidenceを少し下げる）

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
  "rejectionCategory": "..." | null,
  "isTikTokShop": true/false/null,
  "isDelivered": true/false/null,
  "detectedOrderNumber": "string or null",
  "detectedAmount": number or null
}

★ 重要: OCRで注文番号や金額が取得できなかった場合でも、画像から読み取れる場合はそれを基に判定してください。
★ 過去の審査実績では承認率約75%です。基準を満たすレシートは積極的に承認してください。${statisticsPrompt}${learningPrompt}`;
  
  const result = await invokeLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: imageContents },
  ]);
  
  const msgContent = result.choices?.[0]?.message?.content || "{}";
  let parsed = {};
  try {
    let jsonStr = msgContent;
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.replace(/```\s*/g, "");
    }
    jsonStr = jsonStr.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { decision: 'error', reason: 'JSON解析失敗', confidence: 0 };
  }
  
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const shouldApprove = parsed.shouldApprove === true;
  
  let aiDecision;
  if (shouldApprove && confidence >= 70) {
    aiDecision = 'approved';
  } else if (!shouldApprove && confidence < 50) {
    aiDecision = 'rejected';
  } else {
    aiDecision = 'held';
  }
  
  return {
    decision: aiDecision,
    shouldApprove,
    confidence,
    reason: parsed.reason || '',
    rejectionCategory: parsed.rejectionCategory || null,
  };
}

async function main() {
  console.log("=== AI再審査ドライラン開始 ===");
  console.log(`学習データを活用して、人間が審査済みの593件を再評価します\n`);
  
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Get all human-reviewed receipts that were sent to manual review
  const [targets] = await conn.query(`
    SELECT id, receiptId, aiDecision as originalAiDecision, aiConfidence as originalAiConfidence, 
           humanOverride, imageUrl, aiComment
    FROM ai_auto_review_logs
    WHERE aiDecision IN ('held', 'skipped')
    AND humanOverride IS NOT NULL
    ORDER BY id ASC
  `);
  
  console.log(`対象レシート: ${targets.length}件`);
  console.log(`  - 人間承認: ${targets.filter(t => t.humanOverride === 'approved').length}件`);
  console.log(`  - 人間却下: ${targets.filter(t => t.humanOverride === 'rejected').length}件\n`);
  
  // Build prompts once
  console.log("学習プロンプト構築中...");
  const learningPrompt = await buildLearningExamplesPrompt(conn, 20);
  const statisticsPrompt = await buildStatisticsPrompt(conn);
  const reviewExamples = await getReviewExamples(conn);
  console.log(`学習プロンプト: ${learningPrompt.length}文字`);
  console.log(`統計プロンプト: ${statisticsPrompt.length}文字\n`);
  
  const results = [];
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    
    for (const target of batch) {
      try {
        const aiResult = await evaluateReceipt(conn, target, learningPrompt, statisticsPrompt, reviewExamples);
        
        if (!aiResult) {
          results.push({
            logId: target.id,
            receiptId: target.receiptId,
            originalAiDecision: target.originalAiDecision,
            originalAiConfidence: target.originalAiConfidence,
            humanOverride: target.humanOverride,
            newAiDecision: 'skipped',
            newAiConfidence: 0,
            newAiReason: 'レシートデータ取得失敗',
            match: false,
          });
          errors++;
          continue;
        }
        
        // Compare new AI decision with human decision
        const humanDecision = target.humanOverride;
        let newAiDecisionForComparison;
        if (aiResult.decision === 'approved') {
          newAiDecisionForComparison = 'approved';
        } else if (aiResult.decision === 'rejected') {
          newAiDecisionForComparison = 'rejected';
        } else {
          // held = uncertain, count as "would need manual review"
          newAiDecisionForComparison = 'held';
        }
        
        const match = newAiDecisionForComparison === humanDecision;
        
        results.push({
          logId: target.id,
          receiptId: target.receiptId,
          originalAiDecision: target.originalAiDecision,
          originalAiConfidence: target.originalAiConfidence,
          humanOverride: humanDecision,
          newAiDecision: aiResult.decision,
          newAiShouldApprove: aiResult.shouldApprove,
          newAiConfidence: aiResult.confidence,
          newAiReason: aiResult.reason?.substring(0, 200),
          match,
        });
        
        processed++;
        
        if (processed % 10 === 0) {
          const matchCount = results.filter(r => r.match).length;
          const approvedMatch = results.filter(r => r.humanOverride === 'approved' && r.newAiDecision === 'approved').length;
          const totalHumanApproved = results.filter(r => r.humanOverride === 'approved').length;
          console.log(`[${processed}/${targets.length}] 一致率: ${(matchCount/results.length*100).toFixed(1)}% | 承認一致: ${approvedMatch}/${totalHumanApproved}`);
        }
        
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
        
      } catch (err) {
        console.error(`Error processing receipt ${target.receiptId}:`, err.message?.substring(0, 100));
        results.push({
          logId: target.id,
          receiptId: target.receiptId,
          originalAiDecision: target.originalAiDecision,
          originalAiConfidence: target.originalAiConfidence,
          humanOverride: target.humanOverride,
          newAiDecision: 'error',
          newAiConfidence: 0,
          newAiReason: err.message?.substring(0, 200),
          match: false,
        });
        errors++;
      }
    }
    
    if (i + BATCH_SIZE < targets.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }
  
  // === ANALYSIS ===
  console.log("\n\n========================================");
  console.log("=== AI再審査ドライラン結果 ===");
  console.log("========================================\n");
  
  const validResults = results.filter(r => r.newAiDecision !== 'error' && r.newAiDecision !== 'skipped');
  const errorResults = results.filter(r => r.newAiDecision === 'error' || r.newAiDecision === 'skipped');
  
  console.log(`処理件数: ${results.length}件`);
  console.log(`有効結果: ${validResults.length}件`);
  console.log(`エラー/スキップ: ${errorResults.length}件\n`);
  
  // Overall accuracy
  const exactMatch = validResults.filter(r => r.match).length;
  console.log(`=== 全体精度 ===`);
  console.log(`完全一致率: ${exactMatch}/${validResults.length} = ${(exactMatch/validResults.length*100).toFixed(1)}%\n`);
  
  // Human approved receipts
  const humanApproved = validResults.filter(r => r.humanOverride === 'approved');
  const aiAlsoApproved = humanApproved.filter(r => r.newAiDecision === 'approved');
  const aiHeldInsteadOfApprove = humanApproved.filter(r => r.newAiDecision === 'held');
  const aiRejectedInsteadOfApprove = humanApproved.filter(r => r.newAiDecision === 'rejected');
  
  console.log(`=== 人間が承認したレシート (${humanApproved.length}件) ===`);
  console.log(`  AIも承認: ${aiAlsoApproved.length}件 (${(aiAlsoApproved.length/humanApproved.length*100).toFixed(1)}%) ← 正解`);
  console.log(`  AI保留: ${aiHeldInsteadOfApprove.length}件 (${(aiHeldInsteadOfApprove.length/humanApproved.length*100).toFixed(1)}%) ← まだ手動審査が必要`);
  console.log(`  AI却下: ${aiRejectedInsteadOfApprove.length}件 (${(aiRejectedInsteadOfApprove.length/humanApproved.length*100).toFixed(1)}%) ← 誤判定\n`);
  
  // Human rejected receipts
  const humanRejected = validResults.filter(r => r.humanOverride === 'rejected');
  const aiAlsoRejected = humanRejected.filter(r => r.newAiDecision === 'rejected');
  const aiHeldInsteadOfReject = humanRejected.filter(r => r.newAiDecision === 'held');
  const aiApprovedInsteadOfReject = humanRejected.filter(r => r.newAiDecision === 'approved');
  
  console.log(`=== 人間が却下したレシート (${humanRejected.length}件) ===`);
  console.log(`  AIも却下: ${aiAlsoRejected.length}件 (${(aiAlsoRejected.length/humanRejected.length*100).toFixed(1)}%) ← 正解`);
  console.log(`  AI保留: ${aiHeldInsteadOfReject.length}件 (${(aiHeldInsteadOfReject.length/humanRejected.length*100).toFixed(1)}%) ← まだ手動審査が必要`);
  console.log(`  AI承認: ${aiApprovedInsteadOfReject.length}件 (${(aiApprovedInsteadOfReject.length/humanRejected.length*100).toFixed(1)}%) ← 誤判定（危険）\n`);
  
  // New AI decision distribution
  console.log(`=== 新AIの判定分布 ===`);
  console.log(`  承認: ${validResults.filter(r => r.newAiDecision === 'approved').length}件`);
  console.log(`  保留: ${validResults.filter(r => r.newAiDecision === 'held').length}件`);
  console.log(`  却下: ${validResults.filter(r => r.newAiDecision === 'rejected').length}件\n`);
  
  // Confidence distribution
  const avgConfApproved = aiAlsoApproved.length > 0 ? (aiAlsoApproved.reduce((s, r) => s + r.newAiConfidence, 0) / aiAlsoApproved.length).toFixed(1) : 'N/A';
  const avgConfHeld = aiHeldInsteadOfApprove.length > 0 ? (aiHeldInsteadOfApprove.reduce((s, r) => s + r.newAiConfidence, 0) / aiHeldInsteadOfApprove.length).toFixed(1) : 'N/A';
  
  console.log(`=== 信頼度スコア平均 ===`);
  console.log(`  正しく承認したもの: ${avgConfApproved}%`);
  console.log(`  承認すべきだが保留: ${avgConfHeld}%\n`);
  
  // Comparison with original AI
  const originalHeldThenHumanApproved = validResults.filter(r => r.originalAiDecision === 'held' && r.humanOverride === 'approved');
  const originalHeldNowApproved = originalHeldThenHumanApproved.filter(r => r.newAiDecision === 'approved');
  
  const originalSkippedThenHumanApproved = validResults.filter(r => r.originalAiDecision === 'skipped' && r.humanOverride === 'approved');
  const originalSkippedNowApproved = originalSkippedThenHumanApproved.filter(r => r.newAiDecision === 'approved');
  
  console.log(`=== 改善分析 ===`);
  console.log(`元AI「保留」→人間「承認」: ${originalHeldThenHumanApproved.length}件`);
  console.log(`  → 新AIで承認できた: ${originalHeldNowApproved.length}件 (${(originalHeldNowApproved.length/Math.max(originalHeldThenHumanApproved.length,1)*100).toFixed(1)}%)`);
  console.log(`元AI「スキップ」→人間「承認」: ${originalSkippedThenHumanApproved.length}件`);
  console.log(`  → 新AIで承認できた: ${originalSkippedNowApproved.length}件 (${(originalSkippedNowApproved.length/Math.max(originalSkippedThenHumanApproved.length,1)*100).toFixed(1)}%)\n`);
  
  // Potential automation gain
  const couldAutomate = aiAlsoApproved.length + aiAlsoRejected.length;
  console.log(`=== 自動化ポテンシャル ===`);
  console.log(`新AIで自動処理可能: ${couldAutomate}/${validResults.length}件 (${(couldAutomate/validResults.length*100).toFixed(1)}%)`);
  console.log(`まだ手動審査が必要: ${validResults.length - couldAutomate}件`);
  console.log(`誤承認（人間却下をAI承認）: ${aiApprovedInsteadOfReject.length}件 ← 要注意\n`);
  
  // Save results to JSON
  const outputPath = '/home/ubuntu/ai-reaudit-results.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
      totalProcessed: results.length,
      validResults: validResults.length,
      errors: errorResults.length,
      exactMatchRate: (exactMatch/validResults.length*100).toFixed(1) + '%',
      humanApproved: {
        total: humanApproved.length,
        aiApproved: aiAlsoApproved.length,
        aiHeld: aiHeldInsteadOfApprove.length,
        aiRejected: aiRejectedInsteadOfApprove.length,
      },
      humanRejected: {
        total: humanRejected.length,
        aiRejected: aiAlsoRejected.length,
        aiHeld: aiHeldInsteadOfReject.length,
        aiApproved: aiApprovedInsteadOfReject.length,
      },
      automationPotential: (couldAutomate/validResults.length*100).toFixed(1) + '%',
    },
    results,
  }, null, 2));
  console.log(`詳細結果を ${outputPath} に保存しました`);
  
  await conn.end();
  console.log("\n=== ドライラン完了 ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
