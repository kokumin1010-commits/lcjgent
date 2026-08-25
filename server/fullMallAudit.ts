import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

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
    ] = await Promise.all([
      getTableCounts(connection),
      getLineUserMetrics(connection),
      getPointMetrics(connection),
      getSourceIdentityMetrics(connection),
      getPointReferenceIntegrity(connection),
      getNumericOrphanMetrics(connection),
      getRecoveryCandidates(connection),
      getRecentBackupRuns(connection),
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
