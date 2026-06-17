/**
 * AI Pass 2: Manual Queue Re-Review
 * 
 * Processes on_hold receipts with 3-way decision logic:
 * 
 * 1. AUTO_REJECT: Level1/2/3 duplicates, ORDER_NUMBER_MISSING
 * 2. AUTO_APPROVE: confidence >= 95% + no duplicates + user approval rate >= 80%
 * 3. KEEP_MANUAL: Everything else stays in manual queue
 * 
 * Key safety features:
 * - aiPass=2 in all logs (distinguishes from Pass 1)
 * - beforeStatus=on_hold for all entries
 * - Idempotent point awards (2-layer check in awardPointsForLineReceipt)
 * - Force-submitted receipts → KEEP_MANUAL (never auto-approve)
 * - DRY RUN mode available for testing
 */

import { invokeLLM } from "../_core/llm";

// ============================================================
// Types
// ============================================================

export interface Pass2Config {
  /** Max receipts to process (0 = all) */
  limit: number;
  /** Confidence threshold for auto-approve (default: 95) */
  approveThreshold: number;
  /** Minimum user approval rate for auto-approve (default: 80) */
  minUserApprovalRate: number;
  /** Admin user ID for status updates */
  adminUserId: number;
  /** If true, don't actually change statuses */
  dryRun: boolean;
  /** Send LINE notifications on approve/reject */
  sendNotifications: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: Pass2Progress) => void;
}

export interface Pass2Progress {
  total: number;
  processed: number;
  autoApproved: number;
  autoRejected: number;
  keptManual: number;
  skipped: number;
  currentReceiptId: number | null;
  isComplete: boolean;
  error?: string;
}

export interface Pass2Result {
  receiptId: number;
  lineUserId: string;
  action: "auto_approved" | "auto_rejected" | "keep_manual" | "skipped";
  reasonCode: string;
  reason: string;
  confidence?: number;
  orderNumber?: string;
  totalAmount?: number;
  winnerReceiptId?: number;
  winnerLineUserId?: string;
  phashDistance?: number;
}

// ============================================================
// Main batch function
// ============================================================

export async function runAiPass2ManualQueueReview(config: Pass2Config): Promise<{
  results: Pass2Result[];
  summary: Pass2Progress;
  batchId: string;
}> {
  const batchId = `pass2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  console.log(`[AI Pass2] Starting batch ${batchId} (dryRun=${config.dryRun}, limit=${config.limit})`);

  // Import DB functions
  const {
    getDb,
  } = await import("../db");
  const { lineReceipts, aiAutoReviewLogs } = await import("../../drizzle/schema");
  const { eq, asc, and, sql, inArray, isNotNull } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ===== STEP 0: Get on_hold receipts =====
  const limitClause = config.limit > 0 ? config.limit : 10000;
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
      pointsAwarded: lineReceipts.pointsAwarded,
      fraudFlags: lineReceipts.fraudFlags,
      fraudScore: lineReceipts.fraudScore,
      isForceSubmitted: lineReceipts.isForceSubmitted,
      status: lineReceipts.status,
      submittedAt: lineReceipts.submittedAt,
    })
    .from(lineReceipts)
    .where(eq(lineReceipts.status, "on_hold"))
    .orderBy(asc(lineReceipts.submittedAt))
    .limit(limitClause);

  console.log(`[AI Pass2] Found ${candidates.length} on_hold receipts`);

  const results: Pass2Result[] = [];
  const progress: Pass2Progress = {
    total: candidates.length,
    processed: 0,
    autoApproved: 0,
    autoRejected: 0,
    keptManual: 0,
    skipped: 0,
    currentReceiptId: null,
    isComplete: false,
  };

  // ===== STEP 1: Pre-compute order number map =====
  const orderNumberMap = new Map<number, string>();
  for (const c of candidates) {
    if (c.ocrRawText) {
      try {
        const ocr = typeof c.ocrRawText === "string" ? JSON.parse(c.ocrRawText) : c.ocrRawText;
        const orderNum = String(ocr?.orderNumber || "").trim();
        if (orderNum && orderNum !== "null" && orderNum !== "") {
          orderNumberMap.set(c.id, orderNum);
        }
      } catch { /* skip */ }
    }
  }
  console.log(`[AI Pass2] Order numbers extracted: ${orderNumberMap.size}/${candidates.length}`);

  // ===== STEP 2: Batch duplicate check =====
  const { batchCheckDuplicateOrderNumbers } = await import("../db");
  const allOrderNumbers = Array.from(new Set(orderNumberMap.values()));
  const dupeMap = await batchCheckDuplicateOrderNumbers(allOrderNumbers);

  // ===== STEP 3: Pre-compute user approval rates =====
  const uniqueUserIds = [...new Set(candidates.map(c => c.lineUserId))];
  const userApprovalRates = new Map<string, number>();
  
  for (const userId of uniqueUserIds) {
    // FIX: Exclude on_hold receipts from denominator to break the catch-22 cycle
    // Previously: rate = approved / ALL receipts (including on_hold)
    // Now: rate = approved / (approved + rejected) — only count decisioned receipts
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        approved: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN 1 ELSE 0 END)`,
        decisioned: sql<number>`SUM(CASE WHEN ${lineReceipts.status} IN ('approved', 'rejected') THEN 1 ELSE 0 END)`,
      })
      .from(lineReceipts)
      .where(eq(lineReceipts.lineUserId, userId));
    
    const decisioned = Number(stats?.decisioned || 0);
    const approved = Number(stats?.approved || 0);
    // Use decisioned (approved + rejected) as denominator instead of total
    // This prevents on_hold receipts from dragging down the rate
    const rate = decisioned > 0 ? Math.round((approved / decisioned) * 100) : 0;
    userApprovalRates.set(userId, rate);
  }
  console.log(`[AI Pass2] User approval rates computed for ${uniqueUserIds.length} users`);

  // ===== STEP 4: Import helper functions =====
  const {
    updateLineReceiptStatus,
    awardPointsForLineReceipt,
    getLinePointBalance,
    confirmPendingReferral,
    getLineUserByLineId,
    createAutoReviewOnApproval,
    createAiAutoReviewLogsBatch,
    createReceiptReviewLog,
    extractSingleReceiptProducts,
    getRecentReviewExamples,
    buildStatisticsLearningPrompt,
    buildLearningExamplesPrompt,
  } = await import("../db");
  const { pushMessage: pushMsg } = await import("../line");
  const { checkLevel3SameImage } = await import("./duplicateCheckService");

  // Get review examples for LLM context (once for all)
  const reviewExamples = await getRecentReviewExamples(10, 10);
  let statisticsPrompt = "";
  try { statisticsPrompt = await buildStatisticsLearningPrompt(); } catch { /* ignore */ }
  let learningPrompt = "";
  try { learningPrompt = await buildLearningExamplesPrompt(30); } catch { /* ignore */ }

  // ===== STEP 5: Process each candidate =====
  for (const candidate of candidates) {
    progress.currentReceiptId = candidate.id;
    
    const orderNumber = orderNumberMap.get(candidate.id);
    let ocrData: any = {};
    try {
      ocrData = candidate.ocrRawText
        ? (typeof candidate.ocrRawText === "string" ? JSON.parse(candidate.ocrRawText) : candidate.ocrRawText)
        : {};
    } catch { ocrData = {}; }

    // ---- CHECK 1: Level 1 - Same user + same order number (approved exists) ----
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const sameUserApproved = dupes.find(d => d.id !== candidate.id && d.status === "approved" && d.lineUserId === candidate.lineUserId);
      if (sameUserApproved) {
        if (!config.dryRun) {
          await updateLineReceiptStatus(candidate.id, "rejected", config.adminUserId,
            `[AI Pass2] Level1: 同一ユーザー重複注文番号: ${orderNumber} (承認済み #${sameUserApproved.id})`);
        }
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "auto_rejected",
          reasonCode: "DUPLICATE_SAME_USER_ORDER",
          reason: `Level1: 同一ユーザー重複注文番号 ${orderNumber} (承認済み #${sameUserApproved.id})`,
          orderNumber,
          totalAmount: candidate.totalAmount ?? undefined,
          winnerReceiptId: sameUserApproved.id,
          winnerLineUserId: sameUserApproved.lineUserId,
        });
        progress.autoRejected++;
        progress.processed++;
        config.onProgress?.(progress);
        continue;
      }
    }

    // ---- CHECK 2: Level 2 - Cross-user duplicate (approved winner exists) ----
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const crossUserApproved = dupes.find(d => 
        d.id !== candidate.id && 
        d.lineUserId !== candidate.lineUserId && 
        d.lineUserId !== "pointRequest" &&
        d.status === "approved"
      );
      if (crossUserApproved) {
        if (!config.dryRun) {
          await updateLineReceiptStatus(candidate.id, "rejected", config.adminUserId,
            `[AI Pass2] Level2: 別ユーザーが同一注文番号 ${orderNumber} で承認済み (レシート #${crossUserApproved.id})`);
        }
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "auto_rejected",
          reasonCode: "DUPLICATE_CROSS_USER_ORDER",
          reason: `Level2: 別ユーザー承認済み ${orderNumber} (#${crossUserApproved.id})`,
          orderNumber,
          totalAmount: candidate.totalAmount ?? undefined,
          winnerReceiptId: crossUserApproved.id,
          winnerLineUserId: crossUserApproved.lineUserId,
        });
        progress.autoRejected++;
        progress.processed++;
        config.onProgress?.(progress);
        continue;
      }

      // Level 2b: Cross-user pending/on_hold - later submitter loses (outside 5-min window)
      const crossUserPending = dupes.find(d =>
        d.id !== candidate.id &&
        d.lineUserId !== candidate.lineUserId &&
        d.lineUserId !== "pointRequest" &&
        (d.status === "pending" || d.status === "on_hold")
      );
      if (crossUserPending) {
        // Both are on_hold → keep both manual (conservative approach for Pass 2)
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "keep_manual",
          reasonCode: "CROSS_USER_CONFLICT_PENDING",
          reason: `Level2: 別ユーザーと同一注文番号 ${orderNumber} で競合中 (#${crossUserPending.id})`,
          orderNumber,
          totalAmount: candidate.totalAmount ?? undefined,
          winnerReceiptId: crossUserPending.id,
          winnerLineUserId: crossUserPending.lineUserId,
        });
        progress.keptManual++;
        progress.processed++;
        config.onProgress?.(progress);
        continue;
      }
    }

    // ---- CHECK 3: Level 3 - Same image (pHash) ----
    try {
      const primaryImageUrl = candidate.imageUrls?.[0] || candidate.imageUrl;
      if (primaryImageUrl) {
        const level3Result = await checkLevel3SameImage(
          candidate.id,
          candidate.lineUserId,
          primaryImageUrl,
          { skipPhashCompute: false }
        );
        if (level3Result.isDuplicate) {
          if (!config.dryRun) {
            await updateLineReceiptStatus(candidate.id, "rejected", config.adminUserId,
              `[AI Pass2] Level3: ${level3Result.reason}`);
          }
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "auto_rejected",
            reasonCode: "DUPLICATE_SAME_IMAGE",
            reason: `Level3: ${level3Result.reason}`,
            orderNumber,
            totalAmount: candidate.totalAmount ?? undefined,
            winnerReceiptId: level3Result.matchedReceiptId,
            winnerLineUserId: level3Result.matchedLineUserId,
            phashDistance: level3Result.phashDistance,
          });
          progress.autoRejected++;
          progress.processed++;
          config.onProgress?.(progress);
          continue;
        }
      }
    } catch (level3Err: any) {
      console.error(`[AI Pass2] Level3 error for #${candidate.id}:`, level3Err.message);
    }

    // ---- CHECK 4: ORDER_NUMBER_MISSING → LLMで読み取り試行（即却下しない） ----
    const missingOrderNumber = !orderNumber;
    if (missingOrderNumber) {
      console.log(`[AI Pass2] Receipt #${candidate.id}: OCRで注文番号未検出 → LLMで画像から読み取りを試行`);
    }

    // ---- CHECK 5: Force-submitted → KEEP_MANUAL (never auto-approve) ----
    if (candidate.isForceSubmitted) {
      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "keep_manual",
        reasonCode: "FORCE_SUBMITTED",
        reason: "強制申請レシート → 手動審査必要",
        orderNumber,
        totalAmount: candidate.totalAmount ?? undefined,
      });
      progress.keptManual++;
      progress.processed++;
      config.onProgress?.(progress);
      continue;
    }

    // ---- CHECK 6: High fraud flags → KEEP_MANUAL ----
    const fraudFlagCount = candidate.fraudFlags?.length ?? 0;
    if (fraudFlagCount >= 3) {
      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "keep_manual",
        reasonCode: "HIGH_FRAUD_FLAGS",
        reason: `不正フラグ${fraudFlagCount}件 → 手動審査必要`,
        orderNumber,
        totalAmount: candidate.totalAmount ?? undefined,
      });
      progress.keptManual++;
      progress.processed++;
      config.onProgress?.(progress);
      continue;
    }

    // ---- STEP 6: LLM Image Judgment ----
    let aiConfidence = 0;
    let aiReason = "";
    let llmParsed: any = {};

    const isTikTok = ocrData.isTikTokShop === true;
    const isDelivered = ocrData.isDelivered === true;
    const ocrConf = parseFloat(candidate.ocrConfidence || "0");

    // Fast path: High OCR confidence with good data
    if (isTikTok && isDelivered && orderNumber && (candidate.totalAmount ?? 0) > 0 && ocrConf >= 95) {
      aiConfidence = 96;
      aiReason = "OCRデータ良好(OCR信頼度" + ocrConf + "%): TikTok Shop確認済み + 配達済み + 注文番号あり + 金額あり";
    } else {
      // Need LLM evaluation
      try {
        const allImageUrls: string[] = [];
        if (candidate.imageUrls && Array.isArray(candidate.imageUrls)) {
          allImageUrls.push(...candidate.imageUrls);
        } else if (candidate.imageUrl) {
          allImageUrls.push(candidate.imageUrl);
        }

        if (allImageUrls.length === 0) {
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "keep_manual",
            reasonCode: "NO_IMAGE",
            reason: "画像なし → 手動審査必要",
            orderNumber,
            totalAmount: candidate.totalAmount ?? undefined,
          });
          progress.keptManual++;
          progress.processed++;
          config.onProgress?.(progress);
          continue;
        }

        const rejectionCategoryLabels: Record<string, string> = {
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
          ...(reviewExamples.rejectionStats || []).map((s: any) =>
            `${rejectionCategoryLabels[s.category || "other"] || s.category}: ${s.count}件`
          ),
          "",
          "=== 過去の承認例 ===",
          ...reviewExamples.approved.map((e: any) =>
            `承認: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`
          ),
          "",
          "=== 過去の却下例（理由付き） ===",
          ...reviewExamples.rejected.map((e: any) => {
            const catLabel = rejectionCategoryLabels[e.rejectionCategory || "other"] || e.rejectionCategory;
            const note = e.rejectionNote ? ` - ${e.rejectionNote}` : "";
            return `却下[理由: ${catLabel}${note}]: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`;
          }),
        ].join("\n");

        const imageContents: any[] = allImageUrls.map(url => ({
          type: "image_url" as const,
          image_url: { url, detail: "high" as const },
        }));

        let missingDataNote = "";
        if (missingOrderNumber) {
          missingDataNote += "\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号（16-19桁の数字）を読み取ってdetectedOrderNumberに設定してください。";
        }
        if (!candidate.totalAmount || candidate.totalAmount <= 0) {
          missingDataNote += "\n\n❗ OCRで金額が取得できませんでした。画像から合計金額を読み取ってdetectedAmountに設定してください。";
        }

        imageContents.push({
          type: "text" as const,
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

=== 重要な注意事項 ===
★ 過去の審査実績では人間審査員の承認率は約85%です。AIが却下したレシートの多くが人間によって承認されています。
★ 「迎えに入れば承認」の姿勢で審査してください。明らかに基準を満たさない場合のみ却下してください。
★ 注文番号がOCRで取れなくても、画像から読み取れる場合は承認可能です。

=== 承認基準（全て満たす必要がある） ===
1. TikTok Shopの「注文詳細」画面のスクリーンショットであること
2. 「配達済み」のステータスが確認できること（「受取確認待ち」「配送完了」「已签收」「已完成」も配達済みとみなす）
3. 注文番号（16-19桁の数字）が読み取れること（OCRで取れなくても画像から読み取れればOK）
4. 合計金額が読み取れること

=== 却下基準（明らかに該当する場合のみ却下） ===
★ 注文詳細画面ではない場合 (rejectionCategory: "not_order_detail")
★ TikTok Shop以外のプラットフォーム (rejectionCategory: "not_tiktok_shop")
★ 配達未完了 (rejectionCategory: "not_delivered")
★ 画像が不鮮明で全く読み取れない (rejectionCategory: "blurry_image")
★ 不正の疑いが強い (rejectionCategory: "suspicious")

=== グレーゾーン判定ガイド（承認側に寤る） ===
- 複数枚のスクショがある場合: 全ての画像を総合的に判断。一部の情報が別の画像にある場合も承認
- 中国語のTikTok Shop: 「抖音商城」「拖音商城」もTikTok Shopとして承認
- 金額が小さい（100円未満等）: 金額の大小では却下しない
- ステータスが「受取確認待ち」: 配達済みとみなす
- 注文番号がOCRで取れなかった場合: 画像から読み取ってdetectedOrderNumberに設定
- 画像が少し不明瞭でも必要情報が読み取れるなら承認

=== 信頼度スコアガイドライン ===
- 90-100: 全ての情報が明確に確認できる
- 80-89: ほぼ確認できるが一部不明瞭な点がある（承認可能）
- 60-79: 判断が難しいが承認の可能性が高い
- 40-59: 判断が難しい、人間の確認が必要
- 0-39: 明らかに基準を満たしていない

${statisticsPrompt}${learningPrompt}`,
            },
            {
              role: "user",
              content: imageContents,
            },
          ],
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: "receipt_review",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  shouldApprove: { type: "boolean", description: "承認すべきか" },
                  confidence: { type: "number", description: "信頼度 0-100" },
                  reason: { type: "string", description: "判断理由" },
                  rejectionCategory: { type: ["string", "null"], description: "却下カテゴリ" },
                  isTikTokShop: { type: ["boolean", "null"], description: "TikTok Shopか" },
                  isDelivered: { type: ["boolean", "null"], description: "配達済みか" },
                  detectedOrderNumber: { type: ["string", "null"], description: "検出した注文番号" },
                  detectedAmount: { type: ["number", "null"], description: "検出した金額" },
                },
                required: ["shouldApprove", "confidence", "reason", "rejectionCategory", "isTikTokShop", "isDelivered", "detectedOrderNumber", "detectedAmount"],
                additionalProperties: false,
              },
            },
          },
        });

        const msgContent = llmResult.choices[0]?.message?.content as string;
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
            llmParsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "skipped",
            reasonCode: "LLM_PARSE_ERROR",
            reason: "LLM応答解析失敗",
            orderNumber,
            totalAmount: candidate.totalAmount ?? undefined,
          });
          progress.skipped++;
          progress.processed++;
          config.onProgress?.(progress);
          continue;
        }

        aiConfidence = typeof llmParsed.confidence === "number" ? llmParsed.confidence : 0;
        aiReason = llmParsed.reason || "LLM判定";

        // LLMが注文番号を検出した場合、DBに保存して重複チェック
        if (missingOrderNumber && llmParsed.detectedOrderNumber) {
          const detectedOrder = String(llmParsed.detectedOrderNumber).trim();
          if (detectedOrder && detectedOrder !== "null" && detectedOrder.length >= 10) {
            orderNumberMap.set(candidate.id, detectedOrder);
            console.log(`[AI Pass2] LLM detected order number for receipt #${candidate.id}: ${detectedOrder}`);
            // DBにも注文番号を保存（ocrRawTextを更新）
            try {
              const updatedOcr = { ...ocrData, orderNumber: detectedOrder };
              await db.update(lineReceipts).set({ ocrRawText: JSON.stringify(updatedOcr) }).where(eq(lineReceipts.id, candidate.id));
              console.log(`[AI Pass2] Saved LLM-detected order number to DB for receipt #${candidate.id}`);
            } catch (dbErr: any) {
              console.error(`[AI Pass2] Failed to save detected order number:`, dbErr.message);
            }
            // LLMで検出した注文番号で重複チェック
            const dupeCheck = await batchCheckDuplicateOrderNumbers([detectedOrder]);
            const dupeList = dupeCheck.get(detectedOrder) || [];
            const sameUserDupe = dupeList.find(d => d.id !== candidate.id && d.status === "approved" && d.lineUserId === candidate.lineUserId);
            if (sameUserDupe) {
              if (!config.dryRun) {
                await updateLineReceiptStatus(candidate.id, "rejected", config.adminUserId,
                  `[AI Pass2] LLM検出注文番号重複: ${detectedOrder} (承認済みレシート #${sameUserDupe.id})`);
              }
              results.push({
                receiptId: candidate.id,
                lineUserId: candidate.lineUserId,
                action: "auto_rejected",
                reasonCode: "DUPLICATE_SAME_USER_ORDER",
                reason: `LLM検出注文番号重複: ${detectedOrder}`,
                orderNumber: detectedOrder,
                totalAmount: candidate.totalAmount ?? undefined,
                winnerReceiptId: sameUserDupe.id,
                winnerLineUserId: sameUserDupe.lineUserId,
              });
              progress.autoRejected++;
              progress.processed++;
              config.onProgress?.(progress);
              continue;
            }
          }
        }

        // LLMが金額を検出した場合、DBに保存 + メモリ上のcandidateも更新
        if ((!candidate.totalAmount || candidate.totalAmount <= 0) && llmParsed.detectedAmount && typeof llmParsed.detectedAmount === "number" && llmParsed.detectedAmount > 0) {
          const detectedPoints = Math.floor(llmParsed.detectedAmount * 0.01);
          try {
            await db.update(lineReceipts).set({ 
              totalAmount: llmParsed.detectedAmount,
              pointsCalculated: detectedPoints,
            }).where(eq(lineReceipts.id, candidate.id));
            // CRITICAL: メモリ上のcandidateも更新（これがないとポイント付与が0ptになる）
            (candidate as any).totalAmount = llmParsed.detectedAmount;
            (candidate as any).pointsCalculated = detectedPoints;
            console.log(`[AI Pass2] Saved LLM-detected amount to DB for receipt #${candidate.id}: ¥${llmParsed.detectedAmount} → ${detectedPoints}pt`);
          } catch (dbErr: any) {
            console.error(`[AI Pass2] Failed to save detected amount:`, dbErr.message);
          }
        }

      } catch (llmErr: any) {
        console.error(`[AI Pass2] LLM error for #${candidate.id}:`, llmErr.message);
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "skipped",
          reasonCode: "LLM_ERROR",
          reason: `LLMエラー: ${llmErr.message?.substring(0, 100)}`,
          orderNumber,
          totalAmount: candidate.totalAmount ?? undefined,
        });
        progress.skipped++;
        progress.processed++;
        config.onProgress?.(progress);
        continue;
      }
    }

    // ---- DECISION: 3-way split ----
    const userApprovalRate = userApprovalRates.get(candidate.lineUserId) || 0;
    const shouldAutoApprove = 
      llmParsed.shouldApprove !== false &&
      aiConfidence >= config.approveThreshold &&
      userApprovalRate >= config.minUserApprovalRate;

    const shouldAutoReject = 
      llmParsed.shouldApprove === false && 
      aiConfidence <= 40; // Very low confidence → safe to reject

    if (shouldAutoApprove) {
      // === AUTO_APPROVE ===
      const pointsToAward = candidate.pointsCalculated ?? 0;

      if (!config.dryRun) {
        try {
          await updateLineReceiptStatus(candidate.id, "approved", config.adminUserId,
            `[AI Pass2] 自動承認: confidence=${aiConfidence}%, userApprovalRate=${userApprovalRate}% - ${aiReason}`);

          if (pointsToAward > 0) {
            await awardPointsForLineReceipt(candidate.id, pointsToAward);
          }

          // Confirm pending referral
          try {
            const lineUserRecord = await getLineUserByLineId(candidate.lineUserId);
            if (lineUserRecord) {
              await confirmPendingReferral(candidate.lineUserId, lineUserRecord.id);
            }
          } catch { /* ignore */ }

          // Record review log
          try {
            await createReceiptReviewLog({
              receiptType: "line_receipt",
              receiptId: candidate.id,
              decision: "approved",
              ocrConfidence: candidate.ocrConfidence ?? undefined,
              totalAmount: candidate.totalAmount ?? undefined,
              hasOrderNumber: "yes",
              imageCount: candidate.imageUrls?.length ?? 1,
              fraudScore: candidate.fraudScore ?? undefined,
              fraudFlagCount: candidate.fraudFlags?.length ?? 0,
              pointsCalculated: candidate.pointsCalculated ?? undefined,
              pointsAwarded: pointsToAward,
              reviewedBy: config.adminUserId,
            });
          } catch { /* ignore */ }

          // Extract products
          try { await extractSingleReceiptProducts(candidate.id); } catch { /* ignore */ }

          // Auto-create review
          try {
            await createAutoReviewOnApproval({
              receiptType: "line_receipt",
              receiptId: candidate.id,
              lineUserId: candidate.lineUserId,
              imageUrl: candidate.imageUrl,
              ocrRawText: candidate.ocrRawText,
              storeName: candidate.storeName,
              totalAmount: candidate.totalAmount,
            });
          } catch { /* ignore */ }

          // Send LINE notification
          if (config.sendNotifications) {
            try {
              const balance = await getLinePointBalance(candidate.lineUserId);
              const newBalance = balance?.balance ?? pointsToAward;
              const storeName = candidate.storeName || "不明";
              const amount = candidate.totalAmount ? `¥${candidate.totalAmount.toLocaleString()}` : "不明";
              const appUrl = process.env.APP_URL || "https://lcjmall.com";
              const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
              await pushMsg(candidate.lineUserId, [{ type: "text", text: message }]);
            } catch { /* ignore */ }
          }
        } catch (approveErr: any) {
          console.error(`[AI Pass2] Approve error for #${candidate.id}:`, approveErr.message);
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "skipped",
            reasonCode: "APPROVE_ERROR",
            reason: `承認処理エラー: ${approveErr.message?.substring(0, 100)}`,
            orderNumber,
            totalAmount: candidate.totalAmount ?? undefined,
          });
          progress.skipped++;
          progress.processed++;
          config.onProgress?.(progress);
          continue;
        }
      }

      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "auto_approved",
        reasonCode: "AI_PASS2_APPROVED",
        reason: `Pass2承認: confidence=${aiConfidence}%, userRate=${userApprovalRate}% - ${aiReason}`,
        confidence: aiConfidence,
        orderNumber,
        totalAmount: candidate.totalAmount ?? undefined,
      });
      progress.autoApproved++;

    } else if (shouldAutoReject) {
      // === AUTO_REJECT (very low confidence) ===
      if (!config.dryRun) {
        await updateLineReceiptStatus(candidate.id, "rejected", config.adminUserId,
          `[AI Pass2] AI却下: confidence=${aiConfidence}% - ${aiReason}`);
        
        if (config.sendNotifications) {
          try {
            const appUrl = process.env.APP_URL || "https://lcjmall.com";
            const rejectMsg = `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`;
            await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
          } catch { /* ignore */ }
        }
      }

      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "auto_rejected",
        reasonCode: "AI_LOW_CONFIDENCE",
        reason: `AI却下: confidence=${aiConfidence}% - ${aiReason}`,
        confidence: aiConfidence,
        orderNumber,
        totalAmount: candidate.totalAmount ?? undefined,
      });
      progress.autoRejected++;

    } else {
      // === KEEP_MANUAL ===
      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "keep_manual",
        reasonCode: aiConfidence >= config.approveThreshold ? "USER_RATE_LOW" : "AI_MEDIUM_CONFIDENCE",
        reason: `手動審査継続: confidence=${aiConfidence}%, userRate=${userApprovalRate}% - ${aiReason}`,
        confidence: aiConfidence,
        orderNumber,
        totalAmount: candidate.totalAmount ?? undefined,
      });
      progress.keptManual++;
    }

    progress.processed++;
    config.onProgress?.(progress);

    // Small delay between LLM calls to avoid rate limiting
    if (aiConfidence > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // ===== STEP 7: Save AI review logs =====
  try {
    const logEntries = results.map(r => {
      let aiComment = "";
      if (r.action === "auto_approved") {
        aiComment = `✅ Pass2承認: ${r.reason}`;
      } else if (r.action === "auto_rejected") {
        aiComment = `❌ Pass2却下: ${r.reason}`;
      } else if (r.action === "keep_manual") {
        aiComment = `⏸️ Pass2保留: ${r.reason}`;
      } else {
        aiComment = `⏭️ Pass2スキップ: ${r.reason}`;
      }

      return {
        batchId,
        receiptId: r.receiptId,
        lineUserId: r.lineUserId || null,
        aiDecision: r.action,
        aiConfidence: r.confidence ?? null,
        aiComment,
        aiReason: r.reason,
        orderNumber: r.orderNumber || null,
        totalAmount: r.totalAmount ?? null,
        storeName: candidates.find(c => c.id === r.receiptId)?.storeName || null,
        imageUrl: candidates.find(c => c.id === r.receiptId)?.imageUrl || null,
        isDryRun: config.dryRun,
        // Extended audit fields
        aiPass: 2,
        reasonCode: r.reasonCode || null,
        beforeStatus: "on_hold",
        afterStatus: r.action === "auto_approved" ? "approved" 
                   : r.action === "auto_rejected" ? "rejected" 
                   : "on_hold",
        winnerReceiptId: r.winnerReceiptId || null,
        winnerLineUserId: r.winnerLineUserId || null,
        phashDistance: r.phashDistance ?? null,
      };
    });

    if (logEntries.length > 0) {
      // Insert in batches of 50 to avoid query size limits
      for (let i = 0; i < logEntries.length; i += 50) {
        const batch = logEntries.slice(i, i + 50);
        await createAiAutoReviewLogsBatch(batch);
      }
      console.log(`[AI Pass2] Saved ${logEntries.length} log entries`);
    }
  } catch (logErr: any) {
    console.error(`[AI Pass2] Failed to save review logs:`, logErr.message);
  }

  // ===== STEP 8: Final summary =====
  progress.isComplete = true;
  progress.currentReceiptId = null;
  config.onProgress?.(progress);

  console.log(`[AI Pass2] Batch ${batchId} complete:`, {
    total: progress.total,
    autoApproved: progress.autoApproved,
    autoRejected: progress.autoRejected,
    keptManual: progress.keptManual,
    skipped: progress.skipped,
    dryRun: config.dryRun,
  });

  return {
    results,
    summary: progress,
    batchId,
  };
}


// ============================================================
// In-memory progress tracking for UI polling
// ============================================================

let _pass2Progress: Pass2Progress | null = null;
let _pass2Running = false;
let _pass2BatchId: string | null = null;

export function getPass2Progress(): { progress: Pass2Progress | null; isRunning: boolean; batchId: string | null } {
  return { progress: _pass2Progress, isRunning: _pass2Running, batchId: _pass2BatchId };
}

export function isPass2Running(): boolean {
  return _pass2Running;
}

/**
 * Start Pass2 in background (non-blocking).
 * Returns immediately with batchId; poll getPass2Progress() for updates.
 */
export function startPass2InBackground(config: Pass2Config): { batchId: string } {
  if (_pass2Running) {
    throw new Error("AI Pass 2 is already running");
  }

  const tempBatchId = `pass2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  _pass2Running = true;
  _pass2BatchId = tempBatchId;
  _pass2Progress = {
    total: 0,
    processed: 0,
    autoApproved: 0,
    autoRejected: 0,
    keptManual: 0,
    skipped: 0,
    currentReceiptId: null,
    isComplete: false,
  };

  // Run in background
  runAiPass2ManualQueueReview({
    ...config,
    onProgress: (p) => {
      _pass2Progress = { ...p };
    },
  })
    .then((result) => {
      _pass2BatchId = result.batchId;
      _pass2Progress = { ...result.summary, isComplete: true };
      _pass2Running = false;
    })
    .catch((err) => {
      console.error("[AI Pass2] Background run failed:", err);
      if (_pass2Progress) {
        _pass2Progress = { ..._pass2Progress, isComplete: true, error: err.message };
      }
      _pass2Running = false;
    });

  return { batchId: tempBatchId };
}

export function stopPass2(): void {
  // Currently we can't abort mid-run, but we mark it as not running
  // so the UI knows to stop polling
  _pass2Running = false;
}
