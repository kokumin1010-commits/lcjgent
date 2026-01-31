CREATE TABLE `line_link_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`linkedLineUserId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_link_codes_id` PRIMARY KEY(`id`)
);
