CREATE TABLE `product_lab_sales_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`liverId` int,
	`assignmentId` int,
	`salesDate` timestamp,
	`quantity` int DEFAULT 0,
	`revenue` decimal(10,2) DEFAULT '0',
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`importSource` varchar(255),
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_lab_sales_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_pipeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`imageUrl` text,
	`sourceUrl` text,
	`sourceType` enum('1688','aliexpress','manual') NOT NULL DEFAULT 'manual',
	`costPrice` decimal(10,2) NOT NULL,
	`sellPrice` decimal(10,2) NOT NULL,
	`profitMargin` decimal(5,2),
	`status` enum('candidate','testing','hit','spreading','standard','eliminated') NOT NULL DEFAULT 'candidate',
	`score` decimal(8,2) DEFAULT '0',
	`totalSales` int DEFAULT 0,
	`totalGmv` decimal(12,2) DEFAULT '0',
	`conversionRate` decimal(5,2) DEFAULT '0',
	`category` varchar(255),
	`tags` json,
	`talkScript` text,
	`productDescription` text,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_pipeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_test_assignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`liverId` int NOT NULL,
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`durationMinutes` int DEFAULT 5,
	`lineNotifiedAt` timestamp,
	`lineNotifyStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`salesCount` int DEFAULT 0,
	`gmv` decimal(10,2) DEFAULT '0',
	`viewCount` int DEFAULT 0,
	`conversionRate` decimal(5,2) DEFAULT '0',
	`notes` text,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_test_assignment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tiktok_tap_reports` ADD CONSTRAINT `unique_tap_report` UNIQUE(`brandId`,`reportMonth`,`creatorUsername`,`productId`);