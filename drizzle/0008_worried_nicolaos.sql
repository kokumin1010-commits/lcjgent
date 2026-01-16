CREATE TABLE `email_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reminderId` int NOT NULL,
	`taskId` int NOT NULL,
	`trackingToken` varchar(128) NOT NULL,
	`openedAt` bigint,
	`openCount` int NOT NULL DEFAULT 0,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_tracking_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_tracking_trackingToken_unique` UNIQUE(`trackingToken`)
);
