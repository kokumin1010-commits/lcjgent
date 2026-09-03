import { asc, eq, sql } from "drizzle-orm";
import { lineReceipts } from "../drizzle/schema";
import { getDb } from "./db";
import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";
import {
  normalizePass2BatchSize,
  type Pass2BatchSize,
} from "./receiptPass2V2Policy";
import { createPass2PreviewToken } from "./receiptPass2PreviewToken";

export type ReceiptHoldPreviewCategory =
  | "cross_account_conflict"
  | "force_appeal"
  | "hard_risk"
  | "technical_failure"
  | "missing_order_number"
  | "missing_amount"
  | "evidence_complete_recheck"
  | "evidence_incomplete"
  | "other";

export type HoldPreviewItem = {
  receiptId: number;
  category: ReceiptHoldPreviewCategory;
  suggestedAction: "approve_after_duplicate_recheck" | "reject_and_resubmit" | "manual_review";
  estimatedPoints: number;
};

function parseOcr(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function includesAny(value: string, needles: string[]) {
  return needles.some(needle => value.includes(needle));
}

export function classifyHeldReceiptForPreview(receipt: {
  id: number;
  orderNumber: string | null;
  totalAmount: number | null;
  ocrRawText: unknown;
  reviewNote: string | null;
  fraudFlags: string[] | null;
  isForceSubmitted: boolean | null;
}): HoldPreviewItem {
  const note = String(receipt.reviewNote || "");
  const flags = Array.isArray(receipt.fraudFlags) ? receipt.fraudFlags : [];
  const ocr = parseOcr(receipt.ocrRawText);
  const orderNumber = normalizeReceiptOrderNumber(receipt.orderNumber || ocr.orderNumber);
  const amount = Number(receipt.totalAmount || ocr.totalAmount || 0);
  const isTikTok = ocr.isTikTokShop === true;
  const isDelivered = ocr.isDelivered === true;
  const estimatedPoints = amount > 0 ? Math.floor(amount * 0.01) : 0;

  if (includesAny(note, ["別ユーザー", "跨用户", "cross-user", "Level2"])) {
    return { receiptId: receipt.id, category: "cross_account_conflict", suggestedAction: "manual_review", estimatedPoints };
  }
  if (receipt.isForceSubmitted) {
    return { receiptId: receipt.id, category: "force_appeal", suggestedAction: "manual_review", estimatedPoints };
  }
  if (
    flags.includes("duplicate_order") ||
    flags.includes("same_image_reuse") ||
    includesAny(note, ["Level3", "同一画像", "画像ハッシュ", "硬风险"])
  ) {
    return { receiptId: receipt.id, category: "hard_risk", suggestedAction: "manual_review", estimatedPoints };
  }
  if (
    includesAny(note, [
      "バックグラウンド処理エラー",
      "AI解析失敗",
      "画像読み取り失敗",
      "解析失敗",
      "LLM_ERROR",
      "LLM_PARSE_ERROR",
      "技术",
    ])
  ) {
    return { receiptId: receipt.id, category: "technical_failure", suggestedAction: "reject_and_resubmit", estimatedPoints };
  }
  if (!orderNumber) {
    return { receiptId: receipt.id, category: "missing_order_number", suggestedAction: "reject_and_resubmit", estimatedPoints };
  }
  if (amount <= 0) {
    return { receiptId: receipt.id, category: "missing_amount", suggestedAction: "reject_and_resubmit", estimatedPoints };
  }
  if (isTikTok && isDelivered) {
    return { receiptId: receipt.id, category: "evidence_complete_recheck", suggestedAction: "approve_after_duplicate_recheck", estimatedPoints };
  }
  if (ocr.isTikTokShop === false || ocr.isDelivered === false) {
    return { receiptId: receipt.id, category: "evidence_incomplete", suggestedAction: "reject_and_resubmit", estimatedPoints };
  }
  return { receiptId: receipt.id, category: "other", suggestedAction: "manual_review", estimatedPoints };
}

export async function previewHeldReceiptRules(input: {
  adminUserId: number;
  batchSize: Pass2BatchSize;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!Number.isInteger(input.adminUserId) || input.adminUserId <= 0) {
    throw new Error("A valid administrator is required for Pass 2 preview");
  }
  const batchSize = normalizePass2BatchSize(input.batchSize);

  const [countRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(lineReceipts)
    .where(eq(lineReceipts.status, "on_hold"));
  const queueTotal = Number(countRow?.total || 0);

  const rows = await db
    .select({
      id: lineReceipts.id,
      orderNumber: lineReceipts.orderNumber,
      totalAmount: lineReceipts.totalAmount,
      ocrRawText: lineReceipts.ocrRawText,
      reviewNote: lineReceipts.reviewNote,
      fraudFlags: lineReceipts.fraudFlags,
      isForceSubmitted: lineReceipts.isForceSubmitted,
      imageUrl: lineReceipts.imageUrl,
      imageUrls: lineReceipts.imageUrls,
      submittedAt: lineReceipts.submittedAt,
      updatedAt: lineReceipts.updatedAt,
    })
    .from(lineReceipts)
    .where(eq(lineReceipts.status, "on_hold"))
    .orderBy(asc(lineReceipts.submittedAt), asc(lineReceipts.id))
    .limit(batchSize);

  if (rows.length === 0) {
    return {
      dryRun: true as const,
      wroteData: false as const,
      queueTotal,
      total: queueTotal,
      batchSize,
      batchTotal: 0,
      wouldApproveAfterRecheck: 0,
      wouldRejectAndResubmit: 0,
      wouldRemainManual: 0,
      estimatedPoints: 0,
      estimatedNotifications: 0,
      categories: emptyCategories(),
      samples: {},
      sampleRows: [],
      confirmationToken: null,
      expiresAt: null,
    };
  }

  const classified = rows.map(classifyHeldReceiptForPreview);
  const categories = emptyCategories();
  const samples: Partial<Record<ReceiptHoldPreviewCategory, number[]>> = {};
  let wouldApproveAfterRecheck = 0;
  let wouldRejectAndResubmit = 0;
  let wouldRemainManual = 0;
  let estimatedPoints = 0;

  for (const item of classified) {
    categories[item.category] += 1;
    (samples[item.category] ||= []);
    if (samples[item.category]!.length < 5) samples[item.category]!.push(item.receiptId);
    if (item.suggestedAction === "approve_after_duplicate_recheck") {
      wouldApproveAfterRecheck += 1;
      estimatedPoints += item.estimatedPoints;
    } else if (item.suggestedAction === "reject_and_resubmit") {
      wouldRejectAndResubmit += 1;
    } else {
      wouldRemainManual += 1;
    }
  }

  const byId = new Map(classified.map(item => [item.receiptId, item]));
  const sampleRows = rows.slice(0, 12).map(row => {
    const item = byId.get(row.id)!;
    const ocr = parseOcr(row.ocrRawText);
    const orderNumber = normalizeReceiptOrderNumber(row.orderNumber || ocr.orderNumber);
    const imageCount = Array.isArray(row.imageUrls)
      ? row.imageUrls.filter(Boolean).length
      : row.imageUrl
        ? 1
        : 0;
    return {
      receiptId: row.id,
      category: item.category,
      suggestedAction: item.suggestedAction,
      submittedAt: row.submittedAt,
      orderNumberTail: orderNumber ? orderNumber.slice(-6) : null,
      totalAmount: Number(row.totalAmount || ocr.totalAmount || 0) || null,
      estimatedPoints: item.estimatedPoints,
      imageCount,
      isForceSubmitted: Boolean(row.isForceSubmitted),
    };
  });

  const signed = createPass2PreviewToken({
    adminUserId: input.adminUserId,
    batchSize,
    candidates: rows.map(row => ({
      id: row.id,
      status: "on_hold" as const,
      updatedAtMs: row.updatedAt.getTime(),
    })),
  });

  return {
    dryRun: true as const,
    wroteData: false as const,
    queueTotal,
    total: queueTotal,
    batchSize,
    batchTotal: rows.length,
    wouldApproveAfterRecheck,
    wouldRejectAndResubmit,
    wouldRemainManual,
    estimatedPoints,
    estimatedNotifications: wouldApproveAfterRecheck + wouldRejectAndResubmit,
    categories,
    samples,
    sampleRows,
    confirmationToken: signed.token,
    expiresAt: new Date(signed.payload.expiresAtMs),
  };
}

function emptyCategories(): Record<ReceiptHoldPreviewCategory, number> {
  return {
    cross_account_conflict: 0,
    force_appeal: 0,
    hard_risk: 0,
    technical_failure: 0,
    missing_order_number: 0,
    missing_amount: 0,
    evidence_complete_recheck: 0,
    evidence_incomplete: 0,
    other: 0,
  };
}
