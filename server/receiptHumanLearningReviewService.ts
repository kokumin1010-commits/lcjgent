import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";
import { claimReceiptOrderNumber } from "./receiptOrderNumberGuard";
import { withHumanLearningReviewLock } from "./receiptPass2BatchLock";
import {
  HUMAN_LEARNING_REVIEW_VERSION,
  buildHumanLearningErrorType,
  buildHumanLearningNote,
  buildHumanLearningProblemPoints,
  isHumanLearningCandidate,
  normalizeHumanLearningEvidenceKeys,
  normalizeHumanLearningReason,
  type HumanLearningEvidenceKey,
  type HumanLearningRejectionCategory,
} from "./receiptHumanLearningReview";

const rejectionReasonMap: Record<HumanLearningRejectionCategory, string> = {
  blurry_image: "画像が不鮮明で内容が読み取れません",
  missing_order_number: "注文番号が確認できません",
  missing_amount: "合計金額が確認できません",
  not_delivered: "配達済みのステータスが確認できません",
  duplicate: "同じ注文番号で既に申請済みです",
  wrong_store: "対象外の店舗のレシートです",
  suspicious: "画像に不審な点があります",
  incomplete_info: "必要な情報が不足しています",
  not_order_detail: "注文詳細画面ではありません",
  not_tiktok_shop: "TikTok Shop以外のプラットフォームのレシートです",
  partial_screenshot: "スクリーンショットが不完全です",
  other: "管理者が証拠を確認し、不承認と判断しました",
};

export type ResolveHumanLearningReviewInput = {
  logId: number;
  decision: "approved" | "rejected";
  humanReason: unknown;
  evidenceKeys: unknown;
  rejectionCategory?: HumanLearningRejectionCategory;
  correctedOrderNumber?: string | null;
  correctedAmount?: number | null;
  correctedStoreName?: string | null;
  adminUserId: number;
  sendNotification?: boolean;
};

function normalizeCorrectedAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("通过审核时，人工修正金额必须是大于0的整数");
  }
  return parsed;
}

function normalizeCorrectedStoreName(value: unknown): string | null {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.length > 255) throw new Error("店铺名称不能超过255个字符");
  return normalized;
}

async function rejectHumanLearningReceipt(input: {
  receipt: any;
  adminUserId: number;
  humanReason: string;
  rejectionCategory: HumanLearningRejectionCategory;
  sendNotification: boolean;
}) {
  const {
    updateLineReceiptStatus,
    createReceiptReviewLog,
  } = await import("./db");

  const note = `[人工学习审核 ${HUMAN_LEARNING_REVIEW_VERSION}] ${input.humanReason}`;
  await updateLineReceiptStatus(input.receipt.id, "rejected", input.adminUserId, note);

  try {
    await createReceiptReviewLog({
      receiptType: "line_receipt",
      receiptId: input.receipt.id,
      decision: "rejected",
      rejectionCategory: input.rejectionCategory,
      rejectionNote: input.humanReason,
      ocrConfidence: input.receipt.ocrConfidence ?? undefined,
      totalAmount: input.receipt.totalAmount ?? undefined,
      hasOrderNumber: input.receipt.orderNumber ? "yes" : "no",
      imageCount: input.receipt.imageUrls?.length ?? 1,
      fraudScore: input.receipt.fraudScore ?? undefined,
      fraudFlagCount: input.receipt.fraudFlags?.length ?? 0,
      pointsCalculated: input.receipt.pointsCalculated ?? undefined,
      pointsAwarded: 0,
      reviewedBy: input.adminUserId,
    });
  } catch (error) {
    console.error("[Human Learning Review] Rejection audit log failed:", error);
  }

  if (!input.sendNotification) return;
  try {
    const { pushMessage } = await import("./line");
    const appUrl = process.env.APP_URL || "https://lcjmall.com";
    const reason = rejectionReasonMap[input.rejectionCategory];
    await pushMessage(input.receipt.lineUserId, [{
      type: "text",
      text: `❌ レシートが承認されませんでした\n\n理由：${reason}\n管理者確認：${input.humanReason}\n\n必要な情報が見える画像を再アップロードしてください。\n① TikTok Shop注文詳細\n② 配達済み状態\n③ 16〜19桁の注文番号\n④ 合計金額（税込）\n\n${appUrl}/receipt-upload`,
    }]);
  } catch (error) {
    console.error("[Human Learning Review] Rejection notification failed:", error);
  }
}

export async function resolveHumanLearningReview(input: ResolveHumanLearningReviewInput) {
  return withHumanLearningReviewLock(input.logId, async () => {
    const {
      getAiAutoReviewLogById,
      getLineReceiptById,
      updateLineReceiptOcr,
      overrideAiAutoReviewLog,
      saveAiReceiptLearningExample,
      hasLearningExampleForLog,
    } = await import("./db");

    const log = await getAiAutoReviewLogById(input.logId);
    if (!log) throw new Error("学习审核记录不存在");
    if (log.humanOverride) {
      return {
        success: true as const,
        alreadyProcessed: true as const,
        decision: log.humanOverride,
        learningSaved: await hasLearningExampleForLog(log.id),
      };
    }

    const receipt = await getLineReceiptById(log.receiptId);
    if (!receipt) throw new Error("暂挂订单不存在");
    if (!isHumanLearningCandidate({
      aiPass: log.aiPass,
      beforeStatus: log.beforeStatus,
      afterStatus: log.afterStatus,
      aiDecision: log.aiDecision,
      humanOverride: log.humanOverride,
      isDryRun: log.isDryRun,
      receiptStatus: receipt.status,
    })) {
      throw new Error("该订单不属于AI无法判断的当前暂挂学习队列，或已被其他人处理");
    }

    const humanReason = normalizeHumanLearningReason(input.humanReason);
    const evidenceKeys = normalizeHumanLearningEvidenceKeys(input.evidenceKeys);
    const problemPoints = buildHumanLearningProblemPoints({
      reasonCode: log.reasonCode,
      aiReason: log.aiReason,
      aiComment: log.aiComment,
    });
    const correctedAmount = normalizeCorrectedAmount(input.correctedAmount);
    const correctedStoreName = normalizeCorrectedStoreName(input.correctedStoreName);
    const correctedOrderNumber = input.correctedOrderNumber
      ? normalizeReceiptOrderNumber(input.correctedOrderNumber)
      : null;
    if (input.correctedOrderNumber && !correctedOrderNumber) {
      throw new Error("人工修正的订单号格式无效");
    }

    if (input.decision === "approved") {
      const approvalOrderNumber = correctedOrderNumber || normalizeReceiptOrderNumber(receipt.orderNumber);
      if (!approvalOrderNumber) throw new Error("通过审核前必须确认有效订单号");

      const update: Record<string, unknown> = {};
      if (correctedOrderNumber) update.orderNumber = correctedOrderNumber;
      if (correctedAmount) {
        update.totalAmount = correctedAmount;
        update.pointsCalculated = Math.floor(correctedAmount * 0.01);
      }
      if (correctedStoreName) update.storeName = correctedStoreName;

      const { approveReceiptFromEvidence } = await import("./receiptApprovalService");
      const claim = await claimReceiptOrderNumber({
        receiptId: receipt.id,
        lineUserId: receipt.lineUserId,
        orderNumber: approvalOrderNumber,
        allowSameAccountUnapproved: true,
        onAllowedWhileLocked: async () => {
          if (Object.keys(update).length > 0) {
            await updateLineReceiptOcr(receipt.id, update as any);
          }
          await approveReceiptFromEvidence({
            receiptId: receipt.id,
            lineUserId: receipt.lineUserId,
            reviewedBy: input.adminUserId,
            reason: `[人工学习审核 ${HUMAN_LEARNING_REVIEW_VERSION}] ${humanReason}`,
            sendNotification: input.sendNotification !== false,
            orderNumberAlreadyClaimed: true,
          });
        },
      });
      if (!claim.decision.allowed) {
        if (claim.decision.reason === "cross_account_order_number") {
          throw new Error("该订单号存在其他账户的申报，不能通过；请核对归属");
        }
        throw new Error("同一账户存在已通过、已发积分或待处理积分申请的相同订单记录，不能重复通过");
      }
    } else {
      if (!input.rejectionCategory) throw new Error("拒绝时必须选择拒绝类别");
      await rejectHumanLearningReceipt({
        receipt,
        adminUserId: input.adminUserId,
        humanReason,
        rejectionCategory: input.rejectionCategory,
        sendNotification: input.sendNotification !== false,
      });
    }

    const updatedLog = await overrideAiAutoReviewLog(log.id, {
      humanOverride: input.decision,
      humanComment: humanReason,
      humanReviewedBy: input.adminUserId,
    });
    if (!updatedLog) throw new Error("人工审核已完成，但AI日志更新失败");

    let learningSaved = await hasLearningExampleForLog(log.id);
    if (!learningSaved) {
      try {
        await saveAiReceiptLearningExample({
          reviewLogId: log.id,
          receiptId: receipt.id,
          imageUrl: receipt.imageUrl || log.imageUrl || null,
          aiOriginalDecision: log.aiDecision,
          aiOriginalConfidence: log.aiConfidence,
          aiOriginalComment: log.aiComment || log.aiReason,
          aiOriginalOrderNumber: log.orderNumber,
          aiOriginalAmount: log.totalAmount ?? null,
          aiOriginalStoreName: log.storeName,
          humanDecision: input.decision,
          humanComment: humanReason,
          correctOrderNumber: correctedOrderNumber || receipt.orderNumber || null,
          correctAmount: correctedAmount || Number(receipt.totalAmount || 0) || null,
          correctStoreName: correctedStoreName || receipt.storeName || null,
          errorType: buildHumanLearningErrorType(log.reasonCode),
          learningNote: buildHumanLearningNote({
            reasonCode: log.reasonCode,
            problemPoints,
            evidenceKeys: evidenceKeys as HumanLearningEvidenceKey[],
            humanDecision: input.decision,
            humanReason,
          }),
          createdBy: input.adminUserId,
        });
        learningSaved = true;
      } catch (error) {
        console.error("[Human Learning Review] Learning example save failed:", error);
      }
    }

    return {
      success: true as const,
      alreadyProcessed: false as const,
      decision: input.decision,
      receiptId: receipt.id,
      removedFromHold: true as const,
      learningSaved,
      rulesetVersion: HUMAN_LEARNING_REVIEW_VERSION,
    };
  });
}
