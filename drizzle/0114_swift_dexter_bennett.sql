CREATE TABLE `brand_addition_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255) NOT NULL,
	`brandId` int NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_addition_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons_learned` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('danger','lesson','dependency','rule','status','checklist','preference','bugfix','workflow') NOT NULL,
	`severity` enum('critical','warning','info') NOT NULL DEFAULT 'info',
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`compactRule` text,
	`checkPattern` varchar(500),
	`relatedFeature` varchar(100),
	`relatedFiles` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_learned_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `livestream_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`livestreamId` int NOT NULL,
	`brandId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `livestream_brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `livers` ADD `language` varchar(10) DEFAULT 'ja';