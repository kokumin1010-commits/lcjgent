CREATE TABLE `ai_auto_approve_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`confidenceThreshold` int NOT NULL DEFAULT 85,
	`batchSize` int NOT NULL DEFAULT 20,
	`lastRunAt` timestamp,
	`lastRunBatchId` varchar(64),
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_auto_approve_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_auto_review_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(64) NOT NULL,
	`receiptId` int NOT NULL,
	`lineUserId` varchar(128),
	`aiDecision` varchar(32) NOT NULL,
	`aiConfidence` int,
	`aiComment` text,
	`aiReason` text,
	`orderNumber` varchar(64),
	`totalAmount` int,
	`storeName` varchar(256),
	`imageUrl` text,
	`humanOverride` varchar(32),
	`humanComment` text,
	`humanReviewedBy` int,
	`humanReviewedAt` timestamp,
	`isDryRun` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_auto_review_logs_id` PRIMARY KEY(`id`)
);
