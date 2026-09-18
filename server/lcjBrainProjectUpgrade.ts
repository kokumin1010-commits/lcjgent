import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  buildReusableProjectMilestones,
  buildReusableSopTemplateContent,
  sopContentToMarkdown,
} from "../shared/lcjBrainProjectSop";

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

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

async function backfillArchivedSopTemplates(
  connection: PoolConnection
): Promise<void> {
  const [projects] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM lcj_brain_projects WHERE status='archived' ORDER BY id"
  );
  for (const project of projects) {
    const [sopRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1",
      [project.id]
    );
    const sop = sopRows[0];
    if (!sop) {
      const [auditRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM lcj_brain_project_audit_logs WHERE projectId=? AND action='sop_template_backfill_skipped_no_sop' LIMIT 1",
        [project.id]
      );
      if (!auditRows[0])
        await connection.query(
          `INSERT INTO lcj_brain_project_audit_logs
           (projectId,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
           VALUES (?,'sop_template',NULL,'sop_template_backfill_skipped_no_sop',NULL,NULL,0,'system-backfill','既存归档项目没有SOP，未生成可复用模板')`,
          [project.id]
        );
      continue;
    }
    const structuredTemplate = buildReusableSopTemplateContent(
      parseJson(sop.structuredContent, {})
    );
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT IGNORE INTO lcj_brain_project_sop_templates
       (templateCode,sourceProjectId,sourceProjectCode,sourceProjectName,sourceSopVersionId,sourceSopVersion,title,description,projectType,objectiveTemplate,scopeTemplate,keywordDefaults,currentPhaseTemplate,milestonesTemplate,autoCollectMode,structuredTemplate,markdownTemplate,status,revision,createdBy,createdByName)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',1,?,?)`,
      [
        `TPL-${project.projectCode}-R1`,
        Number(project.id),
        String(project.projectCode),
        String(project.name),
        Number(sop.id),
        Number(sop.version),
        `${String(project.name)} SOP模板`,
        project.description || null,
        project.projectType,
        project.objective || null,
        project.scope || null,
        JSON.stringify(parseJson(project.keywords, [])),
        project.currentPhase || null,
        JSON.stringify(
          buildReusableProjectMilestones(parseJson(project.milestones, []))
        ),
        project.autoCollectMode,
        JSON.stringify(structuredTemplate),
        sopContentToMarkdown(structuredTemplate),
        0,
        "system-backfill",
      ]
    );
    if (result.affectedRows === 1) {
      await connection.query(
        `INSERT INTO lcj_brain_project_audit_logs
         (projectId,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
         VALUES (?,'sop_template',?,'sop_template_backfilled',NULL,?,?,?,'既存归档项目的最新SOP自动生成可复用模板')`,
        [
          Number(project.id),
          Number(result.insertId),
          JSON.stringify({
            sourceSopVersionId: Number(sop.id),
            sourceSopVersion: Number(sop.version),
            revision: 1,
          }),
          0,
          "system-backfill",
        ]
      );
    }
  }
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

    await connection.query(`CREATE TABLE IF NOT EXISTS lcj_brain_project_sop_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateCode VARCHAR(96) NOT NULL UNIQUE,
      sourceProjectId INT NOT NULL,
      sourceProjectCode VARCHAR(64) NOT NULL,
      sourceProjectName VARCHAR(255) NOT NULL,
      sourceSopVersionId INT NOT NULL,
      sourceSopVersion INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      projectType ENUM('event','project','campaign','other') NOT NULL DEFAULT 'project',
      objectiveTemplate TEXT NULL,
      scopeTemplate TEXT NULL,
      keywordDefaults JSON NOT NULL,
      currentPhaseTemplate VARCHAR(255) NULL,
      milestonesTemplate JSON NOT NULL,
      autoCollectMode ENUM('strict','member_only') NOT NULL DEFAULT 'strict',
      structuredTemplate JSON NOT NULL,
      markdownTemplate MEDIUMTEXT NOT NULL,
      status ENUM('active','retired') NOT NULL DEFAULT 'active',
      revision INT NOT NULL DEFAULT 1,
      useCount INT NOT NULL DEFAULT 0,
      lastUsedAt DATETIME NULL,
      createdBy INT NOT NULL,
      createdByName VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lcj_brain_sop_template_source (sourceProjectId, revision),
      INDEX idx_lcj_brain_sop_templates_status (status, updatedAt)
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

    await backfillArchivedSopTemplates(connection);
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
