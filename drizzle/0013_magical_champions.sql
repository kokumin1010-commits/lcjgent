CREATE TABLE `brand_livestreams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`livestreamDate` timestamp NOT NULL,
	`streamerName` varchar(255) NOT NULL,
	`salesAmount` bigint,
	`duration` int,
	`viewerCount` int,
	`orderCount` int,
	`platform` varchar(100),
	`remarks` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_livestreams_id` PRIMARY KEY(`id`)
);
