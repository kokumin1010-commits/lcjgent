CREATE TABLE `brand_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`activityDate` timestamp NOT NULL,
	`activityType` enum('進行中','打ち合わせ','完了') NOT NULL DEFAULT '進行中',
	`contactPerson` varchar(255),
	`nextAction` text,
	`content` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`listPrice` bigint,
	`specialPrice` bigint,
	`discountRate` varchar(50),
	`sampleProduct` varchar(255),
	`productCode` varchar(100),
	`influencer` varchar(255),
	`purchasePrice` bigint,
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`companyName` varchar(255),
	`category` varchar(100),
	`phoneNumber` varchar(50),
	`status` enum('進行中','打ち合わせ中','契約済み','保留','終了') NOT NULL DEFAULT '進行中',
	`materialCategory` varchar(255),
	`email` varchar(320),
	`contactPerson` varchar(255),
	`adBudget` bigint,
	`salesTarget` bigint,
	`commissionRate` varchar(50),
	`businessCardUrls` json,
	`businessCardKeys` json,
	`logoUrl` text,
	`logoKey` varchar(512),
	`memo` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
