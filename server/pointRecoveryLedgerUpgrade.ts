import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "point-recovery-ledger-v1";
const SOURCE_DATASET_SHA256 = "ab00afcd84f1f082f67e896d4ce334e42186733ad72e3524055dec97ec625953";
const PRE_BACKUP_REASON = "pre-user-flow-fix-v1";
const POST_BACKUP_REASON = "post-point-ledger-v1";
const LOCK_NAME = "lcj_point_recovery_ledger_v1";

type EvidenceRow = RowDataPacket & {
  evidenceKey: string;
  evidenceBalance: number;
  evidenceTotalEarned: number;
  evidenceTotalUsed: number;
  sourceSnapshotAt: Date | string;
  memberId: number | null;
  verifiedLineUserId: string | null;
};

type BalanceRow = RowDataPacket & {
  lineUserId: string;
  balance: number;
};

type CountRow = RowDataPacket & { rowCount: number };

type OpeningEntry = {
  canonicalPointKey: string;
  memberId: number | null;
  evidenceKeys: string[];
  evidenceBalance: number;
  evidenceTotalEarned: number;
  evidenceTotalUsed: number;
  sourceSnapshotAt: Date;
  currentBalance: number;
};

function createPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for point recovery ledger upgrade");
  return mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 2 });
}

async function ensureTables(pool: Pool | PoolConnection): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS point_recovery_ledger_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(120) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    candidateCount int NOT NULL DEFAULT 0,
    insertedTransactions int NOT NULL DEFAULT 0,
    skippedMismatchCount int NOT NULL DEFAULT 0,
    balanceTotalBefore bigint NOT NULL DEFAULT 0,
    balanceTotalAfter bigint NOT NULL DEFAULT 0,
    preBackupId bigint NULL,
    postBackupId bigint NULL,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY point_recovery_ledger_run_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS point_recovery_ledger_audit (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryRunId bigint NOT NULL,
    recoveryKey varchar(120) NOT NULL,
    canonicalPointKey varchar(80) NOT NULL,
    memberId int NULL,
    evidenceKeysJson json NOT NULL,
    evidenceBalance bigint NOT NULL,
    evidenceTotalEarned bigint NOT NULL,
    evidenceTotalUsed bigint NOT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    sourceSnapshotAt datetime NOT NULL,
    transactionId int NOT NULL,
    action varchar(50) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY point_recovery_ledger_entry_unique (recoveryKey, canonicalPointKey),
    KEY point_recovery_ledger_member_idx (memberId),
    KEY point_recovery_ledger_transaction_idx (transactionId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function parseEmailMemberId(evidenceKey: string): number | null {
  const match = /^email_(\d+)$/.exec(evidenceKey);
  return match ? Number(match[1]) : null;
}

export function canonicalPointKeyForEvidence(input: {
  evidenceKey: string;
  memberId: number | null;
  verifiedLineUserId: string | null;
}): string {
  if (input.verifiedLineUserId?.startsWith("U")) return input.verifiedLineUserId;
  if (input.evidenceKey.startsWith("U")) return input.evidenceKey;
  const memberId = input.memberId || parseEmailMemberId(input.evidenceKey);
  return memberId ? `email_${memberId}` : input.evidenceKey;
}

function groupEvidence(rows: EvidenceRow[], balances: Map<string, number>): OpeningEntry[] {
  const grouped = new Map<string, OpeningEntry>();
  for (const row of rows) {
    const canonicalPointKey = canonicalPointKeyForEvidence(row);
    const existing = grouped.get(canonicalPointKey);
    const snapshotAt = new Date(row.sourceSnapshotAt);
    if (!existing) {
      grouped.set(canonicalPointKey, {
        canonicalPointKey,
        memberId: row.memberId ? Number(row.memberId) : null,
        evidenceKeys: [String(row.evidenceKey)],
        evidenceBalance: Number(row.evidenceBalance || 0),
        evidenceTotalEarned: Number(row.evidenceTotalEarned || 0),
        evidenceTotalUsed: Number(row.evidenceTotalUsed || 0),
        sourceSnapshotAt: snapshotAt,
        currentBalance: Number(balances.get(canonicalPointKey) || 0),
      });
      continue;
    }
    existing.evidenceKeys.push(String(row.evidenceKey));
    existing.evidenceBalance += Number(row.evidenceBalance || 0);
    existing.evidenceTotalEarned += Number(row.evidenceTotalEarned || 0);
    existing.evidenceTotalUsed += Number(row.evidenceTotalUsed || 0);
    if (snapshotAt < existing.sourceSnapshotAt) existing.sourceSnapshotAt = snapshotAt;
  }
  return [...grouped.values()];
}

async function loadOpeningPlan(pool: Pool | PoolConnection): Promise<{
  candidates: OpeningEntry[];
  mismatches: OpeningEntry[];
}> {
  const [evidence] = await pool.query<EvidenceRow[]>(`
    SELECT ma.evidenceKey, ma.evidenceBalance, ma.evidenceTotalEarned,
           ma.evidenceTotalUsed, ma.sourceSnapshotAt,
           lu.id AS memberId, lu.lineUserId AS verifiedLineUserId
      FROM mall_point_member_recovery_audit ma
      LEFT JOIN line_users lu
        ON lu.lineUserId=ma.evidenceKey
        OR (ma.evidenceKey REGEXP '^email_[0-9]+$'
            AND lu.id=CAST(SUBSTRING(ma.evidenceKey, 7) AS UNSIGNED))
     WHERE ma.sourceDatasetSha256=? AND ma.evidenceBalance>0`,
    [SOURCE_DATASET_SHA256],
  );
  const [balanceRows] = await pool.query<BalanceRow[]>(
    "SELECT lineUserId, balance FROM line_point_balances WHERE balance>0",
  );
  const balances = new Map(balanceRows.map((row) => [String(row.lineUserId), Number(row.balance || 0)]));
  const grouped = groupEvidence(evidence, balances);
  const candidates: OpeningEntry[] = [];
  const mismatches: OpeningEntry[] = [];

  for (const entry of grouped) {
    const [auditRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS rowCount FROM point_recovery_ledger_audit WHERE recoveryKey=? AND canonicalPointKey=?",
      [RECOVERY_KEY, entry.canonicalPointKey],
    );
    if (Number(auditRows[0]?.rowCount || 0) > 0) continue;
    const [transactionRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS rowCount FROM line_point_transactions WHERE lineUserId=?",
      [entry.canonicalPointKey],
    );
    if (Number(transactionRows[0]?.rowCount || 0) > 0) continue;
    if (entry.currentBalance <= 0 || entry.currentBalance !== entry.evidenceBalance) {
      mismatches.push(entry);
      continue;
    }
    candidates.push(entry);
  }
  return { candidates, mismatches };
}

async function pointTotals(pool: Pool | PoolConnection): Promise<{ rows: number; balance: number; earned: number; used: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS rowCount, COALESCE(SUM(balance),0) AS balance,
           COALESCE(SUM(totalEarned),0) AS earned, COALESCE(SUM(totalUsed),0) AS used
      FROM line_point_balances`);
  return {
    rows: Number(rows[0]?.rowCount || 0),
    balance: Number(rows[0]?.balance || 0),
    earned: Number(rows[0]?.earned || 0),
    used: Number(rows[0]?.used || 0),
  };
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool, reason: string, reuseExisting = false): Promise<number> {
  if (reuseExisting) {
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM db_backup_runs WHERE reason=? AND status='success' ORDER BY id DESC LIMIT 1",
      [reason],
    );
    if (existing[0]) return Number(existing[0].id);
  }
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status, errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [before, reason],
  );
  if (!rows[0] || rows[0].status !== "success") {
    throw new Error(`required backup failed: ${reason}: ${String(rows[0]?.errorMessage || "missing success run")}`);
  }
  return Number(rows[0].id);
}

export async function getPointRecoveryLedgerHealth() {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const plan = await loadOpeningPlan(pool);
    const [auditRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS rowCount, COALESCE(SUM(evidenceBalance),0) AS amount
        FROM point_recovery_ledger_audit WHERE recoveryKey=?`, [RECOVERY_KEY]);
    const [runRows] = await pool.query<RowDataPacket[]>(`
      SELECT id, status, candidateCount, insertedTransactions, skippedMismatchCount,
             balanceTotalBefore, balanceTotalAfter, preBackupId, postBackupId,
             completedAt, errorMessage
        FROM point_recovery_ledger_runs WHERE recoveryKey=? LIMIT 1`, [RECOVERY_KEY]);
    const auditCount = Number(auditRows[0]?.rowCount || 0);
    const latestRun = runRows[0] || null;
    const runHealthy = auditCount === 0 || (
      latestRun?.status === "success" &&
      Number(latestRun?.preBackupId || 0) > 0 &&
      Number(latestRun?.postBackupId || 0) > 0 &&
      Number(latestRun?.balanceTotalBefore || 0) === Number(latestRun?.balanceTotalAfter || 0)
    );
    return {
      healthy: plan.candidates.length === 0 && plan.mismatches.length === 0 && runHealthy,
      pendingCandidates: plan.candidates.length,
      mismatchCount: plan.mismatches.length,
      auditRows: auditCount,
      auditedOpeningBalance: Number(auditRows[0]?.amount || 0),
      latestRun,
    };
  } finally {
    await pool.end();
  }
}

export async function runPointRecoveryLedgerUpgrade(): Promise<{ skipped: boolean; healthy: boolean; details: Record<string, unknown> }> {
  const pool = createPool();
  let lockAcquired = false;
  let lockConnection: PoolConnection | null = null;
  let runId = 0;
  try {
    await ensureTables(pool);
    lockConnection = await pool.getConnection();
    const [lockRows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS acquired", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire point recovery ledger lock");

    const plan = await loadOpeningPlan(pool);
    if (plan.candidates.length === 0) {
      const [auditRows] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS rowCount FROM point_recovery_ledger_audit WHERE recoveryKey=?",
        [RECOVERY_KEY],
      );
      const auditCount = Number(auditRows[0]?.rowCount || 0);
      const [existingRuns] = await pool.query<RowDataPacket[]>(
        "SELECT id,status,preBackupId,postBackupId,balanceTotalBefore FROM point_recovery_ledger_runs WHERE recoveryKey=? LIMIT 1",
        [RECOVERY_KEY],
      );
      const existingRun = existingRuns[0] || null;
      if (auditCount > 0 && existingRun?.status !== "success") {
        const totals = await pointTotals(pool);
        const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
        await pool.execute(`
          UPDATE point_recovery_ledger_runs
             SET status='success', completedAt=CURRENT_TIMESTAMP, insertedTransactions=?,
                 balanceTotalAfter=?, postBackupId=?, errorMessage=NULL
           WHERE recoveryKey=?`,
          [auditCount, totals.balance, postBackupId, RECOVERY_KEY],
        );
      }
      const health = await getPointRecoveryLedgerHealth();
      if (!health.healthy) throw new Error("point recovery ledger health check failed");
      return { skipped: true, healthy: true, details: health };
    }
    if (plan.mismatches.length > 0) {
      throw new Error(`point recovery ledger has ${plan.mismatches.length} balance mismatch candidates`);
    }

    const preflightTotals = await pointTotals(pool);
    const preBackupId = await verifiedBackup(pool, PRE_BACKUP_REASON, true);
    const [runResult] = await pool.execute<ResultSetHeader>(`
      INSERT INTO point_recovery_ledger_runs
        (recoveryKey,status,candidateCount,skippedMismatchCount,balanceTotalBefore,preBackupId,details)
      VALUES (?, 'running', ?, 0, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
        completedAt=NULL, candidateCount=VALUES(candidateCount), skippedMismatchCount=0,
        balanceTotalBefore=VALUES(balanceTotalBefore), preBackupId=VALUES(preBackupId),
        postBackupId=NULL, errorMessage=NULL, details=VALUES(details), id=LAST_INSERT_ID(id)`,
      [RECOVERY_KEY, plan.candidates.length, preflightTotals.balance, preBackupId,
       JSON.stringify({ sourceDatasetSha256: SOURCE_DATASET_SHA256, preflightTotals })],
    );
    runId = Number(runResult.insertId);

    let beforeTotals: PointTotals | null = null;
    let afterTotals: PointTotals | null = null;
    let insertedTransactions = 0;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Lock the complete balance set before taking the invariant snapshot. Normal earn/use
      // paths update these rows, so this gives a deterministic proof that balance, earned and
      // used totals were unchanged by the one-time display-history transaction.
      await connection.query("SELECT id FROM line_point_balances ORDER BY id FOR UPDATE");
      for (const entry of plan.candidates) {
        const [lockedBalanceRows] = await connection.query<BalanceRow[]>(
          "SELECT lineUserId, balance FROM line_point_balances WHERE lineUserId=? FOR UPDATE",
          [entry.canonicalPointKey],
        );
        const lockedBalance = Number(lockedBalanceRows[0]?.balance || 0);
        if (lockedBalance !== entry.evidenceBalance) {
          throw new Error(`point balance changed before opening entry: ${entry.canonicalPointKey}`);
        }
      }

      beforeTotals = await pointTotals(connection);
      for (const entry of plan.candidates) {
        const [existingTransactions] = await connection.query<CountRow[]>(
          "SELECT COUNT(*) AS rowCount FROM line_point_transactions WHERE lineUserId=?",
          [entry.canonicalPointKey],
        );
        if (Number(existingTransactions[0]?.rowCount || 0) > 0) continue;

        const [transactionResult] = await connection.execute<ResultSetHeader>(`
          INSERT INTO line_point_transactions
            (lineUserId,type,amount,balanceAfter,referenceType,referenceId,description,
             expiresAt,expired,remainingAmount,createdAt)
          VALUES (?, 'adjustment', ?, ?, 'system', NULL, ?, NULL, 1, 0, ?)`,
          [
            entry.canonicalPointKey,
            entry.evidenceBalance,
            entry.evidenceBalance,
            "システム復旧残高 / 系统恢复余额: 2026年3月13日時点（残高への再加算なし）",
            entry.sourceSnapshotAt,
          ],
        );
        await connection.execute(`
          INSERT INTO point_recovery_ledger_audit
            (recoveryRunId,recoveryKey,canonicalPointKey,memberId,evidenceKeysJson,
             evidenceBalance,evidenceTotalEarned,evidenceTotalUsed,sourceDatasetSha256,
             sourceSnapshotAt,transactionId,action)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,'opening_history_only')`,
          [
            runId,
            RECOVERY_KEY,
            entry.canonicalPointKey,
            entry.memberId,
            JSON.stringify(entry.evidenceKeys),
            entry.evidenceBalance,
            entry.evidenceTotalEarned,
            entry.evidenceTotalUsed,
            SOURCE_DATASET_SHA256,
            entry.sourceSnapshotAt,
            Number(transactionResult.insertId),
          ],
        );
        insertedTransactions += 1;
      }

      afterTotals = await pointTotals(connection);
      if (JSON.stringify(beforeTotals) !== JSON.stringify(afterTotals)) {
        throw new Error("point totals changed while creating display-only recovery history");
      }
      await connection.execute(
        `UPDATE point_recovery_ledger_runs
            SET insertedTransactions=?, balanceTotalBefore=?, balanceTotalAfter=?, details=?
          WHERE id=?`,
        [insertedTransactions, beforeTotals.balance, afterTotals.balance,
         JSON.stringify({ sourceDatasetSha256: SOURCE_DATASET_SHA256, preflightTotals, beforeTotals, afterTotals }), runId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (!beforeTotals || !afterTotals) throw new Error("point recovery ledger invariant snapshot missing");
    const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
    await pool.execute(`
      UPDATE point_recovery_ledger_runs
         SET status='success', completedAt=CURRENT_TIMESTAMP, balanceTotalAfter=?,
             postBackupId=?, details=?
       WHERE id=?`,
      [afterTotals.balance, postBackupId,
       JSON.stringify({ sourceDatasetSha256: SOURCE_DATASET_SHA256, preflightTotals, beforeTotals, afterTotals, insertedTransactions }), runId],
    );
    const health = await getPointRecoveryLedgerHealth();
    if (!health.healthy) throw new Error("point recovery ledger health check failed after upgrade");
    return { skipped: false, healthy: true, details: health };
  } catch (error) {
    if (runId) {
      await pool.execute(
        "UPDATE point_recovery_ledger_runs SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE id=?",
        [error instanceof Error ? error.message : String(error), runId],
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    if (lockConnection) {
      if (lockAcquired) await lockConnection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
      lockConnection.release();
    }
    await pool.end();
  }
}
