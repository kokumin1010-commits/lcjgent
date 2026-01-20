CREATE TABLE `ai_question_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`questionText` text NOT NULL,
	`questionTextZh` text,
	`dayOfWeek` int,
	`priority` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`usageCount` int NOT NULL DEFAULT 0,
	`goodFeedbackCount` int NOT NULL DEFAULT 0,
	`badFeedbackCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_question_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_report_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('ai','user') NOT NULL,
	`content` text NOT NULL,
	`messageType` varchar(100),
	`questionCategory` varchar(100),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_report_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_report_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`reportDate` timestamp NOT NULL,
	`status` enum('in_progress','completed','converted') NOT NULL DEFAULT 'in_progress',
	`convertedReportId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_report_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_ai_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`preferredQuestionStyle` enum('detailed','simple','free') DEFAULT 'simple',
	`strongAreas` json,
	`improvementAreas` json,
	`commonPatterns` json,
	`totalReports` int NOT NULL DEFAULT 0,
	`totalChatSessions` int NOT NULL DEFAULT 0,
	`avgResponseLength` int DEFAULT 0,
	`goodFeedbackCount` int NOT NULL DEFAULT 0,
	`badFeedbackCount` int NOT NULL DEFAULT 0,
	`lastAnalyzedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_ai_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_ai_profiles_staffId_unique` UNIQUE(`staffId`)
);
