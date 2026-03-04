/**
 * AI Auto-Approve Scheduler
 * 
 * Server-side autonomous batch processor for AI receipt review.
 * Runs independently of frontend connections - once started via API,
 * it continues processing batches until all pending receipts are done
 * or the admin stops it.
 * 
 * Key design:
 * - Uses DB flag (isRunning) as the control mechanism
 * - Processes one batch at a time with delays between batches
 * - Updates progress in DB so frontend can poll for status
 * - Automatically stops when no more candidates or on error
 */

import { invokeLLM } from "./_core/llm";

// Delay between batches (ms)
const BATCH_DELAY_MS = 3000;
// Check interval when idle (ms) 
const IDLE_CHECK_INTERVAL_MS = 30000;
// Max consecutive errors before auto-stop
const MAX_CONSECUTIVE_ERRORS = 5;
// Timeout for individual operations (ms)
const OPERATION_TIMEOUT_MS = 600000; // 10 minutes (20 receipts × ~15-20s each LLM call)

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

let isProcessing = false;
let shouldStop = false;
let checkIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the AI auto-approve scheduler.
 * Checks DB flag periodically and processes when enabled.
 */
export function startAiAutoApproveScheduler() {
  if (checkIntervalId) {
    console.log("[AI AutoApprove Scheduler] Already running");
    return;
  }

  console.log("[AI AutoApprove Scheduler] Starting scheduler");

  // Check immediately on start if there's a running job to resume
  checkAndProcess().catch((error) => {
    console.error("[AI AutoApprove Scheduler] Error during initial check:", error);
  });

  // Then check periodically
  checkIntervalId = setInterval(() => {
    checkAndProcess().catch((error) => {
      console.error("[AI AutoApprove Scheduler] Error during scheduled check:", error);
    });
  }, IDLE_CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler
 */
export function stopAiAutoApproveScheduler() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  shouldStop = true;
  console.log("[AI AutoApprove Scheduler] Stopped");
}

/**
 * Trigger immediate processing (called when admin enables via API)
 */
export async function triggerAiAutoApprove() {
  if (isProcessing) {
    console.log("[AI AutoApprove Scheduler] Already processing, skipping trigger");
    return;
  }
  // Don't wait - fire and forget
  checkAndProcess().catch((error) => {
    console.error("[AI AutoApprove Scheduler] Error during triggered processing:", error);
  });
}

/**
 * Check DB flag and process if enabled
 */
async function checkAndProcess() {
  if (isProcessing) return;

  try {
    const { getAiAutoApproveSetting } = await import("./db");
    const settings = await getAiAutoApproveSetting();
    
    if (!settings?.isRunning) return;

    isProcessing = true;
    shouldStop = false;
    
    console.log("[AI AutoApprove Scheduler] Starting batch processing loop");
    await processBatchLoop(settings.updatedBy || 1);
    
  } catch (error) {
    console.error("[AI AutoApprove Scheduler] Check error:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Main batch processing loop - continues until stopped or no more candidates
 */
async function processBatchLoop(adminUserId: number) {
  let consecutiveErrors = 0;
  const dbModule = await import("./db");

  while (!shouldStop) {
    try {
      console.log(`[AI AutoApprove Scheduler] Loop iteration start (errors: ${consecutiveErrors})`);
      
      // Re-check if still running (admin might have stopped it)
      const settings = await withTimeout(
        dbModule.getAiAutoApproveSetting(),
        30000,
        "getAiAutoApproveSetting"
      );
      
      if (!settings?.isRunning) {
        console.log("[AI AutoApprove Scheduler] isRunning=false, stopping");
        break;
      }

      const batchSize = settings.batchSize || 20;
      const confidenceThreshold = settings.confidenceThreshold || 70;

      console.log(`[AI AutoApprove Scheduler] Starting batch (size: ${batchSize}, threshold: ${confidenceThreshold})`);
      
      // Process one batch with timeout
      const result = await withTimeout(
        processOneBatch(adminUserId, batchSize, confidenceThreshold),
        OPERATION_TIMEOUT_MS,
        "processOneBatch"
      );
      
      if (!result) {
        // No candidates left
        console.log("[AI AutoApprove Scheduler] No more candidates, stopping");
        await stopRunning("全ての未処理レシートのAI審査が完了しました");
        break;
      }

      consecutiveErrors = 0; // Reset on success

      // Update progress in DB (batch-level summary)
      console.log(`[AI AutoApprove Scheduler] Updating batch progress in DB...`);
      try {
        // Re-read latest settings to avoid overwriting incremental updates
        const latestSettings = await withTimeout(
          dbModule.getAiAutoApproveSetting(),
          30000,
          "getAiAutoApproveSetting for update"
        );
        await withTimeout(
          dbModule.updateAiAutoApproveSetting({
            lastRunAt: new Date(),
            lastRunBatchId: result.batchId,
            totalProcessed: (latestSettings?.totalProcessed || 0) + result.processed,
            totalApproved: (latestSettings?.totalApproved || 0) + result.summary.approved,
            totalRejected: (latestSettings?.totalRejected || 0) + result.summary.rejectedDuplicate + result.summary.rejectedAi,
            totalHeld: (latestSettings?.totalHeld || 0) + result.summary.held,
            totalSkipped: (latestSettings?.totalSkipped || 0) + result.summary.skipped,
            currentBatchNumber: (latestSettings?.currentBatchNumber || 0) + 1,
          }),
          30000,
          "updateAiAutoApproveSetting"
        );
      } catch (updateErr: any) {
        console.error(`[AI AutoApprove Scheduler] Failed to update batch progress:`, updateErr.message);
      }

      console.log(`[AI AutoApprove Scheduler] Batch ${result.batchId} complete: ${JSON.stringify(result.summary)}`);

      if (!result.hasMore) {
        console.log("[AI AutoApprove Scheduler] No more candidates after this batch, stopping");
        await stopRunning("全ての未処理レシートのAI審査が完了しました");
        break;
      }

      // Delay before next batch
      console.log(`[AI AutoApprove Scheduler] Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

    } catch (error: any) {
      consecutiveErrors++;
      console.error(`[AI AutoApprove Scheduler] Batch error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message, error.stack?.substring(0, 300));

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error("[AI AutoApprove Scheduler] Too many consecutive errors, stopping");
        await stopRunning(`エラーが${MAX_CONSECUTIVE_ERRORS}回連続で発生したため停止しました: ${error.message}`);
        break;
      }

      // Wait longer on error
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  console.log("[AI AutoApprove Scheduler] processBatchLoop exited");
}

/**
 * Stop the running state in DB
 */
async function stopRunning(reason: string) {
  try {
    const { updateAiAutoApproveSetting } = await import("./db");
    await updateAiAutoApproveSetting({
      isRunning: false,
      stoppedAt: new Date(),
    });
    console.log(`[AI AutoApprove Scheduler] Stopped: ${reason}`);
  } catch (error) {
    console.error("[AI AutoApprove Scheduler] Failed to update stop state:", error);
  }
}

/**
 * Process one batch of receipts - extracted from the existing adminAiAutoApprove mutation
 */
async function processOneBatch(adminUserId: number, batchSize: number, confidenceThreshold: number) {
  const {
    getAutoApprovalCandidates,
    batchCheckDuplicateOrderNumbers,
    getRecentReviewExamples,
    updateLineReceiptStatus,
    awardPointsForLineReceipt,
    getLinePointBalance,
    confirmPendingReferral,
    getLineUserByLineId,
    createAutoReviewOnApproval,
    createAiAutoReviewLogsBatch,
    buildStatisticsLearningPrompt,
    buildLearningExamplesPrompt,
    createReceiptReviewLog,
    extractSingleReceiptProducts,
  } = await import("./db");
  const { pushMessage: pushMsg } = await import("./line");

  // Generate batch ID
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Results tracking
  const results: {
    id: number;
    action: "approved" | "skipped" | "held" | "rejected_duplicate" | "rejected_ai";
    reason: string;
    confidence?: number;
    orderNumber?: string;
    amount?: number;
    aiComment?: string;
    lineUserId?: string;
    storeName?: string;
    imageUrl?: string;
    // Extended audit fields
    reasonCode?: string;
    beforeStatus?: string;
    afterStatus?: string;
    winnerReceiptId?: number;
    winnerLineUserId?: string;
    phashDistance?: number;
  }[] = [];

  // Rejection threshold
  const REJECTION_THRESHOLD = 50;

  // ===== STEP 0: Get candidates =====
  const candidates = await getAutoApprovalCandidates(batchSize);
  if (candidates.length === 0) {
    return null; // No more candidates
  }

  // ===== STEP 1: Rule Filter =====
  const orderNumberMap = new Map<number, string>();
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

  // Batch duplicate check
  const allOrderNumbers = Array.from(orderNumberMap.values());
  const dupeMap = await batchCheckDuplicateOrderNumbers(allOrderNumbers);

  // Get review examples for LLM context
  const reviewExamples = await getRecentReviewExamples(10, 10);

  // Get comprehensive statistics learning prompt
  let statisticsPrompt = "";
  try {
    statisticsPrompt = await buildStatisticsLearningPrompt();
  } catch (e) {
    console.error("[AI AutoApprove Scheduler] Failed to build statistics prompt:", e);
  }

  // Process each candidate
  for (const candidate of candidates) {
    const orderNumber = orderNumberMap.get(candidate.id);
    let ocrData: any = {};
    try {
      ocrData = candidate.ocrRawText
        ? (typeof candidate.ocrRawText === "string" ? JSON.parse(candidate.ocrRawText) : candidate.ocrRawText)
        : {};
    } catch { ocrData = {}; }

    // --- Rule 1: Duplicate order number check (Level 1: same user + same order) ---
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const otherDupes = dupes.filter(d => d.id !== candidate.id);
      const sameUserApprovedDupe = otherDupes.find(d => d.status === "approved" && d.lineUserId === candidate.lineUserId);
      if (sameUserApprovedDupe) {
        await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
          `[AI自動] Level1: 同一ユーザー重複注文番号: ${orderNumber} (承認済みレシート #${sameUserApprovedDupe.id} と重複)`);
        try {
          await createReceiptReviewLog({
            receiptType: "line_receipt",
            receiptId: candidate.id,
            decision: "rejected",
            rejectionCategory: "duplicate",
            rejectionNote: `AI自動却下(Level1): 同一ユーザー重複注文番号 ${orderNumber}`,
            totalAmount: candidate.totalAmount ?? undefined,
            hasOrderNumber: "yes",
            imageCount: candidate.imageUrls?.length ?? 1,
            fraudScore: candidate.fraudScore ?? undefined,
            fraudFlagCount: candidate.fraudFlags?.length ?? 0,
            pointsCalculated: candidate.pointsCalculated ?? undefined,
            reviewedBy: adminUserId,
          });
        } catch (logErr) {
          console.error("[AI AutoApprove Scheduler] Failed to log Level1 rejection:", logErr);
        }
        results.push({
          id: candidate.id,
          action: "rejected_duplicate",
          reason: `Level1: 同一ユーザー重複注文番号: ${orderNumber} (承認済み #${sameUserApprovedDupe.id})`,
          orderNumber,
          amount: candidate.totalAmount ?? undefined,
          reasonCode: "DUPLICATE_SAME_USER_ORDER",
          beforeStatus: candidate.status,
          afterStatus: "rejected",
          winnerReceiptId: sameUserApprovedDupe.id,
          winnerLineUserId: sameUserApprovedDupe.lineUserId,
        });
        continue;
      }
    }

    // --- Rule 1.5: Level 2 - Cross-user duplicate order number (winner rule) ---
    // Optimized: reuse dupeMap from batchCheckDuplicateOrderNumbers (no extra DB query)
    if (orderNumber) {
      const dupes = dupeMap.get(orderNumber) || [];
      const crossUserDupes = dupes.filter(d => d.id !== candidate.id && d.lineUserId !== candidate.lineUserId && d.lineUserId !== "pointRequest");
      
      if (crossUserDupes.length > 0) {
        // Check 1: Is there already an approved receipt from another user?
        const approvedWinner = crossUserDupes.find(d => d.status === "approved");
        if (approvedWinner) {
          const reason = `別ユーザーが同一注文番号 ${orderNumber} で既に承認済み (レシート #${approvedWinner.id})`;
          await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
            `[AI自動] Level2: ${reason}`);
          try {
            await createReceiptReviewLog({
              receiptType: "line_receipt",
              receiptId: candidate.id,
              decision: "rejected",
              rejectionCategory: "duplicate",
              rejectionNote: `AI自動却下(Level2): ${reason}`,
              totalAmount: candidate.totalAmount ?? undefined,
              hasOrderNumber: "yes",
              imageCount: candidate.imageUrls?.length ?? 1,
              fraudScore: candidate.fraudScore ?? undefined,
              fraudFlagCount: candidate.fraudFlags?.length ?? 0,
              pointsCalculated: candidate.pointsCalculated ?? undefined,
              reviewedBy: adminUserId,
            });
          } catch (logErr) {
            console.error("[AI AutoApprove Scheduler] Failed to log Level2 rejection:", logErr);
          }
          results.push({
            id: candidate.id,
            action: "rejected_duplicate",
            reason: `Level2: ${reason}`,
            orderNumber,
            amount: candidate.totalAmount ?? undefined,
            reasonCode: "DUPLICATE_CROSS_USER_ORDER",
            beforeStatus: candidate.status,
            afterStatus: "rejected",
            winnerReceiptId: approvedWinner.id,
            winnerLineUserId: approvedWinner.lineUserId,
          });
          continue;
        }
        
        // Check 2: Cross-user conflict with time window (5 minutes)
        // Winner = first to be approved. While both are pending/on_hold:
        //   - If submitted within 5 min of each other → both on_hold (KEEP_MANUAL)
        //   - If submitted > 5 min apart → later submitter loses (auto reject)
        const pendingCrossUser = crossUserDupes.find(d => d.status === "pending" || d.status === "on_hold");
        if (pendingCrossUser) {
          const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
          const candidateTime = candidate.submittedAt ? new Date(candidate.submittedAt).getTime() : Date.now();
          const otherTime = pendingCrossUser.submittedAt ? new Date(pendingCrossUser.submittedAt).getTime() : 0;
          const timeDiff = Math.abs(candidateTime - otherTime);
          
          if (timeDiff <= TIME_WINDOW_MS) {
            // Within 5-min window → hold both for manual review
            console.log(`[AI AutoApprove Scheduler] Level2 time-window conflict (${Math.round(timeDiff/1000)}s): receipt #${candidate.id} vs #${pendingCrossUser.id} (order: ${orderNumber}) → KEEP_MANUAL`);
            await updateLineReceiptStatus(candidate.id, "on_hold", adminUserId,
              `[AI自動] Level2: 別ユーザーと同一注文番号 ${orderNumber} が5分以内に提出 (レシート #${pendingCrossUser.id}) → 手動審査`);
            results.push({
              id: candidate.id,
              action: "held" as const,
              reason: `Level2: 別ユーザー同一注文番号 5分以内提出 → KEEP_MANUAL (vs #${pendingCrossUser.id})`,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              reasonCode: "CROSS_USER_TIME_WINDOW",
              beforeStatus: candidate.status,
              afterStatus: "on_hold",
              winnerReceiptId: pendingCrossUser.id,
              winnerLineUserId: pendingCrossUser.lineUserId,
            });
            continue;
          } else if (candidateTime > otherTime) {
            // This receipt was submitted later (outside window) → loser
            const reason = `別ユーザーが同一注文番号 ${orderNumber} を先に提出済み (レシート #${pendingCrossUser.id}, ${pendingCrossUser.status})`;
            await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
              `[AI自動] Level2: ${reason}`);
            try {
              await createReceiptReviewLog({
                receiptType: "line_receipt",
                receiptId: candidate.id,
                decision: "rejected",
                rejectionCategory: "duplicate",
                rejectionNote: `AI自動却下(Level2): ${reason}`,
                totalAmount: candidate.totalAmount ?? undefined,
                hasOrderNumber: "yes",
                imageCount: candidate.imageUrls?.length ?? 1,
                fraudScore: candidate.fraudScore ?? undefined,
                fraudFlagCount: candidate.fraudFlags?.length ?? 0,
                pointsCalculated: candidate.pointsCalculated ?? undefined,
                reviewedBy: adminUserId,
              });
            } catch (logErr) {
              console.error("[AI AutoApprove Scheduler] Failed to log Level2 time-window rejection:", logErr);
            }
            results.push({
              id: candidate.id,
              action: "rejected_duplicate" as const,
              reason: `Level2: ${reason}`,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              reasonCode: "DUPLICATE_CROSS_USER_ORDER",
              beforeStatus: candidate.status,
              afterStatus: "rejected",
              winnerReceiptId: pendingCrossUser.id,
              winnerLineUserId: pendingCrossUser.lineUserId,
            });
            continue;
          }
          // else: this receipt was submitted first → it's the potential winner, continue processing
          console.log(`[AI AutoApprove Scheduler] Level2: receipt #${candidate.id} submitted first for order ${orderNumber}, continuing`);
        }
      }
    }

    // --- Rule 1.7: Level 3 - Same image (perceptual hash) ---
    try {
      const { checkLevel3SameImage } = await import("./services/duplicateCheckService");
      const primaryImageUrl = candidate.imageUrls?.[0] || candidate.imageUrl;
      if (primaryImageUrl) {
        const level3Result = await checkLevel3SameImage(
          candidate.id,
          candidate.lineUserId,
          primaryImageUrl
        );
        if (level3Result.isDuplicate) {
          await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
            `[AI自動] Level3: ${level3Result.reason}`);
          try {
            await createReceiptReviewLog({
              receiptType: "line_receipt",
              receiptId: candidate.id,
              decision: "rejected",
              rejectionCategory: "duplicate",
              rejectionNote: `AI自動却下(Level3): ${level3Result.reason}`,
              totalAmount: candidate.totalAmount ?? undefined,
              hasOrderNumber: orderNumber ? "yes" : "no",
              imageCount: candidate.imageUrls?.length ?? 1,
              fraudScore: candidate.fraudScore ?? undefined,
              fraudFlagCount: candidate.fraudFlags?.length ?? 0,
              pointsCalculated: candidate.pointsCalculated ?? undefined,
              reviewedBy: adminUserId,
            });
          } catch (logErr) {
            console.error("[AI AutoApprove Scheduler] Failed to log Level3 rejection:", logErr);
          }
          results.push({
            id: candidate.id,
            action: "rejected_duplicate",
            reason: `Level3: ${level3Result.reason}`,
            orderNumber,
            amount: candidate.totalAmount ?? undefined,
            reasonCode: "DUPLICATE_SAME_IMAGE",
            beforeStatus: candidate.status,
            afterStatus: "rejected",
            winnerReceiptId: level3Result.matchedReceiptId,
            winnerLineUserId: level3Result.matchedLineUserId,
            phashDistance: level3Result.distance,
          });
          continue;
        }
      }
    } catch (level3Err: any) {
      console.error(`[AI AutoApprove Scheduler] Level3 check error for receipt #${candidate.id}:`, level3Err.message);
    }

    // --- Rule 2: Missing order number → auto reject (ORDER_NUMBER_MISSING) ---
    const missingOrderNumber = !orderNumber;
    const missingAmount = !candidate.totalAmount || candidate.totalAmount <= 0;

    if (missingOrderNumber) {
      await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
        `[AI自動] 注文番号なし: OCRで注文番号を検出できなかったため自動却下`);
      try {
        await createReceiptReviewLog({
          receiptType: "line_receipt",
          receiptId: candidate.id,
          decision: "rejected",
          rejectionCategory: "missing_order_number",
          rejectionNote: `AI自動却下: 注文番号なし (ORDER_NUMBER_MISSING)`,
          totalAmount: candidate.totalAmount ?? undefined,
          hasOrderNumber: "no",
          imageCount: candidate.imageUrls?.length ?? 1,
          fraudScore: candidate.fraudScore ?? undefined,
          fraudFlagCount: candidate.fraudFlags?.length ?? 0,
          pointsCalculated: candidate.pointsCalculated ?? undefined,
          reviewedBy: adminUserId,
        });
      } catch (logErr) {
        console.error("[AI AutoApprove Scheduler] Failed to log ORDER_NUMBER_MISSING rejection:", logErr);
      }
      results.push({
        id: candidate.id,
        action: "rejected_ai" as const,
        reason: `注文番号なし (ORDER_NUMBER_MISSING)`,
        orderNumber: undefined,
        amount: candidate.totalAmount ?? undefined,
        lineUserId: candidate.lineUserId,
        storeName: ocrData?.storeName,
        imageUrl: candidate.imageUrl,
        reasonCode: "ORDER_NUMBER_MISSING",
        beforeStatus: candidate.status,
        afterStatus: "rejected",
      });
      continue;
    }

    // --- Rule 3: Force-submitted receipts → skip ---
    if (candidate.isForceSubmitted) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: "AI弾き→強制申請レシート（人間審査必要）",
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    // --- Rule 4: High fraud flags → skip ---
    const fraudFlagCount = candidate.fraudFlags?.length ?? 0;
    if (fraudFlagCount >= 3) {
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: `不正フラグ${fraudFlagCount}件（人間審査必要）`,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    // ===== STEP 2: LLM Image Judgment =====
    const isTikTok = ocrData.isTikTokShop === true;
    const isDelivered = ocrData.isDelivered === true;

    let aiConfidence = 0;
    let aiReason = "";

    const ocrConf = parseFloat(candidate.ocrConfidence || "0");

    if (isTikTok && isDelivered && orderNumber && (candidate.totalAmount ?? 0) > 0 && ocrConf >= 95) {
      aiConfidence = 92;
      aiReason = "OCRデータ良好(OCR信頼度" + ocrConf + "%): TikTok Shop確認済み + 配達済み + 注文番号あり + 金額あり";
    } else if (isTikTok && isDelivered && orderNumber && (candidate.totalAmount ?? 0) > 0 && ocrConf >= 80) {
      aiConfidence = 80;
      aiReason = "OCRデータ良好だがOCR信頼度が中程度(" + ocrConf + "%) - LLM検証を実施";
    } else {
      // Need LLM to evaluate
      try {
        const allImageUrls: string[] = [];
        if (candidate.imageUrls && Array.isArray(candidate.imageUrls)) {
          allImageUrls.push(...candidate.imageUrls);
        } else if (candidate.imageUrl) {
          allImageUrls.push(candidate.imageUrl);
        }

        if (allImageUrls.length === 0) {
          results.push({
            id: candidate.id,
            action: "skipped",
            reason: "画像なし",
            orderNumber,
            amount: candidate.totalAmount ?? undefined,
          });
          continue;
        }

        // Build LLM prompt
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
          image_url: { url, detail: "low" as const },
        }));

        let missingDataNote = "";
        if (missingOrderNumber) {
          missingDataNote += "\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号（16-19桁の数字）を読み取ってdetectedOrderNumberに設定してください。";
        }
        if (missingAmount) {
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

        // Get learning examples
        let learningPrompt = "";
        try {
          learningPrompt = await buildLearningExamplesPrompt(8);
        } catch (e) { /* ignore */ }

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

        const msgContent = llmResult.choices[0]?.message?.content as string;
        let parsed: any = {};
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
          results.push({
            id: candidate.id,
            action: "skipped",
            reason: "LLM応答解析失敗",
            orderNumber,
            amount: candidate.totalAmount ?? undefined,
          });
          continue;
        }

        aiConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
        aiReason = parsed.reason || "LLM判定";

        // If LLM detected order number or amount that OCR missed
        if (missingOrderNumber && parsed.detectedOrderNumber) {
          const detectedOrder = String(parsed.detectedOrderNumber).trim();
          if (detectedOrder && detectedOrder !== "null" && detectedOrder.length >= 10) {
            orderNumberMap.set(candidate.id, detectedOrder);
            console.log(`[AI AutoApprove Scheduler] LLM detected order number for receipt #${candidate.id}: ${detectedOrder}`);
          }
        }
        if (missingAmount && parsed.detectedAmount && typeof parsed.detectedAmount === "number" && parsed.detectedAmount > 0) {
          console.log(`[AI AutoApprove Scheduler] LLM detected amount for receipt #${candidate.id}: ${parsed.detectedAmount}`);
        }

        // If LLM says don't approve
        if (parsed.shouldApprove === false) {
          if (aiConfidence < REJECTION_THRESHOLD) {
            // Low confidence → AUTO REJECT
            await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
              `[AI自動却下] LLM判定: 承認不可 - ${aiReason} (confidence: ${aiConfidence}%)`);
            try {
              const appUrl = process.env.APP_URL || "https://lcjmall.com";
              const rejectMsg = `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`;
              await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
            } catch (notifyErr) {
              console.error(`[AI AutoApprove Scheduler] LINE rejection notification error:`, notifyErr);
            }
            results.push({
              id: candidate.id,
              action: "rejected_ai",
              reason: `AI却下(${aiConfidence}%): ${aiReason}`,
              confidence: aiConfidence,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              lineUserId: candidate.lineUserId,
              storeName: candidate.storeName ?? undefined,
              imageUrl: candidate.imageUrl ?? undefined,
              reasonCode: "AI_LOW_CONFIDENCE",
              beforeStatus: candidate.status,
              afterStatus: "rejected",
            });
            continue;
          } else {
            // Medium confidence → HOLD
            await updateLineReceiptStatus(candidate.id, "on_hold", adminUserId,
              `[AI自動] LLM判定: 承認不可 - ${aiReason} (confidence: ${aiConfidence}%)`);
            results.push({
              id: candidate.id,
              action: "held",
              reason: `LLM判定: ${aiReason}`,
              confidence: aiConfidence,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              lineUserId: candidate.lineUserId,
              storeName: candidate.storeName ?? undefined,
              imageUrl: candidate.imageUrl ?? undefined,
            });
            continue;
          }
        }
      } catch (llmErr: any) {
        console.error(`[AI AutoApprove Scheduler] LLM error for receipt #${candidate.id}:`, llmErr.message);
        results.push({
          id: candidate.id,
          action: "skipped",
          reason: `LLMエラー: ${llmErr.message?.substring(0, 100)}`,
          orderNumber,
          amount: candidate.totalAmount ?? undefined,
        });
        continue;
      }
    }

    // ===== STEP 3: Confidence Threshold =====
    if (aiConfidence < REJECTION_THRESHOLD) {
      await updateLineReceiptStatus(candidate.id, "rejected", adminUserId,
        `[AI自動却下] 信頼度不足: ${aiConfidence}% < ${REJECTION_THRESHOLD}% - ${aiReason}`);
      try {
        const appUrl = process.env.APP_URL || "https://lcjmall.com";
        const rejectMsg = `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`;
        await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
      } catch (notifyErr) {
        console.error(`[AI AutoApprove Scheduler] LINE rejection notification error:`, notifyErr);
      }
      results.push({
        id: candidate.id,
        action: "rejected_ai",
        reason: `信頼度不足: ${aiConfidence}% < ${REJECTION_THRESHOLD}%`,
        confidence: aiConfidence,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
        lineUserId: candidate.lineUserId,
        storeName: candidate.storeName ?? undefined,
        imageUrl: candidate.imageUrl ?? undefined,
        reasonCode: "AI_LOW_CONFIDENCE",
        beforeStatus: candidate.status,
        afterStatus: "rejected",
      });
      continue;
    } else if (aiConfidence < confidenceThreshold) {
      await updateLineReceiptStatus(candidate.id, "on_hold", adminUserId,
        `[AI自動] 信頼度不足: ${aiConfidence}% < 閾値${confidenceThreshold}% - ${aiReason}`);
      results.push({
        id: candidate.id,
        action: "held",
        reason: `信頼度不足: ${aiConfidence}% < 閾値${confidenceThreshold}%`,
        confidence: aiConfidence,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
        lineUserId: candidate.lineUserId,
        storeName: candidate.storeName ?? undefined,
        imageUrl: candidate.imageUrl ?? undefined,
        reasonCode: "AI_BELOW_THRESHOLD",
        beforeStatus: candidate.status,
        afterStatus: "on_hold",
      });
      continue;
    }

    // ===== STEP 4: Auto-Approve! =====
    const pointsToAward = candidate.pointsCalculated ?? 0;

    try {
      await updateLineReceiptStatus(candidate.id, "approved", adminUserId,
        `[AI自動承認] confidence: ${aiConfidence}% - ${aiReason}`);

      if (pointsToAward > 0) {
        await awardPointsForLineReceipt(candidate.id, pointsToAward);
      }

      // Confirm pending referral
      try {
        const lineUserRecord = await getLineUserByLineId(candidate.lineUserId);
        if (lineUserRecord) {
          const refResult = await confirmPendingReferral(candidate.lineUserId, lineUserRecord.id);
          if (refResult) {
            console.log(`[AI AutoApprove Scheduler] Confirmed referral for LINE user ${lineUserRecord.id}`);
          }
        }
      } catch (refErr: any) {
        console.error(`[AI AutoApprove Scheduler] Referral error:`, refErr.message);
      }

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
          reviewedBy: adminUserId,
        });
      } catch (logErr) {
        console.error("[AI AutoApprove Scheduler] Failed to log approval:", logErr);
      }

      // Extract products
      try {
        await extractSingleReceiptProducts(candidate.id);
      } catch (extractErr) {
        console.error(`[AI AutoApprove Scheduler] Product extraction error:`, extractErr);
      }

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
      } catch (reviewErr) {
        console.error(`[AI AutoApprove Scheduler] Auto-review error:`, reviewErr);
      }

      // Send LINE notification
      try {
        const balance = await getLinePointBalance(candidate.lineUserId);
        const newBalance = balance?.balance ?? pointsToAward;
        const storeName = candidate.storeName || "不明";
        const amount = candidate.totalAmount ? `¥${candidate.totalAmount.toLocaleString()}` : "不明";
        const appUrl = process.env.APP_URL || "https://lcjmall.com";
        const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
        await pushMsg(candidate.lineUserId, [{ type: "text", text: message }]);
      } catch (notifyErr) {
        console.error(`[AI AutoApprove Scheduler] LINE notification error:`, notifyErr);
      }
    } catch (approveErr: any) {
      console.error(`[AI AutoApprove Scheduler] Approval error for receipt #${candidate.id}:`, approveErr.message);
      results.push({
        id: candidate.id,
        action: "skipped",
        reason: `承認処理エラー: ${approveErr.message?.substring(0, 100)}`,
        orderNumber,
        amount: candidate.totalAmount ?? undefined,
      });
      continue;
    }

    results.push({
      id: candidate.id,
      action: "approved",
      reason: aiReason,
      confidence: aiConfidence,
      orderNumber,
      amount: candidate.totalAmount ?? undefined,
      lineUserId: candidate.lineUserId,
      storeName: candidate.storeName ?? undefined,
      imageUrl: candidate.imageUrl ?? undefined,
      reasonCode: "AI_APPROVED",
      beforeStatus: candidate.status,
      afterStatus: "approved",
    });
  }

  // Summary
  const summary = {
    approved: results.filter(r => r.action === "approved").length,
    skipped: results.filter(r => r.action === "skipped").length,
    held: results.filter(r => r.action === "held").length,
    rejectedDuplicate: results.filter(r => r.action === "rejected_duplicate").length,
    rejectedAi: results.filter(r => r.action === "rejected_ai").length,
  };

  console.log(`[AI AutoApprove Scheduler] Batch ${batchId}: Processed ${results.length} receipts: ${JSON.stringify(summary)}`);

  // Save AI review logs
  try {
    const logEntries = results.map(r => {
      const candidate = candidates.find(c => c.id === r.id);
      let aiComment = "";
      if (r.action === "approved") {
        aiComment = `✅ 承認: ${r.reason || "条件を満たしています"}${r.confidence ? ` (信頼度: ${r.confidence}%)` : ""}`;
      } else if (r.action === "rejected_duplicate") {
        aiComment = `❌ 重複却下: ${r.reason || "同一注文番号で既に承認済みのレシートが存在します"}`;
      } else if (r.action === "rejected_ai") {
        aiComment = `🚫 AI却下: ${r.reason || "信頼度が低いため自動却下されました"}${r.confidence ? ` (信頼度: ${r.confidence}%)` : ""}`;
      } else if (r.action === "held") {
        aiComment = `⏸️ 保留: ${r.reason || "信頼度が閾値未満のため人間審査が必要です"}`;
      } else {
        aiComment = `⏭️ スキップ: ${r.reason || "処理条件を満たしていません"}`;
      }
      return {
        batchId,
        receiptId: r.id,
        lineUserId: r.lineUserId || candidate?.lineUserId || null,
        aiDecision: r.action,
        aiConfidence: r.confidence ?? null,
        aiComment,
        aiReason: r.reason,
        orderNumber: r.orderNumber || null,
        totalAmount: r.amount ?? candidate?.totalAmount ?? null,
        storeName: r.storeName || candidate?.storeName || null,
        imageUrl: r.imageUrl || candidate?.imageUrl || null,
        isDryRun: false,
        // Extended audit fields
        aiPass: 1,
        reasonCode: r.reasonCode || null,
        beforeStatus: r.beforeStatus || candidate?.status || null,
        afterStatus: r.afterStatus || null,
        winnerReceiptId: r.winnerReceiptId || null,
        winnerLineUserId: r.winnerLineUserId || null,
        phashDistance: r.phashDistance ?? null,
      };
    });
    await createAiAutoReviewLogsBatch(logEntries);
  } catch (logErr: any) {
    console.error(`[AI AutoApprove Scheduler] Failed to save review logs:`, logErr.message);
  }

  // Check if there are more
  let hasMore = false;
  try {
    const remaining = await getAutoApprovalCandidates(1);
    hasMore = remaining.length > 0;
  } catch { /* ignore */ }

  return {
    processed: results.length,
    results,
    summary,
    batchId,
    hasMore,
  };
}
