CREATE TABLE `bw_linked_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`bwUserId` varchar(128) NOT NULL,
	`bwDisplayName` varchar(255),
	`bwEmail` varchar(320),
	`status` enum('active','unlinked') NOT NULL DEFAULT 'active',
	`linkedAt` timestamp NOT NULL DEFAULT (now()),
	`unlinkedAt` timestamp,
	`linkToken` varchar(128),
	`linkTokenExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bw_linked_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bw_linked_accounts_lineUserId_unique` UNIQUE(`lineUserId`)
);
--> statement-breakpoint
CREATE TABLE `point_exchanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`bwLinkedAccountId` int NOT NULL,
	`lcjPointsUsed` bigint NOT NULL,
	`bwTokensReceived` bigint NOT NULL,
	`exchangeRate` decimal(10,4) NOT NULL,
	`bwTransferStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`bwTransactionId` varchar(128),
	`bwTransferError` text,
	`bwTransferredAt` timestamp,
	`retryCount` int NOT NULL DEFAULT 0,
	`pointTransactionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `point_exchanges_id` PRIMARY KEY(`id`)
);
