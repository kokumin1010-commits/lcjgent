CREATE TABLE IF NOT EXISTS `store_product_handcards` (
  `productId` INT NOT NULL,
  `contentJson` JSON NOT NULL,
  `revision` INT NOT NULL DEFAULT 1,
  `createdById` INT NULL,
  `createdByName` VARCHAR(255) NULL,
  `updatedById` INT NULL,
  `updatedByName` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`productId`),
  INDEX `idx_store_product_handcards_updated` (`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
