import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

const LOCK_NAME = "lcj_brain_project_sop_v1";
let pool: Pool | null = null;
let upgradePromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

async function createTables(): Promise<void> {
  const db = getPool();
  const connection = await db.getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?, 30) AS acquired",
      [LOCK_NAME]
    );
    locked = Number(lockRows[0]?.acquired) === 1;
    if (!locked) throw new Error("LCJ_BRAIN_PROJECT_UPGRADE_LOCK_TIMEOUT");

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectCode VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      projectType ENUM('event','project','campaign','other') NOT NULL DEFAULT 'project',
      description TEXT NULL,
      objective TEXT NULL,
      scope TEXT NULL,
      status ENUM('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
      startDate VARCHAR(10) NOT NULL,
      endDate VARCHAR(10) NULL,
      ownerUserId INT NOT NULL,
      ownerName VARCHAR(255) NOT NULL,
      memberUserIds JSON NOT NULL,
      memberStaffIds JSON NOT NULL,
      keywords JSON NOT NULL,
      currentPhase VARCHAR(255) NULL,
      milestones JSON NULL,
      autoCollectEnabled TINYINT(1) NOT NULL DEFAULT 1,
      autoCollectMode ENUM('strict','member_only') NOT NULL DEFAULT 'strict',
      version INT NOT NULL DEFAULT 1,
      lastAutoCollectedDate VARCHAR(10) NULL,
      completedAt DATETIME NULL,
      createdBy INT NOT NULL,
      createdByName VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lcj_brain_projects_status (status),
      INDEX idx_lcj_brain_projects_owner (ownerUserId),
      INDEX idx_lcj_brain_projects_dates (startDate, endDate)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectId INT NOT NULL,
      sourceType ENUM('meeting','daily_report','task','issue','knowledge','file','note','decision') NOT NULL,
      sourceId VARCHAR(128) NULL,
      sourceKey VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      summary TEXT NULL,
      content MEDIUMTEXT NOT NULL,
      occurredAt DATETIME NOT NULL,
      sourceUrl TEXT NULL,
      storageKey VARCHAR(500) NULL,
      fileName VARCHAR(500) NULL,
      mimeType VARCHAR(128) NULL,
      fileSize INT NULL,
      sha256 VARCHAR(64) NULL,
      contributorUserId INT NULL,
      contributorName VARCHAR(255) NULL,
      matchedBy ENUM('manual','keyword','member_keyword','direct_link','system') NOT NULL DEFAULT 'manual',
      matchReason TEXT NULL,
      excluded TINYINT(1) NOT NULL DEFAULT 0,
      excludedAt DATETIME NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcj_brain_project_source (projectId, sourceKey),
      INDEX idx_lcj_brain_project_sources_time (projectId, occurredAt),
      INDEX idx_lcj_brain_project_sources_type (projectId, sourceType)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_daily_summaries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectId INT NOT NULL,
      summaryDate VARCHAR(10) NOT NULL,
      status ENUM('generated','failed','manual') NOT NULL DEFAULT 'generated',
      summary TEXT NOT NULL,
      completedItems JSON NOT NULL,
      decisions JSON NOT NULL,
      issues JSON NOT NULL,
      risks JSON NOT NULL,
      nextActions JSON NOT NULL,
      gaps JSON NOT NULL,
      sourceIds JSON NOT NULL,
      model VARCHAR(100) NULL,
      generatedBy INT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcj_brain_project_daily_summary (projectId, summaryDate)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_sop_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectId INT NOT NULL,
      version INT NOT NULL,
      status ENUM('draft','final') NOT NULL DEFAULT 'draft',
      title VARCHAR(500) NOT NULL,
      structuredContent JSON NOT NULL,
      markdown MEDIUMTEXT NOT NULL,
      sourceIds JSON NOT NULL,
      model VARCHAR(100) NULL,
      promptVersion VARCHAR(50) NOT NULL,
      generatedBy INT NOT NULL,
      generatedByName VARCHAR(255) NOT NULL,
      reason TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcj_brain_project_sop_version (projectId, version)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectId INT NULL,
      runKey VARCHAR(255) NOT NULL UNIQUE,
      runType ENUM('daily_scan','daily_summary','sop_draft','sop_final','source_ingest') NOT NULL,
      status ENUM('running','success','failed','skipped') NOT NULL DEFAULT 'running',
      sourceCount INT NOT NULL DEFAULT 0,
      outputId INT NULL,
      model VARCHAR(100) NULL,
      errorCode VARCHAR(100) NULL,
      errorMessage TEXT NULL,
      durationMs INT NULL,
      startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lcj_brain_project_runs_project (projectId, startedAt)
    )`);

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      projectId INT NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId INT NULL,
      action VARCHAR(64) NOT NULL,
      beforeJson JSON NULL,
      afterJson JSON NULL,
      actorId INT NOT NULL,
      actorName VARCHAR(255) NOT NULL,
      reason TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lcj_brain_project_audit (projectId, createdAt)
    )`);
  } finally {
    if (locked)
      await connection
        .query("SELECT RELEASE_LOCK(?)", [LOCK_NAME])
        .catch(() => undefined);
    connection.release();
  }
}

export function startLcjBrainProjectUpgrade(): Promise<void> {
  if (!upgradePromise) {
    upgradePromise = createTables().catch(error => {
      upgradePromise = null;
      throw error;
    });
  }
  return upgradePromise;
}

export async function ensureLcjBrainProjectUpgrade(): Promise<void> {
  await startLcjBrainProjectUpgrade();
}
