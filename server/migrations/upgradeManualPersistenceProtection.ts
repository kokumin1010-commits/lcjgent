import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

const MIGRATION_KEY = "manual-persistence-protection-v1-2026-08-27";
const LOCK_NAME = "lcj:manual-persistence-protection:v1";

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addManualRevisionColumns(pool: Pool, tableName: string): Promise<void> {
  if (!(await tableExists(pool, tableName))) return;
  if (!(await columnExists(pool, tableName, "manualRevisionAt"))) {
    await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`manualRevisionAt\` TIMESTAMP NULL DEFAULT NULL`);
  }
  if (!(await columnExists(pool, tableName, "manualRevisionBy"))) {
    await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`manualRevisionBy\` INT NULL`);
  }
}

async function ensureInfrastructure(pool: Pool): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_persistence_upgrade_runs (
    migrationKey VARCHAR(96) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    details JSON NULL,
    errorMessage TEXT NULL,
    PRIMARY KEY (migrationKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_data_change_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entityType VARCHAR(64) NOT NULL,
    entityId BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    changedFields JSON NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId INT NULL,
    actorName VARCHAR(255) NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'ui',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY manual_data_event_entity_idx (entityType, entityId, createdAt),
    KEY manual_data_event_actor_idx (actorId, createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_data_loss_recovery_runs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recoveryKey VARCHAR(96) NOT NULL,
    status VARCHAR(20) NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    actorId INT NULL,
    actorName VARCHAR(255) NULL,
    contextJson JSON NULL,
    resultJson JSON NULL,
    errorMessage TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY manual_data_loss_recovery_key_unique (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.execute(`CREATE TABLE IF NOT EXISTS manual_data_loss_recovery_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recoveryRunId BIGINT NOT NULL,
    tableName VARCHAR(64) NOT NULL,
    rowId BIGINT NOT NULL,
    changedFields JSON NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY manual_data_loss_event_run_idx (recoveryRunId, id),
    KEY manual_data_loss_event_row_idx (tableName, rowId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function runManualPersistenceProtectionUpgrade(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[ManualPersistenceProtection] DATABASE_URL is missing; skipped");
    return;
  }
  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 3, waitForConnections: true });
  let lockAcquired = false;
  try {
    await ensureInfrastructure(pool);
    const [doneRows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM manual_persistence_upgrade_runs WHERE migrationKey = ? LIMIT 1",
      [MIGRATION_KEY],
    );
    if (doneRows[0]?.status === "success") return;

    const [lockRows] = await pool.query<RowDataPacket[]>("SELECT GET_LOCK(?, 20) AS locked", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.locked || 0) === 1;
    if (!lockAcquired) throw new Error("could not acquire manual persistence upgrade lock");

    await pool.execute(
      `INSERT INTO manual_persistence_upgrade_runs (migrationKey, status)
       VALUES (?, 'running')
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP,
         completedAt=NULL, details=NULL, errorMessage=NULL`,
      [MIGRATION_KEY],
    );

    for (const tableName of ["staff", "report_staff", "managed_stores"]) {
      await addManualRevisionColumns(pool, tableName);
    }

    const details = {
      protectedTables: ["staff", "report_staff", "managed_stores"],
      auditTable: "manual_data_change_events",
      recoveryTables: ["manual_data_loss_recovery_runs", "manual_data_loss_recovery_events"],
    };
    await pool.execute(
      `UPDATE manual_persistence_upgrade_runs
          SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL
        WHERE migrationKey=?`,
      [JSON.stringify(details), MIGRATION_KEY],
    );
    console.log(`[ManualPersistenceProtection] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : String(error).slice(0, 4000);
    await pool.execute(
      `INSERT INTO manual_persistence_upgrade_runs (migrationKey, status, completedAt, errorMessage)
       VALUES (?, 'failed', CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=VALUES(errorMessage)`,
      [MIGRATION_KEY, message],
    ).catch(() => undefined);
    console.error(`[ManualPersistenceProtection] failed ${message}`);
    throw error;
  } finally {
    if (lockAcquired) await pool.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    await pool.end();
  }
}
