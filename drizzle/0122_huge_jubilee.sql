CREATE TABLE `anchor_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`anchorId` int NOT NULL,
	`status` enum('selected','scheduled','completed','cancelled') DEFAULT 'selected',
	`scheduledDate` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `anchor_selections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selection_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`parentId` int,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `selection_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selection_performances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`anchorId` int NOT NULL,
	`scheduleId` int,
	`liveDate` varchar(20) NOT NULL,
	`gmv` decimal(12,2) DEFAULT '0',
	`salesCount` int DEFAULT 0,
	`viewerCount` int DEFAULT 0,
	`clickCount` int DEFAULT 0,
	`conversionRate` decimal(5,2),
	`commissionAmount` decimal(10,2) DEFAULT '0',
	`status` enum('draft','confirmed') DEFAULT 'draft',
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `selection_performances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selection_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(500) NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`categoryId` int,
	`price` decimal(10,2),
	`marketPrice` decimal(10,2),
	`commissionType` enum('percentage','fixed') DEFAULT 'percentage',
	`commissionValue` decimal(10,2),
	`imageUrl` text,
	`productLink` text,
	`sellingPoints` text,
	`stock` int,
	`supplierContact` varchar(255),
	`status` enum('draft','online','offline') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `selection_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selection_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`anchorId` int NOT NULL,
	`liveDate` varchar(20) NOT NULL,
	`startTime` varchar(10),
	`endTime` varchar(10),
	`slotOrder` int,
	`status` enum('pending','confirmed','done','cancelled') DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `selection_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selection_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`anchorId` int NOT NULL,
	`periodStart` varchar(20) NOT NULL,
	`periodEnd` varchar(20) NOT NULL,
	`totalGmv` decimal(12,2) DEFAULT '0',
	`totalCommission` decimal(10,2) DEFAULT '0',
	`itemCount` int DEFAULT 0,
	`status` enum('pending','confirmed','paid') DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `selection_settlements_id` PRIMARY KEY(`id`)
);
