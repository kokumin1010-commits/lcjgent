CREATE TABLE `ai_coach_brain_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(50) NOT NULL,
	`targetId` int,
	`details` text,
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_coach_brain_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_coach_liver_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`summary` text NOT NULL,
	`strengths` text,
	`weaknesses` text,
	`currentGoals` text,
	`pastAdviceResults` text,
	`communicationStyle` text,
	`growthPhase` enum('new','developing','intermediate','advanced','expert') NOT NULL DEFAULT 'new',
	`coachingCount` int NOT NULL DEFAULT 0,
	`lastCoachingAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_coach_liver_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_coach_master_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	`isActive` int NOT NULL DEFAULT 1,
	CONSTRAINT `ai_coach_master_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `festival_company_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`contact_name` varchar(255) NOT NULL,
	`contact_department` varchar(255) NOT NULL,
	`contact_name_kana` varchar(255) NOT NULL,
	`postal_code` varchar(20) NOT NULL,
	`address` text NOT NULL,
	`phone` varchar(50) NOT NULL,
	`email` varchar(320) NOT NULL,
	`website_url` varchar(500) NOT NULL,
	`line_or_lark` varchar(255),
	`tiktok_shop_seller_name` varchar(255) NOT NULL,
	`brand_intro` text NOT NULL,
	`tiktok_shop_url` varchar(500),
	`matching_products` text,
	`target_audience` text NOT NULL,
	`sales_license` text NOT NULL,
	`status` enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
	`notes` text,
	`event_year` varchar(10) NOT NULL DEFAULT '2026',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `festival_company_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `festival_general_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participation_type` enum('corporate','individual') NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`department` varchar(255),
	`name` varchar(255) NOT NULL,
	`name_kana` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`attendance_schedule` enum('day1_only','day2_only','both_days') NOT NULL,
	`visit_purposes` json NOT NULL,
	`portrait_rights_consent` enum('agreed') NOT NULL,
	`compliance_consent` enum('agreed') NOT NULL,
	`status` enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
	`notes` text,
	`event_year` varchar(10) NOT NULL DEFAULT '2026',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `festival_general_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `festival_liver_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`name_kana` varchar(255) NOT NULL,
	`liver_name` varchar(255) NOT NULL,
	`agency` varchar(255),
	`account_info` text,
	`genre` varchar(255),
	`email` varchar(320) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`line_or_lark` varchar(255),
	`attendance_schedule` enum('day1_only','day2_only','both_days') NOT NULL,
	`matching_preference` enum('yes','no') NOT NULL,
	`portrait_rights_consent` enum('agreed') NOT NULL,
	`compliance_consent` enum('agreed') NOT NULL,
	`status` enum('new','confirmed','rejected','cancelled') NOT NULL DEFAULT 'new',
	`notes` text,
	`event_year` varchar(10) NOT NULL DEFAULT '2026',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `festival_liver_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lcj_brain_chat_logs` ADD `fileContent` text;--> statement-breakpoint
ALTER TABLE `lcj_brain_chat_logs` ADD `fileUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `lcj_brain_chat_logs` ADD `fileName` varchar(255);