import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import pointBalanceEvidence from "../scripts/balance_backup_20260313_044002.json";

type PointBalanceEvidenceRow = {
  lineUserId: string;
  balance: number;
  totalEarned: number;
  totalUsed: number;
};

const MALL_TABLES = [
  "line_users",
  "line_groups",
  "line_messages",
  "line_follow_ups",
  "pending_responses",
  "line_point_balances",
  "line_point_transactions",
  "line_receipts",
  "line_fraud_detection_logs",
  "mall_brands",
  "mall_categories",
  "mall_products",
  "mall_product_variants",
  "mall_orders",
  "mall_order_items",
  "mall_carts",
  "user_addresses",
  "line_password_reset_tokens",
  "line_link_codes",
  "point_requests",
  "mall_product_reviews",
  "mall_product_desc_images",
  "referral_codes",
  "referral_history",
  "mall_favorites",
  "mall_view_history",
  "receipt_review_logs",
  "ai_review_feedback",
  "receipt_products",
  "referral_campaigns",
  "campaign_stages",
  "user_referral_progress",
  "user_referrals",
  "spin_reward_tables",
  "spin_reward_items",
  "spin_history",
  "referral_activity_feed",
  "receipt_kakuhen_results",
  "receipt_reviews",
  "review_reactions",
  "review_questions",
  "bw_linked_accounts",
  "point_exchanges",
  "ai_auto_review_logs",
  "step_email_logs",
  "festival_accounts",
  "festival_company_applications",
  "festival_liver_applications",
  "festival_general_applications",
  "users",
] as const;

type AuditRow = RowDataPacket & Record<string, unknown>;

function asNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

async function tableExists(connection: Connection, tableName: string) {
  const [rows] = await connection.query<AuditRow[]>(
    `SELECT 1 AS present
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function one(
  connection: Connection,
  query: string,
  params: unknown[] = []
): Promise<AuditRow> {
  const [rows] = await connection.query<AuditRow[]>(query, params);
  return rows[0] || ({} as AuditRow);
}

async function getTableCounts(connection: Connection) {
  const counts: Record<string, number | null> = {};
  for (const tableName of MALL_TABLES) {
    if (!(await tableExists(connection, tableName))) {
      counts[tableName] = null;
      continue;
    }
    const row = await one(
      connection,
      `SELECT COUNT(*) AS rowCount FROM \`${tableName}\``
    );
    counts[tableName] = asNumber(row.rowCount);
  }
  return counts;
}

async function getStatusCounts(
  connection: Connection,
  tableName: string,
  columnName: string
) {
  if (!(await tableExists(connection, tableName))) return {};
  const [rows] = await connection.query<AuditRow[]>(
    `SELECT COALESCE(CAST(\`${columnName}\` AS CHAR), '(null)') AS statusValue,
            COUNT(*) AS rowCount
       FROM \`${tableName}\`
      GROUP BY \`${columnName}\`
      ORDER BY rowCount DESC, statusValue`
  );
  return Object.fromEntries(
    rows.map(row => [String(row.statusValue), asNumber(row.rowCount)])
  );
}

async function getLineUserMetrics(connection: Connection) {
  if (!(await tableExists(connection, "line_users"))) return null;
  const row = await one(
    connection,
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT id) AS uniqueIds,
            COALESCE(MIN(id), 0) AS minId,
            COALESCE(MAX(id), 0) AS maxId,
            SUM(lineUserId IS NOT NULL AND lineUserId <> '') AS withLineUserId,
            COUNT(DISTINCT NULLIF(lineUserId, '')) AS uniqueLineUserIds,
            SUM(email IS NOT NULL AND email <> '') AS withEmail,
            COUNT(DISTINCT NULLIF(LOWER(email), '')) AS uniqueEmails,
            SUM(password IS NOT NULL AND password <> '') AS withPassword,
            SUM(lineUserId IS NOT NULL AND lineUserId <> '' AND email IS NOT NULL AND email <> '') AS withLineAndEmail,
            SUM(lineUserId IS NOT NULL AND lineUserId <> '' AND (email IS NULL OR email = '')) AS lineOnly,
            SUM((lineUserId IS NULL OR lineUserId = '') AND email IS NOT NULL AND email <> '') AS emailOnly,
            SUM((lineUserId IS NULL OR lineUserId = '') AND (email IS NULL OR email = '')) AS missingBoth,
            SUM(userType = 'customer') AS customers,
            SUM(userType = 'staff') AS staff,
            SUM(userType = 'liver') AS livers,
            SUM(userType = 'unknown') AS unknownUsers,
            SUM(isBlocked = 1) AS blocked,
            MIN(createdAt) AS firstCreatedAt,
            MAX(createdAt) AS lastCreatedAt
       FROM line_users`
  );
  const autoIncrementRow = await one(
    connection,
    `SELECT COALESCE(AUTO_INCREMENT, 0) AS nextAutoIncrement
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'line_users'
      LIMIT 1`
  );
  const maxId = asNumber(row.maxId);
  const total = asNumber(row.total);
  return {
    total,
    uniqueIds: asNumber(row.uniqueIds),
    minId: asNumber(row.minId),
    maxId,
    approximateIdGaps: Math.max(0, maxId - total),
    nextAutoIncrement: asNumber(autoIncrementRow.nextAutoIncrement),
    withLineUserId: asNumber(row.withLineUserId),
    uniqueLineUserIds: asNumber(row.uniqueLineUserIds),
    withEmail: asNumber(row.withEmail),
    uniqueEmails: asNumber(row.uniqueEmails),
    withPassword: asNumber(row.withPassword),
    withLineAndEmail: asNumber(row.withLineAndEmail),
    lineOnly: asNumber(row.lineOnly),
    emailOnly: asNumber(row.emailOnly),
    missingBoth: asNumber(row.missingBoth),
    customers: asNumber(row.customers),
    staff: asNumber(row.staff),
    livers: asNumber(row.livers),
    unknownUsers: asNumber(row.unknownUsers),
    blocked: asNumber(row.blocked),
    firstCreatedAt: asIso(row.firstCreatedAt),
    lastCreatedAt: asIso(row.lastCreatedAt),
  };
}

async function getPointMetrics(connection: Connection) {
  if (
    !(await tableExists(connection, "line_point_balances")) ||
    !(await tableExists(connection, "line_point_transactions"))
  ) {
    return null;
  }

  const balance = await one(
    connection,
    `SELECT COUNT(*) AS rowCount,
            COUNT(DISTINCT lineUserId) AS uniqueUsers,
            COALESCE(SUM(balance), 0) AS balanceSum,
            COALESCE(SUM(totalEarned), 0) AS totalEarnedSum,
            COALESCE(SUM(totalUsed), 0) AS totalUsedSum,
            SUM(balance < 0) AS negativeBalances,
            SUM(totalEarned < totalUsed) AS earnedBelowUsed
       FROM line_point_balances`
  );

  const transactions = await one(
    connection,
    `SELECT COUNT(*) AS rowCount,
            COUNT(DISTINCT lineUserId) AS uniqueUsers,
            COALESCE(SUM(amount), 0) AS amountSum,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS positiveAmountSum,
            COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS negativeAmountAbsSum,
            SUM(type = 'earn') AS earnRows,
            SUM(type = 'use') AS useRows,
            SUM(type = 'expire') AS expireRows,
            SUM(type = 'refund') AS refundRows,
            SUM(type = 'adjustment') AS adjustmentRows,
            MIN(createdAt) AS firstCreatedAt,
            MAX(createdAt) AS lastCreatedAt
       FROM line_point_transactions`
  );

  const integrity = await one(
    connection,
    `SELECT
       (SELECT COUNT(*)
          FROM line_point_balances b
          LEFT JOIN line_users u
            ON u.lineUserId = b.lineUserId
            OR b.lineUserId = CONCAT('email_', u.id)
         WHERE u.id IS NULL) AS orphanBalanceUsers,
       (SELECT COUNT(DISTINCT t.lineUserId)
          FROM line_point_transactions t
          LEFT JOIN line_users u
            ON u.lineUserId = t.lineUserId
            OR t.lineUserId = CONCAT('email_', u.id)
         WHERE u.id IS NULL) AS orphanTransactionUsers,
       (SELECT COUNT(*)
          FROM line_point_balances b
          LEFT JOIN line_point_transactions t ON t.lineUserId = b.lineUserId
         WHERE t.id IS NULL) AS balancesWithoutTransactions,
       (SELECT COUNT(DISTINCT t.lineUserId)
          FROM line_point_transactions t
          LEFT JOIN line_point_balances b ON b.lineUserId = t.lineUserId
         WHERE b.id IS NULL) AS transactionUsersWithoutBalance,
       (SELECT COUNT(*)
          FROM line_point_balances b
          JOIN (
            SELECT t.lineUserId, t.balanceAfter
              FROM line_point_transactions t
              JOIN (
                SELECT lineUserId, MAX(id) AS maxId
                  FROM line_point_transactions
                 GROUP BY lineUserId
              ) latest ON latest.maxId = t.id
          ) ledger ON ledger.lineUserId = b.lineUserId
         WHERE b.balance <> ledger.balanceAfter) AS balanceVsLatestLedgerMismatches`
  );

  return {
    balances: {
      rows: asNumber(balance.rowCount),
      uniqueUsers: asNumber(balance.uniqueUsers),
      balanceSum: asNumber(balance.balanceSum),
      totalEarnedSum: asNumber(balance.totalEarnedSum),
      totalUsedSum: asNumber(balance.totalUsedSum),
      negativeBalances: asNumber(balance.negativeBalances),
      earnedBelowUsed: asNumber(balance.earnedBelowUsed),
    },
    transactions: {
      rows: asNumber(transactions.rowCount),
      uniqueUsers: asNumber(transactions.uniqueUsers),
      amountSum: asNumber(transactions.amountSum),
      positiveAmountSum: asNumber(transactions.positiveAmountSum),
      negativeAmountAbsSum: asNumber(transactions.negativeAmountAbsSum),
      earnRows: asNumber(transactions.earnRows),
      useRows: asNumber(transactions.useRows),
      expireRows: asNumber(transactions.expireRows),
      refundRows: asNumber(transactions.refundRows),
      adjustmentRows: asNumber(transactions.adjustmentRows),
      firstCreatedAt: asIso(transactions.firstCreatedAt),
      lastCreatedAt: asIso(transactions.lastCreatedAt),
    },
    integrity: {
      orphanBalanceUsers: asNumber(integrity.orphanBalanceUsers),
      orphanTransactionUsers: asNumber(integrity.orphanTransactionUsers),
      balancesWithoutTransactions: asNumber(
        integrity.balancesWithoutTransactions
      ),
      transactionUsersWithoutBalance: asNumber(
        integrity.transactionUsersWithoutBalance
      ),
      balanceVsLatestLedgerMismatches: asNumber(
        integrity.balanceVsLatestLedgerMismatches
      ),
    },
  };
}

async function getSourceIdentityMetrics(connection: Connection) {
  const result: Record<string, Record<string, number>> = {};

  if (await tableExists(connection, "line_receipts")) {
    const row = await one(
      connection,
      `SELECT COUNT(*) AS rowCount,
              COUNT(DISTINCT lineUserId) AS uniqueIdentityTokens,
              SUM(lineUserId IS NULL OR lineUserId = '') AS missingIdentity,
              SUM(pointsAwarded > 0) AS awardedRows,
              COALESCE(SUM(pointsAwarded), 0) AS awardedPoints,
              MIN(submittedAt) AS firstSubmittedAt,
              MAX(submittedAt) AS lastSubmittedAt
         FROM line_receipts`
    );
    result.lineReceipts = {
      rows: asNumber(row.rowCount),
      uniqueIdentityTokens: asNumber(row.uniqueIdentityTokens),
      missingIdentity: asNumber(row.missingIdentity),
      awardedRows: asNumber(row.awardedRows),
      awardedPoints: asNumber(row.awardedPoints),
    };
  }

  if (await tableExists(connection, "mall_orders")) {
    const row = await one(
      connection,
      `SELECT COUNT(*) AS rowCount,
              COUNT(DISTINCT o.lineUserId) AS uniqueNumericMemberIds,
              COALESCE(SUM(pointsUsed), 0) AS pointsUsed,
              COALESCE(SUM(totalAmount), 0) AS totalAmount,
              SUM(u.id IS NULL) AS orphanOrders
         FROM mall_orders o
         LEFT JOIN line_users u ON u.id = o.lineUserId`
    );
    result.mallOrders = {
      rows: asNumber(row.rowCount),
      uniqueNumericMemberIds: asNumber(row.uniqueNumericMemberIds),
      pointsUsed: asNumber(row.pointsUsed),
      totalAmount: asNumber(row.totalAmount),
      orphanOrders: asNumber(row.orphanOrders),
    };
  }

  const tokenSources = [
    ["line_point_balances", "lineUserId"],
    ["line_point_transactions", "lineUserId"],
    ["line_messages", "lineUserId"],
    ["receipt_kakuhen_results", "lineUserId"],
    ["receipt_reviews", "lineUserId"],
    ["review_reactions", "lineUserId"],
    ["review_questions", "lineUserId"],
  ] as const;

  for (const [tableName, columnName] of tokenSources) {
    if (!(await tableExists(connection, tableName))) continue;
    const row = await one(
      connection,
      `SELECT COUNT(*) AS rowCount,
              COUNT(DISTINCT NULLIF(\`${columnName}\`, '')) AS uniqueIdentityTokens,
              SUM(\`${columnName}\` IS NULL OR \`${columnName}\` = '') AS missingIdentity
         FROM \`${tableName}\``
    );
    result[tableName] = {
      rows: asNumber(row.rowCount),
      uniqueIdentityTokens: asNumber(row.uniqueIdentityTokens),
      missingIdentity: asNumber(row.missingIdentity),
    };
  }

  return result;
}

async function getPointReferenceIntegrity(connection: Connection) {
  if (!(await tableExists(connection, "line_point_transactions"))) return null;
  const row = await one(
    connection,
    `SELECT
       (SELECT COUNT(*)
          FROM line_receipts r
         WHERE r.status = 'approved'
           AND COALESCE(r.pointsAwarded, 0) > 0
           AND NOT EXISTS (
             SELECT 1 FROM line_point_transactions t
              WHERE t.referenceType = 'receipt' AND t.referenceId = r.id
           )) AS approvedReceiptsWithoutLedger,
       (SELECT COUNT(*)
          FROM line_point_transactions t
          LEFT JOIN line_receipts r ON r.id = t.referenceId
         WHERE t.referenceType = 'receipt' AND r.id IS NULL) AS receiptLedgerWithoutReceipt,
       (SELECT COUNT(*)
          FROM mall_orders o
         WHERE COALESCE(o.pointsUsed, 0) > 0
           AND NOT EXISTS (
             SELECT 1 FROM line_point_transactions t
              WHERE t.referenceType = 'order' AND t.referenceId = o.id
           )) AS pointOrdersWithoutLedger,
       (SELECT COUNT(*)
          FROM line_point_transactions t
          LEFT JOIN mall_orders o ON o.id = t.referenceId
         WHERE t.referenceType = 'order' AND o.id IS NULL) AS orderLedgerWithoutOrder`
  );
  return {
    approvedReceiptsWithoutLedger: asNumber(row.approvedReceiptsWithoutLedger),
    receiptLedgerWithoutReceipt: asNumber(row.receiptLedgerWithoutReceipt),
    pointOrdersWithoutLedger: asNumber(row.pointOrdersWithoutLedger),
    orderLedgerWithoutOrder: asNumber(row.orderLedgerWithoutOrder),
  };
}

async function getNumericOrphanMetrics(connection: Connection) {
  const checks = [
    ["mall_orders", "lineUserId"],
    ["mall_carts", "lineUserId"],
    ["user_addresses", "lineUserId"],
    ["mall_product_reviews", "lineUserId"],
    ["referral_history", "referredLineUserId"],
    ["user_referral_progress", "lineUserId"],
    ["user_referrals", "referrerLineUserId"],
    ["user_referrals", "inviteeLineUserId"],
    ["spin_history", "lineUserId"],
    ["bw_linked_accounts", "lineUserId"],
    ["point_exchanges", "lineUserId"],
  ] as const;
  const result: Record<
    string,
    { rows: number; uniqueMembers: number; orphanRows: number }
  > = {};
  for (const [tableName, columnName] of checks) {
    if (!(await tableExists(connection, tableName))) continue;
    const row = await one(
      connection,
      `SELECT COUNT(*) AS rowCount,
              COUNT(DISTINCT t.\`${columnName}\`) AS uniqueMembers,
              SUM(u.id IS NULL) AS orphanRows
         FROM \`${tableName}\` t
         LEFT JOIN line_users u ON u.id = t.\`${columnName}\``
    );
    result[`${tableName}.${columnName}`] = {
      rows: asNumber(row.rowCount),
      uniqueMembers: asNumber(row.uniqueMembers),
      orphanRows: asNumber(row.orphanRows),
    };
  }
  return result;
}

async function getRecoveryCandidates(connection: Connection) {
  const row = await one(
    connection,
    `SELECT
       (SELECT COUNT(DISTINCT token)
          FROM (
            SELECT NULLIF(lineUserId, '') AS token FROM line_point_balances
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_point_transactions
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_receipts
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_messages
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM receipt_kakuhen_results
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM receipt_reviews
          ) tokens
         WHERE token IS NOT NULL) AS uniqueExternalIdentityTokens,
       (SELECT COUNT(DISTINCT token)
          FROM (
            SELECT NULLIF(lineUserId, '') AS token FROM line_point_balances
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_point_transactions
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_receipts
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM line_messages
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM receipt_kakuhen_results
            UNION
            SELECT NULLIF(lineUserId, '') AS token FROM receipt_reviews
          ) tokens
          LEFT JOIN line_users u
            ON u.lineUserId = tokens.token
            OR tokens.token = CONCAT('email_', u.id)
         WHERE tokens.token IS NOT NULL AND u.id IS NULL) AS externalTokensWithoutMember,
       (SELECT COUNT(DISTINCT o.lineUserId)
          FROM mall_orders o
          LEFT JOIN line_users u ON u.id = o.lineUserId
         WHERE u.id IS NULL) AS orderMemberIdsWithoutMember,
       (SELECT COUNT(DISTINCT a.lineUserId)
          FROM user_addresses a
          LEFT JOIN line_users u ON u.id = a.lineUserId
         WHERE u.id IS NULL) AS addressMemberIdsWithoutMember,
       (SELECT COUNT(DISTINCT r.referredLineUserId)
          FROM referral_history r
          LEFT JOIN line_users u ON u.id = r.referredLineUserId
         WHERE u.id IS NULL) AS referralMemberIdsWithoutMember`
  );
  return {
    uniqueExternalIdentityTokens: asNumber(row.uniqueExternalIdentityTokens),
    externalTokensWithoutMember: asNumber(row.externalTokensWithoutMember),
    orderMemberIdsWithoutMember: asNumber(row.orderMemberIdsWithoutMember),
    addressMemberIdsWithoutMember: asNumber(row.addressMemberIdsWithoutMember),
    referralMemberIdsWithoutMember: asNumber(
      row.referralMemberIdsWithoutMember
    ),
  };
}

async function getAllTableInventory(connection: Connection) {
  const [tableRows] = await connection.query<AuditRow[]>(
    `SELECT t.table_name AS tableName,
            COALESCE(t.auto_increment, 0) AS nextAutoIncrement,
            COUNT(c.column_name) AS columnCount,
            SUM(c.column_key = 'PRI') AS primaryKeyColumns,
            SUM(c.column_name IN ('createdAt', 'created_at')) AS hasCreatedAt,
            SUM(c.column_name IN ('updatedAt', 'updated_at')) AS hasUpdatedAt
       FROM information_schema.tables t
       LEFT JOIN information_schema.columns c
         ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE t.table_schema = DATABASE() AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name, t.auto_increment
      ORDER BY t.table_name`
  );

  const tables: Array<{
    tableName: string;
    rowCount: number | null;
    nextAutoIncrement: number;
    columnCount: number;
    primaryKeyColumns: number;
    hasCreatedAt: boolean;
    hasUpdatedAt: boolean;
  }> = [];

  for (const table of tableRows) {
    const tableName = String(table.tableName);
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
    let rowCount: number | null = null;
    try {
      const countRow = await one(
        connection,
        `SELECT COUNT(*) AS rowCount FROM \`${tableName}\``
      );
      rowCount = asNumber(countRow.rowCount);
    } catch {
      rowCount = null;
    }
    tables.push({
      tableName,
      rowCount,
      nextAutoIncrement: asNumber(table.nextAutoIncrement),
      columnCount: asNumber(table.columnCount),
      primaryKeyColumns: asNumber(table.primaryKeyColumns),
      hasCreatedAt: asNumber(table.hasCreatedAt) > 0,
      hasUpdatedAt: asNumber(table.hasUpdatedAt) > 0,
    });
  }

  const nonEmptyTables = tables.filter(item => Number(item.rowCount || 0) > 0);
  const emptyTables = tables.filter(item => item.rowCount === 0);
  const queryFailedTables = tables.filter(item => item.rowCount === null);
  return {
    totalTables: tables.length,
    nonEmptyTableCount: nonEmptyTables.length,
    emptyTableCount: emptyTables.length,
    queryFailedTableCount: queryFailedTables.length,
    totalRows: tables.reduce(
      (sum, item) => sum + Number(item.rowCount || 0),
      0
    ),
    nonEmptyTables,
    emptyTables: emptyTables.map(item => item.tableName),
    queryFailedTables: queryFailedTables.map(item => item.tableName),
  };
}

async function getRecentBackupRuns(connection: Connection) {
  if (!(await tableExists(connection, "db_backup_runs"))) return [];
  const [rows] = await connection.query<AuditRow[]>(
    `SELECT reason, status, tableCount, rowCount, startedAt, completedAt,
            CASE WHEN errorMessage IS NULL OR errorMessage = '' THEN 0 ELSE 1 END AS hasError
       FROM db_backup_runs
      ORDER BY id DESC
      LIMIT 20`
  );
  return rows.map(row => ({
    reason: String(row.reason || ""),
    status: String(row.status || ""),
    tableCount: asNumber(row.tableCount),
    rowCount: asNumber(row.rowCount),
    startedAt: asIso(row.startedAt),
    completedAt: asIso(row.completedAt),
    hasError: Boolean(asNumber(row.hasError)),
  }));
}

async function getPointEvidenceComparison(connection: Connection) {
  const evidence = pointBalanceEvidence as PointBalanceEvidenceRow[];
  const [currentRows] = await connection.query<AuditRow[]>(
    `SELECT lineUserId, balance, totalEarned, totalUsed
       FROM line_point_balances`
  );
  const current = new Map(
    currentRows.map(row => [
      String(row.lineUserId || ""),
      {
        balance: asNumber(row.balance),
        totalEarned: asNumber(row.totalEarned),
        totalUsed: asNumber(row.totalUsed),
      },
    ])
  );

  let matchingKeys = 0;
  let exactMatches = 0;
  let currentHigher = 0;
  let currentLower = 0;
  let aggregateEqualButComponentsDiffer = 0;
  let missingFromCurrent = 0;
  let evidenceBalanceForMatchingKeys = 0;
  let currentBalanceForMatchingKeys = 0;

  for (const row of evidence) {
    const found = current.get(row.lineUserId);
    if (!found) {
      missingFromCurrent += 1;
      continue;
    }
    matchingKeys += 1;
    evidenceBalanceForMatchingKeys += Number(row.balance || 0);
    currentBalanceForMatchingKeys += found.balance;
    const same =
      found.balance === Number(row.balance || 0) &&
      found.totalEarned === Number(row.totalEarned || 0) &&
      found.totalUsed === Number(row.totalUsed || 0);
    if (same) exactMatches += 1;
    else if (found.balance > Number(row.balance || 0)) currentHigher += 1;
    else if (found.balance < Number(row.balance || 0)) currentLower += 1;
    else aggregateEqualButComponentsDiffer += 1;
  }

  const evidenceKeys = new Set(evidence.map(row => row.lineUserId));
  const currentOnlyKeys = [...current.keys()].filter(
    lineUserId => !evidenceKeys.has(lineUserId)
  ).length;

  return {
    evidenceRows: evidence.length,
    evidenceUniqueKeys: evidenceKeys.size,
    evidenceTotals: {
      balance: evidence.reduce((sum, row) => sum + Number(row.balance || 0), 0),
      totalEarned: evidence.reduce(
        (sum, row) => sum + Number(row.totalEarned || 0),
        0
      ),
      totalUsed: evidence.reduce(
        (sum, row) => sum + Number(row.totalUsed || 0),
        0
      ),
    },
    currentRows: currentRows.length,
    matchingKeys,
    exactMatches,
    currentHigher,
    currentLower,
    aggregateEqualButComponentsDiffer,
    missingFromCurrent,
    currentOnlyKeys,
    evidenceBalanceForMatchingKeys,
    currentBalanceForMatchingKeys,
    recommendedPolicy:
      "insert-missing; preserve-current-when-different; never-add-snapshot-to-current",
  };
}

async function getStorageBackupInventory() {
  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.AWS_S3_BUCKET
  ) {
    return { configured: false, objects: [] as unknown[] };
  }

  try {
    const { S3Client, ListObjectsV2Command, HeadObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const client = new S3Client({
      region: process.env.AWS_S3_REGION || "auto",
      endpoint: process.env.AWS_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: Boolean(process.env.AWS_S3_ENDPOINT),
    });
    const bucket = process.env.AWS_S3_BUCKET;
    const prefixes = [
      "private/db-backups/daily/",
      "private/db-backups/weekly/",
      "private/db-backups/monthly/",
    ];
    const objects: Array<{
      tier: string;
      key: string;
      size: number;
      lastModified: string | null;
      format: string | null;
      tables: number | null;
      rows: number | null;
    }> = [];

    for (const prefix of prefixes) {
      let continuationToken: string | undefined;
      do {
        const listed = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );
        for (const item of listed.Contents || []) {
          if (!item.Key) continue;
          const head = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: item.Key })
          );
          objects.push({
            tier: prefix.split("/").filter(Boolean).at(-1) || "unknown",
            key: item.Key,
            size: Number(item.Size || head.ContentLength || 0),
            lastModified: asIso(item.LastModified || head.LastModified),
            format: head.Metadata?.format || null,
            tables: head.Metadata?.tables
              ? asNumber(head.Metadata.tables)
              : null,
            rows: head.Metadata?.rows ? asNumber(head.Metadata.rows) : null,
          });
        }
        continuationToken = listed.IsTruncated
          ? listed.NextContinuationToken
          : undefined;
      } while (continuationToken);
    }

    objects.sort((a, b) =>
      String(a.lastModified || "").localeCompare(String(b.lastModified || ""))
    );
    return {
      configured: true,
      objectCount: objects.length,
      oldest: objects[0] || null,
      newest: objects.at(-1) || null,
      objects,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: true,
      objectCount: 0,
      objects: [] as unknown[],
      error: message.slice(0, 300),
    };
  }
}

async function getIntegrationActivity(connection: Connection) {
  const result: Record<string, unknown> = {};
  if (await tableExists(connection, "feishu_sync_history")) {
    const row = await one(
      connection,
      `SELECT status, totalRecords, newRecords, updatedRecords,
              triggeredBy, durationMs, syncedAt,
              CASE WHEN errorMessage IS NULL OR errorMessage = '' THEN 0 ELSE 1 END AS hasError
         FROM feishu_sync_history
        ORDER BY syncedAt DESC, id DESC
        LIMIT 1`
    );
    result.larkLatestSync = {
      status: String(row.status || ""),
      totalRecords: asNumber(row.totalRecords),
      newRecords: asNumber(row.newRecords),
      updatedRecords: asNumber(row.updatedRecords),
      triggeredBy: String(row.triggeredBy || ""),
      durationMs: asNumber(row.durationMs),
      syncedAt: asIso(row.syncedAt),
      hasError: Boolean(asNumber(row.hasError)),
    };
  }
  return result;
}

async function getSmtpTransportHealth() {
  const useGmail = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const useCustom = Boolean(
    !useGmail && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
  );
  if (!useGmail && !useCustom) {
    return { configured: false, provider: "none", verified: false };
  }

  const provider = useGmail ? "gmail" : "custom";
  const host = useGmail
    ? "smtp.gmail.com"
    : process.env.EMAIL_SMTP_HOST || "smtp.gmail.com";
  const port = useGmail ? 587 : 465;
  const secure = !useGmail;
  const user = useGmail ? process.env.SMTP_USER : process.env.EMAIL_USER;
  const pass = useGmail ? process.env.SMTP_PASS : process.env.EMAIL_PASSWORD;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transporter.verify();
    transporter.close();
    return { configured: true, provider, verified: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: true,
      provider,
      verified: false,
      error: message.slice(0, 300),
    };
  }
}

function getIntegrationConfiguration() {
  return {
    appUrlConfigured: Boolean(process.env.APP_URL),
    lineMessagingConfigured: Boolean(
      process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET
    ),
    lineLoginConfigured: Boolean(
      process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET
    ),
    proLineWebhookConfigured: Boolean(process.env.PROLINE_WEBHOOK_URL),
    larkConfigured: Boolean(
      process.env.FEISHU_APP_ID &&
        process.env.FEISHU_APP_SECRET &&
        process.env.FEISHU_BITABLE_APP_TOKEN &&
        process.env.FEISHU_BITABLE_TABLE_ID
    ),
    gmailSmtpConfigured: Boolean(
      process.env.SMTP_USER && process.env.SMTP_PASS
    ),
    customSmtpConfigured: Boolean(
      process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
    ),
    customSmtpHostConfigured: Boolean(process.env.EMAIL_SMTP_HOST),
    sesCredentialsConfigured: Boolean(
      process.env.AWS_SES_ACCESS_KEY_ID &&
        process.env.AWS_SES_SECRET_ACCESS_KEY &&
        process.env.AWS_SES_FROM_EMAIL
    ),
    sesUsableByCurrentCode: false,
    objectStorageConfigured: Boolean(
      process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET &&
        process.env.AWS_S3_ENDPOINT
    ),
    objectStoragePublicUrlConfigured: Boolean(process.env.AWS_S3_PUBLIC_URL),
  };
}

export async function getFullMallAuditSnapshot() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [
      tableCounts,
      lineUsers,
      points,
      sourceIdentities,
      pointReferenceIntegrity,
      numericOrphans,
      recoveryCandidates,
      backupRuns,
      allTableInventory,
      integrationActivity,
      smtpTransportHealth,
      storageBackupInventory,
      pointEvidenceComparison,
    ] = await Promise.all([
      getTableCounts(connection),
      getLineUserMetrics(connection),
      getPointMetrics(connection),
      getSourceIdentityMetrics(connection),
      getPointReferenceIntegrity(connection),
      getNumericOrphanMetrics(connection),
      getRecoveryCandidates(connection),
      getRecentBackupRuns(connection),
      getAllTableInventory(connection),
      getIntegrationActivity(connection),
      getSmtpTransportHealth(),
      getStorageBackupInventory(),
      getPointEvidenceComparison(connection),
    ]);

    const statusCounts = {
      lineReceipts: await getStatusCounts(
        connection,
        "line_receipts",
        "status"
      ),
      pointRequests: await getStatusCounts(
        connection,
        "point_requests",
        "status"
      ),
      mallOrders: await getStatusCounts(connection, "mall_orders", "status"),
      pointExchanges: await getStatusCounts(
        connection,
        "point_exchanges",
        "bwTransferStatus"
      ),
      referralHistory: await getStatusCounts(
        connection,
        "referral_history",
        "status"
      ),
    };

    return {
      checkedAt: new Date().toISOString(),
      tableCounts,
      lineUsers,
      points,
      sourceIdentities,
      pointReferenceIntegrity,
      numericOrphans,
      recoveryCandidates,
      statusCounts,
      backupRuns,
      allTableInventory,
      integrationConfiguration: getIntegrationConfiguration(),
      integrationActivity,
      smtpTransportHealth,
      storageBackupInventory,
      pointEvidenceComparison,
      privacy: {
        containsNames: false,
        containsEmails: false,
        containsPhones: false,
        containsPasswordsOrHashes: false,
        containsTokens: false,
        countsOnly: true,
      },
    };
  } finally {
    await connection.end();
  }
}
