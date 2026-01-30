CREATE TABLE `fraud_detection_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`userId` int NOT NULL,
	`checkType` enum('duplicate_image','duplicate_receipt','expired_receipt','high_frequency','high_amount','suspicious_pattern') NOT NULL,
	`detected` boolean NOT NULL DEFAULT false,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`details` text,
	`relatedReceiptId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_detection_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` bigint NOT NULL DEFAULT 0,
	`totalEarned` bigint NOT NULL DEFAULT 0,
	`totalUsed` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `point_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `point_balances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('earn','use','expire','refund','adjustment') NOT NULL,
	`amount` bigint NOT NULL,
	`balanceAfter` bigint NOT NULL,
	`referenceType` enum('receipt','order','manual','system') NOT NULL,
	`referenceId` int,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
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
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
