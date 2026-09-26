export const BRAND_LIVE_APPROVAL_STATUSES = [
  "draft",
  "pending_approval",
  "changes_requested",
  "approved",
  "scheduled",
  "cancelled",
] as const;

export type BrandLiveApprovalStatus = typeof BRAND_LIVE_APPROVAL_STATUSES[number];

export const BRAND_LIVE_APPROVAL_STATUS_LABELS: Record<BrandLiveApprovalStatus, { ja: string; zh: string }> = {
  draft: { ja: "下書き", zh: "草稿" },
  pending_approval: { ja: "KG確認待ち", zh: "等待KG确认" },
  changes_requested: { ja: "再交渉が必要", zh: "需要重新洽谈" },
  approved: { ja: "KG承認済み", zh: "KG已确认" },
  scheduled: { ja: "配信予定に反映済み", zh: "已进入排班" },
  cancelled: { ja: "取消", zh: "已取消" },
};

export const ASSISTANT_ONSITE_VALUES = ["yes", "no", "tbd"] as const;
export type AssistantOnsiteValue = typeof ASSISTANT_ONSITE_VALUES[number];

export const ASSISTANT_ONSITE_LABELS: Record<AssistantOnsiteValue, { ja: string; zh: string }> = {
  yes: { ja: "助播あり・現場参加", zh: "有助播到场" },
  no: { ja: "助播なし", zh: "无助播" },
  tbd: { ja: "未確定", zh: "待确认" },
};

export const GUARANTEE_TYPES = ["none", "roi", "minimum_gmv", "other"] as const;
export type GuaranteeType = typeof GUARANTEE_TYPES[number];

export const GUARANTEE_TYPE_LABELS: Record<GuaranteeType, { ja: string; zh: string }> = {
  none: { ja: "保証なし", zh: "无保证" },
  roi: { ja: "ROI保証", zh: "保ROI" },
  minimum_gmv: { ja: "最低GMV保証", zh: "保最低GMV" },
  other: { ja: "その他保証", zh: "其他保证" },
};

export type BrandLiveProductTerm = {
  id?: number;
  productId?: number | null;
  productName: string;
  specification?: string | null;
  originalPrice: number | null;
  discountedPrice: number | null;
  offerMechanism: string;
  commissionRate?: number | null;
  inventory?: number | null;
  notes?: string | null;
};

export type BrandLiveApprovalDocument = {
  brandId: number;
  targetLiverId: number;
  targetLiverName: string;
  liveAccount: string;
  assistantOnsite: AssistantOnsiteValue;
  assistantDetails?: string | null;
  mechanismSummary: string;
  commissionRate: number | null;
  slotFeeAmount: number | null;
  guaranteeType: GuaranteeType;
  guaranteeValue?: number | null;
  guaranteeTerms?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  businessNotes?: string | null;
  products: BrandLiveProductTerm[];
};

export function normalizeApprovalText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

export function normalizeApprovalTimestamp(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCMilliseconds(0);
  return date.toISOString();
}

export function normalizeLiverIdentity(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateBrandLiveApprovalDocument(document: BrandLiveApprovalDocument): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(document.brandId) || document.brandId <= 0) errors.push("ブランドが必要です");
  if (!normalizeApprovalText(document.targetLiverName, 255)) errors.push("対象トップライバーが必要です");
  if (!normalizeApprovalText(document.liveAccount, 255)) errors.push("配信アカウントが必要です");
  if (document.assistantOnsite === "yes" && !normalizeApprovalText(document.assistantDetails, 2000)) {
    errors.push("助播が現場参加する場合は担当・体制を記入してください");
  }
  if (!normalizeApprovalText(document.mechanismSummary, 5000)) errors.push("全体メカニズムが必要です");
  if (document.commissionRate != null && (!Number.isFinite(document.commissionRate) || document.commissionRate < 0 || document.commissionRate > 100)) {
    errors.push("コミッション率は0〜100%で入力してください");
  }
  if (document.slotFeeAmount != null && (!Number.isSafeInteger(document.slotFeeAmount) || document.slotFeeAmount < 0)) {
    errors.push("坑位費は0以上の整数で入力してください");
  }
  const start = new Date(document.scheduledStart);
  const end = new Date(document.scheduledEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    errors.push("配信終了時刻は開始時刻より後にしてください");
  }
  if (document.guaranteeType !== "none") {
    if (!Number.isFinite(Number(document.guaranteeValue)) || Number(document.guaranteeValue) <= 0) {
      errors.push("保証値を入力してください");
    }
    if (!normalizeApprovalText(document.guaranteeTerms, 5000)) errors.push("保証の条件・算定方法を入力してください");
  }
  if (!Array.isArray(document.products) || document.products.length === 0) {
    errors.push("商品条件を1件以上入力してください");
  }
  document.products.forEach((product, index) => {
    const row = index + 1;
    if (!normalizeApprovalText(product.productName, 255)) errors.push(`商品${row}の商品名が必要です`);
    if (product.originalPrice != null && (!Number.isSafeInteger(product.originalPrice) || product.originalPrice < 0)) errors.push(`商品${row}の原価/通常価格が不正です`);
    if (product.discountedPrice != null && (!Number.isSafeInteger(product.discountedPrice) || product.discountedPrice < 0)) errors.push(`商品${row}の割引後価格が不正です`);
    if (product.originalPrice != null && product.discountedPrice != null && product.originalPrice > 0 && product.discountedPrice > product.originalPrice) errors.push(`商品${row}の割引後価格が通常価格を超えています`);
    if (!normalizeApprovalText(product.offerMechanism, 3000)) errors.push(`商品${row}の販売メカニズムが必要です`);
    if (product.commissionRate != null && (!Number.isFinite(product.commissionRate) || product.commissionRate < 0 || product.commissionRate > 100)) {
      errors.push(`商品${row}のコミッション率が不正です`);
    }
    if (product.inventory != null && (!Number.isSafeInteger(product.inventory) || product.inventory < 0)) errors.push(`商品${row}の在庫が不正です`);
  });
  return errors;
}

export function validateBrandLiveApprovalSubmission(document: BrandLiveApprovalDocument): string[] {
  const errors = validateBrandLiveApprovalDocument(document);
  if (document.assistantOnsite === "tbd") errors.push("助播是否到场必须在提交KG确认前确定");
  if (document.commissionRate == null) errors.push("佣金率必须在提交KG确认前填写");
  if (document.slotFeeAmount == null) errors.push("坑位费必须在提交KG确认前填写（无坑位费请明确填0）");
  document.products.forEach((product, index) => {
    if (!normalizeApprovalText(product.specification, 1000)) errors.push(`商品${index + 1}の仕様・セット内容を入力してください`);
    if (product.inventory == null || !Number.isSafeInteger(product.inventory) || product.inventory < 0) errors.push(`商品${index + 1}の在庫を入力してください`);
    if (product.originalPrice == null) errors.push(`商品${index + 1}の通常価格を入力してください`);
    if (product.discountedPrice == null) errors.push(`商品${index + 1}の割引後価格を入力してください`);
  });
  return [...new Set(errors)];
}
