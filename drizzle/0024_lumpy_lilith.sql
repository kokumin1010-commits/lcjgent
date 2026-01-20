CREATE TABLE `line_follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('user','group') NOT NULL,
	`lineUserId` varchar(64),
	`lineGroupId` varchar(64),
	`triggerCondition` enum('no_reply','scheduled','event') NOT NULL,
	`delayHours` int NOT NULL DEFAULT 72,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`currentAttempts` int NOT NULL DEFAULT 0,
	`messageTemplate` text NOT NULL,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`lastSentAt` timestamp,
	`nextScheduledAt` timestamp,
	`brandId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineGroupId` varchar(64) NOT NULL,
	`groupName` varchar(255),
	`pictureUrl` text,
	`brandId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_groups_lineGroupId_unique` UNIQUE(`lineGroupId`)
);
--> statement-breakpoint
CREATE TABLE `line_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`sourceType` enum('user','group','room') NOT NULL,
	`lineUserId` varchar(64),
	`lineGroupId` varchar(64),
	`messageType` varchar(32) NOT NULL,
	`content` text,
	`direction` enum('incoming','outgoing') NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`lineTimestamp` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_messages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `line_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`displayName` varchar(255),
	`pictureUrl` text,
	`statusMessage` text,
	`brandId` int,
	`staffId` int,
	`liverId` int,
	`userType` enum('customer','staff','liver','unknown') NOT NULL DEFAULT 'unknown',
	`isBlocked` boolean NOT NULL DEFAULT false,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_users_lineUserId_unique` UNIQUE(`lineUserId`)
);
