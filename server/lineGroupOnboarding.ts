import { sql } from "drizzle-orm";
import {
  finalizeLineOutgoingAudit,
  getDb,
  lockLineGroupConversationUsingExecutor,
  reserveLineOutgoingAudit,
} from "./db";
import { pushMessage } from "./line";
import { createLineRetryKey } from "./lineRetryKey";
import {
  LINE_INITIAL_AUTOMATION_NOTICE,
  LINE_PUBLIC_CONTACT_NAME,
} from "../shared/linePublicIdentity";

const ONBOARDING_VERSION = "group_onboarding_v1";
const ONBOARDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUTOMATIC_REPLIES = 2;

type OnboardingStatus =
  | "pending_intro"
  | "awaiting_profile"
  | "awaiting_preferences"
  | "completed"
  | "expired";

type PendingOnboardingDelivery = {
  lineGroupId: string;
  sourceMessageId: string | null;
  auditMessageId: string;
  replyText: string;
  nextStatus: OnboardingStatus;
  isIntro: boolean;
};

type PreparedOnboardingReply = PendingOnboardingDelivery | "already_handled" | null;

type BeginOnboardingParams = {
  lineGroupId: string;
  groupName?: string | null;
  joinEventId: string;
  joinEventAt: number;
};

type ContinueOnboardingParams = {
  lineGroupId: string;
  sourceMessageId: string;
  lineUserId: string;
  text: string;
  eventTimestamp: number;
  isExplicitMention?: boolean;
};

type LineGroupOnboardingDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const ONBOARDING_STATUSES = new Set<OnboardingStatus>([
  "pending_intro",
  "awaiting_profile",
  "awaiting_preferences",
  "completed",
  "expired",
]);

function firstRow(result: any): Record<string, any> | null {
  const rows = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
  return rows[0] || null;
}

function resultRows(result: any): Record<string, any>[] {
  const rows = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
  return Array.isArray(rows) ? rows : [];
}

function parseOnboardingStatus(value: unknown): OnboardingStatus | null {
  const normalized = String(value || "") as OnboardingStatus;
  return ONBOARDING_STATUSES.has(normalized) ? normalized : null;
}

export function normalizeLineGroupBrandName(groupName?: string | null): string {
  const normalized = String(groupName || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return normalized || "このグループのブランド";
}

export function composeLineGroupOnboardingGreeting(brandName: string): string {
  return [
    "皆さま、はじめまして！",
    `ブランド「${normalizeLineGroupBrandName(brandName)}」のご案内・サポートを担当するLCJの${LINE_PUBLIC_CONTACT_NAME}です。`,
    "今後の商品案内やご連絡のため、差し支えなければ以下を教えてください。",
    "・TikTokのアカウント名／ID",
    "・お呼びする際のお名前（ニックネームでも大丈夫です）",
    "・主な配信または動画投稿のジャンル",
    "この案内に続く最初の確認（最大2回）は、@LCJを付けずそのまま送っていただけます。",
    "どうぞよろしくお願いいたします！",
    "",
    LINE_INITIAL_AUTOMATION_NOTICE,
  ].join("\n");
}

function classifyOnboardingReply(text: string): {
  hasProfile: boolean;
  hasSample: boolean;
  hasSchedule: boolean;
} {
  const normalized = text.toLowerCase();
  return {
    hasProfile: /(?:tiktok|ティックトック|アカウント|id|ＩＤ|名前|ニックネーム|@[a-z0-9_.-]{2,})/i.test(normalized),
    hasSample: /(?:サンプル|商品|届い|手元|持って|持っ|興味)/.test(normalized),
    hasSchedule: /(?:配信|動画|投稿|予定|日程|時期|いつ|ライブ)/.test(normalized),
  };
}

export function composeLineGroupOnboardingReply(
  text: string,
  currentStatus: OnboardingStatus,
): { replyText: string; nextStatus: OnboardingStatus } {
  const signals = classifyOnboardingReply(text);
  if (currentStatus === "awaiting_profile") {
    if (signals.hasSample && signals.hasSchedule) {
      return {
        replyText: "ありがとうございます！サンプル状況と配信・動画投稿のご予定を確認しました。\n内容をもとに、紹介しやすい商品や進め方をLCJ側で整理します。具体的な条件や可否は確認後にご案内いたします。",
        nextStatus: "completed",
      };
    }
    return {
      replyText: "ありがとうございます！内容を確認しました。\n続けて、現在お手元にあるサンプルや興味のある商品、配信・動画投稿の予定時期があれば、決まっている範囲で教えてください。",
      nextStatus: "awaiting_preferences",
    };
  }

  if (signals.hasSample && !signals.hasSchedule) {
    return {
      replyText: "サンプル状況を教えていただき、ありがとうございます！内容を保存しました。\n今後、配信や動画投稿の予定時期を追加でお知らせいただく場合は、@LCJを付けてご連絡ください。",
      nextStatus: "completed",
    };
  }
  if (signals.hasSchedule && !signals.hasSample) {
    return {
      replyText: "配信・動画投稿のご予定を教えていただき、ありがとうございます！内容を保存しました。\n今後、サンプル状況や興味のある商品を追加でお知らせいただく場合は、@LCJを付けてご連絡ください。",
      nextStatus: "completed",
    };
  }
  return {
    replyText: "ありがとうございます！内容を保存しました。\n紹介しやすい商品や進め方をLCJ側で整理します。具体的な条件や可否は確認後にご案内いたします。",
    nextStatus: "completed",
  };
}

function buildIntroAuditMessageId(joinEventId: string): string {
  return `line:onboard:i:${createLineRetryKey(joinEventId)}`;
}

function buildReplyAuditMessageId(sourceMessageId: string): string {
  return `line:onboard:r:${createLineRetryKey(sourceMessageId)}`;
}

function onboardingDeliveryRetryKey(auditMessageId: string): string {
  return createLineRetryKey(`line-group-onboarding:${auditMessageId}`);
}

async function prepareJoinUsingDb(
  db: LineGroupOnboardingDb,
  params: BeginOnboardingParams,
): Promise<PendingOnboardingDelivery | null> {
  return db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, params.lineGroupId, false);
    const lifecycleEventId = params.joinEventId.slice(0, 64);
    const groupResult = await tx.execute(sql`
      SELECT g.isActive, s.autoReplyEnabled,
             l.isActive AS lifecycleIsActive, l.lastEventAt, l.lastEventId
      FROM line_groups g
      INNER JOIN line_group_lifecycle_states l ON l.lineGroupId = g.lineGroupId
      LEFT JOIN line_group_settings s ON s.lineGroupId = g.lineGroupId
      WHERE g.lineGroupId = ${params.lineGroupId}
      LIMIT 1
    `);
    const group = firstRow(groupResult);
    if (
      !group ||
      !Boolean(group.isActive) ||
      !Boolean(group.autoReplyEnabled) ||
      !Boolean(group.lifecycleIsActive) ||
      Number(group.lastEventAt) !== params.joinEventAt ||
      String(group.lastEventId || "") !== lifecycleEventId
    ) return null;
    const expiresAtMs = params.joinEventAt + ONBOARDING_WINDOW_MS;
    if (Date.now() > expiresAtMs) return null;

    const existingResult = await tx.execute(sql`
      SELECT joinEventId, status, pendingAuditMessageId, pendingReplyText, pendingNextStatus
      FROM line_group_onboarding_states
      WHERE lineGroupId = ${params.lineGroupId}
      LIMIT 1
      FOR UPDATE
    `);
    const existing = firstRow(existingResult);
    if (existing?.joinEventId === params.joinEventId) {
      if (!existing.pendingAuditMessageId || !existing.pendingReplyText || !existing.pendingNextStatus) return null;
      const nextStatus = parseOnboardingStatus(existing.pendingNextStatus);
      if (!nextStatus) throw new Error("LINE_GROUP_ONBOARDING_INVALID_PENDING_STATUS");
      return {
        lineGroupId: params.lineGroupId,
        sourceMessageId: null,
        auditMessageId: String(existing.pendingAuditMessageId),
        replyText: String(existing.pendingReplyText),
        nextStatus,
        isIntro: true,
      };
    }
    if (existing?.pendingAuditMessageId) {
      await tx.execute(sql`
        UPDATE line_messages
        SET responseStatus = 'cancelled', responseSummary = '新しいLINEグループ再参加案内へ更新したため送信中止'
        WHERE messageId = ${String(existing.pendingAuditMessageId)}
          AND direction = 'outgoing'
          AND responseStatus = 'pending'
      `);
    }

    const brandName = normalizeLineGroupBrandName(params.groupName);
    const replyText = composeLineGroupOnboardingGreeting(brandName);
    const auditMessageId = buildIntroAuditMessageId(params.joinEventId);
    const expiresAt = new Date(expiresAtMs);
    await tx.execute(sql`
      INSERT INTO line_group_onboarding_states (
        lineGroupId, onboardingVersion, joinEventId, joinEventAt, brandName, status,
        pendingSourceMessageId, pendingAuditMessageId, pendingReplyText, pendingNextStatus,
        lastInboundMessageId, autoReplyCount, startedAt, expiresAt, introSentAt, completedAt
      ) VALUES (
        ${params.lineGroupId}, ${ONBOARDING_VERSION}, ${params.joinEventId}, ${params.joinEventAt}, ${brandName}, 'pending_intro',
        NULL, ${auditMessageId}, ${replyText}, 'awaiting_profile',
        NULL, 0, CURRENT_TIMESTAMP, ${expiresAt}, NULL, NULL
      )
      ON DUPLICATE KEY UPDATE
        onboardingVersion = VALUES(onboardingVersion),
        joinEventId = VALUES(joinEventId),
        joinEventAt = VALUES(joinEventAt),
        brandName = VALUES(brandName),
        status = VALUES(status),
        pendingSourceMessageId = NULL,
        pendingAuditMessageId = VALUES(pendingAuditMessageId),
        pendingReplyText = VALUES(pendingReplyText),
        pendingNextStatus = VALUES(pendingNextStatus),
        lastInboundMessageId = NULL,
        autoReplyCount = 0,
        startedAt = CURRENT_TIMESTAMP,
        expiresAt = VALUES(expiresAt),
        introSentAt = NULL,
        completedAt = NULL
    `);
    return {
      lineGroupId: params.lineGroupId,
      sourceMessageId: null,
      auditMessageId,
      replyText,
      nextStatus: "awaiting_profile",
      isIntro: true,
    };
  });
}

async function prepareReplyUsingDb(
  db: LineGroupOnboardingDb,
  params: ContinueOnboardingParams,
): Promise<PreparedOnboardingReply> {
  return db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, params.lineGroupId, false);
    const result = await tx.execute(sql`
      SELECT o.status, o.startedAt, o.expiresAt, o.autoReplyCount, o.lastInboundMessageId,
             o.pendingSourceMessageId, o.pendingAuditMessageId, o.pendingReplyText, o.pendingNextStatus,
             o.joinEventId, o.joinEventAt, g.isActive,
             l.isActive AS lifecycleIsActive, l.lastEventAt, l.lastEventId,
             s.autoReplyEnabled, u.userType, u.isBlocked
      FROM line_group_onboarding_states o
      INNER JOIN line_groups g ON g.lineGroupId = o.lineGroupId
      INNER JOIN line_group_lifecycle_states l ON l.lineGroupId = o.lineGroupId
      LEFT JOIN line_group_settings s ON s.lineGroupId = o.lineGroupId
      LEFT JOIN line_users u ON u.lineUserId = ${params.lineUserId}
      WHERE o.lineGroupId = ${params.lineGroupId}
      LIMIT 1
      FOR UPDATE
    `);
    const row = firstRow(result);
    if (!row || !Boolean(row.isActive) || !Boolean(row.autoReplyEnabled)) return null;
    if (!Boolean(row.lifecycleIsActive)) return null;
    if (
      Number(row.joinEventAt) !== Number(row.lastEventAt) ||
      String(row.joinEventId || "").slice(0, 64) !== String(row.lastEventId || "")
    ) {
      throw new Error("LINE_GROUP_ONBOARDING_LIFECYCLE_TRANSITION_PENDING");
    }
    if (row.userType === "staff" || Boolean(row.isBlocked)) return null;
    if (row.lastInboundMessageId === params.sourceMessageId) return "already_handled";
    if (row.pendingAuditMessageId) {
      if (row.pendingSourceMessageId !== params.sourceMessageId) {
        throw new Error("LINE_GROUP_ONBOARDING_PREVIOUS_DELIVERY_PENDING");
      }
      if (!row.pendingAuditMessageId || !row.pendingReplyText || !row.pendingNextStatus) return null;
      const nextStatus = parseOnboardingStatus(row.pendingNextStatus);
      if (!nextStatus) throw new Error("LINE_GROUP_ONBOARDING_INVALID_PENDING_STATUS");
      return {
        lineGroupId: params.lineGroupId,
        sourceMessageId: params.sourceMessageId,
        auditMessageId: String(row.pendingAuditMessageId),
        replyText: String(row.pendingReplyText),
        nextStatus,
        isIntro: false,
      };
    }

    const currentStatus = String(row.status) as OnboardingStatus;
    if (!["awaiting_profile", "awaiting_preferences"].includes(currentStatus)) {
      const priorAuditResult = await tx.execute(sql`
        SELECT responseStatus
        FROM line_messages
        WHERE messageId = ${buildReplyAuditMessageId(params.sourceMessageId)}
          AND direction = 'outgoing'
          AND lineGroupId = ${params.lineGroupId}
        LIMIT 1
      `);
      return firstRow(priorAuditResult) ? "already_handled" : null;
    }
    const startedAtMs = new Date(row.startedAt).getTime();
    const expiresAtMs = new Date(row.expiresAt).getTime();
    const expiredByWallClock = Date.now() > expiresAtMs;
    const eventAfterWindow = params.eventTimestamp > expiresAtMs;
    const replyLimitReached = Number(row.autoReplyCount || 0) >= MAX_AUTOMATIC_REPLIES;
    if (expiredByWallClock || eventAfterWindow || replyLimitReached) {
      await tx.execute(sql`
        UPDATE line_group_onboarding_states
        SET status = 'expired', pendingSourceMessageId = NULL, pendingAuditMessageId = NULL,
            pendingReplyText = NULL, pendingNextStatus = NULL
        WHERE lineGroupId = ${params.lineGroupId}
      `);
      return null;
    }
    if (params.eventTimestamp < startedAtMs) return null;

    const composed = composeLineGroupOnboardingReply(params.text, currentStatus);
    const auditMessageId = buildReplyAuditMessageId(params.sourceMessageId);
    await tx.execute(sql`
      UPDATE line_group_onboarding_states
      SET pendingSourceMessageId = ${params.sourceMessageId},
          pendingAuditMessageId = ${auditMessageId},
          pendingReplyText = ${composed.replyText},
          pendingNextStatus = ${composed.nextStatus}
      WHERE lineGroupId = ${params.lineGroupId}
    `);
    return {
      lineGroupId: params.lineGroupId,
      sourceMessageId: params.sourceMessageId,
      auditMessageId,
      replyText: composed.replyText,
      nextStatus: composed.nextStatus,
      isIntro: false,
    };
  });
}

async function deliveryRemainsEligible(
  db: LineGroupOnboardingDb,
  lineGroupId: string,
  auditMessageId: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT g.isActive, s.autoReplyEnabled, o.pendingAuditMessageId,
           o.joinEventId, o.joinEventAt,
           l.isActive AS lifecycleIsActive, l.lastEventAt, l.lastEventId
    FROM line_groups g
    LEFT JOIN line_group_settings s ON s.lineGroupId = g.lineGroupId
    LEFT JOIN line_group_onboarding_states o ON o.lineGroupId = g.lineGroupId
    LEFT JOIN line_group_lifecycle_states l ON l.lineGroupId = g.lineGroupId
    WHERE g.lineGroupId = ${lineGroupId}
    LIMIT 1
  `);
  const row = firstRow(result);
  return Boolean(row?.isActive) &&
    Boolean(row?.lifecycleIsActive) &&
    Boolean(row?.autoReplyEnabled) &&
    row?.pendingAuditMessageId === auditMessageId &&
    Number(row?.joinEventAt) === Number(row?.lastEventAt) &&
    String(row?.joinEventId || "").slice(0, 64) === String(row?.lastEventId || "");
}

async function cancelPendingDeliveryUsingDb(
  db: LineGroupOnboardingDb,
  delivery: PendingOnboardingDelivery,
): Promise<void> {
  await db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, delivery.lineGroupId, false);
    await tx.execute(sql`
      UPDATE line_group_onboarding_states
      SET status = 'expired', pendingSourceMessageId = NULL, pendingAuditMessageId = NULL,
          pendingReplyText = NULL, pendingNextStatus = NULL, completedAt = CURRENT_TIMESTAMP
      WHERE lineGroupId = ${delivery.lineGroupId}
        AND pendingAuditMessageId = ${delivery.auditMessageId}
    `);
    await tx.execute(sql`
      UPDATE line_messages
      SET responseStatus = 'cancelled', responseSummary = 'LINEグループ自動応答の対象外となったため送信中止'
      WHERE messageId = ${delivery.auditMessageId}
        AND direction = 'outgoing'
        AND responseStatus = 'pending'
    `);
  });
}

async function completeDeliveryUsingDb(
  db: LineGroupOnboardingDb,
  delivery: PendingOnboardingDelivery,
): Promise<void> {
  await db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, delivery.lineGroupId, false);
    await tx.execute(sql`
      UPDATE line_group_onboarding_states
      SET status = ${delivery.nextStatus},
          lastInboundMessageId = COALESCE(${delivery.sourceMessageId}, lastInboundMessageId),
          autoReplyCount = autoReplyCount + ${delivery.isIntro ? 0 : 1},
          introSentAt = CASE WHEN ${delivery.isIntro} THEN COALESCE(introSentAt, CURRENT_TIMESTAMP) ELSE introSentAt END,
          completedAt = CASE WHEN ${delivery.nextStatus} = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
          pendingSourceMessageId = NULL,
          pendingAuditMessageId = NULL,
          pendingReplyText = NULL,
          pendingNextStatus = NULL
      WHERE lineGroupId = ${delivery.lineGroupId}
        AND pendingAuditMessageId = ${delivery.auditMessageId}
    `);
  });
}

async function deliverPendingOnboarding(
  db: LineGroupOnboardingDb,
  delivery: PendingOnboardingDelivery,
): Promise<boolean> {
  const reservation = await reserveLineOutgoingAudit({
    messageId: delivery.auditMessageId,
    sourceType: "group",
    lineGroupId: delivery.lineGroupId,
    senderName: LINE_PUBLIC_CONTACT_NAME,
    content: delivery.replyText,
    lineTimestamp: Date.now(),
    pendingSummary: delivery.isIntro ? "LINEグループ初回案内送信中" : "LINEグループ初回会話応答送信中",
  });
  if (reservation.status === "responded") {
    await completeDeliveryUsingDb(db, delivery);
    return true;
  }
  if (reservation.status === "cancelled" || reservation.status === "none") {
    await cancelPendingDeliveryUsingDb(db, delivery);
    return false;
  }
  if (!await deliveryRemainsEligible(db, delivery.lineGroupId, delivery.auditMessageId)) {
    await cancelPendingDeliveryUsingDb(db, delivery);
    return false;
  }

  const sent = await pushMessage(
    delivery.lineGroupId,
    [{ type: "text", text: delivery.replyText }],
    onboardingDeliveryRetryKey(delivery.auditMessageId),
  );
  if (!sent) throw new Error("LINE_GROUP_ONBOARDING_DELIVERY_FAILED");
  await finalizeLineOutgoingAudit(
    delivery.auditMessageId,
    delivery.isIntro ? "LINEグループ初回案内送信済み" : "LINEグループ初回会話応答送信済み",
  );
  await completeDeliveryUsingDb(db, delivery);
  return true;
}

async function readPendingDeliveryUsingDb(
  db: LineGroupOnboardingDb,
  lineGroupId: string,
): Promise<{ delivery: PendingOnboardingDelivery | null; expired: boolean }> {
  return db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, lineGroupId, false);
    const result = await tx.execute(sql`
      SELECT pendingSourceMessageId, pendingAuditMessageId, pendingReplyText,
             pendingNextStatus, expiresAt
      FROM line_group_onboarding_states
      WHERE lineGroupId = ${lineGroupId}
      LIMIT 1
      FOR UPDATE
    `);
    const row = firstRow(result);
    if (!row?.pendingAuditMessageId || !row.pendingReplyText || !row.pendingNextStatus) {
      return { delivery: null, expired: false };
    }
    const nextStatus = parseOnboardingStatus(row.pendingNextStatus);
    const auditMessageId = String(row.pendingAuditMessageId);
    const replyText = String(row.pendingReplyText);
    const expiresAtMs = new Date(row.expiresAt).getTime();
    if (
      !nextStatus ||
      !["awaiting_profile", "awaiting_preferences", "completed"].includes(nextStatus) ||
      !auditMessageId.startsWith("line:onboard:") ||
      replyText.length < 1 ||
      replyText.length > 5_000 ||
      !Number.isFinite(expiresAtMs)
    ) {
      await tx.execute(sql`
        UPDATE line_group_onboarding_states
        SET status = 'expired', pendingSourceMessageId = NULL, pendingAuditMessageId = NULL,
            pendingReplyText = NULL, pendingNextStatus = NULL, completedAt = CURRENT_TIMESTAMP
        WHERE lineGroupId = ${lineGroupId}
          AND pendingAuditMessageId = ${String(row.pendingAuditMessageId)}
      `);
      await tx.execute(sql`
        UPDATE line_messages
        SET responseStatus = 'cancelled', responseSummary = '不正なLINEグループonboarding pending stateのため送信中止'
        WHERE messageId = ${String(row.pendingAuditMessageId)}
          AND direction = 'outgoing'
          AND responseStatus = 'pending'
      `);
      return { delivery: null, expired: false };
    }
    return {
      delivery: {
        lineGroupId,
        sourceMessageId: row.pendingSourceMessageId ? String(row.pendingSourceMessageId) : null,
        auditMessageId,
        replyText,
        nextStatus,
        isIntro: !row.pendingSourceMessageId,
      },
      expired: Date.now() > expiresAtMs,
    };
  });
}

export async function recoverPendingLineGroupOnboardingDeliveries(limit = 5): Promise<{
  inspected: number;
  recovered: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("LINE_GROUP_ONBOARDING_DB_UNAVAILABLE");
  const boundedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(20, Math.floor(limit)))
    : 5;
  const candidates = resultRows(await db.execute(sql`
    SELECT lineGroupId
    FROM line_group_onboarding_states
    WHERE pendingAuditMessageId IS NOT NULL
      AND updatedAt <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 SECOND)
    ORDER BY updatedAt ASC
    LIMIT ${boundedLimit}
  `));
  let recovered = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const lineGroupId = String(candidate.lineGroupId || "");
    if (!lineGroupId) continue;
    try {
      const pending = await readPendingDeliveryUsingDb(db, lineGroupId);
      if (!pending.delivery) continue;
      if (pending.expired) {
        await cancelPendingDeliveryUsingDb(db, pending.delivery);
        continue;
      }
      if (await deliverPendingOnboarding(db, pending.delivery)) recovered += 1;
    } catch (error) {
      failed += 1;
      await db.execute(sql`
        UPDATE line_group_onboarding_states
        SET updatedAt = CURRENT_TIMESTAMP
        WHERE lineGroupId = ${lineGroupId}
          AND pendingAuditMessageId IS NOT NULL
      `).catch(() => undefined);
      console.error("[LINE Group Onboarding] Pending delivery recovery failed:", {
        lineGroupId,
        code: error instanceof Error ? error.message : "UNKNOWN",
      });
    }
  }
  return { inspected: candidates.length, recovered, failed };
}

export async function beginLineGroupOnboarding(params: BeginOnboardingParams): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("LINE_GROUP_ONBOARDING_DB_UNAVAILABLE");
  const delivery = await prepareJoinUsingDb(db, params);
  if (!delivery) return false;
  return deliverPendingOnboarding(db, delivery);
}

export async function continueLineGroupOnboarding(params: ContinueOnboardingParams): Promise<boolean> {
  if (params.isExplicitMention) {
    const { classifyLineGroupPublicQuestion } = await import("./lineGroupPublicQuestion");
    if (classifyLineGroupPublicQuestion(params.text)) return false;
  }
  const db = await getDb();
  if (!db) throw new Error("LINE_GROUP_ONBOARDING_DB_UNAVAILABLE");
  const delivery = await prepareReplyUsingDb(db, params);
  if (delivery === "already_handled") return true;
  if (!delivery) return false;
  return deliverPendingOnboarding(db, delivery);
}

export const __lineGroupOnboardingTestUtils = {
  classifyOnboardingReply,
  prepareJoinUsingDb,
  prepareReplyUsingDb,
  readPendingDeliveryUsingDb,
  completeDeliveryUsingDb,
  deliverPendingOnboarding,
};
