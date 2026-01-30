CREATE TABLE `line_fraud_detection_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`checkType` enum('duplicate_image','duplicate_receipt','expired_receipt','high_frequency','high_amount','suspicious_pattern') NOT NULL,
	`detected` boolean NOT NULL DEFAULT false,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`details` text,
	`relatedReceiptId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_fraud_detection_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_point_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`balance` bigint NOT NULL DEFAULT 0,
	`totalEarned` bigint NOT NULL DEFAULT 0,
	`totalUsed` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_point_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_point_balances_lineUserId_unique` UNIQUE(`lineUserId`)
);
--> statement-breakpoint
CREATE TABLE `line_point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`type` enum('earn','use','expire','refund','adjustment') NOT NULL,
	`amount` bigint NOT NULL,
	`balanceAfter` bigint NOT NULL,
	`referenceType` enum('receipt','order','manual','system') NOT NULL,
	`referenceId` int,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`lineMessageId` varchar(64),
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`imageHash` varchar(64),
	`storeName` varchar(255),
	`purchaseDate` timestamp,
	`totalAmount` bigint,
	`currency` varchar(10) DEFAULT 'JPY',
	`ocrRawText` text,
	`ocrConfidence` decimal(5,2),
	`pointsCalculated` bigint,
	`pointsAwarded` bigint,
	`status` enum('pending','approved','rejected','on_hold') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`fraudFlags` json,
	`fraudScore` decimal(5,2) DEFAULT '0',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_receipts_id` PRIMARY KEY(`id`)
);
