CREATE TABLE IF NOT EXISTS `entity_revision_audits` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(40) NOT NULL,
  `entityId` INT NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `actorUserId` INT NULL,
  `beforeState` JSON NULL,
  `afterState` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_revision_entity` (`entityType`, `entityId`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `reports`
  ADD COLUMN `deletedAt` TIMESTAMP NULL AFTER `createdBy`;
--> statement-breakpoint
ALTER TABLE `reports`
  ADD COLUMN `deletedBy` INT NULL AFTER `deletedAt`;
--> statement-breakpoint
ALTER TABLE `reports`
  ADD COLUMN `deleteReason` TEXT NULL AFTER `deletedBy`;
--> statement-breakpoint
ALTER TABLE `reports`
  ADD COLUMN `requestId` VARCHAR(36) NULL AFTER `createdBy`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reports_request_id` ON `reports` (`requestId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `report_attachments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reportId` INT NOT NULL,
  `imageUrl` TEXT NOT NULL,
  `label` VARCHAR(50) NOT NULL,
  `filename` VARCHAR(255) NULL,
  `archivedAt` TIMESTAMP NULL,
  `archivedBy` INT NULL,
  `archiveReason` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_report_id` (`reportId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
ALTER TABLE `report_attachments`
  ADD COLUMN `uploadId` VARCHAR(64) NULL AFTER `reportId`;
--> statement-breakpoint
ALTER TABLE `report_attachments`
  ADD COLUMN `contentHash` VARCHAR(64) NULL AFTER `uploadId`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_attachments_upload`
  ON `report_attachments` (`reportId`, `uploadId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `report_followup_extraction_runs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `jobKey` VARCHAR(128) NULL,
  `reportId` INT NOT NULL,
  `reportUpdatedAt` TIMESTAMP NULL,
  `reportContentHash` VARCHAR(64) NULL,
  `status` ENUM('running','succeeded','failed') NOT NULL,
  `extractedCount` INT NOT NULL DEFAULT 0,
  `createdCount` INT NOT NULL DEFAULT 0,
  `updatedCount` INT NOT NULL DEFAULT 0,
  `archivedCount` INT NOT NULL DEFAULT 0,
  `errorCode` VARCHAR(120) NULL,
  `errorMessage` TEXT NULL,
  `attempts` INT NOT NULL DEFAULT 1,
  `nextAttemptAt` TIMESTAMP NULL,
  `leaseUntil` TIMESTAMP NULL,
  `leaseToken` VARCHAR(64) NULL,
  `deadLetterAt` TIMESTAMP NULL,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finishedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_followup_extraction_job` (`jobKey`),
  KEY `idx_followup_runs_report_status` (`reportId`, `status`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
