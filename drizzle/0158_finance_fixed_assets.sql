CREATE TABLE IF NOT EXISTS `company_fixed_assets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `assetCode` VARCHAR(64) DEFAULT NULL,
  `assetName` VARCHAR(255) NOT NULL,
  `category` VARCHAR(40) NOT NULL,
  `brandModel` VARCHAR(255) DEFAULT NULL,
  `serialNumber` VARCHAR(255) DEFAULT NULL,
  `entity` ENUM('japan','china') NOT NULL DEFAULT 'japan',
  `acquisitionDate` DATE DEFAULT NULL,
  `purchasePrice` DECIMAL(15,2) DEFAULT NULL,
  `currency` ENUM('JPY','CNY') NOT NULL DEFAULT 'JPY',
  `vendor` VARCHAR(255) DEFAULT NULL,
  `invoiceNumber` VARCHAR(255) DEFAULT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `assigneeStaffId` INT DEFAULT NULL,
  `assigneeName` VARCHAR(255) DEFAULT NULL,
  `assigneeDepartment` VARCHAR(255) DEFAULT NULL,
  `assigneePosition` VARCHAR(255) DEFAULT NULL,
  `assignedAt` DATE DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'available',
  `conditionStatus` VARCHAR(32) NOT NULL DEFAULT 'good',
  `warrantyEndDate` DATE DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `createdBy` INT NOT NULL,
  `createdByName` VARCHAR(255) NOT NULL,
  `updatedBy` INT NOT NULL,
  `updatedByName` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_fixed_assets_code` (`assetCode`),
  KEY `idx_company_fixed_assets_status` (`status`, `deletedAt`),
  KEY `idx_company_fixed_assets_category` (`category`, `deletedAt`),
  KEY `idx_company_fixed_assets_assignee` (`assigneeStaffId`, `deletedAt`),
  KEY `idx_company_fixed_assets_entity` (`entity`, `deletedAt`)
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_fixed_asset_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `assetId` INT NOT NULL,
  `eventType` VARCHAR(32) NOT NULL,
  `previousAssigneeStaffId` INT DEFAULT NULL,
  `previousAssigneeName` VARCHAR(255) DEFAULT NULL,
  `assigneeStaffId` INT DEFAULT NULL,
  `assigneeName` VARCHAR(255) DEFAULT NULL,
  `previousStatus` VARCHAR(32) DEFAULT NULL,
  `status` VARCHAR(32) DEFAULT NULL,
  `previousLocation` VARCHAR(255) DEFAULT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `changes` JSON DEFAULT NULL,
  `note` TEXT DEFAULT NULL,
  `createdBy` INT NOT NULL,
  `createdByName` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_fixed_asset_events_asset` (`assetId`, `createdAt`),
  KEY `idx_company_fixed_asset_events_type` (`eventType`, `createdAt`),
  CONSTRAINT `fk_company_fixed_asset_events_asset`
    FOREIGN KEY (`assetId`) REFERENCES `company_fixed_assets` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_fixed_asset_events_no_update`;
--> statement-breakpoint
CREATE TRIGGER `trg_fixed_asset_events_no_update`
BEFORE UPDATE ON `company_fixed_asset_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixed asset events are append-only';
--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_fixed_asset_events_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `trg_fixed_asset_events_no_delete`
BEFORE DELETE ON `company_fixed_asset_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixed asset events are append-only';
