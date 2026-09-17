import { sql } from "drizzle-orm";
import type { getDb } from "./db";

export type PerformanceDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let setupPromise: Promise<void> | null = null;

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS performance_system_settings (
    id INT NOT NULL PRIMARY KEY DEFAULT 1,
    mode VARCHAR(24) NOT NULL DEFAULT 'shadow',
    effectiveFrom DATE NOT NULL,
    aiCandidatesEnabled BOOLEAN NOT NULL DEFAULT FALSE,
    externalNotificationsEnabled BOOLEAN NOT NULL DEFAULT FALSE,
    impactsBonus BOOLEAN NOT NULL DEFAULT FALSE,
    impactsLcjCoin BOOLEAN NOT NULL DEFAULT FALSE,
    updatedBy INT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS performance_rule_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    versionCode VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'shadow',
    mode VARCHAR(24) NOT NULL DEFAULT 'shadow',
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    sourceHash VARCHAR(64) NOT NULL,
    approvedBy INT NULL,
    approvedAt TIMESTAMP NULL,
    createdBy INT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_rule_version_code (versionCode),
    KEY idx_performance_rule_effective (status, effectiveFrom)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_role_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staffId INT NOT NULL,
    assignmentType VARCHAR(32) NOT NULL,
    roleCode VARCHAR(100) NOT NULL,
    roleName VARCHAR(255) NOT NULL,
    scopeType VARCHAR(32) NOT NULL DEFAULT 'company',
    scopeId VARCHAR(128) NULL,
    scopeLabel VARCHAR(255) NULL,
    reviewerStaffId INT NULL,
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    source VARCHAR(40) NOT NULL DEFAULT 'manual',
    createdBy INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_performance_assignment_staff_effective (staffId, status, effectiveFrom),
    KEY idx_performance_assignment_scope (scopeType, scopeId, status)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    templateCode VARCHAR(64) NOT NULL,
    ruleVersionId INT NOT NULL,
    responsibilityLine VARCHAR(255) NOT NULL,
    roleName VARCHAR(255) NOT NULL,
    triggerCycle VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    defaultDeadline VARCHAR(255) NOT NULL,
    evidenceSource VARCHAR(500) NOT NULL,
    completionCondition TEXT NOT NULL,
    reviewerRole VARCHAR(255) NOT NULL,
    primaryDimension VARCHAR(100) NOT NULL,
    sourceAdapter VARCHAR(64) NOT NULL DEFAULT 'manual',
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    sourceHash VARCHAR(64) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_template_code_version (templateCode, ruleVersionId),
    KEY idx_performance_template_status_adapter (status, sourceAdapter)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_item_instances (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evidenceKey VARCHAR(384) NOT NULL,
    templateId INT NOT NULL,
    staffId INT NOT NULL,
    reviewerStaffId INT NULL,
    businessDate DATE NOT NULL,
    dueAt DATETIME NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    completedAt DATETIME NULL,
    isOnTime BOOLEAN NULL,
    sourceType VARCHAR(64) NOT NULL,
    sourceId VARCHAR(128) NOT NULL,
    primaryDimension VARCHAR(64) NOT NULL,
    dataQuality VARCHAR(32) NOT NULL DEFAULT 'verified',
    ruleVersionId INT NOT NULL,
    lastObservedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_item_evidence (evidenceKey),
    KEY idx_performance_item_staff_date (staffId, businessDate, status),
    KEY idx_performance_item_reviewer (reviewerStaffId, status, businessDate)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_evidence_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    itemId BIGINT NOT NULL,
    sourceType VARCHAR(64) NOT NULL,
    sourceId VARCHAR(128) NOT NULL,
    summaryJson JSON NOT NULL,
    contentHash VARCHAR(64) NOT NULL,
    observedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_evidence_item_hash (itemId, contentHash),
    KEY idx_performance_evidence_source (sourceType, sourceId)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_score_candidates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    itemId BIGINT NULL,
    staffId INT NOT NULL,
    dimension VARCHAR(64) NOT NULL,
    recommendedPoints DECIMAL(8,2) NOT NULL,
    candidateType VARCHAR(24) NOT NULL,
    confidence DECIMAL(5,4) NULL,
    reason TEXT NOT NULL,
    citationsJson JSON NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_performance_candidate_staff_status (staffId, status, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_review_decisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidateId BIGINT NOT NULL,
    reviewerStaffId INT NOT NULL,
    decision VARCHAR(32) NOT NULL,
    finalPoints DECIMAL(8,2) NULL,
    reason TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_performance_review_candidate (candidateId, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ledgerKey VARCHAR(384) NOT NULL,
    staffId INT NOT NULL,
    yearMonth VARCHAR(7) NOT NULL,
    dimension VARCHAR(64) NOT NULL,
    points DECIMAL(8,2) NOT NULL,
    mode VARCHAR(24) NOT NULL DEFAULT 'shadow',
    evidenceKey VARCHAR(384) NULL,
    reviewDecisionId BIGINT NULL,
    reversalOfLedgerId BIGINT NULL,
    reason TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_ledger_key (ledgerKey),
    KEY idx_performance_ledger_staff_month (staffId, yearMonth, mode)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_reminders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reminderKey VARCHAR(384) NOT NULL,
    itemId BIGINT NOT NULL,
    level VARCHAR(32) NOT NULL,
    channel VARCHAR(24) NOT NULL DEFAULT 'in_app',
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    remediateBy DATETIME NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closedAt DATETIME NULL,
    UNIQUE KEY uk_performance_reminder_key (reminderKey),
    KEY idx_performance_reminder_item (itemId, status)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_exceptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staffId INT NOT NULL,
    templateId INT NULL,
    exceptionType VARCHAR(40) NOT NULL,
    reason TEXT NOT NULL,
    startsAt DATETIME NOT NULL,
    endsAt DATETIME NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'approved',
    approvedByStaffId INT NULL,
    createdBy INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_performance_exception_staff_range (staffId, startsAt, endsAt, status)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_appeals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staffId INT NOT NULL,
    candidateId BIGINT NULL,
    ledgerId BIGINT NULL,
    statement TEXT NOT NULL,
    attachmentsJson JSON NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    firstReviewerStaffId INT NULL,
    secondReviewerStaffId INT NULL,
    resolution TEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvedAt DATETIME NULL,
    KEY idx_performance_appeal_staff_status (staffId, status, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_monthly_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    staffId INT NOT NULL,
    yearMonth VARCHAR(7) NOT NULL,
    ruleVersionId INT NOT NULL,
    dimensionScoresJson JSON NOT NULL,
    applicableMaximum DECIMAL(8,2) NOT NULL,
    shadowScore DECIMAL(8,2) NOT NULL,
    dataCompleteness DECIMAL(5,4) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    lockedAt DATETIME NULL,
    lockedByStaffId INT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_monthly_staff (staffId, yearMonth),
    KEY idx_performance_monthly_status (yearMonth, status)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    requestId VARCHAR(128) NOT NULL,
    actorUserId INT NOT NULL,
    actorStaffId INT NULL,
    entityType VARCHAR(48) NOT NULL,
    entityId VARCHAR(128) NOT NULL,
    action VARCHAR(80) NOT NULL,
    beforeState JSON NULL,
    afterState JSON NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_performance_audit_request (requestId),
    KEY idx_performance_audit_entity (entityType, entityId, createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS performance_reconciliation_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runKey VARCHAR(128) NOT NULL,
    mode VARCHAR(24) NOT NULL DEFAULT 'shadow',
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finishedAt DATETIME NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'running',
    countersJson JSON NOT NULL,
    errorMessage TEXT NULL,
    UNIQUE KEY uk_performance_reconciliation_run (runKey)
  )`,
] as const;

export async function ensurePerformanceTables(
  db: PerformanceDatabase,
  effectiveFrom: string,
): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      for (const statement of CREATE_TABLES) {
        await db.execute(sql.raw(statement));
      }
      await db.execute(sql`
        INSERT IGNORE INTO performance_system_settings (
          id, mode, effectiveFrom, aiCandidatesEnabled,
          externalNotificationsEnabled, impactsBonus, impactsLcjCoin
        ) VALUES (1, 'shadow', ${effectiveFrom}, FALSE, FALSE, FALSE, FALSE)
      `);
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

export function resetPerformanceTableSetupForTests(): void {
  setupPromise = null;
}
