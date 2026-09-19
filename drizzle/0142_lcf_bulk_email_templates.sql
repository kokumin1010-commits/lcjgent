CREATE TABLE IF NOT EXISTS `festival_bulk_email_templates` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `category` ENUM('sales','event','follow_up','other') NOT NULL DEFAULT 'sales',
  `subject_template` VARCHAR(500) NOT NULL,
  `body_template` TEXT NOT NULL,
  `created_by_account_id` INT NOT NULL,
  `created_by_email` VARCHAR(320) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_lcf_bulk_template_category_name` (`category`, `name`),
  INDEX `idx_lcf_bulk_template_category_updated` (`category`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
