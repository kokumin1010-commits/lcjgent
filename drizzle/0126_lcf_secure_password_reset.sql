ALTER TABLE `festival_accounts`
  ADD COLUMN IF NOT EXISTS `auth_version` int NOT NULL DEFAULT 1 AFTER `is_active`;

CREATE TABLE IF NOT EXISTS `festival_password_reset_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `account_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `festival_password_reset_tokens_id` PRIMARY KEY (`id`),
  CONSTRAINT `uk_festival_password_reset_token_hash` UNIQUE (`token_hash`),
  INDEX `idx_festival_password_reset_account_active` (`account_id`, `used_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
