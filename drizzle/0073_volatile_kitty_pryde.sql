CREATE TABLE `liver_password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liver_password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `liver_password_reset_tokens_token_unique` UNIQUE(`token`)
);
