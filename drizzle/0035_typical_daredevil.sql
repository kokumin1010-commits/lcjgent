CREATE TABLE `brand_memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`content` text NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_memos_id` PRIMARY KEY(`id`)
);
