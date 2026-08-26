import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { runDatabaseBackup } from './databaseBackupScheduler';

const UPGRADE_KEY = 'member-identity-claim-v1';
const PRE_REASON = 'pre-member-identity-v1';
const POST_REASON = 'post-member-identity-v1';

async function ensureRunTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_identity_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableExists(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS rowCount FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='member_identity_action_logs'`);
  return Number(rows[0]?.rowCount || 0) === 1;
}

async function latestBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs');
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool, reason: string) {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1`,
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row || String(row.status) !== 'success') throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || 'missing')}`);
  return Number(row.id);
}

async function ensureActionLogTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_identity_action_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      memberId INT NOT NULL,
      action ENUM('line_profile_claimed','email_password_claimed','admin_linked') NOT NULL,
      beforeClass VARCHAR(64) NOT NULL,
      afterClass VARCHAR(64) NOT NULL,
      verificationMethod ENUM('line_oauth','line_profile_api','email_reset_token','admin_evidence') NOT NULL,
      evidenceJson JSON NOT NULL,
      actorType ENUM('member','admin','system') NOT NULL,
      actorId BIGINT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_identity_action_member_time (memberId,createdAt),
      INDEX idx_member_identity_action_action_time (action,createdAt),
      INDEX idx_member_identity_action_actor_time (actorType,actorId,createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function runMemberIdentityUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for member identity upgrade');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    if (await tableExists(pool)) {
      console.log('[MemberIdentityUpgrade] schema healthy');
      return;
    }
    await pool.query(
      `INSERT INTO member_identity_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ actionLogTableExists: false, automaticMemberMergeCount: 0 })],
    );
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await ensureActionLogTable(pool);
    if (!(await tableExists(pool))) throw new Error('member identity action log table missing after setup');
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = { actionLogTableExists: true, preBackupId, postBackupId, automaticMemberMergeCount: 0, deletedPlaceholderCount: 0 };
    await pool.query(
      `UPDATE member_identity_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[MemberIdentityUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE member_identity_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0,4000), UPGRADE_KEY],
    ).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

export async function getMemberIdentityUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const exists = await tableExists(pool);
    let actionLogCount = 0;
    if (exists) {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS rowCount FROM member_identity_action_logs');
      actionLogCount = Number(rows[0]?.rowCount || 0);
    }
    const [runRows] = await pool.query<RowDataPacket[]>(
      'SELECT status,completedAt,details,errorMessage FROM member_identity_upgrade_runs WHERE recoveryKey=? LIMIT 1',
      [UPGRADE_KEY],
    );
    const run = runRows[0];
    return {
      healthy: exists && (!run || String(run.status) === 'success'),
      tableExists: exists,
      actionLogCount,
      run: run ? {
        status: String(run.status),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        details: typeof run.details === 'string' ? JSON.parse(run.details) : run.details,
        errorMessage: run.errorMessage ? String(run.errorMessage) : null,
      } : null,
    };
  } finally {
    await pool.end();
  }
}
