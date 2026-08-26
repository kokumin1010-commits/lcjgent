import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { runDatabaseBackup } from './databaseBackupScheduler';

const UPGRADE_KEY = 'member-risk-restrictions-v1';
const PRE_BACKUP_REASON = 'pre-member-risk-v1';
const POST_BACKUP_REASON = 'post-member-risk-v1';
const REQUIRED_TABLES = ['member_risk_restrictions', 'member_risk_action_logs'] as const;

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_risk_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function tableState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [REQUIRED_TABLES],
  );
  const existing = rows.map(row => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter(table => !existing.includes(table)) };
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs');
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, errorMessage FROM db_backup_runs
      WHERE id > ? AND reason = ? ORDER BY id DESC LIMIT 1`,
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row) throw new Error(`verified backup row missing: ${reason}`);
  if (String(row.status) !== 'success') throw new Error(`verified backup failed: ${reason}: ${String(row.errorMessage || 'unknown')}`);
  return Number(row.id);
}

async function ensureRiskTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_risk_restrictions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      memberId INT NOT NULL,
      scope ENUM('order','receipt','points') NOT NULL,
      status ENUM('active','released','expired') NOT NULL DEFAULT 'active',
      reason VARCHAR(1000) NOT NULL,
      evidenceJson JSON NOT NULL,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt TIMESTAMP NOT NULL,
      createdBy BIGINT NOT NULL,
      createdByName VARCHAR(255) NULL,
      approvedBy BIGINT NOT NULL,
      approvedByName VARCHAR(255) NULL,
      releasedAt TIMESTAMP NULL,
      releasedBy BIGINT NULL,
      releasedByName VARCHAR(255) NULL,
      releaseReason VARCHAR(1000) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      activeScopeKey VARCHAR(100) GENERATED ALWAYS AS (
        CASE WHEN status = 'active' THEN CONCAT(memberId, ':', scope) ELSE NULL END
      ) STORED,
      UNIQUE KEY uq_member_risk_active_scope (activeScopeKey),
      INDEX idx_member_risk_member_status (memberId, status, expiresAt),
      INDEX idx_member_risk_scope_status (scope, status, expiresAt),
      INDEX idx_member_risk_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_risk_action_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      restrictionId BIGINT NULL,
      memberId INT NOT NULL,
      scope ENUM('order','receipt','points') NOT NULL,
      action VARCHAR(40) NOT NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      reason VARCHAR(1000) NOT NULL,
      evidenceJson JSON NULL,
      actorId BIGINT NOT NULL,
      actorName VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_risk_log_member_time (memberId, createdAt),
      INDEX idx_member_risk_log_restriction (restrictionId),
      INDEX idx_member_risk_log_actor_time (actorId, createdAt),
      INDEX idx_member_risk_log_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function getMemberRiskUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const tables = await tableState(pool);
    let restrictionCount = 0;
    let activeRestrictionCount = 0;
    let auditCount = 0;
    if (tables.missing.length === 0) {
      const [restrictionRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS restrictionCount,
                SUM(CASE WHEN status='active' AND expiresAt > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS activeRestrictionCount
           FROM member_risk_restrictions`,
      );
      const [auditRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS auditCount FROM member_risk_action_logs');
      restrictionCount = Number(restrictionRows[0]?.restrictionCount || 0);
      activeRestrictionCount = Number(restrictionRows[0]?.activeRestrictionCount || 0);
      auditCount = Number(auditRows[0]?.auditCount || 0);
    }
    const [runRows] = await pool.query<RowDataPacket[]>(
      'SELECT status, completedAt, details, errorMessage FROM member_risk_upgrade_runs WHERE recoveryKey=? LIMIT 1',
      [UPGRADE_KEY],
    );
    const [backupRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reason, status, tableCount, rowCount, encryptedBytes, checksum, completedAt, errorMessage
         FROM db_backup_runs WHERE reason IN (?, ?) ORDER BY id DESC LIMIT 8`,
      [PRE_BACKUP_REASON, POST_BACKUP_REASON],
    );
    const run = runRows[0];
    return {
      healthy: tables.missing.length === 0 && (!run || String(run.status) === 'success'),
      upgradeKey: UPGRADE_KEY,
      missingTables: tables.missing,
      restrictionCount,
      activeRestrictionCount,
      auditCount,
      run: run ? {
        status: String(run.status),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        details: typeof run.details === 'string' ? JSON.parse(run.details) : run.details,
        errorMessage: run.errorMessage ? String(run.errorMessage).slice(0, 1000) : null,
      } : null,
      backups: backupRows.map(row => ({
        id: Number(row.id), reason: String(row.reason), status: String(row.status),
        tableCount: row.tableCount == null ? null : Number(row.tableCount),
        rowCount: row.rowCount == null ? null : Number(row.rowCount),
        encryptedBytes: row.encryptedBytes == null ? null : Number(row.encryptedBytes),
        checksum: row.checksum ? String(row.checksum) : null,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        errorMessage: row.errorMessage ? String(row.errorMessage).slice(0, 1000) : null,
      })),
    };
  } finally {
    await pool.end();
  }
}

export async function runMemberRiskUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for member risk upgrade');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const before = await tableState(pool);
    if (before.missing.length === 0) {
      await pool.query(
        `UPDATE member_risk_restrictions SET status='expired', updatedAt=CURRENT_TIMESTAMP
          WHERE status='active' AND expiresAt <= UTC_TIMESTAMP()`,
      );
      console.log('[MemberRiskUpgrade] schema healthy');
      return;
    }
    await pool.query(
      `INSERT INTO member_risk_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ before, requiredTables: REQUIRED_TABLES })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await ensureRiskTables(pool);
    const after = await tableState(pool);
    if (after.missing.length > 0) throw new Error(`member risk tables still missing: ${after.missing.join(',')}`);
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = { before, after, preBackupId, postBackupId, dataRowsModified: 0, automaticRestrictionRowsCreated: 0 };
    await pool.query(
      `UPDATE member_risk_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[MemberRiskUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE member_risk_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
