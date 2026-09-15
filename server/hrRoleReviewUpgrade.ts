import mysql, { type Pool } from "mysql2/promise";

let runtimePool: Pool | null = null;
let ready: Promise<void> | null = null;

export function getHrRoleReviewPool(): Pool {
  if (!runtimePool) {
    const databaseUrl = String(process.env.DATABASE_URL || "");
    if (!databaseUrl) throw new Error("HR_ROLE_DATABASE_URL_MISSING");
    runtimePool = mysql.createPool({ uri: databaseUrl, waitForConnections: true, connectionLimit: 4 });
  }
  return runtimePool;
}

export async function ensureHrRoleReviewSchema(poolOverride?: Pool): Promise<void> {
  if (poolOverride) return createTables(poolOverride);
  if (!ready) {
    ready = createTables(getHrRoleReviewPool()).catch(error => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function createTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS hr_role_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scope ENUM('employee','department') NOT NULL,
    staffId INT NULL,
    department VARCHAR(255) NULL,
    title VARCHAR(255) NOT NULL,
    effectiveMonth VARCHAR(7) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status ENUM('pending_review','active','archived') NOT NULL DEFAULT 'pending_review',
    fileName VARCHAR(512) NOT NULL,
    storageKey VARCHAR(500) NOT NULL,
    mimeType VARCHAR(128) NOT NULL,
    fileSize INT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    extractedText MEDIUMTEXT NOT NULL,
    extractedChars INT NOT NULL DEFAULT 0,
    textTruncated BOOLEAN NOT NULL DEFAULT FALSE,
    extractionStatus VARCHAR(32) NOT NULL DEFAULT 'extracted',
    responsibilities MEDIUMTEXT NULL,
    goalsAndMetrics MEDIUMTEXT NULL,
    risks MEDIUMTEXT NULL,
    supportNeeded MEDIUMTEXT NULL,
    departmentSopContent MEDIUMTEXT NULL,
    createdBy INT NOT NULL,
    approvedBy INT NULL,
    approvedAt TIMESTAMP NULL,
    archivedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_hr_role_document_staff_sha (staffId, sha256),
    UNIQUE KEY unique_hr_role_document_department_sha (scope, department, sha256),
    INDEX idx_hr_role_document_staff_status (staffId, status),
    INDEX idx_hr_role_document_department_status (department, status)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS hr_monthly_role_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staffId INT NOT NULL,
    reviewMonth VARCHAR(7) NOT NULL,
    roleDocumentId INT NULL,
    focusGoals MEDIUMTEXT NULL,
    achievements MEDIUMTEXT NULL,
    metricsResult MEDIUMTEXT NULL,
    incompleteItems MEDIUMTEXT NULL,
    problemsAndRisks MEDIUMTEXT NULL,
    supportNeeded MEDIUMTEXT NULL,
    nextMonthPlan MEDIUMTEXT NULL,
    status ENUM('draft','submitted','approved','revision_requested') NOT NULL DEFAULT 'draft',
    submittedBy INT NULL,
    submittedAt TIMESTAMP NULL,
    reviewedBy INT NULL,
    reviewedAt TIMESTAMP NULL,
    reviewComment TEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_hr_monthly_role_review (staffId, reviewMonth),
    INDEX idx_hr_monthly_review_month_status (reviewMonth, status)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS hr_role_review_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entityType ENUM('role_document','monthly_review') NOT NULL,
    entityId INT NOT NULL,
    staffId INT NULL,
    action VARCHAR(64) NOT NULL,
    beforeStatus VARCHAR(32) NULL,
    afterStatus VARCHAR(32) NULL,
    actorId INT NOT NULL,
    actorName VARCHAR(255) NOT NULL,
    reason TEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_role_review_audit_entity (entityType, entityId),
    INDEX idx_hr_role_review_audit_staff (staffId)
  )`);
}
