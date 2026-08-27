import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { runDatabaseBackup } from './databaseBackupScheduler';

const UPGRADE_KEY = 'store-execution-v1';
const PRE_REASON = 'pre-store-execution-v1';
const POST_REASON = 'post-store-execution-v1';
const REQUIRED_TABLES = [
  'store_manager_goal_cycles',
  'store_manager_goals',
  'store_manager_work_items',
  'store_operation_reports',
  'store_manager_reviews',
  'store_execution_audit_logs',
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_execution_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableState(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => '?').join(',')})`,
    [...REQUIRED_TABLES],
  );
  const existing = rows.map(row => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter(name => !existing.includes(name)) };
}

async function countIfExists(pool: Pool, table: string) {
  const [exists] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
    [table],
  );
  if (!Number(exists[0]?.count || 0)) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0]?.count || 0);
}

async function sourceSnapshot(pool: Pool) {
  return {
    activeStoreCount: await countIfExists(pool, 'managed_stores'),
    uploadCount: await countIfExists(pool, 'store_data_uploads'),
    refundDailyCount: await countIfExists(pool, 'store_data_refund_daily'),
    storeProductCount: await countIfExists(pool, 'store_products'),
    goalCycleCount: await countIfExists(pool, 'store_manager_goal_cycles'),
    goalCount: await countIfExists(pool, 'store_manager_goals'),
    workItemCount: await countIfExists(pool, 'store_manager_work_items'),
    reportCount: await countIfExists(pool, 'store_operation_reports'),
    reviewCount: await countIfExists(pool, 'store_manager_reviews'),
    auditCount: await countIfExists(pool, 'store_execution_audit_logs'),
  };
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
  if (!row || String(row.status) !== 'success') throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || 'missing row')}`);
  return Number(row.id);
}

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_manager_goal_cycles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    managerStaffId INT NULL,
    managerName VARCHAR(255) NOT NULL,
    cycleType ENUM('three_month','monthly','custom') NOT NULL,
    title VARCHAR(500) NOT NULL,
    periodStart DATE NOT NULL,
    periodEnd DATE NOT NULL,
    status ENUM('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
    notes TEXT NULL,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    activatedById BIGINT NULL,
    activatedByName VARCHAR(255) NULL,
    activatedAt TIMESTAMP NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_store_goal_cycle_period (storeId,periodStart,periodEnd,status),
    INDEX idx_store_goal_cycle_manager (managerStaffId,status,periodEnd)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_manager_goals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cycleId BIGINT NOT NULL,
    storeId INT NOT NULL,
    metricKey VARCHAR(100) NOT NULL,
    metricName VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'count',
    direction ENUM('increase','decrease','maintain') NOT NULL DEFAULT 'increase',
    baselineValue DECIMAL(20,4) NULL,
    targetValue DECIMAL(20,4) NOT NULL,
    actualValue DECIMAL(20,4) NULL,
    actualSource ENUM('store_data','daily_reports','manual','not_available') NOT NULL DEFAULT 'not_available',
    weight DECIMAL(8,4) NOT NULL DEFAULT 1,
    notes TEXT NULL,
    sortOrder INT NOT NULL DEFAULT 0,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_store_goal_cycle (cycleId,deletedAt,sortOrder),
    INDEX idx_store_goal_metric (storeId,metricKey,deletedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_manager_work_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cycleId BIGINT NULL,
    storeId INT NOT NULL,
    workstream ENUM('product_links','product_page','live_sales','short_video','inventory_growth','ads_customer_refund','other') NOT NULL,
    title VARCHAR(500) NOT NULL,
    expectedResult TEXT NULL,
    ownerStaffId INT NULL,
    ownerName VARCHAR(255) NULL,
    priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    status ENUM('todo','in_progress','blocked','done','cancelled') NOT NULL DEFAULT 'todo',
    progress INT NOT NULL DEFAULT 0,
    dueDate DATE NULL,
    resultSummary TEXT NULL,
    evidenceJson JSON NULL,
    completedAt TIMESTAMP NULL,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_store_work_list (storeId,status,dueDate,deletedAt),
    INDEX idx_store_work_cycle (cycleId,workstream,deletedAt),
    INDEX idx_store_work_owner (ownerStaffId,status,dueDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_operation_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    seriesKey VARCHAR(64) NOT NULL,
    storeId INT NOT NULL,
    reportType ENUM('daily','weekly_summary','monthly_summary','custom_summary') NOT NULL,
    periodStart DATE NOT NULL,
    periodEnd DATE NOT NULL,
    title VARCHAR(500) NOT NULL,
    status ENUM('draft','submitted','confirmed','archived') NOT NULL DEFAULT 'draft',
    workSummary TEXT NULL,
    highlights TEXT NULL,
    issuesRisks TEXT NULL,
    actionsTaken TEXT NULL,
    nextPlan TEXT NULL,
    supportNeeded TEXT NULL,
    tagsJson JSON NULL,
    activityJson JSON NULL,
    evidenceJson JSON NULL,
    kpiSnapshotJson JSON NULL,
    dataEvidenceJson JSON NULL,
    linkedCycleId BIGINT NULL,
    versionNumber INT NOT NULL DEFAULT 1,
    isCurrent TINYINT(1) NOT NULL DEFAULT 1,
    supersedesId BIGINT NULL,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    confirmedById BIGINT NULL,
    confirmedByName VARCHAR(255) NULL,
    confirmedAt TIMESTAMP NULL,
    deletedAt TIMESTAMP NULL,
    deletedById BIGINT NULL,
    deletedByName VARCHAR(255) NULL,
    deleteReason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_report_series_version (seriesKey,versionNumber),
    INDEX idx_store_report_list (storeId,isCurrent,deletedAt,periodEnd,status),
    INDEX idx_store_report_period (storeId,reportType,periodStart,periodEnd),
    INDEX idx_store_report_cycle (linkedCycleId,isCurrent,deletedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_manager_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    cycleId BIGINT NULL,
    reportSeriesKey VARCHAR(64) NULL,
    resultRating INT NULL,
    executionRating INT NULL,
    qualityRating INT NULL,
    improvementRating INT NULL,
    comment TEXT NOT NULL,
    nextFocus TEXT NULL,
    supportDecision TEXT NULL,
    reviewerId BIGINT NULL,
    reviewerName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_review_store_time (storeId,createdAt),
    INDEX idx_store_review_cycle (cycleId,createdAt),
    INDEX idx_store_review_report (reportSeriesKey,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_execution_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    entityType ENUM('goal_cycle','goal','work_item','report','review') NOT NULL,
    entityId BIGINT NULL,
    seriesKey VARCHAR(64) NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_execution_audit_store (storeId,createdAt),
    INDEX idx_store_execution_audit_entity (entityType,entityId,createdAt),
    INDEX idx_store_execution_audit_series (seriesKey,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function getStoreExecutionUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const tables = await tableState(pool);
    const snapshot = await sourceSnapshot(pool);
    const [runs] = await pool.query<RowDataPacket[]>('SELECT status,completedAt,details,errorMessage FROM store_execution_upgrade_runs WHERE recoveryKey=? LIMIT 1',[UPGRADE_KEY]);
    const [backups] = await pool.query<RowDataPacket[]>(`SELECT id,reason,status,tableCount,rowCount,completedAt,errorMessage FROM db_backup_runs WHERE reason IN (?,?) ORDER BY id DESC LIMIT 6`,[PRE_REASON,POST_REASON]);
    const run = runs[0];
    return { healthy: tables.missing.length===0, recoveryKey:UPGRADE_KEY, missingTables:tables.missing, snapshot, recoveryRun:run||null, backups };
  } finally { await pool.end(); }
}

export async function runStoreExecutionUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for store execution upgrade');
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const beforeTables = await tableState(pool);
    if (beforeTables.missing.length===0) { console.log('[StoreExecutionUpgrade] schema healthy'); return; }
    const before = await sourceSnapshot(pool);
    await pool.query(`INSERT INTO store_execution_upgrade_runs (recoveryKey,status,startedAt,details) VALUES (?,'running',CURRENT_TIMESTAMP,?) ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,[UPGRADE_KEY,JSON.stringify({beforeTables,before})]);
    const preBackupId = await verifiedBackup(pool,PRE_REASON);
    await createTables(pool);
    const afterTables = await tableState(pool);
    if (afterTables.missing.length) throw new Error(`missing tables: ${afterTables.missing.join(',')}`);
    const after = await sourceSnapshot(pool);
    for (const key of ['activeStoreCount','uploadCount','refundDailyCount','storeProductCount'] as const) if (before[key]!==after[key]) throw new Error(`${key} changed during schema upgrade: ${before[key]}->${after[key]}`);
    const postBackupId = await verifiedBackup(pool,POST_REASON);
    const details = { beforeTables,afterTables,before,after,preBackupId,postBackupId,existingRowsModified:0 };
    await pool.query(`UPDATE store_execution_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?`,[JSON.stringify(details),UPGRADE_KEY]);
    console.log(`[StoreExecutionUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(`UPDATE store_execution_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?`,[message.slice(0,4000),UPGRADE_KEY]).catch(()=>undefined);
    throw error;
  } finally { await pool.end(); }
}
