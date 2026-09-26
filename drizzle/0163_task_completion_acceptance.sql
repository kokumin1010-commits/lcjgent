ALTER TABLE `tasks`
  ADD COLUMN `requiresAcceptance` BOOLEAN NOT NULL DEFAULT TRUE AFTER `requestId`;
--> statement-breakpoint
UPDATE `tasks`
SET `requiresAcceptance` = FALSE
WHERE `status` = 'completed';
--> statement-breakpoint
ALTER TABLE `report_followups`
  ADD COLUMN `requiresAcceptance` BOOLEAN NOT NULL DEFAULT TRUE AFTER `status`;
--> statement-breakpoint
ALTER TABLE `report_followups`
  ADD COLUMN `completionRevision` INT NOT NULL DEFAULT 0 AFTER `requiresAcceptance`;
--> statement-breakpoint
ALTER TABLE `report_followups`
  ADD COLUMN `completionRequestId` VARCHAR(128) NULL AFTER `completionRevision`;
--> statement-breakpoint
UPDATE `report_followups`
SET `requiresAcceptance` = FALSE
WHERE `status` = 'completed';
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_followup_completion_request`
  ON `report_followups` (`completionRequestId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `task_completion_review_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `requestId` VARCHAR(128) NOT NULL,
  `sourceType` ENUM('manual','daily_report') NOT NULL,
  `sourceId` INT NOT NULL,
  `subjectKey` VARCHAR(80) NOT NULL,
  `completionVersion` BIGINT NOT NULL,
  `decision` ENUM('accepted','returned') NOT NULL,
  `decisionNote` TEXT NOT NULL,
  `decidedByUserId` INT NOT NULL,
  `decidedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_completion_review_request` (`requestId`),
  UNIQUE KEY `uq_task_completion_review_version` (`sourceType`, `sourceId`, `subjectKey`, `completionVersion`),
  KEY `idx_task_completion_review_source` (`sourceType`, `sourceId`, `subjectKey`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TRIGGER `trg_task_completion_review_no_update`
BEFORE UPDATE ON `task_completion_review_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task completion review events are append-only';
--> statement-breakpoint
CREATE TRIGGER `trg_task_completion_review_no_delete`
BEFORE DELETE ON `task_completion_review_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task completion review events are append-only';
