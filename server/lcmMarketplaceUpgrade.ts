import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const UPGRADE_KEY = "lcm-marketplace-v3-engagement-reviews";
const PRE_BACKUP_REASON = "pre-lcm-marketplace-v3-engagement-reviews";
const POST_BACKUP_REASON = "post-lcm-marketplace-v3-engagement-reviews";
const REQUIRED_TABLES = [
  "lcm_memberships",
  "lcm_creator_profiles",
  "lcm_brand_profiles",
  "lcm_brand_members",
  "lcm_products",
  "lcm_sample_requests",
  "lcm_wholesale_inquiries",
  "lcm_product_interests",
  "lcm_sample_cart_items",
  "lcm_brand_event_participations",
  "lcm_product_reviews",
  "lcm_review_reports",
  "lcm_audit_logs",
] as const;
const ADDITIVE_ENGAGEMENT_TABLES = [
  "lcm_product_interests",
  "lcm_sample_cart_items",
  "lcm_brand_event_participations",
  "lcm_product_reviews",
  "lcm_review_reports",
] as const;
const REQUIRED_PRODUCT_COLUMNS = {
  thirtySecondPitch: "TEXT NULL",
  demoInstructions: "TEXT NULL",
  targetAudience: "TEXT NULL",
  prohibitedClaims: "TEXT NULL",
} as const;

async function ensureUpgradeTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_marketplace_upgrade_runs (
      recoveryKey VARCHAR(64) PRIMARY KEY,
      status ENUM('running','success','failed') NOT NULL,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      details JSON NULL,
      errorMessage TEXT NULL
    )
  `);
}

async function getTableState(pool: Pool): Promise<{ existing: string[]; missing: string[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})`,
    [...REQUIRED_TABLES],
  );
  const existing = rows.map((row) => String(row.tableName));
  return { existing, missing: REQUIRED_TABLES.filter((table) => !existing.includes(table)) };
}

async function getMissingProductColumns(pool: Pool): Promise<string[]> {
  const names = Object.keys(REQUIRED_PRODUCT_COLUMNS);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'lcm_products'
        AND COLUMN_NAME IN (${names.map(() => "?").join(",")})`,
    names,
  );
  const existing = new Set(rows.map((row) => String(row.columnName)));
  return names.filter((name) => !existing.has(name));
}

async function ensureProductLiveCommerceColumns(pool: Pool): Promise<string[]> {
  const missing = await getMissingProductColumns(pool);
  for (const name of missing) {
    const definition = REQUIRED_PRODUCT_COLUMNS[name as keyof typeof REQUIRED_PRODUCT_COLUMNS];
    await pool.query(`ALTER TABLE lcm_products ADD COLUMN \`${name}\` ${definition} AFTER highlights`);
  }
  return missing;
}

async function getCounts(pool: Pool): Promise<Record<string, number>> {
  const tables = await getTableState(pool);
  const counts: Record<string, number> = {};
  for (const table of REQUIRED_TABLES) {
    if (!tables.existing.includes(table)) {
      counts[table] = 0;
      continue;
    }
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    counts[table] = Number(rows[0]?.count || 0);
  }
  return counts;
}

async function latestBackupId(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM db_backup_runs");
  return Number(rows[0]?.id || 0);
}

async function runVerifiedBackup(pool: Pool, reason: string): Promise<number> {
  const beforeId = await latestBackupId(pool);
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, status, errorMessage
       FROM db_backup_runs
      WHERE id > ? AND reason = ?
      ORDER BY id DESC
      LIMIT 1`,
    [beforeId, reason],
  );
  const row = rows[0];
  if (!row) throw new Error(`verified backup row missing: ${reason}`);
  if (String(row.status) !== "success") {
    throw new Error(`verified backup failed: ${reason}: ${String(row.errorMessage || "unknown")}`);
  }
  return Number(row.id);
}

async function createCreatorProfilesTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_creator_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      festivalAccountId INT NOT NULL,
      sourceFestivalApplicationId INT NULL,
      slug VARCHAR(180) NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      profileImageUrl TEXT NULL,
      profileImageKey VARCHAR(512) NULL,
      coverImageUrl TEXT NULL,
      coverImageKey VARCHAR(512) NULL,
      bio TEXT NULL,
      categories JSON NULL,
      supportsLive TINYINT(1) NOT NULL DEFAULT 0,
      supportsShortVideo TINYINT(1) NOT NULL DEFAULT 0,
      languages JSON NULL,
      activityRegions JSON NULL,
      agencyName VARCHAR(255) NULL,
      tiktokUrl VARCHAR(1000) NULL,
      instagramUrl VARCHAR(1000) NULL,
      youtubeUrl VARCHAR(1000) NULL,
      portfolioUrls JSON NULL,
      followerRange ENUM('not_disclosed','under_1k','1k_10k','10k_50k','50k_100k','100k_500k','500k_plus') NOT NULL DEFAULT 'not_disclosed',
      averageViewRange ENUM('not_disclosed','under_50','50_200','200_500','500_1000','1000_plus') NOT NULL DEFAULT 'not_disclosed',
      performanceSummary TEXT NULL,
      metricsVerification ENUM('not_submitted','self_reported','evidence_submitted','verified') NOT NULL DEFAULT 'not_submitted',
      metricsAsOf TIMESTAMP NULL,
      availabilityNote TEXT NULL,
      acceptingOffers TINYINT(1) NOT NULL DEFAULT 1,
      publicConsentAt TIMESTAMP NULL,
      status ENUM('draft','submitted','published','rejected','suspended','archived') NOT NULL DEFAULT 'draft',
      submittedAt TIMESTAMP NULL,
      publishedAt TIMESTAMP NULL,
      reviewedBy INT NULL,
      reviewedAt TIMESTAMP NULL,
      rejectionReason TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_creator_account (festivalAccountId),
      UNIQUE KEY uq_lcm_creator_slug (slug),
      INDEX idx_lcm_creator_public (status, acceptingOffers, publishedAt),
      INDEX idx_lcm_creator_source (sourceFestivalApplicationId)
    )
  `);
}

async function createLcmTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_memberships (
      id INT AUTO_INCREMENT PRIMARY KEY,
      festivalAccountId INT NOT NULL,
      memberType ENUM('company','liver','agency','buyer') NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      businessName VARCHAR(255) NULL,
      status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
      termsVersion VARCHAR(32) NOT NULL,
      agreedAt TIMESTAMP NOT NULL,
      reviewedBy INT NULL,
      reviewedAt TIMESTAMP NULL,
      reviewNote TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_membership_account (festivalAccountId),
      INDEX idx_lcm_membership_status (status, updatedAt)
    )
  `);
  await createCreatorProfilesTable(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_brand_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(180) NOT NULL,
      sourceBrandId INT NULL,
      sourceFestivalApplicationId INT NULL,
      sourceCatalogPage INT NULL,
      displayName VARCHAR(255) NOT NULL,
      companyName VARCHAR(255) NULL,
      category VARCHAR(120) NULL,
      tagline VARCHAR(500) NULL,
      description TEXT NULL,
      story TEXT NULL,
      logoUrl TEXT NULL,
      logoKey VARCHAR(512) NULL,
      coverUrl TEXT NULL,
      coverKey VARCHAR(512) NULL,
      officialWebsiteUrl VARCHAR(1000) NULL,
      tiktokShopUrl VARCHAR(1000) NULL,
      amazonUrl VARCHAR(1000) NULL,
      rakutenUrl VARCHAR(1000) NULL,
      otherSalesUrl VARCHAR(1000) NULL,
      status ENUM('draft','submitted','published','rejected','suspended','archived') NOT NULL DEFAULT 'draft',
      claimStatus ENUM('unclaimed','pending','claimed') NOT NULL DEFAULT 'unclaimed',
      createdByAccountId INT NULL,
      submittedAt TIMESTAMP NULL,
      publishedAt TIMESTAMP NULL,
      reviewedBy INT NULL,
      reviewedAt TIMESTAMP NULL,
      rejectionReason TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_brand_slug (slug),
      UNIQUE KEY uq_lcm_brand_catalog_page (sourceCatalogPage),
      INDEX idx_lcm_brand_public (status, category, publishedAt),
      INDEX idx_lcm_brand_source (sourceBrandId, sourceFestivalApplicationId)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_brand_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandProfileId INT NOT NULL,
      festivalAccountId INT NOT NULL,
      role ENUM('owner','editor') NOT NULL DEFAULT 'owner',
      status ENUM('pending','active','rejected','revoked') NOT NULL DEFAULT 'pending',
      approvedBy INT NULL,
      approvedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_brand_member (brandProfileId, festivalAccountId),
      INDEX idx_lcm_brand_member_account (festivalAccountId, status)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandProfileId INT NOT NULL,
      slug VARCHAR(220) NOT NULL,
      sku VARCHAR(120) NULL,
      name VARCHAR(500) NOT NULL,
      category VARCHAR(120) NULL,
      summary VARCHAR(1000) NULL,
      description TEXT NULL,
      highlights JSON NULL,
      thirtySecondPitch TEXT NULL,
      demoInstructions TEXT NULL,
      targetAudience TEXT NULL,
      prohibitedClaims TEXT NULL,
      relatedProductsText TEXT NULL,
      listPrice DECIMAL(12,2) NULL,
      currency VARCHAR(16) NOT NULL DEFAULT 'JPY',
      taxMode ENUM('included','excluded','unknown') NOT NULL DEFAULT 'unknown',
      wholesalePrice DECIMAL(12,2) NULL,
      wholesaleMinQuantity INT NULL,
      wholesaleShippingTerms TEXT NULL,
      wholesalePaymentTerms TEXT NULL,
      wholesaleValidUntil TIMESTAMP NULL,
      commissionRate VARCHAR(50) NULL,
      sampleAvailable TINYINT(1) NOT NULL DEFAULT 0,
      sampleMonthlyLimit INT NULL,
      sampleInstructions TEXT NULL,
      stockDisclosure ENUM('hidden','range','exact') NOT NULL DEFAULT 'hidden',
      stockQuantity INT NULL,
      primaryImageUrl TEXT NULL,
      imageUrls JSON NULL,
      imageKeys JSON NULL,
      officialProductUrl VARCHAR(1000) NULL,
      tiktokShopUrl VARCHAR(1000) NULL,
      amazonUrl VARCHAR(1000) NULL,
      rakutenUrl VARCHAR(1000) NULL,
      status ENUM('draft','submitted','published','rejected','suspended','archived') NOT NULL DEFAULT 'draft',
      sourceKind ENUM('brand','lcf_catalog','admin') NOT NULL DEFAULT 'brand',
      sourceReference VARCHAR(255) NULL,
      createdByAccountId INT NULL,
      submittedAt TIMESTAMP NULL,
      publishedAt TIMESTAMP NULL,
      reviewedBy INT NULL,
      reviewedAt TIMESTAMP NULL,
      rejectionReason TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_product_slug (slug),
      UNIQUE KEY uq_lcm_product_source (sourceKind, sourceReference),
      INDEX idx_lcm_product_public (status, category, publishedAt),
      INDEX idx_lcm_product_brand (brandProfileId, status, updatedAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_sample_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      requestCode VARCHAR(32) NOT NULL,
      productId INT NOT NULL,
      brandProfileId INT NOT NULL,
      requesterAccountId INT NOT NULL,
      purpose TEXT NOT NULL,
      plannedContentType ENUM('live','short_video','both','other') NOT NULL,
      plannedDate TIMESTAMP NULL,
      message TEXT NULL,
      recipientName VARCHAR(255) NOT NULL,
      postalCode VARCHAR(20) NOT NULL,
      address TEXT NOT NULL,
      phone VARCHAR(50) NOT NULL,
      status ENUM('pending','approved','rejected','preparing','shipped','delivered','live_scheduled','completed','cancelled') NOT NULL DEFAULT 'pending',
      brandReply TEXT NULL,
      trackingCarrier VARCHAR(100) NULL,
      trackingNumber VARCHAR(255) NULL,
      reviewedByAccountId INT NULL,
      reviewedAt TIMESTAMP NULL,
      shippedAt TIMESTAMP NULL,
      deliveredAt TIMESTAMP NULL,
      liveUrl VARCHAR(1000) NULL,
      completedAt TIMESTAMP NULL,
      cancelledAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_sample_code (requestCode),
      INDEX idx_lcm_sample_requester (requesterAccountId, status, updatedAt),
      INDEX idx_lcm_sample_brand (brandProfileId, status, updatedAt),
      INDEX idx_lcm_sample_product (productId, requesterAccountId, status)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_wholesale_inquiries (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      inquiryCode VARCHAR(32) NOT NULL,
      productId INT NOT NULL,
      brandProfileId INT NOT NULL,
      requesterAccountId INT NOT NULL,
      requestedQuantity INT NOT NULL,
      intendedUse TEXT NOT NULL,
      requestedStartDate TIMESTAMP NULL,
      message TEXT NULL,
      status ENUM('requested','reviewing','accepted','declined','negotiating','completed','cancelled') NOT NULL DEFAULT 'requested',
      brandReply TEXT NULL,
      negotiatedTerms TEXT NULL,
      reviewedByAccountId INT NULL,
      reviewedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      cancelledAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_inquiry_code (inquiryCode),
      INDEX idx_lcm_inquiry_requester (requesterAccountId, status, updatedAt),
      INDEX idx_lcm_inquiry_brand (brandProfileId, status, updatedAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_product_interests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      festivalAccountId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_product_interest (productId, festivalAccountId),
      INDEX idx_lcm_interest_account (festivalAccountId, createdAt),
      INDEX idx_lcm_interest_product (productId, createdAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_sample_cart_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      festivalAccountId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_sample_cart_item (productId, festivalAccountId),
      INDEX idx_lcm_sample_cart_account (festivalAccountId, createdAt),
      INDEX idx_lcm_sample_cart_product (productId, createdAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_brand_event_participations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      brandProfileId INT NOT NULL,
      eventKey VARCHAR(32) NOT NULL,
      eventLabel VARCHAR(120) NOT NULL,
      archivePath VARCHAR(500) NOT NULL,
      verificationSource ENUM('lcf_catalog','festival_application','admin') NOT NULL,
      sourceReference VARCHAR(255) NOT NULL,
      verifiedByAccountId INT NULL,
      verifiedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_brand_event (brandProfileId, eventKey),
      INDEX idx_lcm_event_participation (eventKey, verifiedAt),
      INDEX idx_lcm_event_brand (brandProfileId, verifiedAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_product_reviews (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      brandProfileId INT NOT NULL,
      reviewerAccountId INT NOT NULL,
      rating INT NOT NULL,
      title VARCHAR(120) NOT NULL,
      body TEXT NOT NULL,
      verificationSource ENUM('sample_request','wholesale_inquiry') NOT NULL,
      verificationEntityId BIGINT NOT NULL,
      status ENUM('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
      submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      publishedAt TIMESTAMP NULL,
      moderatedByAccountId INT NULL,
      moderatedAt TIMESTAMP NULL,
      moderationNote TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_product_review (productId, reviewerAccountId),
      INDEX idx_lcm_review_public (productId, status, publishedAt),
      INDEX idx_lcm_review_brand (brandProfileId, status, updatedAt),
      INDEX idx_lcm_review_reviewer (reviewerAccountId, status, updatedAt)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_review_reports (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      reviewId BIGINT NOT NULL,
      reporterAccountId INT NOT NULL,
      reason ENUM('inaccurate','privacy','offensive','conflict','other') NOT NULL,
      details TEXT NULL,
      status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
      reviewedByAccountId INT NULL,
      reviewedAt TIMESTAMP NULL,
      resolutionNote TEXT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcm_review_reporter (reviewId, reporterAccountId),
      INDEX idx_lcm_review_report_status (status, updatedAt),
      INDEX idx_lcm_review_report_review (reviewId, status)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lcm_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      actorAccountId INT NULL,
      actorRole VARCHAR(50) NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId VARCHAR(64) NOT NULL,
      action VARCHAR(100) NOT NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lcm_audit_entity (entityType, entityId, createdAt),
      INDEX idx_lcm_audit_actor (actorAccountId, createdAt)
    )
  `);
}

async function backfillFirstEditionParticipations(pool: Pool): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(`
    INSERT IGNORE INTO lcm_brand_event_participations
      (brandProfileId, eventKey, eventLabel, archivePath, verificationSource, sourceReference, verifiedAt)
    SELECT id,
           '2026-01',
           '第1回LCF 出展実績',
           '/livecommercefestival/2026/exhibitors',
           'lcf_catalog',
           CONCAT('catalog-page-', sourceCatalogPage),
           COALESCE(publishedAt, createdAt, CURRENT_TIMESTAMP)
      FROM lcm_brand_profiles
     WHERE sourceCatalogPage IS NOT NULL
  `);
  return Number(result.affectedRows || 0);
}

export async function runLcmMarketplaceUpgradeSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for LCM marketplace upgrade");
  const pool = mysql.createPool(databaseUrl);
  let lockConnection: PoolConnection | null = null;
  try {
    lockConnection = await pool.getConnection();
    const [lockRows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS acquired", [UPGRADE_KEY]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error("failed to acquire LCM marketplace upgrade lock");
    await ensureUpgradeTable(pool);
    const beforeTables = await getTableState(pool);
    const beforeMissingProductColumns = beforeTables.existing.includes("lcm_products")
      ? await getMissingProductColumns(pool)
      : Object.keys(REQUIRED_PRODUCT_COLUMNS);
    if (beforeTables.missing.length === 0 && beforeMissingProductColumns.length === 0) {
      const participationRowsAdded = await backfillFirstEditionParticipations(pool);
      console.log(`[LcmMarketplaceUpgrade] schema healthy tables=${REQUIRED_TABLES.length} participationRowsAdded=${participationRowsAdded}`);
      return;
    }
    const engagementOnlyUpgrade = beforeTables.missing.every((table) => ADDITIVE_ENGAGEMENT_TABLES.includes(table as typeof ADDITIVE_ENGAGEMENT_TABLES[number]))
      && (beforeTables.missing.length > 0 || beforeMissingProductColumns.length > 0);
    if (engagementOnlyUpgrade) {
      const beforeCounts = await getCounts(pool);
      await pool.query(
        `INSERT INTO lcm_marketplace_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
         VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
         ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
        [UPGRADE_KEY, JSON.stringify({ beforeTables, beforeCounts, beforeMissingProductColumns, additiveOnly: true })],
      );
      await createLcmTables(pool);
      const productColumnsAdded = await ensureProductLiveCommerceColumns(pool);
      const participationRowsAdded = await backfillFirstEditionParticipations(pool);
      const afterTables = await getTableState(pool);
      const afterMissingProductColumns = await getMissingProductColumns(pool);
      if (afterTables.missing.length > 0) throw new Error(`LCM tables still missing: ${afterTables.missing.join(",")}`);
      if (afterMissingProductColumns.length > 0) throw new Error(`LCM product columns still missing: ${afterMissingProductColumns.join(",")}`);
      const afterCounts = await getCounts(pool);
      for (const table of beforeTables.existing) {
        if (afterCounts[table] !== beforeCounts[table]) throw new Error(`${table} count changed during additive upgrade: ${beforeCounts[table]}->${afterCounts[table]}`);
      }
      for (const table of beforeTables.missing) {
        if (table === "lcm_brand_event_participations") continue;
        if (afterCounts[table] !== 0) throw new Error(`${table} was not created empty`);
      }
      const details = { beforeTables, afterTables, beforeCounts, afterCounts, beforeMissingProductColumns, productColumnsAdded, afterMissingProductColumns, participationRowsAdded, existingDataRowsModified: 0, backupSkippedReason: "additive empty tables and nullable columns only" };
      await pool.query(
        `UPDATE lcm_marketplace_upgrade_runs SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL WHERE recoveryKey=?`,
        [JSON.stringify(details), UPGRADE_KEY],
      );
      console.log(`[LcmMarketplaceUpgrade] additive engagement schema success ${JSON.stringify(details)}`);
      return;
    }
    const creatorOnlyUpgrade = beforeMissingProductColumns.length === 0 && beforeTables.missing.length === 1 && beforeTables.missing[0] === "lcm_creator_profiles";
    if (creatorOnlyUpgrade) {
      await pool.query(
        `INSERT INTO lcm_marketplace_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
         VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
         ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
        [UPGRADE_KEY, JSON.stringify({ beforeTables, additiveOnly: true })],
      );
      await createCreatorProfilesTable(pool);
      const afterTables = await getTableState(pool);
      if (afterTables.missing.length > 0) throw new Error(`LCM tables still missing: ${afterTables.missing.join(",")}`);
      const afterCounts = await getCounts(pool);
      if (afterCounts.lcm_creator_profiles !== 0) throw new Error("lcm_creator_profiles was not created empty");
      const details = { beforeTables, afterTables, creatorProfileRows: 0, dataRowsModified: 0, backupSkippedReason: "additive empty table only" };
      await pool.query(
        `UPDATE lcm_marketplace_upgrade_runs SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL WHERE recoveryKey=?`,
        [JSON.stringify(details), UPGRADE_KEY],
      );
      console.log(`[LcmMarketplaceUpgrade] additive creator table success ${JSON.stringify(details)}`);
      return;
    }
    const beforeCounts = await getCounts(pool);
    await pool.query(
      `INSERT INTO lcm_marketplace_upgrade_runs (recoveryKey, status, startedAt, completedAt, details, errorMessage)
       VALUES (?, 'running', CURRENT_TIMESTAMP, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE status='running', startedAt=CURRENT_TIMESTAMP, completedAt=NULL, details=VALUES(details), errorMessage=NULL`,
      [UPGRADE_KEY, JSON.stringify({ beforeTables, beforeCounts, beforeMissingProductColumns, requiredTables: REQUIRED_TABLES })],
    );
    const preBackupId = await runVerifiedBackup(pool, PRE_BACKUP_REASON);
    await createLcmTables(pool);
    const productColumnsAdded = await ensureProductLiveCommerceColumns(pool);
    const participationRowsAdded = await backfillFirstEditionParticipations(pool);
    const afterTables = await getTableState(pool);
    if (afterTables.missing.length > 0) {
      throw new Error(`LCM tables still missing: ${afterTables.missing.join(",")}`);
    }
    const afterMissingProductColumns = await getMissingProductColumns(pool);
    if (afterMissingProductColumns.length > 0) throw new Error(`LCM product columns still missing: ${afterMissingProductColumns.join(",")}`);
    const afterCounts = await getCounts(pool);
    for (const table of beforeTables.existing) {
      if (afterCounts[table] !== beforeCounts[table]) {
        throw new Error(`${table} count changed during schema-only upgrade: ${beforeCounts[table]}->${afterCounts[table]}`);
      }
    }
    for (const table of beforeTables.missing) {
      if (table === "lcm_brand_event_participations") continue;
      if (afterCounts[table] !== 0) throw new Error(`${table} was not created empty`);
    }
    const postBackupId = await runVerifiedBackup(pool, POST_BACKUP_REASON);
    const details = { beforeTables, afterTables, beforeCounts, afterCounts, beforeMissingProductColumns, productColumnsAdded, afterMissingProductColumns, preBackupId, postBackupId, participationRowsAdded, existingDataRowsModified: 0 };
    await pool.query(
      `UPDATE lcm_marketplace_upgrade_runs SET status='success', completedAt=CURRENT_TIMESTAMP, details=?, errorMessage=NULL WHERE recoveryKey=?`,
      [JSON.stringify(details), UPGRADE_KEY],
    );
    console.log(`[LcmMarketplaceUpgrade] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE lcm_marketplace_upgrade_runs SET status='failed', completedAt=CURRENT_TIMESTAMP, errorMessage=? WHERE recoveryKey=?`,
      [message.slice(0, 4000), UPGRADE_KEY],
    ).catch(() => undefined);
    console.error(`[LcmMarketplaceUpgrade] failed ${message}`);
    throw error;
  } finally {
    if (lockConnection) {
      await lockConnection.query("SELECT RELEASE_LOCK(?)", [UPGRADE_KEY]).catch(() => undefined);
      lockConnection.release();
    }
    await pool.end();
  }
}
