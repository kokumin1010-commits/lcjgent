CREATE TABLE `mall_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_favorite` UNIQUE(`lineUserId`,`productId`)
);
