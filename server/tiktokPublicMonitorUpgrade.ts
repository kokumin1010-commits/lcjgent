import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const TIKTOK_PUBLIC_MONITOR_UPGRADE_KEY = "tiktok-public-monitor-v1";
const PRE_REASON = "pre-tiktok-public-monitor-v1";
const POST_REASON = "post-tiktok-public-monitor-v1";
const ACCOUNT_COLUMNS: Record<string, string> = {
  monitorEnabled:
    "ALTER TABLE svm_accounts ADD COLUMN monitorEnabled BOOLEAN NOT NULL DEFAULT FALSE AFTER targetPostsPerDay",
  publicProvider:
    "ALTER TABLE svm_accounts ADD COLUMN publicProvider VARCHAR(32) NULL AFTER monitorEnabled",
  tiktokUserId:
    "ALTER TABLE svm_accounts ADD COLUMN tiktokUserId VARCHAR(128) NULL AFTER publicProvider",
  secUid:
    "ALTER TABLE svm_accounts ADD COLUMN secUid VARCHAR(255) NULL AFTER tiktokUserId",
  followingCount:
    "ALTER TABLE svm_accounts ADD COLUMN followingCount BIGINT NOT NULL DEFAULT 0 AFTER followerCount",
  totalLikes:
    "ALTER TABLE svm_accounts ADD COLUMN totalLikes BIGINT NOT NULL DEFAULT 0 AFTER followingCount",
  publicVideoCount:
    "ALTER TABLE svm_accounts ADD COLUMN publicVideoCount BIGINT NOT NULL DEFAULT 0 AFTER totalLikes",
  lastPublicSyncAt:
    "ALTER TABLE svm_accounts ADD COLUMN lastPublicSyncAt TIMESTAMP NULL AFTER lastPostDate",
  nextPublicSyncAt:
    "ALTER TABLE svm_accounts ADD COLUMN nextPublicSyncAt TIMESTAMP NULL AFTER lastPublicSyncAt",
  publicSyncStatus:
    "ALTER TABLE svm_accounts ADD COLUMN publicSyncStatus VARCHAR(32) NULL AFTER nextPublicSyncAt",
  publicSyncError:
    "ALTER TABLE svm_accounts ADD COLUMN publicSyncError TEXT NULL AFTER publicSyncStatus",
};
let ready = false;

function createPool(): Pool {
  const uri = process.env.DATABASE_URL;
  if (!uri)
    throw new Error("DATABASE_URL is required for TikTok public monitor");
  return mysql.createPool({
    uri,
    connectionLimit: 2,
    waitForConnections: true,
  });
}
async function tableExists(pool: Pool, name: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [name]
  );
  return Number(rows[0]?.count || 0) === 1;
}
async function columns(pool: Pool, name: string) {
  if (!(await tableExists(pool, name))) return [] as string[];
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [name]
  );
  return rows.map(row => String(row.columnName));
}
async function latestBackup(pool: Pool, reason: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM db_backup_runs WHERE reason=? AND status='success' ORDER BY id DESC LIMIT 1",
    [reason]
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}
async function verifiedBackup(pool: Pool, reason: string) {
  const existing = await latestBackup(pool, reason);
  if (existing) return existing;
  const [before] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id),0) id FROM db_backup_runs"
  );
  const beforeId = Number(before[0]?.id || 0);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason]
  );
  if (String(rows[0]?.status) !== "success")
    throw new Error(
      `verified backup failed: ${String(rows[0]?.errorMessage || "missing row")}`
    );
  return Number(rows[0].id);
}
async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_public_videos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, accountId INT NOT NULL, externalVideoId VARCHAR(128) NOT NULL,
    videoUrl VARCHAR(1200) NOT NULL, title TEXT NULL, coverUrl TEXT NULL, duration INT NOT NULL DEFAULT 0,
    publishedAt TIMESTAMP NOT NULL, playCount BIGINT NOT NULL DEFAULT 0, likeCount BIGINT NOT NULL DEFAULT 0,
    commentCount BIGINT NOT NULL DEFAULT 0, shareCount BIGINT NOT NULL DEFAULT 0, collectCount BIGINT NOT NULL DEFAULT 0,
    firstSeenAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, lastSyncedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_public_video_account_external (accountId,externalVideoId), INDEX idx_tiktok_public_video_account (accountId,publishedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_public_account_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, accountId INT NOT NULL, snapshotHour TIMESTAMP NOT NULL,
    followerCount BIGINT NOT NULL DEFAULT 0, followingCount BIGINT NOT NULL DEFAULT 0,
    totalLikes BIGINT NOT NULL DEFAULT 0, videoCount BIGINT NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_account_snapshot_hour (accountId,snapshotHour), INDEX idx_tiktok_account_snapshot_account (accountId,snapshotHour)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_public_video_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, videoId BIGINT NOT NULL, snapshotHour TIMESTAMP NOT NULL,
    playCount BIGINT NOT NULL DEFAULT 0, likeCount BIGINT NOT NULL DEFAULT 0, commentCount BIGINT NOT NULL DEFAULT 0,
    shareCount BIGINT NOT NULL DEFAULT 0, collectCount BIGINT NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_video_snapshot_hour (videoId,snapshotHour), INDEX idx_tiktok_video_snapshot_video (videoId,snapshotHour)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_public_sync_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, accountId INT NULL, triggerType VARCHAR(32) NOT NULL,
    status ENUM('running','success','failed','skipped') NOT NULL, discoveredVideos INT NOT NULL DEFAULT 0,
    updatedVideos INT NOT NULL DEFAULT 0, errorMessage TEXT NULL, startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tiktok_sync_account (accountId,startedAt), INDEX idx_tiktok_sync_status (status,startedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_public_monitor_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY, status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, completedAt TIMESTAMP NULL, details JSON NULL, errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
export async function getTikTokPublicMonitorHealth(poolOverride?: Pool) {
  const pool = poolOverride || createPool();
  try {
    const existingColumns = await columns(pool, "svm_accounts");
    const missingColumns = Object.keys(ACCOUNT_COLUMNS).filter(
      column => !existingColumns.includes(column)
    );
    const requiredTables = [
      "tiktok_public_videos",
      "tiktok_public_account_snapshots",
      "tiktok_public_video_snapshots",
      "tiktok_public_sync_runs",
      "tiktok_public_monitor_upgrade_runs",
    ];
    const missingTables: string[] = [];
    for (const table of requiredTables)
      if (!(await tableExists(pool, table))) missingTables.push(table);
    return {
      healthy: missingColumns.length === 0 && missingTables.length === 0,
      missingColumns,
      missingTables,
    };
  } finally {
    if (!poolOverride) await pool.end();
  }
}
export async function ensureTikTokPublicMonitorReady(poolOverride?: Pool) {
  if (ready) return;
  const health = await getTikTokPublicMonitorHealth(poolOverride);
  if (!health.healthy)
    throw new Error(
      `TikTok public monitor schema not ready: columns=${health.missingColumns.join(",")} tables=${health.missingTables.join(",")}`
    );
  ready = true;
}
export async function runTikTokPublicMonitorUpgradeSetup() {
  if (ready) return;
  const pool = createPool();
  try {
    const health = await getTikTokPublicMonitorHealth(pool);
    if (health.healthy) {
      ready = true;
      return;
    }
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await createTables(pool);
    const existing = new Set(await columns(pool, "svm_accounts"));
    for (const [column, sql] of Object.entries(ACCOUNT_COLUMNS))
      if (!existing.has(column)) await pool.query(sql);
    const after = await getTikTokPublicMonitorHealth(pool);
    if (!after.healthy)
      throw new Error(
        `TikTok public monitor migration incomplete: ${JSON.stringify(after)}`
      );
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    await pool.query(
      `INSERT INTO tiktok_public_monitor_upgrade_runs (recoveryKey,status,completedAt,details) VALUES (?,'success',CURRENT_TIMESTAMP,?) ON DUPLICATE KEY UPDATE status='success',completedAt=CURRENT_TIMESTAMP,details=VALUES(details),errorMessage=NULL`,
      [
        TIKTOK_PUBLIC_MONITOR_UPGRADE_KEY,
        JSON.stringify({ preBackupId, postBackupId, dataRowsModified: 0 }),
      ]
    );
    ready = true;
  } catch (error) {
    if (
      await tableExists(pool, "tiktok_public_monitor_upgrade_runs").catch(
        () => false
      )
    ) {
      await pool
        .query(
          `INSERT INTO tiktok_public_monitor_upgrade_runs (recoveryKey,status,completedAt,errorMessage) VALUES (?,'failed',CURRENT_TIMESTAMP,?) ON DUPLICATE KEY UPDATE status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=VALUES(errorMessage)`,
          [
            TIKTOK_PUBLIC_MONITOR_UPGRADE_KEY,
            String(error instanceof Error ? error.message : error).slice(
              0,
              4000
            ),
          ]
        )
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await pool.end();
  }
}
