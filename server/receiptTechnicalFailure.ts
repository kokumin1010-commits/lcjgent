export const RECEIPT_TECHNICAL_HOLD_CODE = "RECEIPT_TECHNICAL_VALIDATION_ERROR";

export type ReceiptTechnicalFailureState = {
  status?: string | null;
  pointsAwarded?: number | null;
};

export type ReceiptTechnicalFailureTransition =
  | "preserve_approved"
  | "repair_approved"
  | "hold_for_manual_review";

export function receiptTechnicalFailureTransition(
  receipt: ReceiptTechnicalFailureState | null | undefined
): ReceiptTechnicalFailureTransition {
  if (receipt?.status === "approved") return "preserve_approved";
  if (Number(receipt?.pointsAwarded || 0) > 0) return "repair_approved";
  return "hold_for_manual_review";
}

export function receiptTechnicalHoldNote(code = RECEIPT_TECHNICAL_HOLD_CODE): string {
  return `[TECHNICAL_HOLD:${code}] 技术验证异常，订单已保留暂挂；未自动拒绝、未发积分、未发送拒绝通知。请管理员重新审核。`;
}

/**
 * Persist a fail-closed receipt result without converting infrastructure,
 * serialization, or runtime errors into business rejections.
 */
export async function holdReceiptAfterTechnicalFailure(input: {
  receiptId: number;
  reviewedBy?: number;
  errorCode?: string;
}): Promise<ReceiptTechnicalFailureTransition> {
  const {
    getLineReceiptById,
    updateLineReceiptStatus,
  } = await import("./db");

  const receipt = await getLineReceiptById(input.receiptId);
  const transition = receiptTechnicalFailureTransition(receipt);

  if (transition === "preserve_approved") {
    return transition;
  }

  if (transition === "repair_approved") {
    await updateLineReceiptStatus(
      input.receiptId,
      "approved",
      input.reviewedBy ?? 0,
      "[TECHNICAL_STATE_REPAIR] 积分已发放，审批状态已按幂等记录恢复。"
    );
    return transition;
  }

  await updateLineReceiptStatus(
    input.receiptId,
    "on_hold",
    input.reviewedBy ?? 0,
    receiptTechnicalHoldNote(input.errorCode)
  );
  return transition;
}
