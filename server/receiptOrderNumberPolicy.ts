export type ReceiptOrderClaimStatus = "pending" | "approved" | "rejected" | "on_hold";

export type ReceiptOrderClaim = {
  id: number;
  source: "line_receipt" | "point_request";
  ownerKey: string;
  status: ReceiptOrderClaimStatus | string;
};

export type ReceiptOrderDecision =
  | {
      allowed: true;
      reason: "new_order_number" | "same_account_rejected_resubmission";
      blockingClaim: null;
    }
  | {
      allowed: false;
      reason: "cross_account_order_number" | "same_account_active_order_number";
      blockingClaim: ReceiptOrderClaim;
    };

/**
 * TikTok Shop order numbers are normally 16-19 digits. We intentionally do not
 * require a 5/6 prefix because historical valid orders may use other prefixes.
 */
export function normalizeReceiptOrderNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  return /^\d{16,19}$/.test(digits) ? digits : null;
}

/**
 * Submission rule:
 * - Any claim owned by another account blocks, regardless of its status.
 * - The same account may resubmit only when every previous claim was rejected.
 * - pending/on_hold/approved claims owned by the same account still block.
 */
export function decideReceiptOrderSubmission(
  claims: ReceiptOrderClaim[],
  claimantOwnerKeys: Iterable<string>
): ReceiptOrderDecision {
  const ownerKeys = new Set(claimantOwnerKeys);

  const crossAccountClaim = claims.find(claim => !ownerKeys.has(claim.ownerKey));
  if (crossAccountClaim) {
    return {
      allowed: false,
      reason: "cross_account_order_number",
      blockingClaim: crossAccountClaim,
    };
  }

  const sameAccountActiveClaim = claims.find(
    claim => ownerKeys.has(claim.ownerKey) && claim.status !== "rejected"
  );
  if (sameAccountActiveClaim) {
    return {
      allowed: false,
      reason: "same_account_active_order_number",
      blockingClaim: sameAccountActiveClaim,
    };
  }

  if (claims.length > 0) {
    return {
      allowed: true,
      reason: "same_account_rejected_resubmission",
      blockingClaim: null,
    };
  }

  return {
    allowed: true,
    reason: "new_order_number",
    blockingClaim: null,
  };
}

export function receiptOrderDecisionMessage(
  decision: ReceiptOrderDecision,
  orderNumber: string
): string {
  if (decision.allowed) {
    return decision.reason === "same_account_rejected_resubmission"
      ? `同一アカウントの却下済み申請を修正再提出: ${orderNumber}`
      : `新規注文番号: ${orderNumber}`;
  }

  return decision.reason === "cross_account_order_number"
    ? `この注文番号は別のアカウントから既に申請されています: ${orderNumber}`
    : `この注文番号は同じアカウントで審査中または承認済みです: ${orderNumber}`;
}
