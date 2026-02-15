CREATE TABLE `product_restock_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productName` text NOT NULL,
	`shopName` varchar(255),
	`productId` varchar(64),
	`status` enum('active','fulfilled','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_restock_requests_id` PRIMARY KEY(`id`)
);
