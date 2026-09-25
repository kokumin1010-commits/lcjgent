import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

export const SAMPLE_LOGISTICS_UPGRADE_KEY = "sample-request-logistics-v2";
const LOCK_NAME = "lcjgent-sample-request-logistics-v2";
const PRE_BACKUP_REASON = "pre-sample-request-logistics-v2";
const POST_BACKUP_REASON = "post-sample-request-logistics-v2";

// Authoritative migration path: this runtime upgrade intentionally runs after a
// verified encrypted backup and before listen; run-migrations must not duplicate
// these DDL statements because Railway executes it before the backup gate.

type ColumnExpectation = { columnType: string; isNullable: "YES" | "NO"; columnDefault?: string; autoIncrement?: boolean };
type ColumnState = { columnType: string; isNullable: string; columnDefault: string | null; extra: string };
type IndexExpectation = { unique: boolean; columns: string[] };

const REQUIRED_COLUMNS: Record<string, string> = {
  logistics_status: "ENUM('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned') NULL",
  shipping_carrier: "VARCHAR(120) NULL",
  tracking_number: "VARCHAR(160) NULL",
  tracking_url: "TEXT NULL",
  estimated_delivery_at: "DATETIME NULL",
  latest_location: "VARCHAR(255) NULL",
  logistics_note: "TEXT NULL",
  delivered_at: "DATETIME NULL",
  logistics_updated_at: "TIMESTAMP(3) NULL",
  logistics_revision: "INT NOT NULL DEFAULT 0",
  logistics_updated_by: "INT NULL",
};

const REQUEST_EXPECTATIONS: Record<string, ColumnExpectation> = {
  logistics_status: { columnType: "enum('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned')", isNullable: "YES" },
  shipping_carrier: { columnType: "varchar(120)", isNullable: "YES" },
  tracking_number: { columnType: "varchar(160)", isNullable: "YES" },
  tracking_url: { columnType: "text", isNullable: "YES" },
  estimated_delivery_at: { columnType: "datetime", isNullable: "YES" },
  latest_location: { columnType: "varchar(255)", isNullable: "YES" },
  logistics_note: { columnType: "text", isNullable: "YES" },
  delivered_at: { columnType: "datetime", isNullable: "YES" },
  logistics_updated_at: { columnType: "timestamp(3)", isNullable: "YES" },
  logistics_revision: { columnType: "int", isNullable: "NO", columnDefault: "0" },
  logistics_updated_by: { columnType: "int", isNullable: "YES" },
};

const EVENT_EXPECTATIONS: Record<string, ColumnExpectation> = {
  id: { columnType: "int", isNullable: "NO", autoIncrement: true },
  request_id: { columnType: "int", isNullable: "NO" },
  logistics_status: { columnType: "enum('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned')", isNullable: "NO" },
  shipping_carrier: { columnType: "varchar(120)", isNullable: "YES" },
  tracking_number: { columnType: "varchar(160)", isNullable: "YES" },
  tracking_url: { columnType: "text", isNullable: "YES" },
  estimated_delivery_at: { columnType: "datetime", isNullable: "YES" },
  latest_location: { columnType: "varchar(255)", isNullable: "YES" },
  note: { columnType: "text", isNullable: "YES" },
  occurred_at: { columnType: "datetime", isNullable: "NO" },
  recorded_by: { columnType: "int", isNullable: "NO" },
  created_at: { columnType: "timestamp", isNullable: "NO" },
};

const EVENT_INDEX_EXPECTATIONS: Record<string, IndexExpectation> = {
  PRIMARY: { unique: true, columns: ["id"] },
  idx_sample_logistics_request_time: { unique: false, columns: ["request_id", "occurred_at"] },
};

function canonicalColumnType(value: string) {
  return value.toLowerCase().replace(/^int\(\d+\)$/, "int");
}

function matchesColumn(actual: ColumnState | undefined, expected: ColumnExpectation) {
  if (!actual || canonicalColumnType(actual.columnType) !== expected.columnType || actual.isNullable !== expected.isNullable) return false;
  if (expected.columnDefault !== undefined && String(actual.columnDefault ?? "") !== expected.columnDefault) return false;
  return expected.autoIncrement === undefined || actual.extra.toLowerCase().includes("auto_increment") === expected.autoIncrement;
}

async function tableExists(pool: Pool, tableName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
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

function getMismatchedColumns(columns: Map<string, ColumnState>, expectations: Record<string, ColumnExpectation>) {
  return Object.entries(expectations).filter(([name, expected]) => columns.has(name) && !matchesColumn(columns.get(name), expected)).map(([name]) => name);
}

function indexMatches(indexes: Map<string, Array<{ column: string; sequence: number; nonUnique: number }>>, name: string, expected: IndexExpectation) {
  const parts = (indexes.get(name) || []).slice().sort((a, b) => a.sequence - b.sequence);
  return JSON.stringify(parts.map(part => part.column)) === JSON.stringify(expected.columns)
    && parts.length > 0 && (parts[0].nonUnique === 0) === expected.unique;
}

async function migrationRecorded(pool: Pool) {
  if (!(await tableExists(pool, "sample_request_logistics_upgrade_runs"))) return false;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM sample_request_logistics_upgrade_runs WHERE recoveryKey=? LIMIT 1",
    [SAMPLE_LOGISTICS_UPGRADE_KEY],
  );
  return String(rows[0]?.status || "") === "success";
}

export async function getSampleLogisticsUpgradeHealth(poolOverride?: Pool) {
  const url = process.env.DATABASE_URL;
  if (!poolOverride && !url) throw new Error("DATABASE_URL is required");
  const pool = poolOverride || mysql.createPool({ uri: url!, connectionLimit: 2 });
  try {
    const requestTableReady = await tableExists(pool, "sample_requests");
    const requestColumns = requestTableReady ? await tableColumns(pool, "sample_requests") : new Map<string, ColumnState>();
    const missingColumns = Object.keys(REQUEST_EXPECTATIONS).filter(name => !requestColumns.has(name));
    const mismatchedColumns = getMismatchedColumns(requestColumns, REQUEST_EXPECTATIONS);
    const eventTableExists = await tableExists(pool, "sample_request_logistics_events");
    const eventColumns = eventTableExists ? await tableColumns(pool, "sample_request_logistics_events") : new Map<string, ColumnState>();
    const missingEventColumns = Object.keys(EVENT_EXPECTATIONS).filter(name => !eventColumns.has(name));
    const mismatchedEventColumns = getMismatchedColumns(eventColumns, EVENT_EXPECTATIONS);
    const eventIndexes: Map<string, Array<{ column: string; sequence: number; nonUnique: number }>> = eventTableExists
      ? await tableIndexes(pool, "sample_request_logistics_events")
      : new Map();
    const missingEventIndexes = Object.entries(EVENT_INDEX_EXPECTATIONS).flatMap(([name, expected]) => {
      return indexMatches(eventIndexes, name, expected) ? [] : [name];
    });
    const migrationSuccess = await migrationRecorded(pool);
    const eventTableReady = eventTableExists && missingEventColumns.length === 0 && mismatchedEventColumns.length === 0 && missingEventIndexes.length === 0;
    const schemaReady = requestTableReady && missingColumns.length === 0 && mismatchedColumns.length === 0 && eventTableReady;
    return { healthy: schemaReady && migrationSuccess, recoveryKey: SAMPLE_LOGISTICS_UPGRADE_KEY, requestTableReady, missingColumns, mismatchedColumns, eventTableReady, missingEventColumns, mismatchedEventColumns, missingEventIndexes, migrationSuccess };
  } finally {
    if (!poolOverride) await pool.end();
  }
}

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS sample_request_logistics_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorCode VARCHAR(128) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function latestBackupId(pool: Pool) {
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
    return Number(rows[0]?.id || 0);
  } catch (error) {
    if (String((error as any)?.code || "") === "ER_NO_SUCH_TABLE") return 0;
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
  if (String(rows[0]?.status || "") !== "success") throw new Error("SAMPLE_LOGISTICS_BACKUP_FAILED");
  return Number(rows[0].id);
}

async function snapshot(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount,COALESCE(MAX(id),0) AS maxId,COALESCE(SUM(total_amount),0) AS totalAmount FROM sample_requests",
  );
  return { rowCount: Number(rows[0]?.rowCount || 0), maxId: Number(rows[0]?.maxId || 0), totalAmount: String(rows[0]?.totalAmount || "0") };
}

async function ensureRequestColumns(pool: Pool) {
  let columns = await tableColumns(pool, "sample_requests");
  for (const [name, definition] of Object.entries(REQUIRED_COLUMNS)) {
    if (!columns.has(name)) await pool.query(`ALTER TABLE sample_requests ADD COLUMN \`${name}\` ${definition}`);
  }
  columns = await tableColumns(pool, "sample_requests");
  if (columns.has("logistics_updated_at") && !matchesColumn(columns.get("logistics_updated_at"), REQUEST_EXPECTATIONS.logistics_updated_at)) {
    await pool.query("ALTER TABLE sample_requests MODIFY COLUMN logistics_updated_at TIMESTAMP(3) NULL");
  }
  if (columns.has("logistics_revision") && !matchesColumn(columns.get("logistics_revision"), REQUEST_EXPECTATIONS.logistics_revision)) {
    await pool.query("UPDATE sample_requests SET logistics_revision=0 WHERE logistics_revision IS NULL");
    await pool.query("ALTER TABLE sample_requests MODIFY COLUMN logistics_revision INT NOT NULL DEFAULT 0");
  }
}

async function createEventTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS sample_request_logistics_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    logistics_status ENUM('preparing','shipped','in_transit','out_for_delivery','delivered','delivery_exception','returned') NOT NULL,
    shipping_carrier VARCHAR(120) NULL,
    tracking_number VARCHAR(160) NULL,
    tracking_url TEXT NULL,
    estimated_delivery_at DATETIME NULL,
    latest_location VARCHAR(255) NULL,
    note TEXT NULL,
    occurred_at DATETIME NOT NULL,
    recorded_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sample_logistics_request_time (request_id, occurred_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensureEventTable(pool: Pool) {
  await createEventTable(pool);
  let columns = await tableColumns(pool, "sample_request_logistics_events");
  let indexes = await tableIndexes(pool, "sample_request_logistics_events");
  const missingColumns = Object.keys(EVENT_EXPECTATIONS).filter(name => !columns.has(name));
  const mismatchedColumns = getMismatchedColumns(columns, EVENT_EXPECTATIONS);
  if (missingColumns.length || mismatchedColumns.length) {
    const [countRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM sample_request_logistics_events");
    if (Number(countRows[0]?.count || 0) > 0) throw new Error("SAMPLE_LOGISTICS_EVENT_SCHEMA_DRIFT_NONEMPTY");
    await pool.query("DROP TABLE sample_request_logistics_events");
    await createEventTable(pool);
    columns = await tableColumns(pool, "sample_request_logistics_events");
    if (Object.keys(EVENT_EXPECTATIONS).some(name => !columns.has(name)) || getMismatchedColumns(columns, EVENT_EXPECTATIONS).length) {
      throw new Error("SAMPLE_LOGISTICS_EVENT_SCHEMA_REBUILD_FAILED");
    }
    indexes = await tableIndexes(pool, "sample_request_logistics_events");
  }

  if (!indexMatches(indexes, "PRIMARY", EVENT_INDEX_EXPECTATIONS.PRIMARY)) {
    const [countRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM sample_request_logistics_events");
    if (Number(countRows[0]?.count || 0) > 0) throw new Error("SAMPLE_LOGISTICS_EVENT_PRIMARY_DRIFT_NONEMPTY");
    await pool.query("DROP TABLE sample_request_logistics_events");
    await createEventTable(pool);
    indexes = await tableIndexes(pool, "sample_request_logistics_events");
  }

  for (const [name, expected] of Object.entries(EVENT_INDEX_EXPECTATIONS)) {
    if (name === "PRIMARY") continue;
    if (indexMatches(indexes, name, expected)) continue;
    if (indexes.has(name)) {
      await pool.query(`ALTER TABLE sample_request_logistics_events DROP INDEX \`${name}\``);
    }
    await pool.query("ALTER TABLE sample_request_logistics_events ADD INDEX idx_sample_logistics_request_time (request_id,occurred_at)");
    indexes = await tableIndexes(pool, "sample_request_logistics_events");
  }
}

export async function runSampleLogisticsUpgradeSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for sample logistics upgrade");
  const pool = mysql.createPool({ uri: url, connectionLimit: 2, waitForConnections: true });
  const lockConnection = await pool.getConnection();
  let acquired = false;
  let preBackupVerified = false;
  try {
    const [lockRows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?,120) AS acquired", [LOCK_NAME]);
    acquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!acquired) throw new Error("SAMPLE_LOGISTICS_LOCK_TIMEOUT");
    const current = await getSampleLogisticsUpgradeHealth(pool);
    if (current.healthy) return current;
    if (!current.requestTableReady) throw new Error("SAMPLE_REQUESTS_TABLE_MISSING");

    const beforeSnapshot = await snapshot(pool);
    const preBackupId = await verifiedBackup(pool, PRE_BACKUP_REASON);
    preBackupVerified = true;
    await ensureRunTable(pool);
    await pool.query(
      `INSERT INTO sample_request_logistics_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorCode)
       VALUES (?,'running',CURRENT_TIMESTAMP,NULL,?,NULL)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorCode=NULL`,
      [SAMPLE_LOGISTICS_UPGRADE_KEY, JSON.stringify({ beforeSnapshot, preBackupId })],
    );

    await ensureRequestColumns(pool);
    await ensureEventTable(pool);
    const afterSnapshot = await snapshot(pool);
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) throw new Error("SAMPLE_LOGISTICS_EXISTING_DATA_CHANGED");
    const schemaHealth = await getSampleLogisticsUpgradeHealth(pool);
    if (schemaHealth.missingColumns.length || schemaHealth.mismatchedColumns.length || !schemaHealth.eventTableReady) throw new Error("SAMPLE_LOGISTICS_SCHEMA_INCOMPLETE");
    const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
    await pool.query(
      "UPDATE sample_request_logistics_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorCode=NULL WHERE recoveryKey=?",
      [JSON.stringify({ beforeSnapshot, afterSnapshot, preBackupId, postBackupId, dataRowsModified: 0 }), SAMPLE_LOGISTICS_UPGRADE_KEY],
    );
    const finalHealth = await getSampleLogisticsUpgradeHealth(pool);
    if (!finalHealth.healthy) throw new Error("SAMPLE_LOGISTICS_FINAL_HEALTH_FAILED");
    return finalHealth;
  } catch (error) {
    if (preBackupVerified) {
      try {
        await ensureRunTable(pool);
        await pool.query(
          `INSERT INTO sample_request_logistics_upgrade_runs (recoveryKey,status,startedAt,completedAt,errorCode)
           VALUES (?,'failed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)
           ON DUPLICATE KEY UPDATE status='failed',completedAt=CURRENT_TIMESTAMP,errorCode=VALUES(errorCode)`,
          [SAMPLE_LOGISTICS_UPGRADE_KEY, String(error instanceof Error ? error.message : "SAMPLE_LOGISTICS_UPGRADE_FAILED").split(":", 1)[0].slice(0, 128)],
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
