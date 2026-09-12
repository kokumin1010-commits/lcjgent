CREATE TABLE IF NOT EXISTS `finance_monthly_pnl` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `month` VARCHAR(7) NOT NULL,
  `revenueJpy` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `grossProfitJpy` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `operatingProfitJpy` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `netProfitJpy` DECIMAL(18,2) DEFAULT NULL,
  `status` ENUM('draft','closed','audited') NOT NULL DEFAULT 'draft',
  `note` VARCHAR(1000) DEFAULT NULL,
  `createdBy` INT DEFAULT NULL,
  `updatedBy` INT DEFAULT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_monthly_pnl_month` (`month`),
  KEY `idx_finance_monthly_pnl_status_month` (`status`, `month`)
);
