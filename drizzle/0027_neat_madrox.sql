CREATE TABLE `pending_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineGroupId` varchar(64) NOT NULL,
	`lineMessageId` varchar(64) NOT NULL,
	`senderLineUserId` varchar(64),
	`senderName` varchar(255),
	`messageContent` text NOT NULL,
	`messageSummary` text,
	`responseType` enum('question','proposal','confirmation','schedule','other') NOT NULL DEFAULT 'other',
	`status` enum('pending','responded','cancelled','expired') NOT NULL DEFAULT 'pending',
	`reminderCount` int NOT NULL DEFAULT 0,
	`lastReminderAt` timestamp,
	`nextReminderAt` timestamp,
	`respondedBy` varchar(64),
	`respondedAt` timestamp,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pending_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `line_messages` ADD `needsResponse` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `responseStatus` enum('none','pending','responded','cancelled') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `responseSummary` text;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `lastReminderAt` timestamp;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `reminderCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `respondedAt` timestamp;--> statement-breakpoint
ALTER TABLE `line_messages` ADD `respondedBy` varchar(64);