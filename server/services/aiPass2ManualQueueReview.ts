import { and, asc, eq, inArray } from "drizzle-orm";
import { lineReceipts } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  extractReceiptEvidenceWithRetry,
  mergeReceiptEvidence,
  type ReceiptEvidence,
} from "../receiptEvidenceExtraction";
import { approveReceiptFromEvidence } from "../receiptApprovalService";
import { claimReceiptOrderNumber } from "../receiptOrderNumberGuard";
import {
  decidePass2V2Evidence,
  hasPass2HardRisk,
  normalizePass2BatchSize,
  type Pass2BatchSize,
} from "../receiptPass2V2Policy";
import { withPass2GlobalLock } from "../receiptPass2BatchLock";
import { checkLevel3SameImage } from "./duplicateCheckService";

export interface Pass2Config {
  /** Exact receipt IDs fixed by a signed preview token. */
  receiptIds: number[];
  /** Must equal one of the server-approved batch sizes. */
  batchSize: Pass2BatchSize;
  adminUserId: number;
  sendNotifications: boolean;
  dryRun: boolean;
  batchId?: string;
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
  stopped?: boolean;
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
  attempts?: number;
}

type Candidate = {
  id: number;
  lineUserId: string;
  imageUrl: string | null;
  imageUrls: string[] | null;
  storeName: string | null;
  totalAmount: number | null;
  orderNumber: string | null;
  ocrRawText: string | null;
  ocrConfidence: string | null;
  pointsCalculated: number | null;
  pointsAwarded: number | null;
  fraudFlags: string[] | null;
  fraudScore: string | null;
  isForceSubmitted: boolean | null;
  reviewNote: string | null;
  status: "pending" | "approved" | "rejected" | "on_hold";
  submittedAt: Date;
  updatedAt: Date;
};

let _pass2Progress: Pass2Progress | null = null;
let _pass2Running = false;
let _pass2BatchId: string | null = null;
let _pass2StopRequested = false;

function uniqueReceiptIds(ids: number[]): number[] {
  return [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
}

function parseStoredEvidence(candidate: Candidate): Partial<ReceiptEvidence> {
  let raw: Record<string, any> = {};
  try {
    raw = candidate.ocrRawText ? JSON.parse(candidate.ocrRawText) : {};
  } catch {
    raw = {};
  }
  return {
    ...raw,
    orderNumber: candidate.orderNumber || raw.orderNumber || null,
    totalAmount: Number(candidate.totalAmount || raw.totalAmount || 0) || null,
    shopName: candidate.storeName || raw.shopName || null,
    confidence: Number(candidate.ocrConfidence || raw.confidence || 0),
  };
}

function candidateImages(candidate: Candidate): string[] {
  const values = Array.isArray(candidate.imageUrls)
    ? candidate.imageUrls
    : candidate.imageUrl
      ? [candidate.imageUrl]
      : [];
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].slice(0, 5);
}

async function saveEvidence(candidate: Candidate, evidence: ReceiptEvidence) {
  const { updateLineReceiptOcr } = await import("../db");
  const pointsCalculated = evidence.totalAmount
    ? Math.floor(evidence.totalAmount * 0.01)
    : 0;
  await updateLineReceiptOcr(candidate.id, {
    orderNumber: evidence.orderNumber,
    totalAmount: evidence.totalAmount || undefined,
    storeName: evidence.shopName || undefined,
    ocrConfidence: String(evidence.confidence),
    ocrRawText: JSON.stringify(evidence),
    pointsCalculated,
  });
  candidate.orderNumber = evidence.orderNumber;
  candidate.totalAmount = evidence.totalAmount;
  candidate.storeName = evidence.shopName;
  candidate.ocrConfidence = String(evidence.confidence);
  candidate.ocrRawText = JSON.stringify(evidence);
  candidate.pointsCalculated = pointsCalculated;
}

async function notifyRejected(candidate: Candidate, reason: string) {
  try {
    const { pushMessage } = await import("../line");
    const appUrl = process.env.APP_URL || "https://lcjmall.com";
    await pushMessage(candidate.lineUserId, [{
      type: "text",
      text: `❌ レシートが承認されませんでした\n\n理由：${reason}\n\n以下の情報が見える画像を再アップロードしてください。\n① TikTok Shop注文詳細\n② 配達済み状態\n③ 16〜19桁の注文番号\n④ 合計金額（税込）\n\n1枚に収まらない場合は複数枚で送信できます。\n${appUrl}/receipt-upload`,
    }]);
  } catch (error) {
    console.error(`[AI Pass2 V2] Rejection notification failed for #${candidate.id}:`, error);
  }
}

async function rejectCandidate(
  candidate: Candidate,
  config: Pass2Config,
  reasonCode: string,
  rejectionCategory: "not_tiktok" | "not_delivered" | "incomplete" | "other",
  reason: string
) {
  if (!config.dryRun) {
    const {
      updateLineReceiptAiRejection,
      updateLineReceiptStatus,
      createReceiptReviewLog,
    } = await import("../db");
    await updateLineReceiptAiRejection(candidate.id, {
      aiRejectionReason: reason,
      aiRejectionCategory: rejectionCategory,
    });
    await updateLineReceiptStatus(
      candidate.id,
      "rejected",
      config.adminUserId,
      `[AI Pass2 V2] ${reasonCode}: ${reason}`
    );
    try {
      await createReceiptReviewLog({
        receiptType: "line_receipt",
        receiptId: candidate.id,
        decision: "rejected",
        ocrConfidence: candidate.ocrConfidence ?? undefined,
        totalAmount: candidate.totalAmount ?? undefined,
        hasOrderNumber: candidate.orderNumber ? "yes" : "no",
        imageCount: candidateImages(candidate).length,
        fraudScore: candidate.fraudScore ?? undefined,
        fraudFlagCount: candidate.fraudFlags?.length ?? 0,
        pointsCalculated: candidate.pointsCalculated ?? undefined,
        pointsAwarded: 0,
        reviewedBy: config.adminUserId,
      });
    } catch (error) {
      console.error(`[AI Pass2 V2] Rejection audit log failed for #${candidate.id}:`, error);
    }
    if (config.sendNotifications) await notifyRejected(candidate, reason);
  }
}

async function keepManualCandidate(
  candidate: Candidate,
  config: Pass2Config,
  reasonCode: string,
  reason: string
) {
  if (!config.dryRun) {
    const { updateLineReceiptStatus } = await import("../db");
    const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await updateLineReceiptStatus(
      candidate.id,
      "on_hold",
      config.adminUserId,
      `[AI Pass2 V2] ${reasonCode}: ${reason}｜次：管理者が競合証拠を確認｜期限：${deadline}`
    );
  }
}

async function saveBatchAudit(
  batchId: string,
  candidates: Candidate[],
  results: Pass2Result[],
  dryRun: boolean
) {
  if (results.length === 0) return;
  try {
    const { createAiAutoReviewLogsBatch } = await import("../db");
    const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
    const entries = results.map(result => {
      const candidate = candidateById.get(result.receiptId);
      return {
        batchId,
        receiptId: result.receiptId,
        lineUserId: result.lineUserId || null,
        aiDecision: result.action,
        aiConfidence: result.confidence ?? null,
        aiComment: `[Pass2 V2] ${result.reason}`,
        aiReason: result.reason,
        orderNumber: result.orderNumber || null,
        totalAmount: result.totalAmount ?? null,
        storeName: candidate?.storeName || null,
        imageUrl: candidate?.imageUrl || null,
        isDryRun: dryRun,
        aiPass: 2,
        reasonCode: result.reasonCode,
        beforeStatus: "on_hold",
        afterStatus: result.action === "auto_approved"
          ? "approved"
          : result.action === "auto_rejected"
            ? "rejected"
            : "on_hold",
        winnerReceiptId: result.winnerReceiptId || null,
        winnerLineUserId: result.winnerLineUserId || null,
        phashDistance: null,
      };
    });
    for (let index = 0; index < entries.length; index += 50) {
      await createAiAutoReviewLogsBatch(entries.slice(index, index + 50));
    }
  } catch (error) {
    console.error("[AI Pass2 V2] Batch audit write failed:", error);
  }
}

async function loadCandidates(receiptIds: number[]): Promise<Candidate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (receiptIds.length === 0) return [];
  const rows = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      imageUrl: lineReceipts.imageUrl,
      imageUrls: lineReceipts.imageUrls,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      orderNumber: lineReceipts.orderNumber,
      ocrRawText: lineReceipts.ocrRawText,
      ocrConfidence: lineReceipts.ocrConfidence,
      pointsCalculated: lineReceipts.pointsCalculated,
      pointsAwarded: lineReceipts.pointsAwarded,
      fraudFlags: lineReceipts.fraudFlags,
      fraudScore: lineReceipts.fraudScore,
      isForceSubmitted: lineReceipts.isForceSubmitted,
      reviewNote: lineReceipts.reviewNote,
      status: lineReceipts.status,
      submittedAt: lineReceipts.submittedAt,
      updatedAt: lineReceipts.updatedAt,
    })
    .from(lineReceipts)
    .where(and(
      inArray(lineReceipts.id, receiptIds),
      eq(lineReceipts.status, "on_hold")
    ))
    .orderBy(asc(lineReceipts.submittedAt), asc(lineReceipts.id));
  return rows as Candidate[];
}

async function runLockedPass2(config: Pass2Config): Promise<{
  results: Pass2Result[];
  summary: Pass2Progress;
  batchId: string;
}> {
  if (config.dryRun) {
    throw new Error("Use the signed read-only Pass 2 preview endpoint for dry runs");
  }
  const batchSize = normalizePass2BatchSize(config.batchSize);
  const requestedIds = uniqueReceiptIds(config.receiptIds);
  if (requestedIds.length < 1 || requestedIds.length > batchSize) {
    throw new Error("Pass 2 receipt IDs must match the signed batch and not exceed the batch size");
  }

  const batchId = config.batchId || `pass2v2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const candidates = await loadCandidates(requestedIds);
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  const missingIds = requestedIds.filter(id => !candidateIds.has(id));
  const results: Pass2Result[] = missingIds.map(receiptId => ({
    receiptId,
    lineUserId: "",
    action: "skipped",
    reasonCode: "STATE_CHANGED",
    reason: "プレビュー後に状態が変更されたため処理しませんでした。",
  }));
  const progress: Pass2Progress = {
    total: requestedIds.length,
    processed: missingIds.length,
    autoApproved: 0,
    autoRejected: 0,
    keptManual: 0,
    skipped: missingIds.length,
    currentReceiptId: null,
    isComplete: false,
  };
  config.onProgress?.({ ...progress });

  for (const candidate of candidates) {
    if (_pass2StopRequested) {
      progress.stopped = true;
      break;
    }
    progress.currentReceiptId = candidate.id;
    config.onProgress?.({ ...progress });

    try {
      const images = candidateImages(candidate);
      if (images.length === 0) {
        const reason = "画像が存在しない、または破損しているため、注文詳細を再アップロードしてください。";
        await rejectCandidate(candidate, config, "NO_IMAGE", "incomplete", reason);
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "auto_rejected",
          reasonCode: "NO_IMAGE",
          reason,
        });
        progress.autoRejected++;
        progress.processed++;
        config.onProgress?.({ ...progress });
        continue;
      }

      const extraction = await extractReceiptEvidenceWithRetry(images);
      const evidence = mergeReceiptEvidence(
        parseStoredEvidence(candidate),
        extraction.evidence
      );
      const technicalAttemptsExhausted =
        extraction.attempts > 0 &&
        extraction.technicalErrors.length >= extraction.attempts;
      let hardRisk = hasPass2HardRisk(candidate.fraudFlags, candidate.reviewNote);
      if (!hardRisk && images[0]) {
        try {
          const imageCheck = await checkLevel3SameImage(
            candidate.id,
            candidate.lineUserId,
            images[0],
            { skipPhashCompute: false }
          );
          if (imageCheck.isDuplicate) {
            hardRisk = true;
            candidate.reviewNote = `同一画像の硬リスク: ${imageCheck.reason}`;
          }
        } catch (error) {
          console.error(`[AI Pass2 V2] Image risk check failed for #${candidate.id}:`, error);
        }
      }
      const decision = decidePass2V2Evidence({
        imageCount: images.length,
        evidence,
        technicalErrors: extraction.technicalErrors,
        technicalAttemptsExhausted,
        hardRisk,
      });

      if (!config.dryRun && !technicalAttemptsExhausted) {
        await saveEvidence(candidate, evidence);
      }

      if (decision.action === "reject") {
        await rejectCandidate(
          candidate,
          config,
          decision.reasonCode,
          decision.rejectionCategory,
          decision.reason
        );
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "auto_rejected",
          reasonCode: decision.reasonCode,
          reason: decision.reason,
          confidence: evidence.confidence,
          orderNumber: evidence.orderNumber || undefined,
          totalAmount: evidence.totalAmount || undefined,
          attempts: extraction.attempts,
        });
        progress.autoRejected++;
      } else if (decision.action === "manual") {
        await keepManualCandidate(
          candidate,
          config,
          decision.reasonCode,
          decision.reason
        );
        results.push({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          action: "keep_manual",
          reasonCode: decision.reasonCode,
          reason: decision.reason,
          confidence: evidence.confidence,
          orderNumber: evidence.orderNumber || undefined,
          totalAmount: evidence.totalAmount || undefined,
          attempts: extraction.attempts,
        });
        progress.keptManual++;
      } else {
        const claim = await claimReceiptOrderNumber({
          receiptId: candidate.id,
          lineUserId: candidate.lineUserId,
          orderNumber: evidence.orderNumber!,
        });
        if (!claim.decision.allowed) {
          const blocking = claim.decision.blockingClaim;
          const reasonCode = claim.decision.reason === "cross_account_order_number"
            ? "CROSS_ACCOUNT_ORDER_CONFLICT"
            : "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT";
          await keepManualCandidate(candidate, config, reasonCode, claim.message);
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "keep_manual",
            reasonCode,
            reason: claim.message,
            confidence: evidence.confidence,
            orderNumber: evidence.orderNumber || undefined,
            totalAmount: evidence.totalAmount || undefined,
            winnerReceiptId: blocking.id,
            winnerLineUserId: blocking.ownerKey,
            attempts: extraction.attempts,
          });
          progress.keptManual++;
        } else {
          if (!config.dryRun) {
            await approveReceiptFromEvidence({
              receiptId: candidate.id,
              lineUserId: candidate.lineUserId,
              reviewedBy: config.adminUserId,
              reason: `[AI Pass2 V2] ${decision.reason} confidence=${evidence.confidence}%, attempts=${extraction.attempts}`,
              sendNotification: config.sendNotifications,
            });
          }
          results.push({
            receiptId: candidate.id,
            lineUserId: candidate.lineUserId,
            action: "auto_approved",
            reasonCode: decision.reasonCode,
            reason: decision.reason,
            confidence: evidence.confidence,
            orderNumber: evidence.orderNumber || undefined,
            totalAmount: evidence.totalAmount || undefined,
            attempts: extraction.attempts,
          });
          progress.autoApproved++;
        }
      }
    } catch (error: any) {
      console.error(`[AI Pass2 V2] Receipt #${candidate.id} failed:`, error);
      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "skipped",
        reasonCode: "PROCESSING_ERROR",
        reason: `処理エラーのため状態を変更しませんでした: ${String(error?.message || error).slice(0, 120)}`,
        orderNumber: candidate.orderNumber || undefined,
        totalAmount: candidate.totalAmount || undefined,
      });
      progress.skipped++;
    }

    progress.processed++;
    config.onProgress?.({ ...progress });
  }

  const processedIds = new Set(results.map(result => result.receiptId));
  if (progress.stopped) {
    for (const candidate of candidates) {
      if (processedIds.has(candidate.id)) continue;
      results.push({
        receiptId: candidate.id,
        lineUserId: candidate.lineUserId,
        action: "skipped",
        reasonCode: "STOP_REQUESTED",
        reason: "管理者の停止要求により未処理です。",
      });
      progress.skipped++;
    }
  }

  await saveBatchAudit(batchId, candidates, results, config.dryRun);
  progress.isComplete = true;
  progress.currentReceiptId = null;
  config.onProgress?.({ ...progress });
  return { results, summary: progress, batchId };
}

export async function runAiPass2ManualQueueReview(config: Pass2Config) {
  return withPass2GlobalLock(() => runLockedPass2(config));
}

export function getPass2Progress(): {
  progress: Pass2Progress | null;
  isRunning: boolean;
  batchId: string | null;
} {
  return {
    progress: _pass2Progress,
    isRunning: _pass2Running,
    batchId: _pass2BatchId,
  };
}

export function isPass2Running(): boolean {
  return _pass2Running;
}

export function startPass2InBackground(config: Pass2Config): { batchId: string } {
  if (_pass2Running) throw new Error("AI Pass 2 is already running");
  const batchId = config.batchId || `pass2v2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  _pass2Running = true;
  _pass2StopRequested = false;
  _pass2BatchId = batchId;
  _pass2Progress = {
    total: config.receiptIds.length,
    processed: 0,
    autoApproved: 0,
    autoRejected: 0,
    keptManual: 0,
    skipped: 0,
    currentReceiptId: null,
    isComplete: false,
  };

  runAiPass2ManualQueueReview({
    ...config,
    batchId,
    onProgress: progress => {
      _pass2Progress = { ...progress };
      config.onProgress?.(progress);
    },
  })
    .then(result => {
      _pass2Progress = { ...result.summary, isComplete: true };
      _pass2Running = false;
    })
    .catch((error: any) => {
      console.error("[AI Pass2 V2] Background run failed:", error);
      _pass2Progress = {
        ...(_pass2Progress || {
          total: config.receiptIds.length,
          processed: 0,
          autoApproved: 0,
          autoRejected: 0,
          keptManual: 0,
          skipped: 0,
          currentReceiptId: null,
          isComplete: false,
        }),
        currentReceiptId: null,
        isComplete: true,
        error: String(error?.message || error),
      };
      _pass2Running = false;
    });

  return { batchId };
}

export function stopPass2(): void {
  _pass2StopRequested = true;
}
