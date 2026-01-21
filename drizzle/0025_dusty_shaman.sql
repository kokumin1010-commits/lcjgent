ALTER TABLE `line_groups` ADD `autoFollowUpEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `line_groups` ADD `autoFollowUpDays` int DEFAULT 2;--> statement-breakpoint
ALTER TABLE `line_groups` ADD `autoFollowUpMessage` text;--> statement-breakpoint
ALTER TABLE `line_groups` ADD `lastAutoFollowUpAt` timestamp;