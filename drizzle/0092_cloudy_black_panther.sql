CREATE TABLE `mall_view_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`productId` int NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_view_history_id` PRIMARY KEY(`id`)
);
