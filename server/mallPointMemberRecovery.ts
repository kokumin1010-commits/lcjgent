import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import pointEvidence from "../scripts/balance_backup_20260313_044002.json";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const DATASET_SHA256 =
  "ab00afcd84f1f082f67e896d4ce334e42186733ad72e3524055dec97ec625953";
const RECOVERY_KEY = `mall-points-members-20260313-${DATASET_SHA256.slice(0, 16)}`;
const PRE_BACKUP_REASON = "pre-mall-points-v1";
const POST_BACKUP_REASON = "post-mall-points-v1";
const BATCH_SIZE = 200;

type EvidenceRow = {
  lineUserId: string;
  balance: number;
  totalEarned: number;
  totalUsed: number;
};

type PointRow = RowDataPacket & {
  lineUserId: string;
  balance: number;
  totalEarned: number;
  totalUsed: number;
};

type MemberRow = RowDataPacket & {
  id: number;
  lineUserId: string | null;
};

type RecoveryState = {
  evidenceRows: number;
  evidencePointKeysPresent: number;
  missingPointKeys: number;
  evidencePointBalance: number;
  emailIdentityKeys: number;
  emailIdentityMembersPresent: number;
  missingEmailIdentityMembers: number;
  realLineIdentityKeys: number;
  realLineMembersPresent: number;
  missingRealLineMembers: number;
  auditRows: number;
  healthy: boolean;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for mall point/member recovery");
  return mysql.createPool(databaseUrl);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE));
  }
  return result;
}

function normalizeEvidence(): EvidenceRow[] {
  const rows = pointEvidence as EvidenceRow[];
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.lineUserId || keys.has(row.lineUserId)) {
      throw new Error(
        `invalid or duplicate point evidence key: ${String(row.lineUserId)}`
      );
    }
    keys.add(row.lineUserId);
    for (const value of [row.balance, row.totalEarned, row.totalUsed]) {
      if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) {
        throw new Error(`invalid point evidence amount for ${row.lineUserId}`);
      }
    }
    if (
      Number(row.totalEarned) - Number(row.totalUsed) !==
      Number(row.balance)
    ) {
      throw new Error(
        `point evidence arithmetic mismatch for ${row.lineUserId}`
      );
    }
    if (
      !row.lineUserId.startsWith("email_") &&
      !/^U[0-9a-f]{32}$/i.test(row.lineUserId)
    ) {
      throw new Error(`unsupported point identity format: ${row.lineUserId}`);
    }
  }
  if (rows.length !== 1365)
    throw new Error(`unexpected point evidence row count: ${rows.length}`);
  return rows;
}

const EVIDENCE = normalizeEvidence();
const EMAIL_IDENTITIES = EVIDENCE.filter(row =>
  row.lineUserId.startsWith("email_")
).map(row => ({
  ...row,
  memberId: Number(row.lineUserId.slice("email_".length)),
}));
const REAL_LINE_IDENTITIES = EVIDENCE.filter(row =>
  row.lineUserId.startsWith("U")
);

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS mall_point_member_recovery_audit (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(80) NOT NULL,
    evidenceBalance bigint NOT NULL,
    evidenceTotalEarned bigint NOT NULL,
    evidenceTotalUsed bigint NOT NULL,
    currentBalanceBefore bigint NULL,
    currentTotalEarnedBefore bigint NULL,
    currentTotalUsedBefore bigint NULL,
    pointAction varchar(48) NOT NULL,
    identityAction varchar(48) NOT NULL,
    sourceDatasetSha256 varchar(64) NOT NULL,
    sourceSnapshotAt datetime NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY mall_point_member_evidence_unique (evidenceKey),
    KEY mall_point_member_point_action_idx (pointAction),
    KEY mall_point_member_identity_action_idx (identityAction)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS mall_point_member_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(160) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    insertedPointBalances int NOT NULL DEFAULT 0,
    preservedPointBalances int NOT NULL DEFAULT 0,
    insertedEmailMembers int NOT NULL DEFAULT 0,
    insertedLineMembers int NOT NULL DEFAULT 0,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY mall_point_member_recovery_run_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs"
  );
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, status, errorMessage FROM db_backup_runs WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1",
    [before, reason]
  );
  const row = rows[0];
  if (!row || row.status !== "success") {
    throw new Error(
      `required database backup failed reason=${reason}: ${String(row?.errorMessage || "missing success run")}`
    );
  }
  return Number(row.id);
}

async function loadCurrent(pool: Pool | PoolConnection): Promise<{
  pointMap: Map<string, PointRow>;
  memberIds: Set<number>;
  memberLineIds: Set<string>;
}> {
  const [pointRows] = await pool.query<PointRow[]>(
    "SELECT lineUserId, balance, totalEarned, totalUsed FROM line_point_balances"
  );
  const [memberRows] = await pool.query<MemberRow[]>(
    "SELECT id, lineUserId FROM line_users"
  );
  return {
    pointMap: new Map(pointRows.map(row => [String(row.lineUserId), row])),
    memberIds: new Set(memberRows.map(row => Number(row.id))),
    memberLineIds: new Set(
      memberRows.map(row => String(row.lineUserId || "")).filter(Boolean)
    ),
  };
}

async function getState(pool: Pool): Promise<RecoveryState> {
  const current = await loadCurrent(pool);
  let evidencePointKeysPresent = 0;
  let evidencePointBalance = 0;
  for (const row of EVIDENCE) {
    const found = current.pointMap.get(row.lineUserId);
    if (found) {
      evidencePointKeysPresent += 1;
      evidencePointBalance += Number(found.balance || 0);
    }
  }
  const emailIdentityMembersPresent = EMAIL_IDENTITIES.filter(row =>
    current.memberIds.has(row.memberId)
  ).length;
  const realLineMembersPresent = REAL_LINE_IDENTITIES.filter(row =>
    current.memberLineIds.has(row.lineUserId)
  ).length;
  const [auditRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount FROM mall_point_member_recovery_audit WHERE sourceDatasetSha256 = ?",
    [DATASET_SHA256]
  );
  const state: RecoveryState = {
    evidenceRows: EVIDENCE.length,
    evidencePointKeysPresent,
    missingPointKeys: EVIDENCE.length - evidencePointKeysPresent,
    evidencePointBalance,
    emailIdentityKeys: EMAIL_IDENTITIES.length,
    emailIdentityMembersPresent,
    missingEmailIdentityMembers:
      EMAIL_IDENTITIES.length - emailIdentityMembersPresent,
    realLineIdentityKeys: REAL_LINE_IDENTITIES.length,
    realLineMembersPresent,
    missingRealLineMembers:
      REAL_LINE_IDENTITIES.length - realLineMembersPresent,
    auditRows: Number(auditRows[0]?.rowCount || 0),
    healthy: false,
  };
  state.healthy =
    state.missingPointKeys === 0 &&
    state.missingEmailIdentityMembers === 0 &&
    state.missingRealLineMembers === 0 &&
    state.auditRows === EVIDENCE.length;
  return state;
}

async function insertMissingPoints(
  connection: PoolConnection,
  rows: EvidenceRow[]
): Promise<void> {
  for (const batch of chunks(rows)) {
    const placeholders = batch.map(() => "(?, ?, ?, ?)").join(", ");
    const values = batch.flatMap(row => [
      row.lineUserId,
      row.balance,
      row.totalEarned,
      row.totalUsed,
    ]);
    await connection.execute(
      `INSERT IGNORE INTO line_point_balances (lineUserId, balance, totalEarned, totalUsed)
       VALUES ${placeholders}`,
      values
    );
  }
}

async function insertMissingEmailMembers(
  connection: PoolConnection,
  rows: Array<{ memberId: number }>
): Promise<void> {
  for (const batch of chunks(rows)) {
    const placeholders = batch
      .map(() => "(?, ?, 'customer', 0, NOW(), NOW())")
      .join(", ");
    const values = batch.flatMap(row => [
      row.memberId,
      `復旧会員 #${row.memberId}`,
    ]);
    await connection.execute(
      `INSERT IGNORE INTO line_users
         (id, displayName, userType, isBlocked, createdAt, updatedAt)
       VALUES ${placeholders}`,
      values
    );
  }
}

async function insertMissingLineMembers(
  connection: PoolConnection,
  rows: EvidenceRow[]
): Promise<void> {
  for (const batch of chunks(rows)) {
    const placeholders = batch
      .map(() => "(?, 'LINE復旧会員', 'customer', 0, NOW(), NOW())")
      .join(", ");
    const values = batch.map(row => row.lineUserId);
    await connection.execute(
      `INSERT IGNORE INTO line_users
         (lineUserId, displayName, userType, isBlocked, createdAt, updatedAt)
       VALUES ${placeholders}`,
      values
    );
  }
}

type AuditRecord = {
  row: EvidenceRow;
  current: PointRow | undefined;
  pointAction: string;
  identityAction: string;
};

async function upsertAudit(
  connection: PoolConnection,
  records: AuditRecord[]
): Promise<void> {
  for (const batch of chunks(records)) {
    const placeholders = batch
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-03-13 04:40:02')")
      .join(", ");
    const values = batch.flatMap(
      ({ row, current, pointAction, identityAction }) => [
        row.lineUserId,
        row.balance,
        row.totalEarned,
        row.totalUsed,
        current ? Number(current.balance) : null,
        current ? Number(current.totalEarned) : null,
        current ? Number(current.totalUsed) : null,
        pointAction,
        identityAction,
        DATASET_SHA256,
      ]
    );
    await connection.execute(
      `INSERT INTO mall_point_member_recovery_audit
         (evidenceKey, evidenceBalance, evidenceTotalEarned, evidenceTotalUsed,
          currentBalanceBefore, currentTotalEarnedBefore, currentTotalUsedBefore,
          pointAction, identityAction, sourceDatasetSha256, sourceSnapshotAt)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         evidenceBalance=VALUES(evidenceBalance),
         evidenceTotalEarned=VALUES(evidenceTotalEarned),
         evidenceTotalUsed=VALUES(evidenceTotalUsed),
         currentBalanceBefore=COALESCE(currentBalanceBefore, VALUES(currentBalanceBefore)),
         currentTotalEarnedBefore=COALESCE(currentTotalEarnedBefore, VALUES(currentTotalEarnedBefore)),
         currentTotalUsedBefore=COALESCE(currentTotalUsedBefore, VALUES(currentTotalUsedBefore)),
         pointAction=VALUES(pointAction), identityAction=VALUES(identityAction),
         sourceDatasetSha256=VALUES(sourceDatasetSha256), sourceSnapshotAt=VALUES(sourceSnapshotAt)`,
      values
    );
  }
}

async function getLatestRun(
  pool: Pool
): Promise<Record<string, unknown> | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, recoveryKey, status, startedAt, completedAt, insertedPointBalances,
            preservedPointBalances, insertedEmailMembers, insertedLineMembers,
            details, errorMessage
       FROM mall_point_member_recovery_runs ORDER BY id DESC LIMIT 1`
  );
  return rows[0] || null;
}

export async function getMallPointMemberRecoveryHealth() {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const state = await getState(pool);
    const latestRun = await getLatestRun(pool);
    return {
      ...state,
      recoveryKey: RECOVERY_KEY,
      datasetSha256: DATASET_SHA256,
      evidenceTotals: EVIDENCE.reduce(
        (totals, row) => ({
          balance: totals.balance + row.balance,
          totalEarned: totals.totalEarned + row.totalEarned,
          totalUsed: totals.totalUsed + row.totalUsed,
        }),
        { balance: 0, totalEarned: 0, totalUsed: 0 }
      ),
      latestRun,
    };
  } finally {
    await pool.end();
  }
}

export async function runMallPointMemberRecovery(): Promise<{
  skipped: boolean;
  healthy: boolean;
  details: Record<string, unknown>;
}> {
  const pool = createPool();
  let runId = 0;
  try {
    await ensureTables(pool);
    const beforeState = await getState(pool);
    if (beforeState.healthy) {
      return { skipped: true, healthy: true, details: beforeState };
    }

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const [runResult] = await pool.execute<any>(
      `INSERT INTO mall_point_member_recovery_runs (recoveryKey, status, details)
       VALUES (?, 'running', ?)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, errorMessage=NULL, details=VALUES(details), id=LAST_INSERT_ID(id)`,
      [
        RECOVERY_KEY,
        jsonText({ datasetSha256: DATASET_SHA256, preBackupId, beforeState }),
      ]
    );
    runId = Number(runResult.insertId || 0);

    const connection = await pool.getConnection();
    let insertedPointBalances = 0;
    let preservedPointBalances = 0;
    let insertedEmailMembers = 0;
    let insertedLineMembers = 0;
    const pointActionCounts: Record<string, number> = {};
    try {
      await connection.beginTransaction();
      const current = await loadCurrent(connection);
      const missingPoints: EvidenceRow[] = [];
      const missingEmailMembers = EMAIL_IDENTITIES.filter(
        row => !current.memberIds.has(row.memberId)
      );
      const missingLineMembers = REAL_LINE_IDENTITIES.filter(
        row => !current.memberLineIds.has(row.lineUserId)
      );
      const auditRecords: AuditRecord[] = [];

      for (const row of EVIDENCE) {
        const found = current.pointMap.get(row.lineUserId);
        let pointAction = "inserted_from_20260313_snapshot";
        if (!found) {
          missingPoints.push(row);
        } else {
          preservedPointBalances += 1;
          const exact =
            Number(found.balance) === row.balance &&
            Number(found.totalEarned) === row.totalEarned &&
            Number(found.totalUsed) === row.totalUsed;
          if (exact) pointAction = "preserved_exact_current";
          else if (Number(found.balance) > row.balance)
            pointAction = "preserved_current_higher";
          else if (Number(found.balance) < row.balance)
            pointAction = "preserved_current_lower_review";
          else pointAction = "preserved_current_components_differ";
        }
        pointActionCounts[pointAction] =
          (pointActionCounts[pointAction] || 0) + 1;
        let identityAction = "preserved_existing_identity";
        if (row.lineUserId.startsWith("email_")) {
          const memberId = Number(row.lineUserId.slice("email_".length));
          if (!current.memberIds.has(memberId))
            identityAction = "inserted_email_identity_placeholder";
        } else if (!current.memberLineIds.has(row.lineUserId)) {
          identityAction = "inserted_line_identity_placeholder";
        }
        auditRecords.push({ row, current: found, pointAction, identityAction });
      }

      await insertMissingPoints(connection, missingPoints);
      await insertMissingEmailMembers(connection, missingEmailMembers);
      await insertMissingLineMembers(connection, missingLineMembers);
      await upsertAudit(connection, auditRecords);
      insertedPointBalances = missingPoints.length;
      insertedEmailMembers = missingEmailMembers.length;
      insertedLineMembers = missingLineMembers.length;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const afterState = await getState(pool);
    if (!afterState.healthy) {
      throw new Error(
        `post-recovery validation failed: ${jsonText(afterState)}`
      );
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      datasetSha256: DATASET_SHA256,
      preBackupId,
      postBackupId,
      insertedPointBalances,
      preservedPointBalances,
      insertedEmailMembers,
      insertedLineMembers,
      pointActionCounts,
      beforeState,
      afterState,
      mergePolicy:
        "insert missing snapshot keys; preserve every existing current balance; never add snapshot to current",
    };
    await pool.execute(
      `UPDATE mall_point_member_recovery_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP,
              insertedPointBalances=?, preservedPointBalances=?,
              insertedEmailMembers=?, insertedLineMembers=?, details=?, errorMessage=NULL
        WHERE id=?`,
      [
        insertedPointBalances,
        preservedPointBalances,
        insertedEmailMembers,
        insertedLineMembers,
        jsonText(details),
        runId,
      ]
    );
    return { skipped: false, healthy: true, details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await pool
        .execute(
          `UPDATE mall_point_member_recovery_runs
              SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=?
            WHERE id=?`,
          [message, runId]
        )
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}
