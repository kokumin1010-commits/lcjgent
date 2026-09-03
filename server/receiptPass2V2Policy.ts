import type { ReceiptEvidence } from "./receiptEvidenceExtraction";

export const PASS2_ALLOWED_BATCH_SIZES = [10, 25, 50, 100] as const;
export type Pass2BatchSize = (typeof PASS2_ALLOWED_BATCH_SIZES)[number];

export type Pass2V2Decision =
  | {
      action: "approve";
      reasonCode: "EVIDENCE_COMPLETE";
      reason: string;
    }
  | {
      action: "reject";
      reasonCode:
        | "NO_IMAGE"
        | "TECHNICAL_FAILURE"
        | "NOT_TIKTOK_SHOP"
        | "NOT_DELIVERED"
        | "MISSING_ORDER_NUMBER"
        | "MISSING_AMOUNT";
      rejectionCategory: "not_tiktok" | "not_delivered" | "incomplete" | "other";
      reason: string;
    }
  | {
      action: "manual";
      reasonCode: "HARD_RISK";
      reason: string;
      reviewDeadlineHours: 72;
    };

export function normalizePass2BatchSize(value: unknown): Pass2BatchSize {
  const parsed = Number(value);
  if (PASS2_ALLOWED_BATCH_SIZES.includes(parsed as Pass2BatchSize)) {
    return parsed as Pass2BatchSize;
  }
  throw new Error("Pass 2 batch size must be 10, 25, 50, or 100");
}

export function hasPass2HardRisk(flags: unknown, note?: string | null): boolean {
  const list = Array.isArray(flags) ? flags.map(value => String(value)) : [];
  const normalizedNote = String(note || "").toLowerCase();
  return (
    list.includes("duplicate_order") ||
    list.includes("same_image_reuse") ||
    normalizedNote.includes("level3") ||
    normalizedNote.includes("同一画像") ||
    normalizedNote.includes("画像ハッシュ") ||
    normalizedNote.includes("硬风险") ||
    normalizedNote.includes("hard risk")
  );
}

export function decidePass2V2Evidence(input: {
  imageCount: number;
  evidence: ReceiptEvidence;
  technicalErrors: string[];
  technicalAttemptsExhausted: boolean;
  hardRisk: boolean;
}): Pass2V2Decision {
  const { evidence } = input;

  if (input.imageCount < 1) {
    return {
      action: "reject",
      reasonCode: "NO_IMAGE",
      rejectionCategory: "incomplete",
      reason: "画像が存在しない、または破損しているため、注文詳細を再アップロードしてください。",
    };
  }

  if (input.technicalAttemptsExhausted) {
    return {
      action: "reject",
      reasonCode: "TECHNICAL_FAILURE",
      rejectionCategory: "other",
      reason: "画像認識を2回完了できませんでした。元画像を確認して再アップロードしてください。",
    };
  }

  if (evidence.isTikTokShop === false) {
    return {
      action: "reject",
      reasonCode: "NOT_TIKTOK_SHOP",
      rejectionCategory: "not_tiktok",
      reason: "TikTok Shopの注文詳細画面を確認できませんでした。対象画面を再アップロードしてください。",
    };
  }

  if (evidence.isDelivered === false) {
    return {
      action: "reject",
      reasonCode: "NOT_DELIVERED",
      rejectionCategory: "not_delivered",
      reason: "配達済み・配送完了・已签收・已完成の状態を確認できませんでした。配達完了後に再申請してください。",
    };
  }

  if (!evidence.orderNumber) {
    return {
      action: "reject",
      reasonCode: "MISSING_ORDER_NUMBER",
      rejectionCategory: "incomplete",
      reason: "16〜19桁の注文番号を確認できませんでした。注文番号が鮮明に見える画像を再アップロードしてください。",
    };
  }

  if (!evidence.totalAmount || evidence.totalAmount <= 0) {
    return {
      action: "reject",
      reasonCode: "MISSING_AMOUNT",
      rejectionCategory: "incomplete",
      reason: "合計金額を確認できませんでした。合計金額（税込）が鮮明に見える画像を再アップロードしてください。",
    };
  }

  if (input.hardRisk) {
    return {
      action: "manual",
      reasonCode: "HARD_RISK",
      reason: "注文番号または画像の重複を示す硬リスクがあるため、証拠を確認して72時間以内に判断してください。",
      reviewDeadlineHours: 72,
    };
  }

  if (evidence.isTikTokShop !== true || evidence.isDelivered !== true) {
    return {
      action: "reject",
      reasonCode: "TECHNICAL_FAILURE",
      rejectionCategory: "other",
      reason: "TikTok Shop注文詳細と配達済み状態を確認できませんでした。必要情報が見える画像を再アップロードしてください。",
    };
  }

  return {
    action: "approve",
    reasonCode: "EVIDENCE_COMPLETE",
    reason: "全画像を統合し、TikTok Shop注文詳細、配達済み、注文番号、合計金額を確認しました。",
  };
}
