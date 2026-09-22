import { sql } from "drizzle-orm";
import { getDb } from "./db";

type LinePersonTalkHistoryDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type LinePersonTalkHistoryInput = {
  lineUserId: string;
  cursor?: number;
  limit?: number;
};

function firstExecuteRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  return (Array.isArray(result[0]) ? result[0] : result) as T[];
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(Math.trunc(numeric), maximum);
}

function nullableTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function getLinePersonTalkHistoryUsingDb(
  db: Pick<LinePersonTalkHistoryDb, "execute">,
  input: LinePersonTalkHistoryInput,
) {
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) throw new Error("LINEユーザーIDが必要です");

  const limit = positiveInteger(input.limit, 100, 100);
  const cursor = input.cursor === undefined
    ? undefined
    : positiveInteger(input.cursor, 0, Number.MAX_SAFE_INTEGER);
  if (input.cursor !== undefined && !cursor) throw new Error("履歴カーソルが不正です");

  const [profileResult, statsResult, messagesResult] = await Promise.all([
    db.execute(sql`
      SELECT
        lineUserId,
        displayName,
        pictureUrl,
        userType,
        isBlocked,
        liverId,
        createdAt,
        lastMessageAt
      FROM line_users
      WHERE lineUserId = ${lineUserId}
      LIMIT 1
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) AS incomingCount,
        SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) AS outgoingCount,
        COUNT(DISTINCT CASE WHEN lineGroupId IS NOT NULL THEN lineGroupId END) AS groupCount,
        MIN(COALESCE(lineTimestamp, UNIX_TIMESTAMP(createdAt) * 1000)) AS firstMessageAt,
        MAX(COALESCE(lineTimestamp, UNIX_TIMESTAMP(createdAt) * 1000)) AS lastMessageAt
      FROM line_messages
      WHERE lineUserId = ${lineUserId}
        AND NOT (direction = 'outgoing' AND responseStatus = 'cancelled')
    `),
    db.execute(sql`
      SELECT
        id,
        messageId,
        sourceType,
        lineUserId,
        lineGroupId,
        senderName,
        messageType,
        content,
        direction,
        responseStatus,
        responseSummary,
        lineTimestamp,
        createdAt
      FROM line_messages
      WHERE lineUserId = ${lineUserId}
        AND NOT (direction = 'outgoing' AND responseStatus = 'cancelled')
        ${cursor ? sql`AND id < ${cursor}` : sql``}
      ORDER BY id DESC
      LIMIT ${limit + 1}
    `),
  ]);

  const profileRows = firstExecuteRows<{
    lineUserId: string;
    displayName: string | null;
    pictureUrl: string | null;
    userType: string;
    isBlocked: number | boolean;
    liverId: number | null;
    createdAt: Date | string;
    lastMessageAt: Date | string | null;
  }>(profileResult);
  const statsRows = firstExecuteRows<{
    total: number | string;
    incomingCount: number | string | null;
    outgoingCount: number | string | null;
    groupCount: number | string | null;
    firstMessageAt: number | string | null;
    lastMessageAt: number | string | null;
  }>(statsResult);
  const messageRows = firstExecuteRows<{
    id: number;
    messageId: string;
    sourceType: "user" | "group" | "room";
    lineUserId: string | null;
    lineGroupId: string | null;
    senderName: string | null;
    messageType: string;
    content: string | null;
    direction: "incoming" | "outgoing";
    responseStatus: "none" | "pending" | "responded" | "cancelled";
    responseSummary: string | null;
    lineTimestamp: number | string | null;
    createdAt: Date | string;
  }>(messagesResult);

  const hasMore = messageRows.length > limit;
  const items = messageRows.slice(0, limit).map((message) => ({
    ...message,
    id: Number(message.id),
    lineTimestamp: nullableTimestamp(message.lineTimestamp),
  }));
  const groupIds = Array.from(new Set(
    items.map((message) => message.lineGroupId).filter((value): value is string => Boolean(value)),
  ));
  let groupNames: Record<string, string | null> = {};
  if (groupIds.length > 0) {
    const groupResult = await db.execute(sql`
      SELECT lineGroupId, groupName
      FROM line_groups
      WHERE lineGroupId IN (${sql.join(groupIds.map((groupId) => sql`${groupId}`), sql`, `)})
    `);
    groupNames = Object.fromEntries(
      firstExecuteRows<{ lineGroupId: string; groupName: string | null }>(groupResult)
        .map((group) => [group.lineGroupId, group.groupName]),
    );
  }

  const profile = profileRows[0] || null;
  const stats = statsRows[0];
  const fallbackName = items.find((message) => message.direction === "incoming" && message.senderName)?.senderName || null;
  const total = Number(stats?.total || 0);

  return {
    person: {
      lineUserId,
      displayName: profile?.displayName || fallbackName,
      pictureUrl: profile?.pictureUrl || null,
      userType: profile?.userType || "unknown",
      isBlocked: profile?.isBlocked === true || Number(profile?.isBlocked || 0) === 1,
      liverId: profile?.liverId ?? null,
      registeredAt: profile?.createdAt ?? null,
      lastProfileMessageAt: profile?.lastMessageAt ?? null,
    },
    items,
    groupNames,
    stats: {
      total,
      incomingCount: Number(stats?.incomingCount || 0),
      outgoingCount: Number(stats?.outgoingCount || 0),
      groupCount: Number(stats?.groupCount || 0),
      firstMessageAt: nullableTimestamp(stats?.firstMessageAt),
      lastMessageAt: nullableTimestamp(stats?.lastMessageAt),
    },
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    limit,
  };
}

export async function getLinePersonTalkHistory(input: LinePersonTalkHistoryInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return getLinePersonTalkHistoryUsingDb(db, input);
}

export const __linePersonTalkHistoryTestUtils = {
  firstExecuteRows,
  positiveInteger,
  nullableTimestamp,
};
