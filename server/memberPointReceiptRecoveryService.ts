import { createHash } from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const PRE_BACKUP_REASON = "pre-member-point-receipt-recovery-v1";
const POST_BACKUP_REASON = "post-member-point-receipt-recovery-v1";
const POINT_VALIDITY_MONTHS = 6;

type MemberRow = RowDataPacket & {
  id: number;
  lineUserId: string | null;
};

type BalanceRow = RowDataPacket & {
  balance: number;
  totalEarned: number;
  totalUsed: number;
};

type PointTransactionRow = RowDataPacket & {
  id: number;
  lineUserId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceType: string;
  expiresAt: Date | null;
  expired: number;
  remainingAmount: number | null;
  description: string | null;
};

type ReceiptRow = RowDataPacket & {
  id: number;
  lineUserId: string;
  status: string;
  imageUrls: string | null;
};

type RecoveryAuditRow = RowDataPacket & {
  id: number;
  memberId: number;
  lineUserId: string;
  openingTransactionId: number;
  restoredPointAmount: number;
  releasedReceiptCount: number;
  releasedReceiptIdsJson: string | number[];
  status: string;
  postBackupId: number | null;
  postBackupError: string | null;
};

export type MemberPointReceiptRecoveryInput = {
  memberId: number;
  expectedLineUserId: string;
  expectedBalance: number;
  expectedOpeningTransactionId: number;
  expectedOpeningAmount: number;
  expectedHeldReceiptIds: number[];
  expectedRejectedReceiptCount: number;
  actorId: number;
  reason: string;
};

function createPool(): Pool {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error(
      "DATABASE_URL is required for member point receipt recovery"
    );
  }
  return mysql.createPool({
    uri,
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 20,
  });
}

export function normalizeRecoveryReceiptIds(ids: number[]) {
  return [...new Set(ids.map(Number))].sort((a, b) => a - b);
}

export function recoveryReceiptIdsHash(ids: number[]) {
  return createHash("sha256")
    .update(normalizeRecoveryReceiptIds(ids).join(","))
    .digest("hex");
}

function placeholders(length: number) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("at least one held receipt is required");
  }
  return Array.from({ length }, () => "?").join(",");
}

async function ensureAuditTable(pool: Pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS member_point_receipt_recovery_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recoveryKey VARCHAR(120) NOT NULL,
    memberId INT NOT NULL,
    lineUserId VARCHAR(64) NOT NULL,
    openingTransactionId INT NOT NULL,
    restoredPointAmount BIGINT NOT NULL,
    releasedReceiptCount INT NOT NULL,
    releasedReceiptIdsHash CHAR(64) NOT NULL,
    releasedReceiptIdsJson JSON NOT NULL,
    expectedRejectedReceiptCount INT NOT NULL,
    actorId INT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL,
    beforeJson JSON NOT NULL,
    afterJson JSON NULL,
    preBackupId BIGINT NULL,
    postBackupId BIGINT NULL,
    postBackupError TEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    UNIQUE KEY uq_member_point_receipt_recovery_key (recoveryKey),
    UNIQUE KEY uq_member_point_receipt_opening_tx (openingTransactionId),
    KEY idx_member_point_receipt_member (memberId, createdAt),
    KEY idx_member_point_receipt_status (status, completedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestSuccessfulBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs WHERE status='success'"
  );
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string) {
  const before = await latestSuccessfulBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs
      WHERE id>? AND reason=? AND status='success'
      ORDER BY id DESC LIMIT 1`,
    [before, reason]
  );
  const id = Number(rows[0]?.id || 0);
  if (!id) throw new Error(`required database backup failed: ${reason}`);
  return id;
}

function buildRecoveryKey(input: MemberPointReceiptRecoveryInput) {
  return `member-${input.memberId}-opening-${input.expectedOpeningTransactionId}`;
}

async function loadExistingAudit(pool: Pool, recoveryKey: string) {
  const [rows] = await pool.query<RecoveryAuditRow[]>(
    `SELECT id,memberId,lineUserId,openingTransactionId,restoredPointAmount,
            releasedReceiptCount,releasedReceiptIdsJson,status,postBackupId,postBackupError
       FROM member_point_receipt_recovery_audit
      WHERE recoveryKey=? AND status IN ('completed','completed_post_backup_failed')
      LIMIT 1`,
    [recoveryKey]
  );
  return rows[0] || null;
}

async function completeMissingPostBackup(pool: Pool, audit: RecoveryAuditRow) {
  if (audit.postBackupId) return audit.postBackupId;
  try {
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(
      `UPDATE member_point_receipt_recovery_audit
          SET status='completed',postBackupId=?,postBackupError=NULL
        WHERE id=?`,
      [postBackupId, audit.id]
    );
    return postBackupId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE member_point_receipt_recovery_audit
          SET status='completed_post_backup_failed',postBackupError=?
        WHERE id=?`,
      [message.slice(0, 4000), audit.id]
    );
    return null;
  }
}

async function loadMemberForUpdate(
  connection: PoolConnection,
  input: MemberPointReceiptRecoveryInput
) {
  const [rows] = await connection.query<MemberRow[]>(
    "SELECT id,lineUserId FROM line_users WHERE id=? FOR UPDATE",
    [input.memberId]
  );
  const member = rows[0];
  if (!member) throw new Error("member not found");
  if (member.lineUserId !== input.expectedLineUserId) {
    throw new Error("member LINE identity changed after review");
  }
  return member;
}

async function loadBalanceForUpdate(
  connection: PoolConnection,
  input: MemberPointReceiptRecoveryInput
) {
  const [rows] = await connection.query<BalanceRow[]>(
    `SELECT balance,totalEarned,totalUsed
       FROM line_point_balances WHERE lineUserId=? FOR UPDATE`,
    [input.expectedLineUserId]
  );
  const balance = rows[0];
  if (!balance) throw new Error("point balance not found");
  if (Number(balance.balance) !== input.expectedBalance) {
    throw new Error("point balance changed after review");
  }
  return {
    balance: Number(balance.balance),
    totalEarned: Number(balance.totalEarned || 0),
    totalUsed: Number(balance.totalUsed || 0),
  };
}

async function loadOpeningTransactionForUpdate(
  connection: PoolConnection,
  input: MemberPointReceiptRecoveryInput
) {
  const [rows] = await connection.query<PointTransactionRow[]>(
    `SELECT id,lineUserId,type,amount,balanceAfter,referenceType,expiresAt,
            expired,remainingAmount,description
       FROM line_point_transactions WHERE id=? FOR UPDATE`,
    [input.expectedOpeningTransactionId]
  );
  const transaction = rows[0];
  if (!transaction) throw new Error("opening recovery transaction not found");
  const validOpening =
    transaction.lineUserId === input.expectedLineUserId &&
    transaction.type === "adjustment" &&
    transaction.referenceType === "system" &&
    Number(transaction.amount) === input.expectedOpeningAmount &&
    Number(transaction.balanceAfter) === input.expectedBalance &&
    Number(transaction.expired) === 1 &&
    Number(transaction.remainingAmount || 0) === 0 &&
    transaction.expiresAt === null &&
    String(transaction.description || "").includes("系统恢复余额");
  if (!validOpening) {
    throw new Error("opening recovery transaction no longer matches evidence");
  }
  return transaction;
}

async function assertNoExistingValidPointLot(
  connection: PoolConnection,
  lineUserId: string
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS rowCount,
            COALESCE(SUM(remainingAmount),0) AS amount
       FROM line_point_transactions
      WHERE lineUserId=? AND type IN ('earn','refund')
        AND expired=0 AND remainingAmount>0 AND expiresAt>UTC_TIMESTAMP()
      `,
    [lineUserId]
  );
  const rowCount = Number(rows[0]?.rowCount || 0);
  const amount = Number(rows[0]?.amount || 0);
  if (rowCount > 0 || amount > 0) {
    throw new Error("member already has a valid point lot; recovery stopped");
  }
}

async function loadHeldReceiptsForUpdate(
  connection: PoolConnection,
  input: MemberPointReceiptRecoveryInput,
  receiptIds: number[]
) {
  const sqlPlaceholders = placeholders(receiptIds.length);
  const [rows] = await connection.query<ReceiptRow[]>(
    `SELECT id,lineUserId,status,imageUrls
       FROM line_receipts
      WHERE id IN (${sqlPlaceholders})
      ORDER BY id FOR UPDATE`,
    receiptIds
  );
  if (rows.length !== receiptIds.length) {
    throw new Error("held receipt set changed after review");
  }
  const actualIds = rows.map(row => Number(row.id));
  if (
    recoveryReceiptIdsHash(actualIds) !== recoveryReceiptIdsHash(receiptIds)
  ) {
    throw new Error("held receipt IDs changed after review");
  }
  for (const receipt of rows) {
    if (receipt.lineUserId !== input.expectedLineUserId) {
      throw new Error("held receipt ownership changed after review");
    }
    if (receipt.status !== "on_hold") {
      throw new Error("held receipt status changed after review");
    }
    let imageUrls: unknown = receipt.imageUrls;
    if (typeof imageUrls === "string") {
      try {
        imageUrls = JSON.parse(imageUrls);
      } catch {
        imageUrls = [];
      }
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error("held receipt is missing image evidence");
    }
  }
  return rows;
}

async function rejectedReceiptCount(
  connection: PoolConnection,
  lineUserId: string
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount FROM line_receipts WHERE lineUserId=? AND status='rejected'",
    [lineUserId]
  );
  return Number(rows[0]?.rowCount || 0);
}

export async function recoverMemberPointsAndHeldReceipts(
  input: MemberPointReceiptRecoveryInput
) {
  const receiptIds = normalizeRecoveryReceiptIds(input.expectedHeldReceiptIds);
  if (receiptIds.length !== input.expectedHeldReceiptIds.length) {
    throw new Error("held receipt IDs must be unique");
  }
  if (receiptIds.length < 1 || receiptIds.length > 200) {
    throw new Error("held receipt count must be between 1 and 200");
  }
  if (
    !Number.isInteger(input.expectedBalance) ||
    input.expectedBalance <= 0 ||
    input.expectedOpeningAmount !== input.expectedBalance
  ) {
    throw new Error(
      "opening recovery amount must equal the positive expected balance"
    );
  }
  if (input.reason.trim().length < 10) {
    throw new Error("a detailed recovery reason is required");
  }

  const pool = createPool();
  const recoveryKey = buildRecoveryKey(input);
  try {
    await ensureAuditTable(pool);
    const existing = await loadExistingAudit(pool, recoveryKey);
    if (existing) {
      if (
        Number(existing.memberId) !== input.memberId ||
        existing.lineUserId !== input.expectedLineUserId ||
        Number(existing.openingTransactionId) !==
          input.expectedOpeningTransactionId ||
        Number(existing.restoredPointAmount) !== input.expectedOpeningAmount ||
        Number(existing.releasedReceiptCount) !== receiptIds.length ||
        recoveryReceiptIdsHash(
          Array.isArray(existing.releasedReceiptIdsJson)
            ? existing.releasedReceiptIdsJson
            : JSON.parse(existing.releasedReceiptIdsJson)
        ) !== recoveryReceiptIdsHash(receiptIds)
      ) {
        throw new Error("completed recovery does not match this request");
      }
      const postBackupId = await completeMissingPostBackup(pool, existing);
      return {
        success: true,
        alreadyRecovered: true,
        memberId: input.memberId,
        lineUserId: input.expectedLineUserId,
        restoredPointAmount: input.expectedOpeningAmount,
        releasedReceiptCount: receiptIds.length,
        postBackupId,
      };
    }

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const connection = await pool.getConnection();
    let auditId = 0;
    let recoveryPointTransactionId = 0;
    let expiresAt: Date | null = null;
    try {
      await connection.beginTransaction();
      await loadMemberForUpdate(connection, input);
      const balance = await loadBalanceForUpdate(connection, input);
      await loadOpeningTransactionForUpdate(connection, input);
      await assertNoExistingValidPointLot(connection, input.expectedLineUserId);
      const heldReceipts = await loadHeldReceiptsForUpdate(
        connection,
        input,
        receiptIds
      );
      const rejectedCount = await rejectedReceiptCount(
        connection,
        input.expectedLineUserId
      );
      if (rejectedCount !== input.expectedRejectedReceiptCount) {
        throw new Error("rejected receipt count changed after review");
      }

      const beforeSnapshot = {
        memberId: input.memberId,
        lineUserId: input.expectedLineUserId,
        pointBalance: balance,
        openingTransactionId: input.expectedOpeningTransactionId,
        openingAmount: input.expectedOpeningAmount,
        validPointAmount: 0,
        heldReceiptIds: receiptIds,
        heldReceiptCount: heldReceipts.length,
        rejectedReceiptCount: rejectedCount,
      };
      const [auditResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO member_point_receipt_recovery_audit
          (recoveryKey,memberId,lineUserId,openingTransactionId,restoredPointAmount,
           releasedReceiptCount,releasedReceiptIdsHash,releasedReceiptIdsJson,
           expectedRejectedReceiptCount,actorId,reason,status,beforeJson,preBackupId)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'running',?,?)`,
        [
          recoveryKey,
          input.memberId,
          input.expectedLineUserId,
          input.expectedOpeningTransactionId,
          input.expectedOpeningAmount,
          receiptIds.length,
          recoveryReceiptIdsHash(receiptIds),
          JSON.stringify(receiptIds),
          input.expectedRejectedReceiptCount,
          input.actorId,
          input.reason.trim().slice(0, 500),
          JSON.stringify(beforeSnapshot),
          preBackupId,
        ]
      );
      auditId = Number(auditResult.insertId);

      const [pointResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO line_point_transactions
          (lineUserId,type,amount,balanceAfter,referenceType,referenceId,description,
           expiresAt,expired,remainingAmount,createdAt)
         VALUES (?, 'earn', ?, ?, 'system', ?, ?,
                 DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${POINT_VALIDITY_MONTHS} MONTH), 0, ?, UTC_TIMESTAMP())`,
        [
          input.expectedLineUserId,
          input.expectedOpeningAmount,
          input.expectedBalance,
          input.expectedOpeningTransactionId,
          `[系统补正] 历史恢复余额可用批次重建（账面余额不重复增加） / [システム補正] 復旧残高の有効ロット再構築（残高への再加算なし）`,
          input.expectedOpeningAmount,
        ]
      );
      recoveryPointTransactionId = Number(pointResult.insertId);

      const sqlPlaceholders = placeholders(receiptIds.length);
      const [receiptResult] = await connection.execute<ResultSetHeader>(
        `UPDATE line_receipts
            SET status='pending',reviewedBy=NULL,reviewedAt=NULL,
                reviewNote=CONCAT('[管理者解除保留] ', ?, '\n原保留理由: ', COALESCE(reviewNote,'')),
                updatedAt=UTC_TIMESTAMP()
          WHERE id IN (${sqlPlaceholders}) AND lineUserId=? AND status='on_hold'`,
        [
          input.reason.trim().slice(0, 500),
          ...receiptIds,
          input.expectedLineUserId,
        ]
      );
      if (Number(receiptResult.affectedRows) !== receiptIds.length) {
        throw new Error("not all held receipts were released");
      }

      const [afterBalanceRows] = await connection.query<BalanceRow[]>(
        `SELECT balance,totalEarned,totalUsed
           FROM line_point_balances WHERE lineUserId=?`,
        [input.expectedLineUserId]
      );
      const afterBalance = Number(afterBalanceRows[0]?.balance || 0);
      if (afterBalance !== input.expectedBalance) {
        throw new Error("raw point balance changed during valid-lot recovery");
      }
      const [validRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(remainingAmount),0) AS amount,
                MAX(expiresAt) AS expiresAt
           FROM line_point_transactions
          WHERE lineUserId=? AND type IN ('earn','refund')
            AND expired=0 AND remainingAmount>0 AND expiresAt>UTC_TIMESTAMP()`,
        [input.expectedLineUserId]
      );
      const validPointAmount = Number(validRows[0]?.amount || 0);
      expiresAt = validRows[0]?.expiresAt
        ? new Date(validRows[0].expiresAt)
        : null;
      if (validPointAmount !== input.expectedOpeningAmount || !expiresAt) {
        throw new Error("valid point lot invariant failed after recovery");
      }
      const [pendingRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS rowCount FROM line_receipts
          WHERE id IN (${sqlPlaceholders}) AND lineUserId=? AND status='pending'`,
        [...receiptIds, input.expectedLineUserId]
      );
      const pendingCount = Number(pendingRows[0]?.rowCount || 0);
      if (pendingCount !== receiptIds.length) {
        throw new Error("pending receipt invariant failed after recovery");
      }
      const rejectedCountAfter = await rejectedReceiptCount(
        connection,
        input.expectedLineUserId
      );
      if (rejectedCountAfter !== input.expectedRejectedReceiptCount) {
        throw new Error("rejected receipts changed during recovery");
      }

      const afterSnapshot = {
        memberId: input.memberId,
        lineUserId: input.expectedLineUserId,
        rawBalance: afterBalance,
        validPointAmount,
        recoveryPointTransactionId,
        expiresAt,
        pendingReceiptCount: pendingCount,
        rejectedReceiptCount: rejectedCountAfter,
      };
      await connection.execute(
        `UPDATE member_point_receipt_recovery_audit
            SET status='completed',afterJson=?,completedAt=UTC_TIMESTAMP()
          WHERE id=?`,
        [JSON.stringify(afterSnapshot), auditId]
      );
      await connection.commit();
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
        `UPDATE member_point_receipt_recovery_audit
            SET postBackupId=?,postBackupError=NULL WHERE id=?`,
        [postBackupId, auditId]
      );
    } catch (error) {
      postBackupError =
        error instanceof Error
          ? error.message.slice(0, 4000)
          : String(error).slice(0, 4000);
      await pool.execute(
        `UPDATE member_point_receipt_recovery_audit
            SET status='completed_post_backup_failed',postBackupError=?
          WHERE id=?`,
        [postBackupError, auditId]
      );
    }

    return {
      success: true,
      alreadyRecovered: false,
      memberId: input.memberId,
      lineUserId: input.expectedLineUserId,
      rawBalanceAfter: input.expectedBalance,
      validPointAmount: input.expectedOpeningAmount,
      recoveryPointTransactionId,
      pointExpiresAt: expiresAt,
      releasedReceiptCount: receiptIds.length,
      preservedRejectedReceiptCount: input.expectedRejectedReceiptCount,
      preBackupId,
      postBackupId,
      postBackupError,
    };
  } finally {
    await pool.end();
  }
}
