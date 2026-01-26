CREATE TABLE `brand_edit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`actionType` enum('create','update','delete') NOT NULL,
	`entityType` enum('brand','product','livestream','contract','memo') NOT NULL,
	`entityId` int,
	`entityName` varchar(255),
	`changeDescription` text NOT NULL,
	`previousValue` text,
	`newValue` text,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_edit_logs_id` PRIMARY KEY(`id`)
);
