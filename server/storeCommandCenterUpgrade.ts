import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "store-command-center-v1";
const PRE_REASON = "pre-store-command-center-v1";
const POST_REASON = "post-store-command-center-v1";
const REQUIRED_TABLES = [
  "store_command_imports",
  "store_command_rows",
  "store_growth_alerts",
  "store_growth_task_details",
  "store_growth_task_events",
  "store_growth_playbooks",
  "store_growth_rule_settings",
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_command_upgrade_runs (
    recoveryKey VARCHAR(64) PRIMARY KEY,
    status ENUM('running','success','failed') NOT NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    details JSON NULL,
    errorMessage TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function tableState(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES]
  );
  const existing = rows.map(row => String(row.tableName));
  return {
    existing,
    missing: REQUIRED_TABLES.filter(table => !existing.includes(table)),
  };
}

async function countIfExists(pool: Pool, table: string) {
  const [exists] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table]
  );
  if (!Number(exists[0]?.count || 0)) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\``
  );
  return Number(rows[0]?.count || 0);
}

async function sourceSnapshot(pool: Pool) {
  return {
    activeStoreCount: await countIfExists(pool, "managed_stores"),
    storeUploadCount: await countIfExists(pool, "store_data_uploads"),
    storeWorkItemCount: await countIfExists(pool, "store_manager_work_items"),
    storeReportCount: await countIfExists(pool, "store_operation_reports"),
    tiktokOrderCount: await countIfExists(pool, "tiktok_commission_orders"),
    commandImportCount: await countIfExists(pool, "store_command_imports"),
    commandRowCount: await countIfExists(pool, "store_command_rows"),
    growthAlertCount: await countIfExists(pool, "store_growth_alerts"),
    growthTaskDetailCount: await countIfExists(
      pool,
      "store_growth_task_details"
    ),
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

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_command_imports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    dataType VARCHAR(40) NOT NULL,
    periodStart DATE NULL,
    periodEnd DATE NULL,
    fileName VARCHAR(255) NOT NULL,
    originalFileUrl TEXT NOT NULL,
    originalFileKey VARCHAR(1000) NOT NULL,
    fileSha256 CHAR(64) NOT NULL,
    fileSize BIGINT NOT NULL,
    mimeType VARCHAR(120) NOT NULL,
    parseVersion VARCHAR(80) NOT NULL,
    versionNumber INT NOT NULL DEFAULT 1,
    isCurrent TINYINT(1) NOT NULL DEFAULT 1,
    supersedesId BIGINT NULL,
    recordCount INT NOT NULL DEFAULT 0,
    acceptedCount INT NOT NULL DEFAULT 0,
    rejectedCount INT NOT NULL DEFAULT 0,
    status ENUM('processing','success','partial','failed') NOT NULL DEFAULT 'processing',
    qualityJson JSON NULL,
    deletedAt TIMESTAMP NULL,
    deletedById BIGINT NULL,
    deletedByName VARCHAR(255) NULL,
    deleteReason VARCHAR(1000) NULL,
    uploadedById BIGINT NULL,
    uploadedByName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    UNIQUE KEY uq_store_command_file (storeId,dataType,fileSha256),
    UNIQUE KEY uq_store_command_version (storeId,dataType,periodStart,periodEnd,versionNumber),
    INDEX idx_store_command_import_period (storeId,periodStart,periodEnd,dataType,isCurrent,deletedAt,createdAt),
    INDEX idx_store_command_import_status (storeId,status,isCurrent,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_command_rows (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    importId BIGINT NOT NULL,
    storeId INT NOT NULL,
    dataType VARCHAR(40) NOT NULL,
    businessKey VARCHAR(500) NOT NULL,
    businessDate DATE NULL,
    orderId VARCHAR(128) NULL,
    orderLineId VARCHAR(128) NULL,
    refundId VARCHAR(128) NULL,
    productId VARCHAR(128) NULL,
    productName VARCHAR(1000) NULL,
    skuId VARCHAR(255) NULL,
    skuName VARCHAR(1000) NULL,
    quantity DECIMAL(20,4) NOT NULL DEFAULT 0,
    deliveredQuantity DECIMAL(20,4) NOT NULL DEFAULT 0,
    gmv DECIMAL(20,4) NOT NULL DEFAULT 0,
    refundQuantity DECIMAL(20,4) NOT NULL DEFAULT 0,
    refundAmount DECIMAL(20,4) NOT NULL DEFAULT 0,
    returnReason VARCHAR(1000) NULL,
    channel VARCHAR(255) NULL,
    creatorName VARCHAR(255) NULL,
    sourceContentId VARCHAR(255) NULL,
    sourceSessionId VARCHAR(255) NULL,
    impressions DECIMAL(20,4) NOT NULL DEFAULT 0,
    clicks DECIMAL(20,4) NOT NULL DEFAULT 0,
    orders DECIMAL(20,4) NOT NULL DEFAULT 0,
    rawJson JSON NOT NULL,
    warningsJson JSON NULL,
    rowSha256 CHAR(64) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_command_row (importId,businessKey),
    INDEX idx_store_command_row_store_date (storeId,businessDate,dataType),
    INDEX idx_store_command_row_sku (storeId,productId,skuId,businessDate),
    INDEX idx_store_command_row_order (storeId,orderId,orderLineId),
    INDEX idx_store_command_row_refund (storeId,refundId,businessDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_growth_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL,
    fingerprint VARCHAR(700) NOT NULL,
    ruleKey VARCHAR(100) NOT NULL,
    entityType VARCHAR(50) NOT NULL,
    entityKey VARCHAR(500) NOT NULL,
    productId VARCHAR(128) NULL,
    productName VARCHAR(1000) NULL,
    skuId VARCHAR(255) NULL,
    skuName VARCHAR(1000) NULL,
    severity ENUM('medium','high','critical') NOT NULL DEFAULT 'medium',
    metricKey VARCHAR(100) NOT NULL,
    currentValue DECIMAL(20,4) NULL,
    baselineValue DECIMAL(20,4) NULL,
    opportunityValue DECIMAL(20,4) NOT NULL DEFAULT 0,
    title VARCHAR(500) NOT NULL,
    explanation TEXT NOT NULL,
    evidenceJson JSON NULL,
    status ENUM('active','snoozed','resolved','dismissed') NOT NULL DEFAULT 'active',
    firstDetectedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastDetectedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolvedAt TIMESTAMP NULL,
    UNIQUE KEY uq_store_growth_alert (storeId,fingerprint),
    INDEX idx_store_growth_alert_queue (storeId,status,severity,opportunityValue,lastDetectedAt),
    INDEX idx_store_growth_alert_sku (storeId,productId,skuId,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_growth_task_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workItemId BIGINT NOT NULL,
    alertId BIGINT NULL,
    storeId INT NOT NULL,
    ruleKey VARCHAR(100) NULL,
    entityType VARCHAR(50) NULL,
    entityKey VARCHAR(500) NULL,
    productId VARCHAR(128) NULL,
    productName VARCHAR(1000) NULL,
    skuId VARCHAR(255) NULL,
    skuName VARCHAR(1000) NULL,
    triggerSnapshotJson JSON NULL,
    stepsJson JSON NOT NULL,
    expectedImpactGmv DECIMAL(20,4) NOT NULL DEFAULT 0,
    metricKey VARCHAR(100) NULL,
    baselineValue DECIMAL(20,4) NULL,
    targetValue DECIMAL(20,4) NULL,
    observationDays INT NOT NULL DEFAULT 7,
    guardrailsJson JSON NULL,
    verificationStatus ENUM('pending','observing','effective','ineffective','insufficient') NOT NULL DEFAULT 'pending',
    observationStartAt TIMESTAMP NULL,
    observationEndAt TIMESTAMP NULL,
    submittedAt TIMESTAMP NULL,
    verifiedAt TIMESTAMP NULL,
    verificationSnapshotJson JSON NULL,
    assignedFromRule TINYINT(1) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_growth_work_item (workItemId),
    INDEX idx_store_growth_task_queue (storeId,verificationStatus,observationEndAt),
    INDEX idx_store_growth_task_alert (alertId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_growth_task_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    taskDetailId BIGINT NOT NULL,
    workItemId BIGINT NOT NULL,
    storeId INT NOT NULL,
    action VARCHAR(80) NOT NULL,
    fromStatus VARCHAR(40) NULL,
    toStatus VARCHAR(40) NULL,
    payloadJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store_growth_event_task (taskDetailId,createdAt),
    INDEX idx_store_growth_event_store (storeId,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_growth_playbooks (
    ruleKey VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    workstream VARCHAR(80) NOT NULL,
    stepsJson JSON NOT NULL,
    defaultObservationDays INT NOT NULL DEFAULT 7,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS store_growth_rule_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storeId INT NOT NULL DEFAULT 0,
    ruleKey VARCHAR(100) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    thresholdsJson JSON NOT NULL,
    updatedById BIGINT NULL,
    updatedByName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_growth_rule (storeId,ruleKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function seedPlaybooks(pool: Pool) {
  const rows = [
    [
      "sku_refund_risk",
      "SKU退货损失整改",
      "ads_customer_refund",
      [
        "检查退款原因Top 3和对应订单",
        "核对商品页承诺、规格、使用方法、包装与物流",
        "同步直播、达人和短视频话术",
        "上传修改前后证据并提交观察",
      ],
      14,
    ],
    [
      "high_exposure_low_ctr",
      "高曝光低点击改善",
      "product_page",
      [
        "检查首图和标题前缀",
        "更换短视频前3秒钩子或直播商品卖点",
        "只改变一个变量建立对照",
        "提交观察并等待新数据验证",
      ],
      7,
    ],
    [
      "high_click_low_cvr",
      "高点击低成交改善",
      "product_page",
      [
        "检查SKU售价、折扣、库存和物流",
        "核对评价、详情页和使用说明",
        "确认直播/达人承诺与页面一致",
        "修改后提交观察",
      ],
      7,
    ],
    [
      "high_cvr_low_exposure",
      "高转化商品放大",
      "inventory_growth",
      [
        "确认库存覆盖至少14天",
        "增加直播排期、达人分发或短视频复制",
        "保持原商品页和价格作为对照",
        "提交扩大动作并观察效率",
      ],
      7,
    ],
  ] as const;
  for (const [ruleKey, name, workstream, steps, days] of rows) {
    await pool.query(
      `INSERT INTO store_growth_playbooks (ruleKey,name,workstream,stepsJson,defaultObservationDays)
       VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),workstream=VALUES(workstream),stepsJson=VALUES(stepsJson),defaultObservationDays=VALUES(defaultObservationDays)`,
      [ruleKey, name, workstream, JSON.stringify(steps), days]
    );
  }
}

export async function getStoreCommandCenterUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const tables = await tableState(pool);
    const snapshot = await sourceSnapshot(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,completedAt,details,errorMessage FROM store_command_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY]
    );
    const [backups] = await pool.query<RowDataPacket[]>(
      "SELECT id,reason,status,tableCount,rowCount,completedAt,errorMessage FROM db_backup_runs WHERE reason IN (?,?) ORDER BY id DESC LIMIT 6",
      [PRE_REASON, POST_REASON]
    );
    return {
      healthy: tables.missing.length === 0,
      recoveryKey: UPGRADE_KEY,
      missingTables: tables.missing,
      snapshot,
      recoveryRun: runs[0] || null,
      backups,
    };
  } finally {
    await pool.end();
  }
}

export async function runStoreCommandCenterUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for store command center upgrade"
    );
  const pool = mysql.createPool(databaseUrl);
  try {
    await ensureRunTable(pool);
    const beforeTables = await tableState(pool);
    if (beforeTables.missing.length === 0) {
      await seedPlaybooks(pool);
      console.log("[StoreCommandCenterUpgrade] schema healthy");
      return;
    }
    const before = await sourceSnapshot(pool);
    await pool.query(
      `INSERT INTO store_command_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, before })]
    );
    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await createTables(pool);
    await seedPlaybooks(pool);
    const afterTables = await tableState(pool);
    if (afterTables.missing.length)
      throw new Error(`missing tables: ${afterTables.missing.join(",")}`);
    const after = await sourceSnapshot(pool);
    for (const key of [
      "activeStoreCount",
      "storeUploadCount",
      "storeWorkItemCount",
      "storeReportCount",
      "tiktokOrderCount",
    ] as const) {
      if (before[key] !== after[key])
        throw new Error(
          `${key} changed during schema upgrade: ${before[key]}->${after[key]}`
        );
    }
    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = {
      beforeTables,
      afterTables,
      before,
      after,
      preBackupId,
      postBackupId,
      existingRowsModified: 0,
    };
    await pool.query(
      `UPDATE store_command_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY]
    );
    console.log(
      `[StoreCommandCenterUpgrade] success ${JSON.stringify(details)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool
      .query(
        `UPDATE store_command_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?`,
        [message.slice(0, 4000), UPGRADE_KEY]
      )
      .catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
