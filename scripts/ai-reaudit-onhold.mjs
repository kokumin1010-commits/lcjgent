/**
 * on_hold専用ワンショットバッチ: AI再審査
 * 
 * 方針:
 * - 対象: status='on_hold' かつ人間未審査のレシート
 * - 高信頼（>=90%）のみ自動承認
 * - 却下は絶対しない（on_holdのまま保留）
 * - 監査: batch_id付与、aiAutoReviewLogsに全件記録
 * - 段階実行: LIMIT引数で制御（50→100→全件）
 * 
 * Usage: npx tsx scripts/ai-reaudit-onhold.mjs [limit]
 *   limit: 処理件数（デフォルト50）
 */

const CONFIDENCE_THRESHOLD = 90; // 90%以上のみ自動承認
const BATCH_PREFIX = "onhold_reaudit";
const ADMIN_USER_ID = 1; // システム管理者ID

async function main() {
  const limit = parseInt(process.argv[2] || "50", 10);
  console.log(`\n========================================`);
  console.log(`on_hold再審査バッチ開始`);
  console.log(`対象件数上限: ${limit}`);
  console.log(`承認閾値: ${CONFIDENCE_THRESHOLD}%`);
  console.log(`却下: しない（on_holdのまま）`);
  console.log(`========================================\n`);

  // Dynamic imports
  const dbModule = await import("../server/db");
  const { invokeLLM } = await import("../server/_core/llm");
  const { pushMessage: pushMsg } = await import("../server/line");
  const { getDb } = await import("../server/db");

  const db = await getDb();
  if (!db) { console.error("DB接続失敗"); process.exit(1); }

  // STEP 0: on_hold未審査レシートを取得
  // 条件: status='on_hold' AND reviewNote LIKE '%AI%'（AIが保留にしたもの）
  // 人間が既にレビュー済みのものは除外
  const { lineReceipts } = await import("../drizzle/schema");
  const { eq, and, like, isNull, asc, sql: sqlTag } = await import("drizzle-orm");

  const candidates = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      imageUrl: lineReceipts.imageUrl,
      imageUrls: lineReceipts.imageUrls,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      ocrRawText: lineReceipts.ocrRawText,
      ocrConfidence: lineReceipts.ocrConfidence,
      pointsCalculated: lineReceipts.pointsCalculated,
      fraudFlags: lineReceipts.fraudFlags,
      fraudScore: lineReceipts.fraudScore,
      isForceSubmitted: lineReceipts.isForceSubmitted,
      aiRejectionCategory: lineReceipts.aiRejectionCategory,
      reviewNote: lineReceipts.reviewNote,
      submittedAt: lineReceipts.submittedAt,
    })
    .from(lineReceipts)
    .where(
      and(
        eq(lineReceipts.status, "on_hold"),
        // AI判定でon_holdになったもの（人間レビュー済みは除外）
        sqlTag`(${lineReceipts.reviewNote} LIKE '%AI自動%' OR ${lineReceipts.reviewNote} LIKE '%AI弾き%' OR ${lineReceipts.reviewNote} IS NULL)`
      )
    )
    .orderBy(asc(lineReceipts.submittedAt))
    .limit(limit);

  console.log(`対象レシート: ${candidates.length}件\n`);
  if (candidates.length === 0) {
    console.log("対象レシートがありません。終了します。");
    process.exit(0);
  }

  // Generate batch ID
  const batchId = `${BATCH_PREFIX}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`バッチID: ${batchId}\n`);

  // Get learning prompts
  let learningPrompt = "";
  try {
    learningPrompt = await dbModule.buildLearningExamplesPrompt(20); // 20件のfew-shot例
    console.log(`学習プロンプト: ${learningPrompt.length}文字`);
  } catch (e) { console.error("学習プロンプト取得エラー:", e); }

  let statisticsPrompt = "";
  try {
    statisticsPrompt = await dbModule.buildStatisticsLearningPrompt();
    console.log(`統計プロンプト: ${statisticsPrompt.length}文字`);
  } catch (e) { console.error("統計プロンプト取得エラー:", e); }

  const reviewExamples = await dbModule.getRecentReviewExamples(10, 10);

  // Duplicate check
  const orderNumberMap = new Map();
  for (const c of candidates) {
    if (c.ocrRawText) {
      try {
        const ocr = typeof c.ocrRawText === "string" ? JSON.parse(c.ocrRawText) : c.ocrRawText;
        const orderNum = String(ocr?.orderNumber || "").trim();
        if (orderNum && orderNum !== "null") {
          orderNumberMap.set(c.id, orderNum);
        }
      } catch { /* skip */ }
    }
  }
  const allOrderNumbers = Array.from(orderNumberMap.values());
  const dupeMap = await dbModule.batchCheckDuplicateOrderNumbers(allOrderNumbers);

  // Results tracking
  const results = [];
  let approvedCount = 0;
  let heldCount = 0;
  let skippedCount = 0;
  let dupCount = 0;

  const rejectionCategoryLabels = {
    not_order_detail: "注文詳細画面ではない",
    not_tiktok_shop: "TikTok Shop以外",
    not_delivered: "配達未完了",
    blurry_image: "画像不鮮明",
    missing_order_number: "注文番号なし",
    missing_amount: "金額なし",
    partial_screenshot: "スクショ不完全",
    duplicate: "重複申請",
    wrong_store: "対象外店舗",
    suspicious: "不正の疑い",
    incomplete_info: "情報不足",
    other: "その他",
  };

  // Process each candidate
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const orderNumber = orderNumberMap.get(candidate.id);
    let ocrData = {};
    try {
      ocrData = candidate.ocrRawText
        ? (typeof candidate.ocrRawText === "string" ? JSON.parse(candidate.ocrRawText) : candidate.ocrRawText)
        : {};
    } catch { ocrData = {}; }

    console.log(`[${i + 1}/${candidates.length}] レシート #${candidate.id} (${candidate.storeName || "不明"}) ...`);

    // --- Rule: Duplicate order number check ---
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const approvedDupe = dupes.find(d => d.id !== candidate.id && d.status === "approved");
      if (approvedDupe) {
        // 重複は却下せず、on_holdのまま + ログに記録
        console.log(`  → 重複検出（承認済み #${approvedDupe.id}）→ on_holdのまま保留`);
        results.push({
          id: candidate.id,
          action: "held_duplicate",
          reason: `重複注文番号: ${orderNumber} (承認済み #${approvedDupe.id})`,
          confidence: null,
          orderNumber,
          lineUserId: candidate.lineUserId,
          storeName: candidate.storeName,
          imageUrl: candidate.imageUrl,
        });
        dupCount++;
        continue;
      }
    }

    // --- LLM審査 ---
    let aiConfidence = 0;
    let aiReason = "";
    let parsed = {};

    try {
      const allImageUrls = candidate.imageUrls?.length
        ? candidate.imageUrls
        : [candidate.imageUrl];

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

      const imageContents = allImageUrls.map(url => ({
        type: "image_url",
        image_url: { url, detail: "low" },
      }));

      const missingOrderNumber = !ocrData.orderNumber || ocrData.orderNumber === "null";
      const missingAmount = !candidate.totalAmount;
      let missingDataNote = "";
      if (missingOrderNumber) {
        missingDataNote += "\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号（16-19桁の数字）を読み取ってdetectedOrderNumberに設定してください。";
      }
      if (missingAmount) {
        missingDataNote += "\n\n❗ OCRで金額が取得できませんでした。画像から合計金額を読み取ってdetectedAmountに設定してください。";
      }

      imageContents.push({
        type: "text",
        text: `このレシート画像を審査してください。\n\nOCRデータ: ${JSON.stringify({
          orderNumber: ocrData.orderNumber,
          totalAmount: candidate.totalAmount,
          shopName: ocrData.shopName || candidate.storeName,
          isTikTokShop: ocrData.isTikTokShop,
          isDelivered: ocrData.isDelivered,
        })}${missingDataNote}\n\n${exampleContext}`,
      });

      const llmResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはTikTok Shopのレシート審査AIです。レシート画像とOCRデータを見て、承認すべきか判断してください。
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
  "rejectionCategory": "not_order_detail" | "not_tiktok_shop" | "not_delivered" | "blurry_image" | "missing_order_number" | "missing_amount" | "partial_screenshot" | "duplicate" | "wrong_store" | "suspicious" | "incomplete_info" | "other" | null,
  "isTikTokShop": true/false/null,
  "isDelivered": true/false/null,
  "detectedOrderNumber": "string or null",
  "detectedAmount": number or null
}
★ 重要: OCRで注文番号や金額が取得できなかった場合でも、画像から読み取れる場合はそれを基に判定してください。
★ 過去の審査実績では承認率約75%です。基準を満たすレシートは積極的に承認してください。${statisticsPrompt}${learningPrompt}`,
          },
          {
            role: "user",
            content: imageContents,
          },
        ],
      });

      const msgContent = llmResult.choices[0]?.message?.content;
      try {
        let jsonStr = typeof msgContent === "string" ? msgContent : "{}";
        if (jsonStr.includes("```json")) {
          jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        } else if (jsonStr.includes("```")) {
          jsonStr = jsonStr.replace(/```\s*/g, "");
        }
        jsonStr = jsonStr.trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.log(`  → LLM応答解析失敗 → スキップ`);
        results.push({
          id: candidate.id,
          action: "skipped",
          reason: "LLM応答解析失敗",
          confidence: null,
          orderNumber,
          lineUserId: candidate.lineUserId,
          storeName: candidate.storeName,
          imageUrl: candidate.imageUrl,
        });
        skippedCount++;
        continue;
      }

      aiConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      aiReason = parsed.reason || "理由なし";

    } catch (llmErr) {
      console.log(`  → LLMエラー: ${llmErr.message?.substring(0, 80)} → スキップ`);
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: `LLMエラー: ${llmErr.message?.substring(0, 100)}`,
        confidence: null,
        orderNumber,
        lineUserId: candidate.lineUserId,
        storeName: candidate.storeName,
        imageUrl: candidate.imageUrl,
      });
      skippedCount++;
      continue;
    }

    // ===== 判定ロジック =====
    // 高信頼 + shouldApprove=true → 自動承認
    if (parsed.shouldApprove === true && aiConfidence >= CONFIDENCE_THRESHOLD) {
      const pointsToAward = candidate.pointsCalculated ?? 0;
      try {
        // ステータス更新
        await dbModule.updateLineReceiptStatus(candidate.id, "approved", ADMIN_USER_ID,
          `[on_hold再審査] AI自動承認 confidence: ${aiConfidence}% - ${aiReason} (batch: ${batchId})`);

        // ポイント付与
        if (pointsToAward > 0) {
          await dbModule.awardPointsForLineReceipt(candidate.id, pointsToAward);
        }

        // 紹介確認
        try {
          const lineUserRecord = await dbModule.getLineUserByLineId(candidate.lineUserId);
          if (lineUserRecord) {
            await dbModule.confirmPendingReferral(candidate.lineUserId, lineUserRecord.id);
          }
        } catch (refErr) { /* ignore */ }

        // レビューログ
        try {
          await dbModule.createReceiptReviewLog({
            receiptType: "line_receipt",
            receiptId: candidate.id,
            decision: "approved",
            ocrConfidence: candidate.ocrConfidence ?? undefined,
            totalAmount: candidate.totalAmount ?? undefined,
            hasOrderNumber: orderNumber ? "yes" : "no",
            imageCount: candidate.imageUrls?.length ?? 1,
            fraudScore: candidate.fraudScore ?? undefined,
            fraudFlagCount: candidate.fraudFlags?.length ?? 0,
            pointsCalculated: candidate.pointsCalculated ?? undefined,
            pointsAwarded: pointsToAward,
            reviewedBy: ADMIN_USER_ID,
          });
        } catch (logErr) { /* ignore */ }

        // 商品抽出
        try {
          await dbModule.extractSingleReceiptProducts(candidate.id);
        } catch { /* ignore */ }

        // 自動レビュー作成
        try {
          await dbModule.createAutoReviewOnApproval({
            receiptType: "line_receipt",
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            imageUrl: candidate.imageUrl,
            ocrRawText: candidate.ocrRawText,
            storeName: candidate.storeName,
            totalAmount: candidate.totalAmount,
          });
        } catch { /* ignore */ }

        // LINE通知
        try {
          const balance = await dbModule.getLinePointBalance(candidate.lineUserId);
          const newBalance = balance?.balance ?? pointsToAward;
          const storeName = candidate.storeName || "不明";
          const amount = candidate.totalAmount ? `¥${candidate.totalAmount.toLocaleString()}` : "不明";
          const appUrl = process.env.APP_URL || "https://lcjmall.com";
          const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
          await pushMsg(candidate.lineUserId, [{ type: "text", text: message }]);
        } catch { /* ignore */ }

        console.log(`  → ✅ 承認 (${aiConfidence}%) ${aiReason}`);
        results.push({
          id: candidate.id,
          action: "approved",
          reason: aiReason,
          confidence: aiConfidence,
          orderNumber,
          amount: candidate.totalAmount,
          lineUserId: candidate.lineUserId,
          storeName: candidate.storeName,
          imageUrl: candidate.imageUrl,
        });
        approvedCount++;

      } catch (approveErr) {
        console.log(`  → 承認処理エラー: ${approveErr.message?.substring(0, 80)} → スキップ`);
        results.push({
          id: candidate.id,
          action: "skipped",
          reason: `承認処理エラー: ${approveErr.message?.substring(0, 100)}`,
          confidence: aiConfidence,
          orderNumber,
          lineUserId: candidate.lineUserId,
          storeName: candidate.storeName,
          imageUrl: candidate.imageUrl,
        });
        skippedCount++;
      }
    } else {
      // 低信頼 or shouldApprove=false → on_holdのまま（却下しない）
      const reason = parsed.shouldApprove === false
        ? `AI判定: 承認不可 (${aiConfidence}%) - ${aiReason}`
        : `信頼度不足: ${aiConfidence}% < ${CONFIDENCE_THRESHOLD}%`;
      console.log(`  → ⏸️ 保留 (${aiConfidence}%) ${aiReason}`);
      results.push({
        id: candidate.id,
        action: "held",
        reason,
        confidence: aiConfidence,
        orderNumber,
        lineUserId: candidate.lineUserId,
        storeName: candidate.storeName,
        imageUrl: candidate.imageUrl,
      });
      heldCount++;
    }
  }

  // ===== 監査ログ保存 =====
  try {
    const logEntries = results.map(r => {
      let aiComment = "";
      if (r.action === "approved") {
        aiComment = `✅ [on_hold再審査] 承認: ${r.reason} (信頼度: ${r.confidence}%)`;
      } else if (r.action === "held" || r.action === "held_duplicate") {
        aiComment = `⏸️ [on_hold再審査] 保留継続: ${r.reason}${r.confidence ? ` (信頼度: ${r.confidence}%)` : ""}`;
      } else {
        aiComment = `⏭️ [on_hold再審査] スキップ: ${r.reason}`;
      }
      return {
        batchId,
        receiptId: r.id,
        lineUserId: r.lineUserId || null,
        aiDecision: r.action === "approved" ? "approved" : r.action === "held_duplicate" ? "held" : r.action,
        aiConfidence: r.confidence ?? null,
        aiComment,
        aiReason: r.reason,
        orderNumber: r.orderNumber || null,
        totalAmount: r.amount ?? null,
        storeName: r.storeName || null,
        imageUrl: r.imageUrl || null,
        isDryRun: false,
      };
    });
    await dbModule.createAiAutoReviewLogsBatch(logEntries);
    console.log(`\n監査ログ保存完了: ${logEntries.length}件 (batch: ${batchId})`);
  } catch (logErr) {
    console.error("監査ログ保存エラー:", logErr.message);
  }

  // ===== KPIサマリー =====
  console.log(`\n========================================`);
  console.log(`on_hold再審査バッチ完了`);
  console.log(`========================================`);
  console.log(`バッチID: ${batchId}`);
  console.log(`処理件数: ${candidates.length}`);
  console.log(`  ✅ 自動承認: ${approvedCount} (${(approvedCount / candidates.length * 100).toFixed(1)}%)`);
  console.log(`  ⏸️ 保留継続: ${heldCount} (${(heldCount / candidates.length * 100).toFixed(1)}%)`);
  console.log(`  🔄 重複保留: ${dupCount}`);
  console.log(`  ⏭️ スキップ: ${skippedCount}`);
  console.log(`  📉 人間レビュー工数削減: ${approvedCount}件分`);
  console.log(`========================================\n`);

  // Save results to JSON
  const fs = await import("fs");
  const resultPath = `/home/ubuntu/onhold-reaudit-results-${Date.now()}.json`;
  fs.writeFileSync(resultPath, JSON.stringify({ batchId, results, summary: { approvedCount, heldCount, dupCount, skippedCount, total: candidates.length } }, null, 2));
  console.log(`結果JSON: ${resultPath}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
