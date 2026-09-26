import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const LOCK_KEY = "brand-live-approval-upgrade-v1";
const UPGRADE_KEY = "brand-live-approval-v1";
const BACKUP_REASON = "pre-brand-live-approval-v1";
const REQUIRED_TABLES = [
  "brand_live_approval_settings",
  "brand_live_approvals",
  "brand_live_approval_products",
  "brand_live_approval_events",
  "brand_live_approval_schedule_links",
  "brand_live_approval_setting_events",
] as const;
let setupPromise: Promise<void> | null = null;

export function isBrandLiveApprovalUpgradeAuthorized(): boolean {
  return String(process.env.RAILWAY_ENVIRONMENT_NAME || "").trim().toLowerCase() === "production";
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [tableName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function schemaState(pool: Pool) {
  const present: Record<string, boolean> = {};
  for (const table of REQUIRED_TABLES) present[table] = await tableExists(pool, table);
  const missingTables = REQUIRED_TABLES.filter(table => !present[table]);
  if (missingTables.length > 0) return { healthy: false, present, missingTables, missingColumns: [], invalidColumns: [], missingIndexes: [] };

  const requiredColumns: Record<string, string[]> = {
    brand_live_approval_settings: ["id", "approverUserId", "approverName", "configuredBy", "configuredAt", "updatedAt"],
    brand_live_approvals: ["id", "brandId", "targetLiverId", "targetLiverName", "liveAccount", "assistantOnsite", "assistantDetails", "mechanismSummary", "commissionRate", "slotFeeAmount", "guaranteeType", "guaranteeValue", "guaranteeTerms", "scheduledStart", "scheduledEnd", "businessNotes", "status", "revision", "submittedBy", "submittedByName", "submittedAt", "reviewedBy", "reviewedByName", "reviewedAt", "reviewComment", "createdBy", "createdByName", "updatedBy", "updatedByName", "createdAt", "updatedAt"],
    brand_live_approval_products: ["id", "approvalId", "productId", "productName", "specification", "originalPrice", "discountedPrice", "offerMechanism", "commissionRate", "inventory", "notes", "sortOrder", "createdAt"],
    brand_live_approval_events: ["id", "approvalId", "brandId", "eventType", "fromStatus", "toStatus", "snapshotJson", "actorUserId", "actorName", "comment", "createdAt"],
    brand_live_approval_schedule_links: ["id", "approvalId", "scheduleId", "brandId", "linkedBy", "linkedByName", "linkedAt", "isActive", "unlinkedBy", "unlinkedByName", "unlinkedAt"],
    brand_live_approval_setting_events: ["id", "previousApproverUserId", "previousApproverName", "approverUserId", "approverName", "actorUserId", "actorName", "createdAt"],
  };
  const missingColumns: string[] = [];
  const invalidColumns: string[] = [];
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
      [table],
    );
    const actual = new Set(rows.map(row => String(row.COLUMN_NAME)));
    for (const column of columns) if (!actual.has(column)) missingColumns.push(`${table}.${column}`);
    if (table === "brand_live_approvals") {
      const targetLiverId = rows.find(row => String(row.COLUMN_NAME) === "targetLiverId");
      if (targetLiverId && String(targetLiverId.IS_NULLABLE).toUpperCase() !== "NO") invalidColumns.push(`${table}.targetLiverId:not-null`);
    }
  }
  const requiredIndexes = [
    ["brand_live_approvals", "idx_brand_live_approval_brand_status_time"],
    ["brand_live_approval_products", "idx_brand_live_approval_product_order"],
    ["brand_live_approval_events", "idx_brand_live_approval_event_time"],
    ["brand_live_approval_schedule_links", "uq_brand_live_approval_schedule_approval"],
    ["brand_live_approval_schedule_links", "idx_brand_live_approval_schedule_active"],
    ["brand_live_approval_setting_events", "idx_brand_live_approval_setting_event_time"],
  ] as const;
  const missingIndexes: string[] = [];
  for (const [table, index] of requiredIndexes) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
      [table, index],
    );
    if (Number(rows[0]?.count || 0) === 0) missingIndexes.push(`${table}.${index}`);
  }
  return {
    healthy: missingColumns.length === 0 && invalidColumns.length === 0 && missingIndexes.length === 0,
    present,
    missingTables,
    missingColumns,
    invalidColumns,
    missingIndexes,
  };
}

async function verifiedBackup(pool: Pool): Promise<number> {
  let beforeId = 0;
  if (await tableExists(pool, "db_backup_runs")) {
    const [beforeRows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS maxId FROM db_backup_runs");
    beforeId = Number(beforeRows[0]?.maxId || 0);
  }
  await runDatabaseBackup(BACKUP_REASON, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1`,
    [beforeId, BACKUP_REASON],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") throw new Error(`verified backup failed: ${String(row?.errorMessage || "missing run")}`);
  return Number(row.id);
}

async function rebuildEmptyPartialSchema(pool: Pool, state: Awaited<ReturnType<typeof schemaState>>): Promise<boolean> {
  const presentTables = REQUIRED_TABLES.filter(table => state.present[table]);
  if (presentTables.length === 0 || state.healthy) return false;
  for (const table of presentTables) {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (Number(rows[0]?.count || 0) > 0) {
      throw new Error(`brand live approval schema drift on non-empty table: ${table}`);
    }
  }
  for (const table of [
    "brand_live_approval_schedule_links",
    "brand_live_approval_events",
    "brand_live_approval_products",
    "brand_live_approvals",
    "brand_live_approval_setting_events",
    "brand_live_approval_settings",
  ] as const) {
    await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
  return true;
}

function normalizeIdentity(value: unknown): string {
  return String(value || "").normalize("NFKC").trim().replace(/^@/, "").toLowerCase();
}

export function resolveCanonicalTargetLiverId(
  targetLiverName: unknown,
  liveAccount: unknown,
  livers: Array<{ id: unknown; name: unknown; tiktokAccount: unknown }>,
): number {
  const name = normalizeIdentity(targetLiverName);
  const account = normalizeIdentity(liveAccount);
  const matches = livers.filter(liver => normalizeIdentity(liver.name) === name && normalizeIdentity(liver.tiktokAccount) === account);
  if (!name || !account || matches.length !== 1) throw new Error("cannot uniquely resolve canonical target liver");
  const id = Number(matches[0].id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("cannot uniquely resolve canonical target liver");
  return id;
}

async function repairNullableTargetLiverIds(
  pool: Pool,
  state: Awaited<ReturnType<typeof schemaState>>,
): Promise<number> {
  if (!state.present.brand_live_approvals || !state.invalidColumns.includes("brand_live_approvals.targetLiverId:not-null")) return 0;
  const connection = await pool.getConnection();
  let repaired = 0;
  try {
    await connection.beginTransaction();
    const [approvalRows] = await connection.query<RowDataPacket[]>(
      "SELECT id,targetLiverName,liveAccount FROM brand_live_approvals WHERE targetLiverId IS NULL FOR UPDATE",
    );
    if (approvalRows.length > 0) {
      const [liverRows] = await connection.query<RowDataPacket[]>(
        "SELECT id,name,tiktokAccount FROM livers WHERE isActive=1 AND tiktokAccount IS NOT NULL AND TRIM(tiktokAccount)<>''",
      );
      const canonicalLivers = liverRows.map(row => ({ id: row.id, name: row.name, tiktokAccount: row.tiktokAccount }));
      for (const approval of approvalRows) {
        let targetLiverId: number;
        try {
          targetLiverId = resolveCanonicalTargetLiverId(approval.targetLiverName, approval.liveAccount, canonicalLivers);
        } catch {
          throw new Error(`cannot uniquely backfill targetLiverId for approval ${Number(approval.id)}`);
        }
        const [result] = await connection.query<ResultSetHeader>(
          "UPDATE brand_live_approvals SET targetLiverId=? WHERE id=? AND targetLiverId IS NULL",
          [targetLiverId, Number(approval.id)],
        );
        if (Number(result.affectedRows) !== 1) throw new Error(`targetLiverId backfill race for approval ${Number(approval.id)}`);
        repaired += 1;
      }
    }
    await connection.commit();
    await connection.query("ALTER TABLE brand_live_approvals MODIFY COLUMN targetLiverId INT NOT NULL");
    return repaired;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function createTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_settings (
      id INT NOT NULL PRIMARY KEY DEFAULT 1,
      approverUserId INT NOT NULL,
      approverName VARCHAR(255) NOT NULL,
      configuredBy INT NOT NULL,
      configuredAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approvals (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      brandId INT NOT NULL,
      targetLiverId INT NOT NULL,
      targetLiverName VARCHAR(255) NOT NULL,
      liveAccount VARCHAR(255) NOT NULL,
      assistantOnsite ENUM('yes','no','tbd') NOT NULL DEFAULT 'tbd',
      assistantDetails TEXT NULL,
      mechanismSummary TEXT NOT NULL,
      commissionRate DECIMAL(8,2) NULL,
      slotFeeAmount BIGINT NULL,
      guaranteeType ENUM('none','roi','minimum_gmv','other') NOT NULL DEFAULT 'none',
      guaranteeValue DECIMAL(20,4) NULL,
      guaranteeTerms TEXT NULL,
      scheduledStart TIMESTAMP NOT NULL,
      scheduledEnd TIMESTAMP NOT NULL,
      businessNotes TEXT NULL,
      status ENUM('draft','pending_approval','changes_requested','approved','scheduled','cancelled') NOT NULL DEFAULT 'draft',
      revision INT NOT NULL DEFAULT 1,
      submittedBy INT NULL,
      submittedByName VARCHAR(255) NULL,
      submittedAt TIMESTAMP(3) NULL,
      reviewedBy INT NULL,
      reviewedByName VARCHAR(255) NULL,
      reviewedAt TIMESTAMP(3) NULL,
      reviewComment TEXT NULL,
      createdBy INT NOT NULL,
      createdByName VARCHAR(255) NOT NULL,
      updatedBy INT NOT NULL,
      updatedByName VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY idx_brand_live_approval_brand_status_time (brandId,status,scheduledStart),
      KEY idx_brand_live_approval_reviewer_status_time (status,submittedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_products (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      approvalId BIGINT NOT NULL,
      productId INT NULL,
      productName VARCHAR(255) NOT NULL,
      specification VARCHAR(1000) NULL,
      originalPrice BIGINT NULL,
      discountedPrice BIGINT NULL,
      offerMechanism TEXT NOT NULL,
      commissionRate DECIMAL(8,2) NULL,
      inventory INT NULL,
      notes TEXT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_brand_live_approval_product_order (approvalId,sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      approvalId BIGINT NOT NULL,
      brandId INT NOT NULL,
      eventType VARCHAR(48) NOT NULL,
      fromStatus VARCHAR(32) NULL,
      toStatus VARCHAR(32) NULL,
      snapshotJson JSON NOT NULL,
      actorUserId INT NOT NULL,
      actorName VARCHAR(255) NOT NULL,
      comment TEXT NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_brand_live_approval_event_time (approvalId,createdAt),
      KEY idx_brand_live_approval_event_brand_time (brandId,createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_schedule_links (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      approvalId BIGINT NOT NULL,
      scheduleId INT NOT NULL,
      brandId INT NOT NULL,
      linkedBy INT NULL,
      linkedByName VARCHAR(255) NULL,
      linkedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      unlinkedBy INT NULL,
      unlinkedByName VARCHAR(255) NULL,
      unlinkedAt TIMESTAMP(3) NULL,
      UNIQUE KEY uq_brand_live_approval_schedule_approval (approvalId),
      KEY idx_brand_live_approval_schedule_active (scheduleId,brandId,isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_setting_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      previousApproverUserId INT NULL,
      previousApproverName VARCHAR(255) NULL,
      approverUserId INT NOT NULL,
      approverName VARCHAR(255) NOT NULL,
      actorUserId INT NOT NULL,
      actorName VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_brand_live_approval_setting_event_time (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureRunTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_live_approval_upgrade_runs (
      recoveryKey VARCHAR(100) NOT NULL PRIMARY KEY,
      status VARCHAR(24) NOT NULL,
      startedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      completedAt TIMESTAMP(3) NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function runBrandLiveApprovalUpgradeSetup(): Promise<void> {
  if (!isBrandLiveApprovalUpgradeAuthorized()) throw new Error("BRAND_LIVE_APPROVAL_UPGRADE_NOT_AUTHORIZED");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for brand live approval upgrade");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z", connectionLimit: 2 });
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,600) AS acquired", [LOCK_KEY]);
    locked = Number(lockRows[0]?.acquired || 0) === 1;
    if (!locked) throw new Error("brand live approval upgrade lock timeout");
    const beforeSchema = await schemaState(pool);
    if (beforeSchema.healthy) {
      await ensureRunTable(pool);
      await pool.query(
        `INSERT INTO brand_live_approval_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
         VALUES (?,'success',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),?,NULL)
         ON DUPLICATE KEY UPDATE status='success',completedAt=CURRENT_TIMESTAMP(3),details=VALUES(details),errorMessage=NULL`,
        [UPGRADE_KEY, JSON.stringify({ beforeSchema, alreadyHealthy: true })],
      );
      return;
    }
    const [beforeRows] = await pool.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM brands) AS brandCount,(SELECT COUNT(*) FROM schedules) AS scheduleCount");
    const before = { brandCount: Number(beforeRows[0]?.brandCount || 0), scheduleCount: Number(beforeRows[0]?.scheduleCount || 0) };
    const backupId = await verifiedBackup(pool);
    const repairedTargetLiverIds = await repairNullableTargetLiverIds(pool, beforeSchema);
    const schemaAfterRepair = await schemaState(pool);
    const rebuiltEmptyPartialSchema = await rebuildEmptyPartialSchema(pool, schemaAfterRepair);
    await createTables(pool);
    await ensureRunTable(pool);
    const afterSchema = await schemaState(pool);
    if (!afterSchema.healthy) throw new Error(`brand live approval schema incomplete: ${JSON.stringify(afterSchema)}`);
    const [afterRows] = await pool.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM brands) AS brandCount,(SELECT COUNT(*) FROM schedules) AS scheduleCount");
    const after = { brandCount: Number(afterRows[0]?.brandCount || 0), scheduleCount: Number(afterRows[0]?.scheduleCount || 0) };
    if (before.brandCount !== after.brandCount || before.scheduleCount !== after.scheduleCount) throw new Error("protected source counts changed during upgrade");
    await pool.query(
      `INSERT INTO brand_live_approval_upgrade_runs (recoveryKey,status,startedAt,completedAt,details,errorMessage)
       VALUES (?,'success',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3),?,NULL)
       ON DUPLICATE KEY UPDATE status='success',completedAt=CURRENT_TIMESTAMP(3),details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeSchema, afterSchema, before, after, backupId, repairedTargetLiverIds, rebuiltEmptyPartialSchema })],
    );
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_KEY]).catch(() => undefined);
    connection.release();
    await pool.end();
  }
}

export function startBrandLiveApprovalUpgradeSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = runBrandLiveApprovalUpgradeSetup().catch(error => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export function ensureBrandLiveApprovalReady(): Promise<void> {
  if (!isBrandLiveApprovalUpgradeAuthorized()) return Promise.resolve();
  return startBrandLiveApprovalUpgradeSetup();
}

export async function getBrandLiveApprovalUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, timezone: "Z" });
  try {
    const schema = await schemaState(pool);
    const hasRunTable = await tableExists(pool, "brand_live_approval_upgrade_runs");
    let run: RowDataPacket | undefined;
    if (hasRunTable) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT status,completedAt,errorMessage FROM brand_live_approval_upgrade_runs WHERE recoveryKey=? LIMIT 1",
        [UPGRADE_KEY],
      );
      run = rows[0];
    }
    return {
      healthy: schema.healthy && Boolean(run) && String(run?.status) === "success",
      recoveryKey: UPGRADE_KEY,
      schema,
      run: run ? { status: String(run.status), completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null, hasError: Boolean(run.errorMessage) } : null,
    };
  } finally {
    await pool.end();
  }
}
