import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "influencer-bd-v2";
const PRE_REASON = "pre-influencer-bd-v2";
const POST_REASON = "post-influencer-bd-v2";

const REQUIRED_TABLES = [
  "influencer_bd_campaigns",
  "influencer_bd_creators",
  "influencer_bd_creator_import_previews",
  "influencer_bd_import_rate_limits",
  "influencer_bd_outreach_logs",
  "influencer_bd_attachments",
  "influencer_bd_ai_analyses",
  "influencer_bd_analysis_feedback",
  "influencer_bd_settings",
  "influencer_bd_audit_logs",
] as const;

const REQUIRED_COLUMNS = {
  influencer_bd_campaigns: ["storeId"],
  influencer_bd_creator_import_previews: ["tokenHash", "actorId", "rowHashesJson", "eligibleCount", "expiresAt", "consumedAt", "createdAt"],
  influencer_bd_import_rate_limits: ["bucketHash", "windowStartedAt", "attempts", "updatedAt"],
} as const;

const REQUIRED_INDEXES = {
  influencer_bd_creators: ["uq_influencer_bd_creator_handle"],
  influencer_bd_creator_import_previews: ["PRIMARY", "idx_influencer_bd_import_preview_expiry"],
  influencer_bd_import_rate_limits: ["PRIMARY", "idx_influencer_bd_import_rate_updated"],
} as const;

const REQUIRED_INDEX_SIGNATURES = {
  "influencer_bd_creators.uq_influencer_bd_creator_handle": { unique: true, columns: ["platform", "normalizedHandle"] },
  "influencer_bd_creator_import_previews.PRIMARY": { unique: true, columns: ["tokenHash"] },
  "influencer_bd_creator_import_previews.idx_influencer_bd_import_preview_expiry": { unique: false, columns: ["expiresAt", "consumedAt"] },
  "influencer_bd_import_rate_limits.PRIMARY": { unique: true, columns: ["bucketHash"] },
  "influencer_bd_import_rate_limits.idx_influencer_bd_import_rate_updated": { unique: false, columns: ["updatedAt"] },
} as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_upgrade_runs (
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
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES],
  );
  const existing = rows.map(row => String(row.tableName));
  return {
    existing,
    missing: REQUIRED_TABLES.filter(name => !existing.includes(name)),
  };
}

export async function getInfluencerBdSchemaState(pool: Pool) {
  const tables = await tableState(pool);
  const tableNames = Object.keys(REQUIRED_COLUMNS);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME IN (${tableNames.map(() => "?").join(",")})`,
    tableNames,
  );
  const existing = new Set(rows.map(row => `${String(row.tableName)}.${String(row.columnName)}`));
  const missingColumns = Object.entries(REQUIRED_COLUMNS).flatMap(([tableName, columns]) =>
    columns.filter(column => !existing.has(`${tableName}.${column}`)).map(column => `${tableName}.${column}`),
  );
  const indexTableNames = Object.keys(REQUIRED_INDEXES);
  const [indexRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName,INDEX_NAME AS indexName,COLUMN_NAME AS columnName,SEQ_IN_INDEX AS sequenceNumber,NON_UNIQUE AS nonUnique
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME IN (${indexTableNames.map(() => "?").join(",")})`,
    indexTableNames,
  );
  const indexParts = new Map<string, Array<{ column: string; sequence: number; nonUnique: number }>>();
  for (const row of indexRows) {
    const key = `${String(row.tableName)}.${String(row.indexName)}`;
    const parts = indexParts.get(key) || [];
    parts.push({ column: String(row.columnName), sequence: Number(row.sequenceNumber), nonUnique: Number(row.nonUnique) });
    indexParts.set(key, parts);
  }
  const missingIndexes = Object.entries(REQUIRED_INDEX_SIGNATURES).flatMap(([key, expected]) => {
    const parts = (indexParts.get(key) || []).sort((a, b) => a.sequence - b.sequence);
    const actualColumns = parts.map(part => part.column);
    const uniqueMatches = parts.length > 0 && (parts[0].nonUnique === 0) === expected.unique;
    return uniqueMatches && JSON.stringify(actualColumns) === JSON.stringify(expected.columns) ? [] : [key];
  });
  return { ...tables, missingColumns, missingIndexes };
}

async function columnExists(pool: Pool, tableName: string, columnName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function ensureColumn(pool: Pool, tableName: string, columnName: string, definition: string) {
  if (await columnExists(pool, tableName, columnName)) return;
  await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function indexExists(pool: Pool, tableName: string, indexName: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
    [tableName, indexName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function countIfExists(pool: Pool, table: string) {
  const [exists] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  if (!Number(exists[0]?.count || 0)) return 0;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0]?.count || 0);
}

async function sourceSnapshot(pool: Pool) {
  return {
    userCount: await countIfExists(pool, "users"),
    staffCount: await countIfExists(pool, "staff"),
    brandCount: await countIfExists(pool, "brands"),
    brandProductCount: await countIfExists(pool, "brand_products"),
    reportCount: await countIfExists(pool, "reports"),
    managedStoreCount: await countIfExists(pool, "managed_stores"),
    campaignCount: await countIfExists(pool, "influencer_bd_campaigns"),
    creatorCount: await countIfExists(pool, "influencer_bd_creators"),
    outreachCount: await countIfExists(pool, "influencer_bd_outreach_logs"),
    attachmentCount: await countIfExists(pool, "influencer_bd_attachments"),
    analysisCount: await countIfExists(pool, "influencer_bd_ai_analyses"),
  };
}

async function latestBackupId(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id),0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function verifiedBackup(pool: Pool, reason: string) {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,status,errorMessage FROM db_backup_runs WHERE id>? AND reason=? ORDER BY id DESC LIMIT 1",
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row || String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row?.errorMessage || "missing row")}`);
  }
  return Number(row.id);
}

async function createTables(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    brandId INT NULL,
    storeId INT NULL,
    productId INT NULL,
    productNameSnapshot VARCHAR(500) NULL,
    coreSellingPoints TEXT NULL,
    creatorBenefits TEXT NULL,
    commissionPolicy TEXT NULL,
    samplePolicy TEXT NULL,
    targetCreatorProfile TEXT NULL,
    referenceOpeningScript TEXT NULL,
    referenceFollowUpScript TEXT NULL,
    objectionHandling TEXT NULL,
    status ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
    createdById INT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById INT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_campaign_status (status,deletedAt,updatedAt),
    INDEX idx_influencer_bd_campaign_product (brandId,productId,deletedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  if (!(await columnExists(pool, "influencer_bd_campaigns", "storeId"))) {
    await pool.query("ALTER TABLE influencer_bd_campaigns ADD COLUMN storeId INT NULL AFTER brandId");
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_creators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    displayName VARCHAR(255) NOT NULL,
    platform ENUM('TikTok','Instagram','YouTube','X','LINE','WeChat','other') NOT NULL DEFAULT 'TikTok',
    handle VARCHAR(255) NULL,
    normalizedHandle VARCHAR(255) NULL,
    profileUrl TEXT NULL,
    followerCount BIGINT NULL,
    category VARCHAR(255) NULL,
    country VARCHAR(100) NULL,
    language VARCHAR(100) NULL,
    contactInfo TEXT NULL,
    ownerStaffId INT NULL,
    ownerStaffName VARCHAR(255) NULL,
    status ENUM('potential','contacting','replied','interested','sample','negotiating','cooperating','paused','rejected','archived') NOT NULL DEFAULT 'potential',
    notes TEXT NULL,
    lastContactAt TIMESTAMP NULL,
    lastReplyAt TIMESTAMP NULL,
    createdById INT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById INT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_influencer_bd_creator_handle (platform,normalizedHandle),
    INDEX idx_influencer_bd_creator_owner (ownerStaffId,status,deletedAt),
    INDEX idx_influencer_bd_creator_recent (lastContactAt,lastReplyAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_creator_import_previews (
    tokenHash CHAR(64) PRIMARY KEY,
    actorId INT NOT NULL,
    rowHashesJson JSON NOT NULL,
    eligibleCount INT NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    consumedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_import_preview_actor (actorId,expiresAt,consumedAt),
    INDEX idx_influencer_bd_import_preview_expiry (expiresAt,consumedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "tokenHash", "CHAR(64) NOT NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "actorId", "INT NOT NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "rowHashesJson", "JSON NOT NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "eligibleCount", "INT NOT NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "expiresAt", "TIMESTAMP NOT NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "consumedAt", "TIMESTAMP NULL");
  await ensureColumn(pool, "influencer_bd_creator_import_previews", "createdAt", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_import_rate_limits (
    bucketHash CHAR(64) PRIMARY KEY,
    windowStartedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attempts INT NOT NULL DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_import_rate_updated (updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(pool, "influencer_bd_import_rate_limits", "bucketHash", "CHAR(64) NOT NULL");
  await ensureColumn(pool, "influencer_bd_import_rate_limits", "windowStartedAt", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(pool, "influencer_bd_import_rate_limits", "attempts", "INT NOT NULL DEFAULT 1");
  await ensureColumn(pool, "influencer_bd_import_rate_limits", "updatedAt", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  if (!(await indexExists(pool, "influencer_bd_creators", "uq_influencer_bd_creator_handle"))) {
    await pool.query("ALTER TABLE influencer_bd_creators ADD UNIQUE INDEX uq_influencer_bd_creator_handle (platform,normalizedHandle)");
  }
  if (!(await indexExists(pool, "influencer_bd_creator_import_previews", "PRIMARY"))) {
    await pool.query("ALTER TABLE influencer_bd_creator_import_previews ADD PRIMARY KEY (tokenHash)");
  }
  if (!(await indexExists(pool, "influencer_bd_creator_import_previews", "idx_influencer_bd_import_preview_expiry"))) {
    await pool.query("ALTER TABLE influencer_bd_creator_import_previews ADD INDEX idx_influencer_bd_import_preview_expiry (expiresAt,consumedAt)");
  }
  if (!(await indexExists(pool, "influencer_bd_import_rate_limits", "PRIMARY"))) {
    await pool.query("ALTER TABLE influencer_bd_import_rate_limits ADD PRIMARY KEY (bucketHash)");
  }
  if (!(await indexExists(pool, "influencer_bd_import_rate_limits", "idx_influencer_bd_import_rate_updated"))) {
    await pool.query("ALTER TABLE influencer_bd_import_rate_limits ADD INDEX idx_influencer_bd_import_rate_updated (updatedAt)");
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_outreach_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creatorId INT NOT NULL,
    campaignId INT NULL,
    staffId INT NULL,
    staffName VARCHAR(255) NULL,
    activityDate DATE NOT NULL,
    channel ENUM('tiktok_dm','instagram_dm','email','line','wechat','phone','other') NOT NULL,
    stage ENUM('initial_contact','follow_up','replied','needs_confirmed','sample_proposed','sample_sent','negotiating','cooperation_confirmed','rejected','paused') NOT NULL DEFAULT 'initial_contact',
    contactCount INT NOT NULL DEFAULT 1,
    responseType ENUM('none','neutral','positive','rejected','follow_up_needed') NOT NULL DEFAULT 'none',
    replyReceived TINYINT(1) NOT NULL DEFAULT 0,
    positiveReply TINYINT(1) NOT NULL DEFAULT 0,
    sampleAdvanced TINYINT(1) NOT NULL DEFAULT 0,
    cooperationConfirmed TINYINT(1) NOT NULL DEFAULT 0,
    pitchText TEXT NULL,
    chatText LONGTEXT NULL,
    issues TEXT NULL,
    nextAction TEXT NULL,
    nextFollowUpDate DATE NULL,
    outcomeNotes TEXT NULL,
    createdById INT NULL,
    createdByName VARCHAR(255) NULL,
    updatedById INT NULL,
    updatedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_outreach_period (activityDate,deletedAt,staffId),
    INDEX idx_influencer_bd_outreach_creator (creatorId,activityDate,deletedAt),
    INDEX idx_influencer_bd_outreach_campaign (campaignId,activityDate,deletedAt),
    INDEX idx_influencer_bd_outreach_followup (nextFollowUpDate,stage,deletedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    outreachId INT NOT NULL,
    creatorId INT NOT NULL,
    storageKey VARCHAR(512) NOT NULL,
    fileUrl TEXT NOT NULL,
    fileName VARCHAR(512) NOT NULL,
    mimeType VARCHAR(100) NOT NULL,
    fileSize BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    uploadedById INT NULL,
    uploadedByName VARCHAR(255) NULL,
    deletedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_influencer_bd_attachment_key (storageKey),
    INDEX idx_influencer_bd_attachment_outreach (outreachId,deletedAt,createdAt),
    INDEX idx_influencer_bd_attachment_creator (creatorId,deletedAt,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_ai_analyses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scopeType ENUM('personal','team','campaign') NOT NULL,
    scopeStaffId INT NULL,
    periodStart DATE NOT NULL,
    periodEnd DATE NOT NULL,
    campaignId INT NULL,
    model VARCHAR(100) NOT NULL,
    promptVersion VARCHAR(50) NOT NULL,
    inputSnapshotJson JSON NOT NULL,
    resultJson JSON NULL,
    summary TEXT NULL,
    confidence ENUM('high','medium','low') NULL,
    status ENUM('processing','success','failed') NOT NULL DEFAULT 'processing',
    errorCode VARCHAR(100) NULL,
    errorMessage TEXT NULL,
    requestedById INT NULL,
    requestedByName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_analysis_period (periodStart,periodEnd,scopeType),
    INDEX idx_influencer_bd_analysis_staff (scopeStaffId,createdAt),
    INDEX idx_influencer_bd_analysis_campaign (campaignId,createdAt),
    INDEX idx_influencer_bd_analysis_status (status,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_analysis_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysisId INT NOT NULL,
    rating ENUM('good','bad') NOT NULL,
    comment TEXT NULL,
    implementedActionsJson JSON NULL,
    resultNote TEXT NULL,
    userId INT NULL,
    userName VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_feedback_analysis (analysisId,createdAt),
    INDEX idx_influencer_bd_feedback_user (userId,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_settings (
    id INT PRIMARY KEY,
    lowReplyRatePercent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    stagnationDays INT NOT NULL DEFAULT 3,
    minimumContactedCreators INT NOT NULL DEFAULT 20,
    autoAnalysisEnabled TINYINT(1) NOT NULL DEFAULT 0,
    updatedById INT NULL,
    updatedByName VARCHAR(255) NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_bd_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entityType ENUM('campaign','creator','outreach','attachment','analysis','feedback','settings') NOT NULL,
    entityId INT NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId INT NULL,
    actorName VARCHAR(255) NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_influencer_bd_audit_entity (entityType,entityId,createdAt),
    INDEX idx_influencer_bd_audit_actor (actorId,createdAt),
    INDEX idx_influencer_bd_audit_action (action,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensureDefaultSettings(pool: Pool) {
  await pool.query(`INSERT INTO influencer_bd_settings
    (id,lowReplyRatePercent,stagnationDays,minimumContactedCreators,autoAnalysisEnabled)
    VALUES (1,5.00,3,20,0)
    ON DUPLICATE KEY UPDATE id=id`);
}

export async function getInfluencerBdUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool({ uri: databaseUrl, waitForConnections: true, connectionLimit: 3 });
  try {
    await ensureRunTable(pool);
    const tables = await getInfluencerBdSchemaState(pool);
    const snapshot = await sourceSnapshot(pool);
    const [runs] = await pool.query<RowDataPacket[]>(
      "SELECT status,startedAt,completedAt,details,errorMessage FROM influencer_bd_upgrade_runs WHERE recoveryKey=? LIMIT 1",
      [UPGRADE_KEY],
    );
    const [backups] = await pool.query<RowDataPacket[]>(
      "SELECT id,reason,status,tableCount,rowCount,completedAt,errorMessage FROM db_backup_runs WHERE reason IN (?,?) ORDER BY id DESC LIMIT 6",
      [PRE_REASON, POST_REASON],
    );
    return {
      healthy: tables.missing.length === 0 && tables.missingColumns.length === 0 && tables.missingIndexes.length === 0,
      recoveryKey: UPGRADE_KEY,
      missingTables: tables.missing,
      missingColumns: tables.missingColumns,
      missingIndexes: tables.missingIndexes,
      snapshot,
      recoveryRun: runs[0] || null,
      backups,
    };
  } finally {
    await pool.end();
  }
}

export async function runInfluencerBdUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for influencer BD upgrade");
  const pool = mysql.createPool({ uri: databaseUrl, waitForConnections: true, connectionLimit: 3 });
  try {
    await ensureRunTable(pool);
    const beforeTables = await getInfluencerBdSchemaState(pool);
    if (beforeTables.missing.length === 0 && beforeTables.missingColumns.length === 0 && beforeTables.missingIndexes.length === 0) {
      await ensureDefaultSettings(pool);
      console.log("[InfluencerBdUpgrade] schema healthy");
      return;
    }

    const before = await sourceSnapshot(pool);
    await pool.query(
      `INSERT INTO influencer_bd_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, before })],
    );

    const preBackupId = await verifiedBackup(pool, PRE_REASON);
    await createTables(pool);
    await ensureDefaultSettings(pool);

    const afterTables = await getInfluencerBdSchemaState(pool);
    if (afterTables.missing.length || afterTables.missingColumns.length || afterTables.missingIndexes.length) {
      throw new Error(`incomplete schema: tables=${afterTables.missing.join(",")}; columns=${afterTables.missingColumns.join(",")}; indexes=${afterTables.missingIndexes.join(",")}`);
    }

    const after = await sourceSnapshot(pool);
    for (const key of ["userCount", "staffCount", "brandCount", "brandProductCount", "reportCount", "managedStoreCount"] as const) {
      if (before[key] !== after[key]) {
        throw new Error(`${key} changed during schema upgrade: ${before[key]} -> ${after[key]}`);
      }
    }

    const postBackupId = await verifiedBackup(pool, POST_REASON);
    const details = {
      beforeTables,
      afterTables,
      before,
      after,
      preBackupId,
      postBackupId,
      existingBusinessRowsModified: 0,
      defaultSettingsInsertedOrKept: 1,
    };
    await pool.query(
      "UPDATE influencer_bd_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[InfluencerBdUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      "UPDATE influencer_bd_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}
