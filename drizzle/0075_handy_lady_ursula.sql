CREATE TABLE `product_livers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`liverId` int NOT NULL,
	`specialSetName` varchar(255),
	`specialPrice` int,
	`commissionRate` decimal(5,2),
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_livers_id` PRIMARY KEY(`id`)
);
