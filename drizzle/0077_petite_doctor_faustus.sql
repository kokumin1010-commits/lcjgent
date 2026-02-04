CREATE TABLE `line_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`originalRequest` text,
	`scheduledAt` bigint NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Tokyo',
	`repeatType` enum('none','daily','weekly','monthly') NOT NULL DEFAULT 'none',
	`repeatEndAt` bigint,
	`status` enum('pending','sent','cancelled','failed') NOT NULL DEFAULT 'pending',
	`sentAt` bigint,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_reminders_id` PRIMARY KEY(`id`)
);
