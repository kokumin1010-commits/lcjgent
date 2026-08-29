CREATE TABLE IF NOT EXISTS `festival_email_delivery_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `recipient_hash` varchar(64) NOT NULL,
  `recipient_domain` varchar(255) NOT NULL,
  `purpose` enum('password_reset','password_changed') NOT NULL,
  `source` enum('self_service','mypage','admin') NOT NULL,
  `status` enum('accepted','failed') NOT NULL,
  `provider` varchar(32),
  `message_id` varchar(255),
  `error_code` varchar(100),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `festival_email_delivery_logs_id` PRIMARY KEY (`id`),
  INDEX `idx_festival_email_delivery_account_created` (`account_id`, `created_at`),
  INDEX `idx_festival_email_delivery_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
