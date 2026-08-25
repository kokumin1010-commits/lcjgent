import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

const FEATURE_TABLES = [
  "lcj_brain_chat_logs",
  "lcj_brain_conversations",
  "lcj_brain_knowledge",
] as const;

const RECOVERY_SOURCE_TABLES = [
  "morning_meetings",
  "reports",
  "report_staff",
  "ai_coach_master_knowledge",
  "chat_report_sessions",
  "chat_report_messages",
  "tasks",
  "brands",
] as const;

const EXPECTED_COLUMNS: Record<(typeof FEATURE_TABLES)[number], string[]> = {
  lcj_brain_chat_logs: [
    "id",
    "userId",
    "userName",
    "sessionId",
    "conversationId",
    "role",
    "content",
    "context",
    "suggestedQuestions",
    "fileContent",
    "fileUrl",
    "fileName",
    "createdAt",
  ],
  lcj_brain_conversations: [
    "id",
    "userId",
    "userName",
    "title",
    "context",
    "createdAt",
    "updatedAt",
  ],
  lcj_brain_knowledge: [
    "id",
    "title",
    "category",
    "content",
    "summary",
    "participants",
    "tags",
    "meetingDate",
    "sourceFileName",
    "uploadedBy",
    "uploadedByName",
    "createdAt",
    "updatedAt",
  ],
};

type TableState = {
  exists: boolean;
  rowCount: number | null;
  firstCreatedAt: string | null;
  lastCreatedAt: string | null;
  columns: string[];
  missingColumns: string[];
  queryError: string | null;
};

function serializeDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    1000
  );
}

async function tableExists(
  connection: Connection,
  tableName: string
): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 AS present
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function getColumns(
  connection: Connection,
  tableName: string
): Promise<string[]> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT column_name AS columnName
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position`,
    [tableName]
  );
  return rows.map(row => String(row.columnName));
}

async function inspectFeatureTable(
  connection: Connection,
  tableName: (typeof FEATURE_TABLES)[number]
): Promise<TableState> {
  const exists = await tableExists(connection, tableName);
  if (!exists) {
    return {
      exists: false,
      rowCount: null,
      firstCreatedAt: null,
      lastCreatedAt: null,
      columns: [],
      missingColumns: EXPECTED_COLUMNS[tableName],
      queryError: null,
    };
  }

  const columns = await getColumns(connection, tableName);
  const missingColumns = EXPECTED_COLUMNS[tableName].filter(
    column => !columns.includes(column)
  );
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS rowCount,
              MIN(createdAt) AS firstCreatedAt,
              MAX(createdAt) AS lastCreatedAt
         FROM \`${tableName}\``
    );
    return {
      exists: true,
      rowCount: Number(rows[0]?.rowCount || 0),
      firstCreatedAt: serializeDate(rows[0]?.firstCreatedAt),
      lastCreatedAt: serializeDate(rows[0]?.lastCreatedAt),
      columns,
      missingColumns,
      queryError: null,
    };
  } catch (error) {
    return {
      exists: true,
      rowCount: null,
      firstCreatedAt: null,
      lastCreatedAt: null,
      columns,
      missingColumns,
      queryError: safeError(error),
    };
  }
}

async function getSourceCounts(
  connection: Connection
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  for (const tableName of RECOVERY_SOURCE_TABLES) {
    if (!(await tableExists(connection, tableName))) {
      result[tableName] = null;
      continue;
    }
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS rowCount FROM \`${tableName}\``
      );
      result[tableName] = Number(rows[0]?.rowCount || 0);
    } catch {
      result[tableName] = null;
    }
  }
  return result;
}

export async function getLcjBrainRecoveryHealth(input: {
  currentUserId: number;
  currentUserEmail?: string | null;
}) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for LCJ Brain recovery diagnostics"
    );

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const tableStates = Object.fromEntries(
      await Promise.all(
        FEATURE_TABLES.map(
          async tableName =>
            [
              tableName,
              await inspectFeatureTable(connection, tableName),
            ] as const
        )
      )
    ) as Record<(typeof FEATURE_TABLES)[number], TableState>;

    const users = input.currentUserEmail
      ? await connection
          .query<RowDataPacket[]>(
            `SELECT id, email, name, role, createdAt, updatedAt, lastSignedIn
             FROM users
            WHERE LOWER(email) = LOWER(?)
            ORDER BY id`,
            [input.currentUserEmail]
          )
          .then(([rows]) =>
            rows.map(row => ({
              id: Number(row.id),
              email: row.email ? String(row.email) : null,
              name: row.name ? String(row.name) : null,
              role: row.role ? String(row.role) : null,
              createdAt: serializeDate(row.createdAt),
              updatedAt: serializeDate(row.updatedAt),
              lastSignedIn: serializeDate(row.lastSignedIn),
            }))
          )
      : [];

    const staffMatches =
      input.currentUserEmail && (await tableExists(connection, "staff"))
        ? await connection
            .query<RowDataPacket[]>(
              `SELECT id, email, name, isActive, createdAt, updatedAt
             FROM staff
            WHERE LOWER(email) = LOWER(?)
            ORDER BY id`,
              [input.currentUserEmail]
            )
            .then(([rows]) =>
              rows.map(row => ({
                id: Number(row.id),
                email: row.email ? String(row.email) : null,
                name: row.name ? String(row.name) : null,
                isActive: row.isActive ? String(row.isActive) : null,
                createdAt: serializeDate(row.createdAt),
                updatedAt: serializeDate(row.updatedAt),
              }))
            )
        : [];

    const chatUsers = tableStates.lcj_brain_chat_logs.exists
      ? await connection
          .query<RowDataPacket[]>(
            `SELECT userId, userName, COUNT(*) AS messageCount,
                  MIN(createdAt) AS firstCreatedAt, MAX(createdAt) AS lastCreatedAt
             FROM lcj_brain_chat_logs
            GROUP BY userId, userName
            ORDER BY messageCount DESC, userId`
          )
          .then(([rows]) =>
            rows.map(row => ({
              userId: row.userId === null ? null : Number(row.userId),
              userName: row.userName ? String(row.userName) : null,
              messageCount: Number(row.messageCount || 0),
              firstCreatedAt: serializeDate(row.firstCreatedAt),
              lastCreatedAt: serializeDate(row.lastCreatedAt),
            }))
          )
      : [];

    const conversationUsers = tableStates.lcj_brain_conversations.exists
      ? await connection
          .query<RowDataPacket[]>(
            `SELECT userId, userName, COUNT(*) AS conversationCount,
                  MIN(createdAt) AS firstCreatedAt, MAX(updatedAt) AS lastUpdatedAt
             FROM lcj_brain_conversations
            GROUP BY userId, userName
            ORDER BY conversationCount DESC, userId`
          )
          .then(([rows]) =>
            rows.map(row => ({
              userId: Number(row.userId),
              userName: row.userName ? String(row.userName) : null,
              conversationCount: Number(row.conversationCount || 0),
              firstCreatedAt: serializeDate(row.firstCreatedAt),
              lastUpdatedAt: serializeDate(row.lastUpdatedAt),
            }))
          )
      : [];

    const sourceCounts = await getSourceCounts(connection);
    const backupRuns = (await tableExists(connection, "db_backup_runs"))
      ? await connection
          .query<RowDataPacket[]>(
            `SELECT reason, status, startedAt, completedAt, tableCount, rowCount, errorMessage
             FROM db_backup_runs
            ORDER BY id DESC
            LIMIT 20`
          )
          .then(([rows]) =>
            rows.map(row => ({
              reason: String(row.reason || ""),
              status: String(row.status || ""),
              startedAt: serializeDate(row.startedAt),
              completedAt: serializeDate(row.completedAt),
              tableCount: Number(row.tableCount || 0),
              rowCount: Number(row.rowCount || 0),
              errorMessage: row.errorMessage
                ? String(row.errorMessage).slice(0, 500)
                : null,
            }))
          )
      : [];

    const emptyFeatureTables = FEATURE_TABLES.filter(
      tableName => tableStates[tableName].rowCount === 0
    );
    const invalidFeatureTables = FEATURE_TABLES.filter(tableName => {
      const state = tableStates[tableName];
      return (
        !state.exists ||
        state.missingColumns.length > 0 ||
        Boolean(state.queryError)
      );
    });

    return {
      checkedAt: new Date().toISOString(),
      currentUser: {
        id: input.currentUserId,
        email: input.currentUserEmail || null,
      },
      users,
      staffMatches,
      tableStates,
      chatUsers,
      conversationUsers,
      sourceCounts,
      backupRuns,
      assessment: {
        emptyFeatureTables,
        invalidFeatureTables,
        schemaHealthy: invalidFeatureTables.length === 0,
        recordsPresent: FEATURE_TABLES.some(
          tableName => Number(tableStates[tableName].rowCount || 0) > 0
        ),
        currentUserHasChatData: chatUsers.some(
          item => item.userId === input.currentUserId
        ),
        currentUserHasConversationData: conversationUsers.some(
          item => item.userId === input.currentUserId
        ),
      },
    };
  } finally {
    await connection.end();
  }
}
