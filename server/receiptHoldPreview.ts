import { asc, eq, sql } from "drizzle-orm";
import { lineReceipts } from "../drizzle/schema";
import { getDb } from "./db";
import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";
import type { ReceiptEvidence } from "./receiptEvidenceExtraction";
import {
  evaluatePass2CurrentRules,
  hasPass2HardRisk,
  normalizePass2BatchSize,
  PASS2_RULESET,
  type Pass2BatchSize,
  type Pass2V2Decision,
} from "./receiptPass2V2Policy";
import {
  createPass2PreviewToken,
  normalizePass2CandidateId,
  normalizePass2CandidateUpdatedAtMs,
} from "./receiptPass2PreviewToken";

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

function storedImageCount(receipt: { imageUrl?: string | null; imageUrls?: string[] | null }): number {
  if (Array.isArray(receipt.imageUrls)) {
    return [...new Set(receipt.imageUrls.map(value => String(value || "").trim()).filter(Boolean))].length;
  }
  return receipt.imageUrl ? 1 : 0;
}

function storedEvidence(receipt: {
  orderNumber: string | null;
  totalAmount: number | null;
  ocrRawText: unknown;
}): ReceiptEvidence {
  const ocr = parseOcr(receipt.ocrRawText);
  const orderNumber = normalizeReceiptOrderNumber(receipt.orderNumber || ocr.orderNumber);
  const totalAmount = Number(receipt.totalAmount || ocr.totalAmount || 0) || null;
  return {
    isTikTokShop: typeof ocr.isTikTokShop === "boolean" ? ocr.isTikTokShop : null,
    isDelivered: typeof ocr.isDelivered === "boolean" ? ocr.isDelivered : null,
    orderNumber,
    allOrderNumbers: orderNumber ? [orderNumber] : [],
    totalAmount,
    orderDate: typeof ocr.orderDate === "string" ? ocr.orderDate : null,
    shopName: typeof ocr.shopName === "string" ? ocr.shopName : null,
    productName: typeof ocr.productName === "string" ? ocr.productName : null,
    orderNumberSource: typeof ocr.orderNumberSource === "string" ? ocr.orderNumberSource : null,
    items: Array.isArray(ocr.items) ? ocr.items : [],
    deliveryInfo: ocr.deliveryInfo && typeof ocr.deliveryInfo === "object" ? ocr.deliveryInfo : null,
    paymentInfo: ocr.paymentInfo && typeof ocr.paymentInfo === "object" ? ocr.paymentInfo : null,
    confidence: Number(ocr.confidence || 0),
  };
}

function previewCategoryForDecision(decision: Pass2V2Decision): ReceiptHoldPreviewCategory {
  if (decision.action === "approve") return "evidence_complete_recheck";
  if (decision.action === "manual") return "hard_risk";
  if (decision.reasonCode === "MISSING_ORDER_NUMBER") return "missing_order_number";
  if (decision.reasonCode === "MISSING_AMOUNT") return "missing_amount";
  if (decision.reasonCode === "TECHNICAL_FAILURE" || decision.reasonCode === "NO_IMAGE") {
    return "technical_failure";
  }
  return "evidence_incomplete";
}

function previewActionForDecision(decision: Pass2V2Decision): HoldPreviewItem["suggestedAction"] {
  if (decision.action === "approve") return "approve_after_duplicate_recheck";
  if (decision.action === "reject") return "reject_and_resubmit";
  return "manual_review";
}

export function classifyHeldReceiptForPreview(receipt: {
  id: number;
  orderNumber: string | null;
  totalAmount: number | null;
  ocrRawText: unknown;
  reviewNote: string | null;
  fraudFlags: string[] | null;
  isForceSubmitted: boolean | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
}): HoldPreviewItem {
  const note = String(receipt.reviewNote || "");
  const evidence = storedEvidence(receipt);
  const amount = Number(evidence.totalAmount || 0);
  const estimatedPoints = amount > 0 ? Math.floor(amount * 0.01) : 0;

  if (includesAny(note, ["別ユーザー", "跨用户", "cross-user", "Level2"])) {
    return { receiptId: receipt.id, category: "cross_account_conflict", suggestedAction: "manual_review", estimatedPoints: 0 };
  }

  const technicalAttemptsExhausted = includesAny(note, [
    "バックグラウンド処理エラー",
    "AI解析失敗",
    "画像読み取り失敗",
    "解析失敗",
    "LLM_ERROR",
    "LLM_PARSE_ERROR",
    "技术",
  ]);
  const decision = evaluatePass2CurrentRules({
    imageCount: storedImageCount(receipt),
    evidence,
    technicalErrors: technicalAttemptsExhausted ? [note || "legacy technical failure"] : [],
    technicalAttemptsExhausted,
    hardRisk: hasPass2HardRisk(receipt.fraudFlags, receipt.reviewNote),
  });
  const suggestedAction = previewActionForDecision(decision);
  const category = receipt.isForceSubmitted
    ? "force_appeal"
    : previewCategoryForDecision(decision);
  return {
    receiptId: receipt.id,
    category,
    suggestedAction,
    estimatedPoints: suggestedAction === "approve_after_duplicate_recheck" ? estimatedPoints : 0,
  };
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

  const rawRows = await db
    .select({
      id: sql<string>`CAST(${lineReceipts.id} AS CHAR)`,
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
  const rows = rawRows.map(row => ({
    ...row,
    id: normalizePass2CandidateId(row.id),
  }));

  if (rows.length === 0) {
    return {
      dryRun: true as const,
      wroteData: false as const,
      ruleset: PASS2_RULESET,
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
      updatedAtMs: normalizePass2CandidateUpdatedAtMs(row.updatedAt),
    })),
  });

  return {
    dryRun: true as const,
    wroteData: false as const,
    ruleset: PASS2_RULESET,
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
