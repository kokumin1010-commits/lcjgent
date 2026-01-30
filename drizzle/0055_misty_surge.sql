CREATE TABLE `csv_import_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`livestreamId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`productCount` int NOT NULL,
	`totalGmv` bigint,
	`importedBy` int NOT NULL,
	`importedByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `csv_import_history_id` PRIMARY KEY(`id`)
);
