import { randomUUID } from "node:crypto";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import { storageDelete, storagePutPrivate } from "./storage";
import {
  EXHIBITION_BOOTH_DEFINITIONS,
  EXHIBITION_EVENT_SLUG,
  EXHIBITION_FLOOR_MAP_URL,
  EXHIBITION_MAP_HEIGHT,
  EXHIBITION_MAP_WIDTH,
} from "../shared/exhibitionBoothMap";

const UPGRADE_KEY = "exhibition-booth-v1";
const PRE_BACKUP_REASON = "pre-exhibition-booth-v1";
const POST_BACKUP_REASON = "post-exhibition-booth-v1";
const UPGRADE_LOCK_NAME = "lcj:exhibition-booth-v1";
const REQUIRED_TABLES = [
  "exhibition_booth_upgrade_runs",
  "exhibition_events",
  "exhibition_booths",
  "exhibition_accounts",
  "exhibition_password_reset_tokens",
  "exhibition_brand_profiles",
  "exhibition_booth_assignments",
  "exhibition_brand_assets",
  "exhibition_auth_logs",
  "exhibition_audit_logs",
] as const;

async function ensureRunTable(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_booth_upgrade_runs (
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

async function protectedSnapshot(pool: Pool) {
  return {
    lcjUserCount: await countIfExists(pool, "users"),
    festivalAccountCount: await countIfExists(pool, "festival_accounts"),
    liveBoothReservationCount: await countIfExists(
      pool,
      "lcf_booth_reservations"
    ),
  };
}

async function latestBackupId(pool: Pool) {
  const [tableRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='db_backup_runs'"
  );
  if (!Number(tableRows[0]?.count || 0)) return 0;
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
  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NULL,
    startDate DATE NULL,
    endDate DATE NULL,
    floorMapUrl TEXT NOT NULL,
    floorMapWidth INT NOT NULL,
    floorMapHeight INT NOT NULL,
    status ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_event_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_booths (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    eventId BIGINT NOT NULL,
    boothCode VARCHAR(32) NOT NULL,
    boothType ENUM('t_standard','l_standard','premium_sponsor','title_sponsor','stage') NOT NULL,
    x DECIMAL(10,4) NOT NULL,
    y DECIMAL(10,4) NOT NULL,
    width DECIMAL(10,4) NOT NULL,
    height DECIMAL(10,4) NOT NULL,
    userSelectable TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('available','disabled') NOT NULL DEFAULT 'available',
    label VARCHAR(255) NULL,
    displayOrder INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_booth_code (eventId,boothCode),
    UNIQUE KEY uq_exhibition_booth_event_id (eventId,id),
    INDEX idx_exhibition_booth_event (eventId,status,userSelectable),
    CONSTRAINT fk_exhibition_booth_event FOREIGN KEY (eventId) REFERENCES exhibition_events(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    passwordHash VARCHAR(255) NULL,
    displayName VARCHAR(255) NOT NULL,
    companyName VARCHAR(255) NOT NULL,
    phone VARCHAR(80) NULL,
    status ENUM('invited','active','suspended') NOT NULL DEFAULT 'invited',
    authVersion INT NOT NULL DEFAULT 1,
    failedLoginCount INT NOT NULL DEFAULT 0,
    lockedUntil TIMESTAMP NULL,
    passwordSetAt TIMESTAMP NULL,
    lastLoginAt TIMESTAMP NULL,
    createdByUserId INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_account_email (email),
    INDEX idx_exhibition_account_status (status,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    accountId BIGINT NOT NULL,
    tokenHash CHAR(64) NOT NULL,
    purpose ENUM('set_password','reset_password') NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    usedAt TIMESTAMP NULL,
    createdByUserId INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_password_token (tokenHash),
    INDEX idx_exhibition_password_account (accountId,usedAt,expiresAt),
    CONSTRAINT fk_exhibition_password_account FOREIGN KEY (accountId) REFERENCES exhibition_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_brand_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    eventId BIGINT NOT NULL,
    accountId BIGINT NOT NULL,
    brandId INT NULL,
    brandName VARCHAR(255) NOT NULL,
    companyName VARCHAR(255) NOT NULL,
    contactName VARCHAR(255) NOT NULL,
    contactEmail VARCHAR(320) NOT NULL,
    contactPhone VARCHAR(80) NULL,
    websiteUrl VARCHAR(1000) NULL,
    category VARCHAR(255) NULL,
    brandIntro TEXT NULL,
    mainProducts TEXT NULL,
    socialUrl VARCHAR(1000) NULL,
    tiktokUrl VARCHAR(1000) NULL,
    notes TEXT NULL,
    reviewStatus ENUM('draft','submitted','revision_required','approved') NOT NULL DEFAULT 'draft',
    reviewNote TEXT NULL,
    isPublic TINYINT(1) NOT NULL DEFAULT 0,
    reviewedByUserId INT NULL,
    reviewedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_profile_account_event (eventId,accountId),
    UNIQUE KEY uq_exhibition_profile_event_id (eventId,id),
    INDEX idx_exhibition_profile_review (eventId,reviewStatus,updatedAt),
    CONSTRAINT fk_exhibition_profile_event FOREIGN KEY (eventId) REFERENCES exhibition_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_exhibition_profile_account FOREIGN KEY (accountId) REFERENCES exhibition_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_exhibition_profile_brand FOREIGN KEY (brandId) REFERENCES brands(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_booth_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    eventId BIGINT NOT NULL,
    boothId BIGINT NOT NULL,
    profileId BIGINT NOT NULL,
    status ENUM('selected','confirmed') NOT NULL DEFAULT 'selected',
    selectedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmedAt TIMESTAMP NULL,
    confirmedByUserId INT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_assignment_booth (eventId,boothId),
    UNIQUE KEY uq_exhibition_assignment_profile (eventId,profileId),
    INDEX idx_exhibition_assignment_status (eventId,status,updatedAt),
    CONSTRAINT fk_exhibition_assignment_event FOREIGN KEY (eventId) REFERENCES exhibition_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_exhibition_assignment_booth FOREIGN KEY (eventId,boothId) REFERENCES exhibition_booths(eventId,id) ON DELETE CASCADE,
    CONSTRAINT fk_exhibition_assignment_profile FOREIGN KEY (eventId,profileId) REFERENCES exhibition_brand_profiles(eventId,id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_brand_assets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    profileId BIGINT NOT NULL,
    assetType ENUM('logo','backdrop','other') NOT NULL,
    objectKey VARCHAR(1000) NOT NULL,
    originalFileName VARCHAR(255) NOT NULL,
    mimeType VARCHAR(120) NOT NULL,
    fileSize BIGINT NOT NULL,
    fileSha256 CHAR(64) NOT NULL,
    versionNumber INT NOT NULL,
    isCurrent TINYINT(1) NOT NULL DEFAULT 1,
    reviewStatus ENUM('pending','approved','revision_required') NOT NULL DEFAULT 'pending',
    reviewNote TEXT NULL,
    uploadedByAccountId BIGINT NULL,
    reviewedByUserId INT NULL,
    reviewedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exhibition_asset_version (profileId,assetType,versionNumber),
    INDEX idx_exhibition_asset_current (profileId,assetType,isCurrent,createdAt),
    INDEX idx_exhibition_asset_sha (profileId,assetType,fileSha256),
    CONSTRAINT fk_exhibition_asset_profile FOREIGN KEY (profileId) REFERENCES exhibition_brand_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_exhibition_asset_uploader FOREIGN KEY (uploadedByAccountId) REFERENCES exhibition_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_auth_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    accountId BIGINT NULL,
    emailHash CHAR(64) NOT NULL,
    action VARCHAR(80) NOT NULL,
    success TINYINT(1) NOT NULL,
    ipAddress VARCHAR(120) NULL,
    userAgent VARCHAR(500) NULL,
    details JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exhibition_auth_account (accountId,createdAt),
    INDEX idx_exhibition_auth_action (action,success,createdAt),
    CONSTRAINT fk_exhibition_auth_account FOREIGN KEY (accountId) REFERENCES exhibition_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS exhibition_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    eventId BIGINT NULL,
    accountId BIGINT NULL,
    profileId BIGINT NULL,
    boothId BIGINT NULL,
    assetId BIGINT NULL,
    actorType ENUM('brand','admin','system') NOT NULL,
    actorId BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    reason VARCHAR(1000) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exhibition_audit_event (eventId,createdAt),
    INDEX idx_exhibition_audit_profile (profileId,createdAt),
    INDEX idx_exhibition_audit_account (accountId,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function seedInitialEvent(pool: Pool) {
  await pool.query(
    `INSERT IGNORE INTO exhibition_events
      (slug,name,venue,startDate,endDate,floorMapUrl,floorMapWidth,floorMapHeight,status)
     VALUES (?,?,'',NULL,NULL,?,?,?,'active')`,
    [
      EXHIBITION_EVENT_SLUG,
      "ブランドブース選択",
      EXHIBITION_FLOOR_MAP_URL,
      EXHIBITION_MAP_WIDTH,
      EXHIBITION_MAP_HEIGHT,
    ]
  );
  const [eventRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM exhibition_events WHERE slug=? LIMIT 1",
    [EXHIBITION_EVENT_SLUG]
  );
  const eventId = Number(eventRows[0]?.id || 0);
  if (!eventId) throw new Error("initial exhibition event was not created");

  for (let index = 0; index < EXHIBITION_BOOTH_DEFINITIONS.length; index += 1) {
    const definition = EXHIBITION_BOOTH_DEFINITIONS[index];
    await pool.query(
      `INSERT IGNORE INTO exhibition_booths
        (eventId,boothCode,boothType,x,y,width,height,userSelectable,status,label,displayOrder)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        eventId,
        definition.code,
        definition.type,
        definition.x,
        definition.y,
        definition.width,
        definition.height,
        definition.userSelectable ? 1 : 0,
        definition.type === "stage" ? "disabled" : "available",
        definition.label || null,
        index + 1,
      ]
    );
  }
}

async function verifyPrivateAssetStorage() {
  const objectKey = `private/exhibition/_health/${Date.now()}-${randomUUID()}.txt`;
  await storagePutPrivate(
    objectKey,
    Buffer.from("lcj-exhibition-private-storage-check"),
    "text/plain"
  );
  await storageDelete(objectKey);
  return true;
}

export async function getExhibitionBoothUpgradeHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = mysql.createPool(databaseUrl);
  try {
    const tables = await tableState(pool);
    const protectedCounts = await protectedSnapshot(pool);
    const [counts] =
      tables.missing.length === 0
        ? await pool.query<RowDataPacket[]>(`SELECT
          (SELECT COUNT(*) FROM exhibition_events) AS eventCount,
          (SELECT COUNT(*) FROM exhibition_booths) AS boothCount,
          (SELECT COUNT(*) FROM exhibition_accounts) AS accountCount,
          (SELECT COUNT(*) FROM exhibition_brand_profiles) AS profileCount,
          (SELECT COUNT(*) FROM exhibition_booth_assignments) AS assignmentCount,
          (SELECT COUNT(*) FROM exhibition_brand_assets) AS assetCount`)
        : [[] as unknown as RowDataPacket];
    const [runs] = tables.existing.includes("exhibition_booth_upgrade_runs")
      ? await pool.query<RowDataPacket[]>(
          "SELECT status,completedAt,details,errorMessage FROM exhibition_booth_upgrade_runs WHERE recoveryKey=? LIMIT 1",
          [UPGRADE_KEY]
        )
      : [[] as unknown as RowDataPacket];
    const runDetails =
      typeof runs[0]?.details === "string"
        ? JSON.parse(runs[0].details)
        : runs[0]?.details || {};
    return {
      healthy:
        tables.missing.length === 0 &&
        Number(counts[0]?.boothCount || 0) ===
          EXHIBITION_BOOTH_DEFINITIONS.length &&
        runs[0]?.status === "success" &&
        runDetails.privateStorageVerified === true,
      recoveryKey: UPGRADE_KEY,
      missingTables: tables.missing,
      counts: counts[0] || {},
      protectedCounts,
      recoveryRun: runs[0] || null,
      privateStorageVerified: runDetails.privateStorageVerified === true,
    };
  } finally {
    await pool.end();
  }
}

export async function runExhibitionBoothUpgradeSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for exhibition booth upgrade");
  const pool = mysql.createPool(databaseUrl);
  let lockConnection: PoolConnection | null = null;
  let lockAcquired = false;
  try {
    lockConnection = await pool.getConnection();
    const [lockRows] = await lockConnection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?,60) AS acquired",
      [UPGRADE_LOCK_NAME]
    );
    lockAcquired = Number(lockRows[0]?.acquired || 0) === 1;
    if (!lockAcquired)
      throw new Error("could not acquire exhibition booth upgrade lock");

    const beforeTables = await tableState(pool);
    const beforeProtected = await protectedSnapshot(pool);
    const [existingEvent] = beforeTables.existing.includes("exhibition_events")
      ? await pool.query<RowDataPacket[]>(
          "SELECT id FROM exhibition_events WHERE slug=? LIMIT 1",
          [EXHIBITION_EVENT_SLUG]
        )
      : [[] as unknown as RowDataPacket];
    const [existingBooths] =
      beforeTables.existing.includes("exhibition_booths") && existingEvent[0]
        ? await pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) AS count FROM exhibition_booths WHERE eventId=?",
            [existingEvent[0].id]
          )
        : [[] as unknown as RowDataPacket];
    const [existingRuns] = beforeTables.existing.includes(
      "exhibition_booth_upgrade_runs"
    )
      ? await pool.query<RowDataPacket[]>(
          "SELECT status FROM exhibition_booth_upgrade_runs WHERE recoveryKey=? LIMIT 1",
          [UPGRADE_KEY]
        )
      : [[] as unknown as RowDataPacket];
    const schemaHealthy =
      beforeTables.missing.length === 0 &&
      Boolean(existingEvent[0]) &&
      Number(existingBooths[0]?.count || 0) ===
        EXHIBITION_BOOTH_DEFINITIONS.length &&
      existingRuns[0]?.status === "success";
    if (schemaHealthy) {
      console.log("[ExhibitionBoothUpgrade] schema healthy");
      return;
    }

    // No exhibition DDL is allowed before this verified backup completes.
    const preBackupId = await verifiedBackup(pool, PRE_BACKUP_REASON);
    await ensureRunTable(pool);
    await pool.query(
      `INSERT INTO exhibition_booth_upgrade_runs (recoveryKey,status,startedAt,details)
       VALUES (?,'running',CURRENT_TIMESTAMP,?)
       ON DUPLICATE KEY UPDATE status='running',startedAt=CURRENT_TIMESTAMP,completedAt=NULL,details=VALUES(details),errorMessage=NULL`,
      [
        UPGRADE_KEY,
        JSON.stringify({
          beforeTables,
          beforeProtected,
          preBackupId,
          existingTablesWillBeModified: false,
        }),
      ]
    );
    await createTables(pool);
    await seedInitialEvent(pool);
    const privateStorageVerified = await verifyPrivateAssetStorage();
    const afterTables = await tableState(pool);
    if (afterTables.missing.length)
      throw new Error(`missing tables: ${afterTables.missing.join(",")}`);
    const afterProtected = await protectedSnapshot(pool);
    for (const key of Object.keys(beforeProtected) as Array<
      keyof typeof beforeProtected
    >) {
      if (beforeProtected[key] !== afterProtected[key]) {
        throw new Error(
          `${key} changed during exhibition schema upgrade: ${beforeProtected[key]}->${afterProtected[key]}`
        );
      }
    }
    const postBackupId = await verifiedBackup(pool, POST_BACKUP_REASON);
    const details = {
      beforeTables,
      afterTables,
      beforeProtected,
      afterProtected,
      preBackupId,
      postBackupId,
      privateStorageVerified,
      existingRowsModified: 0,
    };
    await pool.query(
      "UPDATE exhibition_booth_upgrade_runs SET status='success',completedAt=CURRENT_TIMESTAMP,details=?,errorMessage=NULL WHERE recoveryKey=?",
      [JSON.stringify(details), UPGRADE_KEY]
    );
    console.log(`[ExhibitionBoothUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool
      .query(
        "UPDATE exhibition_booth_upgrade_runs SET status='failed',completedAt=CURRENT_TIMESTAMP,errorMessage=? WHERE recoveryKey=?",
        [message.slice(0, 4000), UPGRADE_KEY]
      )
      .catch(() => undefined);
    throw error;
  } finally {
    if (lockAcquired && lockConnection) {
      await lockConnection
        .query("SELECT RELEASE_LOCK(?) AS released", [UPGRADE_LOCK_NAME])
        .catch(() => undefined);
    }
    lockConnection?.release();
    await pool.end();
  }
}
