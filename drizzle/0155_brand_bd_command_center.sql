CREATE TABLE IF NOT EXISTS `brand_bd_interactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` INT NOT NULL,
  `interactionType` VARCHAR(32) NOT NULL,
  `occurredAt` DATETIME NOT NULL,
  `summary` VARCHAR(500) NOT NULL,
  `details` MEDIUMTEXT NULL,
  `outcome` TEXT NULL,
  `nextAction` TEXT NULL,
  `nextFollowUpAt` DATETIME NULL,
  `contactPerson` VARCHAR(255) NULL,
  `ownerStaffId` INT NULL,
  `createdBy` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_bd_interaction_brand_time` (`brandId`, `occurredAt`),
  KEY `idx_brand_bd_interaction_owner_time` (`ownerStaffId`, `occurredAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_interaction_files` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `interactionId` BIGINT NOT NULL,
  `brandFileId` INT NOT NULL,
  `extractionStatus` VARCHAR(32) NOT NULL DEFAULT 'not_supported',
  `extractedText` MEDIUMTEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brand_bd_interaction_file` (`interactionId`, `brandFileId`),
  KEY `idx_brand_bd_interaction_file_brand_file` (`brandFileId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_meetings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` INT NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `startsAt` DATETIME NOT NULL,
  `endsAt` DATETIME NULL,
  `location` VARCHAR(500) NULL,
  `agenda` TEXT NULL,
  `ownerStaffId` INT NOT NULL,
  `attendeeStaffIds` JSON NULL,
  `notifyBosses` TINYINT(1) NOT NULL DEFAULT 1,
  `reminderMinutesBefore` INT NOT NULL DEFAULT 60,
  `taskId` INT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  `createdBy` INT NOT NULL,
  `updatedBy` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_bd_meeting_brand_time` (`brandId`, `startsAt`),
  KEY `idx_brand_bd_meeting_status_time` (`status`, `startsAt`),
  KEY `idx_brand_bd_meeting_owner_time` (`ownerStaffId`, `startsAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_task_links` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` INT NOT NULL,
  `interactionId` BIGINT NULL,
  `meetingId` BIGINT NULL,
  `taskId` INT NOT NULL,
  `linkType` VARCHAR(32) NOT NULL,
  `sourceKey` VARCHAR(191) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brand_bd_task_source` (`sourceKey`),
  UNIQUE KEY `uq_brand_bd_task_task` (`taskId`),
  KEY `idx_brand_bd_task_brand` (`brandId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_ai_snapshots` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brandId` INT NULL,
  `interactionId` BIGINT NULL,
  `analysisType` VARCHAR(40) NOT NULL,
  `sourceHash` VARCHAR(64) NOT NULL,
  `model` VARCHAR(80) NOT NULL,
  `outputJson` JSON NOT NULL,
  `createdBy` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_bd_ai_brand_time` (`brandId`, `createdAt`),
  KEY `idx_brand_bd_ai_type_time` (`analysisType`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_meeting_reminder_outbox` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `notificationKey` VARCHAR(191) NOT NULL,
  `meetingId` BIGINT NOT NULL,
  `recipientType` VARCHAR(16) NOT NULL,
  `recipientId` INT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME NULL,
  `leaseUntil` DATETIME NULL,
  `leaseToken` VARCHAR(64) NULL,
  `deliveryStartedAt` DATETIME NULL,
  `provider` VARCHAR(32) NULL,
  `providerMessageId` VARCHAR(255) NULL,
  `lastError` TEXT NULL,
  `sentAt` DATETIME NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brand_bd_meeting_notification` (`notificationKey`),
  KEY `idx_brand_bd_meeting_outbox_status` (`status`, `nextAttemptAt`, `leaseUntil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brand_bd_command_audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(40) NOT NULL,
  `entityId` BIGINT NULL,
  `brandId` INT NULL,
  `action` VARCHAR(64) NOT NULL,
  `beforeJson` JSON NULL,
  `afterJson` JSON NULL,
  `actorId` INT NOT NULL,
  `actorName` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_bd_command_audit_brand_time` (`brandId`, `createdAt`),
  KEY `idx_brand_bd_command_audit_entity` (`entityType`, `entityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
INSERT IGNORE INTO `role_permissions` (`roleId`, `pageKey`, `canView`, `canEdit`)
SELECT `roleId`, '/master/brand-bd-command', `canView`, `canEdit`
  FROM `role_permissions`
 WHERE `pageKey` = '/master/brands';
