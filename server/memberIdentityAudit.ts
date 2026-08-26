import { createHash, timingSafeEqual } from 'node:crypto';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { runDatabaseBackup } from './databaseBackupScheduler';

const KEY_SHA256 = '0338599babbb6d2a923d32384d5c1ffb1198834911481b10a73fb7f673cbb203';

function verifyKey(value: string): void {
  const actual = Buffer.from(createHash('sha256').update(value).digest('hex'));
  const expected = Buffer.from(KEY_SHA256);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('invalid audit key');
}

async function query(connection: mysql.Connection, sql: string, params: unknown[] = []) {
  const [rows] = await connection.query<RowDataPacket[]>(sql, params);
  return rows;
}

async function snapshot() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is missing');
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const [memberCounts, memberClasses, lineKeyClasses, recoveryNames, receiptIdentity, receiptEvidence, receiptStatuses, businessLinks, identityUpgrade] = await Promise.all([
      query(connection, `
        SELECT COUNT(*) AS rawTotal,
          SUM(CASE WHEN lineUserId IS NOT NULL OR email IS NOT NULL THEN 1 ELSE 0 END) AS visibleCurrent,
          SUM(CASE WHEN lineUserId IS NULL AND email IS NULL THEN 1 ELSE 0 END) AS referenceOnly,
          SUM(CASE WHEN lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 1 ELSE 0 END) AS realFormatLineId,
          SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS hasEmail,
          SUM(CASE WHEN email IS NOT NULL AND email <> '' AND password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END) AS emailPasswordLoginable,
          SUM(CASE WHEN lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' OR (email IS NOT NULL AND email <> '' AND password IS NOT NULL AND password <> '') THEN 1 ELSE 0 END) AS loginableIdentity,
          SUM(CASE WHEN displayName LIKE '復旧会員 #%'
                        OR displayName='LINE復旧会員' THEN 1 ELSE 0 END) AS recoveryNamed,
          SUM(CASE WHEN displayName='LINE復旧会員' AND lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 1 ELSE 0 END) AS claimableLineRecovery,
          SUM(CASE WHEN displayName LIKE '復旧会員 #%'
                        AND lineUserId IS NULL AND email IS NULL THEN 1 ELSE 0 END) AS numericReferenceRecovery,
          SUM(CASE WHEN createdAt >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01') THEN 1 ELSE 0 END) AS rawCreatedThisMonth,
          SUM(CASE WHEN createdAt >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
                        AND (lineUserId IS NOT NULL OR email IS NOT NULL) THEN 1 ELSE 0 END) AS visibleCreatedThisMonth,
          SUM(CASE WHEN createdAt >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
                        AND (lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' OR (email IS NOT NULL AND password IS NOT NULL)) THEN 1 ELSE 0 END) AS loginableCreatedThisMonth
        FROM line_users`),
      query(connection, `
        SELECT memberClass, COUNT(*) AS rowCount,
          SUM(CASE WHEN hasOrders=1 THEN 1 ELSE 0 END) AS membersWithOrders,
          SUM(CASE WHEN hasReceipts=1 THEN 1 ELSE 0 END) AS membersWithReceipts,
          SUM(CASE WHEN hasPoints=1 THEN 1 ELSE 0 END) AS membersWithPoints
        FROM (
          SELECT lu.id,
            CASE
              WHEN lu.lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' AND lu.displayName='LINE復旧会員' THEN 'line_claimable_recovery'
              WHEN lu.lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 'line_profiled'
              WHEN lu.email IS NOT NULL AND lu.email<>'' AND lu.password IS NOT NULL AND lu.password<>'' THEN 'email_loginable'
              WHEN lu.email IS NOT NULL AND lu.email<>'' THEN 'email_claimable_reset'
              WHEN lu.lineUserId LIKE 'email\\_%' THEN 'pseudo_email_reference'
              WHEN lu.lineUserId IS NULL THEN 'numeric_reference_only'
              WHEN lu.displayName='LINE復旧会員' OR lu.displayName LIKE '復旧会員 #%' THEN 'legacy_key_recovery'
              ELSE 'legacy_key_review'
            END AS memberClass,
            EXISTS(SELECT 1 FROM mall_orders mo WHERE mo.lineUserId=lu.id LIMIT 1) AS hasOrders,
            EXISTS(SELECT 1 FROM line_receipts lr WHERE lr.lineUserId=lu.lineUserId OR lr.lineUserId=CONCAT('email_',lu.id) LIMIT 1) AS hasReceipts,
            EXISTS(SELECT 1 FROM line_point_balances pb WHERE pb.lineUserId=lu.lineUserId OR pb.lineUserId=CONCAT('email_',lu.id) LIMIT 1) AS hasPoints
          FROM line_users lu
        ) classified
        GROUP BY memberClass ORDER BY rowCount DESC`),
      query(connection, `
        SELECT CASE
          WHEN lineUserId IS NULL THEN 'none'
          WHEN lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 'line_real_format'
          WHEN lineUserId LIKE 'email\\_%' THEN 'email_key'
          ELSE 'other'
        END AS keyClass, COUNT(*) AS rowCount
        FROM line_users GROUP BY keyClass ORDER BY rowCount DESC`),
      query(connection, `
        SELECT CASE
          WHEN displayName='LINE復旧会員' THEN 'line_recovery'
          WHEN displayName LIKE '復旧会員 #%' THEN 'numeric_recovery'
          WHEN displayName IS NULL OR displayName='' THEN 'unnamed'
          ELSE 'named'
        END AS nameClass,
        COUNT(*) AS rowCount,
        SUM(CASE WHEN lineUserId IS NOT NULL THEN 1 ELSE 0 END) AS withLineId,
        SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS withEmail,
        SUM(CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END) AS withPassword
        FROM line_users GROUP BY nameClass ORDER BY rowCount DESC`),
      query(connection, `
        SELECT CASE
          WHEN lr.lineUserId LIKE 'email\\_%' AND exactMember.id IS NOT NULL THEN 'pseudo_email_recovery_match'
          WHEN lr.lineUserId LIKE 'email\\_%' AND emailMember.id IS NOT NULL AND emailMember.email IS NOT NULL AND emailMember.email<>'' THEN 'real_email_member_match'
          WHEN lr.lineUserId LIKE 'email\\_%' AND emailMember.id IS NOT NULL THEN 'numeric_reference_match'
          WHEN exactMember.id IS NOT NULL AND exactMember.displayName='LINE復旧会員' THEN 'line_recovery_match'
          WHEN exactMember.id IS NOT NULL AND exactMember.lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 'real_line_member_match'
          WHEN exactMember.id IS NOT NULL THEN 'other_exact_member_match'
          WHEN lr.lineUserId REGEXP '^U[0-9A-Fa-f]{32}$' THEN 'unmatched_real_line_key'
          ELSE 'unmatched_other_key'
        END AS identityClass,
        COUNT(*) AS receiptCount,
        COUNT(DISTINCT lr.lineUserId) AS distinctIdentityKeys,
        SUM(CASE WHEN lr.status='approved' THEN 1 ELSE 0 END) AS approvedCount,
        SUM(COALESCE(lr.pointsAwarded,0)) AS awardedPoints
        FROM line_receipts lr
        LEFT JOIN line_users exactMember ON exactMember.lineUserId=lr.lineUserId
        LEFT JOIN line_users emailMember ON lr.lineUserId=CONCAT('email_',emailMember.id)
        GROUP BY identityClass ORDER BY receiptCount DESC`),
      query(connection, `
        SELECT COUNT(*) AS totalReceipts,
          SUM(CASE WHEN lineMessageId IS NOT NULL AND lineMessageId<>'' THEN 1 ELSE 0 END) AS withLineMessageId,
          SUM(CASE WHEN imageKey IS NOT NULL AND imageKey<>'' THEN 1 ELSE 0 END) AS withImageKey,
          SUM(CASE WHEN imageHash IS NOT NULL AND imageHash<>'' THEN 1 ELSE 0 END) AS withImageHash,
          SUM(CASE WHEN orderNumber IS NOT NULL AND orderNumber<>'' THEN 1 ELSE 0 END) AS withOrderNumber,
          SUM(CASE WHEN purchaseDate IS NOT NULL THEN 1 ELSE 0 END) AS withPurchaseDate,
          SUM(CASE WHEN totalAmount IS NOT NULL THEN 1 ELSE 0 END) AS withAmount,
          SUM(CASE WHEN ocrRawText IS NOT NULL AND ocrRawText<>'' THEN 1 ELSE 0 END) AS withOcr,
          COUNT(DISTINCT lineUserId) AS distinctIdentityKeys
        FROM line_receipts`),
      query(connection, `SELECT status, COUNT(*) AS rowCount, SUM(COALESCE(pointsAwarded,0)) AS awardedPoints FROM line_receipts GROUP BY status ORDER BY status`),
      query(connection, `
        SELECT
          (SELECT COUNT(DISTINCT lineUserId) FROM line_receipts) AS receiptIdentityKeys,
          (SELECT COUNT(DISTINCT lineUserId) FROM line_point_balances) AS pointIdentityKeys,
          (SELECT COUNT(DISTINCT lineUserId) FROM line_point_transactions) AS pointTransactionIdentityKeys,
          (SELECT COUNT(DISTINCT lineUserId) FROM line_messages WHERE lineUserId IS NOT NULL) AS messageIdentityKeys,
          (SELECT COUNT(DISTINCT lineUserId) FROM mall_orders) AS numericOrderMemberIds,
          (SELECT COUNT(*) FROM mall_orders) AS orderRows`),
      query(connection, `
        SELECT
          (SELECT COUNT(*) FROM member_identity_action_logs) AS actionLogCount,
          (SELECT status FROM member_identity_upgrade_runs WHERE recoveryKey='member-identity-claim-v1' LIMIT 1) AS upgradeStatus,
          (SELECT completedAt FROM member_identity_upgrade_runs WHERE recoveryKey='member-identity-claim-v1' LIMIT 1) AS upgradeCompletedAt,
          (SELECT COUNT(*) FROM db_backup_runs WHERE reason='pre-member-identity-v1' AND status='success') AS preBackupSuccessCount,
          (SELECT COUNT(*) FROM db_backup_runs WHERE reason='post-member-identity-v1' AND status='success') AS postBackupSuccessCount`),
    ]);
    return {
      capturedAt: new Date().toISOString(),
      memberCounts: memberCounts[0] || {},
      memberClasses,
      lineKeyClasses,
      recoveryNames,
      receiptIdentity,
      receiptEvidence: receiptEvidence[0] || {},
      receiptStatuses,
      businessLinks: businessLinks[0] || {},
      identityUpgrade: identityUpgrade[0] || {},
      containsPersonalData: false,
    };
  } finally {
    await connection.end();
  }
}

async function runVerifiedBackup(reason: 'pre-member-identity-v1' | 'post-member-identity-v1') {
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is missing');
  const connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    const rows = await query(connection, `
      SELECT id, runId, reason, status, completedAt, tableCount, rowCount, encryptedBytes, checksum
        FROM db_backup_runs WHERE reason=? ORDER BY id DESC LIMIT 1`, [reason]);
    const latest = rows[0];
    if (!latest || String(latest.status) !== 'success') throw new Error(`${reason} backup was not recorded as success`);
    return latest;
  } finally {
    await connection.end();
  }
}

export const memberIdentityAuditRouter = router({
  snapshot: publicProcedure.input(z.object({ key: z.string().min(1) })).query(async ({ input }) => {
    verifyKey(input.key);
    return snapshot();
  }),
  preImplementationBackup: publicProcedure.input(z.object({ key: z.string().min(1) })).mutation(async ({ input }) => {
    verifyKey(input.key);
    return runVerifiedBackup('pre-member-identity-v1');
  }),
  postImplementationBackup: publicProcedure.input(z.object({ key: z.string().min(1) })).mutation(async ({ input }) => {
    verifyKey(input.key);
    return runVerifiedBackup('post-member-identity-v1');
  }),
});
