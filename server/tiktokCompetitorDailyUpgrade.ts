import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { ensureMysqlColumns, ensureMysqlIndexes } from './mysqlSchemaHelpers.js';

const REQUIRED_TABLES = [
  'tiktok_competitor_ranking_snapshots',
  'tiktok_competitor_shop_rankings',
  'tiktok_competitor_snapshot_products',
  'tiktok_competitor_reports',
  'tiktok_competitor_report_shops',
  'tiktok_competitor_report_products',
  'tiktok_competitor_sync_logs',
  'tiktok_competitor_audit_logs',
] as const;

const REQUIRED_COLUMNS = [
  ['tiktok_competitor_ranking_snapshots','sourceFileSha256'],
  ['tiktok_competitor_ranking_snapshots','sourceFileSize'],
  ['tiktok_competitor_sync_logs','sourceFileSha256'],
  ['tiktok_competitor_sync_logs','sourceFileSize'],
  ['tiktok_competitor_sync_logs','snapshotId'],
] as const;

const REQUIRED_INDEXES = [
  ['tiktok_competitor_ranking_snapshots','uq_tiktok_competitor_snapshot_file_hash'],
  ['tiktok_competitor_sync_logs','idx_tiktok_competitor_sync_snapshot'],
] as const;

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_ranking_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshotDate DATE NOT NULL,
    market VARCHAR(16) NOT NULL DEFAULT 'JP',
    source ENUM('kalodata_api','kalodata_export','manual') NOT NULL,
    sourceFileName VARCHAR(255) NULL,
    sourceFileUrl VARCHAR(1200) NULL,
    sourceFileKey VARCHAR(700) NULL,
    sourceFileSha256 CHAR(64) NULL,
    sourceFileSize BIGINT NULL,
    queryJson JSON NULL,
    status ENUM('processing','success','failed') NOT NULL DEFAULT 'processing',
    rowCount INT NOT NULL DEFAULT 0,
    shopCount INT NOT NULL DEFAULT 0,
    productCount INT NOT NULL DEFAULT 0,
    errorMessage TEXT NULL,
    isCurrent TINYINT(1) NOT NULL DEFAULT 1,
    supersedesId BIGINT NULL,
    importedById BIGINT NULL,
    importedByName VARCHAR(255) NULL,
    importedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tiktok_competitor_snapshot_date (snapshotDate,market,isCurrent,status),
    INDEX idx_tiktok_competitor_snapshot_source (source,importedAt),
    UNIQUE KEY uq_tiktok_competitor_snapshot_file_hash (snapshotDate,market,sourceFileSha256)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_shop_rankings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshotId BIGINT NOT NULL,
    externalShopId VARCHAR(255) NULL,
    shopName VARCHAR(500) NOT NULL,
    shopUrl VARCHAR(1200) NULL,
    rankingPosition INT NOT NULL,
    unitsSold DECIMAL(20,4) NULL,
    gmv DECIMAL(20,4) NULL,
    revenueGrowthRate DECIMAL(12,6) NULL,
    currency VARCHAR(12) NOT NULL DEFAULT 'JPY',
    isPrimaryTop5 TINYINT(1) NOT NULL DEFAULT 0,
    rawJson JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_competitor_snapshot_rank (snapshotId,rankingPosition),
    INDEX idx_tiktok_competitor_shop_name (shopName(120),snapshotId),
    INDEX idx_tiktok_competitor_shop_top5 (snapshotId,isPrimaryTop5,rankingPosition)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_snapshot_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshotId BIGINT NOT NULL,
    shopRankingId BIGINT NOT NULL,
    productRank INT NOT NULL,
    externalProductId VARCHAR(255) NULL,
    productName VARCHAR(700) NULL,
    productUrl VARCHAR(1500) NULL,
    originalPrice DECIMAL(20,4) NULL,
    livePrice DECIMAL(20,4) NULL,
    discountRate DECIMAL(12,6) NULL,
    unitsSold DECIMAL(20,4) NULL,
    gmv DECIMAL(20,4) NULL,
    clickRate DECIMAL(12,6) NULL,
    conversionRate DECIMAL(12,6) NULL,
    heatEvidence VARCHAR(1000) NULL,
    rawJson JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_competitor_snapshot_product_rank (shopRankingId,productRank),
    INDEX idx_tiktok_competitor_snapshot_products (snapshotId,shopRankingId,productRank),
    INDEX idx_tiktok_competitor_snapshot_product_match (externalProductId,snapshotId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportDate DATE NOT NULL,
    market VARCHAR(16) NOT NULL DEFAULT 'JP',
    rankingSnapshotId BIGINT NOT NULL,
    assignedStaffId INT NOT NULL,
    assignedStaffName VARCHAR(255) NOT NULL,
    status ENUM('draft','submitted','returned','approved') NOT NULL DEFAULT 'draft',
    patrolStartedAt TIMESTAMP NULL,
    patrolCompletedAt TIMESTAMP NULL,
    summaryJson JSON NULL,
    operatorNotes TEXT NULL,
    returnReason TEXT NULL,
    submittedAt TIMESTAMP NULL,
    approvedAt TIMESTAMP NULL,
    approvedById BIGINT NULL,
    approvedByName VARCHAR(255) NULL,
    createdById BIGINT NULL,
    createdByName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_competitor_report_staff_date (reportDate,market,assignedStaffId),
    INDEX idx_tiktok_competitor_report_status (reportDate,status,assignedStaffId),
    INDEX idx_tiktok_competitor_report_snapshot (rankingSnapshotId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_report_shops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportId BIGINT NOT NULL,
    shopRankingId BIGINT NULL,
    externalShopId VARCHAR(255) NULL,
    shopName VARCHAR(500) NOT NULL,
    shopUrl VARCHAR(1200) NULL,
    rankingPosition INT NOT NULL,
    unitsSold DECIMAL(20,4) NULL,
    gmv DECIMAL(20,4) NULL,
    isPrimary TINYINT(1) NOT NULL DEFAULT 1,
    operatorNotes TEXT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_competitor_report_shop_rank (reportId,rankingPosition),
    INDEX idx_tiktok_competitor_report_shop_name (shopName(120),reportId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_report_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reportId BIGINT NOT NULL,
    reportShopId BIGINT NOT NULL,
    productRank INT NOT NULL,
    externalProductId VARCHAR(255) NULL,
    productName VARCHAR(700) NULL,
    productUrl VARCHAR(1500) NULL,
    originalPrice DECIMAL(20,4) NULL,
    livePrice DECIMAL(20,4) NULL,
    discountRate DECIMAL(12,6) NULL,
    unitsSold DECIMAL(20,4) NULL,
    gmv DECIMAL(20,4) NULL,
    clickRate DECIMAL(12,6) NULL,
    conversionRate DECIMAL(12,6) NULL,
    heatEvidence VARCHAR(1000) NULL,
    screenshotUrlsJson JSON NULL,
    screenshotKeysJson JSON NULL,
    sourceJson JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiktok_competitor_report_product_rank (reportShopId,productRank),
    INDEX idx_tiktok_competitor_product_match (externalProductId,reportId),
    INDEX idx_tiktok_competitor_product_name (productName(120),reportId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_sync_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshotDate DATE NOT NULL,
    market VARCHAR(16) NOT NULL DEFAULT 'JP',
    source ENUM('kalodata_api','kalodata_export','manual') NOT NULL,
    status ENUM('running','success','failed','skipped') NOT NULL,
    queryJson JSON NULL,
    sourceFileName VARCHAR(255) NULL,
    sourceFileSha256 CHAR(64) NULL,
    sourceFileSize BIGINT NULL,
    snapshotId BIGINT NULL,
    rowCount INT NOT NULL DEFAULT 0,
    shopCount INT NOT NULL DEFAULT 0,
    productCount INT NOT NULL DEFAULT 0,
    errorCode VARCHAR(100) NULL,
    errorMessage TEXT NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    INDEX idx_tiktok_competitor_sync_time (snapshotDate,market,startedAt),
    INDEX idx_tiktok_competitor_sync_status (status,startedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_competitor_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entityType ENUM('snapshot','report','shop','product','sync') NOT NULL,
    entityId BIGINT NULL,
    reportId BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tiktok_competitor_audit_report (reportId,createdAt),
    INDEX idx_tiktok_competitor_audit_entity (entityType,entityId,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureMysqlColumns(pool, 'tiktok_competitor_ranking_snapshots', [
    { name: 'sourceFileSha256', definition: 'CHAR(64) NULL' },
    { name: 'sourceFileSize', definition: 'BIGINT NULL' },
  ]);
  await ensureMysqlIndexes(pool, 'tiktok_competitor_ranking_snapshots', [
    { name: 'uq_tiktok_competitor_snapshot_file_hash', columns: ['snapshotDate', 'market', 'sourceFileSha256'], unique: true },
  ]);
  await ensureMysqlColumns(pool, 'tiktok_competitor_sync_logs', [
    { name: 'sourceFileSha256', definition: 'CHAR(64) NULL' },
    { name: 'sourceFileSize', definition: 'BIGINT NULL' },
    { name: 'snapshotId', definition: 'BIGINT NULL' },
  ]);
  await ensureMysqlIndexes(pool, 'tiktok_competitor_sync_logs', [
    { name: 'idx_tiktok_competitor_sync_snapshot', columns: ['snapshotId'] },
  ]);
}

export async function ensureTikTokCompetitorDailyTables(pool?: Pool) {
  const ownsPool = !pool;
  const activePool = pool || mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 4,
  });
  try {
    await createTables(activePool);
  } finally {
    if (ownsPool) await activePool.end();
  }
}

export async function getTikTokCompetitorDailyUpgradeHealth(injectedPool?:Pool) {
  if (!injectedPool&&!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool=injectedPool||mysql.createPool({uri:process.env.DATABASE_URL,connectionLimit:2});
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => '?').join(',')})`,
      [...REQUIRED_TABLES],
    );
    const existing = rows.map((row) => String(row.tableName));
    const missing = REQUIRED_TABLES.filter((table) => !existing.includes(table));
    const [columnRows]=await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?)`,
      ['tiktok_competitor_ranking_snapshots','tiktok_competitor_sync_logs'],
    );
    const existingColumns=new Set(columnRows.map((row)=>`${row.tableName}.${row.columnName}`));
    const missingColumns=REQUIRED_COLUMNS
      .map(([table,column])=>`${table}.${column}`)
      .filter((key)=>!existingColumns.has(key));
    const [indexRows]=await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS tableName,INDEX_NAME AS indexName FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?)`,
      ['tiktok_competitor_ranking_snapshots','tiktok_competitor_sync_logs'],
    );
    const existingIndexes=new Set(indexRows.map((row)=>`${row.tableName}.${row.indexName}`));
    const missingIndexes=REQUIRED_INDEXES
      .map(([table,index])=>`${table}.${index}`)
      .filter((key)=>!existingIndexes.has(key));
    return {
      healthy: missing.length===0&&missingColumns.length===0&&missingIndexes.length===0,
      missingTables:missing,
      missingColumns,
      missingIndexes,
      requiredTables:[...REQUIRED_TABLES],
    };
  } finally {
    if (!injectedPool) await pool.end();
  }
}

export async function runTikTokCompetitorDailyUpgradeSetup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for TikTok competitor daily upgrade');
  await ensureTikTokCompetitorDailyTables();
  console.log('[TikTokCompetitorDailyUpgrade] schema healthy');
}
