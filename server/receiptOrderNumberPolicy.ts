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
      reason:
        | "new_order_number"
        | "same_account_rejected_resubmission"
        | "same_account_unapproved_canonical_selection";
      blockingClaim: null;
    }
  | {
      allowed: false;
      reason: "cross_account_order_number" | "same_account_active_order_number";
      blockingClaim: ReceiptOrderClaim;
    };

export type ReceiptOrderDecisionOptions = {
  /** Admin-only resolution: choose the current evidence-complete receipt as canonical. */
  allowSameAccountUnapproved?: boolean;
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
 * - By default, pending/on_hold/approved claims owned by the same account block.
 * - The explicit admin resolution mode may select the current receipt when every
 *   same-account line-receipt claim is still pending/on_hold; approved, unknown,
 *   or pending point-request states always block so points can never be awarded twice.
 */
export function decideReceiptOrderSubmission(
  claims: ReceiptOrderClaim[],
  claimantOwnerKeys: Iterable<string>,
  options: ReceiptOrderDecisionOptions = {}
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

  const sameAccountHardBlock = claims.find(claim => {
    if (!ownerKeys.has(claim.ownerKey) || claim.status === "rejected") return false;
    if (claim.status !== "pending" && claim.status !== "on_hold") return true;
    return options.allowSameAccountUnapproved === true && claim.source !== "line_receipt";
  });
  if (sameAccountHardBlock) {
    return {
      allowed: false,
      reason: "same_account_active_order_number",
      blockingClaim: sameAccountHardBlock,
    };
  }

  const sameAccountUnapproved = claims.find(
    claim => ownerKeys.has(claim.ownerKey)
      && claim.source === "line_receipt"
      && (claim.status === "pending" || claim.status === "on_hold")
  );
  if (sameAccountUnapproved) {
    if (options.allowSameAccountUnapproved) {
      return {
        allowed: true,
        reason: "same_account_unapproved_canonical_selection",
        blockingClaim: null,
      };
    }
    return {
      allowed: false,
      reason: "same_account_active_order_number",
      blockingClaim: sameAccountUnapproved,
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
    if (decision.reason === "same_account_rejected_resubmission") {
      return `同一アカウントの却下済み申請を修正再提出: ${orderNumber}`;
    }
    if (decision.reason === "same_account_unapproved_canonical_selection") {
      return `同一アカウントの未承認申請から現在のレシートを有効記録として選択: ${orderNumber}`;
    }
    return `新規注文番号: ${orderNumber}`;
  }

  return decision.reason === "cross_account_order_number"
    ? `この注文番号は別のアカウントから既に申請されています: ${orderNumber}`
    : `この注文番号は同じアカウントで既に承認済み、または現在の操作では選択できない状態です: ${orderNumber}`;
}
