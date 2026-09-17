import { sql } from "drizzle-orm";
import { responseSpeedBand, type PerformanceResponseStatus } from "../shared/performancePolicy";
import type { PerformanceDatabase } from "./performanceUpgrade";

export type ResponseFactObservation = {
  staffId: number;
  channel: "line" | "sales_email" | "internal_chat" | "issue";
  sourceType: string;
  sourceId: string;
  requestAt: Date;
  respondedAt: Date | null;
  closedAt: Date | null;
  status: PerformanceResponseStatus;
  applicable: boolean;
  exclusionReason: string | null;
  evidence: Record<string, unknown>;
};

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function jstDate(value: Date): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function responseMinutesBetween(start: Date, end: Date | null): number | null {
  if (!end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return minutes >= 0 ? minutes : null;
}

export function buildResponseFactKey(input: Pick<ResponseFactObservation, "channel" | "sourceType" | "sourceId" | "staffId">): string {
  return [input.channel, input.sourceType, input.sourceId, input.staffId].join(":");
}

function missingSourceTable(error: unknown): boolean {
  return /doesn't exist|does not exist|ER_NO_SUCH_TABLE|Unknown column/i.test(String((error as any)?.message || error));
}

async function collectLineFacts(db: PerformanceDatabase, effectiveFrom: string): Promise<ResponseFactObservation[]> {
  try {
    const result = await db.execute(sql`
      SELECT message.messageId AS sourceId, message.createdAt AS requestAt,
        message.respondedAt, account.staffId
      FROM line_messages message
      INNER JOIN line_users account
        ON account.lineUserId = message.respondedBy
        AND account.staffId IS NOT NULL
        AND account.userType = 'staff'
      INNER JOIN staff member
        ON member.id = account.staffId
        AND member.isActive = 'active'
        AND member.archivedAt IS NULL
        AND member.mergedIntoStaffId IS NULL
      WHERE message.needsResponse = TRUE
        AND message.direction = 'incoming'
        AND message.responseStatus = 'responded'
        AND message.respondedAt IS NOT NULL
        AND DATE(message.createdAt) >= ${effectiveFrom}
    `);
    return rowsOf<any>(result).flatMap(row => {
      const requestAt = toDate(row.requestAt);
      const respondedAt = toDate(row.respondedAt);
      if (!requestAt || !respondedAt || !row.staffId) return [];
      return [{
        staffId: Number(row.staffId),
        channel: "line" as const,
        sourceType: "line_message",
        sourceId: String(row.sourceId),
        requestAt,
        respondedAt,
        closedAt: respondedAt,
        status: "responded" as const,
        applicable: true,
        exclusionReason: null,
        evidence: {
          messageId: String(row.sourceId),
          needsResponse: true,
          identityPath: "respondedBy->line_users.staffId",
          contentIncluded: false,
        },
      }];
    });
  } catch (error) {
    if (missingSourceTable(error)) return [];
    throw error;
  }
}

async function collectSalesEmailFacts(db: PerformanceDatabase, effectiveFrom: string): Promise<ResponseFactObservation[]> {
  try {
    const result = await db.execute(sql`
      SELECT email_log.id AS sourceId, email_log.replyReceivedAt AS requestAt,
        email_log.repliedByUsAt, email_log.replyHandledAt,
        member.id AS staffId
      FROM sales_email_logs email_log
      INNER JOIN users account ON account.id = email_log.sentBy
      INNER JOIN staff member
        ON LOWER(TRIM(member.email)) = LOWER(TRIM(REGEXP_REPLACE(account.email, '^(resigned|disabled)_[0-9]+_', '')))
        AND member.isActive = 'active'
        AND member.archivedAt IS NULL
        AND member.mergedIntoStaffId IS NULL
      WHERE email_log.replyReceived = TRUE
        AND email_log.replyReceivedAt IS NOT NULL
        AND DATE(email_log.replyReceivedAt) >= ${effectiveFrom}
    `);
    return rowsOf<any>(result).flatMap(row => {
      const requestAt = toDate(row.requestAt);
      if (!requestAt || !row.staffId) return [];
      const repliedAt = toDate(row.repliedByUsAt);
      const handledAt = toDate(row.replyHandledAt);
      const respondedAt = repliedAt || handledAt;
      return [{
        staffId: Number(row.staffId),
        channel: "sales_email" as const,
        sourceType: "sales_email_log",
        sourceId: String(row.sourceId),
        requestAt,
        respondedAt,
        closedAt: handledAt || repliedAt,
        status: respondedAt ? "closed" as const : "pending" as const,
        applicable: true,
        exclusionReason: null,
        evidence: {
          emailLogId: Number(row.sourceId),
          responsibilityPath: "sentBy->users.email->staff.email",
          replyReceived: true,
          repliedByUs: Boolean(repliedAt),
          replyHandled: Boolean(handledAt),
          contentIncluded: false,
        },
      }];
    });
  } catch (error) {
    if (missingSourceTable(error)) return [];
    throw error;
  }
}

async function collectIssueFacts(db: PerformanceDatabase, effectiveFrom: string): Promise<ResponseFactObservation[]> {
  try {
    const result = await db.execute(sql`
      SELECT issue.id AS sourceId, issue.createdAt AS requestAt, issue.completedAt,
        issue.creatorId, issue.assigneeId, member.id AS staffId,
        (
          SELECT MIN(comment.createdAt)
          FROM issue_comments comment
          WHERE comment.issueId = issue.id
            AND comment.type = 'comment'
            AND comment.authorId = issue.assigneeId
            AND (issue.creatorId IS NULL OR comment.authorId <> issue.creatorId)
        ) AS firstResponseAt
      FROM issues issue
      INNER JOIN users account ON account.id = issue.assigneeId
      INNER JOIN staff member
        ON LOWER(TRIM(member.email)) = LOWER(TRIM(REGEXP_REPLACE(account.email, '^(resigned|disabled)_[0-9]+_', '')))
        AND member.isActive = 'active'
        AND member.archivedAt IS NULL
        AND member.mergedIntoStaffId IS NULL
      WHERE issue.assigneeId IS NOT NULL
        AND DATE(issue.createdAt) >= ${effectiveFrom}
    `);
    return rowsOf<any>(result).flatMap(row => {
      const requestAt = toDate(row.requestAt);
      if (!requestAt || !row.staffId) return [];
      const firstResponseAt = toDate(row.firstResponseAt);
      const completedAt = toDate(row.completedAt);
      const selfAssignedByCreator = row.creatorId != null && Number(row.creatorId) === Number(row.assigneeId);
      return [{
        staffId: Number(row.staffId),
        channel: "issue" as const,
        sourceType: "issue_assignment",
        sourceId: String(row.sourceId),
        requestAt,
        respondedAt: firstResponseAt,
        closedAt: completedAt,
        status: completedAt ? "closed" as const : firstResponseAt ? "responded" as const : "pending" as const,
        applicable: !selfAssignedByCreator,
        exclusionReason: selfAssignedByCreator ? "creator_is_assignee" : null,
        evidence: {
          issueId: Number(row.sourceId),
          responsibilityPath: "issues.assigneeId->users.email->staff.email",
          firstResponseRule: "first_non_system_assignee_comment_excluding_creator",
          contentIncluded: false,
        },
      }];
    });
  } catch (error) {
    if (missingSourceTable(error)) return [];
    throw error;
  }
}

async function collectExplicitChatReplyFacts(db: PerformanceDatabase, effectiveFrom: string): Promise<ResponseFactObservation[]> {
  try {
    const result = await db.execute(sql`
      SELECT original.id AS sourceId, original.createdAt AS requestAt,
        MIN(reply.createdAt) AS firstResponseAt, reply.senderId AS staffId,
        room.type AS roomType
      FROM chat_messages reply
      INNER JOIN chat_messages original ON original.id = reply.replyToId
      INNER JOIN chat_rooms room ON room.id = original.roomId
      INNER JOIN staff member
        ON member.id = reply.senderId
        AND member.isActive = 'active'
        AND member.archivedAt IS NULL
        AND member.mergedIntoStaffId IS NULL
      WHERE reply.replyToId IS NOT NULL
        AND reply.senderType = 'staff'
        AND DATE(original.createdAt) >= ${effectiveFrom}
        AND NOT (original.senderType = 'staff' AND original.senderId = reply.senderId)
      GROUP BY original.id, original.createdAt, reply.senderId, room.type
    `);
    return rowsOf<any>(result).flatMap(row => {
      const requestAt = toDate(row.requestAt);
      const firstResponseAt = toDate(row.firstResponseAt);
      if (!requestAt || !firstResponseAt || !row.staffId) return [];
      return [{
        staffId: Number(row.staffId),
        channel: "internal_chat" as const,
        sourceType: "chat_reply_chain",
        sourceId: String(row.sourceId),
        requestAt,
        respondedAt: firstResponseAt,
        closedAt: firstResponseAt,
        status: "responded" as const,
        applicable: true,
        exclusionReason: null,
        evidence: {
          originalMessageId: Number(row.sourceId),
          roomType: String(row.roomType || "unknown"),
          attributionRule: "explicit_replyToId_only",
          ordinaryGroupSilenceExcluded: true,
          contentIncluded: false,
        },
      }];
    });
  } catch (error) {
    if (missingSourceTable(error)) return [];
    throw error;
  }
}

async function hasResponseException(db: PerformanceDatabase, fact: ResponseFactObservation): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM performance_exceptions
    WHERE staffId = ${fact.staffId}
      AND status = 'approved'
      AND startsAt <= ${fact.closedAt || fact.respondedAt || fact.requestAt}
      AND endsAt >= ${fact.requestAt}
    LIMIT 1
  `);
  return rowsOf(result).length > 0;
}

async function upsertResponseFact(db: PerformanceDatabase, fact: ResponseFactObservation): Promise<void> {
  const exception = await hasResponseException(db, fact);
  const applicable = fact.applicable && !exception;
  const exclusionReason = exception ? "approved_exception" : fact.exclusionReason;
  const responseMinutes = responseMinutesBetween(fact.requestAt, fact.respondedAt);
  const closureMinutes = responseMinutesBetween(fact.requestAt, fact.closedAt);
  const factKey = buildResponseFactKey(fact);
  const status = applicable ? fact.status : "excluded";
  await db.execute(sql`
    INSERT INTO performance_response_facts (
      factKey, staffId, channel, sourceType, sourceId, businessDate,
      requestAt, respondedAt, closedAt, responseMinutes, closureMinutes,
      status, speedBand, applicable, exclusionReason, evidenceJson
    ) VALUES (
      ${factKey}, ${fact.staffId}, ${fact.channel}, ${fact.sourceType}, ${fact.sourceId},
      ${jstDate(fact.requestAt)}, ${fact.requestAt}, ${fact.respondedAt}, ${fact.closedAt},
      ${responseMinutes}, ${closureMinutes}, ${status}, ${responseSpeedBand(responseMinutes, applicable)},
      ${applicable}, ${exclusionReason}, ${JSON.stringify(fact.evidence)}
    )
    ON DUPLICATE KEY UPDATE
      respondedAt = VALUES(respondedAt),
      closedAt = VALUES(closedAt),
      responseMinutes = VALUES(responseMinutes),
      closureMinutes = VALUES(closureMinutes),
      status = VALUES(status),
      speedBand = VALUES(speedBand),
      applicable = VALUES(applicable),
      exclusionReason = VALUES(exclusionReason),
      evidenceJson = VALUES(evidenceJson),
      lastObservedAt = CURRENT_TIMESTAMP
  `);
}

export async function reconcilePerformanceResponseFacts(
  db: PerformanceDatabase,
  effectiveFrom: string,
): Promise<number> {
  const observations = [
    ...await collectLineFacts(db, effectiveFrom),
    ...await collectSalesEmailFacts(db, effectiveFrom),
    ...await collectIssueFacts(db, effectiveFrom),
    ...await collectExplicitChatReplyFacts(db, effectiveFrom),
  ];
  for (const observation of observations) {
    await upsertResponseFact(db, observation);
  }
  return observations.length;
}
