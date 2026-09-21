import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const LOCK_KEY = "brand-business-upgrade-v2";
const UPGRADE_KEY = "brand-business-v2";
const PRE_BACKUP_REASON = "pre-brand-business-v2";
let setupPromise: Promise<void> | null = null;

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}
async function brandBdPagePermissionExists(pool: Pool): Promise<boolean> {
  if (!(await tableExists(pool, "role_permissions"))) return false;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM role_permissions WHERE pageKey='/master/brand-bd-command'",
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_business_upgrade_runs (
      recoveryKey VARCHAR(100) NOT NULL PRIMARY KEY,
      status VARCHAR(24) NOT NULL,
      startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function schemaState(pool: Pool) {
  const tables = {
    deals: await tableExists(pool, "brand_business_deals"),
    monthlyTargets: await tableExists(pool, "brand_business_monthly_targets"),
    events: await tableExists(pool, "brand_business_events"),
    auditLogs: await tableExists(pool, "brand_business_audit_logs"),
    interactions: await tableExists(pool, "brand_bd_interactions"),
    interactionFiles: await tableExists(pool, "brand_bd_interaction_files"),
    meetings: await tableExists(pool, "brand_bd_meetings"),
    taskLinks: await tableExists(pool, "brand_bd_task_links"),
    aiSnapshots: await tableExists(pool, "brand_bd_ai_snapshots"),
    reminderOutbox: await tableExists(pool, "brand_bd_meeting_reminder_outbox"),
    commandAuditLogs: await tableExists(pool, "brand_bd_command_audit_logs"),
    pagePermission: await brandBdPagePermissionExists(pool),
  };
  return { ...tables, healthy: Object.values(tables).every(Boolean) };
}

async function sourceSnapshot(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS brandCount FROM brands",
  );
  return { brandCount: Number(rows[0]?.brandCount || 0) };
}

async function verifiedBackup(pool: Pool): Promise<number> {
  let beforeId = 0;
  if (await tableExists(pool, "db_backup_runs")) {
    const [beforeRows] = await pool.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(id),0) AS maxId FROM db_backup_runs",
    );
    beforeId = Number(beforeRows[0]?.maxId || 0);
  }
  await runDatabaseBackup(PRE_BACKUP_REASON, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,status,errorMessage
       FROM db_backup_runs
      WHERE id>? AND reason=?
      ORDER BY id DESC LIMIT 1`,
    [beforeId, PRE_BACKUP_REASON],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${String(row?.errorMessage || "missing run")}`);
  }
  return Number(row.id);
}

async function createTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_business_deals (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      brandId INT NOT NULL,
      stage VARCHAR(32) NOT NULL DEFAULT 'new_lead',
      dealModel VARCHAR(32) NULL,
      slotFeeAmount BIGINT NULL,
      guaranteedRoi DECIMAL(8,2) NULL DEFAULT 2.00,
      pureCommissionRate DECIMAL(8,2) NULL,
      lastContactAt DATETIME NULL,
      nextFollowUpAt DATETIME NULL,
      nextAction TEXT NULL,
      negotiationNotes TEXT NULL,
      agreedAt DATETIME NULL,
      createdBy BIGINT NOT NULL,
      updatedBy BIGINT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_brand_business_deal_brand (brandId),
      KEY idx_brand_business_stage_followup (stage,nextFollowUpAt),
      KEY idx_brand_business_agreed (agreedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_business_monthly_targets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL,
      month INT NOT NULL,
      newBrandTarget INT NOT NULL DEFAULT 0,
      contactTarget INT NOT NULL DEFAULT 0,
      negotiationTarget INT NOT NULL DEFAULT 0,
      contractTarget INT NOT NULL DEFAULT 0,
      slotFeeContractTarget INT NOT NULL DEFAULT 0,
      slotFeeRevenueTarget BIGINT NOT NULL DEFAULT 0,
      goalNote TEXT NULL,
      createdBy BIGINT NOT NULL,
      updatedBy BIGINT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_brand_business_target_month (year,month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_business_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      brandId INT NOT NULL,
      eventType VARCHAR(32) NOT NULL,
      fromStage VARCHAR(32) NULL,
      toStage VARCHAR(32) NULL,
      dealModel VARCHAR(32) NULL,
      slotFeeAmount BIGINT NULL,
      guaranteedRoi DECIMAL(8,2) NULL,
      pureCommissionRate DECIMAL(8,2) NULL,
      occurredAt TIMESTAMP NOT NULL,
      actorId BIGINT NOT NULL,
      actorName VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_brand_business_event_type_time (eventType,occurredAt),
      KEY idx_brand_business_event_brand_time (brandId,occurredAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_business_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      entityType VARCHAR(32) NOT NULL,
      entityId BIGINT NULL,
      brandId INT NULL,
      action VARCHAR(48) NOT NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      actorId BIGINT NOT NULL,
      actorName VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_brand_business_audit_brand_time (brandId,createdAt),
      KEY idx_brand_business_audit_entity (entityType,entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const commandMigrationPath = path.resolve(
    process.cwd(),
    "drizzle/0155_brand_bd_command_center.sql",
  );
  const commandMigrationSql = await readFile(commandMigrationPath, "utf8");
  const commandStatements = commandMigrationSql
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);
  for (const statement of commandStatements) {
    await pool.query(statement);
  }
}

export async function runBrandBusinessUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand business upgrade");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z" });
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?,600) AS acquired",
      [LOCK_KEY],
    );
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("brand business upgrade lock timeout");
    await ensureRunTable(pool);
    const beforeSchema = await schemaState(pool);
    if (beforeSchema.healthy) {
      await pool.query(
        `INSERT INTO brand_business_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
         VALUES (?,'success',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,NULL)
         ON DUPLICATE KEY UPDATE status='success',completedAt=CURRENT_TIMESTAMP,details=VALUES(details),errorMessage=NULL`,
        [UPGRADE_KEY, JSON.stringify({ beforeSchema, alreadyHealthy: true })],
      );
      return;
    }
    const before = await sourceSnapshot(pool);
    await pool.query(
      `INSERT INTO brand_business_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeSchema, before })],
    );
    const backupId = await verifiedBackup(pool);
    await createTables(pool);
    const afterSchema = await schemaState(pool);
    const after = await sourceSnapshot(pool);
    if (!afterSchema.healthy) throw new Error("brand business schema incomplete");
    if (before.brandCount !== after.brandCount) {
      throw new Error(`brand count changed during upgrade: ${before.brandCount}->${after.brandCount}`);
    }
    await pool.query(
      `UPDATE brand_business_upgrade_runs
          SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL
        WHERE recoveryKey=?`,
      [JSON.stringify({ beforeSchema, afterSchema, before, after, backupId }), UPGRADE_KEY],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE brand_business_upgrade_runs
          SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=?
        WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    throw error;
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    connection.release();
    await pool.end();
  }
}

export function startBrandBusinessUpgradeSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = runBrandBusinessUpgradeSetup().catch(error => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export function ensureBrandBusinessUpgradeReady(): Promise<void> {
  return startBrandBusinessUpgradeSetup();
}

export async function getBrandBusinessUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z" });
  try {
    const schema = await schemaState(pool);
    const hasRunTable = await tableExists(pool, "brand_business_upgrade_runs");
    if (!hasRunTable) return { healthy: false, schema, run: null };
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,errorMessage FROM brand_business_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY],
    );
    const run = rows[0];
    return {
      healthy: schema.healthy && (!run || String(run.status) === "success"),
      schema,
      run: run ? {
        status: String(run.status),
        completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
        hasError: Boolean(run.errorMessage),
      } : null,
    };
  } finally {
    await pool.end();
  }
}
