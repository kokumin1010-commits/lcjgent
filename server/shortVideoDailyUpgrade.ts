import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const SHORT_VIDEO_DAILY_UPGRADE_KEY = "short-video-daily-v1";
export const SHORT_VIDEO_DAILY_PRE_BACKUP_REASON = "pre-short-video-daily-v1";
export const SHORT_VIDEO_DAILY_POST_BACKUP_REASON = "post-short-video-daily-v1";

const REQUIRED_TABLES = [
  "short_video_daily_entries",
  "short_video_daily_audit_logs",
  "short_video_daily_upgrade_runs",
] as const;

const REQUIRED_ENTRY_COLUMNS = [
  "id",
  "reportDate",
  "accountId",
  "accountName",
  "videoUrl",
  "videoUrlHash",
  "activeKey",
  "producerStaffId",
  "producerName",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "productClicks",
  "orders",
  "gmv",
  "currency",
  "notes",
  "createdById",
  "createdByName",
  "updatedById",
  "updatedByName",
  "deletedAt",
  "deletedById",
  "createdAt",
  "updatedAt",
] as const;

let schemaReady = false;

function createPool() {
  const uri = process.env.DATABASE_URL;
  if (!uri)
    throw new Error("DATABASE_URL is required for short video daily upgrade");
  return mysql.createPool({
    uri,
    connectionLimit: 2,
    waitForConnections: true,
    queueLimit: 20,
  });
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function getColumns(pool: Pool, tableName: string): Promise<string[]> {
  if (!(await tableExists(pool, tableName))) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName]
  );
  return rows.map(row => String(row.columnName));
}

async function createTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS short_video_daily_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportDate DATE NOT NULL,
    accountId INT NULL,
    accountName VARCHAR(255) NULL,
    videoUrl VARCHAR(1200) NOT NULL,
    videoUrlHash CHAR(64) NOT NULL,
    activeKey BIGINT NOT NULL DEFAULT 0,
    producerStaffId INT NOT NULL,
    producerName VARCHAR(255) NOT NULL,
    views BIGINT NOT NULL DEFAULT 0,
    likes BIGINT NOT NULL DEFAULT 0,
    comments BIGINT NOT NULL DEFAULT 0,
    shares BIGINT NOT NULL DEFAULT 0,
    saves BIGINT NOT NULL DEFAULT 0,
    productClicks BIGINT NOT NULL DEFAULT 0,
    orders BIGINT NOT NULL DEFAULT 0,
    gmv DECIMAL(20,2) NOT NULL DEFAULT 0,
    currency ENUM('JPY','CNY') NOT NULL DEFAULT 'JPY',
    notes TEXT NULL,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    deletedById BIGINT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_short_video_daily_date (reportDate, deletedAt),
    INDEX idx_short_video_daily_producer (producerStaffId, reportDate, deletedAt),
    INDEX idx_short_video_daily_account (accountId, reportDate, deletedAt),
    INDEX idx_short_video_daily_currency (currency, reportDate, deletedAt),
    INDEX idx_short_video_daily_url_hash (videoUrlHash, deletedAt),
    UNIQUE KEY uq_short_video_daily_active_url (videoUrlHash, activeKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS short_video_daily_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entryId BIGINT NULL,
    action ENUM('create','update','delete') NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_short_video_daily_audit_entry (entryId, createdAt),
    INDEX idx_short_video_daily_audit_actor (actorId, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS short_video_daily_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function getEntrySnapshot(pool: Pool) {
  if (!(await tableExists(pool, "short_video_daily_entries"))) {
    return {
      rowCount: 0,
      maxId: 0,
      totalViews: 0,
      totalOrders: 0,
      totalGmv: 0,
    };
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS rowCount, COALESCE(MAX(id),0) AS maxId,
            COALESCE(SUM(views),0) AS totalViews,
            COALESCE(SUM(orders),0) AS totalOrders,
            COALESCE(SUM(gmv),0) AS totalGmv
       FROM short_video_daily_entries`
  );
  const row = rows[0] || {};
  return {
    rowCount: Number(row.rowCount || 0),
    maxId: Number(row.maxId || 0),
    totalViews: Number(row.totalViews || 0),
    totalOrders: Number(row.totalOrders || 0),
    totalGmv: Number(row.totalGmv || 0),
  };
}

async function getState(pool: Pool) {
  const existingTables: string[] = [];
  for (const table of REQUIRED_TABLES) {
    if (await tableExists(pool, table)) existingTables.push(table);
  }
  const entryColumns = await getColumns(pool, "short_video_daily_entries");
  const missingTables = REQUIRED_TABLES.filter(
    table => !existingTables.includes(table)
  );
  const missingEntryColumns = REQUIRED_ENTRY_COLUMNS.filter(
    column => !entryColumns.includes(column)
  );
  return { existingTables, entryColumns, missingTables, missingEntryColumns };
}

async function latestSuccessfulBackup(
  pool: Pool,
  reason: string
): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM db_backup_runs WHERE reason=? AND status='success' ORDER BY id DESC LIMIT 1`,
    [reason]
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const [beforeRows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs"
  );
  const beforeId = Number(beforeRows[0]?.id || 0);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,status,errorMessage FROM db_backup_runs
      WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1`,
    [beforeId, reason]
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(
      `verified backup failed: ${reason}: ${String(row?.errorMessage || "missing run")}`
    );
  }
  return Number(row.id);
}

async function isCompleted(pool: Pool): Promise<boolean> {
  if (!(await tableExists(pool, "short_video_daily_upgrade_runs")))
    return false;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM short_video_daily_upgrade_runs WHERE recoveryKey=? LIMIT 1",
    [SHORT_VIDEO_DAILY_UPGRADE_KEY]
  );
  return String(rows[0]?.status || "") === "success";
}

export async function getShortVideoDailyUpgradeHealth(poolOverride?: Pool) {
  const pool = poolOverride || createPool();
  try {
    const state = await getState(pool);
    const completed = await isCompleted(pool);
    const [runRows] = (await tableExists(
      pool,
      "short_video_daily_upgrade_runs"
    ))
      ? await pool.query<RowDataPacket[]>(
          "SELECT status,completedAt,details,errorMessage FROM short_video_daily_upgrade_runs WHERE recoveryKey=? LIMIT 1",
          [SHORT_VIDEO_DAILY_UPGRADE_KEY]
        )
      : [[] as unknown as RowDataPacket[], [] as unknown as object];
    const run = runRows[0];
    return {
      healthy:
        state.missingTables.length === 0 &&
        state.missingEntryColumns.length === 0 &&
        completed,
      ...state,
      entrySnapshot: await getEntrySnapshot(pool),
      run: run
        ? {
            status: String(run.status),
            completedAt: run.completedAt
              ? new Date(run.completedAt).toISOString()
              : null,
            details:
              typeof run.details === "string"
                ? JSON.parse(run.details)
                : run.details,
            errorMessage:
              run.errorMessage == null ? null : String(run.errorMessage),
          }
        : null,
    };
  } finally {
    if (!poolOverride) await pool.end();
  }
}

export async function ensureShortVideoDailySchemaReady(
  poolOverride?: Pool
): Promise<void> {
  if (schemaReady) return;
  const health = await getShortVideoDailyUpgradeHealth(poolOverride);
  if (!health.healthy) {
    throw new Error(
      `short video daily schema is not ready: tables=${health.missingTables.join(",")} columns=${health.missingEntryColumns.join(",")}`
    );
  }
  schemaReady = true;
}

export async function runShortVideoDailyUpgradeSetup(): Promise<void> {
  const pool = createPool();
  try {
    const beforeState = await getState(pool);
    if (
      beforeState.missingTables.length === 0 &&
      beforeState.missingEntryColumns.length === 0 &&
      (await isCompleted(pool))
    ) {
      schemaReady = true;
      console.log("[ShortVideoDailyUpgrade] schema healthy");
      return;
    }

    const beforeSnapshot = await getEntrySnapshot(pool);
    let preBackupId = await latestSuccessfulBackup(
      pool,
      SHORT_VIDEO_DAILY_PRE_BACKUP_REASON
    );
    if (!preBackupId)
      preBackupId = await runVerifiedBackup(
        pool,
        SHORT_VIDEO_DAILY_PRE_BACKUP_REASON
      );

    await createTables(pool);
    await pool.query(
      `INSERT INTO short_video_daily_upgrade_runs
       (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [
        SHORT_VIDEO_DAILY_UPGRADE_KEY,
        JSON.stringify({ beforeState, beforeSnapshot, preBackupId }),
      ]
    );

    const afterState = await getState(pool);
    const afterSnapshot = await getEntrySnapshot(pool);
    if (
      afterState.missingTables.length > 0 ||
      afterState.missingEntryColumns.length > 0
    ) {
      throw new Error(
        `short video daily schema incomplete: tables=${afterState.missingTables.join(",")} columns=${afterState.missingEntryColumns.join(",")}`
      );
    }
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
      throw new Error(
        `short video daily rows changed during schema upgrade: before=${JSON.stringify(beforeSnapshot)} after=${JSON.stringify(afterSnapshot)}`
      );
    }

    const postBackupId = await runVerifiedBackup(
      pool,
      SHORT_VIDEO_DAILY_POST_BACKUP_REASON
    );
    const details = {
      beforeState,
      afterState,
      beforeSnapshot,
      afterSnapshot,
      preBackupId,
      postBackupId,
      businessRowsModified: 0,
    };
    await pool.query(
      `UPDATE short_video_daily_upgrade_runs
          SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify(details), SHORT_VIDEO_DAILY_UPGRADE_KEY]
    );
    schemaReady = true;
    console.log(`[ShortVideoDailyUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      await tableExists(pool, "short_video_daily_upgrade_runs").catch(
        () => false
      )
    ) {
      await pool
        .query(
          `UPDATE short_video_daily_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?`,
          [message.slice(0, 4000), SHORT_VIDEO_DAILY_UPGRADE_KEY]
        )
        .catch(() => undefined);
    }
    console.error(`[ShortVideoDailyUpgrade] failed ${message}`);
    throw error;
  } finally {
    await pool.end();
  }
}
