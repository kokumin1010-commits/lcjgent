CREATE TABLE IF NOT EXISTS `bw_member_link_challenges` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `lineUserId` INT NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `emailHash` CHAR(64) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `attemptCount` INT NOT NULL DEFAULT 0,
  `expiresAt` TIMESTAMP NOT NULL,
  `consumedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_bw_member_link_challenge_token` (`tokenHash`),
  KEY `idx_bw_member_link_challenge_member_time` (`lineUserId`, `createdAt`),
  KEY `idx_bw_member_link_challenge_email_time` (`emailHash`, `createdAt`),
  KEY `idx_bw_member_link_challenge_status_expiry` (`status`, `expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bw_member_link_audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `lineUserId` INT NOT NULL,
  `event` VARCHAR(40) NOT NULL,
  `bwCustomerId` INT NULL,
  `emailHash` CHAR(64) NULL,
  `details` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_bw_member_link_audit_member_time` (`lineUserId`, `createdAt`),
  KEY `idx_bw_member_link_audit_customer_time` (`bwCustomerId`, `createdAt`),
  KEY `idx_bw_member_link_audit_event_time` (`event`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bw_wallet_active_owners` (
  `bwCustomerId` INT NOT NULL PRIMARY KEY,
  `lineUserId` INT NOT NULL,
  `verifiedEmailHash` CHAR(64) NOT NULL,
  `linkedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_bw_wallet_active_owner_member` (`lineUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
