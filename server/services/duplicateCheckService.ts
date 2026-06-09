/**
 * Duplicate Check Service
 * 
 * Implements multi-level duplicate detection for receipt fraud prevention:
 * 
 * Level 1: Same user + Same order number → auto reject
 *   (Already implemented in existing scheduler)
 * 
 * Level 2: Cross user + Same order number → winner rule (first valid wins)
 *   - First approved/pending receipt wins
 *   - Later submissions from different users → auto reject
 * 
 * Level 3: Same image (perceptual hash) → auto reject
 *   - Uses phash with hamming distance threshold
 *   - Catches re-photographed/slightly edited screenshots
 *   - IMPORTANT: Excludes rejected receipts from comparison to prevent
 *     the "reject loop" where resubmitted receipts match their own
 *     previously rejected versions
 */

import { getDb } from "../db";
import { lineReceipts, imagePerceptualHashes } from "../../drizzle/schema";
import { eq, and, ne, inArray, or, sql, desc, asc } from "drizzle-orm";
import { computePhash, findSimilarImages, storePhash, getPhashForReceipt, PHASH_SIMILARITY_THRESHOLD } from "./imageHashService";

// ============================================================
// Level 2: Cross-user duplicate order number (winner rule)
// ============================================================

export interface Level2Result {
  isDuplicate: boolean;
  reason?: string;
  reasonCode?: string;
  winnerReceiptId?: number;
  winnerLineUserId?: string;
  winnerStatus?: string;
}

/**
 * Check Level 2: Cross-user duplicate order number
 * 
 * Winner rule (approved only):
 * 1. If another user already has an APPROVED receipt with same order → reject
 * 2. Pending/on_hold receipts are NOT considered duplicates (points not yet awarded)
 * 3. Only receipts that have successfully awarded points trigger duplicate rejection
 */
export async function checkLevel2CrossUserDuplicate(
  receiptId: number,
  lineUserId: string,
  orderNumber: string,
  submittedAt: Date | null
): Promise<Level2Result> {
  const db = await getDb();
  if (!db) return { isDuplicate: false };
  
  // Find all receipts with the same order number (from other users)
  // We need to check ocrRawText JSON field for orderNumber
  const allReceipts = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      status: lineReceipts.status,
      submittedAt: lineReceipts.submittedAt,
      ocrRawText: lineReceipts.ocrRawText,
    })
    .from(lineReceipts)
    .where(
      and(
        ne(lineReceipts.id, receiptId),
        ne(lineReceipts.lineUserId, lineUserId), // Different user
        eq(lineReceipts.status, "approved")
      )
    );
  
  // Filter by matching order number in OCR data
  const crossUserDupes: Array<{
    id: number;
    lineUserId: string;
    status: string;
    submittedAt: Date | null;
  }> = [];
  
  for (const r of allReceipts) {
    try {
      const ocr = typeof r.ocrRawText === "string" ? JSON.parse(r.ocrRawText) : r.ocrRawText;
      const orderNum = String(ocr?.orderNumber || "").trim();
      if (orderNum === orderNumber) {
        crossUserDupes.push({
          id: r.id,
          lineUserId: r.lineUserId,
          status: r.status,
          submittedAt: r.submittedAt,
        });
      }
    } catch { /* skip */ }
  }
  
  if (crossUserDupes.length === 0) {
    return { isDuplicate: false };
  }
  
  // Check 1: Is there already an approved receipt from another user?
  const approvedWinner = crossUserDupes.find(d => d.status === "approved");
  if (approvedWinner) {
    return {
      isDuplicate: true,
      reason: `別ユーザーが同一注文番号 ${orderNumber} で既に承認済み (レシート #${approvedWinner.id})`,
      reasonCode: "DUPLICATE_CROSS_USER_ORDER",
      winnerReceiptId: approvedWinner.id,
      winnerLineUserId: approvedWinner.lineUserId,
      winnerStatus: "approved",
    };
  }
  
  // Check 2: First valid wins - compare submission times
  const currentSubmittedAt = submittedAt ? submittedAt.getTime() : Date.now();
  
  const earlierSubmissions = crossUserDupes.filter(d => {
    const dTime = d.submittedAt ? d.submittedAt.getTime() : 0;
    return dTime < currentSubmittedAt;
  });
  
  if (earlierSubmissions.length > 0) {
    // Sort by submission time (earliest first)
    earlierSubmissions.sort((a, b) => {
      const aTime = a.submittedAt ? a.submittedAt.getTime() : 0;
      const bTime = b.submittedAt ? b.submittedAt.getTime() : 0;
      return aTime - bTime;
    });
    
    const firstSubmitter = earlierSubmissions[0];
    return {
      isDuplicate: true,
      reason: `別ユーザーが同一注文番号 ${orderNumber} を先に提出済み (レシート #${firstSubmitter.id}, ${firstSubmitter.status})`,
      reasonCode: "DUPLICATE_CROSS_USER_ORDER",
      winnerReceiptId: firstSubmitter.id,
      winnerLineUserId: firstSubmitter.lineUserId,
      winnerStatus: firstSubmitter.status,
    };
  }
  
  // This receipt was submitted first → it wins
  return { isDuplicate: false };
}

// ============================================================
// Level 3: Same image (perceptual hash)
// ============================================================

export interface Level3Result {
  isDuplicate: boolean;
  reason?: string;
  reasonCode?: string;
  matchedReceiptId?: number;
  matchedLineUserId?: string;
  phashDistance?: number;
  isCrossUser?: boolean;
}

/**
 * Check Level 3: Same image using perceptual hash
 * 
 * Computes phash for the image and compares against all stored hashes.
 * If a similar image is found (hamming distance <= threshold), it's a duplicate.
 * 
 * CRITICAL FIXES (2026-04-16):
 * 1. Rejected receipts are now excluded from comparison at the findSimilarImages level.
 *    This prevents the "reject loop" where a user resubmits a receipt and it matches
 *    their own previously rejected receipt, causing infinite rejections.
 * 2. The old code had a bug: `similar.find(async ...)` was used, but Array.find()
 *    is synchronous and always returns a truthy Promise object for async callbacks.
 *    This has been removed entirely since rejected receipts are now filtered upstream.
 * 3. Threshold lowered from 8 to 5 to reduce false positives on receipt images
 *    (white background + black text produces very similar phashes).
 */
export async function checkLevel3SameImage(
  receiptId: number,
  lineUserId: string,
  imageUrl: string,
  options: {
    threshold?: number;
    skipPhashCompute?: boolean; // If phash already computed and stored
    currentOrderNumber?: string; // 当前收据的订单号（用于比较，可选传入避免重复查询）
  } = {}
): Promise<Level3Result> {
  const threshold = options.threshold ?? PHASH_SIMILARITY_THRESHOLD;
  
  try {
    let targetPhash: string | null = null;
    
    if (options.skipPhashCompute) {
      // Already computed - fetch from DB
      targetPhash = await getPhashForReceipt(receiptId);
    }
    
    if (!targetPhash) {
      // Compute phash
      const hashResult = await computePhash(imageUrl);
      if (!hashResult) {
        return { isDuplicate: false }; // Can't compute hash, skip check
      }
      targetPhash = hashResult.phash;
      
      // Store the hash if not already stored
      const existingHash = await getPhashForReceipt(receiptId);
      if (!existingHash) {
        await storePhash({
          receiptId,
          lineUserId,
          imageUrl,
          imageIndex: 0,
          phash: hashResult.phash,
          imageWidth: hashResult.width,
          imageHeight: hashResult.height,
          fileSize: hashResult.size,
        });
      }
    }
    
    // Find similar images
    // IMPORTANT: findSimilarImages now automatically excludes rejected receipts
    // This is the key fix that prevents the "reject loop"
    const similar = await findSimilarImages(targetPhash, receiptId, threshold, {
      excludeRejectedReceipts: true,
    });
    
    if (similar.length === 0) {
      return { isDuplicate: false };
    }
    
    // Get the best match - no need to check status since rejected are already filtered out
    const bestMatch = similar[0];
    const isCrossUser = bestMatch.lineUserId !== lineUserId;
    
    // ===== NEW RULE (2026-06-09): 订单号不同时不判定为重复 =====
    // 即使图片相似，只要订单号不同就不应该拒绝
    const db = await getDb();
    if (db) {
      // 获取匹配收据的订单号
      const matchedReceipt = await db
        .select({ orderNumber: lineReceipts.orderNumber, ocrRawText: lineReceipts.ocrRawText })
        .from(lineReceipts)
        .where(eq(lineReceipts.id, bestMatch.receiptId))
        .limit(1);
      
      if (matchedReceipt.length > 0) {
        let matchedOrderNumber = matchedReceipt[0].orderNumber || "";
        if (!matchedOrderNumber && matchedReceipt[0].ocrRawText) {
          try {
            const ocr = typeof matchedReceipt[0].ocrRawText === "string" 
              ? JSON.parse(matchedReceipt[0].ocrRawText) : matchedReceipt[0].ocrRawText;
            matchedOrderNumber = String(ocr?.orderNumber || "").trim();
          } catch { /* ignore */ }
        }
        
        // 获取当前收据的订单号
        let currentOrderNum = options.currentOrderNumber || "";
        if (!currentOrderNum) {
          const currentReceipt = await db
            .select({ orderNumber: lineReceipts.orderNumber, ocrRawText: lineReceipts.ocrRawText })
            .from(lineReceipts)
            .where(eq(lineReceipts.id, receiptId))
            .limit(1);
          if (currentReceipt.length > 0) {
            currentOrderNum = currentReceipt[0].orderNumber || "";
            if (!currentOrderNum && currentReceipt[0].ocrRawText) {
              try {
                const ocr = typeof currentReceipt[0].ocrRawText === "string"
                  ? JSON.parse(currentReceipt[0].ocrRawText) : currentReceipt[0].ocrRawText;
                currentOrderNum = String(ocr?.orderNumber || "").trim();
              } catch { /* ignore */ }
            }
          }
        }
        
        // 如果两个收据都有订单号且订单号不同，则不判定为重复
        if (currentOrderNum && matchedOrderNumber && currentOrderNum !== matchedOrderNumber) {
          console.log(`[DuplicateCheck] Level3 match found for receipt #${receiptId} → #${bestMatch.receiptId} (distance: ${bestMatch.distance}), but order numbers differ (${currentOrderNum} vs ${matchedOrderNumber}). NOT marking as duplicate.`);
          return { isDuplicate: false };
        }
      }
    }
    // ===== END NEW RULE =====
    
    console.log(`[DuplicateCheck] Level3 match found for receipt #${receiptId}: matched #${bestMatch.receiptId} (distance: ${bestMatch.distance}, cross-user: ${isCrossUser})`);
    
    return {
      isDuplicate: true,
      reason: `同一画像検出 (phash距離: ${bestMatch.distance}) - レシート #${bestMatch.receiptId}${isCrossUser ? " (別ユーザー)" : " (同一ユーザー)"}`,
      reasonCode: "DUPLICATE_SAME_IMAGE",
      matchedReceiptId: bestMatch.receiptId,
      matchedLineUserId: bestMatch.lineUserId,
      phashDistance: bestMatch.distance,
      isCrossUser,
    };
  } catch (error) {
    console.error(`[DuplicateCheck] Level3 check failed for receipt ${receiptId}:`, error);
    return { isDuplicate: false }; // Fail open - don't reject on error
  }
}

// ============================================================
// Combined duplicate check (all levels)
// ============================================================

export interface DuplicateCheckResult {
  level: 1 | 2 | 3 | null;
  isDuplicate: boolean;
  reason?: string;
  reasonCode?: string;
  details?: any;
}

/**
 * Run all duplicate checks for a receipt
 * Returns the first duplicate found (Level 1 → Level 2 → Level 3)
 * 
 * Note: Level 1 (same user + same order) is already handled in the scheduler.
 * This function handles Level 2 and Level 3.
 */
export async function runDuplicateChecks(params: {
  receiptId: number;
  lineUserId: string;
  orderNumber?: string;
  imageUrl: string;
  submittedAt: Date | null;
  skipLevel2?: boolean;
  skipLevel3?: boolean;
}): Promise<DuplicateCheckResult> {
  // Level 2: Cross-user duplicate order number
  if (!params.skipLevel2 && params.orderNumber) {
    const level2 = await checkLevel2CrossUserDuplicate(
      params.receiptId,
      params.lineUserId,
      params.orderNumber,
      params.submittedAt
    );
    
    if (level2.isDuplicate) {
      return {
        level: 2,
        isDuplicate: true,
        reason: level2.reason,
        reasonCode: level2.reasonCode,
        details: level2,
      };
    }
  }
  
  // Level 3: Same image
  if (!params.skipLevel3) {
    const level3 = await checkLevel3SameImage(
      params.receiptId,
      params.lineUserId,
      params.imageUrl
    );
    
    if (level3.isDuplicate) {
      return {
        level: 3,
        isDuplicate: true,
        reason: level3.reason,
        reasonCode: level3.reasonCode,
        details: level3,
      };
    }
  }
  
  return { level: null, isDuplicate: false };
}
