CREATE TABLE IF NOT EXISTS `selection_product_bulk_updates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `requestId` varchar(36) NOT NULL,
  `actorUserId` int NOT NULL,
  `inputHash` char(64) NOT NULL,
  `productCount` int NOT NULL,
  `patchJson` json NOT NULL,
  `beforeState` json NOT NULL,
  `afterState` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `selection_product_bulk_updates_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_selection_product_bulk_request` UNIQUE(`requestId`),
  INDEX `idx_selection_product_bulk_actor_created` (`actorUserId`, `createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `selection_price_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productId` int NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `source` varchar(50) DEFAULT 'manual',
  `note` varchar(255) DEFAULT NULL,
  `createdBy` int DEFAULT 0,
  `archivedAt` timestamp NULL DEFAULT NULL,
  `archivedBy` int DEFAULT NULL,
  `archiveReason` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product` (`productId`),
  KEY `idx_price` (`price`),
  KEY `idx_selection_price_active` (`productId`, `archivedAt`, `price`)
);
