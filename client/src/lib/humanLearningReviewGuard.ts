export const SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT = "SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT" as const;

export type HumanLearningActionGuard = {
  rejectionOnly: boolean;
  defaultEvidenceKey: "duplicate_conflict" | null;
  defaultRejectionCategory: "duplicate" | null;
};

export function getHumanLearningActionGuard(reasonCode: unknown): HumanLearningActionGuard {
  const normalized = String(reasonCode || "").trim().toUpperCase();
  if (normalized === SAME_ACCOUNT_ACTIVE_ORDER_CONFLICT) {
    return {
      rejectionOnly: true,
      defaultEvidenceKey: "duplicate_conflict",
      defaultRejectionCategory: "duplicate",
    };
  }
  return {
    rejectionOnly: false,
    defaultEvidenceKey: null,
    defaultRejectionCategory: null,
  };
}

export function formatHumanLearningReviewError(message: unknown, zh: boolean): string {
  const normalized = String(message || "").trim();
  if (
    /same_account_active_order_number/i.test(normalized)
    || /same_account_active_order_conflict/i.test(normalized)
    || /order number approval blocked/i.test(normalized)
  ) {
    return zh
      ? "同一账户已有相同订单号，不能通过。请使用“拒绝并学习”处理重复申报。"
      : "同一アカウントに同じ注文番号があるため承認できません。「却下して学習」で重複申告を処理してください。";
  }
  return normalized || (zh ? "处理失败，请重新读取后再试。" : "処理に失敗しました。再読み込み後にお試しください。");
}
