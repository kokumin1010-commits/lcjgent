CREATE TABLE `ai_advice_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adviceId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` enum('good','bad') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_advice_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_learning_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportContent` text NOT NULL,
	`adviceText` text NOT NULL,
	`isGoodExample` enum('yes','no') NOT NULL,
	`feedbackCount` int NOT NULL DEFAULT 0,
	`goodCount` int NOT NULL DEFAULT 0,
	`badCount` int NOT NULL DEFAULT 0,
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_learning_examples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_ai_advice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`adviceText` text NOT NULL,
	`adviceType` varchar(100),
	`promptUsed` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_ai_advice_id` PRIMARY KEY(`id`)
);
