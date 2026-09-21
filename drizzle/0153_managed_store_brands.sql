CREATE TABLE IF NOT EXISTS `managed_store_brands` (
  `storeId` INT NOT NULL,
  `brandId` INT NOT NULL,
  `isPrimary` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`storeId`, `brandId`),
  INDEX `idx_managed_store_brand_lookup` (`brandId`, `storeId`),
  INDEX `idx_managed_store_primary` (`storeId`, `isPrimary`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
INSERT IGNORE INTO `managed_store_brands` (`storeId`, `brandId`, `isPrimary`)
SELECT `id`, `brandId`, 1
  FROM `managed_stores`
 WHERE `brandId` IS NOT NULL;
--> statement-breakpoint
UPDATE `managed_store_brands` AS `relation`
JOIN `managed_stores` AS `store` ON `store`.`id` = `relation`.`storeId`
   SET `relation`.`isPrimary` = CASE
     WHEN `relation`.`brandId` = `store`.`brandId` THEN 1
     ELSE 0
   END
 WHERE `store`.`brandId` IS NOT NULL;
