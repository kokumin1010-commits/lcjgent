CREATE TABLE `brand_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileSize` bigint,
	`mimeType` varchar(128),
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_files_id` PRIMARY KEY(`id`)
);
