import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const LIVESTREAM_SET_IMAGE_UPGRADE_KEY = "livestream-set-image-v1";
export const LIVESTREAM_SET_IMAGE_PRE_BACKUP_REASON =
  "pre-livestream-set-image-v1";
export const LIVESTREAM_SET_IMAGE_POST_BACKUP_REASON =
  "post-livestream-set-image-v1";
export const LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS = [
  "imageUrl",
  "imageKey",
] as const;

const COLUMN_SQL: Record<
  (typeof LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS)[number],
  string
> = {
  imageUrl:
    "ALTER TABLE livestream_sets ADD COLUMN imageUrl TEXT NULL AFTER quantitySold",
  imageKey:
    "ALTER TABLE livestream_sets ADD COLUMN imageKey VARCHAR(512) NULL AFTER imageUrl",
};

let schemaReady = false;

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName]
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function getColumns(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='livestream_sets'"
  );
  return rows.map(row => String(row.columnName));
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS livestream_set_image_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function snapshot(pool: Pool) {
  if (!(await tableExists(pool, "livestream_sets"))) {
    return { rowCount: 0, maxId: 0, totalRevenue: "0" };
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount, COALESCE(MAX(id),0) AS maxId, COALESCE(SUM(totalRevenue),0) AS totalRevenue FROM livestream_sets"
  );
  return {
    rowCount: Number(rows[0]?.rowCount || 0),
    maxId: Number(rows[0]?.maxId || 0),
    totalRevenue: String(rows[0]?.totalRevenue || "0"),
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
  const setsReady = await tableExists(pool, "livestream_sets");
  const columns = setsReady ? await getColumns(pool) : [];
  const missingColumns = LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS.filter(
    column => !columns.includes(column)
  );
  const runTableReady = await tableExists(
    pool,
    "livestream_set_image_upgrade_runs"
  );
  return { setsReady, columns, missingColumns, runTableReady };
}

export async function getLivestreamSetImageUpgradeHealth(poolOverride?: Pool) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!poolOverride && !databaseUrl)
    throw new Error("DATABASE_URL is required");
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
        "SELECT status,completedAt,details,errorMessage FROM livestream_set_image_upgrade_runs WHERE recoveryKey=? LIMIT 1",
        [LIVESTREAM_SET_IMAGE_UPGRADE_KEY]
      );
      run = runs[0];
    }
    return {
      healthy:
        state.setsReady &&
        state.missingColumns.length === 0 &&
        state.runTableReady &&
        String(run?.status || "") === "success",
      ...state,
      snapshot: await snapshot(pool),
      run: run || null,
    };
  } finally {
    if (shouldClose) await pool.end();
  }
}

export async function runLivestreamSetImageUpgradeSetup(): Promise<void> {
  if (schemaReady) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for livestream set image upgrade"
    );
  const pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 2,
    waitForConnections: true,
  });
  try {
    const beforeState = await getState(pool);
    if (!beforeState.setsReady)
      throw new Error("livestream_sets table is missing");
    if (beforeState.runTableReady && beforeState.missingColumns.length === 0) {
      const [runs] = await pool.query<RowDataPacket[]>(
        "SELECT status FROM livestream_set_image_upgrade_runs WHERE recoveryKey=? LIMIT 1",
        [LIVESTREAM_SET_IMAGE_UPGRADE_KEY]
      );
      if (String(runs[0]?.status || "") === "success") {
        schemaReady = true;
        console.log("[LivestreamSetImageUpgrade] schema healthy");
        return;
      }
    }

    const beforeSnapshot = await snapshot(pool);
    const preBackupId =
      (await latestSuccessfulBackup(
        pool,
        LIVESTREAM_SET_IMAGE_PRE_BACKUP_REASON
      )) ||
      (await runVerifiedBackup(pool, LIVESTREAM_SET_IMAGE_PRE_BACKUP_REASON));

    await ensureRunTable(pool);
    await pool.query(
      `INSERT INTO livestream_set_image_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [
        LIVESTREAM_SET_IMAGE_UPGRADE_KEY,
        JSON.stringify({ beforeState, beforeSnapshot, preBackupId }),
      ]
    );

    const existing = new Set(await getColumns(pool));
    for (const column of LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS) {
      if (!existing.has(column)) await pool.query(COLUMN_SQL[column]);
    }

    const afterState = await getState(pool);
    const afterSnapshot = await snapshot(pool);
    if (afterState.missingColumns.length > 0) {
      throw new Error(
        `livestream set image columns missing: ${afterState.missingColumns.join(",")}`
      );
    }
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
      throw new Error(
        `livestream set rows changed during schema upgrade: before=${JSON.stringify(beforeSnapshot)} after=${JSON.stringify(afterSnapshot)}`
      );
    }

    const postBackupId = await runVerifiedBackup(
      pool,
      LIVESTREAM_SET_IMAGE_POST_BACKUP_REASON
    );
    await pool.query(
      "UPDATE livestream_set_image_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
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
        LIVESTREAM_SET_IMAGE_UPGRADE_KEY,
      ]
    );
    schemaReady = true;
    console.log("[LivestreamSetImageUpgrade] schema upgrade complete");
  } catch (error) {
    try {
      if (await tableExists(pool, "livestream_set_image_upgrade_runs")) {
        await pool.query(
          `INSERT INTO livestream_set_image_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
           VALUES (?,'failed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,?)
           ON DUPLICATE KEY UPDATE status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=VALUES(errorMessage)`,
          [
            LIVESTREAM_SET_IMAGE_UPGRADE_KEY,
            String(error instanceof Error ? error.message : error).slice(
              0,
              4000
            ),
          ]
        );
      }
    } catch (logError) {
      console.error(
        "[LivestreamSetImageUpgrade] failed to record upgrade failure",
        logError
      );
    }
    throw error;
  } finally {
    await pool.end();
  }
}
