CREATE TABLE `step_email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`lineUserId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('sent','failed','skipped') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `step_email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `step_email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`bodyHtml` text NOT NULL,
	`bodyText` text NOT NULL,
	`delayDays` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `step_email_templates_id` PRIMARY KEY(`id`)
);
