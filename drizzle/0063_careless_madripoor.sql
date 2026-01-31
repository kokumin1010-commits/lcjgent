CREATE TABLE `mall_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_carts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productPrice` int NOT NULL,
	`productPointPrice` int,
	`quantity` int NOT NULL DEFAULT 1,
	`subtotal` int NOT NULL,
	`pointSubtotal` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(64) NOT NULL,
	`lineUserId` int NOT NULL,
	`status` enum('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`totalAmount` int NOT NULL,
	`pointsUsed` int NOT NULL DEFAULT 0,
	`cashAmount` int NOT NULL DEFAULT 0,
	`shippingName` varchar(255),
	`shippingPhone` varchar(50),
	`shippingPostalCode` varchar(20),
	`shippingAddress` text,
	`notes` text,
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	CONSTRAINT `mall_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `mall_orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `mall_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`price` int NOT NULL,
	`pointPrice` int,
	`stock` int NOT NULL DEFAULT 0,
	`imageUrl` text,
	`imageKey` varchar(512),
	`imageUrls` json,
	`imageKeys` json,
	`status` enum('draft','active','sold_out','archived') NOT NULL DEFAULT 'draft',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_products_id` PRIMARY KEY(`id`)
);
