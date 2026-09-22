import { sql } from "drizzle-orm";
import {
  bumpLineGroupConversationRevisionUsingExecutor,
  getDb,
  lockLineGroupConversationUsingExecutor,
} from "./db";

const MAX_REVIEW_GROUPS = 200;
const MAX_PREVIEW_LENGTH = 500;
const MAX_SENDER_NAME_LENGTH = 120;

export type LineGroupReplyRecommendation =
  | "sample_request"
  | "commercial_terms"
  | "schedule"
  | "question"
  | "request"
  | "no_reply";

export type LineGroupReplyReviewItem = {
  lineGroupId: string;
  groupName: string;
  pictureUrl: string | null;
  incomingMessageId: string;
  incomingMessageDbId: number;
  conversationRevision: number;
  senderLineUserId: string | null;
  senderName: string;
  contentPreview: string;
  unansweredMessageCount: number;
  deliveryPending: boolean;
  receivedAt: string;
  elapsedMinutes: number;
  recommendation: LineGroupReplyRecommendation;
  shouldReply: boolean;
  reason: string;
  suggestedReply: string | null;
  analysisEnabled: boolean;
  autoReplyEnabled: boolean;
};

type QueueRow = {
  lineGroupId?: unknown;
  groupName?: unknown;
  pictureUrl?: unknown;
  incomingMessageId?: unknown;
  incomingMessageDbId?: unknown;
  conversationRevision?: unknown;
  senderLineUserId?: unknown;
  senderName?: unknown;
  content?: unknown;
  unansweredContext?: unknown;
  unansweredMessageCount?: unknown;
  deliveryPending?: unknown;
  lineTimestamp?: unknown;
  createdAt?: unknown;
  analysisEnabled?: unknown;
  autoReplyEnabled?: unknown;
};

function firstExecuteRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  if (Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function finiteBoolean(value: unknown, fallback = true): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function sanitizePreview(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isChineseText(text: string): boolean {
  if (/[\u3040-\u30ff]/.test(text)) return false;
  return /[\u3400-\u9fff]/.test(text) && /(?:可以|能否|请问|样品|報酬|佣金|条件|什么时候|安排|直播)/.test(text);
}

export function classifyLineGroupReplyNeed(text: string): {
  recommendation: LineGroupReplyRecommendation;
  shouldReply: boolean;
  reason: string;
  suggestedReply: string | null;
} {
  const normalized = text.replace(/[＠@](?:LCJ|714isnih)\b/gi, " ").trim();
  const chinese = isChineseText(normalized);
  const sampleRequest = /(?:サンプル|試供品|お試し|送って|送付).*(?:可能|できます|いただけ|欲しい)|(?:可能|できます|いただけ).*(?:サンプル|試供品)|(?:样品|试用品).*(?:可以|能否|寄|发送)|(?:可以|能否).*(?:样品|试用品)/i.test(normalized);
  const commercialTerms = /(?:報酬|成果報酬|手数料|コミッション|条件|契約|支払|支払い|単価|在庫|発送|納期|割引|折扣|佣金|报酬|条件|合同|付款|库存|发货|到货)/i.test(normalized);
  const schedule = /(?:配信|動画|投稿|ライブ).*(?:予定|日程|いつ|日時|可能|できます)|(?:予定|日程|いつ|日時).*(?:配信|動画|投稿|ライブ)|(?:直播|视频|投稿).*(?:安排|时间|什么时候|可以)/i.test(normalized);
  const question = /[?？]|(?:可能でしょうか|できますか|でしょうか|ですか|教えて|確認したい|请问|可以吗|能否|怎么样)/i.test(normalized);
  const request = /(?:お願い|希望|確認|対応|紹介|案内|相談|教えて|ください|麻烦|希望|确认|介绍|咨询|请)/i.test(normalized);
  const acknowledgementOnly = /^(?:ありがとう(?:ございます)?[!！。.]?|承知しました[!！。.]?|了解しました[!！。.]?|確認しました[!！。.]?|よろしくお願いします[!！。.]?|ありがとうございます、?よろしくお願いします[!！。.]?|好的[!！。.]?|收到[!！。.]?|谢谢[!！。.]?|ok[!！。.]?)$/i.test(normalized);

  if (sampleRequest) {
    return {
      recommendation: "sample_request",
      shouldReply: true,
      reason: chinese ? "样品提供问题" : "サンプル提供の質問",
      suggestedReply: chinese
        ? "感谢您分享账号信息。关于样品是否可以提供，我们会先向品牌方确认。收件地址等个人信息请不要发在群里，如有需要我们会另行说明。"
        : "アカウントの共有ありがとうございます。サンプル提供の可否をブランド側へ確認します。送付先などの個人情報はグループに書かず、必要になった場合は個別にご案内します。",
    };
  }
  if (commercialTerms) {
    return {
      recommendation: "commercial_terms",
      shouldReply: true,
      reason: chinese ? "合作条件需要确认" : "取引条件の確認が必要",
      suggestedReply: chinese
        ? "感谢您的提问。报酬、合作条件、库存和发货时间需要确认后再向您说明，目前还不能作为确定事项答复。确认后我们会在群里回复。"
        : "ご質問ありがとうございます。報酬・取引条件・在庫・発送時期は確認後にご案内します。現時点では確定としてお伝えできないため、確認でき次第このグループでご連絡します。",
    };
  }
  if (schedule) {
    return {
      recommendation: "schedule",
      shouldReply: true,
      reason: chinese ? "直播或视频日程" : "配信・動画の日程確認",
      suggestedReply: chinese
        ? "感谢您分享计划。我们已确认您提到的直播或视频安排。需要准备的事项和合适的商品候选，我们会整理后在群里回复。"
        : "ご予定の共有ありがとうございます。配信・動画の予定を確認しました。必要な準備や商品候補について整理し、確認でき次第このグループでご案内します。",
    };
  }
  if (acknowledgementOnly) {
    return {
      recommendation: "no_reply",
      shouldReply: false,
      reason: chinese ? "仅为确认或致谢" : "確認・お礼のみ",
      suggestedReply: null,
    };
  }
  if (question) {
    return {
      recommendation: "question",
      shouldReply: true,
      reason: chinese ? "明确提问" : "明示的な質問",
      suggestedReply: chinese
        ? "感谢您的提问。我们已确认内容，需要核实的事项会在确认后于本群回复。"
        : "ご質問ありがとうございます。内容を確認しました。確認が必要な点を整理し、確認でき次第このグループでご案内します。",
    };
  }
  if (request) {
    return {
      recommendation: "request",
      shouldReply: true,
      reason: chinese ? "请求或需要跟进" : "依頼・確認事項",
      suggestedReply: chinese
        ? "感谢您的联系。我们已确认内容，会整理需要处理的事项并在确认后于本群回复。"
        : "ご連絡ありがとうございます。内容を確認しました。必要な対応を整理し、確認でき次第このグループでご案内します。",
    };
  }
  return {
    recommendation: "no_reply",
    shouldReply: false,
    reason: chinese ? "未检测到明确问题" : "明示的な質問・依頼なし",
    suggestedReply: null,
  };
}

function rowEventTime(row: QueueRow): Date {
  const lineTimestamp = Number(row.lineTimestamp || 0);
  if (Number.isFinite(lineTimestamp) && lineTimestamp > 0) return new Date(lineTimestamp);
  const fallback = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt || ""));
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

export async function getLineGroupReplyReviewQueue(): Promise<LineGroupReplyReviewItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql`
    SELECT
      g.lineGroupId,
      g.groupName,
      g.pictureUrl,
      incoming.messageId AS incomingMessageId,
      incoming.id AS incomingMessageDbId,
      g.conversationRevision,
      incoming.lineUserId AS senderLineUserId,
      incoming.senderName,
      incoming.content,
      COALESCE((
        SELECT GROUP_CONCAT(
          LEFT(recent.content, 500)
          ORDER BY recent.id DESC
          SEPARATOR '\n'
        )
        FROM line_messages recent
        LEFT JOIN line_users recentSender ON recentSender.lineUserId = recent.lineUserId
        WHERE recent.lineGroupId = g.lineGroupId
          AND recent.sourceType = 'group'
          AND recent.direction = 'incoming'
          AND recent.messageType = 'text'
          AND recent.responseStatus NOT IN ('responded', 'cancelled')
          AND NULLIF(TRIM(recent.content), '') IS NOT NULL
          AND COALESCE(recentSender.isBlocked, FALSE) = FALSE
          AND COALESCE(recentSender.userType, 'unknown') <> 'staff'
          AND NOT EXISTS (
            SELECT 1
            FROM line_messages previousOutgoing
            WHERE previousOutgoing.lineGroupId = g.lineGroupId
              AND previousOutgoing.sourceType = 'group'
              AND previousOutgoing.direction = 'outgoing'
              AND previousOutgoing.responseStatus = 'responded'
              AND (
                previousOutgoing.messageId LIKE 'manual:%'
                OR previousOutgoing.messageId LIKE 'ai-manager:%'
                OR previousOutgoing.messageId LIKE 'group-public-question:%'
                OR previousOutgoing.messageId LIKE 'line:onboard:r:%'
              )
              AND (
                COALESCE(previousOutgoing.lineTimestamp, UNIX_TIMESTAMP(previousOutgoing.createdAt) * 1000) >
                  COALESCE(recent.lineTimestamp, UNIX_TIMESTAMP(recent.createdAt) * 1000)
                OR (
                  COALESCE(previousOutgoing.lineTimestamp, UNIX_TIMESTAMP(previousOutgoing.createdAt) * 1000) =
                    COALESCE(recent.lineTimestamp, UNIX_TIMESTAMP(recent.createdAt) * 1000)
                  AND previousOutgoing.id > recent.id
                )
              )
          )
      ), incoming.content) AS unansweredContext,
      (
        SELECT COUNT(*)
        FROM line_messages recentCount
        LEFT JOIN line_users recentCountSender ON recentCountSender.lineUserId = recentCount.lineUserId
        WHERE recentCount.lineGroupId = g.lineGroupId
          AND recentCount.sourceType = 'group'
          AND recentCount.direction = 'incoming'
          AND recentCount.messageType = 'text'
          AND recentCount.responseStatus NOT IN ('responded', 'cancelled')
          AND NULLIF(TRIM(recentCount.content), '') IS NOT NULL
          AND COALESCE(recentCountSender.isBlocked, FALSE) = FALSE
          AND COALESCE(recentCountSender.userType, 'unknown') <> 'staff'
          AND NOT EXISTS (
            SELECT 1
            FROM line_messages previousOutgoingCount
            WHERE previousOutgoingCount.lineGroupId = g.lineGroupId
              AND previousOutgoingCount.sourceType = 'group'
              AND previousOutgoingCount.direction = 'outgoing'
              AND previousOutgoingCount.responseStatus = 'responded'
              AND (
                previousOutgoingCount.messageId LIKE 'manual:%'
                OR previousOutgoingCount.messageId LIKE 'ai-manager:%'
                OR previousOutgoingCount.messageId LIKE 'group-public-question:%'
                OR previousOutgoingCount.messageId LIKE 'line:onboard:r:%'
              )
              AND (
                COALESCE(previousOutgoingCount.lineTimestamp, UNIX_TIMESTAMP(previousOutgoingCount.createdAt) * 1000) >
                  COALESCE(recentCount.lineTimestamp, UNIX_TIMESTAMP(recentCount.createdAt) * 1000)
                OR (
                  COALESCE(previousOutgoingCount.lineTimestamp, UNIX_TIMESTAMP(previousOutgoingCount.createdAt) * 1000) =
                    COALESCE(recentCount.lineTimestamp, UNIX_TIMESTAMP(recentCount.createdAt) * 1000)
                  AND previousOutgoingCount.id > recentCount.id
                )
              )
          )
      ) AS unansweredMessageCount,
      EXISTS (
        SELECT 1
        FROM line_messages pendingOutgoing
        WHERE pendingOutgoing.lineGroupId = g.lineGroupId
          AND pendingOutgoing.sourceType = 'group'
          AND pendingOutgoing.direction = 'outgoing'
          AND pendingOutgoing.responseStatus = 'pending'
          AND (
            pendingOutgoing.messageId LIKE 'manual:%'
            OR pendingOutgoing.messageId LIKE 'ai-manager:%'
            OR pendingOutgoing.messageId LIKE 'group-public-question:%'
            OR pendingOutgoing.messageId LIKE 'line:onboard:r:%'
          )
          AND (
            COALESCE(pendingOutgoing.lineTimestamp, UNIX_TIMESTAMP(pendingOutgoing.createdAt) * 1000) >
              COALESCE(incoming.lineTimestamp, UNIX_TIMESTAMP(incoming.createdAt) * 1000)
            OR (
              COALESCE(pendingOutgoing.lineTimestamp, UNIX_TIMESTAMP(pendingOutgoing.createdAt) * 1000) =
                COALESCE(incoming.lineTimestamp, UNIX_TIMESTAMP(incoming.createdAt) * 1000)
              AND pendingOutgoing.id > incoming.id
            )
          )
      ) AS deliveryPending,
      incoming.lineTimestamp,
      incoming.createdAt,
      COALESCE(settings.analysisEnabled, TRUE) AS analysisEnabled,
      COALESCE(settings.autoReplyEnabled, TRUE) AS autoReplyEnabled
    FROM line_groups g
    INNER JOIN line_group_lifecycle_states lifecycle
      ON lifecycle.lineGroupId = g.lineGroupId
      AND lifecycle.isActive = TRUE
    INNER JOIN line_messages incoming
      ON incoming.id = (
        SELECT candidate.id
        FROM line_messages candidate
        LEFT JOIN line_users candidateSender ON candidateSender.lineUserId = candidate.lineUserId
        WHERE candidate.lineGroupId = g.lineGroupId
          AND candidate.sourceType = 'group'
          AND candidate.direction = 'incoming'
          AND candidate.messageType = 'text'
          AND candidate.responseStatus NOT IN ('responded', 'cancelled')
          AND NULLIF(TRIM(candidate.content), '') IS NOT NULL
          AND COALESCE(candidateSender.isBlocked, FALSE) = FALSE
          AND COALESCE(candidateSender.userType, 'unknown') <> 'staff'
        ORDER BY
          COALESCE(candidate.lineTimestamp, UNIX_TIMESTAMP(candidate.createdAt) * 1000) DESC,
          candidate.id DESC
        LIMIT 1
      )
    LEFT JOIN line_group_settings settings ON settings.lineGroupId = g.lineGroupId
    LEFT JOIN line_users sender ON sender.lineUserId = incoming.lineUserId
    WHERE g.isActive = TRUE
      AND incoming.responseStatus NOT IN ('responded', 'cancelled')
      AND COALESCE(sender.isBlocked, FALSE) = FALSE
      AND COALESCE(sender.userType, 'unknown') <> 'staff'
      AND NOT EXISTS (
        SELECT 1
        FROM line_messages outgoing
        WHERE outgoing.lineGroupId = g.lineGroupId
          AND outgoing.sourceType = 'group'
          AND outgoing.direction = 'outgoing'
          AND outgoing.responseStatus = 'responded'
          AND (
            outgoing.messageId LIKE 'manual:%'
            OR outgoing.messageId LIKE 'ai-manager:%'
            OR outgoing.messageId LIKE 'group-public-question:%'
            OR outgoing.messageId LIKE 'line:onboard:r:%'
          )
          AND (
            COALESCE(outgoing.lineTimestamp, UNIX_TIMESTAMP(outgoing.createdAt) * 1000) >
              COALESCE(incoming.lineTimestamp, UNIX_TIMESTAMP(incoming.createdAt) * 1000)
            OR (
              COALESCE(outgoing.lineTimestamp, UNIX_TIMESTAMP(outgoing.createdAt) * 1000) =
                COALESCE(incoming.lineTimestamp, UNIX_TIMESTAMP(incoming.createdAt) * 1000)
              AND outgoing.id > incoming.id
            )
          )
      )
    ORDER BY
      COALESCE(incoming.lineTimestamp, UNIX_TIMESTAMP(incoming.createdAt) * 1000) DESC,
      incoming.id DESC
    LIMIT ${MAX_REVIEW_GROUPS}
  `);

  const now = Date.now();
  return firstExecuteRows<QueueRow>(result).map(row => {
    const contentPreview = sanitizePreview(row.content, MAX_PREVIEW_LENGTH);
    const unansweredContext = sanitizePreview(row.unansweredContext, 2_000) || contentPreview;
    const classification = classifyLineGroupReplyNeed(unansweredContext);
    const receivedAt = rowEventTime(row);
    return {
      lineGroupId: sanitizePreview(row.lineGroupId, 64),
      groupName: sanitizePreview(row.groupName, 255) || sanitizePreview(row.lineGroupId, 64),
      pictureUrl: row.pictureUrl ? String(row.pictureUrl) : null,
      incomingMessageId: sanitizePreview(row.incomingMessageId, 64),
      incomingMessageDbId: Math.max(0, Number(row.incomingMessageDbId || 0)),
      conversationRevision: Math.max(0, Number(row.conversationRevision || 0)),
      senderLineUserId: row.senderLineUserId ? sanitizePreview(row.senderLineUserId, 64) : null,
      senderName: sanitizePreview(row.senderName, MAX_SENDER_NAME_LENGTH) || "参加者",
      contentPreview,
      unansweredMessageCount: Math.max(1, Number(row.unansweredMessageCount || 1)),
      deliveryPending: finiteBoolean(row.deliveryPending),
      receivedAt: receivedAt.toISOString(),
      elapsedMinutes: Math.max(0, Math.floor((now - receivedAt.getTime()) / 60_000)),
      ...classification,
      analysisEnabled: finiteBoolean(row.analysisEnabled),
      autoReplyEnabled: finiteBoolean(row.autoReplyEnabled),
    };
  }).sort((left, right) => {
    if (left.shouldReply !== right.shouldReply) return left.shouldReply ? -1 : 1;
    return right.incomingMessageDbId - left.incomingMessageDbId;
  });
}

export async function dismissLineGroupReplyReviewItem(params: {
  lineGroupId: string;
  incomingMessageId: string;
  dismissedBy: string;
}): Promise<{ dismissed: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async tx => {
    await lockLineGroupConversationUsingExecutor(tx, params.lineGroupId, false);
    const targetResult = await tx.execute(sql`
      SELECT target.id
      FROM line_messages selected
      INNER JOIN line_messages target ON target.lineGroupId = selected.lineGroupId
      LEFT JOIN line_users targetSender ON targetSender.lineUserId = target.lineUserId
      WHERE selected.messageId = ${params.incomingMessageId}
        AND selected.lineGroupId = ${params.lineGroupId}
        AND selected.sourceType = 'group'
        AND selected.direction = 'incoming'
        AND selected.responseStatus NOT IN ('responded', 'cancelled')
        AND target.sourceType = 'group'
        AND target.direction = 'incoming'
        AND target.messageType = 'text'
        AND target.responseStatus NOT IN ('responded', 'cancelled')
        AND COALESCE(targetSender.isBlocked, FALSE) = FALSE
        AND COALESCE(targetSender.userType, 'unknown') <> 'staff'
        AND (
          COALESCE(target.lineTimestamp, UNIX_TIMESTAMP(target.createdAt) * 1000) <
            COALESCE(selected.lineTimestamp, UNIX_TIMESTAMP(selected.createdAt) * 1000)
          OR (
            COALESCE(target.lineTimestamp, UNIX_TIMESTAMP(target.createdAt) * 1000) =
              COALESCE(selected.lineTimestamp, UNIX_TIMESTAMP(selected.createdAt) * 1000)
            AND target.id <= selected.id
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM line_messages replied
          WHERE replied.lineGroupId = target.lineGroupId
            AND replied.sourceType = 'group'
            AND replied.direction = 'outgoing'
            AND replied.responseStatus = 'responded'
            AND (
              replied.messageId LIKE 'manual:%'
              OR replied.messageId LIKE 'ai-manager:%'
              OR replied.messageId LIKE 'group-public-question:%'
              OR replied.messageId LIKE 'line:onboard:r:%'
            )
            AND (
              COALESCE(replied.lineTimestamp, UNIX_TIMESTAMP(replied.createdAt) * 1000) >
                COALESCE(target.lineTimestamp, UNIX_TIMESTAMP(target.createdAt) * 1000)
              OR (
                COALESCE(replied.lineTimestamp, UNIX_TIMESTAMP(replied.createdAt) * 1000) =
                  COALESCE(target.lineTimestamp, UNIX_TIMESTAMP(target.createdAt) * 1000)
                AND replied.id > target.id
              )
            )
        )
    `);
    const targetIds = firstExecuteRows<{ id?: number | string }>(targetResult)
      .map(row => String(row.id || ""))
      .filter(id => /^\d+$/.test(id));
    if (targetIds.length === 0) return { dismissed: false };
    const result: any = await tx.execute(sql`
      UPDATE line_messages
      SET responseStatus = 'cancelled',
          needsResponse = FALSE,
          respondedAt = NOW(),
          respondedBy = ${params.dismissedBy}
      WHERE id IN (${sql.join(targetIds.map(id => sql`${id}`), sql`, `)})
        AND lineGroupId = ${params.lineGroupId}
        AND sourceType = 'group'
        AND direction = 'incoming'
        AND responseStatus NOT IN ('responded', 'cancelled')
    `);
    const header = Array.isArray(result) ? result[0] : result;
    const dismissed = Number(header?.affectedRows || 0) >= 1;
    if (dismissed) {
      await bumpLineGroupConversationRevisionUsingExecutor(tx, params.lineGroupId);
    }
    return { dismissed };
  });
}

export const __lineGroupReplyReviewTestUtils = {
  firstExecuteRows,
  finiteBoolean,
  sanitizePreview,
};
