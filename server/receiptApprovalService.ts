import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";
import { claimReceiptOrderNumber } from "./receiptOrderNumberGuard";

export type ApproveReceiptFromEvidenceInput = {
  receiptId: number;
  lineUserId: string;
  reason: string;
  reviewedBy?: number;
  sendNotification?: boolean;
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

  const receipt = await getLineReceiptById(input.receiptId);
  if (!receipt) throw new Error("Receipt not found");
  if (receipt.lineUserId !== input.lineUserId) {
    throw new Error("Receipt owner changed before approval");
  }
  if (receipt.status === "approved") {
    return {
      success: true,
      pointsAwarded: Number(receipt.pointsAwarded || 0),
      skipped: true,
    };
  }
  if (!receipt.totalAmount || Number(receipt.totalAmount) <= 0) {
    throw new Error("A positive receipt total is required before approval");
  }

  let raw: Record<string, any> = {};
  try {
    raw = receipt.ocrRawText
      ? typeof receipt.ocrRawText === "string"
        ? JSON.parse(receipt.ocrRawText)
        : receipt.ocrRawText
      : {};
  } catch {
    raw = {};
  }
  const orderNumber = normalizeReceiptOrderNumber(
    receipt.orderNumber || raw.orderNumber
  );
  if (!orderNumber) {
    throw new Error("A valid order number is required before approval");
  }

  const claim = await claimReceiptOrderNumber({
    receiptId: receipt.id,
    lineUserId: receipt.lineUserId,
    orderNumber,
  });
  if (!claim.decision.allowed) {
    throw new Error(`Order number approval blocked: ${claim.decision.reason}`);
  }

  const pointsToAward = Math.floor(Number(receipt.totalAmount) * 0.01);
  if (Number(receipt.pointsCalculated || 0) !== pointsToAward) {
    await updateLineReceiptOcr(receipt.id, { pointsCalculated: pointsToAward });
  }

  // Award first through the existing idempotent guard. If a member restriction or
  // point write fails, the receipt must not be marked approved without points.
  // If the later status update fails, a retry calls the same point guard and does
  // not double-award before repairing the status.
  const awardResult = pointsToAward > 0
    ? await awardPointsForLineReceipt(receipt.id, pointsToAward)
    : { success: true, pointsAwarded: 0, skipped: true };
  await updateLineReceiptStatus(
    receipt.id,
    "approved",
    input.reviewedBy ?? 0,
    input.reason
  );

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
      pointsAwarded: Number(awardResult.pointsAwarded || pointsToAward),
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
    pointsAwarded: Number(awardResult.pointsAwarded || pointsToAward),
    skipped: Boolean(awardResult.skipped),
  };
}
