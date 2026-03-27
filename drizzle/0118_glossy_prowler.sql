CREATE TABLE `step_email_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logId` int NOT NULL,
	`trackingId` varchar(64) NOT NULL,
	`url` text NOT NULL,
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `step_email_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD `trackingId` varchar(64);--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD `openedAt` timestamp;--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD `openCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD `clickedAt` timestamp;--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD `clickCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `step_email_logs` ADD CONSTRAINT `step_email_logs_trackingId_unique` UNIQUE(`trackingId`);