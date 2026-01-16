CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`reportDate` timestamp NOT NULL,
	`workContent` text NOT NULL,
	`issues` text,
	`remarks` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
