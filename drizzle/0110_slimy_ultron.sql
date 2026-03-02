ALTER TABLE `ai_auto_approve_settings` ADD `isRunning` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `totalProcessed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `totalApproved` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `totalRejected` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `totalHeld` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `totalSkipped` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `currentBatchNumber` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `startedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ai_auto_approve_settings` ADD `stoppedAt` timestamp;