CREATE TABLE `livestream_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`livestreamId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`gmv` bigint,
	`quantity` int,
	`unitPrice` bigint,
	`productClicks` int,
	`impressions` int,
	`cartAddCount` int,
	`conversionRate` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `livestream_products_id` PRIMARY KEY(`id`)
);
