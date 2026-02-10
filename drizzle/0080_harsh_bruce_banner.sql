CREATE TABLE `mall_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`logoUrl` text,
	`logoKey` varchar(512),
	`description` text,
	`website` varchar(500),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255),
	`description` text,
	`parentId` int,
	`iconEmoji` varchar(10),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mall_products` ADD `brandId` int;--> statement-breakpoint
ALTER TABLE `mall_products` ADD `categoryId` int;
