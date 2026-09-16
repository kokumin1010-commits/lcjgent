export type ReceiptOrderClaimStatus = "pending" | "approved" | "rejected" | "on_hold";

export type ReceiptOrderClaim = {
  id: number;
  source: "line_receipt" | "point_request";
  ownerKey: string;
  status: ReceiptOrderClaimStatus | string;
  orderNumber?: string;
  totalAmount?: number | null;
  storeName?: string | null;
  matchDistance?: number;
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
      reason:
        | "cross_account_order_number"
        | "same_account_active_order_number"
        | "cross_account_similar_order_number"
        | "same_account_similar_order_number";
      blockingClaim: ReceiptOrderClaim;
    };

export type ReceiptOrderDecisionOptions = {
  /** Admin-only resolution: choose the current evidence-complete receipt as canonical. */
  allowSameAccountUnapproved?: boolean;
};

export type ReceiptOrderSimilarityDecisionOptions = {
  /** Explicit admin-only override after the operator has verified the source image. */
  allowApproximateConflict?: boolean;
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
/**
 * A one-edit OCR variant is generated without guessing which number is canonical.
 * These variants are used only to route ambiguous evidence to review; they are never
 * auto-corrected because two genuine TikTok orders may legitimately be very close.
 */
export function buildReceiptOrderNumberOneEditVariants(orderNumber: string): string[] {
  const normalized = normalizeReceiptOrderNumber(orderNumber);
  if (!normalized) return [];

  const variants = new Set<string>();
  const digits = "0123456789";

  if (normalized.length > 16) {
    for (let index = 0; index < normalized.length; index += 1) {
      variants.add(normalized.slice(0, index) + normalized.slice(index + 1));
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    for (const digit of digits) {
      if (digit === normalized[index]) continue;
      variants.add(normalized.slice(0, index) + digit + normalized.slice(index + 1));
    }
  }

  if (normalized.length < 19) {
    for (let index = 0; index <= normalized.length; index += 1) {
      for (const digit of digits) {
        variants.add(normalized.slice(0, index) + digit + normalized.slice(index));
      }
    }
  }

  variants.delete(normalized);
  return [...variants];
}

/**
 * Every edit-distance-one pair shares at least one lock key: either the shorter
 * exact number or the value formed by removing the differing digit. Sorted lock
 * acquisition prevents two Railway instances from approving OCR variants together.
 */
export function buildReceiptOrderNumberLockKeys(orderNumber: string): string[] {
  const normalized = normalizeReceiptOrderNumber(orderNumber);
  if (!normalized) return [];
  const keys = new Set<string>([normalized]);
  for (let index = 0; index < normalized.length; index += 1) {
    keys.add(normalized.slice(0, index) + normalized.slice(index + 1));
  }
  return [...keys].sort();
}

export function receiptOrderNumberEditDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

export function selectBlockingApproximateOrderClaims(
  claims: ReceiptOrderClaim[],
  currentAmount: number
): ReceiptOrderClaim[] {
  if (!Number.isFinite(currentAmount) || currentAmount <= 0) return [];
  return claims.filter(claim =>
    claim.status !== "rejected"
    && claim.matchDistance === 1
    && Number(claim.totalAmount || 0) === currentAmount
  );
}

export function decideApproximateReceiptOrderSubmission(
  claims: ReceiptOrderClaim[],
  claimantOwnerKeys: Iterable<string>,
  options: ReceiptOrderSimilarityDecisionOptions = {}
): ReceiptOrderDecision | null {
  if (claims.length === 0 || options.allowApproximateConflict) return null;
  const ownerKeys = new Set(claimantOwnerKeys);
  const crossAccountClaim = claims.find(claim => !ownerKeys.has(claim.ownerKey));
  if (crossAccountClaim) {
    return {
      allowed: false,
      reason: "cross_account_similar_order_number",
      blockingClaim: crossAccountClaim,
    };
  }
  return {
    allowed: false,
    reason: "same_account_similar_order_number",
    blockingClaim: claims[0],
  };
}

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

  if (decision.reason === "cross_account_order_number") {
    return `この注文番号は別のアカウントから既に申請されています: ${orderNumber}`;
  }
  if (decision.reason === "cross_account_similar_order_number") {
    return `画像の注文番号と1桁だけ異なる別アカウントの申請があります。OCR誤読の可能性があるため自動承認できません: ${orderNumber}`;
  }
  if (decision.reason === "same_account_similar_order_number") {
    return `画像の注文番号と1桁だけ異なる有効な申請があります。OCR誤読の可能性があるため確認が必要です: ${orderNumber}`;
  }
  return `この注文番号は同じアカウントで既に承認済み、または現在の操作では選択できない状態です: ${orderNumber}`;
}
