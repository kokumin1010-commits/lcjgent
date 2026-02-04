CREATE TABLE `liver_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`salesGoal` bigint NOT NULL DEFAULT 0,
	`streamCountGoal` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liver_goals_id` PRIMARY KEY(`id`)
);
