import { sql } from "drizzle-orm";
import { getDb } from "./db";

let taskExecutionUpgrade: Promise<void> | null = null;
type TaskExecutionUpgradeState = {
  state: "idle" | "running" | "ready" | "failed";
  step: string | null;
  error: string | null;
  updatedAt: string;
};
let taskExecutionUpgradeState: TaskExecutionUpgradeState = {
  state: "idle",
  step: null,
  error: null,
  updatedAt: new Date().toISOString(),
};

export function getTaskExecutionUpgradeStatus(): TaskExecutionUpgradeState {
  return { ...taskExecutionUpgradeState };
}

function setUpgradeState(state: TaskExecutionUpgradeState["state"], step: string | null, error: string | null = null) {
  taskExecutionUpgradeState = { state, step, error, updatedAt: new Date().toISOString() };
}

function safeUpgradeError(error: unknown): string {
  let current: unknown = error;
  let code = "SCHEMA_UPGRADE_FAILED";
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    const rawCode = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
    if (/^[A-Z0-9_]{1,64}$/.test(rawCode)) {
      code = rawCode;
      break;
    }
    if (typeof candidate.errno === "number" && Number.isSafeInteger(candidate.errno)) {
      code = `MYSQL_${candidate.errno}`;
      break;
    }
    current = candidate.cause;
  }
  const candidate = error as { message?: unknown };
  const message = typeof candidate?.message === "string" ? candidate.message : "Unknown schema upgrade error";
  return `${code}: ${message}`.slice(0, 500);
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return Array.isArray(result) ? result as T[] : [];
}

export function isDuplicateSchemaObject(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { errno?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    const errno = typeof candidate.errno === "number" ? candidate.errno : null;
    const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
    const message = (typeof candidate.message === "string" ? candidate.message : String(current)).toLowerCase();
    if (errno === 1060
      || errno === 1061
      || errno === 1359
      || code === "ER_DUP_FIELDNAME"
      || code === "ER_DUP_KEYNAME"
      || code === "ER_TRG_ALREADY_EXISTS"
      || message.includes("duplicate column")
      || message.includes("duplicate key name")
      || message.includes("already exist")) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export function isOptionalTriggerUnavailable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { errno?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    const errno = typeof candidate.errno === "number" ? candidate.errno : null;
    const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
    const message = (typeof candidate.message === "string" ? candidate.message : String(current)).toLowerCase();
    if (errno === 1227
      || errno === 1235
      || code === "ER_SPECIFIC_ACCESS_DENIED_ERROR"
      || code === "ER_TABLEACCESS_DENIED_ERROR"
      || code === "ER_NOT_SUPPORTED_YET"
      || (message.includes("trigger") && (
        message.includes("not supported")
        || message.includes("unsupported")
        || message.includes("denied")
      ))) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function ensureTaskExecutionTables(): Promise<void> {
  if (!taskExecutionUpgrade) {
    taskExecutionUpgrade = (async () => {
      setUpgradeState("running", "database_connection");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      setUpgradeState("running", "tasks");
      const taskColumns = [
        ["requestId", "ALTER TABLE tasks ADD COLUMN requestId VARCHAR(128) NULL AFTER taskId"],
        ["requiresAcceptance", "ALTER TABLE tasks ADD COLUMN requiresAcceptance BOOLEAN NOT NULL DEFAULT TRUE AFTER requestId"],
        ["archivedAt", "ALTER TABLE tasks ADD COLUMN archivedAt TIMESTAMP NULL AFTER createdBy"],
        ["archivedBy", "ALTER TABLE tasks ADD COLUMN archivedBy INT NULL AFTER archivedAt"],
        ["archiveReason", "ALTER TABLE tasks ADD COLUMN archiveReason TEXT NULL AFTER archivedBy"],
      ] as const;
      for (const [columnName, ddl] of taskColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try {
            await db.execute(sql.raw(ddl));
            if (columnName === "requiresAcceptance") {
              await db.execute(sql`UPDATE tasks SET requiresAcceptance = FALSE WHERE status = 'completed'`);
            }
          } catch (error) {
            if (!isDuplicateSchemaObject(error)) throw error;
          }
        }
      }

      const taskRequestIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM tasks WHERE Key_name = 'uq_tasks_request_id'
      `));
      if (taskRequestIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE UNIQUE INDEX uq_tasks_request_id ON tasks(requestId)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "reports");
      const reportColumns = [
        ["deletedAt", "ALTER TABLE reports ADD COLUMN deletedAt TIMESTAMP NULL AFTER createdBy"],
        ["deletedBy", "ALTER TABLE reports ADD COLUMN deletedBy INT NULL AFTER deletedAt"],
        ["deleteReason", "ALTER TABLE reports ADD COLUMN deleteReason TEXT NULL AFTER deletedBy"],
      ] as const;
      for (const [columnName, ddl] of reportColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try {
            await db.execute(sql.raw(ddl));
          } catch (error) {
            if (!isDuplicateSchemaObject(error)) throw error;
          }
        }
      }
      setUpgradeState("running", "report_attachments");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS report_attachments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reportId INT NOT NULL,
          uploadId VARCHAR(64) NULL,
          contentHash VARCHAR(64) NULL,
          imageUrl TEXT NOT NULL,
          label VARCHAR(50) NOT NULL,
          filename VARCHAR(255),
          archivedAt TIMESTAMP NULL,
          archivedBy INT NULL,
          archiveReason TEXT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_report_id (reportId),
          UNIQUE KEY uq_report_attachments_upload (reportId, uploadId)
        )
      `);
      const attachmentColumns = [
        ["uploadId", "ALTER TABLE report_attachments ADD COLUMN uploadId VARCHAR(64) NULL AFTER reportId"],
        ["contentHash", "ALTER TABLE report_attachments ADD COLUMN contentHash VARCHAR(64) NULL AFTER uploadId"],
        ["archivedAt", "ALTER TABLE report_attachments ADD COLUMN archivedAt TIMESTAMP NULL AFTER filename"],
        ["archivedBy", "ALTER TABLE report_attachments ADD COLUMN archivedBy INT NULL AFTER archivedAt"],
        ["archiveReason", "ALTER TABLE report_attachments ADD COLUMN archiveReason TEXT NULL AFTER archivedBy"],
      ] as const;
      for (const [columnName, ddl] of attachmentColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_attachments' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try {
            await db.execute(sql.raw(ddl));
          } catch (error) {
            if (!isDuplicateSchemaObject(error)) throw error;
          }
        }
      }
      const attachmentUploadIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM report_attachments WHERE Key_name = 'uq_report_attachments_upload'
      `));
      if (attachmentUploadIndexes.length === 0) {
        try {
          await db.execute(sql`
            CREATE UNIQUE INDEX uq_report_attachments_upload
            ON report_attachments(reportId, uploadId)
          `);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "entity_revision_audits");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS entity_revision_audits (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          entityType VARCHAR(40) NOT NULL,
          entityId INT NOT NULL,
          action VARCHAR(64) NOT NULL,
          actorUserId INT NULL,
          beforeState JSON NULL,
          afterState JSON NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_entity_revision_entity (entityType, entityId, id)
        )
      `);

      setUpgradeState("running", "task_creation_requests_table");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS task_creation_requests (
          requestId VARCHAR(128) NOT NULL PRIMARY KEY,
          creatorUserId INT NOT NULL,
          inputHash VARCHAR(64) NOT NULL,
          status ENUM('processing','completed','failed') NOT NULL,
          taskId INT NULL,
          attempts INT NOT NULL DEFAULT 1,
          lastError TEXT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_task_creation_status (status, updatedAt)
        )
      `);
      const taskCreationRequestColumns = [
        ["creatorUserId", "ALTER TABLE task_creation_requests ADD COLUMN creatorUserId INT NOT NULL"],
        ["inputHash", "ALTER TABLE task_creation_requests ADD COLUMN inputHash VARCHAR(64) NOT NULL"],
        ["status", "ALTER TABLE task_creation_requests ADD COLUMN status ENUM('processing','completed','failed') NOT NULL"],
        ["taskId", "ALTER TABLE task_creation_requests ADD COLUMN taskId INT NULL"],
        ["attempts", "ALTER TABLE task_creation_requests ADD COLUMN attempts INT NOT NULL DEFAULT 1"],
        ["lastError", "ALTER TABLE task_creation_requests ADD COLUMN lastError TEXT NULL"],
        ["createdAt", "ALTER TABLE task_creation_requests ADD COLUMN createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["updatedAt", "ALTER TABLE task_creation_requests ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
      ] as const;
      for (const [columnName, ddl] of taskCreationRequestColumns) {
        setUpgradeState("running", `task_creation_requests_column_${columnName}`);
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_creation_requests' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try { await db.execute(sql.raw(ddl)); }
          catch (error) { if (!isDuplicateSchemaObject(error)) throw error; }
        }
      }
      setUpgradeState("running", "task_creation_requests_index");
      const taskCreationIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM task_creation_requests WHERE Key_name = 'idx_task_creation_status'
      `));
      if (taskCreationIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE INDEX idx_task_creation_status ON task_creation_requests (status, updatedAt)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "task_notification_outbox");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS task_notification_outbox (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          notificationKey VARCHAR(191) NOT NULL,
          eventType ENUM('assignment','reminder','feedback_creator') NOT NULL,
          taskId INT NOT NULL,
          staffId INT NULL,
          recipientUserId INT NULL,
          feedbackId BIGINT NULL,
          feedbackStatus VARCHAR(32) NULL,
          status ENUM('pending','processing','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
          attempts INT NOT NULL DEFAULT 0,
          nextAttemptAt TIMESTAMP NULL,
          leaseUntil TIMESTAMP NULL,
          leaseToken VARCHAR(64) NULL,
          deliveryStartedAt TIMESTAMP NULL,
          reminderId INT NULL,
          provider VARCHAR(32) NULL,
          providerMessageId VARCHAR(255) NULL,
          lastError TEXT NULL,
          sentAt TIMESTAMP NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_task_notification_key (notificationKey),
          KEY idx_task_notification_status (status, nextAttemptAt, leaseUntil)
        )
      `);
      const outboxColumns = [
        ["notificationKey", "ALTER TABLE task_notification_outbox ADD COLUMN notificationKey VARCHAR(191) NOT NULL"],
        ["eventType", "ALTER TABLE task_notification_outbox ADD COLUMN eventType ENUM('assignment','reminder','feedback_creator') NOT NULL"],
        ["taskId", "ALTER TABLE task_notification_outbox ADD COLUMN taskId INT NOT NULL"],
        ["staffId", "ALTER TABLE task_notification_outbox ADD COLUMN staffId INT NULL"],
        ["recipientUserId", "ALTER TABLE task_notification_outbox ADD COLUMN recipientUserId INT NULL"],
        ["feedbackId", "ALTER TABLE task_notification_outbox ADD COLUMN feedbackId BIGINT NULL"],
        ["feedbackStatus", "ALTER TABLE task_notification_outbox ADD COLUMN feedbackStatus VARCHAR(32) NULL"],
        ["status", "ALTER TABLE task_notification_outbox ADD COLUMN status ENUM('pending','processing','sent','failed','cancelled') NOT NULL DEFAULT 'pending'"],
        ["attempts", "ALTER TABLE task_notification_outbox ADD COLUMN attempts INT NOT NULL DEFAULT 0"],
        ["nextAttemptAt", "ALTER TABLE task_notification_outbox ADD COLUMN nextAttemptAt TIMESTAMP NULL"],
        ["leaseUntil", "ALTER TABLE task_notification_outbox ADD COLUMN leaseUntil TIMESTAMP NULL"],
        ["leaseToken", "ALTER TABLE task_notification_outbox ADD COLUMN leaseToken VARCHAR(64) NULL"],
        ["deliveryStartedAt", "ALTER TABLE task_notification_outbox ADD COLUMN deliveryStartedAt TIMESTAMP NULL"],
        ["reminderId", "ALTER TABLE task_notification_outbox ADD COLUMN reminderId INT NULL"],
        ["provider", "ALTER TABLE task_notification_outbox ADD COLUMN provider VARCHAR(32) NULL"],
        ["providerMessageId", "ALTER TABLE task_notification_outbox ADD COLUMN providerMessageId VARCHAR(255) NULL"],
        ["lastError", "ALTER TABLE task_notification_outbox ADD COLUMN lastError TEXT NULL"],
        ["sentAt", "ALTER TABLE task_notification_outbox ADD COLUMN sentAt TIMESTAMP NULL"],
        ["createdAt", "ALTER TABLE task_notification_outbox ADD COLUMN createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["updatedAt", "ALTER TABLE task_notification_outbox ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
      ] as const;
      for (const [columnName, ddl] of outboxColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_notification_outbox' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try { await db.execute(sql.raw(ddl)); }
          catch (error) { if (!isDuplicateSchemaObject(error)) throw error; }
        }
      }
      const outboxUniqueIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM task_notification_outbox WHERE Key_name = 'uq_task_notification_key'
      `));
      if (outboxUniqueIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE UNIQUE INDEX uq_task_notification_key ON task_notification_outbox (notificationKey)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }
      const outboxStatusIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM task_notification_outbox WHERE Key_name = 'idx_task_notification_status'
      `));
      if (outboxStatusIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE INDEX idx_task_notification_status ON task_notification_outbox (status, nextAttemptAt, leaseUntil)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "report_followup_extraction_runs");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS report_followup_extraction_runs (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          jobKey VARCHAR(128) NULL,
          reportId INT NOT NULL,
          reportUpdatedAt TIMESTAMP NULL,
          reportContentHash VARCHAR(64) NULL,
          status ENUM('running','succeeded','failed') NOT NULL,
          extractedCount INT NOT NULL DEFAULT 0,
          createdCount INT NOT NULL DEFAULT 0,
          updatedCount INT NOT NULL DEFAULT 0,
          archivedCount INT NOT NULL DEFAULT 0,
          errorCode VARCHAR(120) NULL,
          errorMessage TEXT NULL,
          attempts INT NOT NULL DEFAULT 1,
          nextAttemptAt TIMESTAMP NULL,
          leaseUntil TIMESTAMP NULL,
          leaseToken VARCHAR(64) NULL,
          deadLetterAt TIMESTAMP NULL,
          startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          finishedAt TIMESTAMP NULL,
          UNIQUE KEY uq_followup_extraction_job (jobKey),
          KEY idx_followup_runs_report_status (reportId, status, id)
        )
      `);

      const extractionRunColumns = [
        ["jobKey", "ALTER TABLE report_followup_extraction_runs ADD COLUMN jobKey VARCHAR(128) NULL"],
        ["reportId", "ALTER TABLE report_followup_extraction_runs ADD COLUMN reportId INT NULL"],
        ["reportUpdatedAt", "ALTER TABLE report_followup_extraction_runs ADD COLUMN reportUpdatedAt TIMESTAMP NULL"],
        ["reportContentHash", "ALTER TABLE report_followup_extraction_runs ADD COLUMN reportContentHash VARCHAR(64) NULL"],
        ["status", "ALTER TABLE report_followup_extraction_runs ADD COLUMN status ENUM('running','succeeded','failed') NOT NULL DEFAULT 'failed'"],
        ["extractedCount", "ALTER TABLE report_followup_extraction_runs ADD COLUMN extractedCount INT NOT NULL DEFAULT 0"],
        ["createdCount", "ALTER TABLE report_followup_extraction_runs ADD COLUMN createdCount INT NOT NULL DEFAULT 0"],
        ["updatedCount", "ALTER TABLE report_followup_extraction_runs ADD COLUMN updatedCount INT NOT NULL DEFAULT 0"],
        ["archivedCount", "ALTER TABLE report_followup_extraction_runs ADD COLUMN archivedCount INT NOT NULL DEFAULT 0"],
        ["errorCode", "ALTER TABLE report_followup_extraction_runs ADD COLUMN errorCode VARCHAR(120) NULL"],
        ["errorMessage", "ALTER TABLE report_followup_extraction_runs ADD COLUMN errorMessage TEXT NULL"],
        ["attempts", "ALTER TABLE report_followup_extraction_runs ADD COLUMN attempts INT NOT NULL DEFAULT 1"],
        ["nextAttemptAt", "ALTER TABLE report_followup_extraction_runs ADD COLUMN nextAttemptAt TIMESTAMP NULL"],
        ["leaseUntil", "ALTER TABLE report_followup_extraction_runs ADD COLUMN leaseUntil TIMESTAMP NULL"],
        ["leaseToken", "ALTER TABLE report_followup_extraction_runs ADD COLUMN leaseToken VARCHAR(64) NULL"],
        ["deadLetterAt", "ALTER TABLE report_followup_extraction_runs ADD COLUMN deadLetterAt TIMESTAMP NULL"],
        ["startedAt", "ALTER TABLE report_followup_extraction_runs ADD COLUMN startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
        ["finishedAt", "ALTER TABLE report_followup_extraction_runs ADD COLUMN finishedAt TIMESTAMP NULL"],
      ] as const;
      for (const [columnName, ddl] of extractionRunColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_followup_extraction_runs' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try { await db.execute(sql.raw(ddl)); }
          catch (error) { if (!isDuplicateSchemaObject(error)) throw error; }
        }
      }
      const extractionUniqueIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM report_followup_extraction_runs WHERE Key_name = 'uq_followup_extraction_job'
      `));
      if (extractionUniqueIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE UNIQUE INDEX uq_followup_extraction_job ON report_followup_extraction_runs (jobKey)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }
      const extractionStatusIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM report_followup_extraction_runs WHERE Key_name = 'idx_followup_runs_report_status'
      `));
      if (extractionStatusIndexes.length === 0) {
        try {
          await db.execute(sql`CREATE INDEX idx_followup_runs_report_status ON report_followup_extraction_runs (reportId, status, id)`);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "task_staff_archive");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS task_staff_archive (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          originalAssignmentId INT NOT NULL,
          taskId INT NOT NULL,
          staffId INT NOT NULL,
          assignedAt TIMESTAMP NOT NULL,
          archivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          archivedBy INT NULL,
          archiveReason TEXT NOT NULL,
          mergedIntoAssignmentId INT NULL,
          UNIQUE KEY uq_task_staff_archive_original (originalAssignmentId),
          KEY idx_task_staff_archive_task_staff (taskId, staffId)
        )
      `);

      const taskStaffIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM task_staff WHERE Key_name = 'uq_task_staff_task_staff'
      `));
      if (taskStaffIndexes.length === 0) {
        await db.execute(sql`
          INSERT IGNORE INTO task_staff_archive (
            originalAssignmentId, taskId, staffId, assignedAt,
            archivedBy, archiveReason, mergedIntoAssignmentId
          )
          SELECT duplicateAssignment.id, duplicateAssignment.taskId,
            duplicateAssignment.staffId, duplicateAssignment.assignedAt,
            NULL, 'Duplicate assignment merged during integrity upgrade', duplicateGroup.keeperId
          FROM task_staff duplicateAssignment
          INNER JOIN (
            SELECT taskId, staffId, MIN(id) AS keeperId
            FROM task_staff
            GROUP BY taskId, staffId
            HAVING COUNT(*) > 1
          ) duplicateGroup
            ON duplicateGroup.taskId = duplicateAssignment.taskId
            AND duplicateGroup.staffId = duplicateAssignment.staffId
            AND duplicateGroup.keeperId <> duplicateAssignment.id
        `);
        await db.execute(sql`
          DELETE duplicateAssignment
          FROM task_staff duplicateAssignment
          INNER JOIN task_staff keeper
            ON keeper.taskId = duplicateAssignment.taskId
            AND keeper.staffId = duplicateAssignment.staffId
            AND keeper.id < duplicateAssignment.id
        `);
        try {
          await db.execute(sql.raw(
            "CREATE UNIQUE INDEX uq_task_staff_task_staff ON task_staff (taskId, staffId)"
          ));
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "report_followups");
      const followupColumns = [
        ["requiresAcceptance", "ALTER TABLE report_followups ADD COLUMN requiresAcceptance BOOLEAN NOT NULL DEFAULT TRUE AFTER status"],
        ["completionRevision", "ALTER TABLE report_followups ADD COLUMN completionRevision INT NOT NULL DEFAULT 0 AFTER requiresAcceptance"],
        ["completionRequestId", "ALTER TABLE report_followups ADD COLUMN completionRequestId VARCHAR(128) NULL AFTER completionRevision"],
        ["dedupeKey", "ALTER TABLE report_followups ADD COLUMN dedupeKey VARCHAR(64) NULL AFTER extractedItem"],
        ["duplicateOfId", "ALTER TABLE report_followups ADD COLUMN duplicateOfId INT NULL AFTER dedupeKey"],
        ["archivedAt", "ALTER TABLE report_followups ADD COLUMN archivedAt TIMESTAMP NULL AFTER duplicateOfId"],
        ["archivedBy", "ALTER TABLE report_followups ADD COLUMN archivedBy INT NULL AFTER archivedAt"],
        ["archiveReason", "ALTER TABLE report_followups ADD COLUMN archiveReason TEXT NULL AFTER archivedBy"],
      ] as const;
      for (const [columnName, ddl] of followupColumns) {
        const existing = rowsOf<any>(await db.execute(sql`
          SELECT COLUMN_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_followups' AND COLUMN_NAME = ${columnName}
          LIMIT 1
        `));
        if (existing.length === 0) {
          try {
            await db.execute(sql.raw(ddl));
            if (columnName === "requiresAcceptance") {
              await db.execute(sql`UPDATE report_followups SET requiresAcceptance = FALSE WHERE status = 'completed'`);
            }
          } catch (error) {
            if (!isDuplicateSchemaObject(error)) throw error;
          }
        }
      }
      const followupIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM report_followups WHERE Key_name = 'uq_report_followup_report_item'
      `));
      if (followupIndexes.length === 0) {
        await db.execute(sql`
          UPDATE report_followups SET dedupeKey = NULL WHERE archivedAt IS NOT NULL
        `);
        await db.execute(sql`
          UPDATE report_followups
          SET dedupeKey = SHA2(LOWER(TRIM(extractedItem)), 256)
          WHERE dedupeKey IS NULL AND duplicateOfId IS NULL AND archivedAt IS NULL
        `);
        await db.execute(sql`
          UPDATE report_followups duplicateItem
          INNER JOIN (
            SELECT reportId, dedupeKey,
              COALESCE(MIN(CASE WHEN status = 'completed' THEN id END), MIN(id)) AS keeperId
            FROM report_followups
            WHERE duplicateOfId IS NULL AND archivedAt IS NULL AND dedupeKey IS NOT NULL
            GROUP BY reportId, dedupeKey
            HAVING COUNT(*) > 1
          ) duplicateGroup
            ON duplicateGroup.reportId = duplicateItem.reportId
            AND duplicateGroup.dedupeKey = duplicateItem.dedupeKey
            AND duplicateGroup.keeperId <> duplicateItem.id
          SET duplicateItem.duplicateOfId = duplicateGroup.keeperId,
              duplicateItem.dedupeKey = NULL
          WHERE duplicateItem.archivedAt IS NULL
        `);
        try {
          await db.execute(sql.raw(
            "CREATE UNIQUE INDEX uq_report_followup_report_item ON report_followups (reportId, dedupeKey)"
          ));
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      const followupCompletionIndexes = rowsOf<any>(await db.execute(sql`
        SHOW INDEX FROM report_followups WHERE Key_name = 'uq_report_followup_completion_request'
      `));
      if (followupCompletionIndexes.length === 0) {
        try {
          await db.execute(sql`
            CREATE UNIQUE INDEX uq_report_followup_completion_request
            ON report_followups (completionRequestId)
          `);
        } catch (error) {
          if (!isDuplicateSchemaObject(error)) throw error;
        }
      }

      setUpgradeState("running", "task_execution_feedbacks");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS task_execution_feedbacks (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          requestId VARCHAR(128) NULL,
          taskId INT NOT NULL,
          staffId INT NOT NULL,
          status ENUM('pending', 'in_progress', 'blocked', 'completed', 'cancelled') NOT NULL,
          feedbackNote TEXT NOT NULL,
          evidenceUrl TEXT NULL,
          acknowledgedAt BIGINT NULL,
          completedAt BIGINT NULL,
          submittedByUserId INT NOT NULL,
          submittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_task_execution_feedback_request (requestId),
          INDEX idx_task_execution_task_staff_history (taskId, staffId, id),
          INDEX idx_task_execution_staff_status (staffId, status)
        )
      `);
      const feedbackRequestColumns = rowsOf<any>(await db.execute(sql`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_execution_feedbacks' AND COLUMN_NAME = 'requestId'
        LIMIT 1
      `));
      if (feedbackRequestColumns.length === 0) {
        try { await db.execute(sql`ALTER TABLE task_execution_feedbacks ADD COLUMN requestId VARCHAR(128) NULL`); }
        catch (error) { if (!isDuplicateSchemaObject(error)) throw error; }
      }
      try {
        await db.execute(sql`CREATE UNIQUE INDEX uq_task_execution_feedback_request ON task_execution_feedbacks (requestId)`);
      } catch (error) {
        if (!isDuplicateSchemaObject(error)) throw error;
      }

      setUpgradeState("running", "task_completion_review_events");
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS task_completion_review_events (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          requestId VARCHAR(128) NOT NULL,
          sourceType ENUM('manual','daily_report') NOT NULL,
          sourceId INT NOT NULL,
          subjectKey VARCHAR(80) NOT NULL,
          completionVersion BIGINT NOT NULL,
          decision ENUM('accepted','returned') NOT NULL,
          decisionNote TEXT NOT NULL,
          decidedByUserId INT NOT NULL,
          decidedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_task_completion_review_request (requestId),
          UNIQUE KEY uq_task_completion_review_version (sourceType, sourceId, subjectKey, completionVersion),
          KEY idx_task_completion_review_source (sourceType, sourceId, subjectKey)
        )
      `);
      let reviewTriggerNames = new Set<string>();
      try {
        const reviewTriggers = rowsOf<any>(await db.execute(sql`
          SELECT TRIGGER_NAME
          FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = DATABASE()
            AND TRIGGER_NAME IN ('trg_task_completion_review_no_update', 'trg_task_completion_review_no_delete')
        `));
        reviewTriggerNames = new Set(reviewTriggers.map(row => String(row.TRIGGER_NAME || row.triggerName || "")));
      } catch (error) {
        if (!isOptionalTriggerUnavailable(error)) throw error;
      }
      const optionalReviewTriggers = [
        [
          "trg_task_completion_review_no_update",
          "CREATE TRIGGER trg_task_completion_review_no_update BEFORE UPDATE ON task_completion_review_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task completion review events are append-only'",
        ],
        [
          "trg_task_completion_review_no_delete",
          "CREATE TRIGGER trg_task_completion_review_no_delete BEFORE DELETE ON task_completion_review_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task completion review events are append-only'",
        ],
      ] as const;
      for (const [triggerName, triggerSql] of optionalReviewTriggers) {
        if (reviewTriggerNames.has(triggerName)) continue;
        try {
          await db.execute(sql.raw(triggerSql));
        } catch (error) {
          if (!isDuplicateSchemaObject(error) && !isOptionalTriggerUnavailable(error)) throw error;
          if (isOptionalTriggerUnavailable(error)) {
            console.warn("[TaskExecution] Database triggers unavailable; review events remain append-only through application APIs");
            break;
          }
        }
      }
      setUpgradeState("ready", "complete");
    })().catch(error => {
      taskExecutionUpgrade = null;
      setUpgradeState("failed", taskExecutionUpgradeState.step, safeUpgradeError(error));
      throw error;
    });
  }

  await taskExecutionUpgrade;
}
