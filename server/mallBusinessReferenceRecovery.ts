import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "mall-business-member-refs-v1";
const PRE_BACKUP_REASON = "pre-mall-refs-v1";
const POST_BACKUP_REASON = "post-mall-refs-v1";

const SOURCES = [
  { table: "mall_orders", idColumn: "id", memberColumn: "lineUserId" },
  { table: "user_addresses", idColumn: "id", memberColumn: "lineUserId" },
  { table: "point_exchanges", idColumn: "id", memberColumn: "lineUserId" },
] as const;

type OrphanRow = {
  sourceTable: string;
  sourceRowId: number;
  legacyMemberId: number;
};

type RecoveryState = {
  sourceRows: number;
  orphanRows: number;
  uniqueOrphanMemberIds: number;
  auditRows: number;
  pointOrdersWithoutLedger: number;
  healthy: boolean;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for mall business reference recovery"
    );
  return mysql.createPool(databaseUrl);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS mall_business_reference_recovery_audit (
    id bigint NOT NULL AUTO_INCREMENT,
    evidenceKey varchar(160) NOT NULL,
    sourceTable varchar(80) NOT NULL,
    sourceRowId bigint NOT NULL,
    legacyMemberId bigint NOT NULL,
    action varchar(64) NOT NULL,
    note text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY mall_business_ref_evidence_unique (evidenceKey),
    KEY mall_business_ref_member_idx (legacyMemberId),
    KEY mall_business_ref_source_idx (sourceTable, sourceRowId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS mall_business_reference_recovery_runs (
    id bigint NOT NULL AUTO_INCREMENT,
    recoveryKey varchar(160) NOT NULL,
    status varchar(20) NOT NULL,
    startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt timestamp NULL DEFAULT NULL,
    insertedMemberPlaceholders int NOT NULL DEFAULT 0,
    repairedReferenceRows int NOT NULL DEFAULT 0,
    details json NULL,
    errorMessage text NULL,
    PRIMARY KEY (id),
    UNIQUE KEY mall_business_ref_run_unique (recoveryKey)
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

async function loadOrphans(pool: Pool | PoolConnection): Promise<OrphanRow[]> {
  const rows: OrphanRow[] = [];
  for (const source of SOURCES) {
    const [sourceRows] = await pool.query<RowDataPacket[]>(
      `SELECT t.\`${source.idColumn}\` AS sourceRowId,
              t.\`${source.memberColumn}\` AS legacyMemberId
         FROM \`${source.table}\` t
         LEFT JOIN line_users u ON u.id = t.\`${source.memberColumn}\`
        WHERE t.\`${source.memberColumn}\` IS NOT NULL AND u.id IS NULL`
    );
    for (const row of sourceRows) {
      rows.push({
        sourceTable: source.table,
        sourceRowId: Number(row.sourceRowId),
        legacyMemberId: Number(row.legacyMemberId),
      });
    }
  }
  return rows;
}

async function getPointOrdersWithoutLedger(
  pool: Pool | PoolConnection
): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS rowCount
      FROM mall_orders o
     WHERE COALESCE(o.pointsUsed, 0) > 0
       AND NOT EXISTS (
         SELECT 1 FROM line_point_transactions t
          WHERE t.referenceType = 'order' AND t.referenceId = o.id
       )
  `);
  return Number(rows[0]?.rowCount || 0);
}

async function getState(pool: Pool): Promise<RecoveryState> {
  const [sourceCountRows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM mall_orders) +
      (SELECT COUNT(*) FROM user_addresses) +
      (SELECT COUNT(*) FROM point_exchanges) AS sourceRows,
      (SELECT COUNT(*) FROM mall_business_reference_recovery_audit) AS auditRows
  `);
  const orphans = await loadOrphans(pool);
  const pointOrdersWithoutLedger = await getPointOrdersWithoutLedger(pool);
  const state: RecoveryState = {
    sourceRows: Number(sourceCountRows[0]?.sourceRows || 0),
    orphanRows: orphans.length,
    uniqueOrphanMemberIds: new Set(orphans.map(row => row.legacyMemberId)).size,
    auditRows: Number(sourceCountRows[0]?.auditRows || 0),
    pointOrdersWithoutLedger,
    healthy: false,
  };
  state.healthy = state.orphanRows === 0;
  return state;
}

async function upsertAudit(
  connection: PoolConnection,
  orphans: OrphanRow[]
): Promise<void> {
  for (const row of orphans) {
    await connection.execute(
      `INSERT INTO mall_business_reference_recovery_audit
         (evidenceKey, sourceTable, sourceRowId, legacyMemberId, action, note)
       VALUES (?, ?, ?, ?, 'inserted_minimal_member_identity', ?)
       ON DUPLICATE KEY UPDATE legacyMemberId=VALUES(legacyMemberId),
         action=VALUES(action), note=VALUES(note)`,
      [
        `${row.sourceTable}:${row.sourceRowId}:member:${row.legacyMemberId}`,
        row.sourceTable,
        row.sourceRowId,
        row.legacyMemberId,
        "The existing business row is primary evidence that this numeric member ID existed. No name, email, password or LINE ID was inferred.",
      ]
    );
  }
}

async function insertMemberPlaceholders(
  connection: PoolConnection,
  memberIds: number[]
): Promise<void> {
  for (const memberId of memberIds) {
    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      throw new Error(`invalid legacy member ID: ${memberId}`);
    }
    await connection.execute(
      `INSERT IGNORE INTO line_users
         (id, displayName, userType, isBlocked, createdAt, updatedAt)
       VALUES (?, ?, 'customer', 0, NOW(), NOW())`,
      [memberId, `復旧会員 #${memberId}`]
    );
  }
}

async function getLatestRun(
  pool: Pool
): Promise<Record<string, unknown> | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, recoveryKey, status, startedAt, completedAt,
            insertedMemberPlaceholders, repairedReferenceRows, details, errorMessage
       FROM mall_business_reference_recovery_runs ORDER BY id DESC LIMIT 1`
  );
  return rows[0] || null;
}

export async function getMallBusinessReferenceRecoveryHealth() {
  const pool = createPool();
  try {
    await ensureTables(pool);
    return {
      ...(await getState(pool)),
      recoveryKey: RECOVERY_KEY,
      latestRun: await getLatestRun(pool),
      ledgerPolicy:
        "Existing point-using orders without a ledger are preserved and flagged; no synthetic financial transaction is created when the original running balance is unknown.",
    };
  } finally {
    await pool.end();
  }
}

export async function runMallBusinessReferenceRecovery(): Promise<{
  skipped: boolean;
  healthy: boolean;
  details: Record<string, unknown>;
}> {
  const pool = createPool();
  let runId = 0;
  try {
    await ensureTables(pool);
    const beforeState = await getState(pool);
    const orphans = await loadOrphans(pool);
    if (orphans.length === 0) {
      return { skipped: true, healthy: true, details: beforeState };
    }

    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    const [runResult] = await pool.execute<any>(
      `INSERT INTO mall_business_reference_recovery_runs (recoveryKey, status, details)
       VALUES (?, 'running', ?)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, errorMessage=NULL, details=VALUES(details), id=LAST_INSERT_ID(id)`,
      [
        RECOVERY_KEY,
        jsonText({ preBackupId, beforeState, orphanRows: orphans.length }),
      ]
    );
    runId = Number(runResult.insertId || 0);

    const connection = await pool.getConnection();
    const memberIds = [...new Set(orphans.map(row => row.legacyMemberId))];
    try {
      await connection.beginTransaction();
      await insertMemberPlaceholders(connection, memberIds);
      await upsertAudit(connection, orphans);
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
      preBackupId,
      postBackupId,
      beforeState,
      afterState,
      insertedMemberPlaceholders: memberIds.length,
      repairedReferenceRows: orphans.length,
      pointOrdersWithoutLedger: afterState.pointOrdersWithoutLedger,
      ledgerPolicy:
        "Preserve order evidence; do not invent a historical point transaction without the original running balance.",
    };
    await pool.execute(
      `UPDATE mall_business_reference_recovery_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP,
              insertedMemberPlaceholders=?, repairedReferenceRows=?, details=?, errorMessage=NULL
        WHERE id=?`,
      [memberIds.length, orphans.length, jsonText(details), runId]
    );
    return { skipped: false, healthy: true, details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await pool
        .execute(
          `UPDATE mall_business_reference_recovery_runs
              SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE id=?`,
          [message, runId]
        )
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}
