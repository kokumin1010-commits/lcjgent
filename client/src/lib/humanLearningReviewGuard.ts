export const SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT = "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" as const;

export type HumanLearningActionGuard = {
  requiresLiveConflictCheck: boolean;
  defaultEvidenceKey: null;
  defaultRejectionCategory: null;
};

/**
 * The Pass 2 reason code is historical context, not a current approval verdict.
 * A same-account conflict may only be another pending/on_hold upload of the same
 * physical order. The server rechecks live state under the order-number lock.
 */
export function getHumanLearningActionGuard(reasonCode: unknown): HumanLearningActionGuard {
  return {
    requiresLiveConflictCheck:
      String(reasonCode || "").trim().toUpperCase() === SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT,
    defaultEvidenceKey: null,
    defaultRejectionCategory: null,
  };
}

export function formatHumanLearningReviewError(message: unknown, zh: boolean): string {
  const normalized = String(message || "").trim();
  if (/cross_account_order_number/i.test(normalized) || /其他账户的申报/.test(normalized)) {
    return zh
      ? "实时检查发现其他账户存在相同订单号，不能通过；请先核对订单归属。"
      : "リアルタイム確認で別アカウントの同一注文番号が見つかりました。注文の帰属を確認してください。";
  }
  if (
    /same_account_active_order_number/i.test(normalized)
    || /已通过或已发放积分/.test(normalized)
    || /已通过、已发积分|待处理积分申请|不可安全合并/.test(normalized)
    || /order number approval blocked/i.test(normalized)
  ) {
    return zh
      ? "实时检查发现同一账户还有一条已通过、已发积分或不可安全合并的相同订单记录，不能重复通过。"
      : "リアルタイム確認で同一アカウントに承認済み・ポイント付与済み、または安全に統合できない同一注文記録が見つかりました。重複承認はできません。";
  }
  return normalized || (zh ? "处理失败，请重新读取后再试。" : "処理に失敗しました。再読み込み後にお試しください。");
}
