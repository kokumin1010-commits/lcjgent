CREATE TABLE `contract_livestream_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`livestreamId` int NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_livestream_links_id` PRIMARY KEY(`id`)
);
