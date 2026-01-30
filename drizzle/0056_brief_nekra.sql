CREATE TABLE `livestream_csv_import_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`brandId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`livestreamCount` int NOT NULL,
	`createdCount` int NOT NULL,
	`updatedCount` int NOT NULL,
	`totalGmv` bigint,
	`dateRangeStart` timestamp,
	`dateRangeEnd` timestamp,
	`importedBy` int NOT NULL,
	`importedByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `livestream_csv_import_history_id` PRIMARY KEY(`id`)
);
