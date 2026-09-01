import { createHash } from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import {
  classifyMemberIdentity,
  isRealLineUserId,
} from "./memberIdentityService";

const PRE_BACKUP_REASON = "pre-member-account-merge-v1";
const POST_BACKUP_REASON = "post-member-account-merge-v1";
const SAFE_IDENTIFIER = /^[A-Za-z0-9_]+$/;

type MemberRow = RowDataPacket & {
  id: number;
  lineUserId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  password: string | null;
  phone: string | null;
  brandId: number | null;
  staffId: number | null;
  liverId: number | null;
  userType: string;
  isBlocked: number | boolean;
  lastMessageAt: Date | null;
};

type PointBalanceRow = RowDataPacket & {
  lineUserId: string;
  balance: number;
  totalEarned: number;
  totalUsed: number;
};

type AuditRow = RowDataPacket & {
  id: number;
  targetMemberId: number;
  sourceMemberId: number;
  canonicalLineUserId: string;
  afterBalance: number;
  postBackupId: number | null;
};

export type MergeEmailLineAccountsInput = {
  targetEmailMemberId: number;
  sourceLineMemberId: number;
  expectedEmail: string;
  expectedLineUserId: string;
  expectedTargetBalance: number;
  expectedSourceBalance: number;
  actorId: number;
  reason: string;
};

export function mergePointComponents(
  target: { balance: number; totalEarned: number; totalUsed: number },
  source: { balance: number; totalEarned: number; totalUsed: number }
) {
  return {
    balance: target.balance + source.balance,
    totalEarned: target.totalEarned + source.totalEarned,
    totalUsed: target.totalUsed + source.totalUsed,
  };
}

function createPool(): Pool {
  const uri = process.env.DATABASE_URL;
  if (!uri)
    throw new Error("DATABASE_URL is required for member account merge");
  return mysql.createPool({
    uri,
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 20,
  });
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashEmail(value: string) {
  return createHash("sha256").update(normalizedEmail(value)).digest("hex");
}

function quoteIdentifier(value: string) {
  if (!SAFE_IDENTIFIER.test(value))
    throw new Error("unsafe database identifier");
  return `\`${value}\``;
}

async function ensureAuditTable(pool: Pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS member_account_merge_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    targetMemberId INT NOT NULL,
    sourceMemberId INT NOT NULL,
    canonicalLineUserId VARCHAR(64) NOT NULL,
    expectedEmailHash CHAR(64) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    actorId INT NOT NULL,
    status VARCHAR(40) NOT NULL,
    beforeJson JSON NOT NULL,
    afterJson JSON NULL,
    afterBalance BIGINT NOT NULL DEFAULT 0,
    preBackupId BIGINT NULL,
    postBackupId BIGINT NULL,
    postBackupError TEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    UNIQUE KEY uq_member_account_merge_source (sourceMemberId),
    KEY idx_member_account_merge_target (targetMemberId, createdAt),
    KEY idx_member_account_merge_status (status, completedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestSuccessfulBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs WHERE status = 'success'"
  );
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string) {
  const before = await latestSuccessfulBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM db_backup_runs WHERE id > ? AND reason = ? AND status = 'success' ORDER BY id DESC LIMIT 1",
    [before, reason]
  );
  const id = Number(rows[0]?.id || 0);
  if (!id) throw new Error(`required database backup failed: ${reason}`);
  return id;
}

async function getExistingAudit(pool: Pool, sourceMemberId: number) {
  const [rows] = await pool.query<AuditRow[]>(
    `SELECT id,targetMemberId,sourceMemberId,canonicalLineUserId,afterBalance,postBackupId
       FROM member_account_merge_audit
      WHERE sourceMemberId=? AND status IN ('completed','completed_post_backup_failed')
      LIMIT 1`,
    [sourceMemberId]
  );
  return rows[0] || null;
}

async function loadPointBalance(connection: PoolConnection, key: string) {
  const [rows] = await connection.query<PointBalanceRow[]>(
    `SELECT lineUserId,balance,totalEarned,totalUsed
       FROM line_point_balances WHERE lineUserId=? FOR UPDATE`,
    [key]
  );
  const row = rows[0];
  return row
    ? {
        balance: Number(row.balance || 0),
        totalEarned: Number(row.totalEarned || 0),
        totalUsed: Number(row.totalUsed || 0),
      }
    : { balance: 0, totalEarned: 0, totalUsed: 0 };
}

async function mergeTrustLevels(
  connection: PoolConnection,
  aliases: string[],
  canonicalLineUserId: string
) {
  const placeholders = aliases.map(() => "?").join(",");
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM user_trust_levels WHERE lineUserId IN (${placeholders}) FOR UPDATE`,
    aliases
  );
  if (rows.length === 0) return;
  const canonical = rows.find(
    row => String(row.lineUserId) === canonicalLineUserId
  );
  const merged = {
    trustLevel: Math.max(...rows.map(row => Number(row.trustLevel || 3))),
    ringMembershipCount: rows.reduce(
      (sum, row) => sum + Number(row.ringMembershipCount || 0),
      0
    ),
    confirmedFraudCount: rows.reduce(
      (sum, row) => sum + Number(row.confirmedFraudCount || 0),
      0
    ),
    totalApprovedReceipts: rows.reduce(
      (sum, row) => sum + Number(row.totalApprovedReceipts || 0),
      0
    ),
    totalRejectedReceipts: rows.reduce(
      (sum, row) => sum + Number(row.totalRejectedReceipts || 0),
      0
    ),
    manualOverride: rows.some(row => Boolean(row.manualOverride)) ? 1 : 0,
  };
  if (canonical) {
    await connection.execute(
      `UPDATE user_trust_levels
          SET trustLevel=?,ringMembershipCount=?,confirmedFraudCount=?,totalApprovedReceipts=?,
              totalRejectedReceipts=?,manualOverride=?,lastCalculatedAt=NOW(),updatedAt=NOW()
        WHERE lineUserId=?`,
      [
        merged.trustLevel,
        merged.ringMembershipCount,
        merged.confirmedFraudCount,
        merged.totalApprovedReceipts,
        merged.totalRejectedReceipts,
        merged.manualOverride,
        canonicalLineUserId,
      ]
    );
    await connection.execute(
      `DELETE FROM user_trust_levels WHERE lineUserId IN (${placeholders}) AND lineUserId<>?`,
      [...aliases, canonicalLineUserId]
    );
  } else {
    const keeper = rows[0];
    await connection.execute(
      `UPDATE user_trust_levels
          SET lineUserId=?,trustLevel=?,ringMembershipCount=?,confirmedFraudCount=?,
              totalApprovedReceipts=?,totalRejectedReceipts=?,manualOverride=?,lastCalculatedAt=NOW(),updatedAt=NOW()
        WHERE id=?`,
      [
        canonicalLineUserId,
        merged.trustLevel,
        merged.ringMembershipCount,
        merged.confirmedFraudCount,
        merged.totalApprovedReceipts,
        merged.totalRejectedReceipts,
        merged.manualOverride,
        keeper.id,
      ]
    );
    await connection.execute(
      `DELETE FROM user_trust_levels WHERE lineUserId IN (${placeholders}) AND id<>?`,
      [...aliases, keeper.id]
    );
  }
}

async function migrateStringPointKeys(
  connection: PoolConnection,
  aliases: string[],
  canonicalLineUserId: string
) {
  const aliasKeys = aliases.filter(key => key !== canonicalLineUserId);
  if (aliasKeys.length === 0)
    return [] as Array<{ table: string; column: string; affectedRows: number }>;
  const [columns] = await connection.query<RowDataPacket[]>(`
    SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
       AND COLUMN_NAME IN ('lineUserId','line_user_id')
       AND DATA_TYPE IN ('char','varchar','text','tinytext','mediumtext','longtext')
       AND TABLE_NAME NOT IN ('line_users','line_point_balances','line_point_transactions','user_trust_levels')
     ORDER BY TABLE_NAME,COLUMN_NAME`);
  const result: Array<{ table: string; column: string; affectedRows: number }> =
    [];
  for (const column of columns) {
    const tableName = String(column.tableName);
    const columnName = String(column.columnName);
    const [updateResult] = await connection.execute<mysql.ResultSetHeader>(
      `UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)}=? WHERE ${quoteIdentifier(columnName)} IN (${aliasKeys.map(() => "?").join(",")})`,
      [canonicalLineUserId, ...aliasKeys]
    );
    if (updateResult.affectedRows > 0) {
      result.push({
        table: tableName,
        column: columnName,
        affectedRows: updateResult.affectedRows,
      });
    }
  }
  return result;
}

async function migrateNumericMemberIds(
  connection: PoolConnection,
  sourceMemberId: number,
  targetMemberId: number
) {
  const [columns] = await connection.query<RowDataPacket[]>(`
    SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE()
       AND COLUMN_NAME IN ('lineUserId','referredLineUserId','referrerLineUserId')
       AND DATA_TYPE IN ('tinyint','smallint','mediumint','int','bigint')
       AND TABLE_NAME<>'line_users'
     ORDER BY TABLE_NAME,COLUMN_NAME`);
  const result: Array<{ table: string; column: string; affectedRows: number }> =
    [];
  for (const column of columns) {
    const tableName = String(column.tableName);
    const columnName = String(column.columnName);
    const [updateResult] = await connection.execute<mysql.ResultSetHeader>(
      `UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)}=? WHERE ${quoteIdentifier(columnName)}=?`,
      [targetMemberId, sourceMemberId]
    );
    if (updateResult.affectedRows > 0) {
      result.push({
        table: tableName,
        column: columnName,
        affectedRows: updateResult.affectedRows,
      });
    }
  }
  return result;
}

async function recalculatePointLedger(
  connection: PoolConnection,
  canonicalLineUserId: string,
  expectedBalance: number
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,amount FROM line_point_transactions
      WHERE lineUserId=? ORDER BY createdAt ASC,id ASC FOR UPDATE`,
    [canonicalLineUserId]
  );
  const sum = rows.reduce((total, row) => total + Number(row.amount || 0), 0);
  if (sum !== expectedBalance) {
    throw new Error(
      `point ledger mismatch after merge: ledger=${sum} balance=${expectedBalance}`
    );
  }
  let running = 0;
  for (const row of rows) {
    running += Number(row.amount || 0);
    await connection.execute(
      "UPDATE line_point_transactions SET balanceAfter=? WHERE id=?",
      [running, Number(row.id)]
    );
  }
  return rows.length;
}

export async function mergeEmailAndLineMemberAccounts(
  input: MergeEmailLineAccountsInput
) {
  if (input.targetEmailMemberId === input.sourceLineMemberId)
    throw new Error("source and target members must differ");
  if (!isRealLineUserId(input.expectedLineUserId))
    throw new Error("expected LINE user ID is invalid");
  if (!input.reason.trim()) throw new Error("merge reason is required");

  const pool = createPool();
  try {
    await ensureAuditTable(pool);
    const existingAudit = await getExistingAudit(
      pool,
      input.sourceLineMemberId
    );
    if (existingAudit) {
      if (
        Number(existingAudit.targetMemberId) !== input.targetEmailMemberId ||
        String(existingAudit.canonicalLineUserId) !== input.expectedLineUserId
      ) {
        throw new Error(
          "source member was already merged into another account"
        );
      }
      return {
        success: true,
        alreadyMerged: true,
        targetMemberId: Number(existingAudit.targetMemberId),
        sourceMemberId: Number(existingAudit.sourceMemberId),
        canonicalLineUserId: String(existingAudit.canonicalLineUserId),
        balanceAfter: Number(existingAudit.afterBalance),
        postBackupId: existingAudit.postBackupId
          ? Number(existingAudit.postBackupId)
          : null,
      };
    }

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    let auditId = 0;
    let afterBalance = 0;
    let canonicalLineUserId = input.expectedLineUserId;
    let beforeSnapshot: Record<string, unknown> = {};
    let migrationSnapshot: Record<string, unknown> = {};
    try {
      await connection.beginTransaction();
      const [members] = await connection.query<MemberRow[]>(
        `SELECT id,lineUserId,displayName,pictureUrl,statusMessage,email,password,phone,brandId,staffId,liverId,
                userType,isBlocked,lastMessageAt
           FROM line_users WHERE id IN (?,?) FOR UPDATE`,
        [input.targetEmailMemberId, input.sourceLineMemberId]
      );
      const target = members.find(
        row => Number(row.id) === input.targetEmailMemberId
      );
      const source = members.find(
        row => Number(row.id) === input.sourceLineMemberId
      );
      if (!target || !source)
        throw new Error("both source and target member records are required");
      if (
        !target.email ||
        normalizedEmail(target.email) !== normalizedEmail(input.expectedEmail)
      ) {
        throw new Error("target member email changed; merge cancelled");
      }
      if (!target.password)
        throw new Error("target member has no verified email password");
      if (isRealLineUserId(target.lineUserId))
        throw new Error(
          "target member is already linked to a real LINE account"
        );
      if (
        String(source.lineUserId || "") !== input.expectedLineUserId ||
        !isRealLineUserId(source.lineUserId)
      ) {
        throw new Error("source LINE identity changed; merge cancelled");
      }
      if (source.email)
        throw new Error(
          "source LINE member already has an email; automatic merge is not allowed"
        );

      const targetPointKey = target.lineUserId || `email_${target.id}`;
      const legacyEmailKey = `email_${target.id}`;
      const aliases = [
        ...new Set([canonicalLineUserId, targetPointKey, legacyEmailKey]),
      ];
      const targetBalance = await loadPointBalance(connection, targetPointKey);
      const legacyBalance =
        targetPointKey === legacyEmailKey
          ? { balance: 0, totalEarned: 0, totalUsed: 0 }
          : await loadPointBalance(connection, legacyEmailKey);
      const sourceBalance = await loadPointBalance(
        connection,
        canonicalLineUserId
      );
      if (
        targetBalance.balance + legacyBalance.balance !==
        input.expectedTargetBalance
      ) {
        throw new Error("target point balance changed; reload before merging");
      }
      if (sourceBalance.balance !== input.expectedSourceBalance) {
        throw new Error("source point balance changed; reload before merging");
      }
      const mergedTarget = mergePointComponents(targetBalance, legacyBalance);
      const merged = mergePointComponents(mergedTarget, sourceBalance);
      beforeSnapshot = {
        target: {
          id: Number(target.id),
          pointKey: targetPointKey,
          identityClass: classifyMemberIdentity(target),
          balance: targetBalance,
          legacyEmailBalance: legacyBalance,
        },
        source: {
          id: Number(source.id),
          pointKey: canonicalLineUserId,
          identityClass: classifyMemberIdentity(source),
          balance: sourceBalance,
        },
        globalPointBalance:
          targetBalance.balance + legacyBalance.balance + sourceBalance.balance,
      };

      await connection.execute(
        `INSERT INTO member_account_merge_audit
          (targetMemberId,sourceMemberId,canonicalLineUserId,expectedEmailHash,reason,actorId,status,beforeJson,preBackupId)
         VALUES (?,?,?,?,?,?, 'running', ?,?)`,
        [
          input.targetEmailMemberId,
          input.sourceLineMemberId,
          canonicalLineUserId,
          hashEmail(input.expectedEmail),
          input.reason.trim().slice(0, 500),
          input.actorId,
          JSON.stringify(beforeSnapshot),
          preBackupId,
        ]
      );
      const [auditRows] = await connection.query<RowDataPacket[]>(
        "SELECT LAST_INSERT_ID() AS id"
      );
      auditId = Number(auditRows[0]?.id || 0);

      await connection.execute(
        `INSERT INTO line_point_balances (lineUserId,balance,totalEarned,totalUsed,createdAt,updatedAt)
         VALUES (?,?,?,?,NOW(),NOW())
         ON DUPLICATE KEY UPDATE balance=VALUES(balance),totalEarned=VALUES(totalEarned),
           totalUsed=VALUES(totalUsed),updatedAt=NOW()`,
        [
          canonicalLineUserId,
          merged.balance,
          merged.totalEarned,
          merged.totalUsed,
        ]
      );
      for (const alias of aliases) {
        if (alias === canonicalLineUserId) continue;
        await connection.execute(
          `UPDATE line_point_balances SET balance=0,totalEarned=0,totalUsed=0,updatedAt=NOW() WHERE lineUserId=?`,
          [alias]
        );
      }
      if (aliases.length > 1) {
        await connection.execute(
          `UPDATE line_point_transactions SET lineUserId=? WHERE lineUserId IN (${aliases
            .slice(1)
            .map(() => "?")
            .join(",")})`,
          [canonicalLineUserId, ...aliases.slice(1)]
        );
      }
      const ledgerRows = await recalculatePointLedger(
        connection,
        canonicalLineUserId,
        merged.balance
      );
      await mergeTrustLevels(connection, aliases, canonicalLineUserId);
      const stringKeyMigrations = await migrateStringPointKeys(
        connection,
        aliases,
        canonicalLineUserId
      );
      const numericMemberMigrations = await migrateNumericMemberIds(
        connection,
        input.sourceLineMemberId,
        input.targetEmailMemberId
      );
      await connection.execute(
        "UPDATE member_identity_action_logs SET memberId=? WHERE memberId=?",
        [input.targetEmailMemberId, input.sourceLineMemberId]
      );

      await connection.execute(
        "UPDATE line_users SET lineUserId=NULL WHERE id=?",
        [input.sourceLineMemberId]
      );
      await connection.execute(
        `UPDATE line_users
            SET lineUserId=?,pictureUrl=COALESCE(pictureUrl,?),statusMessage=COALESCE(statusMessage,?),
                brandId=COALESCE(brandId,?),staffId=COALESCE(staffId,?),liverId=COALESCE(liverId,?),
                isBlocked=IF(isBlocked OR ?,1,0),
                lastMessageAt=CASE
                  WHEN lastMessageAt IS NULL THEN ?
                  WHEN ? IS NULL THEN lastMessageAt
                  WHEN lastMessageAt>=? THEN lastMessageAt
                  ELSE ?
                END,
                updatedAt=NOW()
          WHERE id=?`,
        [
          canonicalLineUserId,
          source.pictureUrl,
          source.statusMessage,
          source.brandId,
          source.staffId,
          source.liverId,
          Number(Boolean(source.isBlocked)),
          source.lastMessageAt,
          source.lastMessageAt,
          source.lastMessageAt,
          source.lastMessageAt,
          input.targetEmailMemberId,
        ]
      );
      await connection.execute(
        "DELETE FROM line_users WHERE id=? AND lineUserId IS NULL AND (email IS NULL OR email='')",
        [input.sourceLineMemberId]
      );

      const afterSnapshot = {
        targetMemberId: input.targetEmailMemberId,
        removedSourceMemberId: input.sourceLineMemberId,
        canonicalLineUserId,
        balance: merged,
        ledgerRows,
        stringKeyMigrations,
        numericMemberMigrations,
        globalPointBalance: merged.balance,
      };
      migrationSnapshot = afterSnapshot;
      await connection.execute(
        `INSERT INTO member_identity_action_logs
          (memberId,action,beforeClass,afterClass,verificationMethod,evidenceJson,actorType,actorId,createdAt)
         VALUES (?,'admin_linked',?,?, 'admin_evidence', ?, 'admin', ?,NOW())`,
        [
          input.targetEmailMemberId,
          classifyMemberIdentity(target),
          "line_profiled",
          JSON.stringify({
            sourceMemberId: input.sourceLineMemberId,
            expectedEmailHash: hashEmail(input.expectedEmail),
            reason: input.reason.trim().slice(0, 500),
            preBackupId,
            balanceBefore: beforeSnapshot,
            balanceAfter: merged,
          }),
          input.actorId,
        ]
      );
      await connection.execute(
        `UPDATE member_account_merge_audit
            SET status='completed',afterJson=?,afterBalance=?,completedAt=NOW()
          WHERE id=?`,
        [JSON.stringify(afterSnapshot), merged.balance, auditId]
      );
      await connection.commit();
      afterBalance = merged.balance;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    let postBackupId: number | null = null;
    let postBackupError: string | null = null;
    try {
      postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
      await pool.execute(
        "UPDATE member_account_merge_audit SET postBackupId=? WHERE id=?",
        [postBackupId, auditId]
      );
    } catch (error) {
      postBackupError =
        error instanceof Error
          ? error.message.slice(0, 4000)
          : String(error).slice(0, 4000);
      await pool.execute(
        `UPDATE member_account_merge_audit
            SET status='completed_post_backup_failed',postBackupError=?
          WHERE id=?`,
        [postBackupError, auditId]
      );
    }

    return {
      success: true,
      alreadyMerged: false,
      targetMemberId: input.targetEmailMemberId,
      sourceMemberId: input.sourceLineMemberId,
      canonicalLineUserId,
      balanceAfter: afterBalance,
      expectedCombinedBalance:
        input.expectedTargetBalance + input.expectedSourceBalance,
      preBackupId,
      postBackupId,
      postBackupError,
      migration: migrationSnapshot,
    };
  } finally {
    await pool.end();
  }
}
