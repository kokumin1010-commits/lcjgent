import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const LIVESTREAM_REVIEW_UPGRADE_KEY = "livestream-review-v1";
export const LIVESTREAM_REVIEW_PRE_BACKUP_REASON = "pre-livestream-review-v1";
export const LIVESTREAM_REVIEW_POST_BACKUP_REASON = "post-livestream-review-v1";
export const LIVESTREAM_REVIEW_COLUMN = "livestreamReview";

const RUN_TABLE = "livestream_review_upgrade_runs";
let schemaReady = false;

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName]
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function columnExists(pool: Pool): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='brand_livestreams' AND COLUMN_NAME=?",
    [LIVESTREAM_REVIEW_COLUMN]
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS ${RUN_TABLE} (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function snapshot(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS rowCount,
            COALESCE(SUM(CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END),0) AS activeRowCount,
            COALESCE(MAX(id),0) AS maxId,
            COALESCE(SUM(COALESCE(salesAmount,0)),0) AS totalSales,
            COALESCE(SUM(COALESCE(gmv,0)),0) AS totalGmv
       FROM brand_livestreams`
  );
  return {
    rowCount: Number(rows[0]?.rowCount || 0),
    activeRowCount: Number(rows[0]?.activeRowCount || 0),
    maxId: Number(rows[0]?.maxId || 0),
    totalSales: String(rows[0]?.totalSales || "0"),
    totalGmv: String(rows[0]?.totalGmv || "0"),
  };
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs"
  );
  return Number(rows[0]?.id || 0);
}

async function latestSuccessfulBackup(
  pool: Pool,
  reason: string
): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM db_backup_runs WHERE reason=? AND status='success' ORDER BY id DESC LIMIT 1",
    [reason]
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason]
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(
      `verified backup failed: ${reason}: ${String(row?.errorMessage || "missing row")}`
    );
  }
  return Number(row.id);
}

async function getState(pool: Pool) {
  const livestreamTableReady = await tableExists(pool, "brand_livestreams");
  const reviewColumnReady = livestreamTableReady
    ? await columnExists(pool)
    : false;
  const runTableReady = await tableExists(pool, RUN_TABLE);
  return { livestreamTableReady, reviewColumnReady, runTableReady };
}

export async function getLivestreamReviewUpgradeHealth(poolOverride?: Pool) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!poolOverride && !databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const pool =
    poolOverride ||
    mysql.createPool({
      uri: databaseUrl!,
      connectionLimit: 2,
      waitForConnections: true,
    });
  const shouldClose = !poolOverride;
  try {
    const state = await getState(pool);
    let run: RowDataPacket | undefined;
    if (state.runTableReady) {
      const [runs] = await pool.query<RowDataPacket[]>(
        `SELECT status,completedAt,details,errorMessage FROM ${RUN_TABLE} WHERE recoveryKey=? LIMIT 1`,
        [LIVESTREAM_REVIEW_UPGRADE_KEY]
      );
      run = runs[0];
    }
    return {
      healthy:
        state.livestreamTableReady &&
        state.reviewColumnReady &&
        state.runTableReady &&
        String(run?.status || "") === "success",
      ...state,
      snapshot: state.livestreamTableReady ? await snapshot(pool) : null,
      run: run || null,
    };
  } finally {
    if (shouldClose) await pool.end();
  }
}

export async function runLivestreamReviewUpgradeSetup(): Promise<void> {
  if (schemaReady) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for livestream review upgrade");
  }
  const pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 2,
    waitForConnections: true,
  });
  try {
    const beforeState = await getState(pool);
    if (!beforeState.livestreamTableReady) {
      throw new Error("brand_livestreams table is missing");
    }
    if (beforeState.runTableReady && beforeState.reviewColumnReady) {
      const [runs] = await pool.query<RowDataPacket[]>(
        `SELECT status FROM ${RUN_TABLE} WHERE recoveryKey=? LIMIT 1`,
        [LIVESTREAM_REVIEW_UPGRADE_KEY]
      );
      if (String(runs[0]?.status || "") === "success") {
        schemaReady = true;
        console.log("[LivestreamReviewUpgrade] schema healthy");
        return;
      }
    }

    const beforeSnapshot = await snapshot(pool);
    const preBackupId =
      (await latestSuccessfulBackup(
        pool,
        LIVESTREAM_REVIEW_PRE_BACKUP_REASON
      )) ||
      (await runVerifiedBackup(pool, LIVESTREAM_REVIEW_PRE_BACKUP_REASON));

    await ensureRunTable(pool);
    await pool.query(
      `INSERT INTO ${RUN_TABLE} (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [
        LIVESTREAM_REVIEW_UPGRADE_KEY,
        JSON.stringify({ beforeState, beforeSnapshot, preBackupId }),
      ]
    );

    if (!(await columnExists(pool))) {
      await pool.query(
        "ALTER TABLE brand_livestreams ADD COLUMN livestreamReview TEXT NULL AFTER remarks"
      );
    }

    const afterState = await getState(pool);
    const afterSnapshot = await snapshot(pool);
    if (!afterState.reviewColumnReady) {
      throw new Error("brand_livestreams.livestreamReview is missing");
    }
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
      throw new Error(
        `livestream rows changed during schema upgrade: before=${JSON.stringify(beforeSnapshot)} after=${JSON.stringify(afterSnapshot)}`
      );
    }

    const postBackupId = await runVerifiedBackup(
      pool,
      LIVESTREAM_REVIEW_POST_BACKUP_REASON
    );
    await pool.query(
      `UPDATE ${RUN_TABLE} SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?`,
      [
        JSON.stringify({
          beforeState,
          afterState,
          beforeSnapshot,
          afterSnapshot,
          preBackupId,
          postBackupId,
          dataRowsModified: 0,
        }),
        LIVESTREAM_REVIEW_UPGRADE_KEY,
      ]
    );
    schemaReady = true;
    console.log("[LivestreamReviewUpgrade] schema upgrade complete");
  } catch (error) {
    try {
      if (await tableExists(pool, RUN_TABLE)) {
        await pool.query(
          `INSERT INTO ${RUN_TABLE} (recoveryKey,status,startedAt,completedAt,details,errorMessage)
           VALUES (?,'failed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,?)
           ON DUPLICATE KEY UPDATE status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=VALUES(errorMessage)`,
          [
            LIVESTREAM_REVIEW_UPGRADE_KEY,
            String(error instanceof Error ? error.message : error).slice(
              0,
              4000
            ),
          ]
        );
      }
    } catch (logError) {
      console.error(
        "[LivestreamReviewUpgrade] failed to record upgrade failure",
        logError
      );
    }
    throw error;
  } finally {
    await pool.end();
  }
}
