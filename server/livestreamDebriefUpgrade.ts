import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const LIVESTREAM_DEBRIEF_UPGRADE_KEY = "livestream-debrief-v1";
export const LIVESTREAM_DEBRIEF_PRE_BACKUP_REASON = "pre-livestream-debrief-v1";
export const LIVESTREAM_DEBRIEF_POST_BACKUP_REASON = "post-livestream-debrief-v1";

const LOCK_NAME = "lcjgent-livestream-debrief-v1";
const RUN_TABLE = "livestream_debrief_upgrade_runs";
const TABLES = ["livestream_debriefs", "livestream_debrief_events"] as const;

export function isLivestreamDebriefUpgradeAuthorized(env: NodeJS.ProcessEnv = process.env) {
  return String(env.RAILWAY_ENVIRONMENT_NAME || "").trim().toLowerCase() === "production";
}

type ColumnExpectation = {
  columnType: string;
  isNullable: "YES" | "NO";
  columnDefault?: string;
  autoIncrement?: boolean;
};
type ColumnState = {
  columnType: string;
  isNullable: string;
  columnDefault: string | null;
  extra: string;
};
type IndexExpectation = { unique: boolean; columns: string[] };

const DEBRIEF_COLUMNS: Record<string, ColumnExpectation> = {
  id: { columnType: "int", isNullable: "NO", autoIncrement: true },
  livestream_id: { columnType: "int", isNullable: "NO" },
  review_json: { columnType: "json", isNullable: "NO" },
  review_text: { columnType: "text", isNullable: "NO" },
  revision: { columnType: "int", isNullable: "NO", columnDefault: "1" },
  created_by: { columnType: "int", isNullable: "NO" },
  created_by_name: { columnType: "varchar(255)", isNullable: "NO" },
  updated_by: { columnType: "int", isNullable: "NO" },
  updated_by_name: { columnType: "varchar(255)", isNullable: "NO" },
  created_at: { columnType: "timestamp(3)", isNullable: "NO" },
  updated_at: { columnType: "timestamp(3)", isNullable: "NO" },
};

const EVENT_COLUMNS: Record<string, ColumnExpectation> = {
  id: { columnType: "int", isNullable: "NO", autoIncrement: true },
  debrief_id: { columnType: "int", isNullable: "NO" },
  livestream_id: { columnType: "int", isNullable: "NO" },
  revision: { columnType: "int", isNullable: "NO" },
  review_json: { columnType: "json", isNullable: "NO" },
  review_text: { columnType: "text", isNullable: "NO" },
  recorded_by: { columnType: "int", isNullable: "NO" },
  recorded_by_name: { columnType: "varchar(255)", isNullable: "NO" },
  recorded_at: { columnType: "timestamp(3)", isNullable: "NO" },
};

const DEBRIEF_INDEXES: Record<string, IndexExpectation> = {
  PRIMARY: { unique: true, columns: ["id"] },
  uk_livestream_debrief_livestream: { unique: true, columns: ["livestream_id"] },
  idx_livestream_debrief_updated: { unique: false, columns: ["updated_at"] },
};

const EVENT_INDEXES: Record<string, IndexExpectation> = {
  PRIMARY: { unique: true, columns: ["id"] },
  uk_livestream_debrief_event_revision: { unique: true, columns: ["debrief_id", "revision"] },
  idx_livestream_debrief_event_stream_time: { unique: false, columns: ["livestream_id", "recorded_at"] },
};

function canonicalColumnType(value: string) {
  return value.toLowerCase().replace(/^int\(\d+\)$/, "int");
}

function matchesColumn(actual: ColumnState | undefined, expected: ColumnExpectation) {
  if (!actual) return false;
  if (canonicalColumnType(actual.columnType) !== expected.columnType) return false;
  if (actual.isNullable !== expected.isNullable) return false;
  if (expected.columnDefault !== undefined && String(actual.columnDefault ?? "") !== expected.columnDefault) return false;
  return expected.autoIncrement === undefined || actual.extra.toLowerCase().includes("auto_increment") === expected.autoIncrement;
}

async function tableExists(pool: Pool, tableName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName],
  );
  return Number(rows[0]?.count || 0) === 1;
}

async function tableColumns(pool: Pool, tableName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name,COLUMN_TYPE AS columnType,IS_NULLABLE AS isNullable,COLUMN_DEFAULT AS columnDefault,EXTRA AS extra
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName],
  );
  return new Map<string, ColumnState>(rows.map(row => [String(row.name), {
    columnType: String(row.columnType).toLowerCase(),
    isNullable: String(row.isNullable).toUpperCase(),
    columnDefault: row.columnDefault == null ? null : String(row.columnDefault),
    extra: String(row.extra || ""),
  }]));
}

async function tableIndexes(pool: Pool, tableName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT INDEX_NAME AS indexName,COLUMN_NAME AS columnName,SEQ_IN_INDEX AS sequenceNumber,NON_UNIQUE AS nonUnique
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName],
  );
  const indexes = new Map<string, Array<{ column: string; sequence: number; nonUnique: number }>>();
  for (const row of rows) {
    const name = String(row.indexName);
    const parts = indexes.get(name) || [];
    parts.push({ column: String(row.columnName), sequence: Number(row.sequenceNumber), nonUnique: Number(row.nonUnique) });
    indexes.set(name, parts);
  }
  return indexes;
}

function indexMatches(
  indexes: Map<string, Array<{ column: string; sequence: number; nonUnique: number }>>,
  name: string,
  expected: IndexExpectation,
) {
  const parts = (indexes.get(name) || []).slice().sort((a, b) => a.sequence - b.sequence);
  return parts.length > 0
    && JSON.stringify(parts.map(part => part.column)) === JSON.stringify(expected.columns)
    && (parts[0].nonUnique === 0) === expected.unique;
}

async function tableHealth(pool: Pool, tableName: string, columnsExpected: Record<string, ColumnExpectation>, indexesExpected: Record<string, IndexExpectation>) {
  const exists = await tableExists(pool, tableName);
  const columns = exists ? await tableColumns(pool, tableName) : new Map<string, ColumnState>();
  const indexes = exists ? await tableIndexes(pool, tableName) : new Map<string, Array<{ column: string; sequence: number; nonUnique: number }>>();
  const missingColumns = Object.keys(columnsExpected).filter(name => !columns.has(name));
  const mismatchedColumns = Object.entries(columnsExpected)
    .filter(([name, expected]) => columns.has(name) && !matchesColumn(columns.get(name), expected))
    .map(([name]) => name);
  const missingIndexes = Object.entries(indexesExpected)
    .filter(([name, expected]) => !indexMatches(indexes, name, expected))
    .map(([name]) => name);
  return { exists, missingColumns, mismatchedColumns, missingIndexes, ready: exists && !missingColumns.length && !mismatchedColumns.length && !missingIndexes.length };
}

async function migrationRecorded(pool: Pool) {
  if (!(await tableExists(pool, RUN_TABLE))) return false;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT status FROM ${RUN_TABLE} WHERE recoveryKey=? LIMIT 1`,
    [LIVESTREAM_DEBRIEF_UPGRADE_KEY],
  );
  return String(rows[0]?.status || "") === "success";
}

export async function getLivestreamDebriefUpgradeHealth(poolOverride?: Pool) {
  const url = process.env.DATABASE_URL;
  if (!poolOverride && !url) throw new Error("DATABASE_URL is required");
  const pool = poolOverride || mysql.createPool({ uri: url!, connectionLimit: 2, waitForConnections: true });
  try {
    const sourceTableReady = await tableExists(pool, "brand_livestreams");
    const debriefTable = await tableHealth(pool, "livestream_debriefs", DEBRIEF_COLUMNS, DEBRIEF_INDEXES);
    const eventTable = await tableHealth(pool, "livestream_debrief_events", EVENT_COLUMNS, EVENT_INDEXES);
    const migrationSuccess = await migrationRecorded(pool);
    return {
      healthy: sourceTableReady && debriefTable.ready && eventTable.ready && migrationSuccess,
      recoveryKey: LIVESTREAM_DEBRIEF_UPGRADE_KEY,
      sourceTableReady,
      debriefTable,
      eventTable,
      migrationSuccess,
    };
  } finally {
    if (!poolOverride) await pool.end();
  }
}

async function latestBackupId(pool: Pool) {
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
    return Number(rows[0]?.id || 0);
  } catch (error) {
    if (String((error as { code?: string })?.code || "") === "ER_NO_SUCH_TABLE") return 0;
    throw error;
  }
}

async function verifiedBackup(pool: Pool, reason: string) {
  const before = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [before, reason],
  );
  if (String(rows[0]?.status || "") !== "success") throw new Error("LIVESTREAM_DEBRIEF_BACKUP_FAILED");
  return Number(rows[0].id);
}

async function sourceSnapshot(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount,COALESCE(MAX(id),0) AS maxId,COALESCE(SUM(COALESCE(salesAmount,0)),0) AS totalSales,COALESCE(SUM(COALESCE(gmv,0)),0) AS totalGmv FROM brand_livestreams",
  );
  return {
    rowCount: Number(rows[0]?.rowCount || 0),
    maxId: Number(rows[0]?.maxId || 0),
    totalSales: String(rows[0]?.totalSales || "0"),
    totalGmv: String(rows[0]?.totalGmv || "0"),
  };
}

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS ${RUN_TABLE} (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorCode VARCHAR(128) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function createDebriefTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS livestream_debriefs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    livestream_id INT NOT NULL,
    review_json JSON NOT NULL,
    review_text TEXT NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    created_by_name VARCHAR(255) NOT NULL,
    updated_by INT NOT NULL,
    updated_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_livestream_debrief_livestream (livestream_id),
    KEY idx_livestream_debrief_updated (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function createEventTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS livestream_debrief_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debrief_id INT NOT NULL,
    livestream_id INT NOT NULL,
    revision INT NOT NULL,
    review_json JSON NOT NULL,
    review_text TEXT NOT NULL,
    recorded_by INT NOT NULL,
    recorded_by_name VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_livestream_debrief_event_revision (debrief_id,revision),
    KEY idx_livestream_debrief_event_stream_time (livestream_id,recorded_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensureTable(
  pool: Pool,
  tableName: typeof TABLES[number],
  create: (pool: Pool) => Promise<void>,
  columns: Record<string, ColumnExpectation>,
  indexes: Record<string, IndexExpectation>,
) {
  await create(pool);
  const health = await tableHealth(pool, tableName, columns, indexes);
  if (health.ready) return;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
  if (Number(rows[0]?.count || 0) > 0) throw new Error(`LIVESTREAM_DEBRIEF_SCHEMA_DRIFT_NONEMPTY:${tableName}`);
  await pool.query(`DROP TABLE \`${tableName}\``);
  await create(pool);
  const rebuilt = await tableHealth(pool, tableName, columns, indexes);
  if (!rebuilt.ready) throw new Error(`LIVESTREAM_DEBRIEF_SCHEMA_REBUILD_FAILED:${tableName}`);
}

export async function runLivestreamDebriefUpgradeSetup() {
  if (!isLivestreamDebriefUpgradeAuthorized()) {
    throw new Error("LIVESTREAM_DEBRIEF_UPGRADE_PRODUCTION_ONLY");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for livestream debrief upgrade");
  const pool = mysql.createPool({ uri: url, connectionLimit: 2, waitForConnections: true });
  const lockConnection = await pool.getConnection();
  let acquired = false;
  let preBackupVerified = false;
  try {
    const [lockRows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?,120) AS acquired", [LOCK_NAME]);
    acquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!acquired) throw new Error("LIVESTREAM_DEBRIEF_LOCK_TIMEOUT");
    const current = await getLivestreamDebriefUpgradeHealth(pool);
    if (current.healthy) return current;
    if (!current.sourceTableReady) throw new Error("BRAND_LIVESTREAMS_TABLE_MISSING");

    const beforeSnapshot = await sourceSnapshot(pool);
    const preBackupId = await verifiedBackup(pool, LIVESTREAM_DEBRIEF_PRE_BACKUP_REASON);
    preBackupVerified = true;
    await ensureRunTable(pool);
    await pool.query(
      `INSERT INTO ${RUN_TABLE} (recoveryKey,status,startedAt,completedAt,details,errorCode)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorCode=NULL`,
      [LIVESTREAM_DEBRIEF_UPGRADE_KEY, JSON.stringify({ beforeSnapshot, preBackupId })],
    );

    await ensureTable(pool, "livestream_debriefs", createDebriefTable, DEBRIEF_COLUMNS, DEBRIEF_INDEXES);
    await ensureTable(pool, "livestream_debrief_events", createEventTable, EVENT_COLUMNS, EVENT_INDEXES);
    const afterSnapshot = await sourceSnapshot(pool);
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) throw new Error("LIVESTREAM_SOURCE_DATA_CHANGED");

    const schemaHealth = await getLivestreamDebriefUpgradeHealth(pool);
    if (!schemaHealth.debriefTable.ready || !schemaHealth.eventTable.ready) throw new Error("LIVESTREAM_DEBRIEF_SCHEMA_INCOMPLETE");
    const postBackupId = await verifiedBackup(pool, LIVESTREAM_DEBRIEF_POST_BACKUP_REASON);
    await pool.query(
      `UPDATE ${RUN_TABLE} SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorCode=NULL WHERE recoveryKey=?`,
      [JSON.stringify({ beforeSnapshot, afterSnapshot, preBackupId, postBackupId, dataRowsModified: 0 }), LIVESTREAM_DEBRIEF_UPGRADE_KEY],
    );
    const finalHealth = await getLivestreamDebriefUpgradeHealth(pool);
    if (!finalHealth.healthy) throw new Error("LIVESTREAM_DEBRIEF_FINAL_HEALTH_FAILED");
    return finalHealth;
  } catch (error) {
    if (preBackupVerified) {
      try {
        await ensureRunTable(pool);
        await pool.query(
          `INSERT INTO ${RUN_TABLE} (recoveryKey,status,startedAt,completedAt,errorCode)
           VALUES (?,'failed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)
           ON DUPLICATE KEY UPDATE status='failed',completedAt=CURRENT_TIMESTAMP,errorCode=VALUES(errorCode)`,
          [LIVESTREAM_DEBRIEF_UPGRADE_KEY, String(error instanceof Error ? error.message : "LIVESTREAM_DEBRIEF_UPGRADE_FAILED").split(":", 1)[0].slice(0, 128)],
        );
      } catch {}
    }
    throw error;
  } finally {
    if (acquired) await lockConnection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    lockConnection.release();
    await pool.end();
  }
}
