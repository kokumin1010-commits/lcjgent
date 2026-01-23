CREATE TABLE `livers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`password` varchar(255) NOT NULL,
	`avatarUrl` text,
	`avatarKey` varchar(512),
	`bio` text,
	`color` varchar(20) DEFAULT '#FF69B4',
	`isActive` boolean NOT NULL DEFAULT true,
	`role` enum('liver','admin') NOT NULL DEFAULT 'liver',
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `livers_id` PRIMARY KEY(`id`),
	CONSTRAINT `livers_email_unique` UNIQUE(`email`)
);
