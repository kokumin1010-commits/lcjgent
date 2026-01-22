ALTER TABLE `schedules` ADD `reminderEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `reminderMinutesBefore` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `schedules` ADD `reminderSentAt` timestamp;