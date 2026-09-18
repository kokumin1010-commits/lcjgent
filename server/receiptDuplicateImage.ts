import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";

export type ReceiptDuplicateImageDetection = "exact_sha256" | "perceptual_hash";

export type RejectDuplicateReceiptImageInput = {
  receiptId: number;
  lineUserId: string;
  matchedReceiptId: number;
  detection: ReceiptDuplicateImageDetection;
  perceptualDistance?: number;
  imageUrls: string[];
  imageKeys: string[];
};

export type RejectDuplicateReceiptImageResult = {
  rejected: boolean;
  orderNumber: string | null;
  sameAccount: boolean;
  message: string;
};

function extractCanonicalOrderNumber(receipt: any): string | null {
  const direct = normalizeReceiptOrderNumber(receipt?.orderNumber);
  if (direct) return direct;
  try {
    const raw = typeof receipt?.ocrRawText === "string"
      ? JSON.parse(receipt.ocrRawText)
      : receipt?.ocrRawText;
    return normalizeReceiptOrderNumber(raw?.orderNumber);
  } catch {
    return null;
  }
}

/**
 * Rejects a later receipt that reuses an active receipt image. The earlier ID is
 * the deterministic canonical record, so concurrent duplicate uploads cannot
 * reject each other. Rejected historical records never block a corrected retry.
 */
export async function rejectDuplicateReceiptImage(
  input: RejectDuplicateReceiptImageInput
): Promise<RejectDuplicateReceiptImageResult> {
  const {
    createLineFraudDetectionLog,
    getLineReceiptById,
    updateLineReceiptAiRejection,
    updateLineReceiptFraudFlags,
    updateLineReceiptOcr,
    updateLineReceiptStatus,
  } = await import("./db");

  const matched = await getLineReceiptById(input.matchedReceiptId);
  if (
    !matched
    || matched.status === "rejected"
    || Number(matched.id) >= input.receiptId
  ) {
    return {
      rejected: false,
      orderNumber: null,
      sameAccount: false,
      message: "No earlier active duplicate image exists",
    };
  }

  const sameAccount = matched.lineUserId === input.lineUserId;
  const orderNumber = extractCanonicalOrderNumber(matched);
  const message = sameAccount
    ? `この画像は同じアカウントですでに申請済みです${orderNumber ? `。注文番号: ${orderNumber}` : ""}`
    : `この画像は別のアカウントですでに申請済みです${orderNumber ? `。注文番号: ${orderNumber}` : ""}`;
  const detectionLabel = input.detection === "exact_sha256"
    ? "SHA256完全一致"
    : `知覚ハッシュ一致${input.perceptualDistance === undefined ? "" : ` (距離${input.perceptualDistance})`}`;

  await updateLineReceiptOcr(input.receiptId, {
    storeName: matched.storeName || "TikTok Shop",
    purchaseDate: matched.purchaseDate || undefined,
    totalAmount: Number(matched.totalAmount || 0),
    currency: matched.currency || "JPY",
    orderNumber,
    ocrRawText: JSON.stringify({
      orderNumber,
      duplicateImageOfReceiptId: matched.id,
      duplicateDetection: input.detection,
      perceptualDistance: input.perceptualDistance ?? null,
      canonicalOrderNumberSource: orderNumber ? "matched_active_receipt" : null,
    }),
    ocrConfidence: orderNumber ? "100" : "0",
    pointsCalculated: 0,
    imageUrls: input.imageUrls,
    imageKeys: input.imageKeys,
  });
  await updateLineReceiptFraudFlags(
    input.receiptId,
    orderNumber ? ["duplicate_image", "duplicate_order"] : ["duplicate_image"],
    100
  );
  await updateLineReceiptAiRejection(input.receiptId, {
    aiRejectionReason: message,
    aiRejectionCategory: "other",
  });
  await createLineFraudDetectionLog({
    receiptId: input.receiptId,
    lineUserId: input.lineUserId,
    checkType: "duplicate_image",
    detected: true,
    severity: "high",
    details: `自動却下: ${detectionLabel}; canonical receipt #${matched.id}${orderNumber ? `; order ${orderNumber}` : ""}`,
    relatedReceiptId: matched.id,
  });
  await updateLineReceiptStatus(
    input.receiptId,
    "rejected",
    0,
    `自動却下: 重複画像 (${detectionLabel}) / canonical #${matched.id}`
  );

  return { rejected: true, orderNumber, sameAccount, message };
}
