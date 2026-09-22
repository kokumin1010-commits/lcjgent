ALTER TABLE `line_group_settings`
  ADD COLUMN `dailyReportEnabled` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tw_daily_line_report_inbox` (
  `report_id` BIGINT NOT NULL,
  `latest_event_id` VARCHAR(160) NOT NULL,
  `report_date` VARCHAR(10) NOT NULL,
  `staff_name` VARCHAR(64) NOT NULL,
  `action` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `findings` TEXT NULL,
  `notes` TEXT NULL,
  `edit_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `occurred_at` DATETIME NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `received_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  UNIQUE KEY `tw_daily_line_inbox_event_uq` (`latest_event_id`),
  UNIQUE KEY `tw_daily_line_inbox_staff_date_uq` (`report_date`, `staff_name`),
  KEY `tw_daily_line_inbox_date_idx` (`report_date`, `staff_name`, `report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tw_daily_line_rollouts` (
  `rollout_key` VARCHAR(80) NOT NULL,
  `target_group_id` VARCHAR(64) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rollout_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tw_daily_line_outbox` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_id` VARCHAR(160) NOT NULL,
  `target_group_id` VARCHAR(64) NOT NULL,
  `event_json` JSON NOT NULL,
  `messages_json` JSON NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lease_token` VARCHAR(64) NULL,
  `lease_expires_at` DATETIME NULL,
  `line_retry_key` VARCHAR(64) NOT NULL,
  `first_external_attempt_at` DATETIME NULL,
  `member_count` INT UNSIGNED NULL,
  `sent_at` DATETIME NULL,
  `last_error` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tw_daily_line_outbox_event_uq` (`event_id`),
  KEY `tw_daily_line_outbox_due_idx` (`status`, `next_attempt_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
