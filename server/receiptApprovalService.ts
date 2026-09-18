import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";
import {
  claimReceiptOrderNumber,
  type ClaimReceiptOrderNumberResult,
} from "./receiptOrderNumberGuard";

export type ApproveReceiptFromEvidenceInput = {
  receiptId: number;
  lineUserId: string;
  reason: string;
  reviewedBy?: number;
  sendNotification?: boolean;
  pointsOverride?: number;
  /** Explicit admin verification only. Automated callers must never enable this. */
  allowApproximateConflict?: boolean;
  /** Internal only: caller already holds every order-family lock and completed the claim. */
  orderNumberAlreadyClaimed?: boolean;
};

export class ReceiptApprovalConflictError extends Error {
  readonly claim: ClaimReceiptOrderNumberResult;

  constructor(claim: ClaimReceiptOrderNumberResult) {
    super(claim.message);
    this.name = "ReceiptApprovalConflictError";
    this.claim = claim;
  }
}

type ApprovalCoreResult = {
  success: true;
  pointsAwarded: number;
  skipped: boolean;
  receipt: any;
  pointsToAward: number;
};

export async function approveReceiptFromEvidence(
  input: ApproveReceiptFromEvidenceInput
): Promise<{ success: true; pointsAwarded: number; skipped: boolean }> {
  const {
    getLineReceiptById,
    updateLineReceiptOcr,
    updateLineReceiptStatus,
    awardPointsForLineReceipt,
    getLinePointBalance,
    confirmPendingReferral,
    getLineUserByLineId,
    createReceiptReviewLog,
    extractSingleReceiptProducts,
    createAutoReviewOnApproval,
  } = await import("./db");

  const initialReceipt = await getLineReceiptById(input.receiptId);
  if (!initialReceipt) throw new Error("Receipt not found");
  if (initialReceipt.lineUserId !== input.lineUserId) {
    throw new Error("Receipt owner changed before approval");
  }

  let raw: Record<string, any> = {};
  try {
    raw = initialReceipt.ocrRawText
      ? typeof initialReceipt.ocrRawText === "string"
        ? JSON.parse(initialReceipt.ocrRawText)
        : initialReceipt.ocrRawText
      : {};
  } catch {
    raw = {};
  }
  const orderNumber = normalizeReceiptOrderNumber(
    initialReceipt.orderNumber || raw.orderNumber
  );
  if (!orderNumber) {
    throw new Error("A valid order number is required before approval");
  }

  const completeApproval = async (): Promise<ApprovalCoreResult> => {
    const receipt = await getLineReceiptById(input.receiptId);
    if (!receipt) throw new Error("Receipt not found during approval");
    if (receipt.lineUserId !== input.lineUserId) {
      throw new Error("Receipt owner changed during approval");
    }
    if (receipt.status === "approved") {
      return {
        success: true,
        pointsAwarded: Number(receipt.pointsAwarded || 0),
        skipped: true,
        receipt,
        pointsToAward: Number(receipt.pointsAwarded || 0),
      };
    }
    if (!receipt.totalAmount || Number(receipt.totalAmount) <= 0) {
      throw new Error("A positive receipt total is required before approval");
    }

    const pointsToAward = input.pointsOverride !== undefined
      ? Math.max(0, Math.floor(input.pointsOverride))
      : Math.floor(Number(receipt.totalAmount) * 0.01);
    if (Number(receipt.pointsCalculated || 0) !== pointsToAward) {
      await updateLineReceiptOcr(receipt.id, { pointsCalculated: pointsToAward });
    }

    // The idempotent point write and approved status transition both run while the
    // exact/one-edit order-family locks are held. Concurrent OCR variants therefore
    // cannot both reach an approved state or receive points.
    const awardResult = pointsToAward > 0
      ? await awardPointsForLineReceipt(receipt.id, pointsToAward)
      : { success: true, pointsAwarded: 0, skipped: true };
    await updateLineReceiptStatus(
      receipt.id,
      "approved",
      input.reviewedBy ?? 0,
      input.reason
    );

    return {
      success: true,
      pointsAwarded: Number(awardResult.pointsAwarded || pointsToAward),
      skipped: Boolean(awardResult.skipped),
      receipt,
      pointsToAward,
    };
  };

  let coreResult: ApprovalCoreResult | null = null;
  if (input.orderNumberAlreadyClaimed) {
    coreResult = await completeApproval();
  } else {
    const claim = await claimReceiptOrderNumber({
      receiptId: initialReceipt.id,
      lineUserId: initialReceipt.lineUserId,
      orderNumber,
      totalAmount: initialReceipt.totalAmount,
      storeName: initialReceipt.storeName,
      allowApproximateConflict: input.allowApproximateConflict === true,
      onAllowedWhileLocked: async () => {
        coreResult = await completeApproval();
      },
    });
    if (!claim.decision.allowed) {
      throw new ReceiptApprovalConflictError(claim);
    }
  }

  if (!coreResult) throw new Error("Receipt approval did not complete");
  if (coreResult.skipped) {
    return {
      success: true,
      pointsAwarded: coreResult.pointsAwarded,
      skipped: true,
    };
  }

  const receipt = coreResult.receipt;
  const pointsToAward = coreResult.pointsToAward;

  try {
    const lineUser = await getLineUserByLineId(receipt.lineUserId);
    if (lineUser) {
      await confirmPendingReferral(receipt.lineUserId, lineUser.id);
    }
  } catch (error) {
    console.error("[Receipt Evidence Approval] Referral confirmation failed:", error);
  }

  try {
    await createReceiptReviewLog({
      receiptType: "line_receipt",
      receiptId: receipt.id,
      decision: "approved",
      ocrConfidence: receipt.ocrConfidence ?? undefined,
      totalAmount: Number(receipt.totalAmount),
      hasOrderNumber: "yes",
      imageCount: receipt.imageUrls?.length ?? 1,
      fraudScore: receipt.fraudScore ?? undefined,
      fraudFlagCount: receipt.fraudFlags?.length ?? 0,
      pointsCalculated: pointsToAward,
      pointsAwarded: coreResult.pointsAwarded,
      reviewedBy: input.reviewedBy ?? 0,
    });
  } catch (error) {
    console.error("[Receipt Evidence Approval] Review log failed:", error);
  }

  try {
    await extractSingleReceiptProducts(receipt.id);
  } catch (error) {
    console.error("[Receipt Evidence Approval] Product extraction failed:", error);
  }

  try {
    await createAutoReviewOnApproval({
      receiptType: "line_receipt",
      receiptId: receipt.id,
      lineUserId: receipt.lineUserId,
      imageUrl: receipt.imageUrl,
      ocrRawText: receipt.ocrRawText,
      storeName: receipt.storeName,
      totalAmount: receipt.totalAmount,
    });
  } catch (error) {
    console.error("[Receipt Evidence Approval] Auto review creation failed:", error);
  }

  if (input.sendNotification !== false) {
    try {
      const { pushMessage } = await import("./line");
      const balance = await getLinePointBalance(receipt.lineUserId);
      const newBalance = balance?.balance ?? pointsToAward;
      const appUrl = process.env.APP_URL || "https://lcjmall.com";
      const storeName = receipt.storeName || "不明";
      const amount = `¥${Number(receipt.totalAmount).toLocaleString()}`;
      await pushMessage(receipt.lineUserId, [{
        type: "text",
        text: `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`,
      }]);
    } catch (error) {
      console.error("[Receipt Evidence Approval] LINE notification failed:", error);
    }
  }

  return {
    success: true,
    pointsAwarded: coreResult.pointsAwarded,
    skipped: coreResult.skipped,
  };
}
