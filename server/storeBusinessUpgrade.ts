import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "store-business-command-center-v1";
const PRE_REASON = "pre-store-business-command-center-v1";
const POST_REASON = "post-store-business-command-center-v1";
const REQUIRED_TABLES = [
  "store_daily_master_reports",
  "store_daily_master_report_versions",
  "store_daily_master_report_field_audits",
] as const;

const REQUIRED_COLUMNS = [
  ["managed_stores", "brandId"],
  ["ad_monthly_plans", "storeId"],
  ["influencer_bd_campaigns", "storeId"],
  ["store_manager_work_items", "sourceType"],
  ["store_manager_work_items", "sourceKey"],
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_business_upgrade_runs (
    recoveryKey VARCHAR(80) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableExists(pool: Pool, table: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(pool: Pool, table: string, column: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [table, column]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(pool: Pool, table: string, index: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
    [table, index]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function schemaState(pool: Pool) {
  const missingTables: string[] = [];
  for (const table of REQUIRED_TABLES)
    if (!(await tableExists(pool, table))) missingTables.push(table);
  const missingColumns: string[] = [];
  for (const [table, column] of REQUIRED_COLUMNS) {
    if (
      !(await tableExists(pool, table)) ||
      !(await columnExists(pool, table, column))
    ) {
      missingColumns.push(`${table}.${column}`);
    }
  }
  const requiredIndexes = [
    ["managed_stores", "idx_managed_store_brand"],
    ["ad_monthly_plans", "idx_ad_plan_store_month"],
    ["influencer_bd_campaigns", "idx_influencer_campaign_store"],
    ["store_manager_work_items", "uq_store_work_source"],
  ] as const;
  const missingIndexes: string[] = [];
  for (const [table, index] of requiredIndexes) {
    if (
      !(await tableExists(pool, table)) ||
      !(await indexExists(pool, table, index))
    ) {
      missingIndexes.push(`${table}.${index}`);
    }
  }
  return {
    healthy:
      missingTables.length === 0 &&
      missingColumns.length === 0 &&
      missingIndexes.length === 0,
    missingTables,
    missingColumns,
    missingIndexes,
  };
}

async function countIfExists(pool: Pool, table: string) {
  if (!(await tableExists(pool, table))) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\``
  );
  return Number(rows[0]?.count || 0);
}

async function sourceSnapshot(pool: Pool) {
  return {
    managedStores: await countIfExists(pool, "managed_stores"),
    storeUploads: await countIfExists(pool, "store_data_uploads"),
    legacyReports: await countIfExists(pool, "store_operation_reports"),
    workItems: await countIfExists(pool, "store_manager_work_items"),
    adPlans: await countIfExists(pool, "ad_monthly_plans"),
    influencerCampaigns: await countIfExists(pool, "influencer_bd_campaigns"),
    influencerLogs: await countIfExists(pool, "influencer_bd_outreach_logs"),
  };
}

async function latestBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs"
  );
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool, reason: string) {
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

async function ensureColumns(pool: Pool) {
  if (!(await columnExists(pool, "managed_stores", "brandId"))) {
    await pool.query(
      "ALTER TABLE managed_stores ADD COLUMN brandId INT NULL AFTER id"
    );
  }
  if (!(await columnExists(pool, "ad_monthly_plans", "storeId"))) {
    await pool.query(
      "ALTER TABLE ad_monthly_plans ADD COLUMN storeId INT NULL AFTER brandId"
    );
  }
  if (!(await columnExists(pool, "influencer_bd_campaigns", "storeId"))) {
    await pool.query(
      "ALTER TABLE influencer_bd_campaigns ADD COLUMN storeId INT NULL AFTER brandId"
    );
  }
  if (!(await columnExists(pool, "store_manager_work_items", "sourceType"))) {
    await pool.query(
      "ALTER TABLE store_manager_work_items ADD COLUMN sourceType VARCHAR(80) NULL AFTER evidenceJson"
    );
  }
  if (!(await columnExists(pool, "store_manager_work_items", "sourceKey"))) {
    await pool.query(
      "ALTER TABLE store_manager_work_items ADD COLUMN sourceKey VARCHAR(255) NULL AFTER sourceType"
    );
  }
  if (!(await indexExists(pool, "managed_stores", "idx_managed_store_brand"))) {
    await pool.query(
      "ALTER TABLE managed_stores ADD INDEX idx_managed_store_brand (brandId,isActive)"
    );
  }
  if (
    !(await indexExists(pool, "ad_monthly_plans", "idx_ad_plan_store_month"))
  ) {
    await pool.query(
      "ALTER TABLE ad_monthly_plans ADD INDEX idx_ad_plan_store_month (storeId,month,planType)"
    );
  }
  if (
    !(await indexExists(
      pool,
      "influencer_bd_campaigns",
      "idx_influencer_campaign_store"
    ))
  ) {
    await pool.query(
      "ALTER TABLE influencer_bd_campaigns ADD INDEX idx_influencer_campaign_store (storeId,status,deletedAt)"
    );
  }
  if (
    !(await indexExists(
      pool,
      "store_manager_work_items",
      "uq_store_work_source"
    ))
  ) {
    await pool.query(
      "ALTER TABLE store_manager_work_items ADD UNIQUE INDEX uq_store_work_source (sourceType,sourceKey)"
    );
  }
}

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_master_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    reportDate DATE NOT NULL,
    cutoffTime VARCHAR(5) NOT NULL DEFAULT '18:00',
    status ENUM('draft','submitted','confirmed','reopened') NOT NULL DEFAULT 'draft',
    payloadJson JSON NOT NULL,
    versionNumber INT NOT NULL DEFAULT 1,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    submittedById BIGINT NULL,
    submittedByName VARCHAR(255) NULL,
    submittedAt TIMESTAMP NULL,
    confirmedById BIGINT NULL,
    confirmedByName VARCHAR(255) NULL,
    confirmedAt TIMESTAMP NULL,
    reopenedById BIGINT NULL,
    reopenedByName VARCHAR(255) NULL,
    reopenedAt TIMESTAMP NULL,
    reopenReason VARCHAR(1000) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_daily_master_date (storeId,reportDate),
    INDEX idx_store_daily_master_status (reportDate,status,storeId),
    INDEX idx_store_daily_master_updated (storeId,updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_master_report_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportId BIGINT NOT NULL,
    storeId INT NOT NULL,
    reportDate DATE NOT NULL,
    versionNumber INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    payloadJson JSON NOT NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_daily_master_version (reportId,versionNumber),
    INDEX idx_store_daily_master_version_date (storeId,reportDate,versionNumber)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS store_daily_master_report_field_audits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportId BIGINT NOT NULL,
    storeId INT NOT NULL,
    reportDate DATE NOT NULL,
    versionNumber INT NOT NULL,
    fieldPath VARCHAR(255) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_daily_master_audit_report (reportId,createdAt),
    INDEX idx_store_daily_master_audit_field (storeId,reportDate,fieldPath,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function getStoreBusinessUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const schema = await schemaState(pool);
    const snapshot = await sourceSnapshot(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,details,errorMessage FROM store_business_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY]
    );
    return {
      healthy: schema.healthy,
      recoveryKey: UPGRADE_KEY,
      schema,
      snapshot,
      recoveryRun: runs[0] || null,
    };
  } finally {
    await pool.end();
  }
}

export async function runStoreBusinessUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for store business upgrade");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const beforeSchema = await schemaState(pool);
    if (beforeSchema.healthy) {
      console.log("[StoreBusinessUpgrade] schema healthy");
      return;
    }
    const before = await sourceSnapshot(pool);
    await pool.query(
      `INSERT INTO store_business_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeSchema, before })]
    );
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await ensureColumns(pool);
    await createTables(pool);
    const afterSchema = await schemaState(pool);
    if (!afterSchema.healthy)
      throw new Error(
        `store business schema incomplete: ${JSON.stringify(afterSchema)}`
      );
    const after = await sourceSnapshot(pool);
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key])
        throw new Error(
          `${key} changed during schema upgrade: ${before[key]}->${after[key]}`
        );
    }
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = {
      beforeSchema,
      afterSchema,
      before,
      after,
      preBackupId,
      postBackupId,
      existingBusinessRowsModified: 0,
    };
    await pool.query(
      "UPDATE store_business_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify(details), UPGRADE_KEY]
    );
    console.log(`[StoreBusinessUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool
      .query(
        "UPDATE store_business_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
        [message.slice(0, 4000), UPGRADE_KEY]
      )
      .catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
