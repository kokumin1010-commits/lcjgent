CREATE TABLE `receipt_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`userId` int,
	`productName` text NOT NULL,
	`shopName` varchar(255),
	`amount` int,
	`orderNumber` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipt_products_id` PRIMARY KEY(`id`)
);
