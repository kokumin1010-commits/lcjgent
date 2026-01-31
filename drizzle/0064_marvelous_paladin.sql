CREATE TABLE `user_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`label` varchar(50) NOT NULL DEFAULT '自宅',
	`recipientName` varchar(100) NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`postalCode` varchar(10) NOT NULL,
	`prefecture` varchar(20) NOT NULL,
	`city` varchar(100) NOT NULL,
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_addresses_id` PRIMARY KEY(`id`)
);
